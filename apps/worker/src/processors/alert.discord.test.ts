import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("axios");
vi.mock("@cronpilot/db", () => ({ prisma: {} }));
vi.mock("@cronpilot/emails", () => ({
	renderEmail: vi.fn(),
	AlertMissedEmail: {},
	AlertFailedEmail: {},
}));
vi.mock("resend", () => ({
	Resend: vi.fn(() => ({ emails: { send: vi.fn() } })),
}));
vi.mock("../lib/logger.js", () => ({
	logger: {
		child: vi.fn(() => ({
			debug: vi.fn(),
			info: vi.fn(),
			warn: vi.fn(),
			error: vi.fn(),
		})),
	},
}));
vi.mock("../lib/encryption.js", () => ({
	decrypt: vi.fn((v: string) => v),
}));

import { prisma } from "@cronpilot/db";
import type { AlertJobData } from "@cronpilot/shared";
import axios from "axios";
import type { Job } from "bullmq";
import { processAlert } from "./alert.js";

const mockAxiosPost = vi.mocked(axios.post);

function makeJob(data: AlertJobData): Job<AlertJobData> {
	return { id: "job-1", data } as Job<AlertJobData>;
}

function makeMonitor(overrides: {
	id?: string;
	alertType?: "discord";
	webhookUrl?: string;
	failureCount?: number;
	alertType2?: "missed" | "failed";
}) {
	return {
		id: overrides.id ?? "monitor-1",
		name: "My Job",
		teamId: "team-1",
		status: "active",
		alertRules: [
			{
				integrationId: "int-1",
				notifyAfter: 1,
				integration: {
					id: "int-1",
					type: "discord",
					// decrypt is mocked to return its input, so pass raw JSON
					config: JSON.stringify({
						webhookUrl: overrides.webhookUrl ?? "https://discord.com/api/webhooks/123/abc",
					}),
				},
			},
		],
	};
}

beforeEach(() => {
	vi.clearAllMocks();
	Object.assign(prisma, {
		monitor: { findUnique: vi.fn() },
		alert: { findFirst: vi.fn() },
	});
});

afterEach(() => {
	vi.clearAllMocks();
});

describe("processAlert — discord dispatch", () => {
	it("POSTs to the webhook URL with the correct content for a missed alert", async () => {
		mockAxiosPost.mockResolvedValue({ status: 204, data: "" });
		vi.mocked(prisma.monitor.findUnique).mockResolvedValue(makeMonitor({}));
		vi.mocked(prisma.alert.findFirst).mockResolvedValue({
			id: "alert-1",
			failureCount: 1,
			openedAt: new Date(),
		});

		await processAlert(makeJob({ monitorId: "monitor-1", teamId: "team-1", alertType: "missed" }));

		expect(mockAxiosPost).toHaveBeenCalledOnce();
		const [url, payload] = mockAxiosPost.mock.calls[0]!;
		expect(url).toBe("https://discord.com/api/webhooks/123/abc");
		expect((payload as { content: string }).content).toMatch(/🚨 Monitor `My Job` is late/);
	});

	it("uses 'down' status for a failed alert type", async () => {
		mockAxiosPost.mockResolvedValue({ status: 204, data: "" });
		vi.mocked(prisma.monitor.findUnique).mockResolvedValue(makeMonitor({}));
		vi.mocked(prisma.alert.findFirst).mockResolvedValue({
			id: "alert-1",
			failureCount: 1,
			openedAt: new Date(),
		});

		await processAlert(makeJob({ monitorId: "monitor-1", teamId: "team-1", alertType: "failed" }));

		const [, payload] = mockAxiosPost.mock.calls[0]!;
		expect((payload as { content: string }).content).toMatch(/is down/);
	});

	it("does not re-throw on axios error — other integrations must still run", async () => {
		mockAxiosPost.mockRejectedValue(new Error("network error"));
		vi.mocked(prisma.monitor.findUnique).mockResolvedValue(makeMonitor({}));
		vi.mocked(prisma.alert.findFirst).mockResolvedValue({
			id: "alert-1",
			failureCount: 1,
			openedAt: new Date(),
		});

		await expect(
			processAlert(makeJob({ monitorId: "monitor-1", teamId: "team-1", alertType: "missed" })),
		).resolves.toBeUndefined();
	});

	it("skips notification when failureCount does not meet notifyAfter threshold", async () => {
		mockAxiosPost.mockResolvedValue({ status: 204, data: "" });
		const monitor = makeMonitor({});
		monitor.alertRules[0]!.notifyAfter = 5;
		vi.mocked(prisma.monitor.findUnique).mockResolvedValue(monitor);
		vi.mocked(prisma.alert.findFirst).mockResolvedValue({
			id: "alert-1",
			failureCount: 3,
			openedAt: new Date(),
		});

		await processAlert(makeJob({ monitorId: "monitor-1", teamId: "team-1", alertType: "missed" }));

		expect(mockAxiosPost).not.toHaveBeenCalled();
	});
});
