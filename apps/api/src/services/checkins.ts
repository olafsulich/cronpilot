import type { Checkin } from "@cronpilot/db";
import { AppError, getNextWindowClose } from "@cronpilot/shared";
import { prisma } from "../lib/prisma";
import { alertResolveQueue, checkWindowQueue } from "../lib/queues";

export interface CheckinInput {
	duration?: number;
	status?: "ok" | "fail";
	exitCode?: number;
}

export interface CheckinResponse {
	id: string;
	monitorId: string;
	status: string;
	duration: number | null;
	exitCode: number | null;
	createdAt: string;
}

function mapCheckin(checkin: Checkin): CheckinResponse {
	return {
		id: checkin.id,
		monitorId: checkin.monitorId,
		status: checkin.status,
		duration: checkin.duration,
		exitCode: checkin.exitCode,
		createdAt: checkin.createdAt.toISOString(),
	};
}

export async function processCheckin(
	token: string,
	data: CheckinInput,
): Promise<CheckinResponse> {
	// 1. Resolve monitor by ping token
	const monitor = await prisma.monitor.findUnique({
		where: { pingToken: token },
	});
	if (!monitor) {
		throw new AppError("INVALID_TOKEN", "No monitor found for this token", 404);
	}

	const isPaused = monitor.status === "paused";
	const status = data.status ?? "ok";

	// 2. Create Checkin record
	const checkin = await prisma.checkin.create({
		data: {
			monitorId: monitor.id,
			status,
			duration: data.duration ?? null,
			exitCode: data.exitCode ?? null,
		},
	});

	// 3. Update lastCheckinAt (even when paused, we record the event)
	await prisma.monitor.update({
		where: { id: monitor.id },
		data: { lastCheckinAt: checkin.createdAt },
	});

	if (!isPaused) {
		// 4. Remove any pending check-window job so we don't fire a false alert
		await checkWindowQueue.remove(`check-window:${monitor.id}`);

		// 5. Schedule next check-window job
		const delayMs = getNextWindowClose(
			monitor.schedule,
			monitor.timezone,
			monitor.gracePeriod,
		);
		if (delayMs > 0) {
			await checkWindowQueue.add(
				"check-window",
				{ monitorId: monitor.id, teamId: monitor.teamId },
				{
					jobId: `check-window:${monitor.id}`,
					delay: delayMs,
					removeOnComplete: true,
					removeOnFail: false,
				},
			);
		}

		// 6. If there's an open Alert for this monitor, queue a resolve job
		const openAlert = await prisma.alert.findFirst({
			where: { monitorId: monitor.id, status: "open" },
			orderBy: { createdAt: "desc" },
		});
		if (openAlert) {
			await alertResolveQueue.add(
				"alert-resolve",
				{
					alertId: openAlert.id,
					monitorId: monitor.id,
					teamId: monitor.teamId,
				},
				{
					jobId: `alert-resolve:${openAlert.id}`,
					removeOnComplete: true,
					removeOnFail: false,
				},
			);
		}
	}

	return mapCheckin(checkin);
}

export interface ListCheckinsOptions {
	page: number;
	limit: number;
}

export interface PaginatedCheckins {
	data: CheckinResponse[];
	pagination: {
		page: number;
		limit: number;
		total: number;
		totalPages: number;
	};
}

export async function listCheckins(
	teamId: string,
	monitorId: string,
	opts: ListCheckinsOptions,
): Promise<PaginatedCheckins> {
	// Verify monitor belongs to team
	const monitor = await prisma.monitor.findFirst({
		where: { id: monitorId, teamId },
	});
	if (!monitor) {
		throw new AppError("NOT_FOUND", "Monitor not found", 404);
	}

	const { page, limit } = opts;
	const skip = (page - 1) * limit;

	const [checkins, total] = await Promise.all([
		prisma.checkin.findMany({
			where: { monitorId },
			skip,
			take: limit,
			orderBy: { createdAt: "desc" },
		}),
		prisma.checkin.count({ where: { monitorId } }),
	]);

	return {
		data: checkins.map(mapCheckin),
		pagination: {
			page,
			limit,
			total,
			totalPages: Math.ceil(total / limit),
		},
	};
}
