import type { PlanName } from "./team";

export type { PlanName };

export type MonitorDbStatus = "active" | "paused";
export type MonitorStatus = "healthy" | "late" | "down" | "paused" | "new";
export type CheckinStatus = "ok" | "fail";
export type AlertType = "missed" | "failed";
export type AlertStatus = "open" | "resolved";

export interface Monitor {
	id: string;
	teamId: string;
	name: string;
	schedule: string;
	timezone: string;
	gracePeriod: number;
	pingToken: string;
	status: MonitorDbStatus;
	lastCheckinAt: Date | null;
	createdAt: Date;
}

export interface Checkin {
	id: string;
	monitorId: string;
	receivedAt: Date;
	duration: number | null;
	status: CheckinStatus;
	exitCode: number | null;
}

export interface Alert {
	id: string;
	monitorId: string;
	type: AlertType;
	status: AlertStatus;
	failureCount: number;
	openedAt: Date;
	resolvedAt: Date | null;
}

export interface MonitorResponse extends Monitor {
	computedStatus: MonitorStatus;
	alertCount: number;
}
