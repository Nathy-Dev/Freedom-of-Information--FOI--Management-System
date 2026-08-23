import { useMemo, useState } from 'react'
import { CalendarClock, Play, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import type {
  CasePriority,
  CaseStatus,
  FoiCase,
  ReportFilters,
  ReportFormat,
  ReportGroupBy,
  ReportMetric,
  ReportPeriod,
  SavedReport,
  ScheduleCadence,
} from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChoiceChip,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Textarea,
} from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { BarChartCard } from '@/components/charts'
import { selectCases } from '@/mocks/api'
import { deleteReport, saveReport } from '@/mocks/adminApi'
import { db, reference, userName } from '@/mocks/db'
import { PRIORITY_META, STATUS_META, STATUS_ORDER } from '@/lib/constants'
import { computeSla, slaComplianceRate } from '@/lib/sla'
import { formatDate, formatDays, formatMonthYear, formatNumber, formatPercent } from '@/lib/format'
import { downloadTextFile, toCsv, toggleIn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

const PERIOD_OPTIONS: SelectOption[] = [
  { value: 'weekly', label: 'Last 7 days' },
  { value: 'monthly', label: 'Last 30 days' },
  { value: 'quarterly', label: 'Last quarter' },
  { value: 'yearly', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom date range' },
]

const PERIOD_DAYS: Record<ReportPeriod, number | null> = {
  weekly: 7,
  monthly: 30,
  quarterly: 92,
  yearly: 365,
  custom: null,
}

const GROUP_OPTIONS: Array<{ value: ReportGroupBy; label: string }> = [
  { value: 'status', label: 'Status' },
  { value: 'department', label: 'Department' },
  { value: 'assignee', label: 'Assigned officer' },
  { value: 'priority', label: 'Priority' },
  { value: 'month', label: 'Month filed' },
  { value: 'requestor', label: 'Requestor organisation' },
]

const METRIC_OPTIONS: Array<{ value: ReportMetric; label: string; hint: string }> = [
  { value: 'count', label: 'Requests', hint: 'Number of requests in the group' },
  { value: 'avg_response_days', label: 'Avg response', hint: 'Mean days from filing to determination' },
  { value: 'sla_compliance', label: 'SLA compliance', hint: 'Share answered inside the statutory window' },
  { value: 'overdue_count', label: 'Overdue', hint: 'Open requests past the statutory due date' },
  { value: 'appeals', label: 'Appeals', hint: 'Requests appealed under section 20' },
  { value: 'escalations', label: 'Escalations', hint: 'Requests escalated internally' },
]

const CADENCE_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'Do not schedule' },
  { value: 'weekly', label: 'Every Monday' },
  { value: 'monthly', label: 'First of the month' },
  { value: 'quarterly', label: 'Start of each quarter' },
  { value: 'yearly', label: 'Annually (statutory return)' },
]

const FORMAT_OPTIONS: SelectOption[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'xlsx', label: 'Excel workbook' },
  { value: 'pdf', label: 'PDF' },
]

const DEFAULT_FILTERS: ReportFilters = {
  period: 'quarterly',
  statuses: [],
  departments: [],
  priorities: [],
  assignees: [],
  tags: [],
  groupBy: 'department',
  metrics: ['count', 'avg_response_days', 'sla_compliance'],
}

interface ResultRow {
  key: string
  label: string
  count: number
  avg_response_days: number
  sla_compliance: number
  overdue_count: number
  appeals: number
  escalations: number
}

function groupLabel(foiCase: FoiCase, groupBy: ReportGroupBy) {
  switch (groupBy) {
    case 'status':
      return STATUS_META[foiCase.status].label
    case 'department':
      return foiCase.department
    case 'assignee':
      return foiCase.assignedTo ? userName(foiCase.assignedTo) : 'Unassigned'
    case 'priority':
      return PRIORITY_META[foiCase.priority].label
    case 'month':
      return formatMonthYear(foiCase.dateSubmitted)
    case 'requestor':
      return foiCase.requestor.organization || 'Private individual'
    default:
      return '—'
  }
}

