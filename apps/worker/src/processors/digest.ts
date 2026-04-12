import { prisma } from "@cronpilot/db";
import { DigestEmail, renderEmail } from "@cronpilot/emails";
import type { DigestJobData } from "@cronpilot/shared";
import type { Job } from "bullmq";
import { Resend } from "resend";
import { logger } from "../lib/logger.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const PERIOD_DAYS = 7;

/**
 * Sends the weekly digest email to each team owner.
 * Summarises uptime %, monitor health, and incidents for the past 7 days.
 *
 * When triggered by the recurring cron job the payload is empty; when triggered
 * for a specific team (e.g. from a test route) the teamId from the payload is used.
 */
export async function processDigest(job: Job<DigestJobData>): Promise<void> {
	const jobLog = logger.child({ jobId: job.id, processor: "digest" });

	const periodEnd = job.data.periodEnd
		? new Date(job.data.periodEnd)
		: new Date();
	const periodStart = job.data.periodStart
		? new Date(job.data.periodStart)
		: new Date(periodEnd.getTime() - PERIOD_DAYS * 24 * 60 * 60 * 1000);

	// If a specific teamId is provided, process only that team; otherwise do all.
	const teamFilter = job.data.teamId ? { id: job.data.teamId } : {};

	const teams = await prisma.team.findMany({
		where: teamFilter,
		include: {
			members: {
				where: { role: "owner" },
				include: { user: true },
			},
		},
	});

	jobLog.info(
		{ teamCount: teams.length, periodStart, periodEnd },
		"starting digest run",
	);

	let sent = 0;
	let skipped = 0;

	for (const team of teams) {
		const ownerMember = team.members[0];
		if (!ownerMember) {
			jobLog.warn(
				{ teamId: team.id },
				"no owner found for team — skipping digest",
			);
			skipped++;
			continue;
		}

		const owner = ownerMember.user;

		// Fetch all active monitors for this team
		const monitors = await prisma.monitor.findMany({
			where: { teamId: team.id, status: "active" },
		});

		if (monitors.length === 0) {
			jobLog.debug(
				{ teamId: team.id },
				"team has no active monitors — skipping digest",
			);
			skipped++;
			continue;
		}

		const monitorIds = monitors.map((m) => m.id);

		// Calculate uptime per monitor: (ok check-ins / expected check-ins in window)
		// We use total check-ins received as proxy for expected when schedule computation
		// would be complex; count ok vs total for a simple uptime percentage.
		const checkinStats = await prisma.checkin.groupBy({
			by: ["monitorId", "status"],
			where: {
				monitorId: { in: monitorIds },
				receivedAt: { gte: periodStart, lte: periodEnd },
			},
			_count: { id: true },
		});

		const statsByMonitor: Record<string, { ok: number; total: number }> = {};
		for (const stat of checkinStats) {
			if (!statsByMonitor[stat.monitorId]) {
				statsByMonitor[stat.monitorId] = { ok: 0, total: 0 };
			}
			const entry = statsByMonitor[stat.monitorId];
			if (!entry) continue;
			entry.total += stat._count.id;
			if (stat.status === "ok") {
				entry.ok += stat._count.id;
			}
		}

		const monitorSummaries = monitors.map((m) => {
			const stats = statsByMonitor[m.id] ?? { ok: 0, total: 0 };
			const uptimePct =
				stats.total > 0 ? Math.round((stats.ok / stats.total) * 100) : 100;
			return { id: m.id, name: m.name, uptimePct, checkinCount: stats.total };
		});

		const overallUptimePct =
			monitorSummaries.length > 0
				? Math.round(
						monitorSummaries.reduce((sum, m) => sum + m.uptimePct, 0) /
							monitorSummaries.length,
					)
				: 100;

		// Count incidents (alerts opened in the period)
		const incidentCount = await prisma.alert.count({
			where: {
				monitorId: { in: monitorIds },
				openedAt: { gte: periodStart, lte: periodEnd },
			},
		});

		const dashboardUrl = `${APP_URL}?utm_source=email&utm_campaign=weekly-digest`;

		try {
			const { html, text } = await renderEmail(DigestEmail, {
				teamName: team.name,
				periodStart,
				periodEnd,
				overallUptimePct,
				monitorSummaries,
				incidentCount,
				dashboardUrl,
			});

			await resend.emails.send({
				from: "hello@cronpilot.io",
				to: owner.email,
				subject: `Your weekly Cronpilot digest — ${overallUptimePct}% uptime`,
				html,
				text,
			});

			sent++;
			jobLog.info(
				{ teamId: team.id, to: owner.email, overallUptimePct, incidentCount },
				"digest email sent",
			);
		} catch (err) {
			skipped++;
			jobLog.error({ err, teamId: team.id }, "failed to send digest email");
		}
	}

	jobLog.info({ sent, skipped }, "digest run complete");
}
