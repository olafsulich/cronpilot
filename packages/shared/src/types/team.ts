export type PlanName = "free" | "pro" | "team" | "enterprise";

export type TeamRole = "owner" | "admin" | "member";

export interface Team {
	id: string;
	name: string;
	slug: string;
	plan: PlanName;
	trialEndsAt: Date | null;
	createdAt: Date;
}

export interface User {
	id: string;
	email: string;
	createdAt: Date;
}

export interface TeamMember {
	userId: string;
	teamId: string;
	role: TeamRole;
	user: User;
}
