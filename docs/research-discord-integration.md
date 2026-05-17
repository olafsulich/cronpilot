# Research: Discord Integration — Slack Pattern Analysis

> Generated from parallel codebase analysis of the API, worker, and web layers.
> No code was modified. All findings are read-only observations.

---

## API Layer

### Route: `POST /integrations`

**File:** `apps/api/src/routes/integrations.ts:24–32`

The route parses the request body with `CreateIntegrationSchema.safeParse(request.body)`. On failure it throws `AppError("VALIDATION_ERROR", ..., 400)`. On success it delegates to `createIntegration(request.team.id, parsed.data)`.

```ts
// apps/api/src/routes/integrations.ts:25–30
const parsed = CreateIntegrationSchema.safeParse(request.body);
if (!parsed.success) {
  const message = parsed.error.errors.map((e) => e.message).join(", ");
  throw new AppError("VALIDATION_ERROR", message, 400);
}
return createIntegration(request.team.id, parsed.data);
```

### Discriminated Union Schema

**File:** `apps/api/src/services/integrations.ts:31–36`

```ts
export const CreateIntegrationSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("slack"),     config: SlackConfigSchema }),
  z.object({ type: z.literal("pagerduty"), config: PagerDutyConfigSchema }),
  z.object({ type: z.literal("webhook"),   config: WebhookConfigSchema }),
  z.object({ type: z.literal("email"),     config: EmailConfigSchema }),
]);
```

`SlackConfigSchema` (lines 12–15) requires `webhookUrl: z.string().url()` and an optional `channel: z.string()`.

### Encryption

**File:** `apps/api/src/lib/encryption.ts:23`

```ts
export function encrypt(plaintext: string): string
```

Uses Node's `crypto` with `aes-256-gcm`, a 12-byte random IV, and base64-encodes a JSON envelope `{ iv, tag, data }`.

**Call site:** `apps/api/src/services/integrations.ts:106–107`

```ts
const configJson = JSON.stringify(input.config);
const encryptedConfig = encrypt(configJson);
```

The result is passed to `prisma.integration.create` at line 116 as the `encryptedConfig` field.

### Prisma Model

**File:** `packages/db/prisma/schema.prisma:107–120`

```prisma
model Integration {
  id              String   @id @default(cuid())
  teamId          String
  type            String
  name            String
  configEncrypted String
  createdAt       DateTime @default(now())
  ...
}
```

Config is a plain `String` field (`configEncrypted`) — no JSON/JSONB. The service layer accesses it as `integration.encryptedConfig` (lines 51, 157).

### Tests

No integration tests exist for the integrations routes. The only test file in `apps/api/` is `apps/api/tests/auth.test.ts`, which covers auth only.

---

## Worker Layer

### Processor

**File:** `apps/worker/src/processors/alert.ts`

There is no dedicated Slack processor file. All integration types are dispatched from a single `processAlert` function.

**Flow:**

1. **Receive job** — `processAlert(job: Job<AlertJobData>)` at line 24 receives `{ monitorId, teamId, alertType }`.

2. **Fetch monitor + alert rules** — Prisma query at lines 34–43 loads the monitor with all `alertRules` and their nested `integration` records. A second query at lines 61–64 fetches the `open` alert for `failureCount`.

3. **Deduplication check** — Per rule, at line 81:
   ```ts
   const shouldNotify = failureCount === 1 || failureCount % rule.notifyAfter === 0;
   ```
   Rules that don't meet the threshold are skipped.

4. **Decrypt config** — At lines 98–105, `decrypt()` (from `apps/worker/src/lib/encryption.ts`) decrypts `integration.config`, then `JSON.parse`d. Then a `switch` on `integration.type` at line 110 routes to the correct dispatcher.

5. **Dispatch to Slack** — `dispatchSlack()` at lines 170–214:
   ```ts
   const payload = {
     text: `${emoji} Monitor *${monitorName}* ${verb}${suffix}`,
     attachments: [{ color: "#FF0000", fields: [...], actions: [...], footer: "Cronpilot", ts: ... }],
   };
   await axios.post(config.webhookUrl, payload, { timeout: 10_000 });
   ```
   Message formatting is entirely inline — no shared utility is called.

6. **No "mark delivered" write** — After a successful dispatch, the success path only logs. Alert lifecycle changes happen in a separate `alert-resolve` queue.

