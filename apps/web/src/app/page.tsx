import Link from 'next/link'
import { Activity, Bell, CheckCircle, Users, Zap, Shield, ArrowRight } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#FFF9F5]">
      {/* Nav */}
      <nav className="border-b border-gray-100">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-orange-500" />
            <span className="text-lg font-semibold text-gray-900">Cronpilot</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-sm bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="py-24 px-4">
        <div className="container mx-auto text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-600 text-sm font-medium px-3 py-1 rounded-full mb-8">
            <Zap className="h-3.5 w-3.5" />
            Simple cron job monitoring
          </div>
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight mb-6">
            Never miss a cron job again
          </h1>
          <p className="text-xl text-gray-500 mb-10 leading-relaxed">
            Instrument your scheduled tasks with a single HTTP ping. Cronpilot tracks execution
            windows, detects failures and missed runs, and alerts your team before customers notice.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 bg-orange-500 text-white px-6 py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors text-base"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/dashboard/monitors"
              className="inline-flex items-center gap-2 text-gray-700 border border-gray-200 px-6 py-3 rounded-lg font-medium hover:bg-orange-50 transition-colors text-base"
            >
              View dashboard
            </Link>
          </div>
          <p className="text-sm text-gray-400 mt-6">
            Free plan includes 3 monitors. No credit card required.
          </p>
        </div>
      </section>

      {/* Code sample */}
      <section className="py-12 px-4 bg-orange-50">
        <div className="container mx-auto max-w-2xl">
          <p className="text-center text-sm text-gray-500 mb-6 font-medium uppercase tracking-wide">
            Add to any cron job in seconds
          </p>
          <div className="bg-gray-900 rounded-xl overflow-hidden shadow-lg">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
              <div className="h-3 w-3 rounded-full bg-red-500" />
              <div className="h-3 w-3 rounded-full bg-yellow-500" />
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-xs text-gray-500 ml-2">crontab</span>
            </div>
            <pre className="p-6 text-sm text-gray-100 font-mono overflow-x-auto">
              <code>{`# Run backup every night at 2am
0 2 * * * /usr/bin/backup.sh && curl -fsS \\
  https://cronpilot.dev/ping/your-secret-token`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Everything you need, nothing you don&apos;t
            </h2>
            <p className="text-gray-500 text-lg">
              Built for engineers who care about reliability but don&apos;t want another complex tool to manage.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard
              icon={<Bell className="h-6 w-6 text-orange-500" />}
              title="Instant alerts"
              description="Get notified the moment a job misses its window or fails. Alerts go to Slack, PagerDuty, email, or your own webhook endpoint."
            />
            <FeatureCard
              icon={<Zap className="h-6 w-6 text-orange-500" />}
              title="Simple setup"
              description="Add a single curl command to any cron job. No agents, no SDKs, no complex configuration. Works with any language or platform."
            />
            <FeatureCard
              icon={<Users className="h-6 w-6 text-orange-500" />}
              title="Team collaboration"
              description="Invite teammates, assign roles, and share on-call responsibility. Everyone stays informed with configurable alert rules."
            />
            <FeatureCard
              icon={<Shield className="h-6 w-6 text-orange-500" />}
              title="Smart deduplication"
              description="Alert deduplication prevents notification storms. You'll hear about a problem once, not hundreds of times."
            />
            <FeatureCard
              icon={<Activity className="h-6 w-6 text-orange-500" />}
              title="Check-in history"
              description="View the full execution history of every job: timestamps, durations, exit codes, and a clear timeline of incidents."
            />
            <FeatureCard
              icon={<CheckCircle className="h-6 w-6 text-orange-500" />}
              title="Grace periods"
              description="Jobs run late sometimes. Configure a grace period so Cronpilot doesn't alert until a job is meaningfully late."
            />
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 px-4 bg-orange-50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Simple, honest pricing</h2>
            <p className="text-gray-500 text-lg">Start free. Upgrade when you need more.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <PricingCard
              name="Free"
              price="$0"
              period="forever"
              description="For individuals and side projects"
              features={[
                '3 monitors',
                '7-day check-in history',
                'Email alerts',
                '1 team member',
              ]}
              cta="Get started"
              ctaHref="/signup"
              highlighted={false}
            />
            <PricingCard
              name="Pro"
              price="$19"
              period="per month"
              description="For small teams that rely on their jobs"
              features={[
                '20 monitors',
                '90-day check-in history',
                'Slack + PagerDuty alerts',
                '5 team members',
                'Custom webhooks',
              ]}
              cta="Start Pro trial"
              ctaHref="/signup?plan=pro"
              highlighted={true}
            />
            <PricingCard
              name="Team"
              price="$79"
              period="per month"
              description="For teams running critical infrastructure"
              features={[
                '100 monitors',
                '365-day check-in history',
                'All alert channels',
                '25 team members',
                'Priority support',
              ]}
              cta="Start Team trial"
              ctaHref="/signup?plan=team"
              highlighted={false}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 px-4">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-gray-500">
            <Activity className="h-4 w-4" />
            <span className="text-sm">Cronpilot &copy; {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/privacy" className="hover:text-gray-900 transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-gray-900 transition-colors">
              Terms
            </Link>
            <Link href="mailto:support@cronpilot.dev" className="hover:text-gray-900 transition-colors">
              Support
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="p-6 rounded-xl border border-gray-100 hover:border-orange-100 hover:shadow-sm transition-all">
      <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
    </div>
  )
}

function PricingCard({
  name,
  price,
  period,
  description,
  features,
  cta,
  ctaHref,
  highlighted,
}: {
  name: string
  price: string
  period: string
  description: string
  features: string[]
  cta: string
  ctaHref: string
  highlighted: boolean
}) {
  return (
    <div
      className={`rounded-xl p-8 flex flex-col ${
        highlighted
          ? 'bg-orange-500 text-white shadow-xl ring-2 ring-orange-500'
          : 'bg-white border border-gray-200'
      }`}
    >
      <div className="mb-6">
        <h3 className={`text-lg font-semibold mb-1 ${highlighted ? 'text-white' : 'text-gray-900'}`}>
          {name}
        </h3>
        <div className="flex items-baseline gap-1 mb-2">
          <span className={`text-4xl font-bold ${highlighted ? 'text-white' : 'text-gray-900'}`}>
            {price}
          </span>
          <span className={`text-sm ${highlighted ? 'text-orange-100' : 'text-gray-500'}`}>
            /{period}
          </span>
        </div>
        <p className={`text-sm ${highlighted ? 'text-orange-100' : 'text-gray-500'}`}>
          {description}
        </p>
      </div>

      <ul className="space-y-3 mb-8 flex-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-center gap-2 text-sm">
            <CheckCircle
              className={`h-4 w-4 flex-shrink-0 ${highlighted ? 'text-orange-200' : 'text-green-500'}`}
            />
            <span className={highlighted ? 'text-orange-50' : 'text-gray-700'}>{feature}</span>
          </li>
        ))}
      </ul>

      <Link
        href={ctaHref}
        className={`text-center py-2.5 px-4 rounded-lg font-medium text-sm transition-colors ${
          highlighted
            ? 'bg-white text-orange-500 hover:bg-orange-50'
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
      >
        {cta}
      </Link>
    </div>
  )
}
