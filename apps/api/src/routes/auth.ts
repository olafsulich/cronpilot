import { AppError } from "@cronpilot/shared";
import bcrypt from "bcryptjs";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { z } from "zod";
import { authenticate } from "../hooks/authenticate";
import { prisma } from "../lib/prisma";
import { redis } from "../lib/redis";

const SALT_ROUNDS = 12;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

const SignupSchema = z.object({
	email: z.string().email(),
	password: z.string().min(8).max(128),
	teamName: z.string().min(1).max(100),
});

const LoginSchema = z.object({
	email: z.string().email(),
	password: z.string().min(1),
});

const RefreshSchema = z.object({
	refreshToken: z.string().min(1),
});

function slugify(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

async function authPlugin(fastify: FastifyInstance): Promise<void> {
	// POST /auth/signup
	fastify.post("/auth/signup", async (request, reply) => {
		const body = SignupSchema.safeParse(request.body);
		if (!body.success) {
			throw new AppError(
				"VALIDATION_ERROR",
				body.error.errors.map((e) => e.message).join(", "),
				400,
			);
		}

		const { email, password, teamName } = body.data;

		const existing = await prisma.user.findUnique({ where: { email } });
		if (existing) {
			throw new AppError(
				"CONFLICT",
				"An account with this email already exists",
				409,
			);
		}

		const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

		// Build a unique slug
		const baseSlug = slugify(teamName);
		let slug = baseSlug;
		let suffix = 1;
		while (await prisma.team.findUnique({ where: { slug } })) {
			slug = `${baseSlug}-${suffix++}`;
		}

		const result = await prisma.$transaction(async (tx) => {
			const user = await tx.user.create({
				data: { email, passwordHash },
			});

			const team = await tx.team.create({
				data: {
					name: teamName,
					slug,
					plan: "free",
					trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
				},
			});

			await tx.teamMember.create({
				data: { userId: user.id, teamId: team.id, role: "owner" },
			});

			return { user, team };
		});

		const { user, team } = result;

		const accessToken = fastify.jwt.sign(
			{ userId: user.id, teamId: team.id },
			{ expiresIn: ACCESS_TOKEN_TTL },
		);
		const refreshToken = fastify.jwt.sign(
			{ userId: user.id, teamId: team.id, type: "refresh" },
			{
				secret: process.env.JWT_REFRESH_SECRET ?? "refresh-secret",
				expiresIn: REFRESH_TOKEN_TTL,
			},
		);

		return reply.status(201).send({
			data: {
				accessToken,
				refreshToken,
				user: { id: user.id, email: user.email },
				team: {
					id: team.id,
					name: team.name,
					slug: team.slug,
					plan: team.plan,
				},
			},
		});
	});

	// POST /auth/login
	fastify.post("/auth/login", async (request, reply) => {
		const body = LoginSchema.safeParse(request.body);
		if (!body.success) {
			throw new AppError(
				"VALIDATION_ERROR",
				body.error.errors.map((e) => e.message).join(", "),
				400,
			);
		}

		const { email, password } = body.data;

		const user = await prisma.user.findUnique({ where: { email } });
		if (!user) {
			throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
		}

		const valid = await bcrypt.compare(password, user.passwordHash);
		if (!valid) {
			throw new AppError("UNAUTHORIZED", "Invalid email or password", 401);
		}

		// Find the user's primary team (the one they own, or first membership)
		const membership = await prisma.teamMember.findFirst({
			where: { userId: user.id },
			orderBy: [{ role: "asc" }, { createdAt: "asc" }],
			include: { team: true },
		});
		if (!membership) {
			throw new AppError("INTERNAL_ERROR", "User has no team membership", 500);
		}

		const team = membership.team;

		const accessToken = fastify.jwt.sign(
			{ userId: user.id, teamId: team.id },
			{ expiresIn: ACCESS_TOKEN_TTL },
		);
		const refreshToken = fastify.jwt.sign(
			{ userId: user.id, teamId: team.id, type: "refresh" },
			{
				secret: process.env.JWT_REFRESH_SECRET ?? "refresh-secret",
				expiresIn: REFRESH_TOKEN_TTL,
			},
		);

		return reply.send({
			data: {
				accessToken,
				refreshToken,
				user: { id: user.id, email: user.email },
				team: {
					id: team.id,
					name: team.name,
					slug: team.slug,
					plan: team.plan,
				},
			},
		});
	});

	// POST /auth/refresh
	fastify.post("/auth/refresh", async (request, reply) => {
		const body = RefreshSchema.safeParse(request.body);
		if (!body.success) {
			throw new AppError("VALIDATION_ERROR", "refreshToken is required", 400);
		}

		const { refreshToken } = body.data;

		// Check blocklist
		const blocked = await redis.get(`blocklist:${refreshToken}`);
		if (blocked) {
			throw new AppError("UNAUTHORIZED", "Refresh token has been revoked", 401);
		}

		let payload: { userId: string; teamId: string; type?: string };
		try {
			payload = fastify.jwt.verify<{
				userId: string;
				teamId: string;
				type?: string;
			}>(refreshToken, {
				secret: process.env.JWT_REFRESH_SECRET ?? "refresh-secret",
			});
		} catch {
			throw new AppError(
				"UNAUTHORIZED",
				"Invalid or expired refresh token",
				401,
			);
		}

		if (payload.type !== "refresh") {
			throw new AppError("UNAUTHORIZED", "Invalid token type", 401);
		}

		const user = await prisma.user.findUnique({
			where: { id: payload.userId },
		});
		if (!user) {
			throw new AppError("UNAUTHORIZED", "User not found", 401);
		}

		const accessToken = fastify.jwt.sign(
			{ userId: payload.userId, teamId: payload.teamId },
			{ expiresIn: ACCESS_TOKEN_TTL },
		);

		return reply.send({
			data: { accessToken },
		});
	});

	// POST /auth/logout
	fastify.post(
		"/auth/logout",
		{ preHandler: authenticate },
		async (request, reply) => {
			const body = RefreshSchema.safeParse(request.body);
			if (body.success) {
				const { refreshToken } = body.data;
				// Add to blocklist until it naturally expires
				await redis.set(
					`blocklist:${refreshToken}`,
					"1",
					"EX",
					REFRESH_TOKEN_TTL_SECONDS,
				);
			}

			return reply.send({ data: { ok: true } });
		},
	);
}

export default fp(authPlugin, { name: "auth-routes" });
