import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  Clock4,
  Download,
  FilePlus2,
  Info,
  Scale,
  Search,
} from 'lucide-react'
import type { CaseStatus } from '@/types'
import {
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  SearchInput,
  SlaBadge,
  StatCard,
  StatusBadge,
  Tabs,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { selectCases } from '@/mocks/api'
import { db } from '@/mocks/db'
import { computeSla } from '@/lib/sla'
import { CONCLUDED_STATUSES, OPEN_STATUSES, STATUTORY_RESPONSE_DAYS } from '@/lib/constants'
import { formatDate, formatRelative } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'

type Tab = 'all' | 'open' | 'concluded'

/** The requestor and external-stakeholder portal: my requests and their state. */
export function MyRequestsPage() {
  const { user } = useAuth()
  const { version } = useData()
  const [tab, setTab] = useState<Tab>('all')
  const [term, setTerm] = useState('')

  const view = useMemo(() => {
    if (!user) return null
    const mine = selectCases(user).sort((a, b) => b.dateSubmitted.localeCompare(a.dateSubmitted))
    const open = mine.filter((row) => OPEN_STATUSES.includes(row.status))
    const concluded = mine.filter((row) => CONCLUDED_STATUSES.includes(row.status))
    const responses = db.documents.filter(
      (doc) => doc.isPublic && mine.some((row) => row.id === doc.caseId),
    )
    return { mine, open, concluded, responses }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, version])

  if (!view || !user) return null

  const source = tab === 'open' ? view.open : tab === 'concluded' ? view.concluded : view.mine
  const needle = term.trim().toLowerCase()
  const rows = needle
    ? source.filter((row) =>
        `${row.subject} ${row.caseNumber} ${row.department}`.toLowerCase().includes(needle),
      )
    : source

  const tabs: TabItem<Tab>[] = [
    { key: 'all', label: 'All requests', count: view.mine.length },
    { key: 'open', label: 'In progress', count: view.open.length },
    { key: 'concluded', label: 'Concluded', count: view.concluded.length },
  ]

  const awaiting = view.open.filter((row) => computeSla(row).state !== 'met').length
  const answered = view.mine.filter((row) => Boolean(row.respondedAt)).length

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome, ${user.name.split(' ')[0]}`}
        description="Track every Freedom of Information request you have submitted to HYPREP and download the responses issued to you."
        actions={
          <ButtonLink to="/requests/new" leadingIcon={<FilePlus2 className="h-4 w-4" />}>
            New FOI request
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Requests submitted"
          value={view.mine.length}
          icon={<Scale className="h-5 w-5" />}
          tone="brand"
          hint="All time"
        />
        <StatCard
          label="In progress"
          value={view.open.length}
          icon={<Clock4 className="h-5 w-5" />}
          tone="info"
          hint={`${awaiting} awaiting a determination`}
        />
        <StatCard
          label="Responses received"
          value={answered}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="success"
          hint="Determination communicated"
        />
        <StatCard
          label="Documents released"
          value={view.responses.length}
          icon={<Download className="h-5 w-5" />}
          tone="neutral"
          hint="Available to download"
        />
      </div>

      <Card>
        <CardHeader
          title="My requests"
          description="Select a request to see its full history, correspondence and released documents."
          actions={
            <SearchInput
              value={term}
              onChange={setTerm}
              size="sm"
              label="Search my requests"
              placeholder="Search subject or case number"
              className="w-full sm:w-72"
            />
          }
        />
        <CardBody className="space-y-4">
          <Tabs tabs={tabs} active={tab} onChange={setTab} variant="pill" label="Filter my requests" />

          {rows.length === 0 ? (
            <EmptyState
              icon={<Search className="h-6 w-6" />}
              title={needle ? 'No requests match that search' : 'No requests here yet'}
              description={
                needle
                  ? 'Try a different subject, case number or department.'
                  : 'When you submit an FOI request it will appear here with its statutory response date.'
              }
              action={
                needle ? undefined : (
                  <ButtonLink to="/requests/new" size="sm" leadingIcon={<FilePlus2 className="h-4 w-4" />}>
                    Submit a request
                  </ButtonLink>
                )
              }
            />
          ) : (
            <ul className="divide-y divide-ink-200/70">
              {rows.map((row) => (
                <li key={row.id}>
                  <Link
                    to={`/cases/${row.id}`}
                    className="flex flex-col gap-3 rounded-lg px-2 py-4 transition hover:bg-ink-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-ink-500">{row.caseNumber}</span>
                        <StatusBadge status={row.status} size="sm" />
                      </div>
                      <p className="truncate text-sm font-semibold text-ink-900">{row.subject}</p>
                      <p className="text-xs text-ink-500">
                        Submitted {formatDate(row.dateSubmitted)} · {row.department} · last update{' '}
                        {formatRelative(row.updatedAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
                      <SlaBadge sla={computeSla(row)} size="sm" />
                      <span className="text-xs text-ink-500">
                        {row.dateClosed
                          ? `Concluded ${formatDate(row.dateClosed)}`
                          : `Response due ${formatDate(row.statutoryDueDate)}`}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Documents released to you"
            description="Response letters and annexures published against your requests."
            icon={<Download className="h-4 w-4" />}
          />
          <CardBody>
            {view.responses.length === 0 ? (
              <EmptyState
                compact
                title="Nothing published yet"
                description="Released documents appear here as soon as a determination is issued."
              />
            ) : (
              <ul className="divide-y divide-ink-200/70">
                {view.responses.slice(0, 6).map((doc) => {
                  const parent = view.mine.find((row) => row.id === doc.caseId)
                  return (
                    <li key={doc.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{doc.fileName}</p>
                        <p className="truncate text-xs text-ink-500">
                          {parent?.caseNumber ?? 'Case'} · version {doc.version}
                          {doc.isRedacted ? ` · ${doc.redactionCount} severances` : ''}
                        </p>
                      </div>
                      <Link
                        to={`/documents/${doc.id}`}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ink-200 px-2.5 py-1.5 text-xs font-medium text-ink-700 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        Download
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="What the statuses mean" icon={<Info className="h-4 w-4" />} />
          <CardBody>
            <dl className="space-y-3">
              {EXPLAINER.map((item) => (
                <div key={item.status} className="space-y-1">
                  <dt>
                    <StatusBadge status={item.status} size="sm" />
                  </dt>
                  <dd className="text-xs leading-relaxed text-ink-600">{item.text}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card className="border-brand-200 bg-brand-50/60">
        <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <Scale className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden />
          <div className="space-y-1 text-sm text-ink-700">
            <p className="font-semibold text-ink-900">Your rights under the Freedom of Information Act 2011</p>
            <p className="leading-relaxed">
              HYPREP must respond to your request within {STATUTORY_RESPONSE_DAYS} days of receipt. The period may be
              extended once by a further {STATUTORY_RESPONSE_DAYS} days where the records are voluminous or a
              consultation is required — you will be notified in writing if that happens. If access is refused, or the
              deadline passes without a determination, you may apply to the Federal High Court for a judicial review
              under section 20 of the Act.
            </p>
            <p className="text-xs text-ink-500">All times shown are West Africa Time (Africa/Lagos).</p>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

const EXPLAINER: Array<{ status: CaseStatus; text: string }> = [
  { status: 'filed', text: 'Received and acknowledged. Awaiting triage by the Legal Unit.' },
  { status: 'in_review', text: 'An officer is locating the records and assessing any exemptions.' },
  { status: 'pending_info', text: 'We need a clarification from you before we can continue.' },
  { status: 'responded', text: 'A determination has been issued to you with any releasable records.' },
  { status: 'rejected', text: 'Access was refused. The grounds are stated in the response letter.' },
  { status: 'closed', text: 'The request is concluded and the file is archived.' },
]
