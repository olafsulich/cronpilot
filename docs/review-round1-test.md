# Test Coverage Review — Discord Integration PR

## Coverage Matrix

| Spec behavior | Test exists? | File |
|---|---|---|
| POST /integrations creates discord integration, returns 201 | Yes | `apps/api/tests/integrations.discord.test.ts` |
| Config is encrypted at rest in DB (not plaintext) | Partial — response only, no DB query | `apps/api/tests/integrations.discord.test.ts:27` |
| webhookUrl Zod regex rejects non-Discord URLs (API) | Yes | `apps/api/tests/integrations.discord.test.ts:69` |
| channelName optional, name auto-generated with/without it | Yes | `apps/api/tests/integrations.discord.test.ts:51` |
| GET /integrations returns discord entry, config field absent | Partial — assertion trivially weak | `apps/api/tests/integrations.discord.test.ts:86` |
| Unauthenticated POST /integrations returns 401 | No | missing |
| Unauthenticated GET /integrations returns 401 | No | missing |
| Worker: POST to webhookUrl with correct `content` message | Partial — timestamp portion untested | `apps/worker/src/processors/alert.discord.test.ts:81` |
| Worker: "missed" alert maps to "late" status | Yes | `apps/worker/src/processors/alert.discord.test.ts:81` |
| Worker: "failed" alert maps to "down" status | Yes | `apps/worker/src/processors/alert.discord.test.ts:98` |
| Worker: notifyAfter threshold deduplication | Yes | `apps/worker/src/processors/alert.discord.test.ts:127` |
| Worker: retry on 5xx (spec-explicit requirement) | No | missing |
| Worker: no retry + mark rule errored on 4xx (spec-explicit) | No | missing |
| Worker: isolation — one failure does not block other integrations | Yes | `apps/worker/src/processors/alert.discord.test.ts:113` |
| Web form: Discord option in type selector | Yes | `apps/web/src/test/integrations-discord-form.test.tsx:50` |
| Web form: webhookUrl field appears when Discord selected | Yes | `apps/web/src/test/integrations-discord-form.test.tsx:56` |
| Web form: submit sends correct payload to apiClient.post | Yes | `apps/web/src/test/integrations-discord-form.test.tsx:63` |
| Web form: client-side validation rejects non-Discord URL | Yes | `apps/web/src/test/integrations-discord-form.test.tsx:92` |
| POST /integrations/:id/test for discord type | No | missing |

---

## Findings

### test-HIGH-4: "Mark rule errored on 4xx" is unimplemented and untested — spec behavior entirely absent

- **File:** `apps/worker/src/processors/alert.discord.test.ts` (missing), `apps/worker/src/processors/alert.ts:321–333`
- **Severity:** HIGH
- **Detail:** The spec states "On 4xx (invalid webhook), mark the rule as `errored` (same path as Slack)." Two problems compound each other. First, `dispatchDiscord` in `apps/worker/src/processors/alert.ts` has no 4xx detection — `axios.post` errors are caught at the outer loop level and swallowed, with no call to `prisma.alertRule.update`. Second, and more fundamental: the `AlertRule` model in `packages/db/prisma/schema.prisma` has no `status` or `errored` column at all. There is no field to write to. The spec requires behavior that cannot exist without a schema migration. No test covers this path.
- **Required test:** A test in `apps/worker/src/processors/alert.discord.test.ts` where `axios.post` rejects with an AxiosError whose response status is 400, asserting `prisma.alertRule.update` was called with the errored status. This test will correctly fail until both the migration and the implementation are added.

---

### test-HIGH-3: Worker missing retry test on 5xx — spec-explicit requirement

