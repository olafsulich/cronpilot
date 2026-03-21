import { Button, Link, Text } from '@react-email/components'
import { Layout } from '../components/layout'

export interface WelcomeEmailProps {
  userName: string
  teamName: string
  dashboardUrl: string
  docsUrl: string
}

export function WelcomeEmail({
  userName,
  teamName,
  dashboardUrl,
  docsUrl,
}: WelcomeEmailProps) {
  const campaign = 'welcome'
  const dashboardUrlWithUtm = appendUtm(dashboardUrl, campaign)
  const docsUrlWithUtm = appendUtm(docsUrl, campaign)

  return (
    <Layout previewText={`Welcome to Cronpilot, ${userName}! Your cron jobs are now in good hands.`}>
      <Text style={headingStyle}>Welcome to Cronpilot! 🎉</Text>

      <Text style={bodyTextStyle}>Hi {userName},</Text>

      <Text style={bodyTextStyle}>
        You&rsquo;re all set. <strong>{teamName}</strong> is now on Cronpilot —
        the easiest way to monitor your cron jobs and get alerted the moment
        something goes wrong.
      </Text>

      {/* Quick start steps */}
      <div style={stepsCardStyle}>
        <Text style={stepsHeadingStyle}>Get started in 3 steps</Text>

        <div style={stepRowStyle}>
          <div style={stepNumberStyle}>1</div>
          <div style={stepContentStyle}>
            <div style={stepTitleStyle}>Create a monitor</div>
            <div style={stepDescStyle}>
              Define your cron job with its schedule and give it a name. You can
              add as many monitors as you need.
            </div>
          </div>
        </div>

        <div style={stepRowStyle}>
          <div style={stepNumberStyle}>2</div>
          <div style={stepContentStyle}>
            <div style={stepTitleStyle}>Add the ping URL to your cron job</div>
            <div style={stepDescStyle}>
              Each monitor gets a unique ping URL. Append a{' '}
              <code style={codeStyle}>curl</code> call to the end of your cron
              script to tell Cronpilot it ran successfully.
            </div>
          </div>
        </div>

        <div style={{ ...stepRowStyle, borderBottom: 'none' }}>
          <div style={stepNumberStyle}>3</div>
          <div style={stepContentStyle}>
            <div style={stepTitleStyle}>Set up alerts</div>
            <div style={stepDescStyle}>
              Configure who gets notified and how (email, Slack, SMS) when a
              job misses its check-in or reports a failure.
            </div>
          </div>
        </div>
      </div>

      {/* Example snippet */}
      <Text style={snippetHeadingStyle}>Example cron job ping</Text>
      <div style={codeBlockStyle}>
        <code style={codeBlockTextStyle}>
          {'# Your existing cron job command, followed by:'}
          <br />
          {'curl -fsS --retry 3 https://ping.cronpilot.io/your-token > /dev/null'}
        </code>
      </div>
      <Text style={snippetNoteStyle}>
        The <code style={inlineCodeStyle}>-fsS --retry 3</code> flags ensure the
        ping is retried on network errors and doesn&rsquo;t produce noise in
        your cron logs.
      </Text>

      {/* CTA buttons */}
      <div style={buttonGroupStyle}>
        <Button href={dashboardUrlWithUtm} style={primaryButtonStyle}>
          Open dashboard
        </Button>
        <Button href={docsUrlWithUtm} style={secondaryButtonStyle}>
          Read the docs
        </Button>
      </div>

      {/* What to expect */}
      <div style={whatToExpectCardStyle}>
        <Text style={whatToExpectHeadingStyle}>What to expect</Text>
        <Text style={whatToExpectTextStyle}>
          You&rsquo;ll receive an alert email when a monitor misses a check-in
          or reports failure, and a follow-up when it recovers. Every Monday
          you&rsquo;ll get a weekly digest summarizing your monitors&rsquo;
          uptime and any incidents.
        </Text>
      </div>

      <Text style={helpTextStyle}>
        Need help?{' '}
        <Link
          href={`https://cronpilot.io/docs?utm_source=email&utm_campaign=${campaign}`}
          style={linkStyle}
        >
          Browse the documentation
        </Link>{' '}
        or reply to this email — we&rsquo;re happy to help you get set up.
      </Text>
    </Layout>
  )
}

function appendUtm(url: string, campaign: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}utm_source=email&utm_campaign=${campaign}`
}

const headingStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: '700',
  letterSpacing: '-0.5px',
  lineHeight: '36px',
  margin: '0 0 20px',
}

const bodyTextStyle: React.CSSProperties = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const stepsCardStyle: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  margin: '24px 0',
  padding: '20px 24px',
}

const stepsHeadingStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '15px',
  fontWeight: '700',
  margin: '0 0 16px',
}

const stepRowStyle: React.CSSProperties = {
  alignItems: 'flex-start',
  borderBottom: '1px solid #e2e8f0',
  display: 'flex',
  gap: '14px',
  paddingBottom: '14px',
  marginBottom: '14px',
}

const stepNumberStyle: React.CSSProperties = {
  alignItems: 'center',
  backgroundColor: '#0f172a',
  borderRadius: '50%',
  color: '#ffffff',
  display: 'inline-flex',
  flexShrink: 0,
  fontSize: '13px',
  fontWeight: '700',
  height: '28px',
  justifyContent: 'center',
  width: '28px',
}

const stepContentStyle: React.CSSProperties = {
  flex: 1,
}

const stepTitleStyle: React.CSSProperties = {
  color: '#1e293b',
  fontSize: '14px',
  fontWeight: '600',
  marginBottom: '4px',
}

const stepDescStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: '20px',
}

const codeStyle: React.CSSProperties = {
  backgroundColor: '#e2e8f0',
  borderRadius: '3px',
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: '12px',
  padding: '1px 4px',
}

const snippetHeadingStyle: React.CSSProperties = {
  color: '#0f172a',
  fontSize: '14px',
  fontWeight: '600',
  margin: '0 0 8px',
}

const codeBlockStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  margin: '0 0 8px',
  padding: '16px 20px',
}

const codeBlockTextStyle: React.CSSProperties = {
  color: '#e2e8f0',
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: '13px',
  lineHeight: '22px',
}

const snippetNoteStyle: React.CSSProperties = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: '20px',
  margin: '0 0 24px',
}

const inlineCodeStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  borderRadius: '3px',
  fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
  fontSize: '12px',
  padding: '1px 5px',
}

const buttonGroupStyle: React.CSSProperties = {
  display: 'flex',
  gap: '12px',
  margin: '28px 0',
}

const primaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#0f172a',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
}

const secondaryButtonStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '6px',
  color: '#475569',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
}

const whatToExpectCardStyle: React.CSSProperties = {
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '8px',
  margin: '0 0 24px',
  padding: '16px 20px',
}

const whatToExpectHeadingStyle: React.CSSProperties = {
  color: '#1e40af',
  fontSize: '13px',
  fontWeight: '700',
  margin: '0 0 8px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

const whatToExpectTextStyle: React.CSSProperties = {
  color: '#1e40af',
  fontSize: '14px',
  lineHeight: '22px',
  margin: '0',
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

WelcomeEmail.subject = (props: WelcomeEmailProps) =>
  `Welcome to Cronpilot, ${props.userName}!`
