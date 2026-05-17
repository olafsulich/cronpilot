# Discord Integration PR — Synthesized Review

**Reviewers:** security-reviewer, perf-reviewer, test-reviewer
**Rounds:** 2 rounds of independent review + cross-challenge
**Final verdict:** **BLOCK**

---

## Final Verdict

All three reviewers block. There is no disagreement on outcome — only on severity labels for individual findings.

> **BLOCK — do not merge until all required changes below are addressed.**

---

## Findings

Findings are deduplicated across reviewers, sorted by severity. Where the same issue was raised by multiple reviewers, both owners are listed.

---

### CRITICAL — Worker reads `integration.config` — field does not exist, all alerts silently fail

- **Owner:** security-reviewer
- **Challenged:** No — not raised by other reviewers
- **Resolution:** Required fix before merge
- **File:** `apps/worker/src/processors/alert.ts:99`
- **Detail:** The Prisma `Integration` model column is named `configEncrypted` (confirmed `packages/db/prisma/schema.prisma:112`). The alert processor calls `decrypt(integration.config as string)`. The field `config` does not exist on the Prisma row — it evaluates to `undefined` at runtime. The `as string` cast suppresses TypeScript's protection. `decrypt(undefined)` throws, is caught at lines 100–106, and `continue`s — silently skipping every integration dispatch including Discord, Slack, PagerDuty, webhook, and email. Total notification failure for every team on every alert.
- **Required change:** Change `integration.config as string` to `integration.configEncrypted` at line 99. Remove the `as string` cast.

---

### HIGH — GET /integrations returns Discord webhook token via ineffective masking — spec violation

- **Owner:** security-reviewer (sec-HIGH-1), perf-reviewer (perf-MEDIUM-1, perf-LOW-2)
- **Challenged:** Not challenged — all reviewers agree on the fix
- **Resolution:** Required fix — drop `config` entirely from GET /integrations response
- **Files:** `apps/api/src/services/integrations.ts:52–62, 95–103`
- **Detail:** The spec (`docs/specs/discord-integration.md:53`) is explicit: `config` is "never returned — only `name`, `type`, `id`, `createdAt`." The `maskConfig` function returns the first 20 characters of the Discord webhook URL — always the static prefix `https://discord.com/` — leaving the actual secret token fully exposed. The implementation also does unnecessary AES-256-GCM decryption on every row in `listIntegrations` (no pagination, no `take` bound) despite the spec requiring config to be absent from the response entirely.
- **Required change:** Remove `config` from `mapIntegration`. Remove `decryptConfig` and `maskConfig` from the list path. Add `select: { id: true, teamId: true, type: true, name: true, createdAt: true }` to the `findMany` call. Update `docs/agent/api-routes.md` which incorrectly states config is decrypted for display.

---

### HIGH — `testIntegration` calls `fetch(webhookUrl)` with no SSRF guard and no timeout

- **Owner:** security-reviewer (sec-HIGH-2), perf-reviewer (perf-HIGH-1, perf-MEDIUM-2)
- **Challenged:** Not challenged on direction; perf-reviewer rate worker SSRF as MEDIUM instead of HIGH (see below)
- **Resolution:** Required fix
- **File:** `apps/api/src/services/integrations.ts:254–270`
- **Detail:** The Discord `testIntegration` branch calls `fetch(webhookUrl, ...)` with no `AbortSignal` and no URL re-validation. The Zod schema guards the URL at creation time, but `testIntegration` does not re-validate before calling. If the stored encrypted config were tampered with, the API server would make outbound requests to arbitrary hosts. Separately, no timeout means a hung Discord response holds the Fastify connection open indefinitely. The Slack, webhook, and PagerDuty branches have the same timeout defect.
- **Required changes:** (1) Assert `webhookUrl` matches `/^https:\/\/discord\.com\/api\/webhooks\//` before calling `fetch` — return `{ success: false, message: "Invalid webhook URL" }` on failure. (2) Add `signal: AbortSignal.timeout(5000)` to all four `fetch` calls in `testIntegration`.

---

### HIGH — `dispatchDiscord` in worker calls `axios.post(webhookUrl)` with no SSRF guard

- **Owner:** security-reviewer (sec-HIGH-3)
- **Challenged:** perf-reviewer challenged the severity — argues this requires prior key compromise (MEDIUM, not HIGH)
- **Resolution:** Implement the guard as defense-in-depth. Severity label: MEDIUM per perf-reviewer's challenge is noted, but the fix is required regardless. Security-reviewer's block on this finding collapses into the broader block.
- **File:** `apps/worker/src/processors/alert.ts:321–333`
- **Required change:** Assert `config.webhookUrl` matches `^https://discord\.com/api/webhooks/` before calling `axios.post`. Throw on failure to trigger BullMQ failure tracking.

