---
name: write-test
description: Write tests for cronpilot code. Use when adding or fixing tests in apps/api (integration tests against a real database) or apps/web (unit tests with jsdom). Loads the right patterns based on which app the target file lives in.
---

# write-test

This codebase has two distinct testing setups. Never mix them — the patterns are incompatible.

| App | Style | DB | Mocking |
|---|---|---|---|
| `apps/api` | Integration | Real (no mocks) | None |
| `apps/web` | Unit | jsdom | SWR + API client mocked |
| `apps/worker` | Integration | Real (no mocks) | None |

## How to proceed

1. Identify which app the file under test lives in.
2. Read the corresponding reference file for the exact patterns, boilerplate, and conventions:
   - `apps/api` or `apps/worker` → read [references/api-tests.md](references/api-tests.md)
   - `apps/web` → read [references/web-tests.md](references/web-tests.md)
3. Write the tests following those patterns. Do not introduce patterns not found in the reference.

