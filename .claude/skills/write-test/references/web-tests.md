# Web unit test **patterns**

Tests live next to their source file (e.g. `use-team.test.ts` beside `use-team.ts`). The vitest environment is `jsdom`. Run with:

```bash
pnpm --filter @cronpilot/web test
```

## Mocking

Always mock `swr` and `@/lib/api` **before** importing the module under test. Import order matters — the mocks must be declared first.

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks must come before the imports that use them
vi.mock("swr");
vi.mock("@/lib/api", () => ({
  apiClient: { get: vi.fn() },
}));

import useSWR from "swr";
import { useTeam } from "./use-team";

const mockUseSWR = vi.mocked(useSWR);
```

Clear mocks between tests:

```ts
beforeEach(() => {
  vi.clearAllMocks();
});
```

## Testing hooks

Use `renderHook` from `@testing-library/react`:

```ts
import { renderHook } from "@testing-library/react";

it("returns loading state initially", () => {
  mockUseSWR.mockReturnValue({ data: undefined, isLoading: true } as ReturnType<
    typeof useSWR
  >);

  const { result } = renderHook(() => useTeam());

  expect(result.current.isLoading).toBe(true);
  expect(result.current.team).toBeUndefined();
});
```

## Testing components

Use `render` and the `screen` query API from `@testing-library/react`. Avoid querying by class or implementation details — prefer `getByRole`, `getByText`, `getByLabelText`.

## What to assert

- Loading state (data undefined, isLoading true)
- Populated state (data present, correct shape)
- Empty/edge cases (empty arrays, null values)
- That SWR was called with the correct path and options
- That the API client fetcher works correctly

## Type shapes

See `docs/agent/api-routes.md` for the response shapes returned by each endpoint — these are what you'll put in mock return values.
