"use client";

import type { Alert } from "@cronpilot/shared";
import { AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { apiClient } from "@/lib/api";
import { formatDate, relativeTime } from "@/lib/utils";

interface AlertWithMonitor extends Alert {
	monitorName: string;
}

type FilterStatus = "open" | "resolved" | "all";

function fetcher(path: string) {
	return apiClient.get<AlertWithMonitor[]>(path);
}

export default function AlertsPage() {
	const [filter, setFilter] = useState<FilterStatus>("open");
	const [resolving, setResolving] = useState<string | null>(null);

	const apiPath = filter === "all" ? "/alerts" : `/alerts?status=${filter}`;

	const {
		data: alerts = [],
		isLoading,
		mutate,
	} = useSWR<AlertWithMonitor[]>(apiPath, fetcher, { refreshInterval: 30_000 });

	async function handleResolve(alertId: string) {
		setResolving(alertId);
		try {
			await apiClient.patch(`/alerts/${alertId}`, { status: "resolved" });
			await mutate();
		} finally {
			setResolving(null);
		}
	}

	return (
		<div>
			<div className="flex items-center justify-between mb-8">
				<div>
					<h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
					<p className="text-gray-500 text-sm mt-1">
						{alerts.length} {filter === "all" ? "" : filter} alert
						{alerts.length !== 1 ? "s" : ""}
					</p>
				</div>

				{/* Filter tabs */}
				<div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
					{(["open", "resolved", "all"] as const).map((f) => (
						<button
							key={f}
							type="button"
							onClick={() => setFilter(f)}
							className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
								filter === f
									? "bg-white text-gray-900 shadow-sm"
									: "text-gray-500 hover:text-gray-700"
							}`}
						>
							{f}
						</button>
					))}
				</div>
			</div>

			{isLoading ? (
				<div className="flex items-center justify-center py-16">
					<Loader2 className="h-6 w-6 animate-spin text-gray-400" />
				</div>
			) : alerts.length === 0 ? (
				<div className="text-center py-16 bg-white rounded-xl border border-gray-200 border-dashed">
					<CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-4" />
					<h3 className="font-semibold text-gray-900 mb-1">
						{filter === "open" ? "No open alerts" : "No alerts found"}
					</h3>
					<p className="text-gray-500 text-sm">
						{filter === "open"
							? "All your monitors are running on schedule."
							: "Try changing the filter."}
					</p>
				</div>
			) : (
				<div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
					<table className="w-full">
						<thead>
							<tr className="text-xs text-gray-400 border-b border-gray-100">
								<th className="text-left px-5 py-3 font-medium">Monitor</th>
								<th className="text-left px-5 py-3 font-medium">Type</th>
								<th className="text-left px-5 py-3 font-medium">Failures</th>
								<th className="text-left px-5 py-3 font-medium">Opened</th>
								<th className="text-left px-5 py-3 font-medium">Status</th>
								<th className="text-right px-5 py-3 font-medium">Actions</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-50">
							{alerts.map((alert) => (
								<tr
									key={alert.id}
									className="hover:bg-gray-50 transition-colors"
								>
									<td className="px-5 py-3 text-sm font-medium text-gray-900">
										{alert.monitorName}
									</td>
									<td className="px-5 py-3">
										<span className="inline-flex items-center gap-1 text-xs text-gray-600 capitalize">
											<AlertTriangle className="h-3 w-3 text-orange-400" />
											{alert.type}
										</span>
									</td>
									<td className="px-5 py-3 text-sm text-gray-700">
										{alert.failureCount}
									</td>
									<td className="px-5 py-3 text-sm text-gray-500">
										<span title={formatDate(new Date(alert.openedAt))}>
											{relativeTime(new Date(alert.openedAt))}
										</span>
									</td>
									<td className="px-5 py-3">
										<span
											className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
												alert.status === "open"
													? "bg-red-50 text-red-700"
													: "bg-green-50 text-green-700"
											}`}
										>
											{alert.status === "open" ? "Open" : "Resolved"}
										</span>
									</td>
									<td className="px-5 py-3 text-right">
										{alert.status === "open" && (
											<button
												type="button"
												onClick={() => handleResolve(alert.id)}
												disabled={resolving === alert.id}
												className="inline-flex items-center gap-1.5 text-xs font-medium text-green-600 hover:text-green-700 disabled:opacity-50 transition-colors"
											>
												{resolving === alert.id ? (
													<Loader2 className="h-3 w-3 animate-spin" />
												) : (
													<CheckCircle className="h-3 w-3" />
												)}
												Resolve
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
