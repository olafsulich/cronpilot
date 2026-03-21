# Plan: Team Invitation System

## Overview

This plan covers the full implementation of a team invitation system for Cronpilot. The system allows team owners and admins to invite users by email, generating a secure single-use token delivered via email. Invited users can accept via a dedicated frontend page whether they are existing users (authenticated accept flow) or new users (signup with invite token). The implementation spans the database schema, shared types, API services and routes, email worker, and frontend pages.

---

## Current State Analysis

**What exists:**

- `apps/api/src/routes/teams.ts` lines 106–156: A `POST /teams/invite` endpoint exists, protected by `[authenticate, rateLimitApi]`, restricted to `owner` or `admin` roles. It validates input with a locally-defined `InviteMemberSchema` (lines 19–22) that duplicates the identical schema already present in `packages/shared/src/types/api.ts` lines 82–87. It checks for existing team membership and then calls `prisma.teamInvite.create()` — but the `TeamInvite` model does not exist in the schema. No token is generated, no email is sent (a comment at line 147 notes "in production this would enqueue an email job").

- `packages/emails/src/templates/invite.tsx`: A fully implemented React Email template accepting `{ inviterName, teamName, inviteUrl, expiresAt }`, with a `subject()` static method. Exported from `packages/emails/src/index.ts` lines 25–26.

- `packages/shared/src/utils/tokens.ts`: `generateInviteToken()` (64-char hex via `crypto.randomBytes(32)`), `hashToken()` (SHA-256 hex), and `safeCompare()` (timing-safe comparison). Re-exported from `packages/shared/src/index.ts` lines 104–110.

- `packages/shared/src/plans.ts`: `isWithinTeamMemberLimit(plan, currentCount)` exported with limits: free=1, pro=5, team=25, enterprise=Infinity.

- `apps/worker/src/processors/cleanup.ts`: Existing cleanup processor on the `CLEANUP` queue — the right place to add expired invite deletion.

**What is missing:**

- `TeamInvite` Prisma model
- `INVITE_EMAIL` queue constant and `InviteEmailJobData` type
- `InviteResponse` and `InvitePreviewResponse` shared types
- `apps/api/src/services/invites.ts` service
- `GET /teams/invites` and `DELETE /teams/invites/:id` endpoints
- `apps/api/src/routes/invites.ts` with public token-lookup and authenticated accept endpoints
- Invite token parameter on `POST /auth/signup`
- `apps/worker/src/processors/invite-email.ts` processor
- `apps/web/src/app/(dashboard)/settings/team/page.tsx`
- `apps/web/src/app/(auth)/invite/[token]/page.tsx`
- "Team" entry in the dashboard nav

---

## Desired End State

- A team owner or admin submits an email address and role via `POST /teams/invite`. The API creates a `TeamInvite` record with a hashed token and enqueues an `INVITE_EMAIL` job.
- The worker sends an email via Resend containing a tokenized URL. Existing users receive `/invite/[token]`; new users receive `/auth/signup?invite=[token]`.
- An existing user visits `/invite/[token]`, sees invite details fetched via `GET /invites/:token` (public), and clicks "Accept" which calls `POST /invites/:token/accept` (authenticated).
- A new user visits `/auth/signup?invite=[token]`, signs up, and the `POST /auth/signup` handler automatically processes the invite after creating their account.
- Team owners and admins can view pending invites via `GET /teams/invites` and revoke them via `DELETE /teams/invites/:id`.
- Expired invites are cleaned up by the existing cleanup processor.

**End-to-end verification:** Create an invite → worker sends email → visit invite URL → accept (as existing user) → `TeamMember` row exists, `TeamInvite` row is deleted. Repeat signup path for new user.

---

## What We're NOT Doing

- Owner transfer
- Modifying the login page's `callbackUrl` handling beyond confirming NextAuth's `returnTo` already works
- Fixing the `/auth/register` vs `/auth/signup` naming inconsistency
- Any changes to how JWTs are issued or how `request.team` is set by the `authenticate` hook

---

## Implementation Phases

### Phase 1: Schema

**Overview:** Add the `TeamInvite` model and wire up relations on `Team` and `User`.

### Changes Required

**`packages/db/prisma/schema.prisma`**

1. After the `TeamMember` model (line 49), add:

