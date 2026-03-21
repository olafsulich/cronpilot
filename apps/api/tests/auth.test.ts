import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../src/server'
import type { FastifyInstance } from 'fastify'

/**
 * Integration tests for the auth routes.
 *
 * These tests require a running database and Redis. In CI they are run against
 * the test database defined by DATABASE_URL.
 */

let server: FastifyInstance

beforeAll(async () => {
  server = await buildServer()
  await server.ready()
})

afterAll(async () => {
  await server.close()
})

describe('POST /auth/signup', () => {
  it('returns 201 and tokens on valid input', async () => {
    const email = `test-${Date.now()}@example.com`
    const response = await server.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email,
        password: 'supersecret123',
        teamName: 'Acme Corp',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body) as {
      data: {
        accessToken: string
        refreshToken: string
        user: { email: string }
        team: { name: string }
      }
    }
    expect(body.data.accessToken).toBeDefined()
    expect(body.data.refreshToken).toBeDefined()
    expect(body.data.user.email).toBe(email)
    expect(body.data.team.name).toBe('Acme Corp')
  })

  it('returns 400 on invalid email', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: {
        email: 'not-an-email',
        password: 'supersecret123',
        teamName: 'Acme',
      },
    })
    expect(response.statusCode).toBe(400)
  })

  it('returns 409 if email already exists', async () => {
    const email = `dup-${Date.now()}@example.com`
    await server.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'supersecret123', teamName: 'Team A' },
    })
    const response = await server.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'anotherpassword', teamName: 'Team B' },
    })
    expect(response.statusCode).toBe(409)
  })
})

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const email = `login-${Date.now()}@example.com`
    await server.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'mypassword1', teamName: 'Login Team' },
    })

    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'mypassword1' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body) as {
      data: { accessToken: string; refreshToken: string }
    }
    expect(body.data.accessToken).toBeDefined()
  })

  it('returns 401 for wrong password', async () => {
    const email = `wrongpass-${Date.now()}@example.com`
    await server.inject({
      method: 'POST',
      url: '/auth/signup',
      payload: { email, password: 'correctpass', teamName: 'Team' },
    })

    const response = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email, password: 'wrongpass' },
    })
    expect(response.statusCode).toBe(401)
  })
})

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const response = await server.inject({ method: 'GET', url: '/health' })
    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body) as { status: string }
    expect(body.status).toBe('ok')
  })
})
