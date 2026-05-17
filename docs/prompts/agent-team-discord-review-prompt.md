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
4. `round-2-cross-challenge` — blocked on tasks 1, 2, and 3
5. `round-3-synthesis` — blocked on task 4

### Step 2 — Spawn three reviewers (parallel)

Spawn three teammates using the `security-reviewer`, `perf-reviewer`, and `test-reviewer` agent definitions. Name them `security`, `perf`, and `test`.

Use these spawn prompts verbatim, substituting the bracketed values:

**For `security`:**

> You are the security reviewer for the Discord integration PR. Read the spec at `docs/specs/discord-integration.md`, the diff (`git diff main...HEAD --stat`, then read changed files), and conventions in `CLAUDE.md` and `docs/agent/`. Produce a security review following your agent definition's format — findings with severity ratings, then a final verdict: `approve`, `approve-with-changes`, or `block`. Write your full report to `docs/review-round1-security.md`. Do not read the other reviewers' reports yet. When done, mark task `round-1-security` complete, then **stay available** — the lead will send you Round 2 instructions via message.

**For `perf`:**

> You are the performance reviewer for the Discord integration PR. Read the spec at `docs/specs/discord-integration.md`, the diff (`git diff main...HEAD --stat`, then read changed files), and conventions in `CLAUDE.md` and `docs/agent/`. Produce a performance review following your agent definition's format — findings with severity ratings, then a final verdict: `approve`, `approve-with-changes`, or `block`. Write your full report to `docs/review-round1-perf.md`. Do not read the other reviewers' reports yet. When done, mark task `round-1-perf` complete, then **stay available** — the lead will send you Round 2 instructions via message.

**For `test`:**

> You are the test coverage reviewer for the Discord integration PR. Read the spec at `docs/specs/discord-integration.md`, the diff (`git diff main...HEAD --stat`, then read changed files), and conventions in `CLAUDE.md` and `docs/agent/`. Produce a test coverage review following your agent definition's format — findings with severity ratings, then a final verdict: `approve`, `approve-with-changes`, or `block`. Write your full report to `docs/review-round1-test.md`. Do not read the other reviewers' reports yet. When done, mark task `round-1-test` complete, then **stay available** — the lead will send you Round 2 instructions via message.

### Step 3 — Trigger Round 2 when all three Round 1 tasks complete

Once tasks `round-1-security`, `round-1-perf`, and `round-1-test` are all complete, send each reviewer a message using `SendMessage`. Send all three messages before waiting for replies. **Do NOT spawn new teammates — the same `security`, `perf`, and `test` sessions from Step 2 are still alive and waiting.**

**Message to `security`:**

> Round 1 is complete. Read the other two reports: `docs/review-round1-perf.md` and `docs/review-round1-test.md`. Challenge at least one finding from each report. Each challenge must name the reviewer, the specific finding, and give a concrete reason — for example, "perf-HIGH-1 recommends batching requests without rate limiting, which conflicts with the token-per-request constraint in the spec." If both reports agree with your findings, challenge whichever finding has the weakest justification and explain what stronger evidence would be needed. After writing your challenges, state a revised verdict if your position changed. Append everything to `docs/review-round1-security.md` under a `## Round 2 Challenges` heading.

**Message to `perf`:**

> Round 1 is complete. Read the other two reports: `docs/review-round1-security.md` and `docs/review-round1-test.md`. Challenge at least one finding from each report. Each challenge must name the reviewer, the specific finding, and give a concrete reason — for example, "security-HIGH-2 requires re-validating tokens on every message event, which adds 40–80 ms per event without a corresponding threat in the threat model." If both reports agree with your findings, challenge whichever finding has the weakest justification and explain what stronger evidence would be needed. After writing your challenges, state a revised verdict if your position changed. Append everything to `docs/review-round1-perf.md` under a `## Round 2 Challenges` heading.

**Message to `test`:**

> Round 1 is complete. Read the other two reports: `docs/review-round1-security.md` and `docs/review-round1-perf.md`. Challenge at least one finding from each report. Each challenge must name the reviewer, the specific finding, and give a concrete reason — for example, "security-MEDIUM-3 asks for a fix but neither report requires a test to verify that fix." If both reports agree with your findings, challenge whichever finding has the weakest justification and explain what stronger evidence would be needed. After writing your challenges, state a revised verdict if your position changed. Append everything to `docs/review-round1-test.md` under a `## Round 2 Challenges` heading.

Once all three reviewers have replied and updated their files, mark task `round-2-cross-challenge` complete.

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
