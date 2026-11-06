import { useMemo, useState } from 'react'
import { CalendarClock, Play, Plus, Save, Sparkles, Trash2 } from 'lucide-react'
import type {
  CasePriority,
  CaseStatus,
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
import { useReports, useSaveReport, useDeleteReport, useReportRun } from '@/api/reports'
import { useAction } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { nextReportRun } from '../../../convex/lib/reportSchedule'
import { EMPTY_REFERENCE } from '@/api/directory'
import { PRIORITY_META, STATUS_META, STATUS_ORDER } from '@/lib/constants'
import { formatDate, formatDays, formatNumber, formatPercent } from '@/lib/format'
import { toggleIn } from '@/lib/utils'
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

function metricValue(row: ResultRow, metric: ReportMetric) {
  const raw = row[metric]
  if (metric === 'sla_compliance') return formatPercent(raw)
  if (metric === 'avg_response_days') return formatDays(raw)
  return formatNumber(raw)
}

/** FR-052 / FR-054: build, preview, save and schedule a custom report. */
export function ReportBuilderPage() {
  const { user, can, isReadOnly } = useAuth()
  const { usersById, reference, refresh } = useData()
  const liveReference = reference ?? EMPTY_REFERENCE
  const userName = (id: string) => usersById.get(id)?.name ?? id
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

  const convexReports = useReports()
  const convexSaveReport = useSaveReport()
  const convexDeleteReport = useDeleteReport()
  const exportReport = useAction(api.actions.reports.exportReport)

  const saved = useMemo(
    () => convexReports ?? [],
    [convexReports],
  )

  const run = useReportRun(filters)
  const results: ResultRow[] = (run?.rows ?? []).map((row) => {
    const group = String(row.group ?? '')
    const label = filters.groupBy === 'assignee' ? usersById.get(group)?.name ?? group : group
    return { key: group, label, count: Number(row.count ?? 0), avg_response_days: Number(row.avg_response_days ?? 0), sla_compliance: Number(row.sla_compliance ?? 0), overdue_count: Number(row.overdue_count ?? 0), appeals: Number(row.appeals ?? 0), escalations: Number(row.escalations ?? 0) }
  })
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

  const exportRows = async () => {
    setBusy(true)
    try {
      const file = await exportReport({ name: name || 'Custom report', filters, format })
      const response = await fetch(file.url)
      if (!response.ok) throw new Error('The report file could not be downloaded.')
      const url = URL.createObjectURL(await response.blob())
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = file.fileName
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 60000)
      toast.success('Report exported', `The ${format.toUpperCase()} file is ready.`)
    } catch (error) {
      toast.error('Report export failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const nextRunFor = (value: ScheduleCadence) => {
    return nextReportRun(value) ?? null
  }

  const persist = async () => {
    if (!user) return
    if (!name.trim()) {
      toast.error('Name required', 'Give the report a name before saving it.')
      return
    }
    setBusy(true)
    try {
      await convexSaveReport({
        id: editingId ?? undefined,
        name: name.trim(),
        description: description.trim() || `Custom report grouped by ${groupTitle.toLowerCase()}.`,
        filters,
        cadence,
        recipients: recipients.split(',').map((entry) => entry.trim()).filter(Boolean),
        format,
      })
      refresh()
      toast.success(editingId ? 'Report updated' : 'Report saved', 'It is now available to your team.')
      resetForm()
    } catch (error) {
      toast.error('Report save failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!pendingDelete || !user) return
    setBusy(true)
    try {
      await convexDeleteReport(pendingDelete.id)
      refresh()
      toast.success('Report deleted', `“${pendingDelete.name}” was removed.`)
      if (editingId === pendingDelete.id) resetForm()
    } catch (error) {
      toast.error('Report deletion failed', error instanceof Error ? error.message : 'Please try again.')
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
            <Button variant="secondary" leadingIcon={<Play className="h-4 w-4" />} onClick={() => void exportRows()} disabled={!can('report:export')} isLoading={isBusy}>
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
                  {liveReference.departments.slice(0, 10).map((department) => (
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
                  {liveReference.tags.map((tag) => (
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
                  hint="Download a real CSV, PDF, or Excel file."
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
              description={`${formatNumber((run?.total ?? 0))} request${(run?.total ?? 0) === 1 ? '' : 's'} matched · ${results.length} group${results.length === 1 ? '' : 's'}`}
              actions={<Badge tone="brand">{groupTitle}</Badge>}
            />
            <CardBody className="p-0">
              {run?.error ? <p role="alert" className="p-5 text-sm text-crest-700">{run.error}</p> : results.length === 0 ? (
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
