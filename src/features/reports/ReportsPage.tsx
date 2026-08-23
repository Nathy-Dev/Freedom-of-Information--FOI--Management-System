import { useMemo, useState } from 'react'
import {
  BarChart3,
  CalendarRange,
  Download,
  FileSpreadsheet,
  Gauge,
  Timer,
  TrendingUp,
} from 'lucide-react'
import type { CaseStatus, FoiCase } from '@/types'
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  Select,
  StatCard,
  StatusBadge,
  Table,
  TableWrap,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from '@/components/ui'
import type { SelectOption, TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { BarChartCard, SlaGauge, StackedBarCard, StatusDonut, TrendChart } from '@/components/charts'
import { selectCases } from '@/mocks/api'
import { reference, userName } from '@/mocks/db'
import {
  aging,
  byDepartment,
  dashboardMetrics,
  monthlyTrend,
  statusBreakdown,
  topRequestors,
  workload,
} from '@/mocks/metrics'
import { PRIORITY_META, STATUS_META } from '@/lib/constants'
import { formatDays, formatNumber, formatPercent } from '@/lib/format'
import { downloadTextFile, toCsv } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'

type ReportTab = 'overview' | 'compliance' | 'workload' | 'requestors'

const RANGE_OPTIONS: SelectOption[] = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last quarter' },
  { value: '180', label: 'Last six months' },
  { value: '365', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

const TABS: Array<TabItem<ReportTab>> = [
  { key: 'overview', label: 'Overview', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'compliance', label: 'Statutory compliance', icon: <Gauge className="h-4 w-4" /> },
  { key: 'workload', label: 'Workload', icon: <Timer className="h-4 w-4" /> },
  { key: 'requestors', label: 'Requestors', icon: <TrendingUp className="h-4 w-4" /> },
]

/** FR-050 to FR-053: the predefined report set every FOI annual return needs. */
export function ReportsPage() {
  const { user, can } = useAuth()
  const { version } = useData()

  const [tab, setTab] = useState<ReportTab>('overview')
  const [range, setRange] = useState('365')

  const cases = useMemo<FoiCase[]>(() => {
    if (!user) return []
    const rows = selectCases(user)
    if (range === 'all') return rows
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - Number(range))
    return rows.filter((row) => new Date(row.dateSubmitted) >= cutoff)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, range, version])

  const metrics = useMemo(() => dashboardMetrics(cases, reference.assignableStaff), [cases])
  const trend = useMemo(() => monthlyTrend(cases, range === '30' ? 3 : range === '90' ? 6 : 12), [cases, range])
  const statuses = useMemo(() => statusBreakdown(cases), [cases])
  const departments = useMemo(() => byDepartment(cases), [cases])
  const buckets = useMemo(() => aging(cases), [cases])
  const requestors = useMemo(() => topRequestors(cases, 10), [cases])
  const officers = useMemo(() => workload(cases, reference.assignableStaff), [cases])

  const priorities = useMemo(() => {
    const order: Array<FoiCase['priority']> = ['critical', 'high', 'medium', 'low']
    return order.map((key) => ({
      label: PRIORITY_META[key].label,
      value: cases.filter((row) => row.priority === key).length,
      color: PRIORITY_META[key].hex,
    }))
  }, [cases])

  const rangeLabel = RANGE_OPTIONS.find((option) => option.value === range)?.label ?? 'All time'

  const exportCurrent = () => {
    const stamp = new Date().toISOString().slice(0, 10)
    if (tab === 'compliance') {
      downloadTextFile(
        `hyprep-foi-compliance-${stamp}.csv`,
        toCsv(
          ['Department', 'Requests', 'Average response (days)', 'SLA compliance (%)'],
          departments.map((row) => [row.department, row.count, row.avgDays, Math.round(row.slaRate * 100)]),
        ),
        'text/csv',
      )
      return
    }
    if (tab === 'workload') {
      downloadTextFile(
        `hyprep-foi-workload-${stamp}.csv`,
        toCsv(
          ['Officer', 'Open cases', 'Overdue', 'Closed this month'],
          officers.map((row) => [userName(row.userId), row.open, row.overdue, row.closedThisMonth]),
        ),
        'text/csv',
      )
      return
    }
    if (tab === 'requestors') {
      downloadTextFile(
        `hyprep-foi-requestors-${stamp}.csv`,
        toCsv(
          ['Requestor', 'Organisation', 'Requests', 'Appeals'],
          requestors.map((row) => [row.name, row.organization, row.count, row.appeals]),
        ),
        'text/csv',
      )
      return
    }
    downloadTextFile(
      `hyprep-foi-volume-${stamp}.csv`,
      toCsv(
        ['Period', 'Received', 'Responded', 'Closed'],
        trend.map((row) => [row.period, row.received, row.responded, row.closed]),
      ),
      'text/csv',
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Predefined management reports for the Legal Unit and the FOI annual return to the Attorney-General of the Federation."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Reports' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              label=""
              size="sm"
              options={RANGE_OPTIONS}
              value={range}
              onChange={(event) => setRange(event.target.value)}
              containerClassName="w-44"
            />
            <Button variant="secondary" leadingIcon={<Download className="h-4 w-4" />} onClick={exportCurrent}>
              Export CSV
            </Button>
            {can('report:build') ? (
              <ButtonLink to="/reports/builder" leadingIcon={<FileSpreadsheet className="h-4 w-4" />}>
                Custom report
              </ButtonLink>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Requests in period"
          value={metrics.totalCases}
          hint={rangeLabel}
          icon={<CalendarRange className="h-5 w-5" />}
        />
        <StatCard
          label="SLA compliance"
          value={formatPercent(metrics.slaComplianceRate)}
          hint="Answered within the statutory window"
          tone={metrics.slaComplianceRate >= 0.8 ? 'success' : 'warning'}
          icon={<Gauge className="h-5 w-5" />}
        />
        <StatCard
          label="Average response"
          value={formatDays(metrics.avgResponseDays)}
          hint={`Statutory limit is 7 days`}
          tone={metrics.avgResponseDays <= 7 ? 'success' : 'warning'}
          icon={<Timer className="h-5 w-5" />}
        />
        <StatCard
          label="Appeals & escalations"
          value={metrics.appealsCount + metrics.escalationsCount}
          hint={`${metrics.appealsCount} appealed · ${metrics.escalationsCount} escalated`}
          tone={metrics.appealsCount + metrics.escalationsCount > 0 ? 'danger' : 'neutral'}
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Report sections" />

      {tab === 'overview' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <TrendChart
                data={trend}
                title="Request volume"
                description="Received against responded and closed, by month."
                height={280}
              />
            </div>
            <StatusDonut data={statuses} title="Status mix" description="Every request in the selected period." />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <BarChartCard
              data={buckets.map((row) => ({ label: row.bucket, value: row.count }))}
              title="Age of open requests"
              description="Days elapsed since the request was filed."
              valueLabel="Open requests"
              showValues
            />
            <BarChartCard
              data={priorities}
              title="Priority profile"
              description="Triage priority assigned at intake or on review."
              layout="vertical"
              valueLabel="Requests"
              yAxisWidth={80}
              showValues
            />
          </div>

          <Card>
            <CardHeader
              title="Status register"
              description="The count behind every card, for reconciliation against the case list."
            />
            <CardBody className="p-0">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Status</Th>
                      <Th className="text-right">Requests</Th>
                      <Th className="text-right">Share</Th>
                      <Th>Meaning</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {statuses.map((row) => {
                      const meta = STATUS_META[row.status as CaseStatus]
                      return (
                        <Tr key={row.status}>
                          <Td>
                            <StatusBadge status={row.status as CaseStatus} />
                          </Td>
                          <Td className="text-right font-medium text-ink-900">
                            {formatNumber(row.count)}
                          </Td>
                          <Td className="text-right text-ink-500">
                            {metrics.totalCases ? formatPercent(row.count / metrics.totalCases, 1) : '—'}
                          </Td>
                          <Td className="max-w-md text-xs text-ink-500">{meta.description ?? '—'}</Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'compliance' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="flex items-center justify-center py-2">
              <SlaGauge
                rate={metrics.slaComplianceRate}
                label="Statutory compliance"
                caption={`${metrics.overdueCases} open request${metrics.overdueCases === 1 ? '' : 's'} past the deadline`}
              />
            </Card>
            <div className="lg:col-span-2">
              <BarChartCard
                data={departments.map((row) => ({
                  label: row.department,
                  value: Math.round(row.slaRate * 100),
                  color: row.slaRate >= 0.8 ? '#15803d' : row.slaRate >= 0.6 ? '#b45309' : '#b91c1c',
                }))}
                title="Compliance by department"
                description="Share of requests answered inside the statutory window."
                layout="vertical"
                valueLabel="Compliance %"
                yAxisWidth={190}
                height={300}
                showValues
              />
            </div>
          </div>

          <Card>
            <CardHeader
              title="Departmental performance"
              description="Section 29 of the Act requires each institution to report volume and timeliness annually."
              icon={<Gauge className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Department</Th>
                      <Th className="text-right">Requests</Th>
                      <Th className="text-right">Avg response</Th>
                      <Th className="text-right">SLA compliance</Th>
                      <Th>Assessment</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {departments.map((row) => (
                      <Tr key={row.department}>
                        <Td className="font-medium text-ink-900">{row.department}</Td>
                        <Td className="text-right">{formatNumber(row.count)}</Td>
                        <Td className="text-right">{formatDays(row.avgDays)}</Td>
                        <Td className="text-right font-medium">{formatPercent(row.slaRate)}</Td>
                        <Td>
                          <span
                            className={
                              row.slaRate >= 0.8
                                ? 'text-xs font-medium text-brand-700'
                                : row.slaRate >= 0.6
                                  ? 'text-xs font-medium text-gold-700'
                                  : 'text-xs font-medium text-crest-700'
                            }
                          >
                            {row.slaRate >= 0.8 ? 'Compliant' : row.slaRate >= 0.6 ? 'Needs attention' : 'Escalate'}
                          </span>
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'workload' ? (
        <div className="space-y-4">
          <StackedBarCard
            data={officers.map((row) => ({
              label: userName(row.userId),
              open: row.open,
              overdue: row.overdue,
              closed: row.closedThisMonth,
            }))}
            series={[
              { key: 'open', label: 'Open', color: '#15803d' },
              { key: 'overdue', label: 'Overdue', color: '#b91c1c' },
              { key: 'closed', label: 'Closed this month', color: '#94a3b8' },
            ]}
            title="Officer workload"
            description="Live caseload per Legal Unit officer, with this month's throughput."
            height={300}
          />

          <Card>
            <CardHeader
              title="Caseload register"
              description="Use this to rebalance assignments before the next statutory deadline."
              icon={<Timer className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Officer</Th>
                      <Th className="text-right">Open</Th>
                      <Th className="text-right">Overdue</Th>
                      <Th className="text-right">Closed this month</Th>
                      <Th>Load</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {officers.map((row) => {
                      const heaviest = Math.max(1, ...officers.map((entry) => entry.open))
                      return (
                        <Tr key={row.userId}>
                          <Td className="font-medium text-ink-900">{userName(row.userId)}</Td>
                          <Td className="text-right">{formatNumber(row.open)}</Td>
                          <Td className={row.overdue ? 'text-right font-semibold text-crest-700' : 'text-right'}>
                            {formatNumber(row.overdue)}
                          </Td>
                          <Td className="text-right">{formatNumber(row.closedThisMonth)}</Td>
                          <Td>
                            <div className="h-1.5 w-32 overflow-hidden rounded-full bg-ink-100">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${Math.round((row.open / heaviest) * 100)}%` }}
                              />
                            </div>
                          </Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'requestors' ? (
        <div className="space-y-4">
          <BarChartCard
            data={requestors.map((row) => ({ label: row.name, value: row.count }))}
            title="Most frequent requestors"
            description="Volume by applicant across the selected period."
            layout="vertical"
            valueLabel="Requests"
            yAxisWidth={190}
            height={320}
            showValues
          />

          <Card>
            <CardHeader
              title="Requestor register"
              description="Repeat applicants and appeal rates help anticipate litigation exposure."
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <CardBody className="p-0">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Requestor</Th>
                      <Th>Organisation</Th>
                      <Th className="text-right">Requests</Th>
                      <Th className="text-right">Appeals</Th>
                      <Th className="text-right">Appeal rate</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {requestors.map((row) => (
                      <Tr key={`${row.name}-${row.organization}`}>
                        <Td className="font-medium text-ink-900">{row.name}</Td>
                        <Td className="text-ink-600">{row.organization}</Td>
                        <Td className="text-right">{formatNumber(row.count)}</Td>
                        <Td className={row.appeals ? 'text-right font-semibold text-crest-700' : 'text-right'}>
                          {formatNumber(row.appeals)}
                        </Td>
                        <Td className="text-right text-ink-500">
                          {row.count ? formatPercent(row.appeals / row.count, 1) : '—'}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      ) : null}

      <p className="pb-2 text-xs text-ink-400">
        Figures cover {rangeLabel.toLowerCase()} and reflect only the requests your role is permitted to see. Timestamps
        are rendered in Africa/Lagos (WAT).
      </p>
    </div>
  )
}
