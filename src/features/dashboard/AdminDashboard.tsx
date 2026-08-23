import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  FolderOpen,
  Inbox,
  UploadCloud,
  UserPlus,
  Users,
} from 'lucide-react'
import { ButtonLink, Card, CardBody, CardHeader, StatCard, Table, TableWrap, Tbody, Td, Th, Thead, Tr, UserChip } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { BarChartCard, StackedBarCard, TrendChart } from '@/components/charts'
import { dashboardMetrics } from '@/mocks/metrics'
import { selectCases } from '@/mocks/api'
import { db, reference, usersById } from '@/mocks/db'
import { computeSla } from '@/lib/sla'
import { formatDays, formatNumber, formatPercent, formatRelative } from '@/lib/format'
import { OPEN_STATUSES, ROLE_LABELS } from '@/lib/constants'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { CaseMiniList } from './components/CaseMiniList'

const WORKLOAD_SERIES = [
  { key: 'open', label: 'Open', color: '#008751' },
  { key: 'overdue', label: 'Overdue', color: '#CE1126' },
  { key: 'closedThisMonth', label: 'Concluded this month', color: '#0EA5E9' },
]

/** FR-002 / FR-013: the Admin's view — intake, assignment and account upkeep. */
export function AdminDashboard() {
  const { user } = useAuth()
  const { version, teamMemberIds } = useData()

  const view = useMemo(() => {
    if (!user) return null
    const cases = selectCases(user, undefined, teamMemberIds)
    const metrics = dashboardMetrics(cases, reference.assignableStaff)
    const open = cases.filter((row) => OPEN_STATUSES.includes(row.status))

    const workload = metrics.workload.map((row) => ({
      label: usersById.get(row.userId)?.name.replace(/^(Barr\.|Mrs\.|Mr\.|Dr\.) /, '') ?? row.userId,
      open: row.open,
      overdue: row.overdue,
      closedThisMonth: row.closedThisMonth,
    }))

    const departments = metrics.byDepartment.map((row) => ({
      label: row.department.replace(' Department', ''),
      value: row.count,
    }))

    return {
      metrics,
      unassigned: open
        .filter((row) => !row.assignedTo)
        .sort((a, b) => computeSla(a).daysRemaining - computeSla(b).daysRemaining),
      newest: cases.filter((row) => row.status === 'filed'),
      workload,
      departments,
      pendingInvites: reference.users.filter((entry) => entry.status === 'invited'),
      recentLogins: [...reference.users]
        .filter((entry) => entry.lastLoginAt)
        .sort((a, b) => (b.lastLoginAt ?? '').localeCompare(a.lastLoginAt ?? ''))
        .slice(0, 6),
      imports: db.cases.filter((row) => row.source === 'csv_import').length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, teamMemberIds, version])

  if (!view) return null
  const { metrics } = view

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administration overview"
        description="Intake, assignment and account administration for the FOI register."
        actions={
          <>
            <ButtonLink to="/admin/import" variant="outline" leadingIcon={<UploadCloud aria-hidden className="h-4 w-4" />}>
              Import requests
            </ButtonLink>
            <ButtonLink to="/admin/users" leadingIcon={<UserPlus aria-hidden className="h-4 w-4" />}>
              Manage users
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Awaiting assignment"
          value={view.unassigned.length}
          hint="Filed requests without an officer"
          icon={<Inbox aria-hidden className="h-4.5 w-4.5" />}
          tone={view.unassigned.length > 0 ? 'warning' : 'success'}
          to="/cases?assignee=unassigned"
        />
        <StatCard
          label="Open cases"
          value={metrics.openCases}
          hint={`${formatNumber(metrics.totalCases)} on the register`}
          icon={<FolderOpen aria-hidden className="h-4.5 w-4.5" />}
          tone="brand"
          to="/cases?tab=pending"
        />
        <StatCard
          label="Overdue"
          value={metrics.overdueCases}
          hint={`Compliance ${formatPercent(metrics.slaComplianceRate)}`}
          icon={<AlarmClock aria-hidden className="h-4.5 w-4.5" />}
          tone="danger"
          to="/cases?sla=overdue"
        />
        <StatCard
          label="Active officers"
          value={metrics.workload.length}
          hint={`Average response ${formatDays(metrics.avgResponseDays)}`}
          icon={<Users aria-hidden className="h-4.5 w-4.5" />}
          tone="info"
          to="/admin/users"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <CaseMiniList
          title="Assignment queue"
          description="Route these to an officer or team before the acknowledgement window closes."
          cases={view.unassigned}
          emptyMessage="Every open request has an officer assigned."
          viewAllTo="/cases?assignee=unassigned"
          showAssignee={false}
          limit={7}
        />
        <StackedBarCard
          data={view.workload}
          series={WORKLOAD_SERIES}
          title="Officer workload"
          description="Open, overdue and concluded volumes per Legal Unit officer."
          height={340}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <TrendChart data={metrics.trend} className="xl:col-span-2" height={300} />
        <BarChartCard
          data={view.departments}
          title="Requests by department"
          description="Where the records sit inside HYPREP."
          layout="vertical"
          yAxisWidth={150}
          height={300}
          showValues
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Recent sign-ins"
            description="Most recent authenticated sessions across all user classes."
            actions={
              <Link to="/audit/access" className="text-xs font-semibold text-brand-700 hover:underline">
                Access logs
              </Link>
            }
          />
          <CardBody className="p-0">
            <TableWrap className="max-h-80">
              <Table>
                <Thead>
                  <Tr>
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Last sign-in</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {view.recentLogins.map((entry) => (
                    <Tr key={entry.id}>
                      <Td>
                        <UserChip user={entry} secondary={entry.email} />
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-ink-600">{ROLE_LABELS[entry.roleId]}</Td>
                      <Td className="whitespace-nowrap text-xs text-ink-500">
                        {formatRelative(entry.lastLoginAt)}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Pending invitations"
            description="Accounts created but not yet activated by the holder."
            actions={
              <Link to="/admin/users" className="text-xs font-semibold text-brand-700 hover:underline">
                Manage
              </Link>
            }
          />
          <CardBody className="space-y-2">
            {view.pendingInvites.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">
                No invitations are outstanding.
              </p>
            ) : (
              view.pendingInvites.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-ink-200 px-3 py-2.5"
                >
                  <UserChip user={entry} secondary={`${ROLE_LABELS[entry.roleId]} · ${entry.email}`} />
                  <span className="shrink-0 text-xs text-ink-500">
                    Invited {formatRelative(entry.createdAt)}
                  </span>
                </div>
              ))
            )}
            <p className="pt-1 text-xs text-ink-500">
              {formatNumber(view.imports)} requests on the register arrived through CSV import.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
