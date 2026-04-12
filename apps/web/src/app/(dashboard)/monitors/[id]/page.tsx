import type { Alert, Checkin, MonitorResponse } from "@cronpilot/shared";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { serverFetch } from "@/lib/api";
import { formatDate, formatDuration, relativeTime } from "@/lib/utils";
import { StatusBadge } from "../status-badge";
import { MonitorActions } from "./monitor-actions";
import { PingUrlDisplay } from "./ping-url-display";

interface PageProps {
	params: { id: string };
}

export async function generateMetadata({
	params,
}: PageProps): Promise<Metadata> {
	try {
		const monitor = await serverFetch<MonitorResponse>(
			`/monitors/${params.id}`,
		);
		return { title: monitor.name };
	} catch {
		return { title: "Monitor" };
	}
}

export default async function MonitorDetailPage({ params }: PageProps) {
	let monitor: MonitorResponse;
	let checkins: Checkin[] = [];
	let openAlerts: Alert[] = [];

	try {
		monitor = await serverFetch<MonitorResponse>(`/monitors/${params.id}`);
	} catch {
		notFound();
	}

	try {
		checkins = await serverFetch<Checkin[]>(
			`/monitors/${params.id}/checkins?limit=50`,
		);
		openAlerts = await serverFetch<Alert[]>(
			`/monitors/${params.id}/alerts?status=open`,
		);
	} catch {
		// Non-fatal — show what we have
	}

	const pingUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "https://cronpilot.dev"}/ping/${monitor.pingToken}`;

	return (
		<div className="max-w-4xl">
			{/* Header */}
			<div className="flex items-start justify-between mb-8 gap-4">
				<div>
					<div className="flex items-center gap-3 mb-2">
						<h1 className="text-2xl font-bold text-gray-900">{monitor.name}</h1>
						<StatusBadge status={monitor.computedStatus} />
					</div>
					<div className="flex items-center gap-4 text-sm text-gray-500">
						<span className="font-mono bg-gray-100 px-2 py-0.5 rounded">
							{monitor.schedule}
						</span>
						<span>{monitor.timezone}</span>
						<span>
							Grace period: {formatDuration(monitor.gracePeriod * 1000)}
						</span>
					</div>
				</div>
				<MonitorActions monitor={monitor} />
			</div>

			{/* Ping URL */}
			<div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
				<h2 className="text-sm font-semibold text-gray-900 mb-3">Ping URL</h2>
				<p className="text-xs text-gray-500 mb-3">
					Add this URL to the end of your cron command. A GET or POST request
					signals a successful run.
				</p>
				<PingUrlDisplay url={pingUrl} />
			</div>

			{/* Open alerts */}
			{openAlerts.length > 0 && (
				<div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6">
					<h2 className="text-sm font-semibold text-red-800 mb-3">
						{openAlerts.length} Open Alert{openAlerts.length > 1 ? "s" : ""}
					</h2>
					<div className="space-y-2">
						{openAlerts.map((alert) => (
							<div
								key={alert.id}
								className="flex items-center justify-between text-sm"
							>
								<div className="flex items-center gap-3">
									<span className="capitalize text-red-700 font-medium">
										{alert.type}
									</span>
									<span className="text-red-600">
										{alert.failureCount} failure
										{alert.failureCount > 1 ? "s" : ""}
									</span>
								</div>
								<span className="text-red-500 text-xs">
									Opened {relativeTime(new Date(alert.openedAt))}
								</span>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Check-in stats */}
			<div className="grid grid-cols-3 gap-4 mb-6">
				<StatCard
					label="Last check-in"
					value={
						monitor.lastCheckinAt
							? relativeTime(new Date(monitor.lastCheckinAt))
							: "—"
					}
				/>
				<StatCard
					label="Total check-ins"
					value={checkins.length === 50 ? "50+" : String(checkins.length)}
				/>
				<StatCard
					label="Open alerts"
					value={String(monitor.alertCount)}
					valueClassName={monitor.alertCount > 0 ? "text-red-600" : undefined}
				/>
			</div>

			{/* Check-in history */}
			<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
				<div className="px-5 py-4 border-b border-gray-100">
					<h2 className="font-semibold text-gray-900 text-sm">
						Check-in history
					</h2>
				</div>
				{checkins.length === 0 ? (
					<div className="py-12 text-center text-gray-400 text-sm">
						No check-ins recorded yet.
					</div>
				) : (
					<table className="w-full">
						<thead>
							<tr className="text-xs text-gray-400 border-b border-gray-100">
								<th className="text-left px-5 py-3 font-medium">Received at</th>
								<th className="text-left px-5 py-3 font-medium">Duration</th>
								<th className="text-left px-5 py-3 font-medium">Status</th>
								<th className="text-left px-5 py-3 font-medium">Exit code</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-50">
							{checkins.map((checkin) => (
								<tr
									key={checkin.id}
									className="hover:bg-gray-50 transition-colors"
								>
									<td className="px-5 py-3 text-sm text-gray-700">
										{formatDate(new Date(checkin.receivedAt))}
									</td>
									<td className="px-5 py-3 text-sm text-gray-700 font-mono">
										{checkin.duration !== null
											? formatDuration(checkin.duration)
											: "—"}
									</td>
									<td className="px-5 py-3">
										<span
											className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
												checkin.status === "ok"
													? "bg-green-50 text-green-700"
													: "bg-red-50 text-red-700"
											}`}
										>
											{checkin.status === "ok" ? "OK" : "Failed"}
										</span>
									</td>
									<td className="px-5 py-3 text-sm text-gray-500 font-mono">
										{checkin.exitCode !== null ? checkin.exitCode : "—"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	valueClassName,
}: {
	label: string;
	value: string;
	valueClassName?: string;
}) {
	return (
		<div className="bg-white rounded-xl border border-gray-200 p-4">
			<p className="text-xs text-gray-500 mb-1">{label}</p>
			<p
				className={`text-lg font-semibold text-gray-900 ${valueClassName ?? ""}`}
			>
				{value}
			</p>
		</div>
	);
}
