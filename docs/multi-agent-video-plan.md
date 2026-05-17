# Multi-Agent Video — Demo Plan

Production plan for the video on multi-agent AI coding. Cronpilot is the demo codebase; every technique in the script has a concrete scene grounded in real files in this repo.

This document is a working reference for filming. It maps each technique to its scene, the features it uses, and the artifacts already in the repo.

## Why this repo works as a demo

- Real bounded contexts: `apps/api`, `apps/worker`, `apps/web`, plus four shared packages — enough surface for parallel work without contrivance.
- CLAUDE.md, `docs/agent/*` and pre-built skills (`write-test`, `codebase-analyzer`) give agents real conventions to follow on camera.
- Small enough to actually finish a slice during a recording session.
- Already wired for Vitest, Prisma, BullMQ — the kind of stack viewers recognize.

## The features powering the demos

The script has 5 techniques. Forcing one feature to carry all 5 makes the demos contrived (each technique stresses a different _shape_ of problem). So three features and one bug-fix carry the five scenes:

| Feature                     | Used by                                                     |
| --------------------------- | ----------------------------------------------------------- |
| Discord integration         | Subagents (research) · Worktree A · Agent team review       |
| Monitor pause/resume        | Worktree B (only — its job is to be independent of Discord) |
| `packages/sdk` (greenfield) | Ralph                                                       |
| Alert deduplication         | Advisor strategy                                            |

Discord is the "main thread" viewers see most. The others are scoped cameos that exist because their technique needs a particular shape of problem — itself a teaching moment: _"each technique has a shape of problem it fits."_

## Scene 1 — Subagents

**Goal:** show research without polluting context, plus tool restriction (read-only subagent).

**Demo:** before adding Discord, dispatch 3 parallel `codebase-analyzer` subagents — one per app layer (API, worker, web) — to map how the existing Slack integration works. Each returns ~300 words. Main agent synthesizes into `docs/research-discord-integration.md`.

**On screen:** the user pastes the prompt. Three subagents spawn in parallel (visible in the tool-use stream). Each is read-only — viewers see _no_ Edit/Write tool calls. The synthesized doc appears.

**Files:**

- `docs/prompts/research-discord-integration-prompt.md` — the orchestrator prompt
- `.claude/agents/codebase-analyzer.md` — pre-existing read-only subagent

**Teaching moment:** subagents = isolated context + restricted tools + clear deliverable. They can't talk to each other; they can't spawn further. That's the cap.

### Contrast (single-agent — no subagents)

**Goal:** show the cost of _not_ using subagents — context-window consumption that prevents the session from continuing with implementation.

**Demo:** run the single-agent variant of the same research task in a session next to the subagent version. The single agent reads files directly (no Task tool, no skimming — instructed in the prompt). By the time the synthesized doc is written, context is heavily consumed. Then ask both sessions "now implement Discord" — the subagent session has headroom; the single-agent session needs `/compact` or drops detail.

**What to capture on screen:**

- Context-window indicator at three checkpoints, in both sessions: before starting, after Area 1, after the synthesized doc is written
- Side-by-side comparison of context % at each checkpoint — the gap is the lesson

**Files:**

- `docs/prompts/research-discord-single-agent-prompt.md` — same task, with `Do not use the Task tool` constraint

## Scene 2 — Worktrees

**Goal:** two agents in two terminals, parallel, no collision.

**Demo:** two terminals side by side.

- Worktree A: `claude -w discord-integration` reads `docs/specs/discord-integration.md`
- Worktree B: `claude -w monitor-pause-resume` reads `docs/specs/monitor-pause-resume.md`

Each spec contains a **mirror-image "Boundary — do NOT touch" list**, so collision is structurally impossible if both agents follow their spec.

**On-camera trade-off scene** (matches the Re-hook in the script):

- Port collision when both spawn `pnpm dev`
- Shared Postgres — `prisma db push` from one clobbers the other
- `.env` and `node_modules` missing on first checkout

