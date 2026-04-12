# API & worker integration test patterns

Tests live in `apps/api/tests/` alongside a `vitest.config.ts` that sets `singleFork: true` — all tests run sequentially in a single process to avoid database conflicts. Never change this.

## Requirements

Tests hit a real PostgreSQL database and Redis. `DATABASE_URL` must point to a test database (see `docs/agent/environment.md`). Run with:

```bash
pnpm --filter @cronpilot/api test
```

## Boilerplate

Every test file follows this structure:

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildServer } from '../src/server'
import type { FastifyInstance } from 'fastify'

let server: FastifyInstance

beforeAll(async () => {
  server = await buildServer()
  await server.ready()
})

afterAll(async () => {
  await server.close()
})
```

## Making requests

Use `server.inject()` — never start an HTTP server or use `fetch`. For authenticated routes, sign up first and pass the returned `accessToken`:

```ts
// Create a user + team and get a token
const signup = await server.inject({
  method: 'POST',
  url: '/auth/signup',
  payload: {
    email: `test-${Date.now()}@example.com`,
    password: 'supersecret123',
    teamName: 'Test Team',
  },
})
const { accessToken } = JSON.parse(signup.body).data

// Use the token on authenticated routes
const response = await server.inject({
  method: 'GET',
  url: '/monitors',
  headers: { authorization: `Bearer ${accessToken}` },
})
```

## Unique test data

Use `Date.now()` in emails and names to prevent conflicts between test runs:

```ts
const email = `test-${Date.now()}@example.com`
```

## What to assert

- `response.statusCode` — always assert the status code first
- Parse `response.body` with `JSON.parse()` and assert the shape
- For mutations, assert DB state changed (use `prisma` directly if needed)
- Always test the unhappy path: missing auth (401), bad input (400), conflicts (409)

## Route shapes

See `docs/agent/api-routes.md` for the full list of routes, auth requirements, and request/response shapes.
