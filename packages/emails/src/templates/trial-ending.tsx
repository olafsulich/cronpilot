import { Button, Link, Text } from '@react-email/components'
import { Layout } from '../components/layout'

export interface TrialEndingEmailProps {
  teamName: string
  daysLeft: 1 | 3
  trialEndsAt: Date
  upgradeUrl: string
  planName: string
}

export function TrialEndingEmail({
  teamName,
  daysLeft,
  trialEndsAt,
  upgradeUrl,
  planName,
}: TrialEndingEmailProps) {
  const campaign = `trial-ending-${daysLeft}d`
  const upgradeUrlWithUtm = appendUtm(upgradeUrl, campaign)
  const trialEndsAtStr = formatDateTime(trialEndsAt)

  const isUrgent = daysLeft === 1

  return (
    <Layout
      previewText={`Your Cronpilot trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — upgrade to keep your monitors running`}
    >
      {/* Urgency banner */}
      <div style={isUrgent ? urgentBannerStyle : warningBannerStyle}>
        <span style={bannerEmojiStyle}>{isUrgent ? '🚨' : '⏳'}</span>
        <span
          style={isUrgent ? urgentBannerTextStyle : warningBannerTextStyle}
        >
          {isUrgent
            ? 'Last chance — trial ends tomorrow'
            : 'Trial ending soon'}
        </span>
      </div>

      <Text style={headingStyle}>
        Your trial ends in {daysLeft} day{daysLeft !== 1 ? 's' : ''}
      </Text>

      <Text style={bodyTextStyle}>Hi {teamName} team,</Text>

      <Text style={bodyTextStyle}>
        {isUrgent ? (
          <>
            Your Cronpilot trial expires <strong>tomorrow</strong> on{' '}
            {trialEndsAtStr}. After that, your monitors will stop checking in
            and alert delivery will be suspended until you upgrade.
          </>
        ) : (
          <>
            Your Cronpilot trial expires in <strong>3 days</strong> on{' '}
            {trialEndsAtStr}. Don&rsquo;t let your cron job monitoring go dark —
            upgrade now to keep everything running without interruption.
          </>
        )}
      </Text>

      {/* What happens when trial ends */}
      <div style={consequencesCardStyle}>
        <Text style={consequencesHeadingStyle}>
          What happens when your trial ends:
        </Text>
        <div style={consequenceRowStyle}>
          <span style={crossIconStyle}>✕</span>
          <span style={consequenceTextStyle}>
            Monitors stop receiving check-ins
          </span>
        </div>
        <div style={consequenceRowStyle}>
          <span style={crossIconStyle}>✕</span>
          <span style={consequenceTextStyle}>
            Alert emails and notifications are paused
          </span>
        </div>
        <div style={consequenceRowStyle}>
          <span style={crossIconStyle}>✕</span>
          <span style={consequenceTextStyle}>
            Incident history becomes read-only
          </span>
        </div>
      </div>

      {/* Plan highlight */}
      <div style={planCardStyle}>
        <div style={planNameRowStyle}>
          <span style={planLabelStyle}>Upgrading to</span>
          <span style={planNameStyle}>{planName}</span>
        </div>
        <div style={planFeaturesStyle}>
          {[
            'Unlimited monitors',
            'SMS & Slack alerts',
            'Incident history (90 days)',
            'Team collaboration',
            'Priority support',
          ].map((feature) => (
            <div key={feature} style={planFeatureRowStyle}>
              <span style={checkIconStyle}>✓</span>
              <span style={planFeatureTextStyle}>{feature}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={buttonWrapperStyle}>
        <Button href={upgradeUrlWithUtm} style={isUrgent ? urgentButtonStyle : buttonStyle}>
          Upgrade now
        </Button>
      </div>

      <Text style={helpTextStyle}>
        Questions about pricing?{' '}
        <Link
          href={`https://cronpilot.io/pricing?utm_source=email&utm_campaign=${campaign}`}
          style={linkStyle}
        >
          View all plans
        </Link>{' '}
        or reply to this email to talk to our team.
      </Text>
    </Layout>
  )
}

function appendUtm(url: string, campaign: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}utm_source=email&utm_campaign=${campaign}`
}

function formatDateTime(date: Date): string {
  return date.toLocaleString('en-US', {
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    month: 'long',
    timeZone: 'UTC',
    timeZoneName: 'short',
    year: 'numeric',
  })
}

const urgentBannerStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '6px',
  display: 'flex',
  gap: '8px',
  marginBottom: '24px',
  padding: '12px 16px',
}

const warningBannerStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: '6px',
  display: 'flex',
  gap: '8px',
  marginBottom: '24px',
  padding: '12px 16px',
}

const bannerEmojiStyle: React.CSSProperties = {
  fontSize: '18px',
  lineHeight: '1',
}

const urgentBannerTextStyle: React.CSSProperties = {
  color: '#991b1b',
  fontSize: '14px',
  fontWeight: '600',
}

const warningBannerTextStyle: React.CSSProperties = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '600',
}

const headingStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '24px',
  fontWeight: '700',
  letterSpacing: '-0.3px',
  lineHeight: '32px',
  margin: '0 0 20px',
}

const bodyTextStyle: React.CSSProperties = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const consequencesCardStyle: React.CSSProperties = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  margin: '20px 0',
  padding: '16px 20px',
}

const consequencesHeadingStyle: React.CSSProperties = {
  color: '#7f1d1d',
  fontSize: '13px',
  fontWeight: '600',
  margin: '0 0 12px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const consequenceRowStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '10px',
  marginBottom: '8px',
}

const crossIconStyle: React.CSSProperties = {
  color: '#dc2626',
  fontSize: '14px',
  fontWeight: '700',
  flexShrink: 0,
}

const consequenceTextStyle: React.CSSProperties = {
  color: '#991b1b',
  fontSize: '14px',
}

const planCardStyle: React.CSSProperties = {
  backgroundColor: '#f0fdf4',
  border: '1px solid #bbf7d0',
  borderRadius: '8px',
  margin: '20px 0 24px',
  padding: '16px 20px',
}

const planNameRowStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '8px',
  marginBottom: '12px',
}

const planLabelStyle: React.CSSProperties = {
  color: '#166534',
  fontSize: '13px',
}

const planNameStyle: React.CSSProperties = {
  backgroundColor: '#16a34a',
  borderRadius: '4px',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: '700',
  padding: '2px 8px',
}

const planFeaturesStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
}

const planFeatureRowStyle: React.CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: '10px',
}

const checkIconStyle: React.CSSProperties = {
  color: '#16a34a',
  fontSize: '13px',
  fontWeight: '700',
  flexShrink: 0,
}

const planFeatureTextStyle: React.CSSProperties = {
  color: '#14532d',
  fontSize: '14px',
}

const buttonWrapperStyle: React.CSSProperties = {
  margin: '0 0 24px',
  textAlign: 'center',
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#3b82f6',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '14px 36px',
  textDecoration: 'none',
}

const urgentButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  backgroundColor: '#dc2626',
}

const helpTextStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
  textAlign: 'center',
}

const linkStyle: React.CSSProperties = {
  color: '#3b82f6',
  textDecoration: 'underline',
}

TrialEndingEmail.subject = (props: TrialEndingEmailProps) =>
  `Your Cronpilot trial ends in ${props.daysLeft} day${props.daysLeft !== 1 ? 's' : ''}`
