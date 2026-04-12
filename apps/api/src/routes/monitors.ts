import { AppError } from "@cronpilot/shared";
import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { authenticate } from "../hooks/authenticate";
import { rateLimitApi } from "../hooks/rate-limit";
import {
	CreateMonitorSchema,
	createMonitor,
	deleteMonitor,
	getMonitor,
	listMonitors,
	PaginationSchema,
	pauseMonitor,
	resumeMonitor,
	UpdateMonitorSchema,
	updateMonitor,
} from "../services/monitors";

async function monitorsPlugin(fastify: FastifyInstance): Promise<void> {
	const preHandler = [authenticate, rateLimitApi];

	// GET /monitors
	fastify.get("/monitors", { preHandler }, async (request, reply) => {
		const pagination = PaginationSchema.safeParse(request.query);
		if (!pagination.success) {
			throw new AppError(
				"VALIDATION_ERROR",
				"Invalid pagination parameters",
				400,
			);
		}
		const result = await listMonitors(request.team.id, pagination.data);
		return reply.send(result);
	});

	// POST /monitors
	fastify.post("/monitors", { preHandler }, async (request, reply) => {
		const parsed = CreateMonitorSchema.safeParse(request.body);
		if (!parsed.success) {
			const msg = parsed.error.errors
				.map((e) => `${e.path.join(".")}: ${e.message}`)
				.join(", ");
			throw new AppError("VALIDATION_ERROR", msg, 400);
		}
		const monitor = await createMonitor(request.team.id, parsed.data);
		return reply.status(201).send({ data: monitor });
	});

	// GET /monitors/:id
	fastify.get<{ Params: { id: string } }>(
		"/monitors/:id",
		{ preHandler },
		async (request, reply) => {
			const monitor = await getMonitor(request.team.id, request.params.id);
			return reply.send({ data: monitor });
		},
	);

	// PATCH /monitors/:id
	fastify.patch<{ Params: { id: string } }>(
		"/monitors/:id",
		{ preHandler },
		async (request, reply) => {
			const parsed = UpdateMonitorSchema.safeParse(request.body);
			if (!parsed.success) {
				const msg = parsed.error.errors
					.map((e) => `${e.path.join(".")}: ${e.message}`)
					.join(", ");
				throw new AppError("VALIDATION_ERROR", msg, 400);
			}
			const monitor = await updateMonitor(
				request.team.id,
				request.params.id,
				parsed.data,
			);
			return reply.send({ data: monitor });
		},
	);

	// DELETE /monitors/:id
	fastify.delete<{ Params: { id: string } }>(
		"/monitors/:id",
		{ preHandler },
		async (request, reply) => {
			await deleteMonitor(request.team.id, request.params.id);
			return reply.status(204).send();
		},
	);

	// POST /monitors/:id/pause
	fastify.post<{ Params: { id: string } }>(
		"/monitors/:id/pause",
		{ preHandler },
		async (request, reply) => {
			const monitor = await pauseMonitor(request.team.id, request.params.id);
			return reply.send({ data: monitor });
		},
	);

	// POST /monitors/:id/resume
	fastify.post<{ Params: { id: string } }>(
		"/monitors/:id/resume",
		{ preHandler },
		async (request, reply) => {
			const monitor = await resumeMonitor(request.team.id, request.params.id);
			return reply.send({ data: monitor });
		},
	);
}

export default fp(monitorsPlugin, { name: "monitors-routes" });
