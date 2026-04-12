"use client";

import type { MonitorResponse } from "@cronpilot/shared";
import { Loader2, Pause, Pencil, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiClient } from "@/lib/api";

export function MonitorActions({ monitor }: { monitor: MonitorResponse }) {
	const router = useRouter();
	const [loading, setLoading] = useState<string | null>(null);
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

	const isPaused = monitor.status === "paused";

	async function handleTogglePause() {
		setLoading("pause");
		try {
			await apiClient.patch(`/monitors/${monitor.id}`, {
				status: isPaused ? "active" : "paused",
			});
			router.refresh();
		} finally {
			setLoading(null);
		}
	}

	async function handleDelete() {
		setLoading("delete");
		try {
			await apiClient.delete(`/monitors/${monitor.id}`);
			router.push("/dashboard/monitors");
		} finally {
			setLoading(null);
			setShowDeleteConfirm(false);
		}
	}

	return (
		<div className="flex items-center gap-2 flex-shrink-0">
			<Link
				href={`/dashboard/monitors/${monitor.id}/edit`}
				className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
			>
				<Pencil className="h-3.5 w-3.5" />
				Edit
			</Link>

			<button
				type="button"
				onClick={handleTogglePause}
				disabled={loading !== null}
				className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
			>
				{loading === "pause" ? (
					<Loader2 className="h-3.5 w-3.5 animate-spin" />
				) : isPaused ? (
					<Play className="h-3.5 w-3.5" />
				) : (
					<Pause className="h-3.5 w-3.5" />
				)}
				{isPaused ? "Resume" : "Pause"}
			</button>

			{!showDeleteConfirm ? (
				<button
					type="button"
					onClick={() => setShowDeleteConfirm(true)}
					className="flex items-center gap-1.5 px-3 py-2 border border-red-200 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
				>
					<Trash2 className="h-3.5 w-3.5" />
					Delete
				</button>
			) : (
				<div className="flex items-center gap-1">
					<span className="text-xs text-gray-500 mr-1">Sure?</span>
					<button
						type="button"
						onClick={handleDelete}
						disabled={loading === "delete"}
						className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
					>
						{loading === "delete" && (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						)}
						Delete
					</button>
					<button
						type="button"
						onClick={() => setShowDeleteConfirm(false)}
						className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
					>
						Cancel
					</button>
				</div>
			)}
		</div>
	);
}
