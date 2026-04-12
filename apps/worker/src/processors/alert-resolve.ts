import { createHmac } from "node:crypto";
import { prisma } from "@cronpilot/db";
import { AlertResolvedEmail, renderEmail } from "@cronpilot/emails";
import type {
	AlertResolveJobData,
	EmailConfig,
	PagerDutyConfig,
	SlackConfig,
	WebhookConfig,
} from "@cronpilot/shared";
import axios from "axios";
import type { Job } from "bullmq";
import { Resend } from "resend";
import { decrypt } from "../lib/encryption.js";
import { logger } from "../lib/logger.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

/**
 * Resolves an open alert when a check-in resumes after a missed/failed period.
 * Sends resolution notifications to all configured integrations.
 */
export async function processAlertResolve(
	job: Job<AlertResolveJobData>,
): Promise<void> {
	const { monitorId, alertId } = job.data;
	const jobLog = logger.child({
		jobId: job.id,
		monitorId,
		alertId,
		processor: "alert-resolve",
	});

	const alert = await prisma.alert.findUnique({
		where: { id: alertId },
	});

	if (!alert) {
		jobLog.warn("alert not found — skipping");
		return;
	}

	if (alert.monitorId !== monitorId) {
		jobLog.warn("monitorId mismatch on alert record — skipping");
		return;
	}

	if (alert.status === "resolved") {
		jobLog.info("alert already resolved — skipping");
		return;
	}

	const monitor = await prisma.monitor.findUnique({
		where: { id: monitorId },
		include: {
			alertRules: {
				include: {
					integration: true,
				},
			},
		},
	});

	if (!monitor) {
		jobLog.warn("monitor not found — skipping");
		return;
	}

	// Mark the alert as resolved
	const resolvedAt = new Date();
	await prisma.alert.update({
		where: { id: alertId },
		data: {
			status: "resolved",
			resolvedAt,
		},
	});

	jobLog.info({ resolvedAt }, "alert marked as resolved");

	const dashboardUrl = `${APP_URL}/monitors/${monitorId}?utm_source=email&utm_campaign=alert-resolved`;

	// Notify each integration that the monitor has recovered
	for (const rule of monitor.alertRules) {
		const integration = rule.integration;
		let configJson: string;

		try {
			configJson = decrypt(integration.config as string);
		} catch (err) {
			jobLog.error(
				{ err, integrationId: integration.id },
				"failed to decrypt integration config — skipping",
			);
			continue;
		}

		const config = JSON.parse(configJson) as Record<string, unknown>;

		try {
			switch (integration.type) {
				case "slack":
					await resolveSlack(
						config as SlackConfig,
						monitor.name,
						alert.failureCount,
						dashboardUrl,
						jobLog,
					);
					break;
				case "pagerduty":
					await resolvePagerDuty(
						config as PagerDutyConfig,
						monitor.name,
						monitorId,
						jobLog,
					);
					break;
				case "webhook":
					await resolveWebhook(
						config as WebhookConfig,
						monitor.id,
						monitor.name,
						alertId,
						alert.failureCount,
						jobLog,
					);
					break;
				case "email":
					await resolveEmail(
						config as EmailConfig,
						monitor.name,
						alert.failureCount,
						dashboardUrl,
						jobLog,
					);
					break;
				default: {
					const _exhaustive: never = integration.type;
					jobLog.warn({ type: _exhaustive }, "unknown integration type");
				}
			}

			jobLog.info(
				{ integrationId: integration.id, type: integration.type },
				"resolution notification dispatched",
			);
		} catch (err) {
			jobLog.error(
				{ err, integrationId: integration.id, type: integration.type },
				"failed to dispatch resolution notification",
			);
		}
	}

	jobLog.info("alert resolution processing complete");
}

async function resolveSlack(
	config: SlackConfig,
	monitorName: string,
	failureCount: number,
	dashboardUrl: string,
	jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
	const payload = {
		text: `✅ Monitor *${monitorName}* has recovered after ${failureCount} failure${failureCount !== 1 ? "s" : ""}`,
		attachments: [
			{
				color: "#36a64f",
				fields: [
					{
						title: "Monitor",
						value: monitorName,
						short: true,
					},
					{
						title: "Failures before recovery",
						value: String(failureCount),
						short: true,
					},
				],
				actions: [
					{
						type: "button",
						text: "View in dashboard",
						url: dashboardUrl,
					},
				],
				footer: "Cronpilot",
				ts: Math.floor(Date.now() / 1000),
			},
		],
	};

	jobLog.debug({ webhookUrl: "[redacted]" }, "posting resolution to Slack");
	await axios.post(config.webhookUrl, payload, { timeout: 10_000 });
}

async function resolvePagerDuty(
	config: PagerDutyConfig,
	monitorName: string,
	monitorId: string,
	jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
	const payload = {
		routing_key: config.integrationKey,
		event_action: "resolve",
		dedup_key: `cronpilot-monitor-${monitorId}`,
		payload: {
			summary: `Monitor "${monitorName}" has recovered`,
			severity: "info",
			source: "cronpilot",
		},
	};

	jobLog.debug("posting resolution to PagerDuty");
	await axios.post("https://events.pagerduty.com/v2/enqueue", payload, {
		timeout: 10_000,
		headers: { "Content-Type": "application/json" },
	});
}

async function resolveWebhook(
	config: WebhookConfig,
	monitorId: string,
	monitorName: string,
	alertId: string,
	failureCount: number,
	jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
	const body = JSON.stringify({
		event: "monitor.alert.resolved",
		monitor: {
			id: monitorId,
			name: monitorName,
		},
		alert: {
			id: alertId,
			failureCount,
		},
		timestamp: new Date().toISOString(),
	});

	const signature = createHmac("sha256", config.secret)
		.update(body)
		.digest("hex");

	jobLog.debug({ url: config.url }, "posting resolution to webhook");
	await axios.post(config.url, body, {
		timeout: 10_000,
		headers: {
			"Content-Type": "application/json",
			"X-Cronpilot-Signature": `sha256=${signature}`,
		},
	});
}

async function resolveEmail(
	config: EmailConfig,
	monitorName: string,
	failureCount: number,
	dashboardUrl: string,
	jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
	const { html, text } = await renderEmail(AlertResolvedEmail, {
		monitorName,
		resolvedAt: new Date(),
		failureCount,
		dashboardUrl,
	});

	jobLog.debug({ to: config.address }, "sending resolution email");

	await resend.emails.send({
		from: "alerts@cronpilot.io",
		to: config.address,
		subject: `Your job "${monitorName}" has recovered`,
		html,
		text,
	});
}
