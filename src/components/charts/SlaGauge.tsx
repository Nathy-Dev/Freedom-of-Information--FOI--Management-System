import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/format'

/** Statutory compliance dial. Green above 90%, amber to 75%, red below. */
export function SlaGauge({
  rate,
  label = 'Statutory compliance',
  caption,
  size = 132,
  className,
}: {
  rate: number
  label?: string
  caption?: string
  size?: number
  className?: string
}) {
  const clamped = Math.max(0, Math.min(100, rate))
  const stroke = clamped >= 90 ? '#008751' : clamped >= 75 ? '#EDAF1E' : '#CE1126'
  const radius = 54
  const circumference = 2 * Math.PI * radius
  // Three-quarter dial: 270 degrees of sweep, rotated to start bottom-left.
  const arc = circumference * 0.75
  const filled = (clamped / 100) * arc

  return (
    <div className={cn('flex flex-col items-center', className)}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg viewBox="0 0 132 132" className="h-full w-full -rotate-[135deg]">
          <circle
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke="#EEF2F0"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${arc} ${circumference}`}
          />
          <circle
            cx="66"
            cy="66"
            r={radius}
            fill="none"
            stroke={stroke}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference}`}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums text-ink-900">{formatPercent(clamped)}</span>
          <span className="text-2xs uppercase tracking-wide text-ink-500">on time</span>
        </div>
      </div>
      <p className="mt-1 text-center text-xs font-medium text-ink-700">{label}</p>
      {caption ? <p className="mt-0.5 text-center text-2xs text-ink-500">{caption}</p> : null}
    </div>
  )
}
