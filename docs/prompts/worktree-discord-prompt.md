# Worktree A: Implement Discord Integration

You are working in an isolated git worktree. A second agent is implementing a different feature (monitor pause/resume) in a parallel worktree at the same time. **Stay in your lane** — the boundary is defined in the spec.

## Task

Implement the Discord integration end-to-end, following `docs/specs/discord-integration.md` exactly.

## Process

1. Read `docs/specs/discord-integration.md` in full. That document is the contract.
2. Read `CLAUDE.md` and the relevant files under `docs/agent/` for project conventions (commit style, test patterns, env vars).
3. Before writing code, briefly confirm the file plan: which files you will create vs. modify. If the spec contradicts what you find in the codebase, stop and ask — do not improvise.
4. Implement layer-by-layer in this order: shared types → API route → worker processor → web UI → tests. Each layer should compile/typecheck before moving to the next.
5. Run `pnpm --filter @cronpilot/api test` and `pnpm --filter @cronpilot/web type-check` before claiming done.
6. Commit in conventional-commit style, one logical commit per layer.

## Hard constraints

- **Do not touch** files listed under "Boundary — do NOT touch" in the spec. They belong to the parallel worktree.
- **Do not modify** `packages/db/prisma/schema.prisma`. The existing `Integration` model already supports arbitrary `type` strings.
- **Do not add new dependencies** without surfacing them first.
- If something in the spec is ambiguous, stop and ask. Do not guess.

## Output

A clean working tree on a branch named `feat/discord-integration`, all tests passing, ready for review.
