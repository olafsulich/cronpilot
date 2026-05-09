# Ralph: Build `@cronpilot/sdk` from zero

You are running in a **Ralph loop**. This prompt is fed to a fresh Claude Code session repeatedly (`while :; do cat PROMPT.md | claude; done`). Each iteration:

1. Inspects what already exists in `packages/sdk/`.
2. Picks the next missing slice from the spec below.
3. Implements it.
4. Runs tests / typecheck.
5. Commits.
6. Exits.

You have no memory of previous iterations. **State lives entirely in `packages/sdk/` and git history.** Read the directory and the git log before doing anything else.

If the spec is fully satisfied (all checklist items done, all tests pass, build green), create the file `packages/sdk/.ralph-done` with the contents `done` and exit. The outer loop will see it and stop.

## Spec: `@cronpilot/sdk`

A tiny TypeScript SDK customers `npm install` to ping Cronpilot from their cron jobs. Lives in `packages/sdk/` of the existing pnpm + Turborepo workspace.

### Public API

```ts
import { Cronpilot } from '@cronpilot/sdk';

const client = new Cronpilot({ token: 'mon_xxx' });

// Successful run
await client.ping({ status: 'ok', duration: 1234 });

// Failed run
await client.ping({ status: 'fail', exitCode: 1 });

// Minimal — just signal "I'm alive"
await client.ping();
```

### Constructor options

```ts
type CronpilotOptions = {
  token: string;                  // required
  baseUrl?: string;               // default 'https://api.cronpilot.com'
  timeout?: number;               // ms, default 5000
  retries?: number;               // default 2 (so 3 total attempts)
};
```

### `ping()` options

```ts
type PingOptions = {
  status?: 'ok' | 'fail';         // default 'ok'
  duration?: number;              // ms
  exitCode?: number;              // integer
};
```

### Behavior

- POSTs to `${baseUrl}/ping/${token}` with the options as JSON body.
- Returns `Promise<void>` on 2xx.
- On 4xx: throws `CronpilotClientError` (do not retry — request is bad).
- On 5xx or network error: retries up to `retries` times with exponential backoff (200ms × 2^attempt). After exhausting retries, throws `CronpilotServerError`.
- Timeout per attempt enforced via `AbortSignal.timeout(timeout)`.

### Errors (exported)

```ts
export class CronpilotClientError extends Error { status: number }
export class CronpilotServerError extends Error { status?: number; cause?: unknown }
```

### Tests

- Vitest, in `packages/sdk/src/__tests__/`.
- Mock `fetch` with `vi.fn()` — no real network.
- Coverage:
  - Default ping (no opts) hits the right URL with empty JSON body.
  - Status / duration / exitCode are sent in the body.
  - 4xx throws `CronpilotClientError` and does **not** retry.
  - 5xx retries `retries` times then throws `CronpilotServerError`.
  - Network error retries.
  - Timeout fires after `timeout` ms.

### Build / package

- TypeScript, ESM-only output.
- `package.json`:
  - `"name": "@cronpilot/sdk"`
  - `"version": "0.1.0"`
  - `"type": "module"`
  - `"main"` and `"types"` pointing at `dist/index.js` and `dist/index.d.ts`.
  - `"exports"` field with the same.
  - Workspace-relative dev deps where possible (vitest, typescript, @types/node).
- `tsconfig.json` extending whatever the existing packages use (look at `packages/shared/tsconfig.json` for the pattern).
- Build via `tsc`. Add `"build"` and `"test"` scripts.

### Done checklist

- [ ] `packages/sdk/package.json` exists, name = `@cronpilot/sdk`.
- [ ] `packages/sdk/src/index.ts` exports `Cronpilot`, `CronpilotClientError`, `CronpilotServerError`.
- [ ] `pnpm --filter @cronpilot/sdk build` succeeds.
- [ ] `pnpm --filter @cronpilot/sdk test` passes with all six test cases above.
- [ ] `pnpm --filter @cronpilot/sdk typecheck` (or `tsc --noEmit`) clean.
- [ ] At least one commit per logical slice; commits use conventional-commit format.

## Iteration logic

Every time you run, follow this exact order:

1. **Read state.**
   - `git log --oneline -20` to see what previous iterations did.
   - `ls -la packages/sdk/` to see what files exist.
   - If `packages/sdk/.ralph-done` exists → exit immediately. (Should never happen — outer loop checks first — but defensive.)

2. **Pick the next slice.** Use the Done checklist above. Do the *first* unchecked item that has all its dependencies met. Do not pick the most ambitious item — pick the smallest next step.

3. **Implement that slice only.** Do not work ahead. Do not refactor unrelated code. Do not modify anything outside `packages/sdk/` unless it's the root `pnpm-workspace.yaml` / `tsconfig.base.json` and the change is strictly required for this iteration.

4. **Verify.** Run the relevant subset of `pnpm --filter @cronpilot/sdk build|test|typecheck`. If it fails, fix it before committing — do not punt to the next iteration.

5. **Commit.** Conventional-commit style. Examples:
   - `feat(sdk): scaffold package.json and tsconfig`
   - `feat(sdk): implement Cronpilot.ping happy path`
   - `feat(sdk): add retry with exponential backoff`
   - `test(sdk): cover 5xx retry path`
   - `chore(sdk): mark spec complete`

6. **Check for done.** If every item in the Done checklist is checked AND the full `pnpm --filter @cronpilot/sdk test && pnpm --filter @cronpilot/sdk build` passes from a clean state, write `done` to `packages/sdk/.ralph-done` and commit it.

7. **Exit.**

## Hard rules

- **Never modify** `apps/`, `packages/db/`, `packages/emails/`, `packages/shared/`. The SDK is greenfield and standalone.
- **Never modify** `prisma/schema.prisma`.
- **No new top-level dependencies** other than `vitest`, `typescript`, `@types/node` as devDeps inside `packages/sdk/`. The SDK has zero runtime dependencies — it uses native `fetch`.
- **No `--no-verify`, no `git push`, no `--force`.**
- If you find yourself unsure what slice to pick, default to the first unchecked item in the Done checklist.
- If something genuinely blocks progress (e.g., the workspace config rejects the new package), write a one-line note to `packages/sdk/RALPH-BLOCKED.md` describing the block, commit it, and exit. The outer loop will see no progress and the operator can intervene.
