# Performance Review — Discord Integration PR

## Findings

### perf-HIGH-1: `testIntegration` makes a synchronous external HTTP call with no timeout

- **File:** `apps/api/src/services/integrations.ts`, lines 254–269 (Discord branch)
- **Severity:** HIGH
- **Detail:** The Discord `testIntegration` path calls `fetch(webhookUrl, ...)` with no `AbortSignal` or timeout. Discord's webhook endpoint can respond with 429s that take several seconds, and a hung connection holds the Fastify worker thread open indefinitely. Under load, a coordinated set of slow test requests can exhaust the server's connection pool. The Slack and webhook branches had the same defect; this PR adds a third instance, tripling the attack surface.
- **Required change:** Wrap all `fetch` calls in `testIntegration` (Slack, webhook, Discord) with `AbortSignal.timeout(5000)`.

---

### perf-MEDIUM-1: `listIntegrations` decrypts every config on every call — unbounded decrypt loop with no pagination

- **File:** `apps/api/src/services/integrations.ts`, lines 109–115 and 52–62
- **Severity:** MEDIUM
- **Detail:** `listIntegrations` calls `prisma.integration.findMany` with no `take` limit, then maps every result through `decryptConfig` (AES-256-GCM decrypt + JSON.parse) and `maskConfig`. This PR adds a fourth decrypt-plus-mask branch and normalizes the pattern. The spec says `GET /integrations` should return only `name`, `type`, `id`, `createdAt` — no config — which would eliminate the decrypt loop entirely. The implementation diverges from the spec.
- **Required change:** Either (a) follow the spec and strip config from the list response, or (b) add `take: 50` as a default limit. Option (a) is better on both perf and security grounds.

---

### perf-MEDIUM-2: `dispatchDiscord` uses `axios` while `testIntegration` for Discord uses native `fetch` — two different connection pools

- **Files:** `apps/worker/src/processors/alert.ts` line 332 (axios); `apps/api/src/services/integrations.ts` lines 256–266 (fetch)
- **Severity:** MEDIUM
- **Detail:** The worker uses axios with `timeout: 10_000` (correct); the API's test path uses `fetch` with no timeout. The inconsistency makes it easy to miss the diverging safety properties. Pre-existing Slack and PagerDuty dispatch in the worker also use axios, so the worker is internally consistent — the gap is in the new API path.
- **Required change:** Add `AbortSignal.timeout(5000)` to the Discord `testIntegration` `fetch` call. Secondary: consider routing test-notification dispatch through the worker queue rather than inline in the API.

---

### perf-LOW-1: `dispatchDiscord` timestamp reflects dispatch time, not failure time

- **File:** `apps/worker/src/processors/alert.ts`, line 329
- **Severity:** LOW
- **Detail:** `new Date().toISOString()` is used as the "Last check-in" timestamp. If the job queued for 60+ seconds, this timestamp is misleading. `monitor.lastCheckinAt` (already in scope) is more accurate.
- **Required change:** Replace `new Date().toISOString()` with `monitor.lastCheckinAt?.toISOString() ?? openAlert.openedAt.toISOString()`.

---

### perf-LOW-2: `listIntegrations` selects `configEncrypted` for all rows even when the response omits it

- **File:** `apps/api/src/services/integrations.ts`, line 110
- **Severity:** LOW
- **Detail:** `prisma.integration.findMany({ where: { teamId } })` selects all columns including `configEncrypted` (200–400 bytes each). For a team with 50 integrations, this is 10–20 KB of unnecessary ciphertext from Postgres per request.
- **Required change:** If list response is corrected to omit config, add `select: { id: true, teamId: true, type: true, name: true, createdAt: true }` to the `findMany` call.

---

## Verdict

**approve-with-changes**

The Discord worker dispatch (`dispatchDiscord`) is structurally sound — it mirrors the Slack pattern, has a 10-second axios timeout, and runs behind BullMQ's retry/backoff. It will not block the alert queue under normal conditions.

