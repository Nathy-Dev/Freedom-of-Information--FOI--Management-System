import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  label?: string
  onSubmit?: () => void
  autoFocus?: boolean
  size?: 'sm' | 'md'
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search…',
  className,
  label = 'Search',
  onSubmit,
  autoFocus,
  size = 'md',
}: SearchInputProps) {
  return (
    <div className={cn('relative', className)}>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        type="search"
        aria-label={label}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') onSubmit?.()
        }}
        className={cn(
          'w-full rounded-lg border border-ink-300 bg-white pl-9 pr-9 text-sm text-ink-900 shadow-sm transition-colors',
          'placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40',
          '[&::-webkit-search-cancel-button]:appearance-none',
          size === 'sm' ? 'h-8 text-xs' : 'h-9.5',
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
        >
          <X aria-hidden className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  )
}
