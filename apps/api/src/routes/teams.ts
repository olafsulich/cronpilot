import { AppError } from "@cronpilot/shared";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { authenticate } from "../hooks/authenticate";
import { rateLimitApi } from "../hooks/rate-limit";
import { prisma } from "../lib/prisma";

const UpdateTeamSchema = z.object({
	name: z.string().min(1).max(100).optional(),
	slug: z
		.string()
		.min(1)
		.max(50)
		.regex(
			/^[a-z0-9-]+$/,
			"Slug may only contain lowercase letters, numbers, and hyphens",
		)
		.optional(),
});

const InviteMemberSchema = z.object({
	email: z.string().email(),
	role: z.enum(["admin", "member"]).default("member"),
});

const UpdateMemberSchema = z.object({
	role: z.enum(["admin", "member"]),
});

async function teamsPlugin(fastify: FastifyInstance): Promise<void> {
	const preHandler = [authenticate, rateLimitApi];

	// GET /teams/current
	fastify.get("/teams/current", { preHandler }, async (request, reply) => {
		const team = await prisma.team.findUniqueOrThrow({
			where: { id: request.team.id },
			select: {
				id: true,
				name: true,
				slug: true,
				plan: true,
				trialEndsAt: true,
				stripeCustomerId: true,
				stripeSubscriptionId: true,
				createdAt: true,
			},
		});

		return reply.send({
			data: {
				id: team.id,
				name: team.name,
				slug: team.slug,
				plan: team.plan,
				trialEndsAt: team.trialEndsAt?.toISOString() ?? null,
				createdAt: team.createdAt.toISOString(),
			},
		});
	});

	// PATCH /teams/current
	fastify.patch("/teams/current", { preHandler }, async (request, reply) => {
		// Only owners and admins may update team settings
		const membership = await prisma.teamMember.findUniqueOrThrow({
			where: {
				userId_teamId: { userId: request.user.id, teamId: request.team.id },
			},
		});
		if (membership.role !== "owner" && membership.role !== "admin") {
			throw new AppError(
				"FORBIDDEN",
				"Only team owners and admins can update team settings",
				403,
			);
		}

		const parsed = UpdateTeamSchema.safeParse(request.body);
		if (!parsed.success) {
			const msg = parsed.error.errors
				.map((e) => `${e.path.join(".")}: ${e.message}`)
				.join(", ");
			throw new AppError("VALIDATION_ERROR", msg, 400);
		}

		const { name, slug } = parsed.data;

		if (slug) {
			const conflict = await prisma.team.findFirst({
				where: { slug, id: { not: request.team.id } },
			});
			if (conflict) {
				throw new AppError("CONFLICT", "That slug is already taken", 409);
			}
		}

		const team = await prisma.team.update({
			where: { id: request.team.id },
			data: {
				...(name !== undefined && { name }),
				...(slug !== undefined && { slug }),
			},
		});

		return reply.send({
			data: {
				id: team.id,
				name: team.name,
				slug: team.slug,
				plan: team.plan,
			},
		});
	});

	// POST /teams/invite
	fastify.post("/teams/invite", { preHandler }, async (request, reply) => {
		const membership = await prisma.teamMember.findUniqueOrThrow({
			where: {
				userId_teamId: { userId: request.user.id, teamId: request.team.id },
			},
		});
		if (membership.role !== "owner" && membership.role !== "admin") {
			throw new AppError(
				"FORBIDDEN",
				"Only team owners and admins can invite members",
				403,
			);
		}

		const parsed = InviteMemberSchema.safeParse(request.body);
		if (!parsed.success) {
			const msg = parsed.error.errors
				.map((e) => `${e.path.join(".")}: ${e.message}`)
				.join(", ");
			throw new AppError("VALIDATION_ERROR", msg, 400);
		}

		const { email, role } = parsed.data;

		// Check if user with that email already exists and is already a member
		const invitee = await prisma.user.findUnique({ where: { email } });
		if (invitee) {
			const existingMembership = await prisma.teamMember.findUnique({
				where: {
					userId_teamId: { userId: invitee.id, teamId: request.team.id },
				},
			});
			if (existingMembership) {
				throw new AppError(
					"CONFLICT",
					"This user is already a member of the team",
					409,
				);
			}
		}

		// Create or find invite token
		const invite = await prisma.teamInvite.create({
			data: {
				teamId: request.team.id,
				email,
				role,
				invitedByUserId: request.user.id,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		// In production this would enqueue an email job; for now return the invite
		return reply.status(201).send({
			data: {
				id: invite.id,
				email: invite.email,
				role: invite.role,
				expiresAt: invite.expiresAt.toISOString(),
			},
		});
	});

	// GET /teams/members
	fastify.get("/teams/members", { preHandler }, async (request, reply) => {
		const members = await prisma.teamMember.findMany({
			where: { teamId: request.team.id },
			include: { user: { select: { id: true, email: true, createdAt: true } } },
			orderBy: { createdAt: "asc" },
		});

		return reply.send({
			data: members.map((m) => ({
				userId: m.userId,
				email: m.user.email,
				role: m.role,
				joinedAt: m.createdAt.toISOString(),
			})),
		});
	});

	// PATCH /teams/members/:userId
	fastify.patch<{ Params: { userId: string } }>(
		"/teams/members/:userId",
		{ preHandler },
		async (request, reply) => {
			const callerMembership = await prisma.teamMember.findUniqueOrThrow({
				where: {
					userId_teamId: { userId: request.user.id, teamId: request.team.id },
				},
			});
			if (callerMembership.role !== "owner") {
				throw new AppError(
					"FORBIDDEN",
					"Only the team owner can change member roles",
					403,
				);
			}
			if (request.params.userId === request.user.id) {
				throw new AppError(
					"BAD_REQUEST",
					"You cannot change your own role",
					400,
				);
			}

			const parsed = UpdateMemberSchema.safeParse(request.body);
			if (!parsed.success) {
				throw new AppError("VALIDATION_ERROR", "Invalid role", 400);
			}

			const updated = await prisma.teamMember.update({
				where: {
					userId_teamId: {
						userId: request.params.userId,
						teamId: request.team.id,
					},
				},
				data: { role: parsed.data.role },
				include: { user: { select: { email: true } } },
			});

			return reply.send({
				data: {
					userId: updated.userId,
					email: updated.user.email,
					role: updated.role,
				},
			});
		},
	);

	// DELETE /teams/members/:userId
	fastify.delete<{ Params: { userId: string } }>(
		"/teams/members/:userId",
		{ preHandler },
		async (request, reply) => {
			const callerMembership = await prisma.teamMember.findUniqueOrThrow({
				where: {
					userId_teamId: { userId: request.user.id, teamId: request.team.id },
				},
			});

			const isOwner = callerMembership.role === "owner";
			const isAdmin = callerMembership.role === "admin";
			const isSelf = request.params.userId === request.user.id;

			if (!isSelf && !isOwner && !isAdmin) {
				throw new AppError(
					"FORBIDDEN",
					"You do not have permission to remove this member",
					403,
				);
			}

			const targetMembership = await prisma.teamMember.findUnique({
				where: {
					userId_teamId: {
						userId: request.params.userId,
						teamId: request.team.id,
					},
				},
			});
			if (!targetMembership) {
				throw new AppError("NOT_FOUND", "Member not found", 404);
			}
			if (targetMembership.role === "owner" && !isSelf) {
				throw new AppError("FORBIDDEN", "Cannot remove the team owner", 403);
			}

			await prisma.teamMember.delete({
				where: {
					userId_teamId: {
						userId: request.params.userId,
						teamId: request.team.id,
					},
				},
			});

			return reply.status(204).send();
		},
	);
}

export default fp(teamsPlugin, { name: "teams-routes" });
