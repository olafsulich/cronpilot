# Ralph Progress Log

## Initializer
- Reset tasks.json (all passes: false) — source files were deleted by demo reset commit
- Reset progress.md

## Iteration 2 — package-scaffold
- Created packages/sdk/package.json: name @cronpilot/sdk, version 0.1.0, type module, main/types/exports → dist/index.js/d.ts, devDeps vitest/typescript/@types/node
- Verified: file exists with correct fields
- Build/test: skipped (source not yet created)

## Iteration 3 — tsconfig
- Created packages/sdk/tsconfig.json extending ../../tsconfig.base.json with outDir/rootDir/allowImportingTsExtensions:false (needed for tsc emit)
- Pattern matches packages/shared/tsconfig.json; allowImportingTsExtensions override follows apps/api pattern to allow build emission
- Build/test: skipped (source not yet created)

## Iteration 4 — source-exports + all remaining tasks
- Created packages/sdk/src/index.ts: exports Cronpilot, CronpilotClientError, CronpilotServerError
- Cronpilot.ping() POSTs JSON body to ${baseUrl}/ping/${token} using AbortSignal.timeout per attempt
- CronpilotClientError (4xx, no retry) and CronpilotServerError (5xx/network, with retry + exponential backoff 200ms*2^attempt)
- Created packages/sdk/src/__tests__/cronpilot.test.ts with all 6 cases; fake timers used for retry tests to avoid real delays
- Fixed unhandled-rejection warning in retry tests by attaching assertion handler before vi.runAllTimersAsync()
- Build: dist/index.js and dist/index.d.ts produced; typecheck: clean; tests: 6/6 pass
