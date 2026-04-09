# Project overview

Cronpilot is a cron job monitoring application. It instruments your jobs with a single HTTP ping. Cronpilot tracks execution windows, detects failures and missed runs, and alerts your team via Slack, PagerDuty, or email.

## Key concepts

- **Monitor**: a cron job registered by a customer. Has a schedule (cron expression), grace period, timezone, and a unique `pingToken`. DB status: `active`/`paused`; computed status: `healthy`/`late`/`down`/`paused`/`new`.
- **Check-in**: an HTTP ping to `GET|POST /ping/:token`. Status is `ok` or `fail` (explicitly reported by the job). Optionally includes `duration` (ms) and `exitCode`.
- **Alert**: created when a check-in window closes without a valid check-in. Type is `missed` or `failed`. Lifecycle: `open` → `resolved` (auto-resolved when a check-in resumes).
- **Alert Rule**: links a monitor to an integration. Controls which integrations are notified and has a `notifyAfter` threshold to reduce noise.
- **Integration**: a notification destination belonging to a team. Types: `slack`, `pagerduty`, `webhook`, `email`. Config is encrypted at rest.
- **Team**: multi-tenant unit. Users belong to teams; monitors, integrations, and alert rules belong to teams. Has a `plan` (`free`/`pro`/`team`/`enterprise`) that enforces monitor limits.

## Tech stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **API**: Fastify, Zod validation, JWT auth
- **Auth**: next-auth (web dashboard), JWT (API routes)
- **Database**: PostgreSQL (primary), Redis (queues + rate limiting)
- **Queue**: BullMQ
- **ORM**: Prisma
- **Emails**: React Email + Resend (sent from worker)
- **Billing**: Stripe (in API)
- **Alerts**: Slack, PagerDuty, email (processed by worker)
- **Infra**: Railway (app), Supabase (DB), Upstash (Redis)
- **Monorepo**: Turborepo + pnpm workspaces

## Monorepo structure

```
apps/
  web/       Next.js dashboard (customer-facing)
  api/       Main REST + webhook API
  worker/    Background job processor (alerts, digests, cleanup)
packages/
  db/        Prisma schema, migrations, seeding
  shared/    Types, constants, utility functions shared across apps
  emails/    Transactional email templates (React Email)
infra/       Terraform, Docker, deployment configs
docs/        Architecture decisions, runbooks, API docs
```

## Testing

- **Framework**: Vitest across all apps
- **API** (`apps/api`): integration tests — hit a real database and Redis. Tests run sequentially (`singleFork: true`) to avoid DB conflicts. Requires `DATABASE_URL` to point to a test DB.
- **Web** (`apps/web`): unit tests with jsdom + `@testing-library/react`. Mock external dependencies (SWR, API client) with `vi.mock`.
- No mocking the database in API tests — use real DB connections.

## Commands

Use `pnpm` — not npm or yarn.

```bash
pnpm dev          # start all apps (Turborepo)
pnpm build        # build all apps
pnpm test         # run all tests

# per-app
pnpm --filter @cronpilot/web type-check
pnpm --filter @cronpilot/worker typecheck
pnpm --filter @cronpilot/api test

# database
pnpm db:migrate   # run pending migrations
pnpm db:push      # push schema without migration
pnpm db:seed      # seed the database
pnpm db:studio    # open Prisma Studio
pnpm db:reset     # reset and reseed
```

## Commits & pull requests

Use [Conventional Commits](https://www.conventionalcommits.org/): `type(scope): description` — lowercase, no period.

```
feat(monitors): add timezone support to grace period calculation
fix(alerts): resolve duplicate notifications on concurrent check-ins
chore(db): add index on check-ins createdAt
```

Write messages focused on **user impact**, not implementation details.

- **Good:** `fix(alerts): stop sending duplicate missed-run notifications`
- **Bad:** `fix(alerts): add deduplication guard in alert processor`

One logical change per commit. Never commit directly to `main`.

### Creating pull requests

Before opening a PR:

1. Review the full diff — remove any unrelated changes
2. Run `pnpm test` and `pnpm --filter @cronpilot/web type-check` and confirm they pass
3. Check for secrets, injection vulnerabilities, or unsafe patterns

PR title follows the same conventional commit format. Body should explain _why_ the change is needed, not what changed. Link related issues with `closes #123`.
