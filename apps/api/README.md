# apps/api

Fastify REST API. Handles all business logic, auth, and data access. The web app and any external integrations talk to this.

## Structure

```
src/
  server.ts               # Fastify instance, plugin registration, startup
  routes/
    auth.ts               # /auth/* — login, signup, token refresh
    monitors.ts           # /monitors/* — CRUD + pause/resume
    checkins.ts           # /ping/:token — public check-in endpoint (no auth)
    alerts.ts             # /alerts/* — alert history, mute, resolve
    integrations.ts       # /integrations/* — Slack, PagerDuty, webhooks
    billing.ts            # /billing/* — Stripe portal, plan info
    teams.ts              # /teams/* — invite, members, remove
    webhooks/
      stripe.ts           # Stripe webhook handler
  hooks/
    authenticate.ts       # JWT verification, attaches req.user + req.team
    rate-limit.ts         # Per-IP and per-token rate limiting
  services/
    monitors.ts           # Monitor business logic
    checkins.ts           # Check-in processing + schedule evaluation
    alerts.ts             # Alert creation + deduplication
    integrations.ts       # Dispatching notifications to Slack/PagerDuty/etc.
    billing.ts            # Stripe interactions
  lib/
    prisma.ts             # Prisma client singleton
    redis.ts              # Redis client singleton
    queues.ts             # BullMQ queue instances
    errors.ts             # AppError class, error handler plugin
```

## Check-in endpoint

`GET /ping/:token` (also accepts POST) — this is the public endpoint customers call from their cron jobs. It's on a separate rate limit budget. The token encodes the monitor ID. On receipt:
1. Validate token, resolve monitor
2. Record check-in in DB (timestamp, duration if provided, status)
3. Cancel any pending "missed" alert job for this monitor
4. Schedule the next expected check-in window job via BullMQ

## Auth

JWT-based. Access tokens expire in 15min, refresh tokens in 30 days. Refresh is handled automatically by the API client in `apps/web`.

## Rate limiting

- Public check-in endpoint: 1000 req/min per IP
- Authenticated API: 300 req/min per team
- Implemented with Redis sliding window via `apps/api/src/hooks/rate-limit.ts`

## Env vars

```
DATABASE_URL=
REDIS_URL=
JWT_SECRET=
JWT_REFRESH_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
RESEND_API_KEY=
APP_URL=
```
