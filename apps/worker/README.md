# apps/worker

BullMQ-based background worker. Processes all async jobs: missed-run detection, alert dispatching, weekly digests, and data cleanup.

## Structure

```
src/
  worker.ts               # Worker startup, processor registration
  processors/
    check-window.ts       # Fires when an expected check-in window closes
    alert.ts              # Sends alert notifications (with deduplication)
    alert-resolve.ts      # Auto-resolves alerts when check-ins resume
    digest.ts             # Weekly summary emails to team owners
    cleanup.ts            # Prunes old check-in records (retention policy)
    trial-expiry.ts       # Sends trial ending warnings at T-3d, T-1d
  lib/
    redis.ts              # Shared Redis client
    logger.ts             # Pino logger
```

## Queue overview

All queue names are defined as constants in `packages/shared/src/queues.ts`.

| Queue | Triggered by | Processor |
|-------|-------------|-----------|
| `check-window` | API on each check-in | `check-window.ts` |
| `alert` | `check-window` processor | `alert.ts` |
| `alert-resolve` | API on check-in after alert | `alert-resolve.ts` |
| `digest` | BullMQ cron (Sundays 08:00 UTC) | `digest.ts` |
| `cleanup` | BullMQ cron (daily 03:00 UTC) | `cleanup.ts` |
| `trial-expiry` | Stripe webhook (trial created) | `trial-expiry.ts` |

## Missed-run detection logic

When a check-in arrives:
1. API calculates the next expected check-in window based on the monitor's cron expression + grace period
2. A `check-window` job is scheduled with a delay equal to that window close time
3. If the next check-in arrives before the job fires, the job is removed (via BullMQ job ID keyed to monitor ID)
4. If the job fires without a newer check-in, it creates an alert

This means each monitor has at most one pending `check-window` job at any time. The job ID pattern is `check-window:${monitorId}`.

## Alert deduplication

`alert.ts` checks if there's already an open (unresolved) alert for the monitor before creating a new one. If so, it increments the `failureCount` and re-notifies based on the monitor's escalation policy (e.g. notify again after 3 consecutive failures).

## Env vars

```
REDIS_URL=
DATABASE_URL=
RESEND_API_KEY=
APP_URL=            # used in email/Slack links
```
