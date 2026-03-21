import { randomBytes } from 'crypto'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AppError, isValidCron, computeMonitorStatus, PLANS } from '@cronpilot/shared'
import type { MonitorResponse, PaginatedResponse } from '@cronpilot/shared'
import type { Monitor } from '@cronpilot/db'

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const CreateMonitorSchema = z.object({
  name: z.string().min(1).max(100),
  schedule: z.string().refine(isValidCron, 'Invalid cron expression'),
  timezone: z.string().default('UTC'),
  gracePeriod: z.number().int().min(60).max(86400).default(300),
})

export const UpdateMonitorSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  schedule: z
    .string()
    .refine(isValidCron, 'Invalid cron expression')
    .optional(),
  timezone: z.string().optional(),
  gracePeriod: z.number().int().min(60).max(86400).optional(),
})

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type CreateMonitorInput = z.infer<typeof CreateMonitorSchema>
export type UpdateMonitorInput = z.infer<typeof UpdateMonitorSchema>
export type PaginationInput = z.infer<typeof PaginationSchema>

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapMonitor(monitor: Monitor & { _count?: { checkins: number } }): MonitorResponse {
  return {
    id: monitor.id,
    teamId: monitor.teamId,
    name: monitor.name,
    schedule: monitor.schedule,
    timezone: monitor.timezone,
    gracePeriod: monitor.gracePeriod,
    pingToken: monitor.pingToken,
    status: monitor.status,
    computedStatus: computeMonitorStatus(monitor),
    lastCheckinAt: monitor.lastCheckinAt?.toISOString() ?? null,
    createdAt: monitor.createdAt.toISOString(),
    updatedAt: monitor.updatedAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function listMonitors(
  teamId: string,
  pagination: PaginationInput,
): Promise<PaginatedResponse<MonitorResponse>> {
  const { page, limit } = pagination
  const skip = (page - 1) * limit

  const [monitors, total] = await Promise.all([
    prisma.monitor.findMany({
      where: { teamId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.monitor.count({ where: { teamId } }),
  ])

  return {
    data: monitors.map(mapMonitor),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getMonitor(
  teamId: string,
  monitorId: string,
): Promise<MonitorResponse> {
  const monitor = await prisma.monitor.findFirst({
    where: { id: monitorId, teamId },
  })
  if (!monitor) {
    throw new AppError('NOT_FOUND', 'Monitor not found', 404)
  }
  return mapMonitor(monitor)
}

export async function createMonitor(
  teamId: string,
  data: CreateMonitorInput,
): Promise<MonitorResponse> {
  // Enforce plan limits
  const team = await prisma.team.findUniqueOrThrow({ where: { id: teamId } })
  const plan = PLANS[team.plan as keyof typeof PLANS]
  if (!plan) {
    throw new AppError('INTERNAL_ERROR', 'Unknown plan', 500)
  }

  const currentCount = await prisma.monitor.count({ where: { teamId } })
  if (currentCount >= plan.monitorsLimit) {
    throw new AppError(
      'PLAN_LIMIT_EXCEEDED',
      `Your plan allows a maximum of ${plan.monitorsLimit} monitors. Please upgrade to add more.`,
      402,
    )
  }

  const pingToken = randomBytes(16).toString('hex')

  const monitor = await prisma.monitor.create({
    data: {
      teamId,
      name: data.name,
      schedule: data.schedule,
      timezone: data.timezone,
      gracePeriod: data.gracePeriod,
      pingToken,
      status: 'active',
    },
  })

  return mapMonitor(monitor)
}

export async function updateMonitor(
  teamId: string,
  monitorId: string,
  data: UpdateMonitorInput,
): Promise<MonitorResponse> {
  const existing = await prisma.monitor.findFirst({
    where: { id: monitorId, teamId },
  })
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Monitor not found', 404)
  }

  const monitor = await prisma.monitor.update({
    where: { id: monitorId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.schedule !== undefined && { schedule: data.schedule }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
      ...(data.gracePeriod !== undefined && { gracePeriod: data.gracePeriod }),
    },
  })

  return mapMonitor(monitor)
}

export async function deleteMonitor(
  teamId: string,
  monitorId: string,
): Promise<void> {
  const existing = await prisma.monitor.findFirst({
    where: { id: monitorId, teamId },
  })
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Monitor not found', 404)
  }

  await prisma.monitor.delete({ where: { id: monitorId } })
}

export async function pauseMonitor(
  teamId: string,
  monitorId: string,
): Promise<MonitorResponse> {
  const existing = await prisma.monitor.findFirst({
    where: { id: monitorId, teamId },
  })
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Monitor not found', 404)
  }
  if (existing.status === 'paused') {
    throw new AppError('BAD_REQUEST', 'Monitor is already paused', 400)
  }

  const monitor = await prisma.monitor.update({
    where: { id: monitorId },
    data: { status: 'paused' },
  })

  return mapMonitor(monitor)
}

export async function resumeMonitor(
  teamId: string,
  monitorId: string,
): Promise<MonitorResponse> {
  const existing = await prisma.monitor.findFirst({
    where: { id: monitorId, teamId },
  })
  if (!existing) {
    throw new AppError('NOT_FOUND', 'Monitor not found', 404)
  }
  if (existing.status === 'active') {
    throw new AppError('BAD_REQUEST', 'Monitor is already active', 400)
  }

  const monitor = await prisma.monitor.update({
    where: { id: monitorId },
    data: { status: 'active' },
  })

  return mapMonitor(monitor)
}
