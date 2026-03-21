'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { MonitorCreateSchema } from '@cronpilot/shared'
import { Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import type { z } from 'zod'
import { apiClient } from '@/lib/api'
import type { MonitorResponse } from '@cronpilot/shared'
import Link from 'next/link'

type FormValues = z.infer<typeof MonitorCreateSchema>

const CRON_EXAMPLES = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every day at midnight', value: '0 0 * * *' },
  { label: 'Every day at 2am', value: '0 2 * * *' },
  { label: 'Every Monday at 9am', value: '0 9 * * 1' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
]

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
]

export default function NewMonitorPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(MonitorCreateSchema),
    defaultValues: {
      timezone: 'UTC',
      gracePeriod: 300,
    },
  })

  const scheduleValue = watch('schedule')

  async function onSubmit(values: FormValues) {
    setServerError(null)
    try {
      const monitor = await apiClient.post<MonitorResponse>('/monitors', values)
      router.push(`/dashboard/monitors/${monitor.id}`)
    } catch (err: unknown) {
      const error = err as { message?: string; code?: string }
      if (error.code === 'INVALID_CRON') {
        setServerError('That cron expression is invalid. Please check the format.')
      } else if (error.code === 'PLAN_LIMIT_REACHED') {
        setServerError('You have reached your plan\'s monitor limit. Please upgrade to add more.')
      } else {
        setServerError(error.message ?? 'Failed to create monitor. Please try again.')
      }
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <nav className="text-sm text-gray-500 mb-2">
          <Link href="/dashboard/monitors" className="hover:text-gray-700 transition-colors">
            Monitors
          </Link>
          <span className="mx-2">/</span>
          <span className="text-gray-900">New monitor</span>
        </nav>
        <h1 className="text-2xl font-bold text-gray-900">Create monitor</h1>
        <p className="text-gray-500 text-sm mt-1">
          Define the expected schedule and we&apos;ll alert you when something goes wrong.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg mb-6">
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
              Monitor name
            </label>
            <input
              id="name"
              type="text"
              {...register('name')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
              placeholder="Nightly database backup"
            />
            {errors.name && (
              <p className="text-red-600 text-xs mt-1.5">{errors.name.message}</p>
            )}
          </div>

          {/* Schedule */}
          <div>
            <label htmlFor="schedule" className="block text-sm font-medium text-gray-700 mb-1.5">
              Cron schedule
            </label>
            <input
              id="schedule"
              type="text"
              {...register('schedule')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm font-mono text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
              placeholder="0 2 * * *"
            />
            {errors.schedule && (
              <p className="text-red-600 text-xs mt-1.5">{errors.schedule.message}</p>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {CRON_EXAMPLES.map((ex) => (
                <button
                  key={ex.value}
                  type="button"
                  onClick={() => setValue('schedule', ex.value)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    scheduleValue === ex.value
                      ? 'bg-orange-50 border-orange-300 text-orange-600'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timezone */}
          <div>
            <label htmlFor="timezone" className="block text-sm font-medium text-gray-700 mb-1.5">
              Timezone
            </label>
            <select
              id="timezone"
              {...register('timezone')}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition bg-white"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
            {errors.timezone && (
              <p className="text-red-600 text-xs mt-1.5">{errors.timezone.message}</p>
            )}
          </div>

          {/* Grace period */}
          <div>
            <label htmlFor="gracePeriod" className="block text-sm font-medium text-gray-700 mb-1.5">
              Grace period (seconds)
            </label>
            <input
              id="gracePeriod"
              type="number"
              min={0}
              max={86400}
              {...register('gracePeriod', { valueAsNumber: true })}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
              placeholder="300"
            />
            <p className="text-xs text-gray-400 mt-1.5">
              How long after the expected run time before we alert you. Default: 300 seconds (5 min).
            </p>
            {errors.gracePeriod && (
              <p className="text-red-600 text-xs mt-1.5">{errors.gracePeriod.message}</p>
            )}
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-orange-500 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Creating…' : 'Create monitor'}
            </button>
            <Link
              href="/dashboard/monitors"
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