This is where the "honest trade-offs" beat lives. Worktrees aren't free — the script's Re-hook is built around making this visible.

**Files:**

- `docs/specs/discord-integration.md` — full spec, with boundary list
- `docs/specs/monitor-pause-resume.md` — full spec, mirror-boundary
- `docs/prompts/worktree-discord-prompt.md` — short brief, on-screen-friendly
- `docs/prompts/worktree-monitor-pause-prompt.md` — short brief, on-screen-friendly

**Teaching moment:** parallel only when files don't overlap. The spec, not the operator, enforces the lane.

### Contrast (no worktrees — file-level conflict)

**Goal:** show why worktrees exist — without isolation, two agents on overlapping work clobber each other.

**Demo:** swap the second feature so it overlaps maximally with the first. Two agents in the **same checkout, same branch**, no worktrees:

- Agent A adds `discord` integration
- Agent B adds `teams` integration

Both prompts list the same target files, which is what causes the collision.

**Predicted collision points:**

| File                                         | Why both agents edit it                           |
| -------------------------------------------- | ------------------------------------------------- |
| `apps/api/src/routes/integrations.ts`        | Both add a case to the type-discrimination switch |
| `apps/worker/src/processors/alert.ts`        | Both add a dispatch branch                        |
| `packages/shared/src/types/<integration>.ts` | Both extend the same union                        |

The `apps/web/src/app/(dashboard)/integrations/<type>/page.tsx` files use _different_ paths and don't collide. Useful contrast point on camera: _"not all files collide, but enough do to break the workflow."_

**What to capture on screen** (any one of these works):

- Terminal moment one agent's `git commit` succeeds and the other fails with merge conflict
- `<<<<<<< HEAD` markers in `integrations.ts` after a naïve merge attempt
- `git diff` after both agents finish, showing one agent's case-statement entry has silently disappeared because the other overwrote it

**Timing note:** kick off both terminals nearly simultaneously. If one finishes before the other starts, the second sees the first's change and adds alongside cleanly — no conflict. The dramatic version requires concurrent reads.

**Files:**

- `docs/prompts/no-worktrees-discord-prompt.md` — Agent A
- `docs/prompts/no-worktrees-teams-prompt.md` — Agent B

## Scene 3 — Agent Teams

**Goal:** three agents review the Discord PR with different priorities, _disagree_, and resolve.

**Demo:** with `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` enabled, three reviewer agents are spawned once and persist across both rounds. Round 1: each posts an independent report. Round 2: the lead sends each agent a `SendMessage` — same sessions, no re-spawning — and they challenge each other's findings. Synthesizer produces a single review with a verdict.

**On screen:** three personas tuned to disagree on different axes:

- **Security** wants stricter validation / encryption — paranoid stance
- **Performance** pushes back on overengineered controls without a real threat — pragmatic stance
- **Tests** flags coverage gaps and enforces the "no mocked DB in API tests" rule explicitly

Force at least one cross-challenge. Without disagreement, the demo collapses into chorus-of-agreement.

**Files:**

- `.claude/agents/security-reviewer.md`
- `.claude/agents/perf-reviewer.md`
- `.claude/agents/test-reviewer.md`
- `docs/prompts/agent-team-discord-review-prompt.md` — the 3-round orchestrator

**Teaching moment:** the difference vs subagents is Round 2 — agents read each other and push back using `SendMessage` to the same persistent sessions. No re-spawning between rounds.

## Scene 4 — Ralph Loop

**Goal:** show greenfield autonomous building from zero.

**Demo:** `packages/sdk/` has `features.json` (10 features, all `passes: false`) and `progress.md` but no source code. Run `./scripts/ralph.sh`. Cut to "15 iterations later" — `git log --oneline -20` shows ~10 small conventional commits, each a slice of the SDK. `pnpm --filter @cronpilot/sdk test` passes.

**On screen:**

- The empty directory at `git log --oneline -5`
- The script firing — iteration counter in the terminal
- The commit log at the end — that _is_ the demo's payoff

