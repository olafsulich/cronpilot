import { createHmac } from 'crypto'
import type { Job } from 'bullmq'
import axios from 'axios'
import { prisma } from '@cronpilot/db'
import type { AlertJobData, SlackConfig, PagerDutyConfig, WebhookConfig, EmailConfig } from '@cronpilot/shared'
import { renderEmail, AlertMissedEmail, AlertFailedEmail } from '@cronpilot/emails'
import { Resend } from 'resend'
import { decrypt } from '../lib/encryption.js'
import { logger } from '../lib/logger.js'

const resend = new Resend(process.env['RESEND_API_KEY'])
const APP_URL = process.env['APP_URL'] ?? 'http://localhost:3000'

/**
 * Dispatches alert notifications for a monitor failure. Implements deduplication
 * by checking failureCount against each AlertRule's notifyAfter threshold.
 */
export async function processAlert(job: Job<AlertJobData>): Promise<void> {
  const { monitorId, teamId, alertType } = job.data
  const jobLog = logger.child({ jobId: job.id, monitorId, teamId, processor: 'alert' })

  // Load the monitor with its alert rules and integrations
  const monitor = await prisma.monitor.findUnique({
    where: { id: monitorId },
    include: {
      alertRules: {
        include: {
          integration: true,
        },
      },
    },
  })

  if (!monitor) {
    jobLog.warn('monitor not found — skipping')
    return
  }

  if (monitor.teamId !== teamId) {
    jobLog.warn('teamId mismatch — skipping')
    return
  }

  if (monitor.status === 'paused') {
    jobLog.info('monitor is paused — skipping notifications')
    return
  }

  // Find the open alert to read the current failureCount
  const openAlert = await prisma.alert.findFirst({
    where: { monitorId, status: 'open' },
    orderBy: { openedAt: 'desc' },
  })

  if (!openAlert) {
    jobLog.info('no open alert found — nothing to notify')
    return
  }

  const { failureCount } = openAlert
  jobLog.info({ failureCount, alertRules: monitor.alertRules.length }, 'processing alert notifications')

  const dashboardUrl = `${APP_URL}/monitors/${monitorId}?utm_source=email&utm_campaign=alert-${alertType}`

  for (const rule of monitor.alertRules) {
    // Deduplication: notify on first failure, then on every Nth failure
    const shouldNotify = failureCount === 1 || failureCount % rule.notifyAfter === 0
    if (!shouldNotify) {
      jobLog.debug(
        { integrationId: rule.integrationId, failureCount, notifyAfter: rule.notifyAfter },
        'skipping notification — deduplication threshold not reached',
      )
      continue
    }

    const integration = rule.integration
    let configJson: string

    try {
      configJson = decrypt(integration.config as string)
    } catch (err) {
      jobLog.error({ err, integrationId: integration.id }, 'failed to decrypt integration config — skipping')
      continue
    }

    const config = JSON.parse(configJson) as Record<string, unknown>

    try {
      switch (integration.type) {
        case 'slack':
          await dispatchSlack(config as SlackConfig, monitor.name, alertType, failureCount, dashboardUrl, jobLog)
          break
        case 'pagerduty':
          await dispatchPagerDuty(config as PagerDutyConfig, monitor.name, alertType, monitorId, jobLog)
          break
        case 'webhook':
          await dispatchWebhook(config as WebhookConfig, monitor, openAlert.id, alertType, failureCount, jobLog)
          break
        case 'email':
          await dispatchEmail(config as EmailConfig, monitor.name, alertType, failureCount, dashboardUrl, jobLog)
          break
        default: {
          const _exhaustive: never = integration.type
          jobLog.warn({ type: _exhaustive }, 'unknown integration type')
        }
      }

      jobLog.info(
        { integrationId: integration.id, type: integration.type },
        'notification dispatched successfully',
      )
    } catch (err) {
      // Log but do not re-throw: a failure on one integration must not block others
      jobLog.error(
        { err, integrationId: integration.id, type: integration.type },
        'failed to dispatch notification',
      )
    }
  }
}

