import { Redis } from 'ioredis'
import { logger } from './logger.js'

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379'

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
})

redis.on('error', (err: Error) => {
  logger.error({ err }, '[redis] connection error')
})

redis.on('connect', () => {
  logger.info('[redis] connected')
})

redis.on('reconnecting', () => {
  logger.warn('[redis] reconnecting...')
})
