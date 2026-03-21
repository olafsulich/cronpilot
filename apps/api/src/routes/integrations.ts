import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { authenticate } from '../hooks/authenticate'
import { rateLimitApi } from '../hooks/rate-limit'
import {
  listIntegrations,
  createIntegration,
  deleteIntegration,
  testIntegration,
  CreateIntegrationSchema,
} from '../services/integrations'
import { AppError } from '@cronpilot/shared'

async function integrationsPlugin(fastify: FastifyInstance): Promise<void> {
  const preHandler = [authenticate, rateLimitApi]

  // GET /integrations
  fastify.get('/integrations', { preHandler }, async (request, reply) => {
    const integrations = await listIntegrations(request.team.id)
    return reply.send({ data: integrations })
  })

  // POST /integrations
  fastify.post('/integrations', { preHandler }, async (request, reply) => {
    const parsed = CreateIntegrationSchema.safeParse(request.body)
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new AppError('VALIDATION_ERROR', msg, 400)
    }
    const integration = await createIntegration(request.team.id, parsed.data)
    return reply.status(201).send({ data: integration })
  })

  // DELETE /integrations/:id
  fastify.delete<{ Params: { id: string } }>(
    '/integrations/:id',
    { preHandler },
    async (request, reply) => {
      await deleteIntegration(request.team.id, request.params.id)
      return reply.status(204).send()
    },
  )

  // POST /integrations/:id/test
  fastify.post<{ Params: { id: string } }>(
    '/integrations/:id/test',
    { preHandler },
    async (request, reply) => {
      const result = await testIntegration(request.team.id, request.params.id)
      const status = result.success ? 200 : 422
      return reply.status(status).send({ data: result })
    },
  )
}

export default fp(integrationsPlugin, { name: 'integrations-routes' })
