# Cronpilot – CLAUDE.md

This file contains everything Claude needs to know about this project. Read all of it carefully before doing anything.

## About the project

Cronpilot is a cron job monitoring application built with Next.js, Fastify, PostgreSQL, Redis, BullMQ, Prisma, Tailwind CSS, shadcn/ui, React Email, Resend, and Stripe. It is a monorepo managed with Turborepo and pnpm workspaces. The frontend is in apps/web, the API is in apps/api, and the background worker is in apps/worker. Shared packages are in packages/db, packages/shared, and packages/emails. Infrastructure config is in infra/ and documentation is in docs/.

## IMPORTANT: Always use pnpm

Never use npm or yarn. Always use pnpm. If you accidentally use npm it will create a package-lock.json which should not exist. If you see a package-lock.json, delete it. Always run `pnpm install` not `npm install`. Always run `pnpm dev` not `npm run dev`. Always run `pnpm test` not `npm test`. This is very important.

## IMPORTANT: Never use semicolons

This project does not use semicolons. If you write code with semicolons, remove them. Always check your output for semicolons. TypeScript files should never end statements with semicolons. This is enforced by the linter but you should also check manually.

## IMPORTANT: Use single quotes

Always use single quotes in TypeScript and JavaScript files. Never use double quotes for strings. Exception: JSX attribute values use double quotes. Template literals are fine. Always check that you are using single quotes.

## IMPORTANT: Always use arrow functions

Never write `function foo() {}`. Always write `const foo = () => {}`. This applies to all functions except class methods. React components should be arrow functions. Utility functions should be arrow functions. Event handlers should be arrow functions.

## IMPORTANT: Never use `any`

Never use the `any` type in TypeScript. If you don't know the type, use `unknown` and narrow it. If you see existing `any` in the codebase, do not copy it. Always write proper types. If you are receiving data from an API, define a Zod schema and infer the type from it.

## IMPORTANT: Always handle errors

Never let promises go unhandled. Always use try/catch or .catch(). Always log errors. Never swallow exceptions silently. If a function can throw, document it with a JSDoc comment. Always check the return value of functions that can fail.

## IMPORTANT: Use async/await, never .then()

Never use `.then()` chains. Always use `async/await`. If you see `.then()` in the codebase, do not copy that pattern. Always `await` promises. Always mark functions that use `await` as `async`.

## Code style rules

### Naming conventions

- Variables: camelCase
- Constants: SCREAMING_SNAKE_CASE for module-level constants, camelCase for local constants
- Types and interfaces: PascalCase
- Files: kebab-case for all files (e.g. `my-component.tsx`, `use-my-hook.ts`)
- React components: PascalCase component name, kebab-case filename
- Database models: PascalCase (Prisma convention)
- Environment variables: SCREAMING_SNAKE_CASE
- CSS classes: always use Tailwind, never write custom CSS
- Test files: same name as the file being tested with `.test.ts` suffix

### TypeScript rules

- Always enable strict mode (already in tsconfig.json)
- Never use `!` non-null assertion unless absolutely unavoidable
- Prefer `interface` over `type` for object shapes that might be extended
- Prefer `type` for unions, intersections, and aliases
- Always type function parameters and return values explicitly
- Use `const` over `let`, never use `var`
- Destructure when accessing more than one property of an object
- Use optional chaining `?.` instead of null checks where possible
- Use nullish coalescing `??` instead of `||` for default values

### File structure rules

- Keep files under 200 lines. If a file is getting long, split it into smaller files.
- One component per file in React
- Group imports: external packages first, then internal packages, then relative imports
- Always have a blank line between import groups
- Export at the bottom of the file, not inline, except for React components which can use inline export default

### Comment rules

- Write comments for non-obvious logic only
- Do not write comments that just restate the code
- Use JSDoc for exported functions and types
- Use `//` for single-line comments, `/* */` for multi-line
- Always write TODO comments with your name and a date: `// TODO(claude): 2025-01-01 fix this`

## How to write React components

Always write React components like this:

```tsx
import { type FC } from 'react'

interface MyComponentProps {
  title: string
  description?: string
  onClick: () => void
}

const MyComponent: FC<MyComponentProps> = ({ title, description, onClick }) => {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
      <button onClick={onClick} className="btn btn-primary">
        Click me
      </button>
    </div>
  )
}

export default MyComponent
```

Never write class components. Always use functional components. Always define props as an interface. Always use FC from React for the component type.