```prisma
model TeamInvite {
  id              String   @id @default(cuid())
  teamId          String
  email           String
  role            String   @default("member")
  invitedByUserId String
  tokenHash       String   @unique
  expiresAt       DateTime
  createdAt       DateTime @default(now())

  team      Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
  invitedBy User @relation(fields: [invitedByUserId], references: [id], onDelete: Cascade)

  @@index([teamId])
  @@index([email])
}
```

2. `Team` model (lines 10–24): append `invites TeamInvite[]` alongside `members TeamMember[]`.

3. `User` model (lines 26–35): append `sentInvites TeamInvite[]` alongside `teams TeamMember[]`.

### Success Criteria

#### Automated Verification

- [ ] `pnpm --filter @cronpilot/db db:migrate` — migration applies; new migration file appears in `packages/db/prisma/migrations/`
- [ ] `pnpm typecheck` — Prisma-generated client types include `TeamInvite`, `Team.invites`, and `User.sentInvites`
- [ ] `pnpm test`

#### Manual Verification

- [ ] Inspect the generated Prisma client to confirm `prisma.teamInvite` is available

**Pause here for verification before proceeding to the next phase.**

---

### Phase 2: Shared Types

**Overview:** Add `InviteResponse`, `InvitePreviewResponse`, the `INVITE_EMAIL` queue constant and `InviteEmailJobData` type. Fix the duplicate schema in the route file.

### Changes Required

**`packages/shared/src/queues.ts`**

- Add `INVITE_EMAIL: 'invite-email'` to the `QUEUES` const alongside the existing entries.
- Add the `InviteEmailJobData` interface:

```typescript
export interface InviteEmailJobData {
  inviteId: string
  rawToken: string
  inviterName: string
  teamName: string
  inviteeEmail: string
  inviteUrl: string
  expiresAt: string // ISO 8601
}
```

**`packages/shared/src/types/api.ts`** — after line 87 (end of `InviteMemberParams`), add:

```typescript
export interface InviteResponse {
  id: string
  email: string
  role: string
  expiresAt: string
  createdAt: string
}

export interface InvitePreviewResponse {
  teamName: string
  inviterName: string
  email: string
  role: string
  expiresAt: string
}
```

**`packages/shared/src/index.ts`** — ensure `InviteResponse` and `InvitePreviewResponse` are re-exported from the api types re-export line (around line 44). `InviteEmailJobData` is already exported from `queues.ts`; confirm it is included in the queue re-exports (around lines 104–110).

**`apps/api/src/routes/teams.ts` lines 19–22** — remove the inline `InviteMemberSchema` definition and replace it with an import:

```typescript
import { InviteMemberSchema } from '@cronpilot/shared'
```

### Success Criteria

#### Automated Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm test`

#### Manual Verification

- [ ] `InviteResponse`, `InvitePreviewResponse`, `InviteEmailJobData`, and `QUEUES.INVITE_EMAIL` are importable from `@cronpilot/shared`

**Pause here for verification before proceeding to the next phase.**

---

### Phase 3: API Endpoints

**Overview:** Implement the invite service and all API endpoints — fixing the existing `POST /teams/invite`, adding list/revoke endpoints, the public token-preview endpoint, the authenticated accept endpoint, and the optional invite token on signup.

### Changes Required

#### New file: `apps/api/src/services/invites.ts`

Follow the pattern in `apps/api/src/services/monitors.ts`. Exports:

**`createInvite(teamId, invitedByUserId, data: InviteMemberParams): Promise<InviteResponse>`**

1. Load team (for plan). Count current `TeamMember` rows + pending non-expired `TeamInvite` rows for `teamId`. If combined count is at or above the limit, throw `new AppError('PLAN_LIMIT_EXCEEDED', '...', 403)`.
2. Check for an existing non-expired `TeamInvite` where `email === data.email && teamId === teamId && expiresAt > new Date()` — throw `new AppError('CONFLICT', 'An active invite already exists for this email', 409)` if found.
3. `generateInviteToken()` → `rawToken`; `hashToken(rawToken)` → `tokenHash`.
4. `prisma.teamInvite.create({ data: { teamId, email, role, invitedByUserId, tokenHash, expiresAt: addDays(new Date(), 7) } })`.
5. Determine `inviteUrl`: if a `User` exists with `data.email`, use `${config.appBaseUrl}/invite/${rawToken}`; otherwise use `${config.appBaseUrl}/auth/signup?invite=${rawToken}`.
6. Enqueue `INVITE_EMAIL` job on `QUEUES.INVITE_EMAIL` with full `InviteEmailJobData` payload (including `rawToken`).
7. Return `mapInvite(invite)`.

