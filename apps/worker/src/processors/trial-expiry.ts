import { prisma } from "@cronpilot/db";
import { renderEmail, TrialEndingEmail } from "@cronpilot/emails";
import type { TrialExpiryJobData } from "@cronpilot/shared";
import { QUEUES } from "@cronpilot/shared";
import type { Job } from "bullmq";
import { Resend } from "resend";
import { logger } from "../lib/logger.js";
import { trialExpiryQueue } from "../lib/queues.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const APP_URL = process.env.APP_URL ?? "http://localhost:3000";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Handles trial expiry warning notifications.
 *
 * When `daysLeft` is absent the job acts as the scheduler: it enqueues two
 * delayed warning jobs at T-3d and T-1d relative to `trialEndsAt`.
 *
 * When `daysLeft` is present the job is a warning and sends the appropriate
 * email to the team owner.
 */
export async function processTrialExpiry(
	job: Job<TrialExpiryJobData & { trialEndsAt?: string; daysLeft?: 3 | 1 }>,
): Promise<void> {
	const { teamId } = job.data;
	const jobLog = logger.child({
		jobId: job.id,
		teamId,
		processor: "trial-expiry",
	});

	if ("daysLeft" in job.data && job.data.daysLeft !== undefined) {
		// This is a warning notification job
		await sendTrialWarning(teamId, job.data.daysLeft, jobLog);
		return;
	}

	// This is the scheduler job — enqueue the two warning jobs
	const trialEndsAtRaw = job.data.trialEndsAt;

	if (!trialEndsAtRaw) {
		// Fetch trialEndsAt from the database if not provided in the payload
		const team = await prisma.team.findUnique({
			where: { id: teamId },
			select: { trialEndsAt: true },
		});

		if (!team?.trialEndsAt) {
			jobLog.warn("team not found or has no trial — skipping");
			return;
		}

		await scheduleWarnings(teamId, team.trialEndsAt, jobLog);
	} else {
		await scheduleWarnings(teamId, new Date(trialEndsAtRaw), jobLog);
	}
}

async function scheduleWarnings(
	teamId: string,
	trialEndsAt: Date,
	jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
	const now = Date.now();
	const trialEndMs = trialEndsAt.getTime();

	const warnings: Array<{ daysLeft: 3 | 1; delayMs: number }> = [
		{ daysLeft: 3, delayMs: trialEndMs - 3 * MS_PER_DAY - now },
		{ daysLeft: 1, delayMs: trialEndMs - 1 * MS_PER_DAY - now },
	];

	for (const { daysLeft, delayMs } of warnings) {
		if (delayMs <= 0) {
			jobLog.info(
				{ daysLeft, delayMs },
				"warning window already passed — skipping",
			);
			continue;
		}

		await trialExpiryQueue.add(
			QUEUES.TRIAL_EXPIRY,
			{
				teamId,
				trialEndsAt: trialEndsAt.toISOString(),
				daysLeft,
			} as TrialExpiryJobData & {
				trialEndsAt: string;
				daysLeft: 3 | 1;
			},
			{
				jobId: `trial-expiry:${teamId}:warning-${daysLeft}d`,
				delay: delayMs,
				removeOnComplete: { count: 10 },
				removeOnFail: { count: 10 },
			},
		);

		jobLog.info(
			{ daysLeft, delayMs, trialEndsAt },
			"scheduled trial warning job",
		);
	}
}

async function sendTrialWarning(
	teamId: string,
	daysLeft: 3 | 1,
	jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
	const team = await prisma.team.findUnique({
		where: { id: teamId },
		include: {
			members: {
				where: { role: "owner" },
				include: { user: true },
			},
		},
	});

	if (!team) {
		jobLog.warn("team not found — skipping trial warning");
		return;
	}

	const ownerMember = team.members[0];
	if (!ownerMember) {
		jobLog.warn("no owner found for team — skipping trial warning");
		return;
	}

	const owner = ownerMember.user;

	const upgradeUrl = `${APP_URL}/settings/billing?utm_source=email&utm_campaign=trial-ending-${daysLeft}d`;

	const { html, text } = await renderEmail(TrialEndingEmail, {
		teamName: team.name,
		daysLeft,
		trialEndsAt: team.trialEndsAt ?? new Date(),
		upgradeUrl,
	});

	const urgency = daysLeft === 1 ? "ends tomorrow" : `ends in ${daysLeft} days`;

	await resend.emails.send({
		from: "hello@cronpilot.io",
		to: owner.email,
		subject: `Your Cronpilot trial ${urgency}`,
		html,
		text,
	});

	jobLog.info({ to: owner.email, daysLeft }, "trial ending email sent");
}