---

### HIGH — "Mark rule errored on 4xx" is unimplemented — spec behavior and schema column both absent

- **Owner:** test-reviewer (test-HIGH-4), confirmed by perf-reviewer
- **Challenged:** Not challenged — all reviewers agree it is missing
- **Resolution:** Required: schema migration + implementation + test
- **Files:** `apps/worker/src/processors/alert.ts:321–333`, `packages/db/prisma/schema.prisma` (missing column)
- **Detail:** The spec states "On 4xx (invalid webhook), mark the rule as `errored` (same path as Slack)." The `AlertRule` model in Prisma has no `status` or `errored` column at all — the spec behavior cannot be implemented without a migration. The outer catch at `alert.ts:164–170` swallows all errors without status inspection. Silently failing 4xx dispatches means every subsequent alert job re-attempts the dead webhook, incurring unnecessary DB decrypt and outbound HTTP work indefinitely.
- **Required changes:** (1) Add `status` column to `AlertRule` in schema + migration. (2) In `dispatchDiscord`, inspect error status: 4xx → mark rule errored, do not retry; 5xx → rethrow so BullMQ retries. (3) Add tests for both paths.

---

### HIGH — Worker does not retry on 5xx — spec-explicit requirement unimplemented

- **Owner:** test-reviewer (test-HIGH-3), corroborated by perf-reviewer
- **Challenged:** Not challenged
- **Resolution:** Required fix + test
- **File:** `apps/worker/src/processors/alert.ts:321–333`
- **Detail:** `axios.post` does not throw on 5xx by default (requires `validateStatus` config). The outer catch logs and continues, so BullMQ never retries the job. The spec requires retry behavior matching Slack. A Discord outage would silently drop all alerts.
- **Required change:** Configure `validateStatus: (s) => s >= 200 && s < 300` on the axios call, or check `response.status` and throw on 5xx. Add `validateStatus` equivalent to Slack's dispatcher for parity.

---

### HIGH — "Stores encrypted config" test makes no DB assertion

- **Owner:** test-reviewer (test-HIGH-1)
- **Challenged:** Not challenged
- **Resolution:** Required test fix
- **File:** `apps/api/tests/integrations.discord.test.ts:27`
- **Required test:** After `POST /integrations`, query `prisma.integration.findFirst({ where: { type: 'discord' } })` directly and assert `row.configEncrypted !== webhookUrl` and is not parseable as plain JSON.

---

### HIGH — GET /integrations config assertion is trivially weak

- **Owner:** test-reviewer (test-HIGH-2), confirmed by security-reviewer
- **Challenged:** Not challenged — security-reviewer explicitly agrees
- **Resolution:** Required test fix
- **File:** `apps/api/tests/integrations.discord.test.ts:101`
- **Required test:** `expect(discord).not.toHaveProperty('config')` once config is removed from the response per the spec fix above.

---

### MEDIUM — Discord `monitorName` interpolated into content without escaping — `@everyone` injection

- **Owner:** security-reviewer (sec-MEDIUM-1)
- **Challenged:** test-reviewer challenged that the fix needs a corresponding test for `allowed_mentions` in the payload assertion — agrees the finding is valid
- **Resolution:** Required fix + test update
- **File:** `apps/worker/src/processors/alert.ts:329`
- **Required changes:** (1) Add `"allowed_mentions": { "parse": [] }` to Discord POST body. (2) Extend worker test assertion at `alert.discord.test.ts:93` to assert `payload.allowed_mentions` equals `{ parse: [] }`.

---

### MEDIUM — `channelName` unbounded user input — log injection and storage abuse risk

- **Owner:** security-reviewer (sec-MEDIUM-2, sec-LOW-2 consolidated)
- **Challenged:** Not challenged
- **Resolution:** Required fix
- **Files:** `apps/api/src/services/integrations.ts:149`, `packages/shared/src/types/api.ts:68–70`
- **Required change:** Add `.max(100)` to `channelName` in `DiscordConfigSchema` and `IntegrationCreateSchema`. Optionally restrict to printable characters.

---

### MEDIUM — testIntegration Discord branch has zero test coverage

- **Owner:** test-reviewer (test-MEDIUM-3), flagged by perf-reviewer as a condition of perf-HIGH-1
- **Challenged:** Not challenged
- **Resolution:** Required tests
- **File:** `apps/api/tests/integrations.discord.test.ts` (missing)
- **Required tests:** `POST /integrations/:id/test` for Discord: mock `fetch`, assert webhook called on success; assert `{ success: false, message: "Discord returned status N" }` on non-2xx.

