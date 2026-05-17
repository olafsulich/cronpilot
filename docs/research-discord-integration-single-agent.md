# Research: Slack Integration Pattern for Discord Clone

Mapping of the existing Slack integration across all three layers (API, worker, web). All findings include exact file and line references. No Discord changes are proposed here.

---

## Area 1 — Slack in the API Layer

### Route handler

`apps/api/src/routes/integrations.ts` registers four endpoints via a Fastify plugin:

```ts
// integrations.ts:24-31
fastify.post("/integrations", { preHandler }, async (request, reply) => {
    const parsed = CreateIntegrationSchema.safeParse(request.body);
    if (!parsed.success) {
        const msg = parsed.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        throw new AppError("VALIDATION_ERROR", msg, 400);
    }
    const integration = await createIntegration(request.team.id, parsed.data);
    return reply.status(201).send({ data: integration });
});
```

`CreateIntegrationSchema` is imported from `../services/integrations` (the **API-local** schema), not from `@cronpilot/shared`. The handler delegates all logic to the service layer and returns 201 on success.

Additional endpoints: `GET /integrations` (list), `DELETE /integrations/:id`, `POST /integrations/:id/test`.

### Validation schema (API layer)

`apps/api/src/services/integrations.ts:12-36` defines a **nested** discriminated union:

```ts
export const SlackConfigSchema = z.object({
    webhookUrl: z.string().url(),
    channel: z.string().optional(),
});

export const CreateIntegrationSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("slack"), config: SlackConfigSchema }),
    z.object({ type: z.literal("pagerduty"), config: PagerDutyConfigSchema }),
    z.object({ type: z.literal("webhook"), config: WebhookConfigSchema }),
    z.object({ type: z.literal("email"), config: EmailConfigSchema }),
]);
```

Slack is discriminated as `type: "slack"` with config fields nested under a `config` key.

### createIntegration service function

`apps/api/src/services/integrations.ts:102-121`:

```ts
export async function createIntegration(teamId, input): Promise<IntegrationResponse> {
    const configJson = JSON.stringify(input.config);   // line 106
    const encryptedConfig = encrypt(configJson);        // line 107
    const name = buildIntegrationName(input);           // line 109
    const integration = await prisma.integration.create({
        data: { teamId, type: input.type, name, encryptedConfig },
    });
    return mapIntegration(integration);
}
```

`buildIntegrationName` at line 123 builds the display name: Slack integrations get `"Slack"` or `"Slack (#channel)"`.

### maskConfig — response redaction

`apps/api/src/services/integrations.ts:64-88`: Sensitive fields are partially masked before returning to the client. For Slack, `webhookUrl` is truncated to 20 chars + `"..."`.

### testIntegration

`apps/api/src/services/integrations.ts:146-242`: For Slack (`integration.type === "slack"`), decrypts config and issues a `fetch` POST to `config.webhookUrl` with a static test message. Returns `{ success: true }` on 2xx.

### Encryption helper

`apps/api/src/lib/encryption.ts`:

```ts
// encrypt: line 23
export function encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    const payload = { iv: iv.toString("base64"), tag: tag.toString("base64"), data: encrypted.toString("base64") };
    return Buffer.from(JSON.stringify(payload)).toString("base64");
}

// decrypt: line 37 — identical inverse
```

Key source: `ENCRYPTION_KEY` env var, must be 32-byte hex (64 hex chars). The API exposes both `encrypt` and `decrypt`; the worker (`apps/worker/src/lib/encryption.ts`) exposes only `decrypt` using the same algorithm.

### Integration Prisma model

`packages/db/prisma/schema.prisma:107-120`:

```prisma
model Integration {
  id              String   @id @default(cuid())
  teamId          String
  type            String
  name            String
  configEncrypted String        // encrypted JSON blob, all integration types
  createdAt       DateTime @default(now())

  team       Team        @relation(fields: [teamId], references: [id], onDelete: Cascade)
  alertRules AlertRule[]

  @@index([teamId])
  @@index([teamId, type])
}
```

There are no per-type fields — all integration config lives in the single `configEncrypted` column as an AES-256-GCM encrypted JSON string.

### Integration tests for Slack creation

No integration tests exist for the integrations routes. The only API test file is `apps/api/tests/auth.test.ts`, which covers `POST /auth/signup` and `POST /auth/login`. It uses `server.inject()` against a real database and Redis — no mocking. Tests for integration creation would follow this same real-DB pattern.

