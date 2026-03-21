import { format, formatDistanceToNow } from 'date-fns'

/**
 * Formats a date to a human-readable string.
 * Example: "Mar 9, 2026 14:32"
 */
export function formatDate(d: Date): string {
  return format(d, 'MMM d, yyyy HH:mm')
}

/**
 * Formats a duration in milliseconds to a human-readable string.
 * Examples: "1h 23m 45s", "342ms", "5m 2s"
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }

  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  const parts: string[] = []

  if (hours > 0) parts.push(`${hours}h`)
  if (minutes > 0) parts.push(`${minutes}m`)
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`)

  return parts.join(' ')
}

/**
 * Returns a relative time string.
 * Examples: "3 minutes ago", "2 hours ago", "about 1 month ago"
 */
export function relativeTime(d: Date): string {
  return formatDistanceToNow(d, { addSuffix: true })
}

/**
 * Returns an ISO 8601 string suitable for API responses.
 */
export function toISOString(d: Date): string {
  return d.toISOString()
}

/**
 * Parses an ISO date string and returns a Date, throwing if invalid.
 */
export function parseDate(s: string): Date {
  const d = new Date(s)
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date string: ${s}`)
  }
  return d
}

/**
 * Returns the start of the day (midnight UTC) for a given date.
 */
export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/**
 * Adds a number of days to a date and returns the result.
 */
export function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000)
}
