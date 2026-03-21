# packages/emails

Transactional email templates built with React Email. Rendered server-side and sent via Resend.

## Structure

```
src/
  templates/
    alert-missed.tsx        # "Your job {name} hasn't checked in"
    alert-failed.tsx        # "Your job {name} reported a failure"
    alert-resolved.tsx      # "Your job {name} is back to normal"
    digest.tsx              # Weekly summary: uptime %, incidents
    invite.tsx              # Team member invitation
    magic-link.tsx          # Passwordless login link
    trial-ending.tsx        # Trial expiry warning (3d and 1d variants)
    welcome.tsx             # Post-signup onboarding email
  components/
    layout.tsx              # Shared email wrapper (logo, footer, styles)
    monitor-status.tsx      # Status badge component used in digests
  index.ts                  # Exports renderEmail(template, props) helper
  preview-server.ts         # react-email dev server for local preview
```

## Usage

```ts
import { renderEmail, AlertMissedEmail } from '@cronpilot/emails'

const { html, text } = await renderEmail(AlertMissedEmail, {
  monitorName: 'nightly-backup',
  teamName: 'Acme Corp',
  missedAt: new Date(),
  dashboardUrl: 'https://app.cronpilot.io/monitors/123',
})

await resend.emails.send({
  from: 'alerts@cronpilot.io',
  to: user.email,
  subject: `Your job "nightly-backup" hasn't checked in`,
  html,
  text,
})
```

## Previewing templates

```bash
pnpm --filter @cronpilot/emails preview
# opens react-email preview at localhost:3030
```

## Design notes

- Emails use inline styles only — no Tailwind, no external CSS
- All links include UTM params for tracking (`utm_source=email&utm_campaign=alert-missed`)
- Plain text versions are generated automatically via react-email
- "From" address is `alerts@cronpilot.io` for alerts, `hello@cronpilot.io` for product emails
