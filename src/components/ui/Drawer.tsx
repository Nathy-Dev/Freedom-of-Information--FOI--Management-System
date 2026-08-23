import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Portal, useEscapeKey, useScrollLock } from './Portal'

export interface DrawerProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  side?: 'right' | 'left'
  width?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
  children: ReactNode
}

const WIDTHS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-xl' } as const

/** Slide-over used for filters, quick previews and record side panels. */
export function Drawer({ open, onClose, title, description, side = 'right', width = 'md', footer, children }: DrawerProps) {
  useScrollLock(open)
  useEscapeKey(open, onClose)

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-50">
        <div aria-hidden onClick={onClose} className="absolute inset-0 animate-fade-in bg-ink-900/40" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
          className={cn(
            'absolute inset-y-0 flex w-full flex-col bg-white shadow-overlay',
            side === 'right' ? 'right-0 animate-slide-in-right' : 'left-0 animate-slide-in-right',
            WIDTHS[width],
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink-900">{title}</h2>
              {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close panel"
              className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <X aria-hidden className="h-4.5 w-4.5" />
            </button>
          </header>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-ink-200 bg-ink-50/70 px-5 py-3">
              {footer}
            </footer>
          ) : null}
        </div>
      </div>
    </Portal>
  )
}
