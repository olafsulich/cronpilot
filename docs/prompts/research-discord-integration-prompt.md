# Research: Discord Integration

Research how the existing **Slack integration** is built in the Cronpilot codebase, so we can clone the pattern for **Discord**. Document what exists today — do not propose Discord-specific changes yet, and do not modify any code. You are a documentarian, not an implementer.

## Rules for all agents

- Spawn each sub-agent with `subagent_type: codebase-analyzer` (read-only tools — no Edit, Write, or Bash). This is intentional: research must not mutate the repo.
- Only describe what exists, how it works, and how data flows.
- Include exact file paths and line numbers for every finding.
- When documenting patterns, include short code snippets showing the actual implementation.
- Do not suggest improvements, critique code, or identify problems.

## Process

Spawn 3 sub-agents in parallel — one per layer. Each has a tightly scoped question and writes back ~300 words max.

### Agent 1: Slack in the API layer

Map the API surface for the Slack integration:

- The integration routes in `apps/api/src/routes/` — which file handles `POST /integrations`, what validation schema does it use, how is the `slack` type discriminated?
- How is the integration config encrypted before being persisted? Find the encryption helper in `apps/api/src/lib/` or `packages/shared/`. Include the function signature and where it's called.
- How does the `Integration` Prisma model store config? Reference `packages/db/prisma/schema.prisma` and call out the relevant fields.
- Existing integration tests for Slack creation in `apps/api/src/routes/__tests__/` (or similar). What do they assert, what do they mock?

The goal: a complete inventory of the API-side Slack flow that can be replicated for Discord.

### Agent 2: Slack in the worker layer

Map how Slack alerts are dispatched:

- The Slack processor in `apps/worker/src/processors/` — full trace from queue job → fetch monitor + alert → format message → POST to Slack webhook → mark alert delivered.
- Which BullMQ queue routes Slack jobs? Where is the queue defined and where are jobs enqueued from? Cross-reference `apps/api/src/services/` and `apps/worker/src/lib/`.
- Retry/error semantics — what happens on Slack 4xx vs 5xx? Where is the retry policy configured?
- Any shared message-formatting utilities in `packages/shared/` that Discord could reuse.

The goal: understand the worker-side dispatch pattern so Discord plugs into the same queue/retry infrastructure.

### Agent 3: Slack in the web layer

Map the customer-facing UI for Slack integrations:

- The integrations settings page in `apps/web/src/app/` — what's the route, what components render the list, what components render the "add new" form?
- The form for adding a Slack integration — which fields, which validation library, how does it submit (server action vs API call)?
- How are the available integration types declared/typed? Look in `packages/shared/src/types/` for the discriminated union.
- Any existing unit tests for the integration UI in `apps/web/src/test/`. What do they cover, how do they mock the API client?

The goal: understand the web-side pattern so the Discord settings UI follows the same conventions.

## After all agents complete

Synthesize the 3 sub-agent summaries into a single research document. Do not re-explore the codebase — only work with what the agents returned.

## Output requirements

- For every finding, include exact file paths and line numbers.
- When showing patterns to follow, include short code snippets from the actual codebase.
- End with a **Code References** section (all key `file:line` in one list) and an **Open Questions** section listing anything that would block a Discord clone (missing abstractions, hardcoded "slack" strings, etc.).
- Output to `docs/research-discord-integration.md`.