async function dispatchSlack(
  config: SlackConfig,
  monitorName: string,
  alertType: 'missed' | 'failed',
  failureCount: number,
  dashboardUrl: string,
  jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
  const emoji = alertType === 'missed' ? '⏰' : '❌'
  const verb = alertType === 'missed' ? "hasn't checked in" : 'reported a failure'
  const suffix = failureCount > 1 ? ` (failure #${failureCount})` : ''

  const payload = {
    text: `${emoji} Monitor *${monitorName}* ${verb}${suffix}`,
    attachments: [
      {
        color: '#FF0000',
        fields: [
          {
            title: 'Monitor',
            value: monitorName,
            short: true,
          },
          {
            title: 'Consecutive failures',
            value: String(failureCount),
            short: true,
          },
        ],
        actions: [
          {
            type: 'button',
            text: 'View in dashboard',
            url: dashboardUrl,
          },
        ],
        footer: 'Cronpilot',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  }

  jobLog.debug({ webhookUrl: '[redacted]' }, 'posting to Slack')
  await axios.post(config.webhookUrl, payload, { timeout: 10_000 })
}

async function dispatchPagerDuty(
  config: PagerDutyConfig,
  monitorName: string,
  alertType: 'missed' | 'failed',
  monitorId: string,
  jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
  const summary =
    alertType === 'missed'
      ? `Monitor "${monitorName}" missed its check-in`
      : `Monitor "${monitorName}" reported a failure`

  const payload = {
    routing_key: config.integrationKey,
    event_action: 'trigger',
    dedup_key: `cronpilot-monitor-${monitorId}`,
    payload: {
      summary,
      severity: 'critical',
      source: 'cronpilot',
      custom_details: {
        monitor_id: monitorId,
        monitor_name: monitorName,
        alert_type: alertType,
      },
    },
  }

  jobLog.debug('posting to PagerDuty')
  await axios.post('https://events.pagerduty.com/v2/enqueue', payload, {
    timeout: 10_000,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function dispatchWebhook(
  config: WebhookConfig,
  monitor: { id: string; name: string; teamId: string },
  alertId: string,
  alertType: 'missed' | 'failed',
  failureCount: number,
  jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
  const body = JSON.stringify({
    event: `monitor.alert.${alertType}`,
    monitor: {
      id: monitor.id,
      name: monitor.name,
    },
    alert: {
      id: alertId,
      type: alertType,
      failureCount,
    },
    timestamp: new Date().toISOString(),
  })

  const signature = createHmac('sha256', config.secret).update(body).digest('hex')

  jobLog.debug({ url: config.url }, 'posting to webhook')
  await axios.post(config.url, body, {
    timeout: 10_000,
    headers: {
      'Content-Type': 'application/json',
      'X-Cronpilot-Signature': `sha256=${signature}`,
    },
  })
}

async function dispatchEmail(
  config: EmailConfig,
  monitorName: string,
  alertType: 'missed' | 'failed',
  failureCount: number,
  dashboardUrl: string,
  jobLog: ReturnType<typeof logger.child>,
): Promise<void> {
  const EmailTemplate = alertType === 'missed' ? AlertMissedEmail : AlertFailedEmail
  const subject =
    alertType === 'missed'
      ? `Your job "${monitorName}" hasn't checked in`
      : `Your job "${monitorName}" reported a failure`

  const { html, text } = await renderEmail(EmailTemplate, {
    monitorName,
    missedAt: new Date(),
    failureCount,
    dashboardUrl,
  })

  jobLog.debug({ to: config.address }, 'sending alert email')

  await resend.emails.send({
    from: 'alerts@cronpilot.io',
    to: config.address,
    subject,
    html,
    text,
  })
}
