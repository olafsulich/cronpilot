# Spec: Monitor Pause / Resume

Add the ability to pause a monitor (suppress all check-window evaluation and alerts) and resume it later. The DB already supports `Monitor.status = "paused"` — we need the API, the worker behavior, and the UI.

## Goal

A team admin can pause a noisy or temporarily-disabled monitor without deleting it. While paused, no alerts fire. Resuming returns it to normal evaluation.

## User-visible behavior

- "Pause" button on the monitor detail page. When clicked, the monitor's status flips to `paused` and a confirmation toast appears.
- Paused monitors render with a muted/grey state in the dashboard list.
- When paused, no missed-run or failed-check alerts are created — even if check-ins are late or absent.
- Pings to `/ping/:token` for paused monitors are still **accepted** and stored as check-ins (so customers see continuity once they resume), but they do not resolve open alerts or affect health computation.
- "Resume" button on a paused monitor flips status back to `active`. The next check-window evaluation behaves normally.

## Files in scope

### Modify

- `apps/api/src/routes/monitors.ts` — add `POST /monitors/:id/pause` and `POST /monitors/:id/resume`. Both require team membership; both update `Monitor.status` and return the updated monitor.
- `apps/worker/src/processors/check-window.ts` — skip evaluation entirely when `monitor.status === "paused"`.
- `apps/api/src/routes/checkins.ts` (or wherever `/ping/:token` lives) — still accept the ping and persist the `Checkin`, but do not trigger alert resolution for paused monitors.
- `apps/web/src/app/(dashboard)/monitors/[id]/page.tsx` (or the equivalent detail page) — add the Pause/Resume button + confirmation toast.
- `apps/web/src/app/(dashboard)/monitors/page.tsx` (or the equivalent list page) — render paused monitors in muted state.

### Create

- Tests:
  - `apps/api/src/routes/__tests__/monitors.pause.test.ts` — integration test: pause, resume, verify status transitions and authorization.
  - `apps/worker/src/processors/__tests__/check-window.paused.test.ts` — unit test: paused monitor produces no alerts even with overdue check-ins.
  - `apps/web/src/test/monitor-pause-button.test.tsx` — unit test: button calls API client, shows toast, updates UI.

## API contract

```
POST /monitors/:id/pause     → 200 { id, status: "paused", ... }
POST /monitors/:id/resume    → 200 { id, status: "active", ... }
```

- Both require auth (JWT) and team membership of the monitor's team.
- Idempotent: pausing an already-paused monitor returns 200 with the current state, not an error.
- Invalid status values are rejected by the existing route's Zod schema (no new statuses introduced).

## Worker behavior

In `check-window.ts`, the very first check inside the loop:

```ts
if (monitor.status === "paused") return;  // do not evaluate
```

This must run **before** any alert-creation logic.

## Out of scope

- Scheduled pause / auto-resume after N hours.
- Bulk pause across multiple monitors.
- Pausing at the team level.
- Audit log of who paused what (separate feature).

## Test requirements

- API: pause + resume happy path, idempotency, 403 for non-team-member, 404 for unknown monitor.
- Worker: paused monitor with stale `lastCheckinAt` produces no `Alert` row.
- Web: button toggles label between Pause/Resume based on monitor state, disables during request.

## Boundary — do NOT touch

- `apps/api/src/routes/integrations.ts` — out of scope.
- `apps/worker/src/processors/alert.ts` — out of scope.
- Anything under `apps/web/src/app/(dashboard)/integrations/` — out of scope.
- `packages/db/prisma/schema.prisma` — schema already supports `status: "paused"`; no migration needed.

If a change to one of these feels necessary, stop and surface it instead of editing.
