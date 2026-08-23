import { useMemo, useState } from 'react'
import { Download, Eye, FileClock, Fingerprint, Lock, ScrollText, ShieldAlert } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { AccessLog, AuditAction, AuditSeverity } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChoiceChip,
  EmptyState,
  Input,
  MetaBadge,
  Pagination,
  SearchInput,
  Select,
  SkeletonTable,
  Table,
  TableWrap,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  UserChip,
} from '@/components/ui'
import type { BadgeTone, SelectOption, TabItem } from '@/components/ui'
import { MetaItem, PageHeader } from '@/components/common'
import { listAccessLogs, listAuditLogs } from '@/mocks/api'
import { reference, usersById } from '@/mocks/db'
import { AUDIT_ACTION_META, AUDIT_SEVERITY_META } from '@/lib/constants'
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import { cn, downloadTextFile, toCsv, toggleIn } from '@/lib/utils'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type LogTab = 'audit' | 'access'

const TABS: Array<TabItem<LogTab>> = [
  { key: 'audit', label: 'Audit trail', icon: <ScrollText className="h-4 w-4" /> },
  { key: 'access', label: 'Document access log', icon: <Fingerprint className="h-4 w-4" /> },
]

const SEVERITIES: AuditSeverity[] = ['info', 'notice', 'warning', 'critical']

const ACTION_OPTIONS: SelectOption[] = [
  { value: '', label: 'All actions' },
  ...(Object.keys(AUDIT_ACTION_META) as AuditAction[]).map((action) => ({
    value: action,
    label: AUDIT_ACTION_META[action].label,
  })),
]

const ENTITY_OPTIONS: SelectOption[] = [
  { value: '', label: 'All record types' },
  { value: 'Case', label: 'Case' },
  { value: 'Document', label: 'Document' },
  { value: 'User', label: 'User' },
  { value: 'Role', label: 'Role' },
  { value: 'CourtDate', label: 'Court date' },
  { value: 'Report', label: 'Report' },
  { value: 'Template', label: 'Template' },
  { value: 'Settings', label: 'Settings' },
  { value: 'Integration', label: 'Integration' },
]

const ACCESS_META: Record<AccessLog['action'], { label: string; tone: BadgeTone }> = {
  view: { label: 'Viewed', tone: 'neutral' },
  download: { label: 'Downloaded', tone: 'info' },
  print: { label: 'Printed', tone: 'warning' },
  denied: { label: 'Denied', tone: 'danger' },
}

const ACCESS_OPTIONS: SelectOption[] = [
  { value: '', label: 'All events' },
  { value: 'view', label: 'Viewed' },
  { value: 'download', label: 'Downloaded' },
  { value: 'print', label: 'Printed' },
  { value: 'denied', label: 'Denied' },
]