/** The aggregation the mock backend would otherwise do, run over the visible rows. */
function aggregate(rows: FoiCase[], groupBy: ReportGroupBy): ResultRow[] {
  const groups = new Map<string, FoiCase[]>()
  rows.forEach((row) => {
    const label = groupLabel(row, groupBy)
    const list = groups.get(label) ?? []
    list.push(row)
    groups.set(label, list)
  })

  const result: ResultRow[] = []
  groups.forEach((list, label) => {
    const responded = list.filter((row) => row.respondedAt)
    const days = responded.map((row) =>
      Math.max(
        0,
        Math.round(
          (new Date(row.respondedAt!).getTime() - new Date(row.dateSubmitted).getTime()) / 86_400_000,
        ),
      ),
    )
    result.push({
      key: label,
      label,
      count: list.length,
      avg_response_days: days.length ? Math.round((days.reduce((a, b) => a + b, 0) / days.length) * 10) / 10 : 0,
      sla_compliance: slaComplianceRate(list),
      overdue_count: list.filter((row) => computeSla(row).state === 'overdue').length,
      appeals: list.filter((row) => row.status === 'appeal' || row.isAppeal).length,
      escalations: list.filter((row) => row.status === 'escalated').length,
    })
  })

  return result.sort((a, b) => b.count - a.count)
}

function metricValue(row: ResultRow, metric: ReportMetric) {
  const raw = row[metric]
  if (metric === 'sla_compliance') return formatPercent(raw)
  if (metric === 'avg_response_days') return formatDays(raw)
  return formatNumber(raw)
}

