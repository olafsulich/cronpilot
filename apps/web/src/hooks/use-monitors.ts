"use client";

import type { Checkin, MonitorResponse } from "@cronpilot/shared";
import useSWR, { type KeyedMutator } from "swr";
import { apiClient } from "@/lib/api";

function fetcher<T>(path: string): Promise<T> {
	return apiClient.get<T>(path);
}

export function useMonitors(): {
	monitors: MonitorResponse[];
	isLoading: boolean;
	mutate: KeyedMutator<MonitorResponse[]>;
} {
	const { data, isLoading, mutate } = useSWR<MonitorResponse[]>(
		"/monitors",
		fetcher,
		{
			refreshInterval: 30_000,
		},
	);

	return {
		monitors: data ?? [],
		isLoading,
		mutate,
	};
}

export function useMonitor(id: string): {
	monitor: MonitorResponse | undefined;
	isLoading: boolean;
	mutate: KeyedMutator<MonitorResponse>;
} {
	const { data, isLoading, mutate } = useSWR<MonitorResponse>(
		id ? `/monitors/${id}` : null,
		fetcher,
		{ refreshInterval: 15_000 },
	);

	return {
		monitor: data,
		isLoading,
		mutate,
	};
}

export function useMonitorCheckins(monitorId: string): {
	checkins: Checkin[];
	isLoading: boolean;
} {
	const { data, isLoading } = useSWR<Checkin[]>(
		monitorId ? `/monitors/${monitorId}/checkins` : null,
		fetcher,
		{ refreshInterval: 30_000 },
	);

	return {
		checkins: data ?? [],
		isLoading,
	};
}