## How to write API routes in Fastify

Always write Fastify route plugins like this:

```typescript
import type { FastifyInstance } from 'fastify'
import fp from 'fastify-plugin'
import { z } from 'zod'
import { authenticate } from '../hooks/authenticate'
import { AppError } from '@cronpilot/shared'

const CreateThingSchema = z.object({
  name: z.string().min(1).max(100),
})

async function thingsPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.post('/things', { preHandler: [authenticate] }, async (request, reply) => {
    const parsed = CreateThingSchema.safeParse(request.body)
    if (!parsed.success) {
      throw new AppError('VALIDATION_ERROR', parsed.error.errors.map(e => e.message).join(', '), 400)
    }
    // do stuff
    return reply.status(201).send({ data: result })
  })
}

export default fp(thingsPlugin, { name: 'things-routes' })
```

Always use `fp` from `fastify-plugin` to wrap your plugin. Always validate with Zod using `.safeParse()`. Always throw `AppError` for errors. Always return `{ data: result }` for success responses. Always use `preHandler` for authentication, not middleware.

## How to write Prisma queries

Never write raw SQL. Always use the Prisma client. Always import prisma from `../lib/prisma` or `../../lib/prisma`. Always use transactions for operations that write to multiple tables. Example:

```typescript
const result = await prisma.$transaction(async (tx) => {
  const thing = await tx.thing.create({ data: { name: 'foo' } })
  await tx.otherThing.create({ data: { thingId: thing.id } })
  return thing
})
```

Always select only the fields you need. Never use `findMany` without a `where` clause on large tables. Always add `orderBy` when the order matters. Use `findUniqueOrThrow` instead of `findUnique` when you expect the record to exist.

## How to write tests

