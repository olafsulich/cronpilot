# Worker queues

The worker (`apps/worker`) runs 6 BullMQ queues. Each queue has its own processor in `apps/worker/src/processors/`.

## Queues

| Queue | Processor | Triggered by | Concurrency |
|---|---|---|---|
| `check-window` | `processors/check-window.ts` | API after each check-in (delayed until grace period expires) | 5 |
| `alert` | `processors/alert.ts` | `check-window` processor when a miss is confirmed | 5 |
| `alert-resolve` | `processors/alert-resolve.ts` | API when a check-in arrives and an open alert exists | 5 |
| `digest` | `processors/digest.ts` | Recurring cron — Sundays 08:00 UTC | 1 |
| `cleanup` | `processors/cleanup.ts` | Recurring cron — daily 03:00 UTC | 1 |
| `trial-expiry` | `processors/trial-expiry.ts` | Recurring cron (scheduled externally) | 5 |

## Key behaviours

- **`check-window`**: Runs when the grace period expires for a monitor. Re-checks whether a check-in arrived in the meantime to guard against races. If still missing, creates an alert and enqueues an `alert` job.
- **`alert`**: Dispatches notifications to all integrations attached via alert rules. Respects `notifyAfter` deduplication — notifies on failure 1, then every Nth consecutive failure.
- **`alert-resolve`**: Sends recovery notifications when a check-in resumes. Marks the open alert as `resolved`.
- **`digest`**: Sends weekly summary emails to team owners via Resend.
- **`cleanup`**: Deletes check-ins older than the team's plan retention limit. Also prunes resolved alerts older than 90 days.
- **`trial-expiry`**: Sends warning emails 3 days and 1 day before a team's trial ends.

## Redis connections

BullMQ workers each require their own **blocking** Redis connection and cannot share the connection used by `Queue` instances. See `apps/worker/src/worker.ts` for how connections are managed.
