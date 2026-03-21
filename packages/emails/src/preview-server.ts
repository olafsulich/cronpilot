/**
 * React Email preview server entry point.
 *
 * Run `pnpm preview` from this package to start the preview server.
 * The react-email CLI discovers templates by scanning the configured
 * --dir (src/templates). This file re-exports all templates so they
 * are also accessible as a single import during development.
 *
 * Usage:
 *   pnpm --filter @cronpilot/emails preview
 */

export { AlertMissedEmail } from './templates/alert-missed'
export { AlertFailedEmail } from './templates/alert-failed'
export { AlertResolvedEmail } from './templates/alert-resolved'
export { DigestEmail } from './templates/digest'
export { InviteEmail } from './templates/invite'
export { MagicLinkEmail } from './templates/magic-link'
export { TrialEndingEmail } from './templates/trial-ending'
export { WelcomeEmail } from './templates/welcome'
