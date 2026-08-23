import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  CheckCheck,
  ClipboardCheck,
  Inbox,
  ListFilter,
  UserPlus,
} from 'lucide-react'
import type { FoiCase } from '@/types'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  PriorityBadge,
  SearchInput,
  SkeletonTable,
  SlaBadge,
  StatCard,
  StatusBadge,
  Tabs,
  Tooltip,
  UserChip,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { assignCase, changeCaseStatus, selectCases } from '@/mocks/api'
import { db, usersById } from '@/mocks/db'
import { CONCLUDED_STATUSES } from '@/lib/constants'
import { computeSla } from '@/lib/sla'
import { formatDate, formatRelative } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type QueueTab = 'triage' | 'mine' | 'approval' | 'overdue'

/**
 * FR-030: the Legal Unit review queue. Four working buckets, each with the one
 * action that moves the case forward, so triage never needs the full register.
 */
export function ReviewQueuePage() {
  const { user } = useAuth()
  const { version, refresh, teamMemberIds } = useData()
  const toast = useToast()

  const [tab, setTab] = useState<QueueTab>('triage')
  const [term, setTerm] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const buckets = useMemo(() => {
    if (!user) return null
    const rows = selectCases(user, undefined, teamMemberIds)
    const live = rows.filter((row) => !CONCLUDED_STATUSES.includes(row.status))

    return {
      triage: live.filter((row) => row.status === 'filed' || !row.assignedTo),
      mine: live.filter((row) => row.assignedTo === user.id && row.status !== 'filed'),
      approval: live.filter(
        (row) =>
          row.status === 'responded' ||
          db.documents.some((doc) => doc.caseId === row.id && doc.kind === 'response' && !doc.isPublic),
      ),
      overdue: live.filter((row) => {
        const state = computeSla(row).state
        return state === 'overdue' || state === 'due_soon'
      }),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, version, teamMemberIds])

  const rows = useMemo(() => {
    if (!buckets) return []
    const needle = term.trim().toLowerCase()
    const list = buckets[tab]
    const filtered = needle
      ? list.filter(
          (row) =>
            row.caseNumber.toLowerCase().includes(needle) ||
            row.subject.toLowerCase().includes(needle) ||
            row.requestor.name.toLowerCase().includes(needle),
        )
      : list
    return [...filtered].sort((a, b) => {
      const aSla = computeSla(a).daysRemaining
      const bSla = computeSla(b).daysRemaining
      return aSla - bSla
    })
  }, [buckets, tab, term])

  const tabs: Array<TabItem<QueueTab>> = [
    { key: 'triage', label: 'Awaiting triage', count: buckets?.triage.length ?? 0, icon: <Inbox className="h-4 w-4" /> },
    { key: 'mine', label: 'My reviews', count: buckets?.mine.length ?? 0, icon: <ClipboardCheck className="h-4 w-4" /> },
    { key: 'approval', label: 'Awaiting approval', count: buckets?.approval.length ?? 0, icon: <CheckCheck className="h-4 w-4" /> },
    { key: 'overdue', label: 'At risk', count: buckets?.overdue.length ?? 0, icon: <AlarmClock className="h-4 w-4" /> },
  ]

  const claim = async (row: FoiCase) => {
    if (!user) return
    setBusyId(row.id)
    try {
      await assignCase(row.id, user.id, user.id)
      if (row.status === 'filed') await changeCaseStatus(row.id, 'in_review', user.id, 'Claimed from the triage queue.')
      refresh()
      toast.success(`${row.caseNumber} assigned to you`, 'The case now sits in My reviews.')
    } finally {
      setBusyId(null)
    }
  }

  const advance = async (row: FoiCase) => {
    if (!user) return
    setBusyId(row.id)
    try {
      const next = row.status === 'filed' ? 'in_review' : 'responded'
      await changeCaseStatus(row.id, next, user.id, 'Advanced from the review queue.')
      refresh()
      toast.success(`${row.caseNumber} moved on`, `Status is now ${next.replace('_', ' ')}.`)
    } finally {
      setBusyId(null)
    }
  }

  const EMPTY: Record<QueueTab, { title: string; description: string }> = {
    triage: {
      title: 'Nothing awaiting triage',
      description: 'Every new request has been assigned. New filings appear here within moments of submission.',
    },
    mine: {
      title: 'No open reviews assigned to you',
      description: 'Claim a case from the triage bucket to start work.',
    },
    approval: {
      title: 'No responses awaiting approval',
      description: 'Draft responses appear here once a response document has been uploaded.',
    },
    overdue: {
      title: 'Nothing at risk',
      description: 'No case in your scope is overdue or inside the final two days of the statutory window.',
    },
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Review queue"
        description="Triage, review and approval work for the Legal Unit, ordered by how little statutory time is left."
        tabs={<Tabs tabs={tabs} active={tab} onChange={setTab} label="Queue buckets" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Awaiting triage"
          value={buckets?.triage.length ?? 0}
          hint="Filed or unassigned"
          icon={<Inbox className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard
          label="My open reviews"
          value={buckets?.mine.length ?? 0}
          hint="Assigned to you"
          icon={<ClipboardCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Awaiting approval"
          value={buckets?.approval.length ?? 0}
          hint="Draft response on file"
          icon={<CheckCheck className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Overdue or due soon"
          value={buckets?.overdue.length ?? 0}
          hint="Statutory clock at risk"
          icon={<AlarmClock className="h-5 w-5" />}
          tone="danger"
        />
      </div>

      <Card>
        <CardHeader
          title={tabs.find((item) => item.key === tab)?.label}
          description={`${rows.length} case${rows.length === 1 ? '' : 's'} in this bucket.`}
          actions={
            <SearchInput
              value={term}
              onChange={setTerm}
              placeholder="Case number, subject or requestor"
              className="w-full sm:w-72"
            />
          }
        />
        <CardBody className="p-0">
          {!buckets ? (
            <SkeletonTable rows={5} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<ListFilter className="h-6 w-6" />}
              title={EMPTY[tab].title}
              description={EMPTY[tab].description}
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {rows.map((row) => {
                const sla = computeSla(row)
                const assignee = row.assignedTo ? usersById.get(row.assignedTo) : undefined
                return (
                  <li key={row.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to={`/cases/${row.id}`}
                          className="font-mono text-xs font-semibold text-brand-700 hover:underline"
                        >
                          {row.caseNumber}
                        </Link>
                        <StatusBadge status={row.status} />
                        <PriorityBadge priority={row.priority} />
                        <SlaBadge sla={sla} />
                      </div>
                      <Link to={`/cases/${row.id}`} className="mt-1 block truncate text-sm font-medium text-ink-800 hover:underline">
                        {row.subject}
                      </Link>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {row.requestor.name} · {row.department} · due {formatDate(row.statutoryDueDate)} · updated{' '}
                        {formatRelative(row.updatedAt)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {assignee ? (
                        <UserChip user={assignee} />
                      ) : (
                        <span className="text-xs text-ink-500">Unassigned</span>
                      )}
                      {row.assignedTo !== user?.id ? (
                        <Tooltip content="Assign this case to yourself and open the review">
                          <Button
                            size="sm"
                            variant="outline"
                            isLoading={busyId === row.id}
                            onClick={() => claim(row)}
                            leadingIcon={<UserPlus className="h-3.5 w-3.5" />}
                          >
                            Claim
                          </Button>
                        </Tooltip>
                      ) : (
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={busyId === row.id}
                          onClick={() => advance(row)}
                        >
                          {row.status === 'filed' ? 'Start review' : 'Mark responded'}
                        </Button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
