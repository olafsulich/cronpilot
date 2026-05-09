# Worktree B: Implement Monitor Pause / Resume

You are working in an isolated git worktree. A second agent is implementing a different feature (Discord integration) in a parallel worktree at the same time. **Stay in your lane** — the boundary is defined in the spec.

## Task

Implement monitor pause/resume end-to-end, following `docs/specs/monitor-pause-resume.md` exactly.

## Process

1. Read `docs/specs/monitor-pause-resume.md` in full. That document is the contract.
2. Read `CLAUDE.md` and the relevant files under `docs/agent/` for project conventions (commit style, test patterns, env vars).
3. Before writing code, briefly confirm the file plan: which files you will modify. The spec lists them. If the spec contradicts what you find in the codebase, stop and ask — do not improvise.
4. Implement layer-by-layer in this order: API routes → worker check-window guard → check-in handler adjustment → web UI → tests. Each layer should compile/typecheck before moving to the next.
5. Run `pnpm --filter @cronpilot/api test` and `pnpm --filter @cronpilot/web type-check` before claiming done.
6. Commit in conventional-commit style, one logical commit per layer.

## Hard constraints

- **Do not touch** files listed under "Boundary — do NOT touch" in the spec. They belong to the parallel worktree.
- **Do not modify** `packages/db/prisma/schema.prisma`. `Monitor.status` already accepts `"paused"`.
- **Do not add new dependencies** without surfacing them first.
- Pause/resume must be **idempotent** — re-read the spec's API contract section before implementing.
- If something in the spec is ambiguous, stop and ask. Do not guess.

## Output

A clean working tree on a branch named `feat/monitor-pause-resume`, all tests passing, ready for review.