---

### MEDIUM — No test for unauthenticated access to Discord integration routes

- **Owner:** test-reviewer (test-MEDIUM-1)
- **Challenged:** Not challenged
- **Resolution:** Required tests
- **Required tests:** `POST /integrations` and `GET /integrations` without Bearer token return 401.

---

### MEDIUM — Worker test does not assert timestamp portion of content

- **Owner:** test-reviewer (test-MEDIUM-2), perf-reviewer upgraded from LOW after challenge
- **Challenged:** perf-reviewer initially rated LOW; after test-reviewer's challenge, revised to MEDIUM — agreed
- **Resolution:** Required test extension
- **File:** `apps/worker/src/processors/alert.discord.test.ts:95`
- **Required test:** Extend content assertion to `.toMatch(/Last check-in: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)`.

---

### MEDIUM — `api-routes.md` contradicts spec on config exposure

- **Owner:** security-reviewer (sec-MEDIUM-2)
- **Challenged:** Not challenged — resolved by the HIGH fix above
- **Resolution:** Update `docs/agent/api-routes.md` to reflect "config never returned" contract when the GET fix is applied.

---

### LOW — `dispatchDiscord` timestamp is dispatch time, not actual last check-in time

- **Owner:** perf-reviewer (perf-LOW-1)
- **Challenged:** test-reviewer challenged that this requires a function signature change and there is no test for the timestamp — should be MEDIUM. perf-reviewer maintains LOW on severity but agrees a test is required.
- **Resolution:** Fix recommended but does not block merge independently; blocked by the same worker test gap (test-MEDIUM-2)
- **File:** `apps/worker/src/processors/alert.ts:329`
- **Required change (with the test gap fixed):** Replace `new Date().toISOString()` with `monitor.lastCheckinAt?.toISOString() ?? openAlert.openedAt.toISOString()`. Requires passing the monitor object or its `lastCheckinAt` into `dispatchDiscord`.

---

### LOW — `testIntegration` catch block returns raw `err.message` — internal topology leak

- **Owner:** security-reviewer (sec-LOW-1)
- **Challenged:** Not challenged
- **Resolution:** Recommended fix — does not block independently
- **File:** `apps/api/src/services/integrations.ts:273–275`
- **Required change:** Map network errors to `"Could not reach the webhook URL"`.

---

### LOW — `SlackConfigSchema.webhookUrl` accepts any URL — no HTTPS/domain enforcement (pre-existing)

- **Owner:** security-reviewer (sec-MEDIUM-3 / sec-LOW-2 consolidated)
- **Challenged:** Not challenged
- **Resolution:** Address alongside this PR since Discord sets the correct precedent
- **File:** `apps/api/src/services/integrations.ts:12–15`
- **Required change:** Add `.regex(/^https:\/\/hooks\.slack\.com\/services\//)` to `SlackConfigSchema.webhookUrl`.

---

### LOW — Web form test does not verify `channelName` is sent on submit

- **Owner:** test-reviewer (test-LOW-1)
- **Challenged:** Not challenged
- **Resolution:** Recommended test addition
- **File:** `apps/web/src/test/integrations-discord-form.test.tsx:82`

---

## Required Changes Before Merge

In priority order:

1. **Fix CRITICAL field-name bug** — `integration.config` → `integration.configEncrypted` in `alert.ts:99`
2. **Drop config from GET /integrations** — remove `decryptConfig`/`maskConfig` from list path, add `select` to `findMany`
3. **Add SSRF guard to `testIntegration`** — regex check before `fetch` + `AbortSignal.timeout(5000)` on all four branches
4. **Add SSRF guard to `dispatchDiscord`** — regex check before `axios.post`
5. **Schema migration + implementation for 4xx rule-errored behavior** — `AlertRule.status` column, 4xx detection in dispatch, no-retry path
6. **Implement 5xx retry** — `validateStatus` on axios or explicit status check + rethrow
7. **Fix GET /integrations test assertion** — `expect(discord).not.toHaveProperty('config')`
8. **Fix "stores encrypted config" test** — add real DB query assertion
9. **Add `allowed_mentions: { parse: [] }` to Discord POST** + test assertion
10. **Add `testIntegration` Discord tests** (success + failure)
11. **Add unauthenticated route tests** (401 for POST and GET)
12. **Extend worker content assertion** to include timestamp pattern

---

## Reviewer Verdict Summary

| Reviewer | Round 1 | Round 2 (revised) |
|---|---|---|
| security-reviewer | block | block (unchanged) |
| perf-reviewer | approve-with-changes | **block** (revised up) |
| test-reviewer | block | block (unchanged) |

**Aggregated: BLOCK**
