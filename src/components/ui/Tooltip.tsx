import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Portal } from './Portal'

export interface TooltipProps {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'right' | 'left'
  className?: string
}

/** Which corner of the bubble is pinned to the point measured off the trigger. */
const ORIGIN = {
  top: '-translate-x-1/2 -translate-y-full',
  bottom: '-translate-x-1/2',
  right: '-translate-y-1/2',
  left: '-translate-x-full -translate-y-1/2',
} as const

const GAP = 8

/**
 * Hover / focus tooltip. The bubble is portalled to `document.body` and placed
 * from the trigger's measured position: an absolutely positioned bubble would be
 * clipped by any scrolling ancestor, which is exactly the case in the collapsed
 * navigation rail where the label is the only thing identifying an icon.
 */
export function Tooltip({ content, children, side = 'top', className }: TooltipProps) {
  const anchor = useRef<HTMLSpanElement>(null)
  const [point, setPoint] = useState<{ top: number; left: number } | null>(null)

  const measure = useCallback(() => {
    const node = anchor.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    setPoint(
      side === 'right'
        ? { top: rect.top + rect.height / 2, left: rect.right + GAP }
        : side === 'left'
          ? { top: rect.top + rect.height / 2, left: rect.left - GAP }
          : side === 'bottom'
            ? { top: rect.bottom + GAP, left: rect.left + rect.width / 2 }
            : { top: rect.top - GAP, left: rect.left + rect.width / 2 },
    )
  }, [side])

  // A visible bubble follows its trigger: `capture` picks up scrolling in the
  // content region and the navigation rail, not just the window.
  useEffect(() => {
    if (!point) return
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [point, measure])

  const hide = () => setPoint(null)

  return (
    <span
      ref={anchor}
      className={cn('relative inline-flex', className)}
      onMouseEnter={measure}
      onMouseLeave={hide}
      onFocus={measure}
      onBlur={hide}
    >
      {children}
      {point ? (
        <Portal>
          <span
            role="tooltip"
            style={{ top: point.top, left: point.left }}
            className={cn(
              'pointer-events-none fixed z-[80] w-max max-w-xs animate-fade-in rounded-lg bg-ink-900 px-2.5 py-1.5',
              'text-2xs font-medium leading-snug text-white shadow-raised',
              ORIGIN[side],
            )}
          >
            {content}
          </span>
        </Portal>
      ) : null}
    </span>
  )
}
