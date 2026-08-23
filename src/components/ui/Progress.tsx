import { cn } from '@/lib/utils'
import { clamp } from '@/lib/utils'

export interface ProgressProps {
  value: number
  max?: number
  label?: string
  barClassName?: string
  className?: string
  size?: 'sm' | 'md'
  showValue?: boolean
}

export function Progress({ value, max = 100, label, barClassName, className, size = 'sm', showValue }: ProgressProps) {
  const percent = clamp((value / (max || 1)) * 100, 0, 100)

  return (
    <div className={cn('w-full', className)}>
      {label || showValue ? (
        <div className="mb-1 flex items-baseline justify-between gap-2 text-2xs">
          {label ? <span className="font-medium text-ink-600">{label}</span> : null}
          {showValue ? <span className="tabular-nums text-ink-500">{Math.round(percent)}%</span> : null}
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn('w-full overflow-hidden rounded-full bg-ink-200', size === 'sm' ? 'h-1.5' : 'h-2.5')}
      >
        <div
          className={cn('h-full rounded-full transition-[width] duration-500', barClassName ?? 'bg-brand-500')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

/** Horizontal bar broken into coloured segments; used for status distribution. */
export function SegmentedBar({
  segments,
  className,
}: {
  segments: Array<{ key: string; value: number; className: string; label: string }>
  className?: string
}) {
  const total = segments.reduce((acc, s) => acc + s.value, 0) || 1

  return (
    <div className={cn('flex h-2.5 w-full overflow-hidden rounded-full bg-ink-100', className)}>
      {segments
        .filter((segment) => segment.value > 0)
        .map((segment) => (
          <div
            key={segment.key}
            title={`${segment.label}: ${segment.value}`}
            className={cn('h-full transition-[width] duration-500', segment.className)}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
    </div>
  )
}
