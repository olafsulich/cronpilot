# `@cronpilot/sdk` spec

Build a TypeScript SDK that lets users report cron job check-ins to Cronpilot with a single `ping()` call.

## Public API

```ts
import { Cronpilot } from '@cronpilot/sdk';

const client = new Cronpilot({ token: 'mon_xxx' });

await client.ping({ status: 'ok', duration: 1234 });
await client.ping({ status: 'fail', exitCode: 1 });
await client.ping();
```

## Constructor options

```ts
type CronpilotOptions = {
  token: string;
  baseUrl?: string;   // default 'https://api.cronpilot.com'
  timeout?: number;   // ms, default 5000
  retries?: number;   // default 2 (3 total attempts)
};
```

## `ping()` options

```ts
type PingOptions = {
  status?: 'ok' | 'fail';   // default 'ok'
  duration?: number;         // ms
  exitCode?: number;         // integer
};
```

## Behavior

- POSTs to `${baseUrl}/ping/${token}` with the options as JSON body.
- Returns `Promise<void>` on 2xx.
- On 4xx: throws `CronpilotClientError` — do not retry.
- On 5xx or network error: retries up to `retries` times with exponential backoff (200ms × 2^attempt). After exhausting retries, throws `CronpilotServerError`.
- Timeout per attempt via `AbortSignal.timeout(timeout)`.

## Errors

```ts
export class CronpilotClientError extends Error { status: number }
export class CronpilotServerError extends Error { status?: number; cause?: unknown }
```

## Tests

Vitest in `packages/sdk/src/__tests__/`. Mock `fetch` with `vi.fn()` — no real network.

Required cases:
1. Default ping (no opts) hits the right URL with empty JSON body.
2. Status / duration / exitCode are sent in the body.
3. 4xx throws `CronpilotClientError` and does **not** retry.
4. 5xx retries `retries` times then throws `CronpilotServerError`.
5. Network error retries.
6. Timeout fires after `timeout` ms.

## Package

- TypeScript, ESM-only output.
- `package.json`: `"type": "module"`, `main`/`types` → `dist/index.js` / `dist/index.d.ts`, `exports` field with the same.
- `tsconfig.json` extending workspace base (see `packages/shared/tsconfig.json`).
- Build via `tsc`. Scripts: `build`, `test`, `typecheck`.

## Constraints

- Do not modify `apps/`, `packages/db/`, `packages/emails/`, `packages/shared/`, or `prisma/schema.prisma`.
- No new runtime dependencies. DevDeps only: `vitest`, `typescript`, `@types/node`.
