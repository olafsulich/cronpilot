import bcrypt from 'bcrypt'
import { PrismaClient } from '@prisma/client'
import { generatePingToken } from '@cronpilot/shared'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clean up existing data in dependency order
  await prisma.alertRule.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.checkin.deleteMany()
  await prisma.monitor.deleteMany()
  await prisma.integration.deleteMany()
  await prisma.teamMember.deleteMany()
  await prisma.user.deleteMany()
  await prisma.team.deleteMany()

  // Create team
  const team = await prisma.team.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      plan: 'free',
    },
  })
  console.log(`Created team: ${team.name} (${team.id})`)

  // Create admin user
  const passwordHash = await bcrypt.hash('password123', 12)
  const user = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      passwordHash,
    },
  })
  console.log(`Created user: ${user.email} (${user.id})`)

  // Add user as team owner
  await prisma.teamMember.create({
    data: {
      userId: user.id,
      teamId: team.id,
      role: 'owner',
    },
  })

  const now = new Date()

  // Monitor 1: Healthy — checks in every 5 minutes, last seen recently
  const monitor1 = await prisma.monitor.create({
    data: {
      teamId: team.id,
      name: 'Database Backup',
      schedule: '*/5 * * * *',
      timezone: 'UTC',
      gracePeriod: 60,
      pingToken: generatePingToken(),
      status: 'active',
      lastCheckinAt: new Date(now.getTime() - 2 * 60 * 1000), // 2 minutes ago
    },
  })
  console.log(`Created monitor: ${monitor1.name} (${monitor1.id})`)

  // Create recent checkins for monitor 1
  const monitor1Checkins = Array.from({ length: 10 }, (_, i) => ({
    monitorId: monitor1.id,
    receivedAt: new Date(now.getTime() - (i + 1) * 5 * 60 * 1000),
    duration: Math.floor(Math.random() * 3000) + 100,
    status: 'ok' as const,
    exitCode: 0,
  }))
  await prisma.checkin.createMany({ data: monitor1Checkins })

  // Monitor 2: Down — daily backup that hasn't reported in 2 days
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
  const monitor2 = await prisma.monitor.create({
    data: {
      teamId: team.id,
      name: 'Nightly Report Generator',
      schedule: '0 2 * * *',
      timezone: 'America/New_York',
      gracePeriod: 1800,
      pingToken: generatePingToken(),
      status: 'active',
      lastCheckinAt: twoDaysAgo,
    },
  })
  console.log(`Created monitor: ${monitor2.name} (${monitor2.id})`)

  // Create checkins for monitor 2 (last one was 2 days ago and failed)
  await prisma.checkin.createMany({
    data: [
      {
        monitorId: monitor2.id,
        receivedAt: twoDaysAgo,
        duration: 45320,
        status: 'fail',
        exitCode: 1,
      },
      {
        monitorId: monitor2.id,
        receivedAt: new Date(twoDaysAgo.getTime() - 24 * 60 * 60 * 1000),
        duration: 42100,
        status: 'ok',
        exitCode: 0,
      },
      {
        monitorId: monitor2.id,
        receivedAt: new Date(twoDaysAgo.getTime() - 2 * 24 * 60 * 60 * 1000),
        duration: 38900,
        status: 'ok',
        exitCode: 0,
      },
    ],
  })

  // Create an open alert for monitor 2
  const alert = await prisma.alert.create({
    data: {
      monitorId: monitor2.id,
      type: 'missed',
      status: 'open',
      failureCount: 2,
      openedAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    },
  })
  console.log(`Created open alert: ${alert.id} for monitor ${monitor2.name}`)

  // Monitor 3: Paused — weekly job that was explicitly paused
  const monitor3 = await prisma.monitor.create({
    data: {
      teamId: team.id,
      name: 'Weekly Analytics Export',
      schedule: '0 9 * * 1',
      timezone: 'Europe/London',
      gracePeriod: 3600,
      pingToken: generatePingToken(),
      status: 'paused',
      lastCheckinAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    },
  })
  console.log(`Created monitor: ${monitor3.name} (${monitor3.id})`)

  await prisma.checkin.create({
    data: {
      monitorId: monitor3.id,
      receivedAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      duration: 120000,
      status: 'ok',
      exitCode: 0,
    },
  })

  // Create a Slack integration (config stored as placeholder — encrypted in production)
  const integration = await prisma.integration.create({
    data: {
      teamId: team.id,
      type: 'slack',
      name: 'Slack #alerts',
      // In production this would be AES-256 encrypted; for seed data we store a placeholder
      configEncrypted: Buffer.from(
        JSON.stringify({ webhookUrl: 'https://hooks.slack.com/services/T000/B000/xxxx', channel: '#alerts' }),
      ).toString('base64'),
    },
  })
  console.log(`Created integration: ${integration.name} (${integration.id})`)

  // Wire up an alert rule: notify Slack when monitor2 has 1+ failures
  await prisma.alertRule.create({
    data: {
      monitorId: monitor2.id,
      integrationId: integration.id,
      notifyAfter: 1,
    },
  })

  console.log('\nSeed complete.')
  console.log('Login: admin@acme.com / password123')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
