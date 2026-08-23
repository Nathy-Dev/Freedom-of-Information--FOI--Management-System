import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Renders children into document.body, guarded for the first client render. */
export function Portal({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  if (!mounted) return null
  return createPortal(children, document.body)
}

/**
 * Locks background scrolling while an overlay is open. The shell scrolls its
 * content region rather than the document, so both have to be pinned.
 */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    const main = document.getElementById('main-content')
    const previousBody = document.body.style.overflow
    const previousMain = main?.style.overflow ?? ''
    document.body.style.overflow = 'hidden'
    if (main) main.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousBody
      if (main) main.style.overflow = previousMain
    }
  }, [active])
}

/** Calls `onClose` when Escape is pressed while `active`. */
export function useEscapeKey(active: boolean, onClose: () => void) {
  useEffect(() => {
    if (!active) return
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onClose])
}