---

## Area 2 — Slack in the Worker Layer

### Queue definition

`packages/shared/src/queues.ts:1-8`:

```ts
export const QUEUES = {
    CHECK_WINDOW: "check-window",
    ALERT: "alert",
    ...
} as const;

export interface AlertJobData {
    monitorId: string;
    teamId: string;
    alertType: "missed" | "failed";
    checkinId?: string;
}
```

`alertQueue` is instantiated in both the API (`apps/api/src/lib/queues.ts:8`) and the worker (`apps/worker/src/lib/queues.ts:7`) from `QUEUES.ALERT = "alert"`.

### Alert job enqueuing (trigger)

`apps/worker/src/processors/check-window.ts:86-96`:

```ts
const alertJobData: AlertJobData = { monitorId, teamId, alertType: "missed" };
await alertQueue.add(QUEUES.ALERT, alertJobData, {
    jobId: `alert:${alertId}`,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
});
```

The check-window processor runs when a cron window closes without a ping. It either creates a new `Alert` record (type `missed`, status `open`) or increments `failureCount` on an existing open alert, then enqueues the alert job.

### Worker registration

`apps/worker/src/worker.ts:50-52`:

```ts
const alertWorker = new Worker<AlertJobData>(
    QUEUES.ALERT,
    async (job) => processAlert(job),
    { connection, concurrency: WORKER_CONCURRENCY },
);
```

No explicit retry options are set — BullMQ defaults apply (0 retries).

### processAlert — full dispatch flow

`apps/worker/src/processors/alert.ts:24-168`:

1. **Load monitor** (line 34): `prisma.monitor.findUnique` with `alertRules.integration` included
2. **Guards** (lines 45-69): skip if monitor missing, teamId mismatch, monitor paused, or no open alert
3. **Deduplication** (line 81): `failureCount === 1 || failureCount % rule.notifyAfter === 0` — notifies on first failure then every Nth
4. **Decrypt config** (line 98): `decrypt(integration.config as string)` — decrypts to JSON, parses to `Record<string, unknown>`
5. **Dispatch switch** (lines 110-154): routes on `integration.type`
6. **Error isolation** (lines 160-166): per-integration try/catch — one integration failure does not block others; errors are logged, not re-thrown

### dispatchSlack

`apps/worker/src/processors/alert.ts:170-213`:

```ts
async function dispatchSlack(config, monitorName, alertType, failureCount, dashboardUrl, jobLog) {
    const emoji = alertType === "missed" ? "⏰" : "❌";
    const verb = alertType === "missed" ? "hasn't checked in" : "reported a failure";
    const suffix = failureCount > 1 ? ` (failure #${failureCount})` : "";

    const payload = {
        text: `${emoji} Monitor *${monitorName}* ${verb}${suffix}`,
        attachments: [{
            color: "#FF0000",
            fields: [
                { title: "Monitor", value: monitorName, short: true },
                { title: "Consecutive failures", value: String(failureCount), short: true },
            ],
            actions: [{ type: "button", text: "View in dashboard", url: dashboardUrl }],
            footer: "Cronpilot",
            ts: Math.floor(Date.now() / 1000),
        }],
    };

    await axios.post(config.webhookUrl, payload, { timeout: 10_000 });
}
```

The payload uses Slack's legacy attachments format (not Block Kit). `config.webhookUrl` is the only Slack-specific field required at dispatch time.

### Retry / error semantics

- **No retry policy** is configured on the alert Worker (`worker.ts:50`) — BullMQ default is 0 retries.
- `removeOnFail: { count: 50 }` on the enqueue call retains the last 50 failed jobs for debugging.
- 4xx vs 5xx: `axios.post` throws on any non-2xx status; there is no differentiation between 4xx and 5xx — both result in the caught error being logged and the integration being skipped.
- The `worker.on("failed")` handler at `worker.ts:89` emits a structured error log.

### Shared message-formatting utilities

There are no shared message-formatting utilities in `packages/shared/`. All formatting is inline inside each `dispatch*` function.

---

## Area 3 — Slack in the Web Layer

### Route

`apps/web/src/app/(dashboard)/settings/integrations/page.tsx` — Next.js App Router route under the `(dashboard)` layout group.

### IntegrationsPage list component

`page.tsx:33-140` — marked `"use client"`. Key patterns:

```ts
// page.tsx:41
const { data: integrations = [], isLoading, mutate } = useSWR<Integration[]>("/integrations", fetcher);

