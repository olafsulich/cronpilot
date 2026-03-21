import { Worker } from 'bullmq'
import { Redis } from 'ioredis'
import { QUEUES } from '@cronpilot/shared'
import type {
  CheckWindowJobData,
  AlertJobData,
  AlertResolveJobData,
  DigestJobData,
  CleanupJobData,
  TrialExpiryJobData,
} from '@cronpilot/shared'
import { redis } from './lib/redis.js'
import { logger } from './lib/logger.js'
import { digestQueue, cleanupQueue, closeQueues } from './lib/queues.js'
import { processCheckWindow } from './processors/check-window.js'
import { processAlert } from './processors/alert.js'
import { processAlertResolve } from './processors/alert-resolve.js'
import { processDigest } from './processors/digest.js'
import { processCleanup } from './processors/cleanup.js'
import { processTrialExpiry } from './processors/trial-expiry.js'

const WORKER_CONCURRENCY = Number(process.env['WORKER_CONCURRENCY'] ?? '5')
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

/**
 * BullMQ workers must each have their own blocking Redis connection; they
 * cannot share the non-blocking connection used by Queue instances.
 */
function makeWorkerConnection(): Redis {
  return new Redis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  })
}

async function main(): Promise<void> {
  logger.info({ concurrency: WORKER_CONCURRENCY }, 'starting Cronpilot worker')

  // Each worker gets its own dedicated connection
  const connection = makeWorkerConnection()

  // --- Workers ---

  const checkWindowWorker = new Worker<CheckWindowJobData>(
    QUEUES.CHECK_WINDOW,
    async (job) => processCheckWindow(job),
    { connection, concurrency: WORKER_CONCURRENCY },
  )

  const alertWorker = new Worker<AlertJobData>(
    QUEUES.ALERT,
    async (job) => processAlert(job),
    { connection, concurrency: WORKER_CONCURRENCY },
  )

  const alertResolveWorker = new Worker<AlertResolveJobData>(
    QUEUES.ALERT_RESOLVE,
    async (job) => processAlertResolve(job),
    { connection, concurrency: WORKER_CONCURRENCY },
  )

  const digestWorker = new Worker<DigestJobData>(
    QUEUES.DIGEST,
    async (job) => processDigest(job),
    { connection, concurrency: 1 },
  )

  const cleanupWorker = new Worker<CleanupJobData>(
    QUEUES.CLEANUP,
    async (job) => processCleanup(job),
    { connection, concurrency: 1 },
  )

  const trialExpiryWorker = new Worker<TrialExpiryJobData>(
    QUEUES.TRIAL_EXPIRY,
    async (job) => processTrialExpiry(job),
    { connection, concurrency: WORKER_CONCURRENCY },
  )

  const allWorkers = [
    checkWindowWorker,
    alertWorker,
    alertResolveWorker,
    digestWorker,
    cleanupWorker,
    trialExpiryWorker,
  ]

  // Attach error handlers so uncaught job errors surface in logs
  for (const worker of allWorkers) {
    worker.on('failed', (job, err) => {
      logger.error(
        { jobId: job?.id, queue: worker.name, err },
        'job failed',
      )
    })

    worker.on('error', (err) => {
      logger.error({ queue: worker.name, err }, 'worker error')
    })

    worker.on('completed', (job) => {
      logger.debug({ jobId: job.id, queue: worker.name }, 'job completed')
    })
  }

  // --- Recurring jobs ---

  // Weekly digest: Sundays at 08:00 UTC
  await digestQueue.add(
    'weekly-digest',
    { teamId: '', periodStart: '', periodEnd: '' },
    {
      repeat: { pattern: '0 8 * * 0' },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 10 },
    },
  )

  // Daily cleanup: every day at 03:00 UTC
  await cleanupQueue.add(
    'daily-cleanup',
    { olderThanDays: 0 },
    {
      repeat: { pattern: '0 3 * * *' },
      removeOnComplete: { count: 10 },
      removeOnFail: { count: 10 },
    },
  )

  logger.info('recurring jobs registered (digest: 0 8 * * 0, cleanup: 0 3 * * *)')
  logger.info('Cronpilot worker is ready')

  // --- Graceful shutdown ---

  async function shutdown(signal: string): Promise<void> {
    logger.info({ signal }, 'shutdown signal received — draining workers')

    await Promise.all(allWorkers.map((w) => w.close()))
    await closeQueues()
    // Close both the worker blocking connection and the queue connection
    await Promise.all([connection.quit(), redis.quit()])

    logger.info('graceful shutdown complete')
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((err: unknown) => {
  logger.fatal({ err }, 'fatal error during worker startup')
  process.exit(1)
})
