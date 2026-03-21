import { requireSession } from '@/lib/auth'
import { SidebarNav } from '@/components/shared/nav'
import { UserMenu } from './user-menu'
import { Activity } from 'lucide-react'
import Link from 'next/link'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession()

  return (
    <div className="min-h-screen bg-[#FFF9F5] flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col fixed inset-y-0 left-0 z-10">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-gray-100">
          <Link href="/dashboard/monitors" className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-orange-500" />
            <span className="font-semibold text-gray-900 text-sm">Cronpilot</span>
          </Link>
        </div>

        {/* Nav */}
        <div className="flex-1 overflow-y-auto p-3">
          <SidebarNav />
        </div>

        {/* Bottom links */}
        <div className="p-3 border-t border-gray-100">
          <Link
            href="/dashboard/settings/billing"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
          >
            Billing &amp; Plan
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col ml-60">
        {/* Top bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 sticky top-0 z-10">
          <div />
          <UserMenu
            email={session.user.email}
          />
        </header>

        {/* Content */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  )
}
