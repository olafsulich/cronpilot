import { prisma } from "@cronpilot/db";
import type { CleanupJobData } from "@cronpilot/shared";
import { PLANS } from "@cronpilot/shared";
import type { Job } from "bullmq";
import { logger } from "../lib/logger.js";

const RESOLVED_ALERT_RETENTION_DAYS = 90;

/**
 * Prunes stale check-in records per team according to each team's plan retention
 * policy. Also removes resolved alerts older than 90 days globally.
 */
export async function processCleanup(job: Job<CleanupJobData>): Promise<void> {
	const jobLog = logger.child({ jobId: job.id, processor: "cleanup" });

	const now = new Date();

	const teams = await prisma.team.findMany({
		select: { id: true, plan: true },
	});

	jobLog.info({ teamCount: teams.length }, "starting cleanup run");

	let totalCheckinsDeleted = 0;
	let totalAlertsDeleted = 0;

	for (const team of teams) {
		const planLimits = PLANS[team.plan];
		const retentionDays = planLimits.checkinRetention;
		const checkinCutoff = new Date(
			now.getTime() - retentionDays * 24 * 60 * 60 * 1000,
		);

		const monitors = await prisma.monitor.findMany({
			where: { teamId: team.id },
			select: { id: true },
		});

		const monitorIds = monitors.map((m) => m.id);

		if (monitorIds.length === 0) continue;

		try {
			const { count: checkinsDeleted } = await prisma.checkin.deleteMany({
				where: {
					monitorId: { in: monitorIds },
					receivedAt: { lt: checkinCutoff },
				},
			});

			totalCheckinsDeleted += checkinsDeleted;

			if (checkinsDeleted > 0) {
				jobLog.info(
					{ teamId: team.id, plan: team.plan, retentionDays, checkinsDeleted },
					"deleted old check-in records",
				);
			}
		} catch (err) {
			jobLog.error(
				{ err, teamId: team.id },
				"failed to delete check-in records for team",
			);
		}
	}

	// Clean up resolved alerts older than the global retention window
	const alertCutoff = new Date(
		now.getTime() - RESOLVED_ALERT_RETENTION_DAYS * 24 * 60 * 60 * 1000,
	);

	try {
		const { count: alertsDeleted } = await prisma.alert.deleteMany({
			where: {
				status: "resolved",
				resolvedAt: { lt: alertCutoff },
			},
		});

		totalAlertsDeleted = alertsDeleted;

		if (alertsDeleted > 0) {
			jobLog.info(
				{ alertsDeleted, retentionDays: RESOLVED_ALERT_RETENTION_DAYS },
				"deleted old resolved alerts",
			);
		}
	} catch (err) {
		jobLog.error({ err }, "failed to delete old resolved alerts");
	}

	jobLog.info(
		{ totalCheckinsDeleted, totalAlertsDeleted },
		"cleanup run complete",
	);
}
