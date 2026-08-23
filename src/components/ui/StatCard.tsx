import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

export type StatTone = 'brand' | 'neutral' | 'warning' | 'danger' | 'info' | 'success'

const TONES: Record<StatTone, { bar: string; iconBg: string; iconText: string; value: string }> = {
  brand: { bar: 'bg-brand-500', iconBg: 'bg-brand-50', iconText: 'text-brand-600', value: 'text-ink-900' },
  neutral: { bar: 'bg-ink-300', iconBg: 'bg-ink-100', iconText: 'text-ink-500', value: 'text-ink-900' },
  warning: { bar: 'bg-gold-400', iconBg: 'bg-gold-50', iconText: 'text-gold-600', value: 'text-gold-800' },
  danger: { bar: 'bg-crest-500', iconBg: 'bg-crest-50', iconText: 'text-crest-600', value: 'text-crest-700' },
  info: { bar: 'bg-sky-400', iconBg: 'bg-sky-50', iconText: 'text-sky-600', value: 'text-ink-900' },
  success: { bar: 'bg-brand-600', iconBg: 'bg-brand-50', iconText: 'text-brand-700', value: 'text-brand-800' },
}

export interface StatCardProps {
  label: string
  value: number | string
  hint?: ReactNode
  icon?: ReactNode
  tone?: StatTone
  /** Percentage-point change against the previous period. */
  delta?: number
  deltaLabel?: string
  /** Inverts the colour of the delta arrow, e.g. for overdue counts. */
  invertDelta?: boolean
  to?: string
  suffix?: string
  className?: string
}

/**
 * Colour-coded summary card required by the Terms of Reference (section 30).
 * Optionally links straight to the filtered list that produced the number.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
  delta,
  deltaLabel,
  invertDelta,
  to,
  suffix,
  className,
}: StatCardProps) {
  const palette = TONES[tone]
  const isUp = typeof delta === 'number' && delta > 0
  const isFlat = typeof delta === 'number' && delta === 0
  const good = invertDelta ? !isUp : isUp
  const DeltaIcon = isFlat ? Minus : isUp ? ArrowUpRight : ArrowDownRight

  const body = (
    <div className={cn('card-surface relative flex h-full items-start gap-4 overflow-hidden p-4', to && 'transition-shadow hover:shadow-raised', className)}>
      <span aria-hidden className={cn('absolute inset-y-0 left-0 w-1', palette.bar)} />
      <div className="min-w-0 flex-1 pl-1">
        <p className="truncate text-2xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
        <p className={cn('mt-1.5 flex items-baseline gap-1 text-2xl font-semibold tabular-nums leading-none', palette.value)}>
          {typeof value === 'number' ? formatNumber(value) : value}
          {suffix ? <span className="text-sm font-medium text-ink-400">{suffix}</span> : null}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs">
          {typeof delta === 'number' ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 font-semibold',
                isFlat ? 'text-ink-400' : good ? 'text-brand-700' : 'text-crest-600',
              )}
            >
              <DeltaIcon aria-hidden className="h-3 w-3" />
              {Math.abs(delta)}%
            </span>
          ) : null}
          {deltaLabel ? <span className="text-ink-400">{deltaLabel}</span> : null}
          {hint ? <span className="text-ink-500">{hint}</span> : null}
        </div>
      </div>
      {icon ? (
        <span className={cn('inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', palette.iconBg, palette.iconText)}>
          {icon}
        </span>
      ) : null}
    </div>
  )

  if (!to) return body
  return (
    <Link to={to} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2">
      {body}
    </Link>
  )
}
