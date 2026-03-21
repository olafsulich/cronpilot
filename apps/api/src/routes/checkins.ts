import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { z } from 'zod'
import { authenticate } from '../hooks/authenticate'
import { rateLimitCheckin, rateLimitApi } from '../hooks/rate-limit'
import { processCheckin, listCheckins } from '../services/checkins'
import { AppError } from '@cronpilot/shared'

const CheckinQuerySchema = z.object({
  duration: z.coerce.number().int().min(0).optional(),
  status: z.enum(['ok', 'fail']).optional(),
  exit_code: z.coerce.number().int().optional(),
})

const CheckinBodySchema = z.object({
  duration: z.number().int().min(0).optional(),
  status: z.enum(['ok', 'fail']).optional(),
  exitCode: z.number().int().optional(),
})

const ListCheckinsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

async function checkinsPlugin(fastify: FastifyInstance): Promise<void> {
  // GET /ping/:token — public check-in endpoint (no auth)
  fastify.get<{ Params: { token: string } }>(
    '/ping/:token',
    { preHandler: [rateLimitCheckin] },
    async (request, reply) => {
      const { token } = request.params
      const query = CheckinQuerySchema.safeParse(request.query)
      if (!query.success) {
        throw new AppError('VALIDATION_ERROR', 'Invalid query parameters', 400)
      }

      const checkin = await processCheckin(token, {
        duration: query.data.duration,
        status: query.data.status,
        exitCode: query.data.exit_code,
      })

      return reply.send({ data: checkin })
    },
  )

  // POST /ping/:token — same as GET, for compatibility
  fastify.post<{ Params: { token: string } }>(
    '/ping/:token',
    { preHandler: [rateLimitCheckin] },
    async (request, reply) => {
      const { token } = request.params

      // Accept both query params and body
      const bodyParsed = CheckinBodySchema.safeParse(request.body)
      const queryParsed = CheckinQuerySchema.safeParse(request.query)

      const bodyData = bodyParsed.success ? bodyParsed.data : {}
      const queryData = queryParsed.success ? queryParsed.data : {}

      const checkin = await processCheckin(token, {
        duration: bodyData.duration ?? queryData.duration,
        status: bodyData.status ?? queryData.status,
        exitCode: bodyData.exitCode ?? queryData.exit_code,
      })

      return reply.send({ data: checkin })
    },
  )

  // GET /monitors/:monitorId/checkins — list check-ins (requires auth)
  fastify.get<{ Params: { monitorId: string } }>(
    '/monitors/:monitorId/checkins',
    { preHandler: [authenticate, rateLimitApi] },
    async (request, reply) => {
      const pagination = ListCheckinsQuerySchema.safeParse(request.query)
      if (!pagination.success) {
        throw new AppError('VALIDATION_ERROR', 'Invalid pagination parameters', 400)
      }

      const result = await listCheckins(
        request.team.id,
        request.params.monitorId,
        pagination.data,
      )

      return reply.send(result)
    },
  )
}

export default fp(checkinsPlugin, { name: 'checkins-routes' })
