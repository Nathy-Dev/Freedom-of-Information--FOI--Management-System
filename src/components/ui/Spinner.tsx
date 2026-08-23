import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2 text-ink-500">
      <Loader2 aria-hidden className={cn('h-4 w-4 animate-spin', className)} />
      <span className={label ? 'text-xs' : 'sr-only'}>{label ?? 'Loading'}</span>
    </span>
  )
}

/** Centred loader for a page or panel body. */
export function LoadingBlock({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center justify-center py-16', className)}>
      <Spinner label={label} />
    </div>
  )
}
