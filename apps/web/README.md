# apps/web

Next.js 14 dashboard for Cronpilot customers. All customer-facing UI lives here.

## Structure

```
src/
  app/                    # App Router pages
    (auth)/               # Login, signup, password reset
    (dashboard)/          # Authenticated app shell
      monitors/           # Monitor list, detail, create/edit
      alerts/             # Alert history and settings
      settings/           # Team settings, billing, integrations
      onboarding/         # First-run flow
  components/
    ui/                   # shadcn/ui base components (do not edit directly)
    monitors/             # Monitor-specific components
    alerts/               # Alert-specific components
    shared/               # Shared layout, nav, modals
  lib/
    api.ts                # API client (thin wrapper around fetch)
    auth.ts               # Auth helpers (session, redirect guards)
    utils.ts              # cn(), formatDate(), etc.
  hooks/
    use-monitors.ts       # SWR hooks for monitor data
    use-team.ts           # Current team context
```

## Key pages

| Route | Description |
|-------|-------------|
| `/` | Marketing landing page |
| `/login` | Auth (email+password, magic link, Google OAuth) |
| `/dashboard` | Monitor overview with status grid |
| `/monitors/[id]` | Monitor detail: check-in history, timing chart, alert log |
| `/monitors/new` | Create monitor — generates check-in URL |
| `/settings/integrations` | Connect Slack, PagerDuty, webhooks |
| `/settings/billing` | Stripe-powered plan management |

## Auth

Uses NextAuth.js with a credentials provider + magic link. Session stored in a JWT cookie. The middleware at `src/middleware.ts` protects all `/dashboard/**` routes.

## Data fetching

Server components fetch directly from the API using an internal service token. Client components use SWR hooks that hit `/api/*` proxy routes to avoid exposing the API URL and token to the browser.

## Env vars

```
NEXT_PUBLIC_APP_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
API_INTERNAL_URL=       # internal URL for server → API calls
API_SERVICE_TOKEN=      # service account token for SSR fetches
NEXT_PUBLIC_STRIPE_KEY=
```
