import { forwardRef, useEffect, useId, useRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: ReactNode
  description?: ReactNode
  indeterminate?: boolean
  containerClassName?: string
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, indeterminate, className, containerClassName, id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const innerRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (innerRef.current) innerRef.current.indeterminate = Boolean(indeterminate)
  }, [indeterminate])

  return (
    <div className={cn('flex items-start gap-2.5', containerClassName)}>
      <input
        ref={(node) => {
          innerRef.current = node
          if (typeof ref === 'function') ref(node)
          else if (ref) ref.current = node
        }}
        id={inputId}
        type="checkbox"
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-ink-300 text-brand-600',
          'focus:ring-2 focus:ring-brand-500/40 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...rest}
      />
      {label || description ? (
        <div className="min-w-0 leading-tight">
          {label ? (
            <label htmlFor={inputId} className="cursor-pointer select-none text-sm text-ink-800">
              {label}
            </label>
          ) : null}
          {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
        </div>
      ) : null}
    </div>
  )
})

export interface ToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label?: ReactNode
  description?: ReactNode
  disabled?: boolean
  id?: string
  className?: string
  /** Keep the label for assistive technology only — used inside preference matrices. */
  srOnlyLabel?: boolean
}

/** Switch used across settings and notification preference screens. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
  className,
  srOnlyLabel,
}: ToggleProps) {
  const autoId = useId()
  const switchId = id ?? autoId

  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      {(label || description) && !srOnlyLabel ? (
        <div className="min-w-0">
          {label ? (
            <label htmlFor={switchId} className="block text-sm font-medium text-ink-800">
              {label}
            </label>
          ) : null}
          {description ? <p className="mt-0.5 text-xs text-ink-500">{description}</p> : null}
        </div>
      ) : null}
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={typeof label === 'string' ? label : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2',
          checked ? 'bg-brand-600' : 'bg-ink-300',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-[1.15rem]' : 'translate-x-[0.2rem]',
          )}
        />
      </button>
    </div>
  )
}
