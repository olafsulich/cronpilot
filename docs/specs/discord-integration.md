# Spec: Discord Integration

Add Discord as a notification destination, alongside the existing `slack`, `pagerduty`, `webhook`, and `email` types. Mirror the Slack pattern — same DB shape, same encryption, same queue, same UI conventions.

## Goal

A team can connect a Discord webhook URL to their Cronpilot workspace and receive alerts in a Discord channel when a monitor goes `late`, `down`, or reports a `failed` check-in.

## User-visible behavior

- New "Discord" tile in `Settings → Integrations`, alongside Slack.
- "Add Discord" form accepts a webhook URL (and optional human-readable channel name for display).
- Once added, the integration appears in the team's integration list and can be selected when creating an alert rule.
- When an alert fires for a monitor with a Discord alert rule, a message is posted to the webhook within 30 seconds.
- Failed deliveries are retried with the same policy as Slack.

## Files in scope

### Modify

- `packages/db/prisma/schema.prisma` — **no changes**. `Integration.type` is already a `String`; no enum to extend.
- `apps/api/src/routes/integrations.ts` — accept `type: "discord"` in create/list handlers; reuse the same encryption helper as Slack for `configEncrypted`.
- `apps/worker/src/processors/alert.ts` — add a `discord` branch in the dispatch switch (or its equivalent). Reuse retry/error handling.
- `packages/shared/src/types/` — extend the integration-type discriminated union to include `discord`.

### Create

- `apps/web/src/app/(dashboard)/integrations/discord/page.tsx` — "Add Discord" form page.
- Tests:
  - `apps/api/src/routes/__tests__/integrations.discord.test.ts` — integration test (real DB), parallel to the existing Slack test.
  - `apps/worker/src/processors/__tests__/alert.discord.test.ts` — unit test for the Discord branch (mock `fetch`).
  - `apps/web/src/test/integrations-discord-form.test.tsx` — unit test for the form (jsdom).

## API contract

`POST /integrations` (existing endpoint, new payload variant):

```json
{
  "type": "discord",
  "name": "On-call channel",
  "config": {
    "webhookUrl": "https://discord.com/api/webhooks/...",
    "channelName": "#oncall"
  }
}
```

- `webhookUrl` — required, must match `https://discord.com/api/webhooks/...` (validate with Zod regex).
- `channelName` — optional, display-only.
- `config` is encrypted via the same helper Slack uses, then stored in `Integration.configEncrypted`.

`GET /integrations` returns the new integration in the list with `type: "discord"`. The `config` field is **never** returned — only `name`, `type`, `id`, `createdAt`.

## Worker behavior

In `alert.ts`, when an alert is dispatched and the integration is `type === "discord"`:

1. Decrypt the config.
2. POST to `webhookUrl` with a Discord-shaped JSON payload:
   ```json
   { "content": "🚨 Monitor `{name}` is {status}. Last check-in: {timestamp}." }
   ```
3. On non-2xx, follow the same retry/backoff as Slack. On 4xx (invalid webhook), mark the rule as `errored` (same path as Slack).

## Out of scope

- Custom message templating or rich embeds — plain `content` only for v1.
- Slash commands, interactive components, threads.
- Discord OAuth — webhook URL only.
- Editing or deleting integrations (separate feature).

## Test requirements

- API integration test: create a Discord integration, assert config is encrypted in DB, assert GET response omits config.
- Worker test: mock `fetch`, assert POST hits webhook URL with correct JSON, assert retry on 5xx, assert no retry on 400.
- Web test: render the form, fill webhook URL, submit, assert API client called with correct payload.

## Boundary — do NOT touch

- `apps/api/src/routes/monitors.ts` — out of scope.
- `apps/worker/src/processors/check-window.ts` — out of scope.
- Anything under `apps/web/src/app/(dashboard)/monitors/` — out of scope.

If a change to one of these feels necessary, stop and surface it instead of editing.
