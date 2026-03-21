# Research: Team Invitation System

> Synthesized from 3 parallel research agents. All findings include exact file paths and line numbers.
> Documentarian mode: describes what exists, not what should change.

---

## Table of Contents

1. [Existing Invite Code](#1-existing-invite-code)
2. [Surrounding Systems](#2-surrounding-systems)
3. [Patterns to Follow](#3-patterns-to-follow)
4. [Code References](#code-references)
5. [Open Questions](#open-questions)

---

## 1. Existing Invite Code

### 1.1 Invite Endpoint — `POST /teams/invite`

**File**: `apps/api/src/routes/teams.ts` lines 106–156

The endpoint is protected by `[authenticate, rateLimitApi]` pre-handlers (line 29). Only callers with `role === 'owner'` or `role === 'admin'` may proceed (lines 113–115); others receive a `403 FORBIDDEN`.

**Input schema** (defined inline at lines 19–22, also in shared — see §1.3):
```typescript
const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
})
```

**Database operations in order:**

1. Re-fetch caller's `TeamMember` row to verify role (lines 108–115).
2. Check whether a `User` already exists with the given email (lines 126–134).
   - If yes, look up `TeamMember` by composite key `{ userId_teamId }`.
   - If that membership exists → throw `409 CONFLICT`.
3. Call `prisma.teamInvite.create()` with `teamId`, `email`, `role`, `invitedByUserId`, and `expiresAt` set to 7 days from now (lines 137–145).

**Response** (lines 148–155):
```typescript
return reply.status(201).send({
  data: {
    id: invite.id,
    email: invite.email,
    role: invite.role,
    expiresAt: invite.expiresAt.toISOString(),
  },
})
```

**Note on line 147**: A comment reads *"In production this would enqueue an email job; for now return the invite"*. No job is enqueued.

**Critical gap**: `prisma.teamInvite` is referenced here but the `TeamInvite` model does not exist in `packages/db/prisma/schema.prisma`. The migrations directory is empty.

### 1.2 Invite Email Template

**File**: `packages/emails/src/templates/invite.tsx` lines 1–201

**Component signature** (lines 4–16):
```typescript
export interface InviteEmailProps {
  inviterName: string
  teamName: string
  inviteUrl: string
  expiresAt: Date
}

export function InviteEmail({
  inviterName,
  teamName,
  inviteUrl,
  expiresAt,
}: InviteEmailProps)
```

**Static subject generator** (lines 199–201):
```typescript
InviteEmail.subject = (props: InviteEmailProps) =>
  `${props.inviterName} invited you to join ${props.teamName} on Cronpilot`
```

**Internal utilities** (lines 79–94):
- `appendUtm(url, campaign)` — appends UTM tracking parameters to `inviteUrl`.
- `formatDateTime(date)` — formats `expiresAt` to a human-readable string (e.g., `"March 21, 2026, 12:30 PM UTC"`).

The template is exported from `packages/emails/src/index.ts` (lines 25–26).

### 1.3 Invite-Related Shared Types

**File**: `packages/shared/src/types/api.ts` lines 82–87

```typescript
export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
})

export type InviteMemberParams = z.infer<typeof InviteMemberSchema>
```

**File**: `packages/shared/src/types/team.ts` lines 1–25

```typescript
export type TeamRole = 'owner' | 'admin' | 'member'

export interface Team {
  id: string
  name: string
  slug: string
  plan: PlanName
  trialEndsAt: Date | null
  createdAt: Date
}

export interface TeamMember {
  userId: string
  teamId: string
  role: TeamRole
  user: User
}
```

Both are re-exported from `packages/shared/src/index.ts` (lines 44 and 55).

**Token utilities** — `packages/shared/src/utils/tokens.ts` (exported at `index.ts` lines 104–110):
```typescript
export function generateInviteToken(): string {
  return crypto.randomBytes(32).toString('hex')   // 64 hex chars, 256-bit
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
```

### 1.4 Invite-Related Web UI

No dedicated invite or team-members UI exists. The main navigation (`apps/web/src/components/shared/nav.tsx` lines 14–30) lists only Monitors, Alerts, and Integrations. The dashboard layout (`apps/web/src/app/(dashboard)/layout.tsx`) links to Billing at the bottom; no team-members section is present. The landing page (`apps/web/src/app/page.tsx` line 113) lists "Team collaboration" as a marketing feature, but the dashboard has no corresponding implementation.

### 1.5 Queue / Worker Status

**File**: `packages/shared/src/queues.ts` lines 1–10

Defined queues: `CHECK_WINDOW`, `ALERT`, `ALERT_RESOLVE`, `DIGEST`, `CLEANUP`, `TRIAL_EXPIRY`. No invite-email queue exists.

Worker processors in `apps/worker/src/processors/`: `alert.ts`, `alert-resolve.ts`, `check-window.ts`, `cleanup.ts`, `digest.ts`, `trial-expiry.ts`. No invite processor exists.

---

## 2. Surrounding Systems

### 2.1 Database Models

**File**: `packages/db/prisma/schema.prisma`

#### Team (lines 10–24)
```prisma
model Team {
  id               String       @id @default(cuid())
  name             String
  slug             String       @unique
  plan             String       @default("free")
  stripeCustomerId String?
  trialEndsAt      DateTime?
  createdAt        DateTime     @default(now())

  members      TeamMember[]
  monitors     Monitor[]
  integrations Integration[]

  @@index([slug])
}
```

#### User (lines 26–35)
```prisma
model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  createdAt    DateTime   @default(now())

  teams TeamMember[]

  @@index([email])
}
```

#### TeamMember (lines 37–49)
```prisma
model TeamMember {
  userId   String
  teamId   String
  role     String   @default("member")
  joinedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@id([userId, teamId])
  @@index([teamId])
  @@index([userId])
}
```

`role` is stored as a plain `String` (not an enum) and defaults to `"member"`. Valid values are `owner`, `admin`, `member` — enforced in application code, not at the DB level. Cascading deletes are set on both foreign keys.

**Plan-based member limits** (`packages/shared/src/plans.ts`):
```typescript
const PLANS = {
  free:       { monitorsLimit: 3,   checkinRetention: 7,   teamMembers: 1  },
  pro:        { monitorsLimit: 20,  checkinRetention: 90,  teamMembers: 5  },
  team:       { monitorsLimit: 100, checkinRetention: 365, teamMembers: 25 },
  enterprise: { monitorsLimit: Inf, checkinRetention: 730, teamMembers: Inf },
}
```

Utility `isWithinTeamMemberLimit(plan, currentCount)` is exported from this file.

### 2.2 Signup / Login Flow

**File**: `apps/api/src/routes/auth.ts`

#### Signup — `POST /auth/signup` (lines 40–106)

Request schema (lines 15–19):
```typescript
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  teamName: z.string().min(1).max(100),
})
```

Full data flow:
1. Validate with Zod.
2. Check for existing `User` by email — throw `409 CONFLICT` if found.
3. Hash password with bcrypt (12 rounds).
4. Generate a unique team slug (slugify name; append `-1`, `-2`, … on conflict).
5. Atomic transaction (lines 63–82): create `User`, create `Team` (plan=`free`, trialEndsAt=14 days), create `TeamMember` (role=`owner`).
6. Issue JWT access token (15-minute TTL, payload `{ userId, teamId }`) and refresh token (30-day TTL, payload `{ userId, teamId, type: 'refresh' }`).
7. Respond HTTP 201 with both tokens, plus user and team objects.

#### Login — `POST /auth/login` (lines 109–159)

1. Validate email + password.
2. Find `User` by email.
3. Verify password via `bcrypt.compare`.
4. Load "primary" team membership: query `TeamMember` ordered by role ascending (owner sorts first), then `joinedAt` ascending. Includes related `Team`.
5. Issue access + refresh tokens.
6. Respond HTTP 200.

#### Refresh — `POST /auth/refresh` (lines 162–203)

Uses Redis blocklist (`blocklist:{token}`) to invalidate refresh tokens on logout. Issues a new access token; does not rotate the refresh token.

### 2.3 Frontend Auth Integration

**File**: `apps/web/src/lib/auth.ts`

Uses NextAuth.js with JWT strategy (maxAge 30 days). Session stores `user.id`, `user.email`, `teamId`, `accessToken`. The signup page (`apps/web/src/app/(auth)/signup/page.tsx`) calls `POST /auth/register` via the API proxy — note: the backend exposes `/auth/signup`.

**API proxy**: `apps/web/src/app/api/[...path]/route.ts` forwards all `/api/*` requests to `API_INTERNAL_URL` with the `Authorization: Bearer {accessToken}` header if a session exists.

### 2.4 Settings Area Structure

**Layout**: `apps/web/src/app/(dashboard)/layout.tsx` — fixed 240px left sidebar, 64px top header.

**Existing settings pages**:
- `apps/web/src/app/(dashboard)/settings/billing/page.tsx` — plan info, usage gauges, upgrade buttons; calls `GET /billing` and `POST /billing/portal`.
- `apps/web/src/app/(dashboard)/settings/integrations/page.tsx` — list/create/delete alert integrations (Slack, PagerDuty, Webhook, Email); calls `GET /integrations`, `POST /integrations`, `DELETE /integrations/:id`.

No `/dashboard/settings/team` or `/dashboard/settings/members` page exists.

---

## 3. Patterns to Follow

### 3.1 Token Generation

**File**: `packages/shared/src/utils/tokens.ts`

- Raw token: `crypto.randomBytes(32).toString('hex')` — 64 hex chars.
- Store the **hash** (`crypto.createHash('sha256')`) in the database; send the raw token to the user.
- Compare with `crypto.timingSafeEqual` to prevent timing attacks.

`generatePingToken()` follows the same pattern and is actively used: `apps/api/src/services/monitors.ts` line 124 calls it during monitor creation; the raw token is stored in `Monitor.pingToken` and used by the public `GET /ping/:token` endpoint (`apps/api/src/routes/checkins.ts` lines 28–46).

### 3.2 API Route Pattern

Anatomy of a complete CRUD resource (monitors as reference):

| Layer | File |
|---|---|
| Route plugin | `apps/api/src/routes/monitors.ts` |
| Service / business logic | `apps/api/src/services/monitors.ts` |
| Shared types + schemas | `packages/shared/src/types/` and `types/api.ts` |

**Route plugin skeleton** (`apps/api/src/routes/monitors.ts` lines 19–30):
```typescript
async function monitorsPlugin(fastify: FastifyInstance): Promise<void> {
  const preHandler = [authenticate, rateLimitApi]

  fastify.post('/monitors', { preHandler }, async (request, reply) => {
    const parsed = CreateMonitorSchema.safeParse(request.body)
    if (!parsed.success) {
      const msg = parsed.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ')
      throw new AppError('VALIDATION_ERROR', msg, 400)
    }
    const monitor = await createMonitor(request.team.id, parsed.data)
    return reply.status(201).send({ data: monitor })
  })
}

export default fp(monitorsPlugin, { name: 'monitors-routes' })
```

**Service function pattern** (`apps/api/src/services/monitors.ts` lines 104–139):
- Accept `teamId` as the first argument (multi-tenancy scope).
- Enforce plan limits before writing.
- Call `prisma.<model>.create()` — never raw SQL.
- Return a mapped response type (never a raw Prisma object).

**Response mapper** (`apps/api/src/services/monitors.ts` lines 42–57):
```typescript
function mapMonitor(monitor: Monitor): MonitorResponse {
  return {
    id: monitor.id,
    teamId: monitor.teamId,
    // ...all fields
    createdAt: monitor.createdAt.toISOString(),
    updatedAt: monitor.updatedAt.toISOString(),
  }
}
```

### 3.3 Prisma Model Conventions

From `packages/db/prisma/schema.prisma`:

- **Primary keys**: `@id @default(cuid())`
- **Unique tokens**: `@unique` constraint
- **Foreign keys**: always backed by `@@index`
- **Composite PKs** (join tables): `@@id([userId, teamId])`
- **Cascading deletes**: `onDelete: Cascade` on all FK relations
- **Timestamps**: `@default(now())` for creation, `@updatedAt` for updates
- **Roles/enums**: stored as plain `String`, validated in application code (no Prisma enums used in this codebase)

Example (Monitor model, lines 51–73):
```prisma
model Monitor {
  id            String    @id @default(cuid())
  teamId        String
  pingToken     String    @unique @default(cuid())
  status        String    @default("active")
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([teamId])
  @@index([teamId, status])
  @@index([pingToken])
}
```

### 3.4 Shared Types Conventions

**Directory**: `packages/shared/src/`

Structure:
```
types/
  team.ts        — User, Team, TeamMember interfaces and role types
  monitor.ts     — Monitor, Checkin, Alert interfaces
  api.ts         — Zod schemas + inferred TS types for request/response shapes
utils/
  tokens.ts      — generatePingToken, generateInviteToken, hashToken, safeCompare
errors.ts        — AppError class, ERROR_CODES constants
queues.ts        — QUEUES constant, job data interfaces
plans.ts         — PLANS map, limit utilities
index.ts         — single re-export hub for all of the above
```

Pattern for a type + schema pair (`packages/shared/src/types/api.ts` lines 82–87):
```typescript
export const InviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member']).default('member'),
})
export type InviteMemberParams = z.infer<typeof InviteMemberSchema>
```

### 3.5 Email Sending Pattern

Templates live in `packages/emails/src/templates/`. Each exports a typed React component plus a static `.subject` function.

Rendering (`packages/emails/src/index.ts` lines 4–10):
```typescript
export async function renderEmail(component: ReactElement): Promise<{ html: string; text: string }> {
  const html = await render(component)
  const text = await render(component, { plainText: true })
  return { html, text }
}
```

Dispatch (from `apps/worker/src/processors/alert.ts` lines 237–267 — email alert processor):
```typescript
const { html, text } = await renderEmail(<AlertMissedEmail {...props} />)
await resend.emails.send({
  from: 'alerts@cronpilot.io',
  to: config.address,
  subject,
  html,
  text,
})
```

### 3.6 Background Job Pattern

Queue names in `packages/shared/src/queues.ts`:
```typescript
export const QUEUES = {
  CHECK_WINDOW: 'check-window',
  ALERT: 'alert',
  // ...
} as const
```

Job data typed as interfaces in the same file. Processors in `apps/worker/src/processors/` receive a `Job<TData>` argument, log with a child logger keyed by `jobId`/`monitorId`/`teamId`, check for missing records before processing, and do not re-throw on per-integration failures.

### 3.7 Error Handling

`AppError` (`packages/shared/src/errors.ts` lines 1–14):
```typescript
export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
  )
}
```

The global error handler in `apps/api/src/lib/errors.ts` maps `AppError` → `{ error: { code, message } }` with the given status, Zod errors → `400 VALIDATION_ERROR`, Prisma `P2002` → `409 CONFLICT`, Prisma `P2025` → `404 NOT_FOUND`.

---

## Code References

| File | Lines | What |
|---|---|---|
| `apps/api/src/routes/teams.ts` | 106–156 | `POST /teams/invite` endpoint |
| `apps/api/src/routes/teams.ts` | 159–174 | `GET /teams/members` endpoint |
| `apps/api/src/routes/teams.ts` | 177–214 | `PATCH /teams/members/:userId` endpoint |
| `apps/api/src/routes/teams.ts` | 217–255 | `DELETE /teams/members/:userId` endpoint |
| `apps/api/src/routes/teams.ts` | 19–22 | `InviteMemberSchema` inline definition |
| `apps/api/src/routes/auth.ts` | 40–106 | Signup flow |
| `apps/api/src/routes/auth.ts` | 109–159 | Login flow |
| `apps/api/src/routes/auth.ts` | 162–203 | Token refresh flow |
| `apps/api/src/hooks/authenticate.ts` | 32–81 | `authenticate` pre-handler |
| `apps/api/src/hooks/rate-limit.ts` | 63–70 | `rateLimitApi` pre-handler |
| `apps/api/src/services/monitors.ts` | 104–139 | `createMonitor` service (pattern reference) |
| `apps/api/src/services/monitors.ts` | 42–57 | `mapMonitor` response mapper (pattern reference) |
| `apps/api/src/routes/monitors.ts` | 19–30 | Route plugin skeleton (pattern reference) |
| `apps/api/src/routes/checkins.ts` | 28–46 | Token-based public endpoint (ping flow) |
| `apps/api/src/lib/errors.ts` | 7–93 | Global error handler |
| `apps/worker/src/processors/alert.ts` | 237–267 | Email dispatch via Resend (pattern reference) |
| `packages/db/prisma/schema.prisma` | 10–24 | `Team` model |
| `packages/db/prisma/schema.prisma` | 26–35 | `User` model |
| `packages/db/prisma/schema.prisma` | 37–49 | `TeamMember` model |
| `packages/db/prisma/schema.prisma` | 51–73 | `Monitor` model (pattern reference) |
| `packages/shared/src/types/team.ts` | 1–25 | `TeamRole`, `Team`, `TeamMember` types |
| `packages/shared/src/types/api.ts` | 82–87 | `InviteMemberSchema` + `InviteMemberParams` |
| `packages/shared/src/utils/tokens.ts` | 8–39 | `generateInviteToken`, `hashToken`, `safeCompare` |
| `packages/shared/src/errors.ts` | 1–35 | `AppError`, `ERROR_CODES` |
| `packages/shared/src/queues.ts` | 1–45 | `QUEUES`, job data interfaces |
| `packages/shared/src/plans.ts` | — | `PLANS` map, `isWithinTeamMemberLimit` |
| `packages/emails/src/templates/invite.tsx` | 1–201 | `InviteEmail` template + `InviteEmailProps` |
| `packages/emails/src/index.ts` | 4–10 | `renderEmail()` helper |
| `packages/emails/src/index.ts` | 25–26 | `InviteEmail` export |
| `packages/shared/src/index.ts` | 104–110 | Token utility re-exports |
| `apps/web/src/lib/auth.ts` | — | NextAuth configuration |
| `apps/web/src/app/(auth)/signup/page.tsx` | — | Signup form |
| `apps/web/src/app/api/[...path]/route.ts` | — | API proxy |
| `apps/web/src/app/(dashboard)/layout.tsx` | 1–53 | Dashboard layout + sidebar nav |
| `apps/web/src/app/(dashboard)/settings/billing/page.tsx` | — | Billing settings page |
| `apps/web/src/app/(dashboard)/settings/integrations/page.tsx` | — | Integrations settings page |
| `apps/web/src/components/shared/nav.tsx` | 14–30 | Navigation items |

---

## Open Questions

1. **`TeamInvite` model fields**: The endpoint stores `teamId`, `email`, `role`, `invitedByUserId`, `expiresAt`. It does not store a token column — but `generateInviteToken()` exists in shared utils and is not called anywhere yet. Should the token be stored as `tokenHash` (hashed SHA-256) with the raw token sent by email?

2. **Accept flow entrypoint**: No `/teams/invites/:token/accept` endpoint exists. Should accepting an invitation work for both new users (creating an account simultaneously) and existing users (adding a `TeamMember` row)? The current signup flow always creates a new team — how should it be modified for invite acceptance?

3. **Web app route for `/auth/register`**: The signup page calls `POST /auth/register` but the API only exposes `POST /auth/signup`. Is this an existing mismatch, or is the proxy configured to rewrite the path?

4. **Plan limits at invite time**: `isWithinTeamMemberLimit` exists but the invite endpoint does not call it. Should the check happen when the invite is created, when it is accepted, or both?

5. **Pending invite list**: No `GET /teams/invites` endpoint or UI exists. Should team admins be able to see and revoke pending invitations?

6. **Invite for existing users vs. new users**: The endpoint already distinguishes between known and unknown email addresses (lines 126–134) but treats them identically in the `teamInvite.create()` call. Should existing users receive a different email (a "join team" link vs. a "sign up" link)?

7. **Owner cannot be invited**: The `InviteMemberSchema` only allows `admin` or `member` roles — `owner` is intentionally excluded. Is ownership transfer handled anywhere, or is the original owner permanent?

8. **`stripeSubscriptionId` reference**: API billing code references `stripeSubscriptionId` but only `stripeCustomerId` exists in the schema. Unrelated to invites but noted as an existing inconsistency.
