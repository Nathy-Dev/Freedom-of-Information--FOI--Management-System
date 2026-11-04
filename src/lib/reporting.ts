import type { AgingBucket, CaseStatus, DepartmentRow, FoiCase, RequestorRow, StatusCount, TrendPoint, User, WorkloadRow } from '@/types'
import { OPEN_STATUSES, STATUS_ORDER } from '@/lib/constants'
import { agingBuckets, averageResponseDays, computeSla, slaComplianceRate } from '@/lib/sla'
import { average } from '@/lib/utils'
import { formatMonthYear } from '@/lib/format'

const OPEN = new Set<CaseStatus>(OPEN_STATUSES)
const isOpen = (foiCase: FoiCase) => OPEN.has(foiCase.status)

export function monthlyTrend(cases: FoiCase[], months = 12): TrendPoint[] {
  const keys: string[] = []
  const cursor = new Date()
  cursor.setDate(1)
  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(cursor)
    date.setMonth(date.getMonth() - i)
    keys.push(date.toISOString().slice(0, 7))
  }
  const buckets = new Map(keys.map((key) => [key, { received: 0, responded: 0, closed: 0 }]))
  cases.forEach((row) => {
    const received = buckets.get(row.dateSubmitted.slice(0, 7))
    if (received) received.received += 1
    if (row.respondedAt && buckets.has(row.respondedAt.slice(0, 7))) buckets.get(row.respondedAt.slice(0, 7))!.responded += 1
    if (row.dateClosed && buckets.has(row.dateClosed.slice(0, 7))) buckets.get(row.dateClosed.slice(0, 7))!.closed += 1
  })
  return keys.map((key) => ({ period: formatMonthYear(`${key}-01`), ...buckets.get(key)! }))
}

export function statusBreakdown(cases: FoiCase[]): StatusCount[] {
  return STATUS_ORDER.map((status) => ({ status, count: cases.filter((row) => row.status === status).length }))
}

export function aging(cases: FoiCase[]): AgingBucket[] { return agingBuckets(cases.filter(isOpen)) }

export function byDepartment(cases: FoiCase[]): DepartmentRow[] {
  return Array.from(new Set(cases.map((row) => row.department))).map((department) => {
    const rows = cases.filter((row) => row.department === department)
    return { department, count: rows.length, avgDays: averageResponseDays(rows), slaRate: slaComplianceRate(rows) }
  }).sort((a, b) => b.count - a.count)
}

export function topRequestors(cases: FoiCase[], limit = 8): RequestorRow[] {
  const grouped = new Map<string, RequestorRow>()
  cases.forEach((row) => {
    const entry = grouped.get(row.requestorId) ?? { name: row.requestor.name, organization: row.requestor.organization ?? 'Individual requestor', count: 0, appeals: 0 }
    entry.count += 1
    if (row.isAppeal || row.status === 'appeal') entry.appeals += 1
    grouped.set(row.requestorId, entry)
  })
  return [...grouped.values()].sort((a, b) => b.count - a.count).slice(0, limit)
}

export function workload(cases: FoiCase[], staff: User[]): WorkloadRow[] {
  const month = new Date().toISOString().slice(0, 7)
  return staff.map((user) => {
    const owned = cases.filter((row) => row.assignedTo === user.id)
    return { userId: user.id, open: owned.filter(isOpen).length, overdue: owned.filter((row) => computeSla(row).state === 'overdue').length, closedThisMonth: owned.filter((row) => row.dateClosed?.startsWith(month)).length }
  }).filter((row) => row.open + row.closedThisMonth > 0).sort((a, b) => b.open - a.open || b.overdue - a.overdue)
}

export function dashboardMetrics(cases: FoiCase[], staff: User[]) {
  const open = cases.filter(isOpen)
  const month = new Date().toISOString().slice(0, 7)
  const slaStates = open.map((row) => computeSla(row).state)
  return {
    totalCases: cases.length, openCases: open.length, overdueCases: slaStates.filter((state) => state === 'overdue').length,
    dueSoonCases: slaStates.filter((state) => state === 'due_soon').length, closedThisMonth: cases.filter((row) => row.dateClosed?.startsWith(month)).length,
    avgResponseDays: averageResponseDays(cases), slaComplianceRate: slaComplianceRate(cases), appealsCount: cases.filter((row) => row.status === 'appeal' || row.isAppeal).length,
    escalationsCount: cases.filter((row) => row.status === 'escalated').length, statusCounts: statusBreakdown(cases), trend: monthlyTrend(cases), aging: aging(cases), byDepartment: byDepartment(cases), topRequestors: topRequestors(cases), workload: workload(cases, staff),
  }
}

export function averageAcknowledgementHours(cases: FoiCase[]) {
  return Math.round(average(cases.filter((row) => row.respondedAt).map((row) => (new Date(row.respondedAt!).getTime() - new Date(row.dateSubmitted).getTime()) / 3_600_000)))
}
