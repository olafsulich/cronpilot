import type { Integration } from "@cronpilot/db";
import type { IntegrationResponse } from "@cronpilot/shared";
import { AppError } from "@cronpilot/shared";
import { z } from "zod";
import { decrypt, encrypt } from "../lib/encryption";
import { prisma } from "../lib/prisma";

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const SlackConfigSchema = z.object({
	webhookUrl: z.string().url(),
	channel: z.string().optional(),
});

export const PagerDutyConfigSchema = z.object({
	integrationKey: z.string().min(1),
});

export const WebhookConfigSchema = z.object({
	url: z.string().url(),
	secret: z.string().optional(),
	headers: z.record(z.string()).optional(),
});

export const EmailConfigSchema = z.object({
	email: z.string().email(),
});

export const CreateIntegrationSchema = z.discriminatedUnion("type", [
	z.object({ type: z.literal("slack"), config: SlackConfigSchema }),
	z.object({ type: z.literal("pagerduty"), config: PagerDutyConfigSchema }),
	z.object({ type: z.literal("webhook"), config: WebhookConfigSchema }),
	z.object({ type: z.literal("email"), config: EmailConfigSchema }),
]);

export type CreateIntegrationInput = z.infer<typeof CreateIntegrationSchema>;

// ---------------------------------------------------------------------------
// Mapping — never expose raw encrypted config
// ---------------------------------------------------------------------------

function mapIntegration(integration: Integration): IntegrationResponse {
	return {
		id: integration.id,
		teamId: integration.teamId,
		type: integration.type,
		name: integration.name,
		// Return the decrypted config with secrets partially masked
		config: maskConfig(
			integration.type,
			decryptConfig(integration.encryptedConfig),
		),
		createdAt: integration.createdAt.toISOString(),
	};
}

function decryptConfig(encrypted: string): Record<string, unknown> {
	try {
		return JSON.parse(decrypt(encrypted)) as Record<string, unknown>;
	} catch {
		return {};
	}
}

function maskConfig(
	type: string,
	config: Record<string, unknown>,
): Record<string, unknown> {
	// Mask sensitive fields in the response
	if (type === "slack") {
		const url = String(config.webhookUrl ?? "");
		return {
			...config,
			webhookUrl: url.length > 20 ? `${url.substring(0, 20)}...` : "***",
		};
	}
	if (type === "pagerduty") {
		const key = String(config.integrationKey ?? "");
		return {
			...config,
			integrationKey:
				key.length > 8 ? `${key.substring(0, 4)}...${key.slice(-4)}` : "***",
		};
	}
	if (type === "webhook") {
		const secret = config.secret;
		return {
			...config,
			...(secret !== undefined && { secret: "***" }),
		};
	}
	return config;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function listIntegrations(
	teamId: string,
): Promise<IntegrationResponse[]> {
	const integrations = await prisma.integration.findMany({
		where: { teamId },
		orderBy: { createdAt: "desc" },
	});
	return integrations.map(mapIntegration);
}

export async function createIntegration(
	teamId: string,
	input: CreateIntegrationInput,
): Promise<IntegrationResponse> {
	const configJson = JSON.stringify(input.config);
	const encryptedConfig = encrypt(configJson);

	const name = buildIntegrationName(input);

	const integration = await prisma.integration.create({
		data: {
			teamId,
			type: input.type,
			name,
			encryptedConfig,
		},
	});

	return mapIntegration(integration);
}

function buildIntegrationName(input: CreateIntegrationInput): string {
	switch (input.type) {
		case "slack":
			return `Slack${input.config.channel ? ` (#${input.config.channel})` : ""}`;
		case "pagerduty":
			return "PagerDuty";
		case "webhook":
			return `Webhook (${new URL(input.config.url).hostname})`;
		case "email":
			return `Email (${input.config.email})`;
	}
}

export async function deleteIntegration(
	teamId: string,
	integrationId: string,
): Promise<void> {
	const existing = await prisma.integration.findFirst({
		where: { id: integrationId, teamId },
	});
	if (!existing) {
		throw new AppError("NOT_FOUND", "Integration not found", 404);
	}
	await prisma.integration.delete({ where: { id: integrationId } });
}

export async function testIntegration(
	teamId: string,
	integrationId: string,
): Promise<{ success: boolean; message?: string }> {
	const integration = await prisma.integration.findFirst({
		where: { id: integrationId, teamId },
	});
	if (!integration) {
		throw new AppError("NOT_FOUND", "Integration not found", 404);
	}

	const config = decryptConfig(integration.encryptedConfig);

	try {
		if (integration.type === "slack") {
			const webhookUrl = String(config.webhookUrl ?? "");
			const res = await fetch(webhookUrl, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					text: "✅ Cronpilot test notification — your Slack integration is working!",
				}),
			});
			if (!res.ok) {
				return {
					success: false,
					message: `Slack returned status ${res.status}`,
				};
			}
			return { success: true };
		}

		if (integration.type === "webhook") {
			const url = String(config.url ?? "");
			const headers: Record<string, string> = {
				"Content-Type": "application/json",
				...(typeof config.headers === "object" && config.headers !== null
					? (config.headers as Record<string, string>)
					: {}),
			};
			const res = await fetch(url, {
				method: "POST",
				headers,
				body: JSON.stringify({
					event: "test",
					message: "Cronpilot test notification",
					timestamp: new Date().toISOString(),
				}),
			});
			if (!res.ok) {
				return {
					success: false,
					message: `Webhook returned status ${res.status}`,
				};
			}
			return { success: true };
		}

		if (integration.type === "pagerduty") {
			const integrationKey = String(config.integrationKey ?? "");
			const res = await fetch("https://events.pagerduty.com/v2/enqueue", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					routing_key: integrationKey,
					event_action: "trigger",
					dedup_key: `cronpilot-test-${Date.now()}`,
					payload: {
						summary: "Cronpilot test alert — please ignore",
						severity: "info",
						source: "cronpilot",
					},
				}),
			});
			if (!res.ok) {
				return {
					success: false,
					message: `PagerDuty returned status ${res.status}`,
				};
			}
			return { success: true };
		}

		if (integration.type === "email") {
			// Email testing is a no-op in this service layer; actual sending goes through the worker
			return {
				success: true,
				message: "Email integrations are verified during delivery",
			};
		}

		return { success: false, message: "Unknown integration type" };
	} catch (err) {
		const message = err instanceof Error ? err.message : "Unknown error";
		return { success: false, message };
	}
}
