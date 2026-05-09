# Agent Team Review: Discord Integration PR

Three reviewers — `security-reviewer`, `perf-reviewer`, `test-reviewer` — review the Discord integration PR from three perspectives, then **challenge each other's findings**, then produce a single synthesized review with a clear verdict.

This is the agent-team mode (not parallel subagents). The agents must read each other's reports and engage. Disagreement is the point.

## Setup

This demo assumes the experimental agent-teams feature is enabled:

```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

Three sessions are started — one per agent file in `.claude/agents/`. They share a mailbox so cross-references (`@security-reviewer`) resolve.

If running without the flag, fall back to dispatching three subagents in parallel via the Task tool, then a fourth pass where each agent reads the others' reports and produces challenges. Same logical workflow, slightly more manual.

## Inputs

- **Spec:** `docs/specs/discord-integration.md` — the contract being reviewed against.
- **Diff:** the current branch vs. `main`. Use `git diff main...HEAD --stat` to scope, then read changed files.
- **Conventions:** `CLAUDE.md` and `docs/agent/`.

## Process

### Round 1 — Independent review (parallel)

Each reviewer produces a report following the format defined in their agent file. Each operates in isolation — no cross-talk. Output goes to the shared mailbox.

- security-reviewer → security findings + verdict
- perf-reviewer → performance findings + verdict
- test-reviewer → coverage findings + verdict

### Round 2 — Cross-challenge (sequential, one round)

Each reviewer now reads the **other two** reports and challenges where appropriate:

- Did the perf reviewer ask for an optimization that introduces a security issue? Security flags it.
- Did security ask for a control that adds non-trivial latency without a real threat? Perf challenges it.
- Did either reviewer claim a fix is needed but not require a test for it? Test reviewer flags it.

Each challenge must reference a specific finding by reviewer name and severity, and must give a concrete reason. Vague disagreements are not allowed.

After challenges are posted, each reviewer issues a **revised verdict** if their position changed.

### Round 3 — Synthesis (single agent, can be the orchestrator or a fourth synthesizer)

Produce a single document that:

- Lists all findings across the three reviewers, deduplicated.
- For each finding: severity, owner (which reviewer raised it), whether it was challenged, and the resolution.
- Final verdict — derived from the three revised verdicts:
  - All three approve → **approve**.
  - Any one blocks → **block**.
  - Mix of approve + approve-with-changes → **approve with required changes** (list them).
- If reviewers genuinely disagreed and didn't converge → **escalate to human** with the specific tradeoff laid out.

## Output

Write the synthesized review to `docs/review-discord-integration.md`. Do not modify any source file — this is a review-only workflow.

## Why this is an agent team, not three subagents

Subagents would each return a report and stop. They cannot read each other or push back. This workflow specifically requires Round 2 — the cross-challenge — where each agent's report is *input* to the others. That's the discussion the video is meant to demo.

If you find yourself wanting to skip Round 2 because all three reports happen to agree, **don't**. Force at least one challenge. Disagreement reveals tradeoffs the user needs to see.
