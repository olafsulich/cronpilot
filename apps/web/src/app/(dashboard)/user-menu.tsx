'use client'

import { signOut } from 'next-auth/react'
import { useState } from 'react'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export function UserMenu({ email }: { email: string }) {
  const [open, setOpen] = useState(false)

  const initials = email.slice(0, 2).toUpperCase()

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 transition-colors"
      >
        <span className="w-7 h-7 bg-orange-500 text-white text-xs font-medium rounded-full flex items-center justify-center">
          {initials}
        </span>
        <span className="hidden sm:block max-w-[180px] truncate text-sm text-gray-600">
          {email}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 text-gray-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-20">
            <div className="px-4 py-2 border-b border-gray-100 mb-1">
              <p className="text-xs text-gray-400">Signed in as</p>
              <p className="text-sm font-medium text-gray-900 truncate">{email}</p>
            </div>
            <Link
              href="/dashboard/settings/integrations"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Settings className="h-4 w-4 text-gray-400" />
              Settings
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <LogOut className="h-4 w-4 text-gray-400" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
