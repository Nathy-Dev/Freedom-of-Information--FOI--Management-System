import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1 text-2xs text-ink-500', className)}>
      <Link to="/" aria-label="Home" className="rounded p-0.5 transition-colors hover:text-brand-700">
        <Home aria-hidden className="h-3.5 w-3.5" />
      </Link>
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1">
            <ChevronRight aria-hidden className="h-3 w-3 text-ink-300" />
            {item.to && !isLast ? (
              <Link to={item.to} className="max-w-[14rem] truncate transition-colors hover:text-brand-700">
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={isLast ? 'page' : undefined}
                className={cn('max-w-[18rem] truncate', isLast && 'font-medium text-ink-700')}
              >
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}

export interface PageHeaderProps {
  title: ReactNode
  description?: ReactNode
  breadcrumbs?: Crumb[]
  actions?: ReactNode
  meta?: ReactNode
  tabs?: ReactNode
  icon?: ReactNode
  className?: string
  sticky?: boolean
}

/** Standard page heading: breadcrumbs, title, supporting text, actions and optional tab strip. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  meta,
  tabs,
  icon,
  className,
  sticky,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        'border-b border-ink-200 bg-white px-4 pb-0 pt-4 sm:px-6',
        sticky && 'sticky top-0 z-20 shadow-sm',
        className,
      )}
    >
      {breadcrumbs?.length ? <Breadcrumbs items={breadcrumbs} className="mb-2" /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          {icon ? (
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              {icon}
            </span>
          ) : null}
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-tight text-ink-900 sm:text-xl">{title}</h1>
            {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-ink-500">{description}</p> : null}
            {meta ? <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-500">{meta}</div> : null}
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {tabs}
    </header>
  )
}

/** Small labelled statistic used in page-header meta rows. */
export function MetaItem({ icon, label, value }: { icon?: ReactNode; label: string; value: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon ? <span aria-hidden className="text-ink-400">{icon}</span> : null}
      <span className="text-ink-400">{label}:</span>
      <span className="font-medium text-ink-700">{value}</span>
    </span>
  )
}
