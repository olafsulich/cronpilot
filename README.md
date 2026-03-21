# Cronpilot

Cron job monitoring SaaS. You instrument your jobs with a single HTTP ping — Cronpilot tracks execution windows, detects failures and missed runs, and alerts your team via Slack, PagerDuty, or email.

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

## Tech stack

- **Frontend**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui
- **API**: Fastify, Zod validation, JWT auth
- **Database**: PostgreSQL (primary), Redis (queues + rate limiting)
- **Queue**: BullMQ
- **ORM**: Prisma
- **Emails**: React Email + Resend
- **Infra**: Railway (app), Supabase (DB), Upstash (Redis)
- **Monorepo**: Turborepo + pnpm workspaces

## Getting started

```bash
pnpm install
pnpm db:push        # apply schema to local DB
pnpm dev            # starts all apps in parallel
```

Required env vars are documented in each app's README.

## Key concepts

- **Monitor**: a single cron job registered by a customer. Has an expected schedule (cron expression), a grace period, and alert rules.
- **Check-in**: an HTTP ping sent by a customer's job to signal successful execution.
- **Alert**: fired when a check-in is late, missing, or explicitly failed.
- **Team**: multi-tenant unit. Users belong to teams. Monitors belong to teams.
# cronpilot-yt-demo
