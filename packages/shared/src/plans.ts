import type { PlanName } from "./types/team";

export const PLANS = {
	free: {
		monitorsLimit: 3,
		checkinRetention: 7,
		teamMembers: 1,
	},
	pro: {
		monitorsLimit: 20,
		checkinRetention: 90,
		teamMembers: 5,
	},
	team: {
		monitorsLimit: 100,
		checkinRetention: 365,
		teamMembers: 25,
	},
	enterprise: {
		monitorsLimit: Infinity,
		checkinRetention: 730,
		teamMembers: Infinity,
	},
} as const satisfies Record<
	PlanName,
	{ monitorsLimit: number; checkinRetention: number; teamMembers: number }
>;

export type PlanLimits = (typeof PLANS)[keyof typeof PLANS];

export function getPlanLimits(plan: PlanName): PlanLimits {
	return PLANS[plan];
}

export function isWithinMonitorLimit(
	plan: PlanName,
	currentCount: number,
): boolean {
	return currentCount < PLANS[plan].monitorsLimit;
}

export function isWithinTeamMemberLimit(
	plan: PlanName,
	currentCount: number,
): boolean {
	return currentCount < PLANS[plan].teamMembers;
}
