# Security Review — Discord Integration PR

## Findings

### sec-HIGH-1: Discord webhook URL returned unmasked in API responses

- **File:** `apps/api/src/services/integrations.ts:95–101`
- **Severity:** HIGH
- **Detail:** The `maskConfig` function for Discord returns `url.substring(0, 20)...` — the first 20 characters of a Discord webhook URL. A Discord webhook URL is structured as `https://discord.com/api/webhooks/{id}/{token}`. The first 20 characters are always `https://discord.com/` — a constant prefix. The actual secret portion is the `{token}` segment, which lives well past character 20. The masking is cosmetic and exposes the full token. The spec (`docs/specs/discord-integration.md:53`) is explicit: "`config` field is **never** returned — only `name`, `type`, `id`, `createdAt`." The implementation contradicts the spec and exposes the sensitive webhook token. The Discord webhook token is a bearer credential: possessing it lets anyone post to that channel.
- **Required change:** Either drop `config` entirely from `GET /integrations` as the spec mandates, or ensure the Discord masking preserves nothing: `webhookUrl: "***"`. Do not truncate-then-show.

---

### sec-HIGH-2: `testIntegration` fetches the stored Discord webhook URL without re-validating it (SSRF)

- **File:** `apps/api/src/services/integrations.ts:254–270`
- **Severity:** HIGH
- **Detail:** `testIntegration` reads `config.webhookUrl` from the decrypted blob and passes it directly to `fetch(webhookUrl, ...)`. The `DiscordConfigSchema` validates the URL at create-time, but `testIntegration` does not re-validate before fetching. If the stored encrypted config were ever tampered with (key compromise, DB-level write), or if a race exists during storage, the worker could be directed to an arbitrary internal address. An attacker who can write to the `configEncrypted` column bypasses the URL restriction entirely.
- **Required change:** Re-validate the URL against the Discord webhook regex (`^https://discord\.com/api/webhooks/`) before calling `fetch` in `testIntegration`. Reject with an error if validation fails.

---

### sec-HIGH-3: `dispatchDiscord` in the worker fetches the stored URL without re-validation (SSRF)

- **File:** `apps/worker/src/processors/alert.ts:321–333`
- **Severity:** HIGH
- **Detail:** `dispatchDiscord` receives the decrypted config, casts it to `DiscordConfig`, and calls `axios.post(config.webhookUrl, ...)` with no URL validation. The worker trusts whatever bytes were stored in the DB column. The worker runs in the same network as internal services (Redis, Postgres). A corrupt or maliciously modified row could cause the worker to make outbound requests to arbitrary internal hosts.
- **Required change:** Before calling `axios.post`, assert that `config.webhookUrl` matches `^https://discord\.com/api/webhooks/`. Throw (causing job retry/failure) if not.

---

### sec-MEDIUM-1: `monitorName` interpolated directly into Discord message content — mention injection

- **File:** `apps/worker/src/processors/alert.ts:329`
- **Severity:** MEDIUM
- **Detail:** The Discord content string interpolates `monitorName` verbatim. A monitor named `@everyone server is compromised` would cause every alert to ping the entire Discord server. Discord webhooks support an `allowed_mentions` field that can disable all mention parsing.
- **Required change:** Add `allowed_mentions: { parse: [] }` to the Discord POST payload to suppress all mention parsing.

---

### sec-MEDIUM-2: `api-routes.md` states `GET /integrations` decrypts config for display — contradicts the spec

- **File:** `docs/agent/api-routes.md:47`
- **Severity:** MEDIUM
- **Detail:** The existing `api-routes.md` says "Config is decrypted for display" on `GET /integrations`. The Discord integration spec (`docs/specs/discord-integration.md:53`) says the opposite: `config` is never returned. The implementation follows the older docs and returns masked config. This ongoing contradiction creates confusion about the security contract.
- **Required change:** Decide and enforce one contract. If "never return config" (what the spec says), drop `config` from `mapIntegration` and update `api-routes.md`. This eliminates the entire class of partial-mask leaks.

---

### sec-MEDIUM-3: `SlackConfigSchema.webhookUrl` accepts any URL — no HTTPS or Slack-domain enforcement

- **File:** `apps/api/src/services/integrations.ts:12–15`
- **Severity:** MEDIUM
- **Detail:** `SlackConfigSchema` uses `z.string().url()`, which accepts `http://`, `file://`, or arbitrary domains. This is pre-existing but made visible by comparison with the Discord PR, which correctly restricts its URL to `^https://discord.com/api/webhooks/`. Consistency and SSRF reduction both require the same strictness for Slack.
- **Required change:** Add `.regex(/^https:\/\/hooks\.slack\.com\/services\//)` to `SlackConfigSchema.webhookUrl`.

---

### sec-LOW-1: `testIntegration` error path leaks raw network error messages to API clients

