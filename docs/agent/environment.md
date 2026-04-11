# Environment variables

Copy `.env.example` to `.env` in the repo root and fill in the values. Each app also has its own `.env.example` for running in isolation.

## Shared (all apps)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `NODE_ENV` | `development` / `production` |

## API (`apps/api`)

| Variable | Description |
|---|---|
| `JWT_SECRET` | Signs access tokens (15m expiry) — `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Signs refresh tokens (30d expiry) |
| `PORT` | API server port (default `3001`) |
| `APP_URL` | Web app URL for CORS (default `http://localhost:3000`) |
| `ENCRYPTION_KEY` | AES-256 key for integration configs — 32 bytes hex |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_PRICE_ID_PRO` | Stripe price ID for the Pro plan |
| `STRIPE_PRICE_ID_TEAM` | Stripe price ID for the Team plan |
| `STRIPE_PRICE_ID_ENTERPRISE` | Stripe price ID for the Enterprise plan |
| `SLACK_CLIENT_ID` | Slack OAuth client ID (optional) |
| `SLACK_CLIENT_SECRET` | Slack OAuth client secret (optional) |
| `SENTRY_DSN` | Sentry DSN for error tracking (optional) |

## Web (`apps/web`)

| Variable | Description |
|---|---|
| `NEXTAUTH_SECRET` | next-auth session secret — `openssl rand -hex 32` |
| `NEXTAUTH_URL` | Full URL of the web app (default `http://localhost:3000`) |
| `API_INTERNAL_URL` | Internal API URL for SSR requests (default `http://localhost:3001`) |
| `API_SERVICE_TOKEN` | Service token for server-side API calls |
| `NEXT_PUBLIC_API_URL` | Public API URL for client-side requests |
| `NEXT_PUBLIC_APP_URL` | Public web app URL |
| `NEXT_PUBLIC_STRIPE_KEY` | Stripe publishable key |

## Worker (`apps/worker`)

| Variable | Description |
|---|---|
| `ENCRYPTION_KEY` | Same AES-256 key as the API (needed to decrypt integration configs) |
| `RESEND_API_KEY` | Resend API key |
| `APP_URL` | Web app URL (used in email links) |
| `WORKER_CONCURRENCY` | BullMQ worker concurrency per queue (default `5`) |
| `LOG_LEVEL` | Pino log level: `trace` / `debug` / `info` / `warn` / `error` (default `info`) |