**`listInvites(teamId): Promise<InviteResponse[]>`** — `findMany` where `teamId` matches and `expiresAt > new Date()`, ordered by `createdAt desc`. Map each result.

**`revokeInvite(teamId, inviteId): Promise<void>`** — `deleteMany({ where: { id: inviteId, teamId } })`. If `count === 0`, throw `new AppError('NOT_FOUND', 'Invite not found', 404)`.

**`getInviteByToken(rawToken): Promise<InvitePreviewResponse>`** — hash token, `findUnique({ where: { tokenHash }, include: { team: true, invitedBy: true } })`. Throw `NOT_FOUND` if not found or expired. Map to `InvitePreviewResponse`.

**`acceptInvite(rawToken, userId, userEmail): Promise<void>`** — hash token, load invite with team. Throw `NOT_FOUND` if not found or expired. Verify `safeCompare(invite.email, userEmail)` — throw `new AppError('FORBIDDEN', '...', 403)` if mismatch. Recheck plan limit. In a transaction: create `TeamMember`, delete `TeamInvite`.

**Private `mapInvite(invite): InviteResponse`** — returns `{ id, email, role, expiresAt: invite.expiresAt.toISOString(), createdAt: invite.createdAt.toISOString() }`.

#### Modify `apps/api/src/routes/teams.ts`

- **Lines 137–145**: replace bare `prisma.teamInvite.create()` call with:

```typescript
const invite = await createInvite(request.team.id, request.user.userId, parsed.data)
return reply.status(201).send({ data: invite })
```

Remove the "in production this would enqueue an email job" comment at line 147.

- **After line 156**: add inside the same plugin function:

```typescript
fastify.get('/teams/invites', { preHandler }, async (request, reply) => {
  if (!['owner', 'admin'].includes(request.team.role)) {
    throw new AppError('FORBIDDEN', 'Only owners and admins can view invites', 403)
  }
  const invites = await listInvites(request.team.id)
  return reply.send({ data: invites })
})

fastify.delete('/teams/invites/:id', { preHandler }, async (request, reply) => {
  if (!['owner', 'admin'].includes(request.team.role)) {
    throw new AppError('FORBIDDEN', 'Only owners and admins can revoke invites', 403)
  }
  const { id } = request.params as { id: string }
  await revokeInvite(request.team.id, id)
  return reply.status(204).send()
})
```

#### New file: `apps/api/src/routes/invites.ts`

Follow the plugin pattern from `apps/api/src/routes/monitors.ts` lines 19–30:

```typescript
async function invitesPlugin(fastify: FastifyInstance): Promise<void> {
  fastify.get('/invites/:token', async (request, reply) => {
    const { token } = request.params as { token: string }
    const preview = await getInviteByToken(token)
    return reply.send({ data: preview })
  })

  fastify.post('/invites/:token/accept', { preHandler: [authenticate, rateLimitApi] }, async (request, reply) => {
    const { token } = request.params as { token: string }
    await acceptInvite(token, request.user.userId, request.user.email)
    return reply.status(200).send({ data: { accepted: true } })
  })
}
export default fp(invitesPlugin, { name: 'invites-routes' })
```

#### Modify `apps/api/src/routes/auth.ts`

In the signup handler (lines 40–106), add `inviteToken: z.string().optional()` to the Zod request body schema. After the main User + Team + TeamMember transaction, add:

```typescript
if (parsed.data.inviteToken) {
  const tokenHash = hashToken(parsed.data.inviteToken)
  const invite = await prisma.teamInvite.findUnique({
    where: { tokenHash },
    include: { team: true },
  })
  if (invite && invite.email === parsed.data.email && invite.expiresAt > new Date()) {
    await prisma.$transaction([
      prisma.teamMember.create({
        data: { userId: newUser.id, teamId: invite.teamId, role: invite.role },
      }),
      prisma.teamInvite.delete({ where: { id: invite.id } }),
    ])
  }
  // Silently ignore invalid/expired invite tokens — do not fail signup
}
```

#### Modify `apps/api/src/app.ts`

Register the invites plugin alongside the monitors and teams plugins:

```typescript
fastify.register(invitesPlugin)
```

### Success Criteria

#### Automated Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm test`

#### Manual Verification