### Queue Wiring

**Queue name:** `"alert"` — defined in `packages/shared/src/queues.ts:2`

```ts
ALERT: "alert",
```

Two `Queue` instances, one per app:
- **API (enqueues):** `apps/api/src/lib/queues.ts:8` — `new Queue(QUEUES.ALERT, { connection })`
- **Worker (consumes):** `apps/worker/src/lib/queues.ts:8` — same construction

**Jobs are enqueued** from `apps/worker/src/processors/check-window.ts:87–96` — inside the `check-window` processor, not from API services:

```ts
await alertQueue.add(QUEUES.ALERT, alertJobData, {
  jobId: `alert:${alertId}`,
  removeOnComplete: { count: 100 },
  removeOnFail: { count: 50 },
});
```

The BullMQ `Worker` is registered in `apps/worker/src/worker.ts:50–53`, bound to `QUEUES.ALERT` with concurrency `WORKER_CONCURRENCY` (default 5).

### Retry / Error Semantics

Per-integration errors are **swallowed** inside the `try/catch` wrapping each `switch` case (lines 109–166):

```ts
} catch (err) {
  // a failure on one integration must not block others
  jobLog.error({ err, integrationId, type }, "failed to dispatch notification");
}
```

Any Slack HTTP error (4xx or 5xx) is caught here and logged. The BullMQ job itself completes successfully from BullMQ's perspective. **No retry policy** is set on alert jobs — `alertQueue.add()` passes no `attempts` or `backoff` options. axios timeout is fixed at `10_000` ms.

### Shared Utilities

There are **no Slack message formatting utilities** in `packages/shared/`. The only Slack-related export there is:

**File:** `packages/shared/src/types/integration.ts:3–6`

```ts
export interface SlackConfig {
  webhookUrl: string;
  channel: string;
}
```

---

## Web Layer

### Settings Page

**File:** `apps/web/src/app/(dashboard)/settings/integrations/page.tsx`

**Route:** `/settings/integrations`

The `IntegrationsPage` default export (lines 33–140) renders the full page. It fetches the integration list at line 41:

```ts
useSWR<Integration[]>("/integrations", fetcher)
```

The list maps over results (lines 94–126), rendering each as a card with icon (from `INTEGRATION_ICONS` at lines 17–22), name, type label, and a delete button that calls `apiClient.delete`.

### Add Integration Form

**Component:** `AddIntegrationModal` at lines 142–339 of the same file. It is toggled by "Add integration" buttons at lines 62–69 and 83–90.

**Validation:** Zod via `react-hook-form` + `@hookform/resolvers/zod`, wired at line 158:

```ts
resolver: zodResolver(IntegrationCreateSchema),
defaultValues: { type: "slack" },
```

**Schema source:** `packages/shared/src/types/api.ts:40–65`

```ts
export const IntegrationCreateSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("slack"),     name: z.string().min(1).max(255), webhookUrl: z.string().url(), channel: z.string().min(1) }),
  z.object({ type: z.literal("pagerduty"), name: z.string().min(1).max(255), integrationKey: z.string().min(1) }),
  z.object({ type: z.literal("webhook"),   name: z.string().min(1).max(255), url: z.string().url(), secret: z.string().min(1) }),
  z.object({ type: z.literal("email"),     name: z.string().min(1).max(255), address: z.string().email() }),
]);
```

**Slack-specific fields** (lines 233–258):
- Hidden `type` input (always present)
- `name` text input (always present)
- `webhookUrl` — `type="url"`, placeholder `https://hooks.slack.com/services/...`
- `channel` — `type="text"`, placeholder `#alerts`

**Submission:** Direct API call — no server action. `onSubmit` at lines 168–177:

```ts
await apiClient.post("/integrations", values);
```

On success: closes modal, calls `mutate()` to refresh SWR cache.

### Integration Types

**File:** `packages/shared/src/types/integration.ts`

```ts
// line 1
export type IntegrationType = "slack" | "pagerduty" | "webhook" | "email";

// lines 3–19 — per-type config shapes
export interface SlackConfig     { webhookUrl: string; channel: string; }
export interface PagerDutyConfig { integrationKey: string; }
export interface WebhookConfig   { url: string; secret: string; }
export interface EmailConfig     { address: string; }

// line 21
export type IntegrationConfig = SlackConfig | PagerDutyConfig | WebhookConfig | EmailConfig;
```