Use vitest. Import `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach`, `beforeAll`, `afterAll` from vitest. Use `vi.mock()` to mock modules. Use `vi.fn()` to create mock functions. Use `vi.spyOn()` to spy on methods. Always clean up mocks in `afterEach` or use `vi.clearAllMocks()` in `beforeEach`.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('myFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does the thing', () => {
    const result = myFunction('input')
    expect(result).toBe('expected output')
  })

  it('throws when input is invalid', () => {
    expect(() => myFunction('')).toThrow('Invalid input')
  })
})
```

For API integration tests, always start and stop the server in `beforeAll`/`afterAll`. Use `server.inject()` for making requests in tests. Never make real HTTP requests in tests.

## How to add a new database migration

1. Edit the schema in `packages/db/prisma/schema.prisma`
2. Run `pnpm db:migrate` (or `pnpm --filter @cronpilot/db migrate`) to create and apply the migration
3. Give the migration a descriptive name when prompted, e.g. `add_monitor_timezone`
4. Never edit migration files after they have been committed
5. Never delete migration files
6. Run `pnpm db:generate` to regenerate the Prisma client after schema changes
7. Update seed data in `packages/db/prisma/seed.ts` if needed
8. Test the migration against a local database before committing
9. If the migration is destructive (drops a column or table), add a comment explaining why

## How to add a new environment variable

1. Add it to `.env.example` in the root with a description comment
2. Add it to the appropriate app's `.env.example`
3. Add it to the deployment config in Railway
4. Document it in this file
5. Never commit actual secret values to git
6. Always use `process.env['MY_VAR']` not `process.env.MY_VAR` (bracket notation for TypeScript strict mode)

## How to add a new BullMQ queue

1. Add the queue name to `QUEUES` in `packages/shared/src/constants.ts`
2. Add the job data type to `packages/shared/src/types.ts`
3. Create a queue instance in `apps/api/src/lib/queues.ts` and `apps/worker/src/lib/queues.ts`
4. Create a processor file at `apps/worker/src/processors/my-queue.ts`
5. Register the worker in `apps/worker/src/worker.ts`
6. If it is a recurring job, add it to the recurring job registration section in `worker.ts`

## Tailwind CSS rules

Always use Tailwind utility classes. Never write custom CSS in .css files unless absolutely necessary. Use the `cn()` utility (from `packages/shared` or `apps/web/src/lib/utils.ts`) to conditionally apply classes. Never use inline styles. Use `clsx` or `tailwind-merge` for conditional classes.

Good example:
```tsx
<div className={cn('flex items-center gap-2', isActive && 'bg-primary text-primary-foreground')}>
```

Bad example:
```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: isActive ? '#000' : undefined }}>
```

Always use semantic color tokens from the shadcn/ui theme (e.g. `text-muted-foreground`, `bg-card`, `border-border`) rather than hardcoded colors like `text-gray-500`. This ensures dark mode works correctly.

## Error handling conventions

All API errors should use `AppError` from `@cronpilot/shared`. The constructor takes `(code: string, message: string, statusCode: number)`. The error handler plugin in `apps/api/src/lib/errors.ts` converts these to JSON responses automatically.

Standard error codes:
- `VALIDATION_ERROR` → 400
- `UNAUTHORIZED` → 401
- `FORBIDDEN` → 403
- `NOT_FOUND` → 404
- `CONFLICT` → 409
- `INTERNAL_ERROR` → 500

Never throw raw `Error` objects from route handlers. Always use `AppError`. Never expose internal error details in production responses.

## Git workflow

Always work on a feature branch, never commit directly to main. Branch naming: `feat/short-description`, `fix/short-description`, `chore/short-description`. Always rebase onto main before opening a PR. Squash commits if you have more than 3 commits for a small change. Write commit messages in conventional commits format. Always run tests before committing. Never force push to main.

## Running the project locally

Prerequisites: Node.js 20+, pnpm 9+, PostgreSQL 15+, Redis 7+.

1. Clone the repo
2. Run `pnpm install` in the root
3. Copy `.env.example` to `.env` and fill in the values
4. Run `pnpm db:migrate` to create the database schema
5. Run `pnpm db:seed` to seed test data
6. Run `pnpm dev` to start all apps
7. Web runs on http://localhost:3000
8. API runs on http://localhost:3001
9. Worker starts automatically

If you get a connection error, make sure PostgreSQL and Redis are running. On macOS with Homebrew: `brew services start postgresql@15` and `brew services start redis`.

## Frequently made mistakes to avoid

- Do NOT import from `@cronpilot/db` directly in `apps/web`. The web app is a Next.js frontend and should never connect to the database directly. Always go through the API.
- Do NOT use `useEffect` for data fetching. Use SWR with the `apiClient` from `apps/web/src/lib/api.ts`.
- Do NOT forget to handle the loading and error states in React components when using SWR.
- Do NOT use `Date.now()` for anything that gets stored in the database. Use `new Date()` so it's a proper Date object that Prisma can handle.
- Do NOT forget to update `lastCheckinAt` on the monitor when processing a new check-in.
- Do NOT add new routes without adding the appropriate rate limiting preHandler.
- Do NOT commit `.env` files. They are in `.gitignore` but double-check anyway.
- Do NOT use `console.log` in production code. Use the Fastify logger (`request.log`) in the API and Pino (`logger`) in the worker.
- Do NOT directly query the database from the worker without going through the Prisma client.
- Do NOT forget that integration configs are stored encrypted. Always decrypt before using, always encrypt before storing.

## shadcn/ui component usage

Always install new shadcn components with `pnpm dlx shadcn@latest add <component>` from the `apps/web` directory. Never manually copy shadcn component code. After installing, the component will be in `apps/web/src/components/ui/`. Import from `@/components/ui/component-name`. Never modify shadcn components directly — extend them with wrapper components instead.

Available components already installed: Button, Input, Label, Card, Dialog, AlertDialog, DropdownMenu, Badge, Separator, Skeleton, Table, Tabs, Toast, Tooltip.

## Internationalization

This project does not currently support internationalization. All user-facing strings should be in English. Do not add i18n libraries or infrastructure. If a translation system is added in the future, this section will be updated.

## Performance guidelines

- Always paginate list endpoints. Default page size is 20, maximum is 100.
- Add database indexes for any column used in a `WHERE` clause that queries large tables.
- Never fetch more data than you need — always use `select` in Prisma to limit fields.
- In the web app, use `loading.tsx` and `Suspense` boundaries for slow-loading sections.
- Use SWR's `revalidateOnFocus: false` for data that doesn't change frequently.
- Never run N+1 queries. Use Prisma's `include` to eager-load related data in a single query.

## Security checklist

Before merging any PR, verify:
- [ ] No secrets committed to git
- [ ] All user inputs validated with Zod
- [ ] Authentication applied to all non-public routes
- [ ] No SQL injection (always use Prisma, never raw queries)
- [ ] Rate limiting on all public endpoints
- [ ] Integration configs encrypted before storage
- [ ] No sensitive data in logs
- [ ] CORS configured correctly
- [ ] Stripe webhook signature verified before processing
