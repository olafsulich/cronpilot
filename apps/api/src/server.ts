import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import { redis } from './lib/redis'
import { closeQueues } from './lib/queues'
import errorHandlerPlugin from './lib/errors'

// Route plugins
import authRoutes from './routes/auth'
import monitorsRoutes from './routes/monitors'
import checkinsRoutes from './routes/checkins'
import alertsRoutes from './routes/alerts'
import integrationsRoutes from './routes/integrations'
import teamsRoutes from './routes/teams'
import billingRoutes from './routes/billing'
import stripeWebhookRoutes from './routes/webhooks/stripe'

const PORT = parseInt(process.env['PORT'] ?? '3001', 10)
const HOST = process.env['HOST'] ?? '0.0.0.0'

async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      ...(process.env['NODE_ENV'] !== 'production' && {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true },
        },
      }),
    },
  })

  // We need the raw body for Stripe webhook signature verification.
  // Register a custom content type parser that stores the raw buffer.
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (req, body, done) => {
      // Store raw body before parsing
      ;(req as unknown as { rawBody: Buffer }).rawBody = body
      try {
        const json: unknown = JSON.parse(body.toString())
        done(null, json)
      } catch (err) {
        const error = new Error('Invalid JSON')
        ;(error as NodeJS.ErrnoException).statusCode = 400
        done(error as Error, undefined)
      }
    },
  )

  // Security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: false, // API only — no HTML responses
  })

  // CORS
  await fastify.register(cors, {
    origin: process.env['APP_URL'] ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  })

  // JWT (access tokens)
  await fastify.register(jwt, {
    secret: process.env['JWT_SECRET'] ?? 'jwt-secret-change-me',
    sign: { expiresIn: '15m' },
  })

  // Error handler (must be registered before routes)
  await fastify.register(errorHandlerPlugin)

  // Health check — no auth, no rate limiting
  fastify.get('/health', async (_request, reply) => {
    return reply.send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    })
  })

  // Stripe webhook — must be before other routes so raw body parser applies
  await fastify.register(stripeWebhookRoutes)

  // API routes
  await fastify.register(authRoutes)
  await fastify.register(monitorsRoutes)
  await fastify.register(checkinsRoutes)
  await fastify.register(alertsRoutes)
  await fastify.register(integrationsRoutes)
  await fastify.register(teamsRoutes)
  await fastify.register(billingRoutes)

  return fastify
}

async function start() {
  const server = await buildServer()

  const shutdown = async (signal: string) => {
    server.log.info({ signal }, 'Shutting down...')
    try {
      await server.close()
      await closeQueues()
      await redis.quit()
      server.log.info('Graceful shutdown complete')
      process.exit(0)
    } catch (err) {
      server.log.error({ err }, 'Error during shutdown')
      process.exit(1)
    }
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))

  try {
    await server.listen({ port: PORT, host: HOST })
  } catch (err) {
    server.log.error({ err }, 'Failed to start server')
    process.exit(1)
  }
}

void start()

export { buildServer }