### Tests

No UI tests exist for the integrations page. The only test file in the web app is `apps/web/src/hooks/use-team.test.ts`, which mocks `swr` and `@/lib/api` and covers the `useTeam` hook only.

---

## Code References

| Location | Purpose |
|---|---|
| `apps/api/src/routes/integrations.ts:24–32` | `POST /integrations` route handler |
| `apps/api/src/services/integrations.ts:12–15` | `SlackConfigSchema` |
| `apps/api/src/services/integrations.ts:31–36` | `CreateIntegrationSchema` discriminated union |
| `apps/api/src/services/integrations.ts:106–116` | Encrypt + persist integration config |
| `apps/api/src/lib/encryption.ts:23` | `encrypt(plaintext: string): string` |
| `packages/db/prisma/schema.prisma:107–120` | `Integration` Prisma model |
| `packages/shared/src/queues.ts:2` | `QUEUES.ALERT = "alert"` |
| `packages/shared/src/types/integration.ts:1–21` | `IntegrationType`, per-type config interfaces |
| `packages/shared/src/types/api.ts:40–65` | `IntegrationCreateSchema` (shared between API + web) |
| `apps/api/src/lib/queues.ts:8` | Alert queue instance (API side) |
| `apps/worker/src/lib/queues.ts:8` | Alert queue instance (worker side) |
| `apps/worker/src/lib/encryption.ts` | `decrypt()` used by processor |
| `apps/worker/src/processors/check-window.ts:87–96` | Alert job enqueue site |
| `apps/worker/src/processors/alert.ts:24` | `processAlert` entry point |
| `apps/worker/src/processors/alert.ts:81` | `notifyAfter` deduplication check |
| `apps/worker/src/processors/alert.ts:98–105` | Config decrypt + JSON.parse |
| `apps/worker/src/processors/alert.ts:110–112` | `switch(integration.type)` dispatch |
| `apps/worker/src/processors/alert.ts:109–166` | Error swallowing per integration |
| `apps/worker/src/processors/alert.ts:170–214` | `dispatchSlack()` — inline message build + HTTP POST |
| `apps/worker/src/worker.ts:50–53` | BullMQ Worker registration |
| `apps/web/src/app/(dashboard)/settings/integrations/page.tsx:33–140` | `IntegrationsPage` — list rendering |
| `apps/web/src/app/(dashboard)/settings/integrations/page.tsx:142–339` | `AddIntegrationModal` — form |
| `apps/web/src/app/(dashboard)/settings/integrations/page.tsx:158` | `zodResolver(IntegrationCreateSchema)` |
| `apps/web/src/app/(dashboard)/settings/integrations/page.tsx:168–177` | `apiClient.post("/integrations", values)` |

---

## Open Questions

These items would need to be addressed when cloning the pattern for Discord:

1. **`IntegrationType` string union** (`packages/shared/src/types/integration.ts:1`) — adding `"discord"` requires touching this union, all places that switch/map over it, and the `INTEGRATION_ICONS` map in the web page.

2. **`CreateIntegrationSchema`** (`packages/shared/src/types/api.ts:40–65`) — the shared Zod schema is used by both the web form and (via re-export) the API. Adding a `discord` branch requires a new object arm and a new `DiscordConfig` interface.

3. **`dispatchSlack()` is not abstracted** — the entire dispatch function, including message formatting, is inline in `apps/worker/src/processors/alert.ts`. There is no `dispatchers/` directory or factory. A `dispatchDiscord()` function would be added inline in the same file and wired into the `switch` at line 110.

4. **No retry policy** — Discord webhooks (like Slack) will get a single attempt with no BullMQ retries. If Discord rate-limits (HTTP 429), the error is swallowed and the notification is lost. This is existing behavior, not a new gap, but worth noting.

5. **`alertType: "failed"` is never enqueued** — `check-window.ts:91` hardcodes `alertType: "missed"`. A `"failed"` alert type path does not appear to be connected in the current codebase, regardless of integration type.

6. **No tests anywhere for integrations** — neither the API route nor the web UI has test coverage. A Discord implementation would ship into the same untested surface.
