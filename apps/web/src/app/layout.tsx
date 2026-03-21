import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from './session-provider'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: {
    default: 'Cronpilot — Cron Job Monitoring',
    template: '%s | Cronpilot',
  },
  description:
    'Never miss a cron job again. Monitor your scheduled tasks, get instant alerts, and keep your team informed.',
  metadataBase: new URL(process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://cronpilot.dev'),
  openGraph: {
    title: 'Cronpilot — Cron Job Monitoring',
    description: 'Never miss a cron job again.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
