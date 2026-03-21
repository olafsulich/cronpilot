# packages/shared

TypeScript types, constants, and utility functions shared across all apps. If something is used in more than one app, it lives here.

## Structure

```
src/
  types/
    monitor.ts            # Monitor, Checkin, Alert types + enums
    team.ts               # Team, User, TeamMember types
    integration.ts        # Integration types + config shapes
    api.ts                # API request/response envelope types
  queues.ts               # Queue name constants
  plans.ts                # Plan definitions (limits, features)
  errors.ts               # AppError class + error codes
  utils/
    cron.ts               # Cron expression helpers (next run, human label)
    dates.ts              # formatDate, formatDuration, relativeTime
    tokens.ts             # Token generation/validation helpers
```

## Key exports

### Types

```ts
// All API responses are wrapped:
type ApiResponse<T> = { data: T }
type ApiError = { error: { code: string; message: string } }

// Monitor status reflects real-time state:
type MonitorStatus = 'healthy' | 'late' | 'down' | 'paused' | 'new'
// (computed from lastCheckinAt + schedule, not stored in DB)
```

### Plans

```ts
// plans.ts
export const PLANS = {
  free:  { monitorsLimit: 3,   checkinRetention: 7,   teamMembers: 1 },
  pro:   { monitorsLimit: 20,  checkinRetention: 90,  teamMembers: 5 },
  team:  { monitorsLimit: 100, checkinRetention: 365, teamMembers: 25 },
  enterprise: { monitorsLimit: Infinity, checkinRetention: 730, teamMembers: Infinity },
}
```

### Queue names

```ts
// queues.ts — import these constants, never hardcode queue names
export const QUEUES = {
  CHECK_WINDOW: 'check-window',
  ALERT: 'alert',
  ALERT_RESOLVE: 'alert-resolve',
  DIGEST: 'digest',
  CLEANUP: 'cleanup',
  TRIAL_EXPIRY: 'trial-expiry',
}
```

### AppError

```ts
// errors.ts
throw new AppError('MONITOR_NOT_FOUND', 'Monitor not found', 404)
// code is a machine-readable string, used by the frontend for i18n
```
