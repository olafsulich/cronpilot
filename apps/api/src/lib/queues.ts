import { Queue } from 'bullmq'
import { redis } from './redis'
import { QUEUES } from '@cronpilot/shared'

const connection = redis

export const checkWindowQueue = new Queue(QUEUES.CHECK_WINDOW, { connection })
export const alertQueue = new Queue(QUEUES.ALERT, { connection })
export const alertResolveQueue = new Queue(QUEUES.ALERT_RESOLVE, { connection })
export const digestQueue = new Queue(QUEUES.DIGEST, { connection })
export const cleanupQueue = new Queue(QUEUES.CLEANUP, { connection })
export const trialExpiryQueue = new Queue(QUEUES.TRIAL_EXPIRY, { connection })

export async function closeQueues(): Promise<void> {
  await Promise.all([
    checkWindowQueue.close(),
    alertQueue.close(),
    alertResolveQueue.close(),
    digestQueue.close(),
    cleanupQueue.close(),
    trialExpiryQueue.close(),
  ])
}
