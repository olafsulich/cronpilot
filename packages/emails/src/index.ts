import { render } from '@react-email/render'
import type { ReactElement } from 'react'

export async function renderEmail(
  component: ReactElement,
): Promise<{ html: string; text: string }> {
  const html = await render(component)
  const text = await render(component, { plainText: true })
  return { html, text }
}

// Re-export all templates
export { AlertMissedEmail } from './templates/alert-missed'
export type { AlertMissedEmailProps } from './templates/alert-missed'

export { AlertFailedEmail } from './templates/alert-failed'
export type { AlertFailedEmailProps } from './templates/alert-failed'

export { AlertResolvedEmail } from './templates/alert-resolved'
export type { AlertResolvedEmailProps } from './templates/alert-resolved'

export { DigestEmail } from './templates/digest'
export type { DigestEmailProps } from './templates/digest'

export { InviteEmail } from './templates/invite'
export type { InviteEmailProps } from './templates/invite'

export { MagicLinkEmail } from './templates/magic-link'
export type { MagicLinkEmailProps } from './templates/magic-link'

export { TrialEndingEmail } from './templates/trial-ending'
export type { TrialEndingEmailProps } from './templates/trial-ending'

export { WelcomeEmail } from './templates/welcome'
export type { WelcomeEmailProps } from './templates/welcome'
