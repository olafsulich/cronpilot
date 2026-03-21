import { Button, Link, Text } from '@react-email/components'
import { Layout } from '../components/layout'

export interface AlertMissedEmailProps {
  monitorName: string
  teamName: string
  missedAt: Date
  dashboardUrl: string
  schedule: string
}

export function AlertMissedEmail({
  monitorName,
  teamName,
  missedAt,
  dashboardUrl,
  schedule,
}: AlertMissedEmailProps) {
  const campaign = 'alert-missed'
  const dashboardUrlWithUtm = appendUtm(dashboardUrl, campaign)
  const formattedTime = formatDateTime(missedAt)

  return (
    <Layout previewText={`Alert: "${monitorName}" hasn't checked in`}>
      {/* Alert icon row */}
      <div style={alertBannerStyle}>
        <span style={alertIconStyle}>⚠</span>
        <span style={alertBannerTextStyle}>Missed Check-in</span>
      </div>

      <Text style={headingStyle}>
        &ldquo;{monitorName}&rdquo; hasn&rsquo;t checked in
      </Text>

      <Text style={bodyTextStyle}>
        Hi {teamName} team,
      </Text>

      <Text style={bodyTextStyle}>
        Your cron job <strong>{monitorName}</strong> missed its expected
        check-in. This likely means the job did not run, was killed before
        completing, or failed silently.
      </Text>

      {/* Details card */}
      <div style={detailsCardStyle}>
        <DetailRow label="Monitor" value={monitorName} />
        <DetailRow label="Expected at" value={formattedTime} />
        <DetailRow label="Schedule" value={schedule} />
        <DetailRow label="Status" value="Missed" valueColor="#dc2626" />
      </div>

      <Text style={bodyTextStyle}>
        Check your server logs to diagnose the issue. If this was intentional
        (e.g., a scheduled maintenance window), you can mute alerts from the
        dashboard.
      </Text>

      <div style={buttonWrapperStyle}>
        <Button href={dashboardUrlWithUtm} style={buttonStyle}>
          View monitor &rarr;
        </Button>
      </div>

      <Text style={helpTextStyle}>
        You received this alert because you are a member of the{' '}
        <strong>{teamName}</strong> team on Cronpilot. Manage your alert
        preferences in{' '}
        <Link href={`https://cronpilot.io/settings/alerts?utm_source=email&utm_campaign=${campaign}`} style={linkStyle}>
          notification settings
        </Link>
        .
      </Text>
    </Layout>
  )
}

interface DetailRowProps {
  label: string
  value: string
  valueColor?: string
}

function DetailRow({ label, value, valueColor }: DetailRowProps) {
  return (
    <div style={detailRowStyle}>
      <span style={detailLabelStyle}>{label}</span>
      <span style={{ ...detailValueStyle, color: valueColor ?? '#1e293b' }}>
        {value}
      </span>
    </div>
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

const alertBannerStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: '6px',
  display: 'flex',
  gap: '8px',
  marginBottom: '24px',
  padding: '12px 16px',
}

const alertIconStyle: React.CSSProperties = {
  color: '#ea580c',
  fontSize: '18px',
  lineHeight: '1',
}

const alertBannerTextStyle: React.CSSProperties = {
  color: '#9a3412',
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

const detailsCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  margin: '24px 0',
  padding: '16px 20px',
}

const detailRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '6px 0',
}

const detailLabelStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '13px',
  fontWeight: '500',
}

const detailValueStyle: React.CSSProperties = {
  color: '#1e293b',
  fontSize: '13px',
  fontWeight: '600',
}

const buttonWrapperStyle: React.CSSProperties = {
  margin: '28px 0',
  textAlign: 'center',
}

const buttonStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 28px',
  textDecoration: 'none',
}

const helpTextStyle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0',
}

const linkStyle: React.CSSProperties = {
  color: '#3b82f6',
  textDecoration: 'underline',
}

AlertMissedEmail.subject = (props: AlertMissedEmailProps) =>
  `Your job "${props.monitorName}" hasn't checked in`
