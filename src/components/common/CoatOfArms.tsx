import { cn } from '@/lib/utils'

const SIZES = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-20 w-20',
} as const

export type CrestSize = keyof typeof SIZES

/**
 * The Coat of Arms of the Federal Republic of Nigeria, used as the system mark.
 * Served from /public so it is cached once and printed crisply on letters.
 */
export function CoatOfArms({ size = 'md', className }: { size?: CrestSize; className?: string }) {
  return (
    <img
      src="/coat-of-arms.svg"
      alt="Coat of arms of the Federal Republic of Nigeria"
      width={96}
      height={96}
      className={cn('shrink-0 select-none object-contain', SIZES[size], className)}
    />
  )
}

export interface BrandLockupProps {
  size?: CrestSize
  /** Hides the wordmark, e.g. in the collapsed sidebar. */
  compact?: boolean
  onDark?: boolean
  className?: string
  subtitle?: string
}

/** Crest + wordmark. The single place the product name is rendered. */
export function BrandLockup({ size = 'md', compact, onDark, className, subtitle }: BrandLockupProps) {
  return (
    <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
      <CoatOfArms size={size} />
      {compact ? null : (
        <span className="min-w-0 leading-tight">
          <span className={cn('block truncate text-sm font-bold tracking-tight', onDark ? 'text-white' : 'text-ink-900')}>
            HYPREP FOI
          </span>
          <span className={cn('block truncate text-2xs font-medium', onDark ? 'text-brand-100' : 'text-ink-500')}>
            {subtitle ?? 'Freedom of Information Management'}
          </span>
        </span>
      )}
    </span>
  )
}

/** Green / white / green rule taken from the national flag. */
export function FlagRule({ className }: { className?: string }) {
  return <div aria-hidden className={cn('flag-rule h-1 w-full', className)} />
}
