import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CountPill } from './Badge'

export interface TabItem<K extends string = string> {
  key: K
  label: ReactNode
  count?: number
  icon?: ReactNode
  disabled?: boolean
}

export interface TabsProps<K extends string> {
  tabs: Array<TabItem<K>>
  active: K
  onChange: (key: K) => void
  variant?: 'underline' | 'pill'
  className?: string
  label?: string
  trailing?: ReactNode
}

export function Tabs<K extends string>({
  tabs,
  active,
  onChange,
  variant = 'underline',
  className,
  label = 'Sections',
  trailing,
}: TabsProps<K>) {
  if (variant === 'pill') {
    return (
      <div role="tablist" aria-label={label} className={cn('flex flex-wrap items-center gap-1.5', className)}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={tab.key === active}
            disabled={tab.disabled}
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
              tab.key === active
                ? 'bg-brand-600 text-white shadow-sm'
                : 'bg-white text-ink-600 ring-1 ring-inset ring-ink-200 hover:bg-ink-50 hover:text-ink-800',
              tab.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? (
              <CountPill value={tab.count} tone={tab.key === active ? 'neutral' : 'brand'} />
            ) : null}
          </button>
        ))}
        {trailing ? <div className="ml-auto">{trailing}</div> : null}
      </div>
    )
  }

  return (
    <div className={cn('flex items-end gap-4 border-b border-ink-200', className)}>
      <div role="tablist" aria-label={label} className="scrollbar-none -mb-px flex flex-1 gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={tab.key === active}
            disabled={tab.disabled}
            onClick={() => onChange(tab.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:bg-brand-50',
              tab.key === active
                ? 'border-brand-600 text-brand-800'
                : 'border-transparent text-ink-500 hover:border-ink-300 hover:text-ink-800',
              tab.disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            {tab.icon}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' ? (
              <CountPill value={tab.count} tone={tab.key === active ? 'brand' : 'neutral'} />
            ) : null}
          </button>
        ))}
      </div>
      {trailing ? <div className="pb-2">{trailing}</div> : null}
    </div>
  )
}
