import type { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface FieldProps {
  label?: ReactNode
  htmlFor?: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  className?: string
  labelSuffix?: ReactNode
  children: ReactNode
}

/** Shared label / hint / error scaffold so every form control is accessible the same way. */
export function Field({ label, htmlFor, hint, error, required, className, labelSuffix, children }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wide text-ink-600">
            {label}
            {required ? (
              <span className="ml-1 text-crest-600" aria-hidden>
                *
              </span>
            ) : null}
          </label>
          {labelSuffix}
        </div>
      ) : null}
      {children}
      {error ? (
        <p
          id={htmlFor ? `${htmlFor}-error` : undefined}
          role="alert"
          className="flex items-start gap-1.5 text-xs font-medium text-crest-700"
        >
          <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={htmlFor ? `${htmlFor}-hint` : undefined} className="text-xs text-ink-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export const controlBase =
  'w-full rounded-lg border bg-white text-sm text-ink-900 shadow-sm transition-colors placeholder:text-ink-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/40 disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-500'

export function controlClasses(hasError?: boolean) {
  return cn(controlBase, hasError ? 'border-crest-400 focus:border-crest-500' : 'border-ink-300 focus:border-brand-500')
}

/**
 * The ids Field gives its hint and error text, so a control can point
 * `aria-describedby` at whichever one is currently on screen.
 */
export function describedBy(id: string, parts: { error?: string | null; hint?: unknown }) {
  if (parts.error) return `${id}-error`
  if (parts.hint) return `${id}-hint`
  return undefined
}