- **File:** `apps/worker/src/processors/alert.discord.test.ts` (missing)
- **Severity:** HIGH
- **Detail:** The spec's test requirements explicitly state "assert retry on 5xx." The `dispatchDiscord` function at `apps/worker/src/processors/alert.ts:321–333` wraps `axios.post` with no status-check. A 500 response from Discord resolves normally (axios only rejects on network failure, not on 5xx by default unless `validateStatus` is configured). The outer try/catch at line 164 then logs and continues, meaning BullMQ never retries the job. The spec says retry behavior must match Slack. No test covers this.
- **Required test:** A test where `axios.post` either rejects (simulating network failure) or resolves with `{ status: 500 }`, asserting the behavior matches what Slack does — either re-throwing to trigger BullMQ retry, or explicitly configuring `validateStatus` to throw on 5xx.

---

### test-HIGH-1: "Stores encrypted config" test never queries the DB

- **File:** `apps/api/tests/integrations.discord.test.ts:27`
- **Severity:** HIGH
- **Detail:** The test name is "returns 201 and stores encrypted config" but the test only inspects the HTTP response. It never queries the database to confirm the `configEncrypted` column contains ciphertext. The spec says "assert config is encrypted in DB." If `encrypt()` were accidentally bypassed, this test would still pass. No `vi.mock` is present (correctly), meaning the real DB is available — the test simply does not use it.
- **Required test:** After `POST /integrations`, import `prisma` (real DB, no mock), call `prisma.integration.findFirst({ where: { type: 'discord' } })`, and assert that `row.configEncrypted` does not equal the raw `webhookUrl` string and is not parseable as plain JSON.

---

### test-HIGH-2: GET /integrations config assertion is trivially weak

- **File:** `apps/api/tests/integrations.discord.test.ts:101`
- **Severity:** HIGH
- **Detail:** The assertion is `expect(discord?.config?.webhookUrl).not.toBe("https://discord.com/api/webhooks/123456789/abcdefg")`. This passes whether config is absent, config is masked, or `discord` is `undefined`. The spec says "The `config` field is **never** returned — only `name`, `type`, `id`, `createdAt`." The test provides no meaningful signal: a bug that returned the full unmasked URL would also not be caught (the test only checks `.not.toBe` the specific seeded URL, so a slightly different URL would still pass).
- **Required test:** If spec intent is "no config in response": `expect(discord).not.toHaveProperty('config')`. If the actual behavior (masked config) is intentional: assert `discord.config.webhookUrl` matches `^https://discord\.com/api/webhooks/.*\.\.\.` and does not contain the token segment.

---

### test-MEDIUM-3: testIntegration Discord branch has zero test coverage

- **File:** `apps/api/tests/integrations.discord.test.ts` (missing), `apps/api/src/services/integrations.ts:254–270`
- **Severity:** MEDIUM
- **Detail:** The `testIntegration` function's Discord branch is new code that POSTs a test message to the webhook. It has no test at all. Two behaviors are untested: success path (Discord returns 2xx) and failure path (Discord returns non-2xx, which must produce `{ success: false, message: "Discord returned status N" }`).
- **Required tests:**
  - `POST /integrations/:id/test` for a discord integration with `fetch` mocked to return 204: assert `{ data: { success: true } }`.
  - Same endpoint with `fetch` returning 403: assert `{ data: { success: false, message: "Discord returned status 403" } }`.

---

### test-MEDIUM-1: No test for unauthenticated access to Discord integration routes

- **File:** `apps/api/tests/integrations.discord.test.ts` (missing)
- **Severity:** MEDIUM
- **Detail:** No test exercises `POST /integrations` or `GET /integrations` without an `Authorization` header. The `authenticate` preHandler is the primary auth boundary and should be tested for every new route group.
- **Required tests:** `POST /integrations` and `GET /integrations` without Bearer token both return 401.

---

### test-MEDIUM-2: Content assertion omits the timestamp segment of the message

- **File:** `apps/worker/src/processors/alert.discord.test.ts:95`
- **Severity:** MEDIUM
- **Detail:** The spec defines the full message format: `"🚨 Monitor \`{name}\` is {status}. Last check-in: {timestamp}."` The test asserts only the first clause. The "Last check-in: {timestamp}" segment is entirely untested.
- **Required test:** Extend the content assertion to `.toMatch(/Last check-in: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)` in both the "missed" and "failed" test cases.

