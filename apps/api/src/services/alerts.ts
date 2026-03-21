import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { AppError } from '@cronpilot/shared'
import type { AlertResponse, PaginatedResponse } from '@cronpilot/shared'
import type { Alert } from '@cronpilot/db'

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

function mapAlert(alert: Alert & { monitor?: { name: string } | null }): AlertResponse {
  return {
    id: alert.id,
    monitorId: alert.monitorId,
    monitorName: alert.monitor?.name ?? null,
    teamId: alert.teamId,
    type: alert.type,
    status: alert.status,
    createdAt: alert.createdAt.toISOString(),
    resolvedAt: alert.resolvedAt?.toISOString() ?? null,
  }
}

// ---------------------------------------------------------------------------
// Input schemas
// ---------------------------------------------------------------------------

export const ListAlertsQuerySchema = z.object({
  monitorId: z.string().optional(),
  status: z.enum(['open', 'resolved', 'muted']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListAlertsQuery = z.infer<typeof ListAlertsQuerySchema>

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

export async function listAlerts(
  teamId: string,
  filters: ListAlertsQuery,
): Promise<PaginatedResponse<AlertResponse>> {
  const { monitorId, status, page, limit } = filters
  const skip = (page - 1) * limit

  const where = {
    teamId,
    ...(monitorId && { monitorId }),
    ...(status && { status }),
  }

  const [alerts, total] = await Promise.all([
    prisma.alert.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { monitor: { select: { name: true } } },
    }),
    prisma.alert.count({ where }),
  ])

  return {
    data: alerts.map(mapAlert),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  }
}

export async function getAlert(
  teamId: string,
  alertId: string,
): Promise<AlertResponse> {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, teamId },
    include: { monitor: { select: { name: true } } },
  })
  if (!alert) {
    throw new AppError('NOT_FOUND', 'Alert not found', 404)
  }
  return mapAlert(alert)
}

export async function resolveAlert(
  teamId: string,
  alertId: string,
): Promise<AlertResponse> {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, teamId },
  })
  if (!alert) {
    throw new AppError('NOT_FOUND', 'Alert not found', 404)
  }
  if (alert.status === 'resolved') {
    throw new AppError('BAD_REQUEST', 'Alert is already resolved', 400)
  }

  const updated = await prisma.alert.update({
    where: { id: alertId },
    data: { status: 'resolved', resolvedAt: new Date() },
    include: { monitor: { select: { name: true } } },
  })

  return mapAlert(updated)
}

export async function muteAlert(
  teamId: string,
  alertId: string,
): Promise<AlertResponse> {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, teamId },
  })
  if (!alert) {
    throw new AppError('NOT_FOUND', 'Alert not found', 404)
  }
  if (alert.status === 'muted') {
    throw new AppError('BAD_REQUEST', 'Alert is already muted', 400)
  }

  const updated = await prisma.alert.update({
    where: { id: alertId },
    data: { status: 'muted' },
    include: { monitor: { select: { name: true } } },
  })

  return mapAlert(updated)
}
