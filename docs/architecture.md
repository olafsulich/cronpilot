# Architecture

## System overview

```
                        ┌─────────────────────────────────────┐
                        │           Customer's server          │
                        │   */5 * * * * curl cronpilot.io/ping │
                        └────────────────┬────────────────────┘
                                         │ HTTP ping
                                         ▼
┌───────────┐   REST   ┌─────────────────────────────────────┐
│  apps/web │ ◄──────► │              apps/api                │
│ (Next.js) │          │  - auth, monitors CRUD              │
└───────────┘          │  - check-in processing              │
                        │  - Stripe billing                   │
                        └──────────┬──────────────────────────┘
                                   │ enqueue jobs
                                   ▼
                        ┌─────────────────────────────────────┐
                        │           Redis (BullMQ)             │
                        └──────────┬──────────────────────────┘
                                   │ dequeue
                                   ▼
                        ┌─────────────────────────────────────┐
                        │           apps/worker                │
                        │  - missed-run detection             │
                        │  - alert dispatch                   │
                        │  - digests, cleanup                 │
                        └──────────┬──────────────────────────┘
                                   │
                        ┌──────────┴──────────────────────────┐
                        │         Notification channels        │
                        │  Slack · PagerDuty · Email · Webhook │
                        └─────────────────────────────────────┘
```

## Multi-tenancy

All customer data is scoped to a `Team`. Every query that touches customer data includes a `teamId` filter — this is enforced by convention (and linting rules are planned). There is no row-level security at the database layer currently; the API layer owns isolation.

## Check-in flow (happy path)

1. Customer's cron job fires, pings `GET https://api.cronpilot.io/ping/<token>`
2. API validates token, resolves `Monitor`
3. `Checkin` record created
4. Any pending `check-window` BullMQ job for this monitor is removed
5. Next `check-window` job scheduled: delay = next expected window close time (cron next run + grace period)
6. If monitor had an open `Alert`, an `alert-resolve` job is queued

## Check-in flow (missed run)

1. `check-window` job fires (no new check-in arrived in time)
2. Worker processor confirms no newer check-in exists (guard against race)
3. `Alert` record created (type: `missed`, status: `open`)
4. `alert` job queued with the alert ID
5. `alert` processor looks up `AlertRule`s for this monitor
6. Dispatches notifications to configured integrations
7. Schedules follow-up `check-window` job for next expected window

## Alert deduplication

If an alert is already `open` for a monitor, a new one is not created. Instead, the existing alert's `failureCount` is incremented. Re-notification happens based on the `AlertRule.notifyAfter` threshold (e.g., notify again every 3 failures).

## Scaling considerations

- The worker is currently single-replica. BullMQ supports multiple concurrent workers; horizontal scaling requires no code changes.
- Check-in endpoint is stateless and can be scaled independently from the rest of the API (planned: extract to a separate service).
- PostgreSQL connection pooling via PgBouncer (Supabase) is in place. Connection limits are not a current concern at this scale.