**Files:**

- `docs/prompts/ralph-sdk-prompt.md` — pure SDK spec; loop mechanics are injected by `ralph.sh`, so the spec has no knowledge of Ralph
- `packages/sdk/tasks.json` — persistent task checklist; each entry has `"passes": false/true`; agents flip entries to `true` as they verify each slice
- `packages/sdk/progress.md` — cross-session log; each iteration appends what it did and current build/test health
- `scripts/ralph.sh` — the loop wrapper. Takes iteration count as positional arg. Accepts `-p` (prompt file), `-f` (tasks file), `-r` (progress file). Exits early on `<promise>COMPLETE</promise>` in agent output.

**Teaching moment:** Ralph works for greenfield + contained scope. Calling out the contrast on camera matters: _"Ralph in greenfield → fine. Ralph on `apps/web` → catastrophe."_

## Bonus scenes (brief)

- **"Review is the bottleneck"** — four worktrees finish simultaneously, you drown in four diffs. Cut to the screen — _this_ is the real ceiling, not tokens. (Sits inside Scene 2 or in the Honest Trade-offs block.)
- **Subagent vs agent team in 60 seconds** — same task ("review this PR"), once with a subagent (one report, end), once with the team (3 agents argue, you arbitrate). Visceral side-by-side. (Bridges Scene 1 → Scene 3.)

## Pre-recording checklist

- [ ] `pnpm install` clean — no warnings on screen
- [ ] Test DB is up and migrations applied (`pnpm db:push`)
- [ ] Both feature branches don't exist yet — clean state
- [ ] `packages/sdk/` contains only `tasks.json` and `progress.md` — no source files. Reset with `git checkout -- packages/sdk/tasks.json packages/sdk/progress.md && rm -rf packages/sdk/src packages/sdk/dist packages/sdk/package.json packages/sdk/tsconfig.json`
- [ ] `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` exported in the agent-team terminal
- [ ] Verify `claude --dangerously-skip-permissions` is acceptable in the recording environment (Ralph needs it)
- [ ] Two intentional flaws in a prepared `feat/discord-integration-flawed` branch for the agent-team review (so reviewers actually find something — examples: a webhook URL not validated, a missing index)

## File inventory

Everything created for these demos, by location:

```
docs/specs/
  discord-integration.md
  monitor-pause-resume.md
docs/prompts/
  research-discord-integration-prompt.md       (Scene 1 — main)
  research-discord-single-agent-prompt.md      (Scene 1 — contrast)
  worktree-discord-prompt.md                   (Scene 2 — main, agent A)
  worktree-monitor-pause-prompt.md             (Scene 2 — main, agent B)
  no-worktrees-discord-prompt.md               (Scene 2 — contrast, agent A)
  no-worktrees-teams-prompt.md                 (Scene 2 — contrast, agent B)
  agent-team-discord-review-prompt.md          (Scene 3)
  ralph-sdk-prompt.md                          (Scene 4)
  executor-alert-dedup-prompt.md               (Scene 5)
.claude/agents/
  codebase-analyzer.md            (pre-existing — used by Scene 1)
  security-reviewer.md            (Scene 3)
  perf-reviewer.md                (Scene 3)
  test-reviewer.md                (Scene 3)
  advisor.md                      (Scene 5)
.claude/commands/
  advise.md                       (Scene 5)
scripts/
  ralph.sh                        (Scene 4)
```

## Suggested filming order

Order matters because the script's Re-hook sits _between_ worktrees and agent teams. Recommended:

1. **Subagents** — clean opener, single technique, fast payoff.
2. **Worktrees** + the trade-off / "honest" scene immediately after. This satisfies the Re-hook block.
3. **Agent Teams** — viewer is now primed for "but agents can also talk to each other."
4. **Ralph** — entirely different mode (autonomous, greenfield); palate-cleanser before the cost beat.
5. **Advisor** — closes on the cost/discipline note that ties to the script's closing arc.
