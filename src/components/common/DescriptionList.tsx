import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DescriptionItem {
  label: string
  value: ReactNode
  hint?: string
  span?: boolean
}

/** Label/value grid used across case, user, document and court detail panels. */
export function DescriptionList({
  items,
  columns = 2,
  className,
}: {
  items: DescriptionItem[]
  columns?: 1 | 2 | 3
  className?: string
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-6 gap-y-4',
        columns === 1 ? 'grid-cols-1' : columns === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className={cn('min-w-0', item.span && 'sm:col-span-2 lg:col-span-3')}>
          <dt className="text-2xs font-semibold uppercase tracking-wide text-ink-500">{item.label}</dt>
          <dd className="mt-1 break-words text-sm text-ink-800">{item.value}</dd>
          {item.hint ? <p className="mt-0.5 text-2xs text-ink-400">{item.hint}</p> : null}
        </div>
      ))}
    </dl>
  )
}

/** Compact vertical key/value rows, for sidebars. */
export function KeyValueRows({ items, className }: { items: DescriptionItem[]; className?: string }) {
  return (
    <dl className={cn('divide-y divide-ink-200/70', className)}>
      {items.map((item) => (
        <div key={item.label} className="flex items-start justify-between gap-3 py-2.5">
          <dt className="shrink-0 text-xs text-ink-500">{item.label}</dt>
          <dd className="min-w-0 text-right text-xs font-medium text-ink-800">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
