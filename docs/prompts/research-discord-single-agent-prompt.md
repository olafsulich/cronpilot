# Research: Discord Integration

Map how the existing **Slack integration** is built in the Cronpilot codebase, so we can clone the pattern for **Discord**. Document what exists today — do not propose Discord-specific changes yet, and do not modify any code.

## Rules

- **Do not use the Task tool.** Do not spawn subagents. Read files yourself.
- Do not skim. Read the relevant files in full — `Read` without `offset/limit` unless the file is genuinely large (>500 lines).
- Trace data flow across all three layers (API, worker, web). Each finding gets exact `file:line` references.
- Output a single research document covering all three layers.

## Coverage

### Area 1 — Slack in the API layer

- The integrations route in `apps/api/src/routes/integrations.ts` — handler for `POST /integrations`, validation schema, how `slack` is discriminated.
- Encryption helper for integration config — find it in `apps/api/src/lib/` or `packages/shared/`. Function signature, where it's called.
- The `Integration` Prisma model in `packages/db/prisma/schema.prisma` — relevant fields.
- Existing integration tests for Slack creation in `apps/api/src/routes/__tests__/` — what's asserted, what's mocked.

### Area 2 — Slack in the worker layer

- The Slack dispatch path inside `apps/worker/src/processors/alert.ts` — full trace from queue job → fetch monitor + alert → format message → POST to Slack webhook → mark delivered.
- Which BullMQ queue routes alert jobs. Where it's defined and where jobs are enqueued from. Cross-reference `apps/api/src/services/` and `apps/worker/src/lib/`.
- Retry/error semantics — what happens on 4xx vs 5xx. Where the policy lives.
- Any shared message-formatting utilities in `packages/shared/`.

### Area 3 — Slack in the web layer

- The integrations settings page in `apps/web/src/app/` — route, list components, "add new" form components.
- The Slack add-form — fields, validation library, submit mechanism (server action vs API call).
- Integration types in `packages/shared/src/types/` — the discriminated union.
- Existing unit tests for the integration UI in `apps/web/src/test/`.

## Output

Write the research document to `docs/research-discord-integration-single-agent.md`. Structure:

- For every finding, include exact file paths and line numbers.
- When showing patterns to follow, include short code snippets from the actual codebase.
- End with a **Code References** section (all key `file:line` in one list) and an **Open Questions** section listing anything that would block a Discord clone (missing abstractions, hardcoded "slack" strings, etc.).

After writing the document, stop. Do not propose or begin implementation.
