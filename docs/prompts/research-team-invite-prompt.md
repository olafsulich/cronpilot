# Research: Team Invitation System

Research the team invitation system in the Cronpilot codebase using parallel sub-agents. Document what exists today — do not suggest improvements or changes. You are a documentarian, not a critic.

## Rules for all agents

- Only describe what exists, how it works, and how components interact.
- Do not suggest improvements, critique code, or identify problems.
- Include exact file paths and line numbers for every finding.
- Trace data flow — not just what files exist, but how data moves through them.
- When documenting patterns, include short code snippets showing the actual implementation.

## Process

Spawn 3 sub-agents in parallel. Each answers a different question.

### Agent 1: What invite code already exists?

Map everything in the codebase that's already built (or half-built) for invitations specifically:

- The invite endpoint in `apps/api/src/routes/teams.ts` — what does it do, what DB calls does it make, what does it assume exists?
- Any invite-related email template in `packages/emails/src/templates/` — what props does it expect? Include the component signature.
- Any invite-related types in `packages/shared/src/types/`.
- Any invite-related UI in `apps/web/`.

The goal: a complete inventory of existing invite code so we know what to complete vs. build from scratch.

### Agent 2: What system do invites plug into?

Understand the surrounding systems that the invite flow needs to integrate with:

- How `Team`, `User`, `TeamMember` models relate in `packages/db/prisma/schema.prisma`. What roles exist. How is membership created today?
- How signup/login works in `apps/api/src/routes/auth.ts`. Trace the full flow: request → validation → user creation → team association → response. How does a new user end up belonging to a team?
- How the frontend settings area is structured in `apps/web/` — what pages exist under settings, how are they laid out?

The goal: understand the systems we need to connect to, so the invite flow fits in naturally.

### Agent 3: What patterns should we follow?

Find concrete examples of how similar features are built in this codebase:

- How are tokens/secrets generated? Look at auth tokens, check-in URL tokens, etc. Include the actual code snippets.
- How is a typical API route structured? Pick one complete CRUD example (e.g., monitors) and trace: route → validation → service/DB call → response mapping. Show the pattern.
- How are Prisma models typically structured? Show an example model with relations, indexes, and enums.
- How are shared types defined and exported in `packages/shared/`?

The goal: a pattern reference so the implementation follows existing conventions exactly.

## After all agents complete

Synthesize the 3 agent summaries into a single research document. Do not re-explore the codebase — only work with what the agents returned.

## Output requirements

- For every finding, include exact file paths and line numbers.
- When showing patterns to follow, include short code snippets from the actual codebase.
- End with a **Code References** section (all key file:line in one list) and an **Open Questions** section.
- Output to `docs/research-team-invite.md`.
