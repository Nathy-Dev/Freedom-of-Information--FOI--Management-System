import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isThisYear,
  isToday,
  isTomorrow,
  isValid,
  parseISO,
} from 'date-fns'

/**
 * Formatting helpers. All dates are rendered in the Africa/Lagos context
 * required by the Terms of Reference (section 25) - mock timestamps are generated
 * as local ISO strings, so no timezone conversion is applied on read.
 */

export const TIMEZONE_LABEL = 'Africa/Lagos (WAT)'

function safeParse(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = typeof value === 'string' ? parseISO(value) : value
  return isValid(date) ? date : null
}

export function formatDate(value: string | Date | null | undefined, fallback = '—') {
  const date = safeParse(value)
  return date ? format(date, 'd MMM yyyy') : fallback
}

export function formatDateLong(value: string | Date | null | undefined, fallback = '—') {
  const date = safeParse(value)
  return date ? format(date, 'EEEE, d MMMM yyyy') : fallback
}

export function formatDateTime(value: string | Date | null | undefined, fallback = '—') {
  const date = safeParse(value)
  return date ? format(date, 'd MMM yyyy, HH:mm') : fallback
}

export function formatTime(value: string | Date | null | undefined, fallback = '—') {
  const date = safeParse(value)
  return date ? format(date, 'HH:mm') : fallback
}

/** "12:30" (24h clock string) rendered as "12:30". Kept as its own helper for court times. */
export function formatClock(value: string | null | undefined, fallback = '—') {
  if (!value) return fallback
  return value
}

export function formatMonthYear(value: string | Date | null | undefined, fallback = '—') {
  const date = safeParse(value)
  return date ? format(date, 'MMM yyyy') : fallback
}

export function formatRelative(value: string | Date | null | undefined, fallback = '—') {
  const date = safeParse(value)
  if (!date) return fallback
  if (isToday(date)) return 'Today'
  if (isTomorrow(date)) return 'Tomorrow'
  return `${formatDistanceToNowStrict(date)} ${date.getTime() > Date.now() ? 'from now' : 'ago'}`
}

export function formatSmartDate(value: string | Date | null | undefined, fallback = '—') {
  const date = safeParse(value)
  if (!date) return fallback
  if (isToday(date)) return `Today, ${format(date, 'HH:mm')}`
  if (isTomorrow(date)) return `Tomorrow, ${format(date, 'HH:mm')}`
  return isThisYear(date) ? format(date, 'd MMM, HH:mm') : format(date, 'd MMM yyyy')
}

export function daysBetween(from: string | Date, to: string | Date) {
  const a = safeParse(from)
  const b = safeParse(to)
  if (!a || !b) return 0
  return differenceInCalendarDays(b, a)
}

export function formatBytes(bytes: number) {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** exponent
  return `${value >= 10 || exponent === 0 ? Math.round(value) : value.toFixed(1)} ${units[exponent]}`
}

export function formatNumber(value: number, options?: Intl.NumberFormatOptions) {
  return new Intl.NumberFormat('en-NG', options).format(value)
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`
}

export function formatDays(value: number) {
  const rounded = Math.round(value * 10) / 10
  return `${rounded} ${rounded === 1 ? 'day' : 'days'}`
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

export function titleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim()
}

export function truncate(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`
}

export function fileExtension(fileName: string) {
  const parts = fileName.split('.')
  return parts.length > 1 ? parts.pop()!.toLowerCase() : ''
}

export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const visible = local.slice(0, 2)
  return `${visible}${'•'.repeat(Math.max(local.length - 2, 3))}@${domain}`
}
