# Project overview

Cronpilot is a cron job monitoring SaaS. Read README.md first for domain concepts and stack overview.

## Monorepo conventions

- All apps live in `apps/`, all shared packages in `packages/`
- Shared types must go in `packages/shared` — never define the same type in two places
- Database access only through `packages/db` — apps import `@cronpilot/db`, never call Prisma directly
- Use `pnpm --filter <app> <command>` to run commands in a specific workspace

## Code style

- TypeScript strict mode everywhere
- Zod for all runtime validation (API input, env vars, webhook payloads)
- No `any` — if you're tempted, use `unknown` and narrow it
- Errors: use the `AppError` class from `packages/shared`, never throw plain strings
- Async: always use `async/await`, no raw Promise chains

## API conventions

- All routes are in `apps/api/src/routes/`
- Route files export a Fastify plugin
- Auth is handled by the `authenticate` hook — attach it to protected routes
- Responses follow the shape `{ data: T }` for success, `{ error: { code, message } }` for errors
- Never return raw Prisma objects — always map to a response type defined in `packages/shared`

## Database

- Never write raw SQL — use Prisma
- Migrations live in `packages/db/prisma/migrations/`
- When adding a new model, update `packages/db/prisma/schema.prisma` and run `pnpm db:migrate`
- Seed data is in `packages/db/src/seed.ts`

## Background jobs

- All queue names are constants in `packages/shared/src/queues.ts`
- Processors live in `apps/worker/src/processors/`
- Never call queue jobs from `apps/web` — go through the API

## Testing

- Unit tests colocated with source files (`*.test.ts`)
- Integration tests in `apps/api/tests/`
- Run all tests: `pnpm test`

## Things to be careful about

- Multi-tenancy: every DB query that touches customer data must be scoped to a `teamId`
- Check-in URLs contain a secret token — never log them
- Alert deduplication logic is in `apps/worker/src/processors/alert.ts` — be careful when modifying it
