import type { HTMLAttributes, ReactNode, ThHTMLAttributes } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Scroll container for a table. Long tables scroll inside this box rather than
 * pushing the page down, so the column headers (which stick to its top edge) and
 * the page's own action bar stay on screen while the caller works through rows.
 * Pass a `max-h-*` class to override the default cap.
 */
export function TableWrap({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('relative w-full max-h-[70vh] overflow-auto', className)} {...rest} />
}

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-left text-sm', className)} {...rest} />
}

export function Thead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-ink-50 text-ink-600', className)} {...rest} />
}

export function Tbody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-ink-200', className)} {...rest} />
}

interface TrProps extends HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean
  interactive?: boolean
}

export function Tr({ className, selected, interactive, ...rest }: TrProps) {
  return (
    <tr
      className={cn(
        'transition-colors',
        interactive && 'cursor-pointer hover:bg-brand-50/60',
        selected && 'bg-brand-50',
        className,
      )}
      {...rest}
    />
  )
}

export function Th({ className, children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      // Sticky lives on the cell, not on <thead>: browser support is wider, and the
      // cell carries its own opaque background so rows scroll underneath cleanly.
      // The inset shadow keeps a hairline under the header row while it floats.
      className={cn(
        'sticky top-0 z-10 whitespace-nowrap bg-ink-50 px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide',
        'shadow-[inset_0_-1px_0_0_theme(colors.ink.200)]',
        className,
      )}
      {...rest}
    >
      {children}
    </th>
  )
}

export function Td({ className, ...rest }: HTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-3 py-2.5 align-middle text-ink-700', className)} {...rest} />
}

export type SortDirection = 'asc' | 'desc'

interface SortableThProps<K extends string> extends Omit<ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  columnKey: K
  activeKey: K | null
  direction: SortDirection
  onSort: (key: K) => void
  children: ReactNode
  align?: 'left' | 'right' | 'center'
}

/** Column header that drives server-style sorting in the mock API. */
export function SortableTh<K extends string>({
  columnKey,
  activeKey,
  direction,
  onSort,
  children,
  className,
  align = 'left',
  ...rest
}: SortableThProps<K>) {
  const isActive = activeKey === columnKey
  const Icon = !isActive ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown

  return (
    <Th
      aria-sort={isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('p-0', className)}
      {...rest}
    >
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className={cn(
          'flex w-full items-center gap-1.5 bg-ink-50 px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide transition-colors hover:text-brand-700',
          isActive ? 'text-brand-700' : 'text-ink-600',
          align === 'right' && 'justify-end',
          align === 'center' && 'justify-center',
        )}
      >
        <span>{children}</span>
        <Icon aria-hidden className={cn('h-3 w-3 shrink-0', isActive ? 'opacity-100' : 'opacity-45')} />
      </button>
    </Th>
  )
}
