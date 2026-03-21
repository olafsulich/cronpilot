import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Cronpilot',
    template: '%s | Cronpilot',
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
