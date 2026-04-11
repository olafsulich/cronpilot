# Database schema

Schema file: `packages/db/prisma/schema.prisma`. ORM: Prisma. Database: PostgreSQL.

## Models

### Team
Central multi-tenant unit. All resources belong to a team.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `name` | `String` | Display name |
| `slug` | `String` | Unique URL-safe identifier |
| `plan` | `String` | `free` / `pro` / `team` / `enterprise` |
| `stripeCustomerId` | `String?` | Stripe customer |
| `trialEndsAt` | `DateTime?` | Set to 14 days after signup |
| `createdAt` | `DateTime` | |

### User
Email/password authentication. A user can belong to multiple teams.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `email` | `String` | Unique |
| `passwordHash` | `String` | bcrypt, 12 rounds |
| `createdAt` | `DateTime` | |

### TeamMember
Join table between `User` and `Team`.

| Field | Type | Notes |
|---|---|---|
| `userId` | `String` | FK → User |
| `teamId` | `String` | FK → Team |
| `role` | `String` | `owner` / `admin` / `member` |
| `joinedAt` | `DateTime` | |

### Monitor
A single cron job being monitored.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `teamId` | `String` | FK → Team |
| `name` | `String` | |
| `schedule` | `String` | Cron expression |
| `timezone` | `String` | Default `UTC` |
| `gracePeriod` | `Int` | Seconds after expected run before alerting (default 300) |
| `pingToken` | `String` | Unique token for the `/ping/:token` endpoint |
| `status` | `String` | DB status: `active` / `paused` |
| `lastCheckinAt` | `DateTime?` | Updated on every check-in |
| `createdAt` / `updatedAt` | `DateTime` | |

Computed status (not stored): `healthy` / `late` / `down` / `paused` / `new` — derived in `computeMonitorStatus()`.

### Checkin
A single ping received from a monitored job.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `monitorId` | `String` | FK → Monitor |
| `receivedAt` | `DateTime` | |
| `status` | `String` | `ok` (default) / `fail` |
| `duration` | `Int?` | Execution time in ms |
| `exitCode` | `Int?` | Process exit code |

### Alert
Created when a check-in window closes without a valid check-in.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `monitorId` | `String` | FK → Monitor |
| `type` | `String` | `missed` / `failed` |
| `status` | `String` | `open` (default) / `resolved` |
| `failureCount` | `Int` | Consecutive failures — used for deduplication |
| `openedAt` | `DateTime` | |
| `resolvedAt` | `DateTime?` | Set when a check-in resumes |

### Integration
A notification destination belonging to a team.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `teamId` | `String` | FK → Team |
| `type` | `String` | `slack` / `pagerduty` / `webhook` / `email` |
| `name` | `String` | Display name |
| `configEncrypted` | `String` | AES-256 encrypted JSON config |
| `createdAt` | `DateTime` | |

### AlertRule
Links a monitor to an integration. Controls when notifications fire.

| Field | Type | Notes |
|---|---|---|
| `id` | `String` (cuid) | PK |
| `monitorId` | `String` | FK → Monitor |
| `integrationId` | `String` | FK → Integration |
| `notifyAfter` | `Int` | Notify on failure 1, then every Nth (default 1 = every failure) |

Unique constraint: `(monitorId, integrationId)` — one rule per monitor-integration pair.

## Key relationships

```
Team
 ├── TeamMember[] → User
 ├── Monitor[]
 │    ├── Checkin[]
 │    ├── Alert[]
 │    └── AlertRule[] → Integration
 └── Integration[]
```

## Notes

- All cascading deletes are handled at the database level (`onDelete: Cascade`).
- Integration `configEncrypted` is encrypted/decrypted in `apps/api/src/lib/encryption.ts` and `apps/worker/src/lib/encryption.ts` using the shared `ENCRYPTION_KEY`.
- Check-in retention is enforced by the `cleanup` worker queue based on the team's plan.
