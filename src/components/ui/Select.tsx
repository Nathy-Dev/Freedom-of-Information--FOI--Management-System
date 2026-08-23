import { forwardRef, useId } from 'react'
import type { ReactNode, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Field, controlClasses, describedBy } from './Field'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  group?: string
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'size'> {
  label?: ReactNode
  hint?: ReactNode
  error?: string | null
  options: SelectOption[]
  placeholder?: string
  containerClassName?: string
  size?: 'sm' | 'md'
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, options, placeholder, className, containerClassName, id, required, size = 'md', ...rest },
  ref,
) {
  const autoId = useId()
  const selectId = id ?? autoId
  const groups = Array.from(new Set(options.map((o) => o.group).filter(Boolean))) as string[]

  return (
    <Field label={label} htmlFor={selectId} hint={hint} error={error} required={required} className={containerClassName}>
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(selectId, { error, hint })}
          className={cn(
            controlClasses(Boolean(error)),
            'appearance-none pr-9',
            size === 'sm' ? 'h-8 pl-2.5 text-xs' : 'h-9.5 pl-3',
            className,
          )}
          {...rest}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {groups.length === 0
            ? options.map((option) => (
                <option key={option.value} value={option.value} disabled={option.disabled}>
                  {option.label}
                </option>
              ))
            : groups.map((group) => (
                <optgroup key={group} label={group}>
                  {options
                    .filter((o) => o.group === group)
                    .map((option) => (
                      <option key={option.value} value={option.value} disabled={option.disabled}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
              ))}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400"
        />
      </div>
    </Field>
  )
})
