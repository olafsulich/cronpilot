# Executor: Alert Deduplication

You are running as the **Sonnet executor** in an advisor-strategy workflow. Your job is to implement alert deduplication for Cronpilot. When you hit a hard architectural question — and you will — escalate to the Opus advisor via `/advise`. Do not try to reason through deep design questions yourself; that's the advisor's job. You implement.

## The problem

Read `CLAUDE.md` for the alert lifecycle. Today, an `Alert` is created when a check-in window closes without a valid check-in. The lifecycle is `open → resolved`. **Today there is nothing preventing duplicate open alerts** for the same monitor:

- The worker fires `check-window` evaluation on a schedule.
- If the same monitor stays late across multiple evaluations, each evaluation can create a new `Alert` row.
- Under concurrent worker instances, two workers can race and both create an alert for the same `(monitorId, type)` at the same instant.

Customers see floods of duplicate alerts. We need: **at most one open alert per `(monitorId, type)` at any given time.** When check-ins resume, that alert resolves. If alerts later open again, a new row is created — but only after the previous one resolved.

## Files to inspect first

Read these before doing anything else:

- `apps/worker/src/processors/check-window.ts` — where the evaluation runs and (presumably) where alerts get created today.
- `apps/worker/src/processors/alert-resolve.ts` — where check-ins resolve open alerts.
- `packages/db/prisma/schema.prisma` — the `Alert` model and its current constraints.
- Any `__tests__` files near these — what's currently asserted, what's not.

## Phased approach

### Phase 1 — Naïve fix (do this yourself, no advisor needed)

Before writing the alert, query `Alert` for an existing `open` row with the same `(monitorId, type)`. If one exists, do nothing. Otherwise insert.

Implement this. Add a test that asserts: two consecutive calls to the evaluator produce only one alert row.

### Phase 2 — Concurrency test (do this yourself)

Add a second test that simulates **concurrent** evaluation: two parallel calls hitting the same monitor at the same time. Run it.

Expected outcome: this test fails or flakes. The check-then-insert is racy across workers. Two workers can both observe "no open alert" and both insert.

If the test passes, look harder — increase iteration count, reduce DB transaction isolation. The race is real; reproduce it.

### Phase 3 — Escalate to advisor

Once you've confirmed the race, **stop trying to fix it yourself**. Use `/advise` with a question shaped like:

> *"In `apps/worker/src/processors/check-window.ts`, two concurrent worker invocations can both create an open `Alert` row for the same `(monitorId, type)` because the check-then-insert isn't atomic. The naïve fix (a transaction with serializable isolation) seems heavy. What's the right pattern here? Reference the Alert model in `packages/db/prisma/schema.prisma`. We're on Postgres."*

Be specific. Include file paths so the advisor can read them. Do not paste large code blocks.

### Phase 4 — Implement the advisor's recommendation

Apply the advisor's guidance. Do not deviate. If the advisor recommends a partial unique index, write the migration. If the advisor recommends an UPSERT pattern with `ON CONFLICT DO NOTHING`, write that. If the advisor reframes the problem (e.g., "make the operation idempotent at a different layer"), follow the reframe.

Re-run the concurrency test. It must pass. If it doesn't, escalate **once more** with the specific failure — but do not start third-guessing the design yourself.

### Phase 5 — Verify and commit

- All existing alert tests still pass: `pnpm --filter @cronpilot/worker test`.
- Concurrency test passes deterministically (run it 10× to confirm it's not flaky).
- One conventional commit per phase. Phase 4's commit message references the advisor's recommendation in 1-2 sentences.

## When you may NOT use /advise

- For things you already know how to do (writing the test, querying the DB, adding an index). The advisor's tokens are expensive — use them only on architectural decisions.
- To get someone to write code for you. The advisor returns sketches at most. You implement.
- To resolve scope ambiguities — those go to the human user, not the advisor.

## When you SHOULD use /advise

- Concurrency, race conditions, transaction isolation choices.
- State machine design (what counts as "the same alert", when does dedup window reset).
- Trade-offs you can articulate but can't pick between.
- Non-obvious data model questions (constraint shapes, index design).

## Output

A clean working tree on a branch named `fix/alert-deduplication`, all tests passing including the new concurrency test, with commits showing the phase progression. Phase 4's commit message must reference the advisor's recommendation so the escalation point is visible in the log.
