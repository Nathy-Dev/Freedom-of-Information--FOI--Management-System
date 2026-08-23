import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import type { ToastVariant } from '@/store/ToastContext'
import { useToast } from '@/store/ToastContext'
import { cn } from '@/lib/utils'

const VARIANTS: Record<ToastVariant, { ring: string; icon: typeof Info; iconClass: string }> = {
  success: { ring: 'ring-brand-200', icon: CheckCircle2, iconClass: 'text-brand-600' },
  error: { ring: 'ring-crest-200', icon: XCircle, iconClass: 'text-crest-600' },
  warning: { ring: 'ring-gold-200', icon: AlertTriangle, iconClass: 'text-gold-600' },
  info: { ring: 'ring-sky-200', icon: Info, iconClass: 'text-sky-600' },
}

/** Live region for transient confirmations; mounted once inside the app shell. */
export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((toast) => {
        const variant = VARIANTS[toast.variant]
        const Icon = variant.icon
        return (
          <div
            key={toast.id}
            role="status"
            className={cn(
              'pointer-events-auto flex animate-slide-up items-start gap-3 rounded-xl bg-white px-4 py-3 shadow-overlay ring-1',
              variant.ring,
            )}
          >
            <Icon aria-hidden className={cn('mt-0.5 h-4.5 w-4.5 shrink-0', variant.iconClass)} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900">{toast.title}</p>
              {toast.description ? <p className="mt-0.5 text-xs leading-relaxed text-ink-600">{toast.description}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
              className="-mr-1 -mt-1 rounded-md p-1 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
            >
              <X aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
