export const QUEUES = {
	CHECK_WINDOW: "check-window",
	ALERT: "alert",
	ALERT_RESOLVE: "alert-resolve",
	DIGEST: "digest",
	CLEANUP: "cleanup",
	TRIAL_EXPIRY: "trial-expiry",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Job data shapes per queue

export interface CheckWindowJobData {
	monitorId: string;
	teamId: string;
	checkedAt: string; // ISO date string
}

export interface AlertJobData {
	monitorId: string;
	teamId: string;
	alertType: "missed" | "failed";
	checkinId?: string;
}

export interface AlertResolveJobData {
	monitorId: string;
	alertId: string;
}

export interface DigestJobData {
	teamId: string;
	periodStart: string; // ISO date string
	periodEnd: string; // ISO date string
}

export interface CleanupJobData {
	olderThanDays: number;
}

export interface TrialExpiryJobData {
	teamId: string;
}
