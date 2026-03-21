import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { z } from 'zod'
import { authenticate } from '../hooks/authenticate'
import { rateLimitApi } from '../hooks/rate-limit'
import {
  getBillingInfo,
  createCheckoutSession,
  createPortalSession,
} from '../services/billing'
import { AppError } from '@cronpilot/shared'

const CheckoutSchema = z.object({
  priceId: z.string().min(1),
})

async function billingPlugin(fastify: FastifyInstance): Promise<void> {
  const preHandler = [authenticate, rateLimitApi]

  // GET /billing
  fastify.get('/billing', { preHandler }, async (request, reply) => {
    const info = await getBillingInfo(request.team.id)
    return reply.send({ data: info })
  })

  // POST /billing/checkout
  fastify.post('/billing/checkout', { preHandler }, async (request, reply) => {
    const parsed = CheckoutSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', 'priceId is required', 400)
    }
    const result = await createCheckoutSession(
      request.team.id,
      request.user.id,
      parsed.data.priceId,
    )
    return reply.send({ data: result })
  })

  // POST /billing/portal
  fastify.post('/billing/portal', { preHandler }, async (request, reply) => {
    const result = await createPortalSession(request.team.id)
    return reply.send({ data: result })
  })
}

export default fp(billingPlugin, { name: 'billing-routes' })
