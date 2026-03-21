import { Button, Text } from '@react-email/components'
import { Layout } from '../components/layout'

export interface MagicLinkEmailProps {
  magicLinkUrl: string
  expiresInMinutes: number
}

export function MagicLinkEmail({
  magicLinkUrl,
  expiresInMinutes,
}: MagicLinkEmailProps) {
  const campaign = 'magic-link'
  const magicLinkUrlWithUtm = appendUtm(magicLinkUrl, campaign)

  const expiryLabel =
    expiresInMinutes >= 60
      ? `${expiresInMinutes / 60} hour${expiresInMinutes / 60 !== 1 ? 's' : ''}`
      : `${expiresInMinutes} minute${expiresInMinutes !== 1 ? 's' : ''}`

  return (
    <Layout previewText="Your Cronpilot login link — valid for a limited time">
      {/* Lock icon header */}
      <div style={iconContainerStyle}>
        <div style={lockIconStyle}>
          <span style={lockEmojiStyle}>🔑</span>
        </div>
      </div>

      <Text style={headingStyle}>Your login link</Text>

      <Text style={bodyTextStyle}>
        Click the button below to sign in to Cronpilot. No password needed.
      </Text>

      <div style={buttonWrapperStyle}>
        <Button href={magicLinkUrlWithUtm} style={buttonStyle}>
          Sign in to Cronpilot
        </Button>
      </div>

      {/* Expiry warning */}
      <div style={expiryCardStyle}>
        <div style={expiryRowStyle}>
          <span style={expiryIconStyle}>⏱</span>
          <Text style={expiryTextStyle}>
            This link expires in <strong>{expiryLabel}</strong> and can only be
            used once.
          </Text>
        </div>
      </div>

      <Text style={securityNoteStyle}>
        If you didn&rsquo;t request this login link, you can safely ignore this
        email. Someone may have entered your email address by mistake.
      </Text>

      <Text style={helpTextStyle}>
        Having trouble with the button? Copy and paste this link into your
        browser:
      </Text>
      <Text style={rawLinkStyle}>{magicLinkUrlWithUtm}</Text>

      <Text style={supportTextStyle}>
        For security, never share this link with anyone. Cronpilot will never
        ask you for it.
      </Text>
    </Layout>
  )
}

function appendUtm(url: string, campaign: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}utm_source=email&utm_campaign=${campaign}`
}

const iconContainerStyle: React.CSSProperties = {
  marginBottom: '24px',
  textAlign: 'center',
}

const lockIconStyle: React.CSSProperties = {
  display: 'inline-block',
}

const lockEmojiStyle: React.CSSProperties = {
  fontSize: '40px',
  lineHeight: '1',
}

const headingStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: '700',
  letterSpacing: '-0.3px',
  lineHeight: '32px',
  margin: '0 0 16px',
  textAlign: 'center',
}

const bodyTextStyle: React.CSSProperties = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 24px',
  textAlign: 'center',
}

const buttonWrapperStyle: React.CSSProperties = {
  margin: '0 0 24px',
  textAlign: 'center',
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 36px',
  textDecoration: 'none',
}

const expiryCardStyle: React.CSSProperties = {
  backgroundColor: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: '6px',
  margin: '0 0 24px',
  padding: '12px 16px',
}

const expiryRowStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  display: 'flex',
  gap: '10px',
}

const expiryIconStyle: React.CSSProperties = {
  fontSize: '16px',
  lineHeight: '24px',
}

const expiryTextStyle: React.CSSProperties = {
  color: '#92400e',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
}

const securityNoteStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0 0 20px',
}

const helpTextStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 6px',
}

const rawLinkStyle: React.CSSProperties = {
  color: '#3b82f6',
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0 0 20px',
  wordBreak: 'break-all',
}

const supportTextStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '18px',
  margin: '0',
}

MagicLinkEmail.subject = () => 'Your Cronpilot login link'
