import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import Stripe from 'stripe'
import { handleStripeEvent } from '../../services/billing'
import { AppError } from '@cronpilot/shared'

async function stripeWebhookPlugin(fastify: FastifyInstance): Promise<void> {
  // POST /webhooks/stripe
  // Content-Type must be application/json (raw body needed for signature verification)
  fastify.post(
    '/webhooks/stripe',
    {
      config: {
        // Tell Fastify to provide the raw body for this route
        rawBody: true,
      },
    },
    async (request, reply) => {
      const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET']
      if (!webhookSecret) {
        throw new AppError('INTERNAL_ERROR', 'Stripe webhook secret not configured', 500)
      }

      const stripeSecretKey = process.env['STRIPE_SECRET_KEY']
      if (!stripeSecretKey) {
        throw new AppError('INTERNAL_ERROR', 'Stripe secret key not configured', 500)
      }

      const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' })

      const signature = request.headers['stripe-signature']
      if (!signature || typeof signature !== 'string') {
        throw new AppError('BAD_REQUEST', 'Missing stripe-signature header', 400)
      }

      // Fastify does not expose rawBody by default — we need the raw buffer.
      // The server registers the addContentTypeParser for this route.
      const rawBody = (request as unknown as { rawBody: Buffer }).rawBody
      if (!rawBody) {
        throw new AppError('BAD_REQUEST', 'Raw body not available', 400)
      }

      let event: Stripe.Event
      try {
        event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Signature verification failed'
        throw new AppError('BAD_REQUEST', `Webhook signature verification failed: ${message}`, 400)
      }

      try {
        await handleStripeEvent(event)
      } catch (err) {
        // Log but don't rethrow — Stripe will retry if we return non-2xx
        fastify.log.error({ err, eventType: event.type }, 'Failed to handle Stripe event')
        return reply.status(500).send({ error: { code: 'HANDLER_ERROR', message: 'Event handler failed' } })
      }

      return reply.send({ data: { received: true } })
    },
  )
}

export default fp(stripeWebhookPlugin, { name: 'stripe-webhook' })
