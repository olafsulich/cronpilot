import type { MonitorResponse } from "@cronpilot/shared";
import { Activity, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { serverFetch } from "@/lib/api";
import { relativeTime } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export const metadata: Metadata = { title: "Monitors" };

export default async function MonitorsPage() {
	let monitors: MonitorResponse[] = [];

	try {
		monitors = await serverFetch<MonitorResponse[]>("/monitors");
	} catch {
		// If fetch fails during build or on error, show empty state
	}

	return (
		<div>
			{/* Header */}
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Monitors</h1>
					<p className="text-gray-500 text-sm mt-1">
						{monitors.length === 0
							? "No monitors yet"
							: `${monitors.length} monitor${monitors.length === 1 ? "" : "s"}`}
					</p>
				</div>
				<Link
					href="/dashboard/monitors/new"
					className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
				>
					<Plus className="h-4 w-4" />
					New monitor
				</Link>
			</div>

			{monitors.length === 0 ? (
				<EmptyState />
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{monitors.map((monitor) => (
						<MonitorCard key={monitor.id} monitor={monitor} />
					))}
				</div>
			)}
		</div>
	);
}

function MonitorCard({ monitor }: { monitor: MonitorResponse }) {
	return (
		<Link
			href={`/dashboard/monitors/${monitor.id}`}
			className="group bg-white border border-gray-200 rounded-xl p-5 hover:border-orange-200 hover:shadow-sm transition-all"
		>
			<div className="flex items-start justify-between mb-3">
				<div className="flex-1 min-w-0">
					<h2 className="font-semibold text-gray-900 truncate group-hover:text-orange-600 transition-colors">
						{monitor.name}
					</h2>
					<p className="text-xs text-gray-400 font-mono mt-0.5 truncate">
						{monitor.schedule}
					</p>
				</div>
				<StatusBadge status={monitor.computedStatus} />
			</div>

			<div className="flex items-center justify-between text-xs text-gray-500 mt-4 pt-4 border-t border-gray-100">
				<span>
					{monitor.lastCheckinAt
						? relativeTime(new Date(monitor.lastCheckinAt))
						: "No check-ins yet"}
				</span>
				{monitor.alertCount > 0 && (
					<span className="text-red-600 font-medium">
						{monitor.alertCount} open alert{monitor.alertCount > 1 ? "s" : ""}
					</span>
				)}
			</div>
		</Link>
	);
}

function EmptyState() {
	return (
		<div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
			<div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center mx-auto mb-4">
				<Activity className="h-6 w-6 text-orange-400" />
			</div>
			<h3 className="text-gray-900 font-semibold mb-2">No monitors yet</h3>
			<p className="text-gray-500 text-sm mb-6 max-w-sm mx-auto">
				Create your first monitor and start tracking your cron jobs in minutes.
			</p>
			<Link
				href="/dashboard/monitors/new"
				className="inline-flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
			>
				<Plus className="h-4 w-4" />
				Create monitor
			</Link>
		</div>
	);
}
