import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  CheckSquare,
  FileText,
  History,
  Link2,
  MessageSquare,
  Printer,
  ScrollText,
  ShieldCheck,
  Tag,
} from 'lucide-react'
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PriorityBadge,
  SkeletonCard,
  SlaBadge,
  StatusBadge,
  Tabs,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { MetaItem, PageHeader } from '@/components/common'
import { CaseSummaryCard } from './components/CaseSummaryCard'
import { CaseTimeline } from './components/CaseTimeline'
import { CaseActionsPanel } from './components/CaseActionsPanel'
import { CaseDocumentsPanel } from './components/CaseDocumentsPanel'
import { CaseNotesPanel } from './components/CaseNotesPanel'
import { CaseTasksPanel } from './components/CaseTasksPanel'
import { CaseCourtPanel } from './components/CaseCourtPanel'
import { getCaseBundle } from '@/mocks/api'
import { db, userName } from '@/mocks/db'
import { AUDIT_ACTION_META, AUDIT_SEVERITY_META } from '@/lib/constants'
import { computeSla } from '@/lib/sla'
import { formatDateTime, formatRelative } from '@/lib/format'
import { useAsync } from '@/hooks/useAsync'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'

type DetailTab = 'overview' | 'documents' | 'notes' | 'tasks' | 'court' | 'timeline' | 'audit'

/**
 * FR-021 / FR-023: the case file. Every tab reads from one `getCaseBundle`
 * call so the header counts, the timeline and the panels can never disagree.
 */
