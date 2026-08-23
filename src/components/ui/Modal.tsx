import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Portal, useEscapeKey, useScrollLock } from './Portal'

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full'

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-6xl',
}

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  size?: ModalSize
  footer?: ReactNode
  children: ReactNode
  /** Hide the close affordances for blocking confirmations. */
  dismissible?: boolean
  bodyClassName?: string
}

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'md',
  footer,
  children,
  dismissible = true,
  bodyClassName,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useScrollLock(open)
  useEscapeKey(open && dismissible, onClose)

  useEffect(() => {
    if (!open) return
    // Move focus into the dialog so keyboard users are not left behind it.
    const target = panelRef.current?.querySelector<HTMLElement>(
      '[data-autofocus], input:not([type="hidden"]), textarea, select, button',
    )
    target?.focus()
  }, [open])

  if (!open) return null

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center sm:p-6">
        <div
          aria-hidden
          onClick={dismissible ? onClose : undefined}
          className="fixed inset-0 animate-fade-in bg-ink-900/45 backdrop-blur-[2px]"
        />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={typeof title === 'string' ? title : undefined}
          className={cn(
            'relative z-10 my-auto w-full animate-scale-in overflow-hidden rounded-2xl bg-white shadow-overlay',
            SIZES[size],
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-ink-200 px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink-900">{title}</h2>
              {description ? <p className="mt-1 text-sm text-ink-500">{description}</p> : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-1 -mt-1 rounded-lg p-1.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <X aria-hidden className="h-4.5 w-4.5" />
              </button>
            ) : null}
          </header>

          <div className={cn('max-h-[70vh] overflow-y-auto px-5 py-4', bodyClassName)}>{children}</div>

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
