import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DropdownItem {
  key: string
  label: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  disabled?: boolean
  danger?: boolean
  /** Renders a divider above this item. */
  separated?: boolean
}

export interface DropdownProps {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  items: DropdownItem[]
  align?: 'start' | 'end'
  width?: string
  label?: string
  header?: ReactNode
  footer?: ReactNode
  className?: string
}

export function Dropdown({ trigger, items, align = 'end', width = 'w-56', label, header, footer, className }: DropdownProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open ? (
        <div
          role="menu"
          aria-label={label}
          className={cn(
            'absolute z-40 mt-1.5 animate-slide-up overflow-hidden rounded-xl border border-ink-200 bg-white py-1 shadow-overlay',
            align === 'end' ? 'right-0' : 'left-0',
            width,
          )}
        >
          {header ? <div className="border-b border-ink-200 px-3 py-2">{header}</div> : null}
          {items.map((item) => (
            <div key={item.key}>
              {item.separated ? <div role="separator" className="my-1 h-px bg-ink-200" /> : null}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false)
                  item.onSelect?.()
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:bg-ink-100',
                  item.disabled
                    ? 'cursor-not-allowed text-ink-400'
                    : item.danger
                      ? 'text-crest-700 hover:bg-crest-50'
                      : 'text-ink-700 hover:bg-brand-50 hover:text-brand-800',
                )}
              >
                {item.icon ? <span className="shrink-0 text-ink-400">{item.icon}</span> : null}
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </button>
            </div>
          ))}
          {footer ? <div className="border-t border-ink-200 px-3 py-2">{footer}</div> : null}
        </div>
      ) : null}
    </div>
  )
}
