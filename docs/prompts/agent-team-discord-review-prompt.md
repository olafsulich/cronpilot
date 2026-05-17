# Agent Team Review: Discord Integration PR

Three reviewers — `security-reviewer`, `perf-reviewer`, `test-reviewer` — review the Discord integration PR from three independent perspectives, challenge each other's findings, then produce a single synthesized review with a clear verdict.

## Inputs

- **Spec:** `docs/specs/discord-integration.md` — the contract being reviewed against
- **Diff:** run `git diff main...HEAD --stat` to scope, then read changed files
- **Conventions:** `CLAUDE.md` and `docs/agent/`

---

## Instructions for the lead

### Step 1 — Create the task list

Before spawning any teammates, create these tasks in this order:

1. `round-1-security` — unblocked
2. `round-1-perf` — unblocked
3. `round-1-test` — unblocked
4. `round-2-security` — blocked on tasks 1, 2, and 3
5. `round-2-perf` — blocked on tasks 1, 2, and 3
6. `round-2-test` — blocked on tasks 1, 2, and 3
7. `round-3-synthesis` — blocked on tasks 4, 5, and 6

### Step 2 — Spawn three reviewers (parallel)

Spawn three teammates using the `security-reviewer`, `perf-reviewer`, and `test-reviewer` agent definitions. Name them `security`, `perf`, and `test`.

Use these spawn prompts verbatim:

**For `security`:**

> You are the security reviewer for the Discord integration PR. Your work has two rounds — complete both before finishing.
>
> **Round 1 — task `round-1-security`:** Read the spec at `docs/specs/discord-integration.md`, the diff (`git diff main...HEAD --stat`, then read changed files), and conventions in `CLAUDE.md` and `docs/agent/`. Produce a security review following your agent definition's format — findings with severity ratings, then a final verdict: `approve`, `approve-with-changes`, or `block`. Write your full report to `docs/review-round1-security.md`. Do not read the other reviewers' reports yet. Mark `round-1-security` complete.
>
> **Round 2 — task `round-2-security`:** This task is blocked until all three Round 1 tasks complete. Once it unblocks, claim it. Read the other two reports: `docs/review-round1-perf.md` and `docs/review-round1-test.md`. Challenge at least one finding from each report — name the reviewer, the specific finding, and give a concrete reason. State a revised verdict if your position changed. Append everything to `docs/review-round1-security.md` under a `## Round 2 Challenges` heading. Mark `round-2-security` complete.

**For `perf`:**

> You are the performance reviewer for the Discord integration PR. Your work has two rounds — complete both before finishing.
>
> **Round 1 — task `round-1-perf`:** Read the spec at `docs/specs/discord-integration.md`, the diff (`git diff main...HEAD --stat`, then read changed files), and conventions in `CLAUDE.md` and `docs/agent/`. Produce a performance review following your agent definition's format — findings with severity ratings, then a final verdict: `approve`, `approve-with-changes`, or `block`. Write your full report to `docs/review-round1-perf.md`. Do not read the other reviewers' reports yet. Mark `round-1-perf` complete.
>
> **Round 2 — task `round-2-perf`:** This task is blocked until all three Round 1 tasks complete. Once it unblocks, claim it. Read the other two reports: `docs/review-round1-security.md` and `docs/review-round1-test.md`. Challenge at least one finding from each report — name the reviewer, the specific finding, and give a concrete reason. State a revised verdict if your position changed. Append everything to `docs/review-round1-perf.md` under a `## Round 2 Challenges` heading. Mark `round-2-perf` complete.

**For `test`:**

> You are the test coverage reviewer for the Discord integration PR. Your work has two rounds — complete both before finishing.
>
> **Round 1 — task `round-1-test`:** Read the spec at `docs/specs/discord-integration.md`, the diff (`git diff main...HEAD --stat`, then read changed files), and conventions in `CLAUDE.md` and `docs/agent/`. Produce a test coverage review following your agent definition's format — findings with severity ratings, then a final verdict: `approve`, `approve-with-changes`, or `block`. Write your full report to `docs/review-round1-test.md`. Do not read the other reviewers' reports yet. Mark `round-1-test` complete.
>
> **Round 2 — task `round-2-test`:** This task is blocked until all three Round 1 tasks complete. Once it unblocks, claim it. Read the other two reports: `docs/review-round1-security.md` and `docs/review-round1-perf.md`. Challenge at least one finding from each report — name the reviewer, the specific finding, and give a concrete reason. State a revised verdict if your position changed. Append everything to `docs/review-round1-test.md` under a `## Round 2 Challenges` heading. Mark `round-2-test` complete.

### Step 3 — Wait for all Round 2 tasks to complete

Monitor the task list. Once `round-2-security`, `round-2-perf`, and `round-2-test` are all complete, proceed to synthesis.

### Step 4 — Synthesize (Round 3)

Read all three updated report files and write `docs/review-discord-integration.md` containing:

- All findings across the three reviewers, deduplicated
- For each finding: severity, owner (which reviewer raised it), whether it was challenged, and the resolution
- Final verdict derived from the three revised verdicts:
  - All three approve → **approve**
  - Any one blocks → **block**
  - Mix of approve + approve-with-changes → **approve with required changes** (enumerate them)
  - Reviewers disagreed and didn't converge → **escalate to human** with the specific tradeoff stated plainly

Mark task `round-3-synthesis` complete. Do not modify any source file — this is read-only.