- [ ] `POST /teams/invite` with valid session returns `201 { data: { id, email, role, expiresAt } }`
- [ ] `GET /teams/invites` returns the pending invite
- [ ] `GET /invites/:token` (no auth) returns invite preview
- [ ] `POST /invites/:token/accept` with valid session creates `TeamMember` and deletes `TeamInvite`
- [ ] `DELETE /teams/invites/:id` returns `204` and removes the invite

**Pause here for verification before proceeding to the next phase.**

---

### Phase 4: Email / Worker

**Overview:** Send the invitation email via Resend and clean up expired invites in the existing cleanup processor.

### Changes Required

#### New file: `apps/worker/src/processors/invite-email.ts`

Follow the pattern in `apps/worker/src/processors/alert.ts` lines 237–267:

```typescript
export async function processInviteEmail(job: Job<InviteEmailJobData>): Promise<void> {
  const { inviteId, inviterName, teamName, inviteeEmail, inviteUrl, expiresAt } = job.data

  // Bail out if the invite was revoked before the job ran
  const invite = await prisma.teamInvite.findUnique({ where: { id: inviteId } })
  if (!invite) return

  const props = { inviterName, teamName, inviteUrl, expiresAt: new Date(expiresAt) }
  const subject = InviteEmail.subject(props)
  const { html, text } = await renderEmail(<InviteEmail {...props} />)

  await resend.emails.send({
    from: 'invites@cronpilot.io',
    to: inviteeEmail,
    subject,
    html,
    text,
  })
}
```

#### Modify `apps/worker/src/index.ts`

Register a worker for `QUEUES.INVITE_EMAIL` pointing to `processInviteEmail`, alongside the existing processor registrations.

#### Modify `apps/worker/src/processors/cleanup.ts`

Add to the cleanup processor body:

```typescript
await prisma.teamInvite.deleteMany({
  where: { expiresAt: { lt: new Date() } },
})
```

### Success Criteria

#### Automated Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm test`

#### Manual Verification

- [ ] Trigger `POST /teams/invite` and observe the `invite-email` job in the queue
- [ ] Confirm the email arrives at the target inbox with the correct `inviteUrl`
- [ ] Trigger the cleanup job and confirm expired `TeamInvite` rows are deleted

**Pause here for verification before proceeding to the next phase.**

---

### Phase 5: Frontend

**Overview:** Add the team settings page, the invite acceptance page, the nav entry, and signup invite-token handling.

### Changes Required

#### New file: `apps/web/src/app/(dashboard)/settings/team/page.tsx`

Follow the structure of `apps/web/src/app/(dashboard)/settings/integrations/page.tsx`. Three sections:

1. **Current members** — `GET /api/teams/members` → table of name, email, role, joined date.
2. **Pending invites** — `GET /api/teams/invites` → list of email, role, expiry; "Revoke" button per row calls `DELETE /api/teams/invites/:id`.
3. **Invite form** — email input + role select + submit calling `POST /api/teams/invite`. On success, refresh pending invites list.

The existing API proxy at `apps/web/src/app/api/[...path]/route.ts` forwards all `/api/*` calls with the auth header — no proxy changes needed.

#### New file: `apps/web/src/app/(auth)/invite/[token]/page.tsx`

Server component that:

1. Calls `GET /invites/:token` (against `API_INTERNAL_URL`, unauthenticated) to fetch `InvitePreviewResponse`. Renders "Invite not found or expired" on 404.
2. If the user has an active session: renders invite details and an "Accept Invitation" button (client component) that calls `POST /api/invites/:token/accept` via the proxy.
3. If no session: renders invite details with two links:
   - "Log in to accept" → `/auth/login?returnTo=/invite/[token]`
   - "Create an account" → `/auth/signup?invite=[token]`

#### Modify `apps/web/src/components/shared/nav.tsx` lines 14–30

Add a "Team" nav item pointing to `/settings/team`, following the same structure as the existing Monitors, Alerts, and Integrations items.

#### Modify `apps/web/src/app/(auth)/signup/page.tsx`

- Read the `invite` query parameter from `useSearchParams` or page props.
- Include `inviteToken: invite ?? undefined` in the `POST /api/auth/signup` request body.
- After successful signup, if `invite` was present redirect to `/invite/[invite]`; otherwise redirect to the dashboard.

### Success Criteria

#### Automated Verification

- [ ] `pnpm typecheck`
- [ ] `pnpm test`