// fetcher at line 13
function fetcher(path: string) {
    return apiClient.get<Integration[]>(path);
}
```

- `INTEGRATION_ICONS` record at line 17: maps `"slack" → <Hash />`, `"pagerduty" → <Shield />`, `"webhook" → <Globe />`, `"email" → <Mail />`
- Delete: `apiClient.delete(\`/integrations/${id}\`)` then `mutate()` (line 44-49)
- "Add integration" button opens `AddIntegrationModal` (line 129)

### AddIntegrationModal and Slack form

`page.tsx:142-338`:

- Type selector: hardcoded array `["slack", "pagerduty", "webhook", "email"]` at line 196
- Validation: `useForm<IntegrationCreateParams>({ resolver: zodResolver(IntegrationCreateSchema) })` at lines 157-159
- Both schema and type from `@cronpilot/shared`
- Submit at line 171: `apiClient.post("/integrations", values)` — plain API call, **no server action**
- Slack fields (lines 233-258): `webhookUrl` (url input, placeholder `https://hooks.slack.com/services/...`) and `channel` (text input, placeholder `#alerts`)
- `name` field is common to all types (line 224)

### IntegrationCreateSchema (shared / web schema)

`packages/shared/src/types/api.ts:40-63`:

```ts
export const IntegrationCreateSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("slack"),
        name: z.string().min(1).max(255),
        webhookUrl: z.string().url(),
        channel: z.string().min(1),
    }),
    // pagerduty, webhook, email ...
]);
```

This is a **flat** structure (no nested `config` key). `name` is required.

### Integration types in shared

`packages/shared/src/types/integration.ts:1-37`:

```ts
export type IntegrationType = "slack" | "pagerduty" | "webhook" | "email";

export interface SlackConfig {
    webhookUrl: string;
    channel: string;
}

export type IntegrationConfig = SlackConfig | PagerDutyConfig | WebhookConfig | EmailConfig;

export interface Integration {
    id: string;
    teamId: string;
    type: IntegrationType;
    name: string;
    config: IntegrationConfig;
    createdAt: Date;
}
```

`IntegrationType` is a plain string union — adding `"discord"` here is the single shared-types change.

### Existing web unit tests

The only web test is `apps/web/src/hooks/use-team.test.ts`. It uses `vi.mock("swr")` and `vi.mock("@/lib/api")` to mock SWR and the API client, then uses `renderHook` from `@testing-library/react`. There are no tests for the integrations page or modal.

---

## Code References

| Symbol | Location |
|---|---|
| Route handler `POST /integrations` | `apps/api/src/routes/integrations.ts:24` |
| `CreateIntegrationSchema` (API, nested) | `apps/api/src/services/integrations.ts:31` |
| `SlackConfigSchema` | `apps/api/src/services/integrations.ts:12` |
| `createIntegration` service | `apps/api/src/services/integrations.ts:102` |
| `buildIntegrationName` | `apps/api/src/services/integrations.ts:123` |
| `maskConfig` | `apps/api/src/services/integrations.ts:64` |
| `testIntegration` (Slack path) | `apps/api/src/services/integrations.ts:160` |
| `encrypt` / `decrypt` (API) | `apps/api/src/lib/encryption.ts:23,37` |
| `decrypt` (worker) | `apps/worker/src/lib/encryption.ts:21` |
| `Integration` Prisma model | `packages/db/prisma/schema.prisma:107` |
| `configEncrypted` field | `packages/db/prisma/schema.prisma:112` |
| `AlertRule` Prisma model | `packages/db/prisma/schema.prisma:122` |
| `QUEUES.ALERT` definition | `packages/shared/src/queues.ts:3` |
| `AlertJobData` shape | `packages/shared/src/queues.ts:20` |
| `alertQueue` (API) | `apps/api/src/lib/queues.ts:8` |
| Alert job enqueue (trigger) | `apps/worker/src/processors/check-window.ts:92` |
| `alertWorker` registration | `apps/worker/src/worker.ts:50` |
| `processAlert` entry | `apps/worker/src/processors/alert.ts:24` |
| Deduplication guard | `apps/worker/src/processors/alert.ts:81` |
| Config decrypt in processor | `apps/worker/src/processors/alert.ts:98` |
| `switch (integration.type)` | `apps/worker/src/processors/alert.ts:110` |
| `dispatchSlack` | `apps/worker/src/processors/alert.ts:170` |
| `axios.post` to Slack webhook | `apps/worker/src/processors/alert.ts:213` |
| `IntegrationType` union | `packages/shared/src/types/integration.ts:1` |
| `SlackConfig` interface | `packages/shared/src/types/integration.ts:3` |
| `IntegrationCreateSchema` (shared, flat) | `packages/shared/src/types/api.ts:40` |
| `IntegrationCreateParams` type | `packages/shared/src/types/api.ts:65` |
| `IntegrationsPage` component | `apps/web/src/app/(dashboard)/settings/integrations/page.tsx:33` |
| `INTEGRATION_ICONS` record | `apps/web/src/app/(dashboard)/settings/integrations/page.tsx:17` |
| `AddIntegrationModal` | `apps/web/src/app/(dashboard)/settings/integrations/page.tsx:142` |
| Type selector array | `apps/web/src/app/(dashboard)/settings/integrations/page.tsx:196` |
| Slack form fields | `apps/web/src/app/(dashboard)/settings/integrations/page.tsx:233` |
| API auth test (pattern reference) | `apps/api/tests/auth.test.ts:1` |

---

## Open Questions

These are gaps or inconsistencies that would need to be resolved before or during a Discord implementation:

1. **Schema mismatch between web and API.** The web sends a flat payload `{ type: "slack", name, webhookUrl, channel }` validated by `IntegrationCreateSchema` from shared (`packages/shared/src/types/api.ts:40`). The API validates with a nested schema `{ type: "slack", config: { webhookUrl, channel } }` from `CreateIntegrationSchema` in `apps/api/src/services/integrations.ts:31`. These structures are incompatible — one must be wrong, or a translation layer is missing. Any Discord implementation must resolve this first.

2. **Missing `IntegrationResponse` type.** `apps/api/src/services/integrations.ts:2` imports `IntegrationResponse` from `@cronpilot/shared`, but this type is not exported from `packages/shared/src/index.ts`. This is a latent compile error; the type likely needs to be added to shared or the import needs to be changed to use the existing `Integration` interface.

3. **Prisma field name inconsistency.** The schema field is `configEncrypted` (`schema.prisma:112`), but:
   - `alert.ts:98` reads `integration.config` (non-existent field)
   - `services/integrations.ts:51` reads `integration.encryptedConfig` (non-existent field)
   Both references would fail at runtime. The correct field name must be used consistently in a Discord implementation.

4. **`EmailConfig.address` vs `EmailConfigSchema.email`.** The shared `EmailConfig` interface has field `address` (`types/integration.ts`), but the API's `EmailConfigSchema` validates field `email` (`services/integrations.ts:28`). Same mismatch pattern as above.

5. **No retry policy on the alert worker.** The `alertWorker` has no `attempts` or `backoff` options (`worker.ts:50`). Any transient Discord API error (rate limits, 5xx) will permanently fail the job. A Discord Webhook API may need rate-limit handling (429) that the current Slack path doesn't handle.

6. **No integration-specific tests.** No integration tests cover `POST /integrations` (create, validate, encrypt), `GET /integrations` (list, mask), or `POST /integrations/:id/test`. Adding Discord means writing the first tests for these routes — the pattern to follow is `apps/api/tests/auth.test.ts` (real DB, `server.inject()`).

7. **No web tests for the integrations UI.** `AddIntegrationModal` and `IntegrationsPage` have no test coverage. The pattern to follow is `apps/web/src/hooks/use-team.test.ts` (jsdom, `vi.mock("swr")`, `vi.mock("@/lib/api")`).

8. **Type selector is a hardcoded array.** `page.tsx:196` iterates `["slack", "pagerduty", "webhook", "email"]` — adding Discord requires appending `"discord"` to this array and adding an entry to `INTEGRATION_ICONS` and `INTEGRATION_LABELS`.

9. **No shared dispatch utilities.** Each `dispatch*` function builds its own payload inline. Discord uses a different message format (embeds, not Slack attachments), so `dispatchSlack` cannot be reused — a new `dispatchDiscord` function is needed alongside it in `alert.ts`.
