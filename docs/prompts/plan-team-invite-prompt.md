# Plan: Team Invitation System

Read the research document at `docs/research-team-invite.md` first. Use it as your primary context — do not re-explore the codebase.

## Goal

Design a complete implementation plan for the team invitation flow in Cronpilot. The API endpoint `POST /teams/invite` already calls `prisma.teamInvite.create()`, but the `TeamInvite` model doesn't exist. We need to build out the full invite lifecycle: invite creation, email delivery, accept/decline, and cleanup of expired invites.

## Plan structure

Use this structure for the output:

### Overview

1-2 sentence summary of what we're building and why.

### Current State Analysis

What exists today, what's missing, key constraints. Reference the research doc findings.

### Desired End State

A specification of what "done" looks like and how to verify it end-to-end.

### What We're NOT Doing

Explicitly list out-of-scope items to prevent scope creep.

### Implementation Phases

Break the work into phases following this order: **schema → shared types → API → email → frontend**. Each phase should be independently verifiable.

For each phase:

```md
## Phase N: [Descriptive Name]

### Overview

What this phase accomplishes.

### Changes Required

- File path, what changes, and why
- Be specific — reference line numbers from the research doc

### Success Criteria

#### Automated Verification

- [ ] Specific command to run (e.g. `pnpm --filter @cronpilot/db db:migrate`)
- [ ] Type checking: `pnpm typecheck`
- [ ] Tests pass: `pnpm test`

#### Manual Verification

- [ ] Specific thing to check manually

**Pause here for verification before proceeding to the next phase.**
```

### Testing Strategy

What unit and integration tests to add, and key edge cases.

### Security Considerations

Token generation, expiry, rate limiting, multi-tenancy scoping.

## Guidelines

- No open questions in the final plan. If something is unclear, flag it as a blocker.
- Every file reference must include the exact path (and line number where relevant).
- Follow existing codebase patterns — don't introduce new conventions.
- Keep each phase small enough to verify independently.
- Output the plan to `docs/plan-team-invite.md`.
