import type {
  AgingBucket,
  CaseStatus,
  DashboardMetrics,
  DepartmentRow,
  FoiCase,
  RequestorRow,
  StatusCount,
  TrendPoint,
  User,
  WorkloadRow,
} from '@/types'
import { OPEN_STATUSES, STATUS_ORDER } from '@/lib/constants'
import { agingBuckets, averageResponseDays, computeSla, slaComplianceRate } from '@/lib/sla'
import { average } from '@/lib/utils'
import { formatMonthYear } from '@/lib/format'

const OPEN = new Set<CaseStatus>(OPEN_STATUSES)

function isOpen(foiCase: FoiCase) {
  return OPEN.has(foiCase.status)
}

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

/** Twelve rolling months of received / responded / closed volume (FR-053). */
export function monthlyTrend(cases: FoiCase[], months = 12): TrendPoint[] {
  const keys: string[] = []
  const cursor = new Date()
  cursor.setDate(1)
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(cursor)
    d.setMonth(d.getMonth() - i)
    keys.push(d.toISOString().slice(0, 7))
  }

  const empty = () => ({ received: 0, responded: 0, closed: 0 })
  const buckets = new Map(keys.map((k) => [k, empty()]))

  cases.forEach((c) => {
    const received = buckets.get(monthKey(c.dateSubmitted))
    if (received) received.received += 1
    if (c.respondedAt) {
      const responded = buckets.get(monthKey(c.respondedAt))
      if (responded) responded.responded += 1
    }
    if (c.dateClosed) {
      const closed = buckets.get(monthKey(c.dateClosed))
      if (closed) closed.closed += 1
    }
  })

  return keys.map((key) => ({
    period: formatMonthYear(`${key}-01`),
    ...buckets.get(key)!,
  }))
}

export function statusBreakdown(cases: FoiCase[]): StatusCount[] {
  return STATUS_ORDER.map((status) => ({
    status,
    count: cases.filter((c) => c.status === status).length,
  }))
}

export function aging(cases: FoiCase[]): AgingBucket[] {
  return agingBuckets(cases.filter(isOpen))
}

export function byDepartment(cases: FoiCase[]): DepartmentRow[] {
  const names = Array.from(new Set(cases.map((c) => c.department)))
  return names
    .map((department) => {
      const rows = cases.filter((c) => c.department === department)
      return {
        department,
        count: rows.length,
        avgDays: averageResponseDays(rows),
        slaRate: slaComplianceRate(rows),
      }
    })
    .sort((a, b) => b.count - a.count)
}

export function topRequestors(cases: FoiCase[], limit = 8): RequestorRow[] {
  const map = new Map<string, RequestorRow>()
  cases.forEach((c) => {
    const row = map.get(c.requestorId) ?? {
      name: c.requestor.name,
      organization: c.requestor.organization ?? 'Individual requestor',
      count: 0,
      appeals: 0,
    }
    row.count += 1
    if (c.isAppeal || c.status === 'appeal') row.appeals += 1
    map.set(c.requestorId, row)
  })
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

export function workload(cases: FoiCase[], staff: User[]): WorkloadRow[] {
  const thisMonth = new Date().toISOString().slice(0, 7)
  return staff
    .map((user) => {
      const owned = cases.filter((c) => c.assignedTo === user.id)
      return {
        userId: user.id,
        open: owned.filter(isOpen).length,
        overdue: owned.filter((c) => computeSla(c).state === 'overdue').length,
        closedThisMonth: owned.filter((c) => c.dateClosed?.startsWith(thisMonth)).length,
      }
    })
    .filter((row) => row.open + row.closedThisMonth > 0)
    .sort((a, b) => b.open - a.open || b.overdue - a.overdue)
}

/**
 * One aggregation entry point for every dashboard. Each role's dashboard passes
 * the case set it is allowed to see, so the numbers always agree with the lists.
 */
export function dashboardMetrics(cases: FoiCase[], staff: User[]): DashboardMetrics {
  const open = cases.filter(isOpen)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const slaStates = open.map((c) => computeSla(c).state)

  return {
    totalCases: cases.length,
    openCases: open.length,
    overdueCases: slaStates.filter((s) => s === 'overdue').length,
    dueSoonCases: slaStates.filter((s) => s === 'due_soon').length,
    closedThisMonth: cases.filter((c) => c.dateClosed?.startsWith(thisMonth)).length,
    avgResponseDays: averageResponseDays(cases),
    slaComplianceRate: slaComplianceRate(cases),
    appealsCount: cases.filter((c) => c.status === 'appeal' || c.isAppeal).length,
    escalationsCount: cases.filter((c) => c.status === 'escalated').length,
    statusCounts: statusBreakdown(cases),
    trend: monthlyTrend(cases),
    aging: aging(cases),
    byDepartment: byDepartment(cases),
    topRequestors: topRequestors(cases),
    workload: workload(cases, staff),
  }
}

/** Average days to first response, used on the requestor-facing dashboard. */
export function averageAcknowledgementHours(cases: FoiCase[]) {
  return Math.round(
    average(
      cases
        .filter((c) => c.respondedAt)
        .map((c) => (new Date(c.respondedAt!).getTime() - new Date(c.dateSubmitted).getTime()) / 3_600_000),
    ),
  )
}
