# packages/db

Prisma schema, migrations, and seed data. All database access in the monorepo goes through this package.

## Usage

```ts
import { prisma } from '@cronpilot/db'

const monitors = await prisma.monitor.findMany({ where: { teamId } })
```

Never instantiate Prisma directly in app code — always import from this package.

## Structure

```
prisma/
  schema.prisma           # Single source of truth for the DB schema
  migrations/             # Auto-generated migration files (committed to git)
src/
  index.ts                # Exports prisma client singleton
  seed.ts                 # Dev/staging seed data
  helpers/
    paginate.ts           # Cursor pagination helper
    soft-delete.ts        # Soft delete utilities
```

## Schema overview

### Core models

**Team** — top-level tenant unit. Every piece of customer data is scoped to a team.
- `id`, `name`, `slug`, `plan`, `trialEndsAt`, `createdAt`

**User** — belongs to one or more teams via `TeamMember`.
- `id`, `email`, `passwordHash`, `createdAt`

**TeamMember** — join table with role (`owner | admin | member`).

**Monitor** — a single cron job being monitored.
- `id`, `teamId`, `name`, `schedule` (cron expression), `timezone`, `gracePeriod` (seconds), `pingToken` (unique, secret), `status` (`active | paused`), `lastCheckinAt`, `createdAt`

**Checkin** — each ping received.
- `id`, `monitorId`, `receivedAt`, `duration` (ms, optional), `status` (`ok | fail`), `exitCode` (optional)

**Alert** — fired when a monitor misses or fails.
- `id`, `monitorId`, `type` (`missed | failed`), `status` (`open | resolved`), `failureCount`, `openedAt`, `resolvedAt`

**Integration** — a connected notification channel.
- `id`, `teamId`, `type` (`slack | pagerduty | webhook | email`), `config` (JSON, encrypted at rest), `createdAt`

**AlertRule** — links a monitor to integrations + escalation config.
- `id`, `monitorId`, `integrationId`, `notifyAfter` (failure count threshold)

## Commands

```bash
pnpm db:migrate       # create + apply a new migration
pnpm db:push          # push schema without migration (dev only)
pnpm db:studio        # open Prisma Studio
pnpm db:seed          # run seed.ts
pnpm db:reset         # drop + recreate + seed (dev only)
```
