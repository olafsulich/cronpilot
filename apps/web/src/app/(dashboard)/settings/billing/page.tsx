"use client";

import type { Team } from "@cronpilot/shared";
import { PLANS } from "@cronpilot/shared";
import { CheckCircle, ExternalLink, Loader2, Zap } from "lucide-react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";

interface BillingData {
	team: Team;
	usage: {
		monitors: number;
		members: number;
	};
	stripePortalUrl: string | null;
}

function fetcher(path: string) {
	return apiClient.get<BillingData>(path);
}

const PLAN_LABELS: Record<string, string> = {
	free: "Free",
	pro: "Pro",
	team: "Team",
	enterprise: "Enterprise",
};

const PLAN_PRICES: Record<string, string> = {
	free: "$0/month",
	pro: "$19/month",
	team: "$79/month",
	enterprise: "Custom",
};

const UPGRADE_LINKS: Record<string, string | null> = {
	free: "/api/billing/checkout?plan=pro",
	pro: "/api/billing/checkout?plan=team",
	team: null,
	enterprise: null,
};

export default function BillingPage() {
	const { data, isLoading } = useSWR<BillingData>("/billing", fetcher);

	async function handleManageBilling() {
		try {
			const result = await apiClient.post<{ url: string }>(
				"/billing/portal",
				{},
			);
			window.open(result.url, "_blank");
		} catch {
			// silently fail — stripe might not be configured in dev
		}
	}

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-16">
				<Loader2 className="h-6 w-6 animate-spin text-gray-400" />
			</div>
		);
	}

	if (!data) return null;

	const { team, usage } = data;
	const planLimits = PLANS[team.plan];
	const monitorsLimit =
		planLimits.monitorsLimit === Infinity ? Infinity : planLimits.monitorsLimit;
	const membersLimit =
		planLimits.teamMembers === Infinity ? Infinity : planLimits.teamMembers;
	const monitorsPercent =
		monitorsLimit === Infinity
			? 0
			: Math.round((usage.monitors / monitorsLimit) * 100);
	const membersPercent =
		membersLimit === Infinity
			? 0
			: Math.round((usage.members / membersLimit) * 100);

	const upgradeLink = UPGRADE_LINKS[team.plan];

	return (
		<div className="max-w-2xl">
			<div className="mb-8">
				<h1 className="text-2xl font-bold text-gray-900">Billing</h1>
				<p className="text-gray-500 text-sm mt-1">
					Manage your plan and usage.
				</p>
			</div>

			{/* Current plan */}
			<div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
				<div className="flex items-start justify-between">
					<div>
						<p className="text-sm text-gray-500 mb-1">Current plan</p>
						<div className="flex items-center gap-2">
							<h2 className="text-xl font-bold text-gray-900">
								{PLAN_LABELS[team.plan] ?? team.plan}
							</h2>
							<span className="text-sm text-gray-400">
								{PLAN_PRICES[team.plan] ?? ""}
							</span>
						</div>
						{team.trialEndsAt && new Date(team.trialEndsAt) > new Date() && (
							<p className="text-xs text-orange-500 font-medium mt-1">
								Trial ends {new Date(team.trialEndsAt).toLocaleDateString()}
							</p>
						)}
					</div>
					<div className="flex items-center gap-2">
						{upgradeLink && (
							<a
								href={upgradeLink}
								className="inline-flex items-center gap-1.5 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
							>
								<Zap className="h-3.5 w-3.5" />
								Upgrade
							</a>
						)}
						{team.plan !== "free" && (
							<button
								type="button"
								onClick={handleManageBilling}
								className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								Manage billing
							</button>
						)}
					</div>
				</div>

				{/* Plan features */}
				<div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4 text-sm">
					<PlanFeature
						label="Monitors"
						value={
							monitorsLimit === Infinity ? "Unlimited" : String(monitorsLimit)
						}
					/>
					<PlanFeature
						label="History"
						value={`${planLimits.checkinRetention} days`}
					/>
					<PlanFeature
						label="Team members"
						value={
							membersLimit === Infinity ? "Unlimited" : String(membersLimit)
						}
					/>
				</div>
			</div>

			{/* Usage */}
			<div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
				<h3 className="font-semibold text-gray-900 mb-5 text-sm">
					Usage this period
				</h3>
				<div className="space-y-5">
					<UsageBar
						label="Monitors"
						used={usage.monitors}
						limit={monitorsLimit}
						percent={monitorsPercent}
					/>
					<UsageBar
						label="Team members"
						used={usage.members}
						limit={membersLimit}
						percent={membersPercent}
					/>
				</div>
			</div>

			{/* Available plans */}
			{team.plan === "free" && (
				<div className="bg-gradient-to-r from-orange-50 to-orange-100 border border-orange-100 rounded-xl p-6">
					<div className="flex items-start gap-4">
						<div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
							<Zap className="h-5 w-5 text-white" />
						</div>
						<div className="flex-1">
							<h3 className="font-semibold text-gray-900 mb-1">
								Upgrade to Pro
							</h3>
							<p className="text-sm text-gray-600 mb-4">
								Get 20 monitors, 90-day history, Slack and PagerDuty alerts, and
								up to 5 team members.
							</p>
							<ul className="space-y-1.5 mb-4">
								{[
									"20 monitors",
									"Slack + PagerDuty",
									"5 team members",
									"90-day history",
								].map((f) => (
									<li
										key={f}
										className="flex items-center gap-2 text-sm text-gray-700"
									>
										<CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
										{f}
									</li>
								))}
							</ul>
							<a
								href="/api/billing/checkout?plan=pro"
								className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
							>
								Upgrade to Pro — $19/month
							</a>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function PlanFeature({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<p className="text-xs text-gray-400 mb-0.5">{label}</p>
			<p className="font-medium text-gray-800">{value}</p>
		</div>
	);
}

function UsageBar({
	label,
	used,
	limit,
	percent,
}: {
	label: string;
	used: number;
	limit: number;
	percent: number;
}) {
	const isUnlimited = limit === Infinity;
	const isNearLimit = !isUnlimited && percent >= 80;

	return (
		<div>
			<div className="flex items-center justify-between mb-2">
				<span className="text-sm text-gray-700">{label}</span>
				<span className="text-sm text-gray-500">
					{used} / {isUnlimited ? "∞" : limit}
				</span>
			</div>
			{!isUnlimited && (
				<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
					<div
						className={`h-full rounded-full transition-all ${
							isNearLimit ? "bg-orange-400" : "bg-orange-400"
						}`}
						style={{ width: `${Math.min(percent, 100)}%` }}
					/>
				</div>
			)}
		</div>
	);
}
