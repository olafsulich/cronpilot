import cronParser from "cron-parser";
import cronstrue from "cronstrue";
import type { MonitorDbStatus, MonitorStatus } from "../types/monitor";

export function isValidCron(cronExpr: string): boolean {
	try {
		cronParser.parseExpression(cronExpr);
		return true;
	} catch {
		return false;
	}
}

export function getNextRunDate(cronExpr: string, timezone: string): Date {
	const interval = cronParser.parseExpression(cronExpr, {
		tz: timezone,
		currentDate: new Date(),
	});
	return interval.next().toDate();
}

export function getPreviousRunDate(cronExpr: string, timezone: string): Date {
	const interval = cronParser.parseExpression(cronExpr, {
		tz: timezone,
		currentDate: new Date(),
	});
	return interval.prev().toDate();
}

/**
 * Returns the deadline by which a check-in must arrive to be considered on-time.
 * That deadline is: previousRunDate + gracePeriodSeconds.
 */
export function getNextWindowClose(
	cronExpr: string,
	timezone: string,
	gracePeriodSeconds: number,
): Date {
	const prevRun = getPreviousRunDate(cronExpr, timezone);
	return new Date(prevRun.getTime() + gracePeriodSeconds * 1000);
}

export function humanizeCron(cronExpr: string): string {
	try {
		return cronstrue.toString(cronExpr, { throwExceptionOnParseError: true });
	} catch {
		return cronExpr;
	}
}

interface MonitorStatusInput {
	schedule: string;
	timezone: string;
	gracePeriod: number;
	lastCheckinAt: Date | null;
	status: MonitorDbStatus;
}

export function computeMonitorStatus(
	monitor: MonitorStatusInput,
): MonitorStatus {
	if (monitor.status === "paused") {
		return "paused";
	}

	if (monitor.lastCheckinAt === null) {
		return "new";
	}

	if (!isValidCron(monitor.schedule)) {
		// Can't compute status for invalid cron — treat as healthy to avoid false alerts
		return "healthy";
	}

	const now = new Date();

	let windowClose: Date;
	try {
		windowClose = getNextWindowClose(
			monitor.schedule,
			monitor.timezone,
			monitor.gracePeriod,
		);
	} catch {
		return "healthy";
	}

	if (now <= windowClose) {
		return "healthy";
	}

	// Late window: up to 2x the grace period after the window closes
	const lateDeadline = new Date(
		windowClose.getTime() + monitor.gracePeriod * 2 * 1000,
	);
	if (now <= lateDeadline) {
		return "late";
	}

	return "down";
}
