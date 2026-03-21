import type { Job } from 'bullmq'
import { prisma } from '@cronpilot/db'
import type { CheckWindowJobData, AlertJobData } from '@cronpilot/shared'
import { QUEUES, getNextWindowClose } from '@cronpilot/shared'
import { alertQueue, checkWindowQueue } from '../lib/queues.js'
import { logger } from '../lib/logger.js'

/**
 * Processes a check-window job. Fires when the expected check-in window for a
 * monitor has closed without a successful ping arriving. Guards against races by
 * re-checking the database before creating an alert.
 */
export async function processCheckWindow(job: Job<CheckWindowJobData>): Promise<void> {
  const { monitorId, teamId, checkedAt } = job.data
  const jobLog = logger.child({ jobId: job.id, monitorId, teamId, processor: 'check-window' })

  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
  })

  if (!monitor) {
    jobLog.warn('monitor not found — skipping')
    return
  }

  if (monitor.teamId !== teamId) {
    jobLog.warn('teamId mismatch — skipping (possible data integrity issue)')
    return
  }

  if (monitor.status === 'paused') {
    jobLog.info('monitor is paused — skipping')
    return
  }

  // Guard against races: if a newer check-in arrived after the window job was
  // scheduled, we do not need to fire an alert.
  const windowScheduledAt = new Date(checkedAt)
  if (monitor.lastCheckinAt !== null && monitor.lastCheckinAt > windowScheduledAt) {
    jobLog.info(
      { lastCheckinAt: monitor.lastCheckinAt, windowScheduledAt },
      'newer check-in arrived — skipping alert',
    )
    return
  }

  jobLog.info('check-in window closed with no ping — processing alert')

  // Check for an existing open alert on this monitor so we can increment the
  // failure count rather than creating a second open alert.
  const existingAlert = await prisma.alert.findFirst({
    where: { monitorId, status: 'open' },
  })

  let alertId: string

  if (existingAlert) {
    const updated = await prisma.alert.update({
      where: { id: existingAlert.id },
      data: { failureCount: { increment: 1 } },
    })
    alertId = updated.id
    jobLog.info({ alertId, failureCount: updated.failureCount }, 'incremented failure count on existing alert')
  } else {
    const newAlert = await prisma.alert.create({
      data: {
        monitorId,
        type: 'missed',
        status: 'open',
        failureCount: 1,
        openedAt: new Date(),
      },
    })
    alertId = newAlert.id
    jobLog.info({ alertId }, 'created new missed alert')
  }

  // Enqueue the alert dispatcher
  const alertJobData: AlertJobData = {
    monitorId,
    teamId,
    alertType: 'missed',
  }
  await alertQueue.add(QUEUES.ALERT, alertJobData, {
    jobId: `alert:${alertId}`,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  })

  // Schedule the next check-window job for this monitor.
  await scheduleNextCheckWindow(monitorId, teamId, monitor.schedule, monitor.timezone, monitor.gracePeriod, jobLog)
}

async function scheduleNextCheckWindow(
  monitorId: string,
  teamId: string,
  schedule: string,
  timezone: string,
  gracePeriod: number,
  jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
  let nextWindowClose: Date
  try {
    nextWindowClose = getNextWindowClose(schedule, timezone, gracePeriod)
  } catch (err) {
    jobLog.error({ err }, 'failed to compute next window close — not rescheduling')
    return
  }

  const delay = Math.max(0, nextWindowClose.getTime() - Date.now())

  const jobData: CheckWindowJobData = {
    monitorId,
    teamId,
    checkedAt: new Date().toISOString(),
  }

  await checkWindowQueue.add(QUEUES.CHECK_WINDOW, jobData, {
    jobId: `check-window:${monitorId}`,
    delay,
    removeOnComplete: { count: 10 },
    removeOnFail: { count: 25 },
  })

  jobLog.info({ nextWindowClose, delayMs: delay }, 'scheduled next check-window job')
}
