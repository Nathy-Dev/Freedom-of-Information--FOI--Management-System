import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  CalendarDays,
  FileClock,
  FolderOpen,
  Gavel,
  Plus,
  Scale,
  TimerReset,
  TrendingUp,
} from 'lucide-react'
import { ButtonLink, Card, CardBody, CardHeader, StatCard } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { SlaGauge, StatusDonut, TrendChart } from '@/components/charts'
import { dashboardMetrics } from '@/mocks/metrics'
import { selectCases } from '@/mocks/api'
import { db, reference } from '@/mocks/db'
import { computeSla } from '@/lib/sla'
import { formatDays, formatNumber, formatPercent } from '@/lib/format'
import { OPEN_STATUSES, STATUTORY_RESPONSE_DAYS } from '@/lib/constants'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { CaseMiniList } from './components/CaseMiniList'
import { TaskListCard } from './components/TaskListCard'
import { UpcomingHearings } from './components/UpcomingHearings'
import { CaseTimeline } from '../cases/components/CaseTimeline'

/** FR-030: the Legal Unit's operating picture — workload, deadlines, hearings. */
export function LegalDashboard() {
  const { user, role } = useAuth()
  const { version, teamMemberIds } = useData()

  const view = useMemo(() => {
    if (!user) return null

    const cases = selectCases(user, undefined, teamMemberIds)
    const metrics = dashboardMetrics(cases, reference.assignableStaff)
    const ids = new Set(cases.map((row) => row.id))

    const open = cases.filter((row) => OPEN_STATUSES.includes(row.status))
    const withSla = open.map((row) => ({ row, sla: computeSla(row) }))

    const overdue = withSla
      .filter((entry) => entry.sla.state === 'overdue')
      .sort((a, b) => a.sla.daysRemaining - b.sla.daysRemaining)
      .map((entry) => entry.row)

    const dueSoon = withSla
      .filter((entry) => entry.sla.state === 'due_soon')
      .sort((a, b) => a.sla.daysRemaining - b.sla.daysRemaining)
      .map((entry) => entry.row)

    const mine = open
      .filter((row) => row.assignedTo === user.id)
      .sort((a, b) => computeSla(a).daysRemaining - computeSla(b).daysRemaining)

    const unassigned = open.filter((row) => !row.assignedTo)

    const today = new Date().toISOString().slice(0, 10)
    const hearings = db.courtDates
      .filter((sitting) => sitting.date >= today && sitting.status === 'scheduled' && ids.has(sitting.caseId))
      .sort((a, b) => a.date.localeCompare(b.date))

    const tasks = db.tasks
      .filter((task) => task.assigneeId === user.id && task.status !== 'done')
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

    const activity = db.timeline.filter((event) => ids.has(event.caseId)).slice(0, 8)

    return { cases, metrics, overdue, dueSoon, mine, unassigned, hearings, tasks, activity }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, teamMemberIds, version])

  if (!view || !user) return null
  const { metrics } = view

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good day, ${user.name.split(' ')[1] ?? user.name}`}
        description={`${role.name} · ${user.department ?? 'Legal Unit'} · statutory response window is ${STATUTORY_RESPONSE_DAYS} working days.`}
        actions={
          <>
            <ButtonLink to="/court" variant="outline" leadingIcon={<Gavel aria-hidden className="h-4 w-4" />}>
              Court calendar
            </ButtonLink>
            <ButtonLink to="/cases/new" leadingIcon={<Plus aria-hidden className="h-4 w-4" />}>
              New case
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open cases"
          value={metrics.openCases}
          hint={`${formatNumber(metrics.totalCases)} on file in total`}
          icon={<FolderOpen aria-hidden className="h-4.5 w-4.5" />}
          tone="brand"
          to="/cases?tab=pending"
        />
        <StatCard
          label="Overdue"
          value={metrics.overdueCases}
          hint="Past the statutory response date"
          icon={<AlarmClock aria-hidden className="h-4.5 w-4.5" />}
          tone="danger"
          to="/cases?sla=overdue"
        />
        <StatCard
          label="Due within 2 days"
          value={metrics.dueSoonCases}
          hint="Approaching the deadline"
          icon={<TimerReset aria-hidden className="h-4.5 w-4.5" />}
          tone="warning"
          to="/cases?sla=due_soon"
        />
        <StatCard
          label="Concluded this month"
          value={metrics.closedThisMonth}
          hint={`Average response ${formatDays(metrics.avgResponseDays)}`}
          icon={<FileClock aria-hidden className="h-4.5 w-4.5" />}
          tone="success"
          to="/cases?tab=concluded"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <TrendChart data={metrics.trend} className="xl:col-span-2" />
        <Card>
          <CardHeader
            title="Statutory compliance"
            description="Share of concluded requests answered inside the window."
          />
          <CardBody className="flex flex-col items-center gap-4">
            <SlaGauge
              rate={metrics.slaComplianceRate}
              caption={`${formatPercent(metrics.slaComplianceRate)} answered on time`}
            />
            <dl className="grid w-full grid-cols-2 gap-3 text-center">
              <div className="rounded-xl bg-ink-50 px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Appeals</dt>
                <dd className="mt-0.5 text-lg font-semibold text-ink-900">{metrics.appealsCount}</dd>
              </div>
              <div className="rounded-xl bg-ink-50 px-3 py-2.5">
                <dt className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Escalated</dt>
                <dd className="mt-0.5 text-lg font-semibold text-ink-900">{metrics.escalationsCount}</dd>
              </div>
            </dl>
            <Link
              to="/reports"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 hover:underline"
            >
              <TrendingUp aria-hidden className="h-3.5 w-3.5" />
              Open performance reports
            </Link>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <CaseMiniList
          title="Overdue — act today"
          description="Past the section 4 deadline. Every day here is a compliance exposure."
          cases={view.overdue}
          emptyMessage="No case in your view has passed its statutory response date."
          viewAllTo="/cases?sla=overdue"
        />
        <CaseMiniList
          title="Closing within two days"
          description="Answer or issue a section 6 extension notice before the clock runs out."
          cases={view.dueSoon}
          emptyMessage="Nothing is inside the two-day warning window."
          viewAllTo="/cases?sla=due_soon"
        />
        <CaseMiniList
          title="Assigned to me"
          description="Your caseload, earliest deadline first."
          cases={view.mine}
          emptyMessage="You have no open cases assigned."
          viewAllTo="/cases?assignee=me"
          showAssignee={false}
        />
        <CaseMiniList
          title="Awaiting assignment"
          description="Newly filed requests that still need an officer."
          cases={view.unassigned}
          emptyMessage="Every open request has an officer."
          viewAllTo="/cases?assignee=unassigned"
          showAssignee={false}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <TaskListCard tasks={view.tasks} />
        <UpcomingHearings hearings={view.hearings} />
        <StatusDonut data={metrics.statusCounts} />
      </div>

      <Card>
        <CardHeader
          title="Recent activity"
          description="The latest events across the case files you can see."
          icon={<Scale aria-hidden className="h-4.5 w-4.5 text-brand-600" />}
          actions={
            <Link to="/audit" className="text-xs font-semibold text-brand-700 hover:underline">
              Full audit trail
            </Link>
          }
        />
        <CardBody>
          <CaseTimeline events={view.activity} showCase />
        </CardBody>
      </Card>

      <p className="flex items-center gap-1.5 text-xs text-ink-400">
        <CalendarDays aria-hidden className="h-3.5 w-3.5" />
        Deadlines are calculated in Africa/Lagos time against the Freedom of Information Act 2011.
      </p>
    </div>
  )
}
