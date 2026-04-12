import { AppError } from "@cronpilot/shared";
import { Prisma } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { ZodError } from "zod";

function errorHandler(
	error: unknown,
	_request: FastifyRequest,
	reply: FastifyReply,
): void {
	// AppError — known application errors
	if (error instanceof AppError) {
		void reply.status(error.statusCode).send({
			error: {
				code: error.code,
				message: error.message,
			},
		});
		return;
	}

	// Zod validation errors
	if (error instanceof ZodError) {
		const message = error.errors
			.map((e) => `${e.path.join(".")}: ${e.message}`)
			.join(", ");
		void reply.status(400).send({
			error: {
				code: "VALIDATION_ERROR",
				message,
			},
		});
		return;
	}

	// Prisma known request errors
	if (error instanceof Prisma.PrismaClientKnownRequestError) {
		if (error.code === "P2002") {
			void reply.status(409).send({
				error: {
					code: "CONFLICT",
					message: "A resource with that identifier already exists.",
				},
			});
			return;
		}
		if (error.code === "P2025") {
			void reply.status(404).send({
				error: {
					code: "NOT_FOUND",
					message: "The requested resource was not found.",
				},
			});
			return;
		}
	}

	// Fastify validation errors (schema-based)
	if (
		typeof error === "object" &&
		error !== null &&
		"statusCode" in error &&
		(error as { statusCode: number }).statusCode === 400
	) {
		void reply.status(400).send({
			error: {
				code: "VALIDATION_ERROR",
				message:
					"message" in error
						? String((error as { message: string }).message)
						: "Invalid request",
			},
		});
		return;
	}

	// Log unexpected errors
	console.error("[unhandled error]", error);

	void reply.status(500).send({
		error: {
			code: "INTERNAL_SERVER_ERROR",
			message: "An unexpected error occurred.",
		},
	});
}

async function errorHandlerPlugin(fastify: FastifyInstance): Promise<void> {
	fastify.setErrorHandler(errorHandler);
}

export default fp(errorHandlerPlugin, { name: "error-handler" });