The blocking issue is the missing timeout on `testIntegration`'s `fetch` call (perf-HIGH-1). This must be fixed before merge. The MEDIUM findings (decrypt loop, spec divergence on config exposure) are pre-existing but this PR normalizes the pattern without correcting it; at minimum add `take: 50` to `listIntegrations`.

**Files reviewed:**
- `apps/api/src/services/integrations.ts` (lines 109–115, 254–269)
- `apps/worker/src/processors/alert.ts` (lines 321–333)
- `packages/db/prisma/schema.prisma` (no issues — indexes adequate)

## Round 2 Challenges

### Challenge to security-reviewer — sec-HIGH-2 and sec-HIGH-3 (SSRF via stored URL)

**Conceding partially on sec-HIGH-2 (`testIntegration`):** The API test path is user-invocable on demand. Even if the threat requires a compromised DB or encryption key, the in-request re-validation is cheap and the path is not hot. This finding is valid: add the regex check.

**Challenging sec-HIGH-3 (`dispatchDiscord` in the worker) as over-stated severity:** The threat model requires the attacker to have already compromised the encryption key or written directly to the Postgres `configEncrypted` column. Both of these are higher-severity incidents than any SSRF they enable. Adding a regex check in the worker provides defense-in-depth, but calling this a standalone HIGH-severity issue overstates the risk. The encryption key is the actual trust boundary. I'd rate this MEDIUM (defense-in-depth) rather than HIGH (standalone exploitable). It's still worth adding, but it should not block the PR independently — sec-HIGH-2 covers the more realistic attack surface (user-triggered, no key compromise needed).

**Conceding sec-MEDIUM-1 (mention injection via `@everyone`):** The security reviewer is correct that `allowed_mentions: { parse: [] }` costs nothing and eliminates a real annoyance/abuse vector. It should be required.

**No dispute on sec-HIGH-1 (masking ineffective):** The first 20 characters of a Discord webhook URL are always `https://discord.com/` — the masking is cosmetic. The security reviewer's fix (drop config from the response entirely) also resolves the decrypt loop I flagged, making it doubly worth doing.

### Challenge to test-reviewer — test-HIGH-4 (4xx rule-errored behavior)

The test reviewer correctly identifies that the spec says "On 4xx (invalid webhook), mark the rule as `errored`" — and that this behavior is entirely unimplemented, not just untested. Supporting this finding: silently swallowing 4xx errors means every subsequent alert job for that integration will re-attempt the dead webhook, decrypt the config, make an outgoing HTTP call, and get a 400/404 — all wasted work. Marking the rule errored on 4xx stops the bleed. This aligns with my `[LOW]` finding on 429 handling — together they point to the same gap: the outer catch in `alert.ts:164-170` is too broad and should distinguish retriable from terminal errors.

**Challenge to test-MEDIUM-2 (timestamp assertion in worker test):** The test reviewer calls it MEDIUM that the timestamp portion of the Discord message is untested. This is LOW because the content is cosmetic to alert delivery correctness. However, this finding pairs with my `[LOW]` perf finding that the timestamp is wrong (dispatch time vs. actual last check-in). If a test were added that asserts a specific timestamp value (not just presence of any ISO string), it would also catch the accuracy bug. In that framing, the test finding has more bite — revising upward to agree with MEDIUM.

### Revised verdict

**block**

Revising from "approve-with-changes" to "block" based on the combined findings:

1. The security reviewer's sec-HIGH-1 (ineffective masking / config leakage) is a genuine correctness issue that the spec explicitly prohibits. Fixing it by dropping config from the response also resolves my two `[MEDIUM]` perf findings.
2. The test reviewer's test-HIGH-4 (4xx path unimplemented) is confirmed: the missing behavior means wasted work on every subsequent alert dispatch to an invalidated webhook, and there is no code to fix yet — this is not a test gap alone, it is a missing implementation.
3. My `[HIGH]` finding on missing `fetch` timeouts remains.

All three have concrete, low-effort fixes. The PR should not merge until all three are addressed.
