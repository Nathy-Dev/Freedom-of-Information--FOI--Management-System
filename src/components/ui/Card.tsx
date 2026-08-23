import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <section className={cn('card-surface', className)} {...rest} />
}

interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  icon?: ReactNode
}

export function CardHeader({ title, description, actions, icon, className, ...rest }: CardHeaderProps) {
  return (
    <header
      className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-ink-200/80 px-5 py-4', className)}
      {...rest}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span className="mt-0.5 text-brand-600">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink-900">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4', className)} {...rest} />
}

export function CardFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <footer
      className={cn('flex flex-wrap items-center justify-between gap-3 border-t border-ink-200/80 bg-ink-50/60 px-5 py-3', className)}
      {...rest}
    />
  )
}
