import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Removable chip summarising one active filter above a result list. */
export function FilterChip({
  label,
  value,
  onRemove,
  className,
}: {
  label: string
  value: ReactNode
  onRemove?: () => void
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-lg bg-brand-50 py-1 pl-2.5 text-xs text-brand-800 ring-1 ring-inset ring-brand-200',
        onRemove ? 'pr-1' : 'pr-2.5',
        className,
      )}
    >
      <span className="font-semibold uppercase tracking-wide text-brand-600/90">{label}</span>
      <span className="truncate">{value}</span>
      {onRemove ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${label} filter`}
          className="rounded-md p-0.5 text-brand-600 transition-colors hover:bg-brand-100 hover:text-brand-900"
        >
          <X aria-hidden className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  )
}

/** Selectable multi-choice pill used inside filter panels. */
export function ChoiceChip({
  selected,
  onClick,
  children,
  dot,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  dot?: string
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
        selected
          ? 'border-brand-500 bg-brand-50 text-brand-800'
          : 'border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:bg-ink-50',
        className,
      )}
    >
      {dot ? <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', dot)} /> : null}
      {children}
    </button>
  )
}