---

### test-LOW-1: Web form test does not verify channelName is sent on submit

- **File:** `apps/web/src/test/integrations-discord-form.test.tsx:82`
- **Severity:** LOW
- **Detail:** The submit test uses `expect.objectContaining({ type: "discord", webhookUrl: "..." })` and does not assert `channelName` is included when the field is filled.
- **Required test:** Add a test case where the user also fills the channel name field, asserting `expect.objectContaining({ channelName: "#oncall" })` is present in the call to `apiClient.post`.

---

## Verdict

**block**

Four HIGH-severity test gaps drive the block: (1) the spec-required "retry on 5xx" worker behavior is untested — and the current implementation likely does not actually retry; (2) the spec-required "mark rule errored on 4xx" behavior is both unimplemented (no `status` column on `AlertRule` in the schema) and untested; (3) the "stores encrypted config" test makes no DB assertion — a plaintext storage bug would pass; (4) the GET /integrations config assertion is trivially weak and provides no protection against token exposure.

Items 1 and 2 are not "add a test for working code" situations — the spec behavior does not exist in the implementation.

## Round 2 Challenges

### Challenge to security-reviewer — sec-HIGH-2 and sec-HIGH-3 (SSRF via re-validation)

Both findings are technically correct. My challenge: neither finding includes a test requirement. If the SSRF fixes land (re-validate webhookUrl before calling fetch/axios), there is no test asserting the validation runs or rejects non-Discord URLs. My finding test-HIGH-4 partially overlaps: the worker test needs a case where `dispatchDiscord` is given a corrupt stored URL (e.g., `http://internal-host/`) and throws rather than dispatching. Without that test, the fix can be silently reverted. The security reviewer must require a corresponding unit test in `apps/worker/src/processors/alert.discord.test.ts` as a condition of sec-HIGH-3.

### Challenge to security-reviewer — sec-MEDIUM-1 (Discord mention injection)

The finding is valid. My challenge: the worker test asserts only the `content` field, never the full payload object. If `allowed_mentions: { parse: [] }` is added to the Discord POST payload to prevent mention abuse, there is no test asserting it is present. The fix can silently regress. The security reviewer should require a test change: extend the assertion at `apps/worker/src/processors/alert.discord.test.ts:93` to assert `payload.allowed_mentions` equals `{ parse: [] }`. Without that, sec-MEDIUM-1's fix is unverifiable.

### Challenge to performance reviewer — perf-LOW-1 (dispatch timestamp accuracy)

The suggestion to replace `new Date().toISOString()` with `monitor.lastCheckinAt` is reasonable, but perf-LOW-1 is mislabeled as a perf issue — it is a correctness issue affecting user-visible content. More importantly, `lastCheckinAt` is not currently in scope in `dispatchDiscord` (the function receives only `config`, `monitorName`, `alertType`, and `jobLog`). Implementing the fix requires a function signature change. And my finding test-MEDIUM-2 establishes there is no test for the timestamp portion of the message at all, meaning any timestamp change — correct or incorrect — ships unverified. Rate this MEDIUM (user-visible correctness) and require the worker test to assert the specific timestamp source.

### Challenge to performance reviewer — perf-HIGH-1 (no timeout on testIntegration fetch)

Correctly rated HIGH. My challenge: this finding needs a test requirement attached. The `POST /integrations/:id/test` endpoint has zero coverage for Discord (my finding test-MEDIUM-3). A timeout fix and the error-handling branch that produces `"Discord returned status N"` are both untested code paths. The performance reviewer should have flagged the missing test as a condition of the fix. perf-HIGH-1 and test-MEDIUM-3 must be resolved together.

### Revised verdict

**block** — unchanged. The combined analysis from all three reviewers strengthens the block. The CRITICAL field-name bug identified by the security reviewer (integration.config vs configEncrypted) means zero notifications fire in production today. The missing AlertRule schema column means the 4xx errored-rule behavior cannot be implemented without a migration. These are architectural gaps, not just code quality issues.
