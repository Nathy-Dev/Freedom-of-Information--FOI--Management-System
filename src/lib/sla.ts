import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { CaseSla, CaseStatus, FoiCase, SlaState } from '@/types'
import { CONCLUDED_STATUSES } from './constants'
import { clamp } from './utils'

/**
 * Statutory deadline tracking (FR-017).
 *
 * The Nigerian Freedom of Information Act 2011 (section 4) gives a public
 * institution 7 days to respond to a request, extendable by a further 7 days.
 * `statutoryDueDate` on the case is authoritative; this module derives the
 * warning / breach state and the progress figures the UI renders.
 */

const RESOLVED_STATUSES: CaseStatus[] = ['responded', ...CONCLUDED_STATUSES]

export function computeSla(foiCase: FoiCase, warningThresholdDays = 2, now = new Date()): CaseSla {
  const due = parseISO(foiCase.statutoryDueDate)
  const submitted = parseISO(foiCase.dateSubmitted)
  const totalDays = Math.max(differenceInCalendarDays(due, submitted), 1)

  const isResolved = RESOLVED_STATUSES.includes(foiCase.status)
  const resolvedAt = foiCase.respondedAt
    ? parseISO(foiCase.respondedAt)
    : foiCase.dateClosed
      ? parseISO(foiCase.dateClosed)
      : null

  if (isResolved && resolvedAt) {
    const overrun = differenceInCalendarDays(resolvedAt, due)
    const elapsed = Math.max(differenceInCalendarDays(resolvedAt, submitted), 0)
    const met = overrun <= 0
    return {
      state: met ? 'met' : 'breached',
      daysRemaining: -overrun,
      daysElapsed: elapsed,
      totalDays,
      percentElapsed: clamp(Math.round((elapsed / totalDays) * 100), 0, 100),
      label: met
        ? `Answered ${Math.abs(overrun)} ${Math.abs(overrun) === 1 ? 'day' : 'days'} inside the deadline`
        : `Answered ${overrun} ${overrun === 1 ? 'day' : 'days'} late`,
    }
  }

  const daysRemaining = differenceInCalendarDays(due, now)
  const daysElapsed = Math.max(differenceInCalendarDays(now, submitted), 0)
  const percentElapsed = clamp(Math.round((daysElapsed / totalDays) * 100), 0, 100)

  let state: SlaState
  let label: string
  if (daysRemaining < 0) {
    state = 'overdue'
    const late = Math.abs(daysRemaining)
    label = `Overdue by ${late} ${late === 1 ? 'day' : 'days'}`
  } else if (daysRemaining === 0) {
    state = 'due_soon'
    label = 'Due today'
  } else if (daysRemaining <= warningThresholdDays) {
    state = 'due_soon'
    label = `Due in ${daysRemaining} ${daysRemaining === 1 ? 'day' : 'days'}`
  } else {
    state = 'on_track'
    label = `${daysRemaining} days remaining`
  }

  return { state, daysRemaining, daysElapsed, totalDays, percentElapsed, label }
}

export function isOverdue(foiCase: FoiCase, now = new Date()) {
  return computeSla(foiCase, 2, now).state === 'overdue'
}

export function isDueSoon(foiCase: FoiCase, threshold = 2, now = new Date()) {
  return computeSla(foiCase, threshold, now).state === 'due_soon'
}

/**
 * Compliance rate across a set of cases: of the cases that reached a
 * determination, the share answered on or before the statutory due date.
 */
export function slaComplianceRate(cases: FoiCase[], now = new Date()) {
  const determined = cases
    .map((c) => computeSla(c, 2, now))
    .filter((sla) => sla.state === 'met' || sla.state === 'breached')
  if (!determined.length) return 100
  const met = determined.filter((sla) => sla.state === 'met').length
  return Math.round((met / determined.length) * 1000) / 10
}

/** Average calendar days from submission to first response, for resolved cases. */
export function averageResponseDays(cases: FoiCase[]) {
  const resolved = cases.filter((c) => c.respondedAt || c.dateClosed)
  if (!resolved.length) return 0
  const total = resolved.reduce((acc, c) => {
    const end = parseISO((c.respondedAt ?? c.dateClosed)!)
    return acc + Math.max(differenceInCalendarDays(end, parseISO(c.dateSubmitted)), 0)
  }, 0)
  return Math.round((total / resolved.length) * 10) / 10
}

/** Case-aging buckets for the dashboard chart (open cases only). */
export function agingBuckets(cases: FoiCase[], now = new Date()) {
  const buckets = [
    { bucket: '0-3 days', min: 0, max: 3, count: 0 },
    { bucket: '4-7 days', min: 4, max: 7, count: 0 },
    { bucket: '8-14 days', min: 8, max: 14, count: 0 },
    { bucket: '15-30 days', min: 15, max: 30, count: 0 },
    { bucket: '30+ days', min: 31, max: Number.POSITIVE_INFINITY, count: 0 },
  ]
  cases
    .filter((c) => !CONCLUDED_STATUSES.includes(c.status))
    .forEach((c) => {
      const age = Math.max(differenceInCalendarDays(now, parseISO(c.dateSubmitted)), 0)
      const bucket = buckets.find((b) => age >= b.min && age <= b.max)
      if (bucket) bucket.count += 1
    })
  return buckets.map(({ bucket, count }) => ({ bucket, count }))
}