- **File:** `apps/api/src/services/integrations.ts:273–275`
- **Severity:** LOW
- **Detail:** The catch block returns `err.message` directly. Node.js fetch errors include messages like `connect ECONNREFUSED 10.0.0.1:80` or `getaddrinfo ENOTFOUND internal-service`, revealing internal IPs, hostnames, or network topology to the API client.
- **Required change:** Map network-level errors to a generic "Could not reach the webhook URL" message. Do not return raw `err.message` from network operations.

---

### sec-LOW-2: `channelName` field has no length or character restriction — log injection risk

- **File:** `apps/api/src/services/integrations.ts:149`
- **Severity:** LOW
- **Detail:** `buildIntegrationName` constructs `Discord (${input.config.channelName})` from the user-supplied `channelName` field. The field is validated only as `z.string().optional()` — no length limit, no character restriction. A value like `\n\rINJECTED` would be stored and could enable log injection.
- **Required change:** Add `.max(100)` and optionally a character allowlist (alphanumeric, `#`, `-`, `_`, spaces) to `DiscordConfigSchema.channelName`.

---

## Verdict

**block**

The PR has two HIGH-severity SSRF vectors (no URL re-validation at dispatch in both the API test path and the worker dispatch path) and one HIGH-severity secret-leakage issue (Discord webhook token exposed through ineffective masking, directly contradicting the spec). These must be fixed before merge. The MEDIUM findings (Discord mention injection, documentation contract conflict) are also required given this is a multi-tenant SaaS.

**Files reviewed:**
- `docs/specs/discord-integration.md`
- `apps/api/src/services/integrations.ts`
- `apps/api/src/routes/integrations.ts`
- `apps/worker/src/processors/alert.ts`
- `apps/api/src/hooks/authenticate.ts`
- `apps/api/src/lib/encryption.ts`
- `apps/worker/src/lib/encryption.ts`
- `packages/shared/src/types/integration.ts`
- `packages/shared/src/types/api.ts`
- `apps/web/src/app/(dashboard)/settings/integrations/page.tsx`
- `apps/web/src/test/integrations-discord-form.test.tsx`
- `packages/db/prisma/schema.prisma`
- `docs/agent/api-routes.md`
- `docs/agent/database.md`

## Round 2 Challenges

### Challenge to perf-reviewer — perf-MEDIUM-1 ("listIntegrations decrypts every config on every call")

The perf reviewer correctly diagnoses the unnecessary decryption loop and recommends either following the spec (no config) or adding `take: 50`. Agree on the direction. However the framing as a perf finding understates the severity: the root problem is that decrypting and returning config at all is a spec violation and a secret-exposure bug (see sec-HIGH-1). Fixing it is a security requirement, not just a performance optimization. The perf reviewer's option (a) — follow the spec and strip config — is the correct and only acceptable fix. Their option (b), adding `take: 50`, would leave the secret-leakage bug in place. This fix is mandatory on security grounds regardless of perf impact.

### Challenge to perf-reviewer — verdict "approve-with-changes"

The perf reviewer's verdict is `approve-with-changes`. My verdict is `block`. The difference is the CRITICAL field-name bug (`integration.config` vs `integration.configEncrypted`): the Prisma `Integration` model column is named `configEncrypted`, but the alert processor calls `decrypt(integration.config as string)`. The field `config` does not exist on the Prisma row — it evaluates to `undefined` at runtime. `decrypt(undefined)` throws, is caught, and `continue`s — silently skipping every integration dispatch. Total notification failure for every team on every alert. If this ships, customers receive no alerting and cannot tell their monitors are down. Block stands.

### Challenge to test-reviewer — test-HIGH-3 and test-HIGH-4 (5xx retry and 4xx errored-rule behavior)

The test reviewer correctly identifies that the 5xx retry and 4xx errored-rule behaviors are unimplemented and untested. From a security angle: if the dispatch silently swallows errors on all status codes, a valid Discord webhook that has been rotated (returning 401/403) will continue to appear as "healthy" in the system. A team loses confidence in their alert channel without any signal that the integration is broken. The `mark rule as errored` path on 4xx is a required safety signal. The test reviewer is right to block on this.

### Challenge to test-reviewer — test-HIGH-2 ("GET /integrations assertion is trivially weak")

Fully agree. The current assertion `expect(discord?.config?.webhookUrl).not.toBe(originalUrl)` passes even if `config.webhookUrl` is the fully unmasked URL (as long as it does not exactly equal the input). The correct assertion, given the spec, is `expect(discord).not.toHaveProperty('config')`. The weak assertion directly masks the sec-HIGH-1 finding — if the test were stronger, it would already be failing. This is a concrete example of how test weakness lets security bugs ship.

### Revised verdict

**block** — unchanged from Round 1. The perf reviewer's `approve-with-changes` does not account for the CRITICAL wrong-field-name bug or the spec-violating config exposure. The test reviewer correctly blocks. Block stands on independent grounds: the CRITICAL field-name bug, three HIGH findings (config leaked in GET response, SSRF in testIntegration, SSRF in dispatchDiscord), and the missing spec behaviors are all mandatory fixes before merge.