#### Manual Verification

- [ ] `/settings/team` renders members, pending invites, and invite form; invite submits and appears in the list; revoke removes it
- [ ] `/invite/[token]` while logged in: shows invite details and "Accept" creates `TeamMember`, deletes `TeamInvite`; second visit returns "not found"
- [ ] `/auth/signup?invite=[token]`: complete signup → invited team membership created, `TeamInvite` deleted
- [ ] `/invite/[token]` while logged out: "Log in to accept" and "Create an account" links present with token in URLs
- [ ] "Team" appears in the dashboard sidebar nav

**Pause here for verification before proceeding to the next phase.**

---

## Testing Strategy

### Unit tests (colocated as `*.test.ts`)

`apps/api/src/services/invites.test.ts` — test each function with a mocked Prisma client:

- `createInvite`: plan limit enforcement (combined member + pending count triggers 403), duplicate active invite detection (409), token generation and hashing, correct `InviteEmailJobData` payload shape.
- `listInvites`: filters out expired invites, returns only records matching `teamId`.
- `revokeInvite`: throws `NOT_FOUND` when `deleteMany` returns `count === 0`; `teamId` scope prevents cross-team deletion.
- `getInviteByToken`: returns 404 for expired tokens; returns 404 for unknown tokens; returns correct `InvitePreviewResponse` shape.
- `acceptInvite`: rejects mismatched email (403); rejects expired token (404); rechecks plan limit (403); deletes invite after creating member; uses `safeCompare` for email comparison.

### Integration tests (`apps/api/tests/`)

- **Existing user lifecycle**: `POST /teams/invite` → `GET /invites/:token` → `POST /invites/:token/accept` → verify `TeamMember` created and `TeamInvite` deleted.
- **New user lifecycle**: `POST /teams/invite` → `POST /auth/signup` with `inviteToken` → verify `TeamMember` created and `TeamInvite` deleted.
- **Expired token**: create invite, backdate `expiresAt`, attempt `GET /invites/:token` → 404; attempt accept → 404.
- **Revocation**: `POST /teams/invite` → `DELETE /teams/invites/:id` → attempt accept → 404.
- **Duplicate invite**: `POST /teams/invite` twice with same email → second returns 409.
- **Plan limit at create**: fill team to plan limit, attempt `POST /teams/invite` → 403.
- **Plan limit at accept**: fill team to limit between create and accept → 403 on accept.
- **Wrong-email accept**: authenticate as user B, attempt to accept invite addressed to user A → 403.
- **Concurrent accepts**: two simultaneous `POST /invites/:token/accept` — only one succeeds; second returns 404.
- **RBAC**: `member` role cannot call `GET /teams/invites` or `DELETE /teams/invites/:id` → 403.

---

## Security Considerations

**Token entropy and storage.** `generateInviteToken()` produces 256 bits of entropy (32 bytes). Only the SHA-256 hash is stored in the database (`tokenHash @unique`). The raw token is transmitted only in the email and never logged.

**Email ownership verification.** `acceptInvite` uses `safeCompare(invite.email, userEmail)` (timing-safe) to confirm the authenticated user's email matches the invite recipient. This prevents an authenticated user from claiming an invite addressed to another address.

**Rate limiting.** `rateLimitApi` is applied to `POST /teams/invite`, `GET /teams/invites`, `DELETE /teams/invites/:id`, and `POST /invites/:token/accept` via the shared `preHandler` array. The public `GET /invites/:token` performs no mutation.

**Multi-tenancy.** Every service query is scoped to `teamId`. In particular, `revokeInvite` uses `deleteMany({ where: { id, teamId } })` — supplying only the `id` would allow cross-team deletion via ID guessing.

**Single-use tokens.** `acceptInvite` deletes the `TeamInvite` row in the same transaction as creating `TeamMember`. There is no window in which a token can be accepted twice; the second attempt finds no matching `tokenHash`.

**7-day expiry.** Set at creation; checked at preview and at accept; hard-deleted by the cleanup processor. This prevents database accumulation and limits the exposure window if an invite email is forwarded.

**Invite token in signup.** An invalid or expired `inviteToken` during signup is silently ignored rather than failing the request. This prevents oracle-style enumeration of valid tokens while preserving good UX.

**Plan limits.** Combined member + pending invite count is checked at creation (UX feedback) and at acceptance (safety net against race conditions).
