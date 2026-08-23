import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/ui'

export interface ChartFrameProps {
  title: string
  description?: string
  actions?: ReactNode
  height?: number
  isEmpty?: boolean
  emptyLabel?: string
  legend?: ReactNode
  footer?: ReactNode
  className?: string
  children: ReactNode
}

/** Card chrome shared by every chart so titles, heights and legends line up. */
export function ChartFrame({
  title,
  description,
  actions,
  height = 260,
  isEmpty,
  emptyLabel = 'No data for the selected period.',
  legend,
  footer,
  className,
  children,
}: ChartFrameProps) {
  return (
    <section className={cn('card-surface flex flex-col', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-ink-900">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </header>
      <div className="flex-1 px-2 pb-2">
        {isEmpty ? (
          <EmptyState compact title="Nothing to plot" description={emptyLabel} />
        ) : (
          <div style={{ height }}>{children}</div>
        )}
      </div>
      {legend ? <div className="flex flex-wrap gap-x-4 gap-y-1.5 px-5 pb-3 text-2xs text-ink-600">{legend}</div> : null}
      {footer ? <div className="border-t border-ink-200 px-5 py-2.5 text-2xs text-ink-500">{footer}</div> : null}
    </section>
  )
}

export function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
      <span>{label}</span>
    </span>
  )
}

/** Shared Recharts tooltip so every chart reads the same. */
export const TOOLTIP_STYLE = {
  contentStyle: {
    borderRadius: 12,
    border: '1px solid #DDE4E1',
    boxShadow: '0 10px 15px -3px rgb(21 29 27 / 0.10)',
    fontSize: 12,
    padding: '8px 10px',
  },
  labelStyle: { fontWeight: 600, color: '#25302D', marginBottom: 2 },
  itemStyle: { padding: 0 },
} as const

export const AXIS_STYLE = {
  tick: { fontSize: 11, fill: '#677974' },
  axisLine: { stroke: '#DDE4E1' },
  tickLine: false,
} as const
