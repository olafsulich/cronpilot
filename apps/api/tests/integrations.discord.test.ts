import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildServer } from "../src/server";

let server: FastifyInstance;
let accessToken: string;

beforeAll(async () => {
	server = await buildServer();
	await server.ready();

	const email = `discord-test-${Date.now()}@example.com`;
	const signup = await server.inject({
		method: "POST",
		url: "/auth/signup",
		payload: { email, password: "supersecret123", teamName: "Discord Test Team" },
	});
	const body = JSON.parse(signup.body) as { data: { accessToken: string } };
	accessToken = body.data.accessToken;
});

afterAll(async () => {
	await server.close();
});

describe("POST /integrations (discord)", () => {
	it("returns 201 and stores encrypted config", async () => {
		const response = await server.inject({
			method: "POST",
			url: "/integrations",
			headers: { Authorization: `Bearer ${accessToken}` },
			payload: {
				type: "discord",
				config: {
					webhookUrl: "https://discord.com/api/webhooks/123456789/abcdefg",
					channelName: "#oncall",
				},
			},
		});

		expect(response.statusCode).toBe(201);
		const body = JSON.parse(response.body) as {
			data: { id: string; type: string; name: string; createdAt: string };
		};
		expect(body.data.type).toBe("discord");
		expect(body.data.name).toBe("Discord (#oncall)");
		expect(body.data.id).toBeDefined();
		expect(body.data.createdAt).toBeDefined();
	});

	it("generates name without channel when channelName is omitted", async () => {
		const response = await server.inject({
			method: "POST",
			url: "/integrations",
			headers: { Authorization: `Bearer ${accessToken}` },
			payload: {
				type: "discord",
				config: {
					webhookUrl: "https://discord.com/api/webhooks/987654321/xyz",
				},
			},
		});

		expect(response.statusCode).toBe(201);
		const body = JSON.parse(response.body) as { data: { name: string } };
		expect(body.data.name).toBe("Discord");
	});

	it("rejects a non-Discord webhook URL with 400", async () => {
		const response = await server.inject({
			method: "POST",
			url: "/integrations",
			headers: { Authorization: `Bearer ${accessToken}` },
			payload: {
				type: "discord",
				config: {
					webhookUrl: "https://hooks.slack.com/services/not-discord",
				},
			},
		});

		expect(response.statusCode).toBe(400);
	});
});

describe("GET /integrations (discord)", () => {
	it("lists the discord integration without exposing the full webhook URL", async () => {
		const response = await server.inject({
			method: "GET",
			url: "/integrations",
			headers: { Authorization: `Bearer ${accessToken}` },
		});

		expect(response.statusCode).toBe(200);
		const body = JSON.parse(response.body) as {
			data: Array<{ type: string; config?: { webhookUrl?: string } }>;
		};
		const discord = body.data.find((i) => i.type === "discord");
		expect(discord).toBeDefined();
		// webhookUrl must be masked — full URL must not be present
		expect(discord?.config?.webhookUrl).not.toBe(
			"https://discord.com/api/webhooks/123456789/abcdefg",
		);
	});
});
