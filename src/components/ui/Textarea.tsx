import { forwardRef, useId } from 'react'
import type { ReactNode, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Field, controlClasses, describedBy } from './Field'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  containerClassName?: string
  /** Shows a live "n / max" counter under the label. */
  showCount?: boolean
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, className, containerClassName, id, required, showCount, maxLength, value, rows = 4, ...rest },
  ref,
) {
  const autoId = useId()
  const textareaId = id ?? autoId
  const length = typeof value === 'string' ? value.length : 0

  return (
    <Field
      label={label}
      htmlFor={textareaId}
      hint={hint}
      error={error}
      required={required}
      className={containerClassName}
      labelSuffix={
        showCount ? (
          <span className={cn('text-2xs tabular-nums text-ink-400', maxLength && length > maxLength * 0.92 && 'text-gold-700')}>
            {length}
            {maxLength ? ` / ${maxLength}` : ''}
          </span>
        ) : undefined
      }
    >
      <textarea
        ref={ref}
        id={textareaId}
        rows={rows}
        required={required}
        maxLength={maxLength}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(textareaId, { error, hint })}
        className={cn(controlClasses(Boolean(error)), 'resize-y px-3 py-2 leading-relaxed', className)}
        {...rest}
      />
    </Field>
  )
})
