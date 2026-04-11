# API routes

Base URL: `http://localhost:3001` (dev). All authenticated routes require `Authorization: Bearer <accessToken>`.

Route files live in `apps/api/src/routes/`. Services (business logic) are in `apps/api/src/services/`.

## Auth (`routes/auth.ts`) — no auth required

| Method | Path | Description |
|---|---|---|
| `POST` | `/auth/signup` | Create user + team. Returns `accessToken` (15m) + `refreshToken` (30d). |
| `POST` | `/auth/login` | Returns tokens for existing user. |
| `POST` | `/auth/refresh` | Exchange refresh token for a new access token. |
| `POST` | `/auth/logout` | Revokes refresh token (adds to Redis blocklist). Requires auth. |

## Check-ins (`routes/checkins.ts`) — public

| Method | Path | Description |
|---|---|---|
| `GET` | `/ping/:token` | Record a check-in. Accepts `?duration`, `?status`, `?exit_code` query params. |
| `POST` | `/ping/:token` | Same as GET — accepts params in body or query. |
| `GET` | `/monitors/:monitorId/checkins` | List check-ins for a monitor. Requires auth. Paginated. |

## Monitors (`routes/monitors.ts`) — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/monitors` | List all monitors for the team. Paginated. |
| `POST` | `/monitors` | Create a monitor. Enforces plan's `monitorsLimit`. |
| `GET` | `/monitors/:id` | Get a single monitor. |
| `PATCH` | `/monitors/:id` | Update monitor fields. |
| `DELETE` | `/monitors/:id` | Delete monitor and cascade. |
| `POST` | `/monitors/:id/pause` | Set status to `paused`. |
| `POST` | `/monitors/:id/resume` | Set status to `active`. |

## Alerts (`routes/alerts.ts`) — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/alerts` | List alerts for the team. Filterable by status/type. |
| `GET` | `/alerts/:id` | Get a single alert. |
| `POST` | `/alerts/:id/resolve` | Manually resolve an open alert. |
| `POST` | `/alerts/:id/mute` | Mute an alert. |

## Integrations (`routes/integrations.ts`) — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/integrations` | List team integrations. Config is decrypted for display. |
| `POST` | `/integrations` | Create integration. Config encrypted with AES-256 before storage. |
| `DELETE` | `/integrations/:id` | Delete integration and cascade alert rules. |
| `POST` | `/integrations/:id/test` | Send a test notification. Returns `{ success, error }`. |

## Teams (`routes/teams.ts`) — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/teams/current` | Get current team info. |
| `PATCH` | `/teams/current` | Update team name/slug. Requires `owner` or `admin` role. |
| `POST` | `/teams/invite` | Invite a member by email (creates `TeamInvite`). Requires `owner` or `admin`. |
| `GET` | `/teams/members` | List team members with roles. |
| `PATCH` | `/teams/members/:userId` | Change a member's role. Requires `owner`. |
| `DELETE` | `/teams/members/:userId` | Remove a member. |

## Billing (`routes/billing.ts`) — auth required

| Method | Path | Description |
|---|---|---|
| `GET` | `/billing` | Get billing info (plan, Stripe subscription status). |
| `POST` | `/billing/checkout` | Create a Stripe Checkout session. Body: `{ priceId }`. |
| `POST` | `/billing/portal` | Create a Stripe Customer Portal session. |

## Webhooks

| Method | Path | Description |
|---|---|---|
| `POST` | `/webhooks/stripe` | Stripe webhook. Verifies signature using raw body. Handles subscription events. |

## Auth pattern

Access tokens expire in **15 minutes**. The `authenticate` hook (`apps/api/src/hooks/authenticate.ts`) verifies the JWT and attaches `request.user` and `request.team`. Rate limiting is applied via `@fastify/rate-limit` on all authenticated routes and separately (stricter) on `/ping/:token`.
