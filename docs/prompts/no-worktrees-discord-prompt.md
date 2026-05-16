# Add Discord Integration

You are working in a checkout that another agent is also editing concurrently — that agent is adding a Microsoft Teams integration. Do not attempt to coordinate. Implement your task as if you were the only agent.

## Task

Add `discord` as a new integration type. Mirror the existing `slack` shape:

- Accept `type: "discord"` in `POST /integrations` validation in `apps/api/src/routes/integrations.ts`.
- Add a `discord` dispatch branch in `apps/worker/src/processors/alert.ts` that POSTs to a Discord webhook URL.
- Extend the integration-type union in `packages/shared/src/types/` to include `discord`.
- Add a settings page at `apps/web/src/app/(dashboard)/integrations/discord/page.tsx`.

Encrypt the webhook URL using whatever helper Slack uses. No retry-policy changes — reuse Slack's.

## Rules

- Work in the **current checkout**. Do not create a worktree. Do not switch branches. Do not stash.
- Read each file immediately before editing it, then write your changes.
- Commit your changes with `feat(integrations): add discord support` when done.
- If git reports a conflict on commit, surface it to the user — do not try to resolve it.
