import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { authenticate } from '../hooks/authenticate'
import { rateLimitApi } from '../hooks/rate-limit'
import {
  listAlerts,
  getAlert,
  resolveAlert,
  muteAlert,
  ListAlertsQuerySchema,
} from '../services/alerts'
import { AppError } from '@cronpilot/shared'

async function alertsPlugin(fastify: FastifyInstance): Promise<void> {
  const preHandler = [authenticate, rateLimitApi]

  // GET /alerts
  fastify.get('/alerts', { preHandler }, async (request, reply) => {
    const parsed = ListAlertsQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new AppError('VALIDATION_ERROR', msg, 400)
    }
    const result = await listAlerts(request.team.id, parsed.data)
    return reply.send(result)
  })

  // GET /alerts/:id
  fastify.get<{ Params: { id: string } }>(
    '/alerts/:id',
    { preHandler },
    async (request, reply) => {
      const alert = await getAlert(request.team.id, request.params.id)
      return reply.send({ data: alert })
    },
  )

  // POST /alerts/:id/resolve
  fastify.post<{ Params: { id: string } }>(
    '/alerts/:id/resolve',
    { preHandler },
    async (request, reply) => {
      const alert = await resolveAlert(request.team.id, request.params.id)
      return reply.send({ data: alert })
    },
  )

  // POST /alerts/:id/mute
  fastify.post<{ Params: { id: string } }>(
    '/alerts/:id/mute',
    { preHandler },
    async (request, reply) => {
      const alert = await muteAlert(request.team.id, request.params.id)
      return reply.send({ data: alert })
    },
  )
}

export default fp(alertsPlugin, { name: 'alerts-routes' })
