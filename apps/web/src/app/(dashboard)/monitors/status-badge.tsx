import type { MonitorStatus } from '@cronpilot/shared'
import { cn } from '@/lib/utils'

const STATUS_CONFIG: Record<
  MonitorStatus,
  { label: string; className: string; dotClass: string }
> = {
  healthy: {
    label: 'Healthy',
    className: 'bg-green-50 text-green-700 border-green-200',
    dotClass: 'bg-green-500',
  },
  late: {
    label: 'Late',
    className: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    dotClass: 'bg-yellow-500',
  },
  down: {
    label: 'Down',
    className: 'bg-red-50 text-red-700 border-red-200',
    dotClass: 'bg-red-500',
  },
  paused: {
    label: 'Paused',
    className: 'bg-gray-100 text-gray-500 border-gray-200',
    dotClass: 'bg-gray-400',
  },
  new: {
    label: 'New',
    className: 'bg-orange-50 text-orange-600 border-orange-200',
    dotClass: 'bg-orange-400',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: MonitorStatus
  className?: string
}) {
  const config = STATUS_CONFIG[status]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border',
        config.className,
        className,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', config.dotClass)} />
      {config.label}
    </span>
  )
}
