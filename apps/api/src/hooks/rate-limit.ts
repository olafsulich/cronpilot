import type { FastifyRequest, FastifyReply } from 'fastify'
import { redis } from '../lib/redis'
import { AppError } from '@cronpilot/shared'

/**
 * Sliding window rate limiter using Redis INCR + EXPIRE.
 *
 * The key expires after `windowSecs` seconds, giving a fixed-window behaviour
 * that is close enough to a sliding window for these use-cases and requires no
 * Lua scripting or sorted sets.
 */
async function checkRateLimit(
  key: string,
  limit: number,
  windowSecs: number,
): Promise<void> {
  const multi = redis.multi()
  multi.incr(key)
  multi.expire(key, windowSecs)
  const results = await multi.exec()

  if (!results) {
    // Redis transaction failed — fail open to avoid blocking legitimate traffic
    return
  }

  const [incrResult] = results
  if (!incrResult) return

  const [err, count] = incrResult
  if (err) {
    console.error('[rate-limit] redis error:', err)
    return
  }

  if (typeof count === 'number' && count > limit) {
    throw new AppError(
      'RATE_LIMITED',
      `Too many requests. Limit is ${limit} per ${windowSecs} seconds.`,
      429,
    )
  }
}

/**
 * Rate limiter for the public /ping/:token check-in endpoint.
 * 1000 requests per minute per IP.
 */
export async function rateLimitCheckin(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const ip = request.ip
  const key = `rl:checkin:${ip}:${Math.floor(Date.now() / 60_000)}`
  await checkRateLimit(key, 1000, 60)
}

/**
 * Rate limiter for authenticated API routes.
 * 300 requests per minute per teamId.
 * Falls back to IP if team is not yet attached to the request.
 */
export async function rateLimitApi(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const teamId = request.team?.id ?? `ip:${request.ip}`
  const key = `rl:api:${teamId}:${Math.floor(Date.now() / 60_000)}`
  await checkRateLimit(key, 300, 60)
}