export function AuditTrailPage() {
  const { can } = useAuth()
  const { version } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [tab, setTab] = useState<LogTab>(pathname.endsWith('/access') ? 'access' : 'audit')
  const [query, setQuery] = useState('')
  const [action, setAction] = useState('')
  const [entityType, setEntityType] = useState('')
  const [severities, setSeverities] = useState<AuditSeverity[]>([])
  const [actorId, setActorId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [accessAction, setAccessAction] = useState('')
  const [page, setPage] = useState(1)

  const debounced = useDebounced(query, 250)

  const actorOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Any actor' },
      ...reference.users
        .filter((row) => row.roleId !== 'requestor' && row.roleId !== 'external')
        .map((row) => ({ value: row.id, label: row.name })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  const audit = useAsync(
    () =>
      listAuditLogs({
        q: debounced || undefined,
        actions: action ? [action as AuditAction] : undefined,
        severities: severities.length ? severities : undefined,
        actorIds: actorId ? [actorId] : undefined,
        entityTypes: entityType ? [entityType] : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: 25,
      }),
    [debounced, action, severities, actorId, entityType, dateFrom, dateTo, page, version, tab],
  )

  const access = useAsync(
    () =>
      listAccessLogs({
        q: debounced || undefined,
        action: accessAction ? (accessAction as AccessLog['action']) : undefined,
        page,
        pageSize: 25,
      }),
    [debounced, accessAction, page, version, tab],
  )

  function switchTab(next: LogTab) {
    setTab(next)
    setPage(1)
    navigate(next === 'access' ? '/audit/access' : '/audit', { replace: true })
  }

  function resetFilters() {
    setQuery('')
    setAction('')
    setEntityType('')
    setSeverities([])
    setActorId('')
    setDateFrom('')
    setDateTo('')
    setAccessAction('')
    setPage(1)
  }

  function exportCurrent() {
    if (tab === 'audit') {
      const rows = audit.data?.rows ?? []
      downloadTextFile(
        'hyprep-foi-audit-trail.csv',
        toCsv(
          ['Timestamp', 'Actor', 'Action', 'Record type', 'Record', 'Severity', 'IP address', 'Details'],
          rows.map((row) => [
            formatDateTime(row.timestamp),
            usersById.get(row.performedBy)?.name ?? row.performedBy,
            AUDIT_ACTION_META[row.action].label,
            row.entityType,
            row.entityLabel,
            AUDIT_SEVERITY_META[row.severity].label,
            row.ipAddress,
            row.details,
          ]),
        ),
        'text/csv',
      )
    } else {
      const rows = access.data?.rows ?? []
      downloadTextFile(
        'hyprep-foi-document-access-log.csv',
        toCsv(
          ['Timestamp', 'User', 'Event', 'Document', 'Case', 'IP address'],
          rows.map((row) => [
            formatDateTime(row.at),
            usersById.get(row.userId)?.name ?? row.userId,
            ACCESS_META[row.action].label,
            row.documentName,
            row.caseNumber,
            row.ipAddress,
          ]),
        ),
        'text/csv',
      )
    }
    toast.success('Export downloaded', 'The current page of the log has been written to CSV.')
  }

  const total = tab === 'audit' ? audit.data?.total ?? 0 : access.data?.total ?? 0
  const pageCount = tab === 'audit' ? audit.data?.pageCount ?? 1 : access.data?.pageCount ?? 1
  const isLoading = tab === 'audit' ? audit.isLoading : access.isLoading
  const criticalCount = (audit.data?.rows ?? []).filter((row) => row.severity === 'critical').length
  const deniedCount = (access.data?.rows ?? []).filter((row) => row.action === 'denied').length

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit & access logs"
        description="Every state change, sign-in and document view is recorded immutably and retained for seven years."
        icon={<FileClock className="h-5 w-5" />}
        breadcrumbs={[{ label: 'Administration' }, { label: 'Audit & access logs' }]}
        meta={
          <>
            <MetaItem icon={<ScrollText className="h-3.5 w-3.5" />} label="Entries" value={formatNumber(total)} />
            <MetaItem icon={<Lock className="h-3.5 w-3.5" />} label="Retention" value="7 years, append-only" />
          </>
        }
        actions={
          <Button
            variant="secondary"
            leadingIcon={<Download className="h-4 w-4" />}
            onClick={exportCurrent}
            disabled={!can('audit:export') || total === 0}
          >
            Export CSV
          </Button>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={switchTab} label="Log type" />

      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder={
                tab === 'audit'
                  ? 'Search record, actor, IP address or detail…'
                  : 'Search document, case number, user or IP address…'
              }
              className="flex-1"
              label="Search logs"
            />
            {tab === 'audit' ? (
              <>
                <Select
                  label="Action"
                  options={ACTION_OPTIONS}
                  value={action}
                  onChange={(event) => {
                    setAction(event.target.value)
                    setPage(1)
                  }}
                  size="sm"
                  containerClassName="w-full sm:w-44"
                />
                <Select
                  label="Record type"
                  options={ENTITY_OPTIONS}
                  value={entityType}
                  onChange={(event) => {
                    setEntityType(event.target.value)
                    setPage(1)
                  }}
                  size="sm"
                  containerClassName="w-full sm:w-40"
                />
                <Select
                  label="Actor"
                  options={actorOptions}
                  value={actorId}
                  onChange={(event) => {
                    setActorId(event.target.value)
                    setPage(1)
                  }}
                  size="sm"
                  containerClassName="w-full sm:w-48"
                />
              </>
            ) : (
              <Select
                label="Event"
                options={ACCESS_OPTIONS}
                value={accessAction}
                onChange={(event) => {
                  setAccessAction(event.target.value)
                  setPage(1)
                }}
                size="sm"
                containerClassName="w-full sm:w-44"
              />
            )}
          </div>

          {tab === 'audit' ? (
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Severity</span>
                {SEVERITIES.map((severity) => {
                  const meta = AUDIT_SEVERITY_META[severity]
                  return (
                    <ChoiceChip
                      key={severity}
                      selected={severities.includes(severity)}
                      onClick={() => {
                        setSeverities((prev) => toggleIn(prev, severity))
                        setPage(1)
                      }}
                      dot={meta.dot}
                    >
                      {meta.label}
                    </ChoiceChip>
                  )
                })}
              </div>
              <Input
                label="From"
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value)
                  setPage(1)
                }}
                containerClassName="w-full sm:w-40"
              />
              <Input
                label="To"
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value)
                  setPage(1)
                }}
                containerClassName="w-full sm:w-40"
              />
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {tab === 'audit' && criticalCount > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-crest-300 bg-crest-50 px-3 py-2 text-sm text-crest-900">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          <span>
            {criticalCount} critical entr{criticalCount === 1 ? 'y' : 'ies'} on this page. Critical events page the
            platform team and cannot be suppressed from the trail.
          </span>
        </div>
      ) : null}

      {tab === 'access' && deniedCount > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-crest-300 bg-crest-50 px-3 py-2 text-sm text-crest-900">
          <Lock className="h-4 w-4 shrink-0" />
          <span>
            {deniedCount} access attempt{deniedCount === 1 ? '' : 's'} on this page were refused by the confidentiality
            rules. Repeated refusals are reviewed by the Head of Legal Unit.
          </span>
        </div>
      ) : null}

      <Card>
        <CardHeader
          title={tab === 'audit' ? 'Audit trail' : 'Document access log'}
          description={
            tab === 'audit'
              ? 'Actor, action, record, timestamp, IP address and user agent for every change.'
              : 'Who opened, downloaded or printed each attachment, and who was refused access.'
          }
        />
        <CardBody className="p-0">
          {isLoading ? (
            <div className="p-4">
              <SkeletonTable rows={8} />
            </div>
          ) : total === 0 ? (
            <EmptyState
              icon={<Eye className="h-6 w-6" />}
              title="No log entries match these filters"
              description="Widen the date range or clear the filters to see the full trail."
              action={
                <Button variant="secondary" onClick={resetFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : tab === 'audit' ? (
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>When</Th>
                    <Th>Actor</Th>
                    <Th>Action</Th>
                    <Th>Record</Th>
                    <Th>Severity</Th>
                    <Th>Source</Th>
                    <Th>Details</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {(audit.data?.rows ?? []).map((row) => {
                    const actor = usersById.get(row.performedBy)
                    const meta = AUDIT_ACTION_META[row.action]
                    return (
                      <Tr key={row.id}>
                        <Td className="whitespace-nowrap">
                          <p className="text-ink-800" title={formatDateTime(row.timestamp)}>
                            {formatRelative(row.timestamp)}
                          </p>
                          <p className="mt-0.5 font-mono text-2xs text-ink-400">{formatDateTime(row.timestamp)}</p>
                        </Td>
                        <Td>
                          {actor ? (
                            <UserChip user={actor} secondary={actor.position ?? actor.organization} />
                          ) : (
                            <span className="text-xs text-ink-500">System</span>
                          )}
                        </Td>
                        <Td>
                          <span
                            className={cn(
                              'inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-semibold',
                              meta.className,
                            )}
                          >
                            {meta.label}
                          </span>
                        </Td>
                        <Td>
                          <p className="font-medium text-ink-900">{row.entityLabel}</p>
                          <p className="mt-0.5 text-2xs uppercase tracking-wide text-ink-400">{row.entityType}</p>
                        </Td>
                        <Td>
                          <MetaBadge tone={AUDIT_SEVERITY_META[row.severity]} />
                        </Td>
                        <Td>
                          <p className="font-mono text-2xs text-ink-600">{row.ipAddress}</p>
                          <p className="mt-0.5 max-w-[12rem] truncate text-2xs text-ink-400" title={row.userAgent}>
                            {row.userAgent}
                          </p>
                        </Td>
                        <Td className="max-w-sm text-xs leading-relaxed text-ink-600">{row.details}</Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>When</Th>
                    <Th>User</Th>
                    <Th>Event</Th>
                    <Th>Document</Th>
                    <Th>Case</Th>
                    <Th>IP address</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {(access.data?.rows ?? []).map((row) => {
                    const actor = usersById.get(row.userId)
                    const meta = ACCESS_META[row.action]
                    return (
                      <Tr key={row.id}>
                        <Td className="whitespace-nowrap">
                          <p className="text-ink-800" title={formatDateTime(row.at)}>
                            {formatRelative(row.at)}
                          </p>
                          <p className="mt-0.5 font-mono text-2xs text-ink-400">{formatDateTime(row.at)}</p>
                        </Td>
                        <Td>
                          {actor ? (
                            <UserChip user={actor} secondary={actor.organization} />
                          ) : (
                            <span className="text-xs text-ink-500">{row.userId}</span>
                          )}
                        </Td>
                        <Td>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                        </Td>
                        <Td className="max-w-xs truncate font-medium text-ink-900" title={row.documentName}>
                          {row.documentName}
                        </Td>
                        <Td className="font-mono text-2xs text-ink-600">{row.caseNumber}</Td>
                        <Td className="font-mono text-2xs text-ink-600">{row.ipAddress}</Td>
                      </Tr>
                    )
                  })}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
        {pageCount > 1 ? (
          <div className="border-t border-ink-200 px-4 py-3">
            <Pagination page={page} pageSize={25} total={total} onPageChange={setPage} label="log entries" />
          </div>
        ) : null}
      </Card>
    </div>
  )
}
