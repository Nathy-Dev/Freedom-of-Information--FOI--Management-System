import { forwardRef, useId } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Field, controlClasses, describedBy } from './Field'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  leadingIcon?: ReactNode
  trailingSlot?: ReactNode
  containerClassName?: string
  labelSuffix?: ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, leadingIcon, trailingSlot, className, containerClassName, id, required, labelSuffix, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId

  return (
    <Field
      label={label}
      htmlFor={inputId}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
      labelSuffix={labelSuffix}
    >
      <div className="relative">
        {leadingIcon ? (
          <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400">
            {leadingIcon}
          </span>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(inputId, { error, hint })}
          className={cn(
            controlClasses(Boolean(error)),
            'h-9.5 px-3',
            leadingIcon && 'pl-9',
            trailingSlot && 'pr-10',
            className,
          )}
          {...rest}
        />
        {trailingSlot ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400">{trailingSlot}</span>
        ) : null}
      </div>
    </Field>
  )
})