/** FR-052 / FR-054: build, preview, save and schedule a custom report. */
export function ReportBuilderPage() {
  const { user, can, isReadOnly } = useAuth()
  const { version, refresh } = useData()
  const toast = useToast()

  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [cadence, setCadence] = useState<ScheduleCadence>('none')
  const [format, setFormat] = useState<ReportFormat>('csv')
  const [recipients, setRecipients] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = useState<SavedReport | null>(null)
  const [isBusy, setBusy] = useState(false)

  const set = <K extends keyof ReportFilters>(key: K, value: ReportFilters[K]) =>
    setFilters((prev) => ({ ...prev, [key]: value }))

  const saved = useMemo(() => db.reports.slice(), [version])

  const scoped = useMemo(() => (user ? selectCases(user) : []), [user, version])

  const matched = useMemo(() => {
    const days = PERIOD_DAYS[filters.period]
    let rows = scoped
    if (days) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - days)
      rows = rows.filter((row) => new Date(row.dateSubmitted) >= cutoff)
    } else {
      if (filters.dateFrom) rows = rows.filter((row) => row.dateSubmitted.slice(0, 10) >= filters.dateFrom!)
      if (filters.dateTo) rows = rows.filter((row) => row.dateSubmitted.slice(0, 10) <= filters.dateTo!)
    }
    if (filters.statuses.length) rows = rows.filter((row) => filters.statuses.includes(row.status))
    if (filters.departments.length) rows = rows.filter((row) => filters.departments.includes(row.department))
    if (filters.priorities.length) rows = rows.filter((row) => filters.priorities.includes(row.priority))
    if (filters.assignees.length) rows = rows.filter((row) => row.assignedTo && filters.assignees.includes(row.assignedTo))
    if (filters.tags.length) rows = rows.filter((row) => row.tags.some((tag) => filters.tags.includes(tag)))
    return rows
  }, [scoped, filters])

  const results = useMemo(() => aggregate(matched, filters.groupBy), [matched, filters.groupBy])
  const metrics = filters.metrics.length ? filters.metrics : (['count'] as ReportMetric[])
  const groupTitle = GROUP_OPTIONS.find((option) => option.value === filters.groupBy)?.label ?? 'Group'

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setDescription('')
    setCadence('none')
    setFormat('csv')
    setRecipients('')
    setFilters(DEFAULT_FILTERS)
  }

  const load = (report: SavedReport) => {
    setEditingId(report.id)
    setName(report.name)
    setDescription(report.description)
    setCadence(report.cadence)
    setFormat(report.format)
    setRecipients(report.recipients.join(', '))
    setFilters({ ...DEFAULT_FILTERS, ...report.filters })
    toast.info('Report loaded', `Editing “${report.name}”.`)
  }

  const exportRows = () => {
    const headers = [groupTitle, ...metrics.map((metric) => METRIC_OPTIONS.find((m) => m.value === metric)!.label)]
    downloadTextFile(
      `${(name || 'custom-report').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.csv`,
      toCsv(
        headers,
        results.map((row) => [row.label, ...metrics.map((metric) => row[metric])]),
      ),
      'text/csv',
    )
    toast.success('Report exported', `${results.length} row${results.length === 1 ? '' : 's'} written to CSV.`)
  }

  const nextRunFor = (value: ScheduleCadence) => {
    if (value === 'none') return null
    const next = new Date()
    if (value === 'weekly') next.setDate(next.getDate() + (8 - next.getDay()) % 7 || 7)
    if (value === 'monthly') next.setMonth(next.getMonth() + 1, 1)
    if (value === 'quarterly') next.setMonth(next.getMonth() + 3, 1)
    if (value === 'yearly') next.setFullYear(next.getFullYear() + 1, 0)
    return next.toISOString()
  }

  const persist = async () => {
    if (!user) return
    if (!name.trim()) {
      toast.error('Name required', 'Give the report a name before saving it.')
      return
    }
    setBusy(true)
    try {
      await saveReport(
        {
          id: editingId ?? '',
          name: name.trim(),
          description: description.trim() || `Custom report grouped by ${groupTitle.toLowerCase()}.`,
          creatorId: user.id,
          filters,
          cadence,
          recipients: recipients
            .split(',')
            .map((entry) => entry.trim())
            .filter(Boolean),
          format,
          lastRun: null,
          nextRun: nextRunFor(cadence),
          createdAt: new Date().toISOString(),
        },
        user.id,
      )
      refresh()
      toast.success(editingId ? 'Report updated' : 'Report saved', 'It is now available to your team.')
      resetForm()
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!pendingDelete || !user) return
    setBusy(true)
    try {
      await deleteReport(pendingDelete.id, user.id)
      refresh()
      toast.success('Report deleted', `“${pendingDelete.name}” was removed.`)
      if (editingId === pendingDelete.id) resetForm()
    } finally {
      setBusy(false)
      setPendingDelete(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Custom report builder"
        description="Pick a period, narrow the population, choose how to group it, and save the definition for scheduled delivery."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Reports', to: '/reports' }, { label: 'Builder' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" leadingIcon={<Plus className="h-4 w-4" />} onClick={resetForm}>
              New definition
            </Button>
            <Button variant="secondary" leadingIcon={<Play className="h-4 w-4" />} onClick={exportRows}>
              Run &amp; export
            </Button>
            {can('report:schedule') && !isReadOnly ? (
              <Button leadingIcon={<Save className="h-4 w-4" />} onClick={persist} isLoading={isBusy}>
                {editingId ? 'Update report' : 'Save report'}
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader title="Period" description="Reporting window applied to the date filed." />
            <CardBody className="space-y-3">
              <Select
                label="Range"
                options={PERIOD_OPTIONS}
                value={filters.period}
                onChange={(event) => set('period', event.target.value as ReportPeriod)}
              />
              {filters.period === 'custom' ? (
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    label="From"
                    value={filters.dateFrom ?? ''}
                    onChange={(event) => set('dateFrom', event.target.value)}
                  />
                  <Input
                    type="date"
                    label="To"
                    value={filters.dateTo ?? ''}
                    onChange={(event) => set('dateTo', event.target.value)}
                  />
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Population" description="Leave a group empty to include everything." />
            <CardBody className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_ORDER.map((status) => (
                    <ChoiceChip
                      key={status}
                      selected={filters.statuses.includes(status)}
                      dot={STATUS_META[status].dot}
                      onClick={() => set('statuses', toggleIn<CaseStatus>(filters.statuses, status))}
                    >
                      {STATUS_META[status].label}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Priority</p>
                <div className="flex flex-wrap gap-1.5">
                  {(['critical', 'high', 'medium', 'low'] as CasePriority[]).map((priority) => (
                    <ChoiceChip
                      key={priority}
                      selected={filters.priorities.includes(priority)}
                      dot={PRIORITY_META[priority].dot}
                      onClick={() => set('priorities', toggleIn(filters.priorities, priority))}
                    >
                      {PRIORITY_META[priority].label}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Department</p>
                <div className="flex flex-wrap gap-1.5">
                  {reference.departments.slice(0, 10).map((department) => (
                    <ChoiceChip
                      key={department.id}
                      selected={filters.departments.includes(department.name)}
                      onClick={() => set('departments', toggleIn(filters.departments, department.name))}
                    >
                      {department.name}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Tags</p>
                <div className="flex flex-wrap gap-1.5">
                  {reference.tags.map((tag) => (
                    <ChoiceChip
                      key={tag.id}
                      selected={filters.tags.includes(tag.label)}
                      onClick={() => set('tags', toggleIn(filters.tags, tag.label))}
                    >
                      {tag.label}
                    </ChoiceChip>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Shape the output"
              description="One row per group; one column per metric."
              icon={<Sparkles className="h-4 w-4" />}
            />
            <CardBody className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Group rows by"
                  options={GROUP_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
                  value={filters.groupBy}
                  onChange={(event) => set('groupBy', event.target.value as ReportGroupBy)}
                />
                <Select
                  label="Export format"
                  options={FORMAT_OPTIONS}
                  value={format}
                  onChange={(event) => setFormat(event.target.value as ReportFormat)}
                  hint="PDF and Excel are stubbed in this prototype."
                />
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Metrics</p>
                <div className="flex flex-wrap gap-1.5">
                  {METRIC_OPTIONS.map((option) => (
                    <ChoiceChip
                      key={option.value}
                      selected={filters.metrics.includes(option.value)}
                      onClick={() => set('metrics', toggleIn(filters.metrics, option.value))}
                    >
                      {option.label}
                    </ChoiceChip>
                  ))}
                </div>
                <p className="mt-2 text-xs text-ink-400">
                  {METRIC_OPTIONS.filter((option) => filters.metrics.includes(option.value))
                    .map((option) => option.hint)
                    .join(' · ') || 'Select at least one metric; requests are counted by default.'}
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Preview"
              description={`${formatNumber(matched.length)} request${matched.length === 1 ? '' : 's'} matched · ${results.length} group${results.length === 1 ? '' : 's'}`}
              actions={<Badge tone="brand">{groupTitle}</Badge>}
            />
            <CardBody className="p-0">
              {results.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={<Sparkles className="h-6 w-6" />}
                    title="No requests match these filters"
                    description="Widen the period or clear a filter group to see results."
                    compact
                  />
                </div>
              ) : (
                <TableWrap>
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>{groupTitle}</Th>
                        {metrics.map((metric) => (
                          <Th key={metric} className="text-right">
                            {METRIC_OPTIONS.find((option) => option.value === metric)!.label}
                          </Th>
                        ))}
                      </Tr>
                    </Thead>
                    <Tbody>
                      {results.map((row) => (
                        <Tr key={row.key}>
                          <Td className="font-medium text-ink-900">{row.label}</Td>
                          {metrics.map((metric) => (
                            <Td key={metric} className="text-right">
                              {metricValue(row, metric)}
                            </Td>
                          ))}
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableWrap>
              )}
            </CardBody>
          </Card>

          {results.length ? (
            <BarChartCard
              data={results.slice(0, 12).map((row) => ({ label: row.label, value: row.count }))}
              title={`Requests by ${groupTitle.toLowerCase()}`}
              layout="vertical"
              valueLabel="Requests"
              yAxisWidth={190}
              height={Math.max(220, Math.min(results.length, 12) * 34 + 60)}
              showValues
            />
          ) : null}
        </div>
      </div>

      {can('report:schedule') && !isReadOnly ? (
        <Card>
          <CardHeader
            title="Save and schedule"
            description="Scheduled reports are delivered by email at 06:00 Africa/Lagos on the chosen cadence."
            icon={<CalendarClock className="h-4 w-4" />}
          />
          <CardBody className="grid gap-3 lg:grid-cols-4">
            <Input
              label="Report name"
              placeholder="Quarterly FOI compliance by department"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <Select
              label="Cadence"
              options={CADENCE_OPTIONS}
              value={cadence}
              onChange={(event) => setCadence(event.target.value as ScheduleCadence)}
              hint={cadence === 'none' ? 'Saved for on-demand use only.' : `Next run ${formatDate(nextRunFor(cadence))}`}
            />
            <Input
              label="Recipients"
              placeholder="legal@hyprep.gov.ng, coordinator@hyprep.gov.ng"
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
              hint="Comma separated."
              containerClassName="lg:col-span-2"
            />
            <Textarea
              label="Description"
              rows={2}
              placeholder="What this report is for and who reads it."
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              containerClassName="lg:col-span-4"
            />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title="Saved reports"
          description="Definitions available to the Legal Unit, including scheduled statutory returns."
        />
        <CardBody className="p-0">
          {saved.length === 0 ? (
            <div className="p-5">
              <EmptyState
                icon={<CalendarClock className="h-6 w-6" />}
                title="No saved reports yet"
                description="Build a definition above and save it to reuse or schedule."
                compact
              />
            </div>
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Report</Th>
                    <Th>Grouped by</Th>
                    <Th>Cadence</Th>
                    <Th>Recipients</Th>
                    <Th>Last run</Th>
                    <Th>Next run</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {saved.map((report) => (
                    <Tr key={report.id}>
                      <Td>
                        <p className="font-medium text-ink-900">{report.name}</p>
                        <p className="mt-0.5 max-w-md text-xs text-ink-500">{report.description}</p>
                        <p className="mt-0.5 text-2xs text-ink-400">Created by {userName(report.creatorId)}</p>
                      </Td>
                      <Td className="text-ink-600">
                        {GROUP_OPTIONS.find((option) => option.value === report.filters.groupBy)?.label ?? '—'}
                      </Td>
                      <Td>
                        {report.cadence === 'none' ? (
                          <Badge tone="neutral">On demand</Badge>
                        ) : (
                          <Badge tone="brand">{CADENCE_OPTIONS.find((o) => o.value === report.cadence)?.label}</Badge>
                        )}
                      </Td>
                      <Td className="max-w-[14rem] truncate text-xs text-ink-500">
                        {report.recipients.length ? report.recipients.join(', ') : '—'}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-ink-500">{formatDate(report.lastRun)}</Td>
                      <Td className="whitespace-nowrap text-xs text-ink-500">{formatDate(report.nextRun)}</Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => load(report)}>
                            Load
                          </Button>
                          {can('report:schedule') && !isReadOnly ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Delete ${report.name}`}
                              onClick={() => setPendingDelete(report)}
                            >
                              <Trash2 className="h-4 w-4 text-crest-600" />
                            </Button>
                          ) : null}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={remove}
        title="Delete saved report?"
        message={`“${pendingDelete?.name ?? ''}” and its schedule will be removed. Report history is retained in the audit trail.`}
        confirmLabel="Delete report"
        destructive
        isBusy={isBusy}
      />
    </div>
  )
}