export function CaseDetailPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const { user, can, isReadOnly } = useAuth()
  const { version, refresh } = useData()

  const bundle = useAsync(() => getCaseBundle(id), [id, version])
  const data = bundle.data

  const isRequestor = user?.roleId === 'requestor' || user?.roleId === 'external'
  const canSeeInternal = can('note:read:internal')

  const audit = useMemo(
    () => db.auditLogs.filter((log) => log.entityId === id).slice(0, 60),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, version],
  )
  const access = useMemo(
    () => db.accessLogs.filter((log) => log.caseId === id).slice(0, 40),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, version],
  )

  const tabs = useMemo<Array<TabItem<DetailTab>>>(() => {
    const list: Array<TabItem<DetailTab>> = [
      { key: 'overview', label: 'Overview', icon: <ScrollText className="h-4 w-4" /> },
      {
        key: 'documents',
        label: 'Documents',
        count: data?.documents.length ?? 0,
        icon: <FileText className="h-4 w-4" />,
      },
      {
        key: 'notes',
        label: isRequestor ? 'Messages' : 'Notes',
        count: (isRequestor ? data?.notes.filter((n) => n.type === 'public') : data?.notes)?.length ?? 0,
        icon: <MessageSquare className="h-4 w-4" />,
      },
    ]

    if (!isRequestor) {
      list.push({
        key: 'tasks',
        label: 'Tasks',
        count: data?.tasks.filter((t) => t.status !== 'done').length ?? 0,
        icon: <CheckSquare className="h-4 w-4" />,
      })
    }
    if (can('court:read')) {
      list.push({
        key: 'court',
        label: 'Court',
        count: data?.courtDates.length ?? 0,
        icon: <CalendarClock className="h-4 w-4" />,
      })
    }
    list.push({ key: 'timeline', label: 'Timeline', icon: <History className="h-4 w-4" /> })
    if (can('audit:read')) {
      list.push({ key: 'audit', label: 'Audit', icon: <ShieldCheck className="h-4 w-4" /> })
    }
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isRequestor])

  const requested = (params.get('tab') ?? 'overview') as DetailTab
  const active: DetailTab = tabs.some((tab) => tab.key === requested) ? requested : 'overview'

  const setTab = (next: DetailTab) => {
    const draft = new URLSearchParams(params)
    if (next === 'overview') draft.delete('tab')
    else draft.set('tab', next)
    setParams(draft, { replace: true })
  }

  if (bundle.isLoading && !data) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={8} />
      </div>
    )
  }

  if (!data) {
    return (
      <EmptyState
        icon={<ScrollText className="h-6 w-6" />}
        title="Case not found"
        description="The case you are looking for does not exist, or it falls outside the records you are permitted to view."
        action={
          <ButtonLink to="/cases" variant="outline" leadingIcon={<ArrowLeft className="h-4 w-4" />}>
            Back to the case register
          </ButtonLink>
        }
      />
    )
  }

  const { foiCase, documents, notes, tasks, courtDates, timeline, linked } = data
  const sla = computeSla(foiCase)

  return (
    <div className="space-y-5">
      <PageHeader
        breadcrumbs={[
          { label: 'Cases', to: isRequestor ? '/my-requests' : '/cases' },
          { label: foiCase.caseNumber },
        ]}
        title={foiCase.subject}
        description={foiCase.caseNumber}
        meta={
          <>
            <StatusBadge status={foiCase.status} />
            <PriorityBadge priority={foiCase.priority} />
            <SlaBadge sla={sla} />
            <MetaItem label="Department" value={foiCase.department} />
            <MetaItem
              label="Officer"
              value={foiCase.assignedTo ? userName(foiCase.assignedTo) : 'Unassigned'}
            />
            <MetaItem label="Last activity" value={formatRelative(foiCase.updatedAt)} />
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => window.print()}
              leadingIcon={<Printer className="h-4 w-4" />}
            >
              Print
            </Button>
            {can('template:read') && !isRequestor ? (
              <ButtonLink
                to={`/templates?case=${foiCase.id}`}
                leadingIcon={<FileText className="h-4 w-4" />}
              >
                Generate letter
              </ButtonLink>
            ) : null}
          </>
        }
        tabs={<Tabs tabs={tabs} active={active} onChange={setTab} label="Case sections" />}
      />

      {active === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <CaseSummaryCard foiCase={foiCase} />

            <Card>
              <CardHeader
                title="Request as submitted"
                description="Verbatim text received from the requestor. Do not edit; record clarifications as notes."
              />
              <CardBody>
                <div className="space-y-3 whitespace-pre-line text-sm leading-relaxed text-ink-600">
                  {foiCase.description}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Recent activity"
                description="The ten most recent events on this file."
                actions={
                  <button
                    type="button"
                    onClick={() => setTab('timeline')}
                    className="text-sm font-medium text-brand-700 hover:text-brand-800"
                  >
                    View full timeline
                  </button>
                }
              />
              <CardBody>
                <CaseTimeline events={timeline} limit={10} />
              </CardBody>
            </Card>
          </div>

          <div className="space-y-4">
            {isRequestor ? (
              <Card>
                <CardHeader title="Your request at a glance" />
                <CardBody className="space-y-3 text-sm text-ink-600">
                  <p>
                    {sla.state === 'met'
                      ? 'A determination has been issued on this request.'
                      : `${sla.label}. The Legal Unit will contact you using the details on file.`}
                  </p>
                  <p>
                    {documents.filter((doc) => doc.isPublic).length} document
                    {documents.filter((doc) => doc.isPublic).length === 1 ? '' : 's'} released to you so far.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTab('documents')}
                    className="text-sm font-medium text-brand-700 hover:text-brand-800"
                  >
                    Open released documents
                  </button>
                </CardBody>
              </Card>
            ) : (
              <CaseActionsPanel foiCase={foiCase} linked={linked} onChanged={refresh} />
            )}

            <Card>
              <CardHeader title="Tags" description="Classification used for reporting and routing." />
              <CardBody>
                {foiCase.tags.length === 0 ? (
                  <p className="text-sm text-ink-500">No tags applied.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {foiCase.tags.map((tag) => (
                      <Badge key={tag} tone="neutral">
                        <Tag className="mr-1 h-3 w-3" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      ) : null}

      {active === 'documents' ? (
        <CaseDocumentsPanel
          caseId={foiCase.id}
          caseNumber={foiCase.caseNumber}
          documents={documents}
          onChanged={refresh}
          readOnly={isReadOnly || isRequestor || !can('document:upload')}
          canRedact={can('document:redact')}
          publishedOnly={isRequestor}
        />
      ) : null}

      {active === 'notes' ? (
        <CaseNotesPanel
          caseId={foiCase.id}
          notes={notes}
          onChanged={refresh}
          publicOnly={isRequestor || !canSeeInternal}
          readOnly={isReadOnly}
        />
      ) : null}

      {active === 'tasks' ? (
        <CaseTasksPanel
          caseId={foiCase.id}
          tasks={tasks}
          onChanged={refresh}
          readOnly={isReadOnly || !can('task:manage')}
        />
      ) : null}

      {active === 'court' ? (
        <CaseCourtPanel
          caseId={foiCase.id}
          caseNumber={foiCase.caseNumber}
          courtDates={courtDates}
          onChanged={refresh}
          readOnly={isReadOnly || !can('court:write')}
        />
      ) : null}

      {active === 'timeline' ? (
        <Card>
          <CardHeader
            title="Case timeline"
            description={`${timeline.length} events, newest first. Derived from the records on this file.`}
          />
          <CardBody>
            <CaseTimeline events={timeline} />
          </CardBody>
        </Card>
      ) : null}

      {active === 'audit' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Audit trail"
              description="Every change to this case, attributed and time-stamped."
              actions={<Badge tone="neutral">{audit.length} entries</Badge>}
            />
            <CardBody className="p-0">
              {audit.length === 0 ? (
                <EmptyState
                  compact
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="No audit entries"
                  description="Changes made to this case will be recorded here."
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {audit.map((log) => (
                    <li key={log.id} className="flex flex-wrap items-start gap-3 px-5 py-3">
                      <span className={AUDIT_ACTION_META[log.action].className + ' rounded-md px-2 py-0.5 text-xs font-medium'}>
                        {AUDIT_ACTION_META[log.action].label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink-700">{log.details}</p>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {userName(log.performedBy)} · {formatDateTime(log.timestamp)} · {log.ipAddress}
                        </p>
                      </div>
                      <Badge tone="neutral" className={AUDIT_SEVERITY_META[log.severity].className}>
                        {AUDIT_SEVERITY_META[log.severity].label}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Document access log"
              description="Who opened, downloaded or printed the documents attached to this case."
            />
            <CardBody className="p-0">
              {access.length === 0 ? (
                <EmptyState
                  compact
                  icon={<FileText className="h-5 w-5" />}
                  title="No document access recorded"
                  description="Views, downloads and prints appear here as soon as they happen."
                />
              ) : (
                <ul className="divide-y divide-ink-100">
                  {access.map((log) => (
                    <li key={log.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="font-medium text-ink-800">{userName(log.userId)}</span>
                      <span className="text-ink-500">{log.action}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-600">{log.documentName}</span>
                      <span className="text-xs text-ink-500">{formatDateTime(log.at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {linked.length > 0 && active === 'overview' ? (
        <p className="flex items-center gap-1.5 text-xs text-ink-500">
          <Link2 className="h-3.5 w-3.5" />
          Linked to{' '}
          {linked.map((row, index) => (
            <span key={row.id}>
              {index > 0 ? ', ' : ''}
              <Link to={`/cases/${row.id}`} className="font-medium text-brand-700 hover:underline">
                {row.caseNumber}
              </Link>
            </span>
          ))}
        </p>
      ) : null}
    </div>
  )
}
