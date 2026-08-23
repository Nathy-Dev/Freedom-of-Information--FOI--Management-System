import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, FilePlus2, Filter, Inbox } from 'lucide-react'
import type { CaseFilters, CaseStatus, SavedView } from '@/types'
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  EmptyState,
  Input,
  Modal,
  Pagination,
  SearchInput,
  SkeletonTable,
  Tabs,
  Toggle,
} from '@/components/ui'
import type { SortDirection, TabItem } from '@/components/ui'
import { PageHeader, WriteOnly } from '@/components/common'
import { CaseFilterPanel } from './components/CaseFilterPanel'
import { CaseTable } from './components/CaseTable'
import type { CaseSortKey } from './components/CaseTable'
import { SavedViewBar } from './components/SavedViewBar'
import { BulkActionBar } from './components/BulkActionBar'
import { bulkAddTags, bulkUpdateCases, listCases, selectCases } from '@/mocks/api'
import { deleteView, saveView } from '@/mocks/adminApi'
import { db } from '@/mocks/db'
import { CONCLUDED_STATUSES, STATUS_META } from '@/lib/constants'
import { computeSla } from '@/lib/sla'
import { formatDate } from '@/lib/format'
import { downloadTextFile, toCsv } from '@/lib/utils'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type ListTab = 'all' | 'filed' | 'pending' | 'concluded'

const TAB_STATUSES: Record<ListTab, CaseStatus[] | undefined> = {
  all: undefined,
  filed: ['filed'],
  pending: ['in_review', 'pending_info', 'escalated', 'appeal'],
  concluded: [...CONCLUDED_STATUSES],
}

/** FR-020: the case register — tabs, filters, saved views and bulk actions. */
export function CaseListPage() {
  const { user, can, isReadOnly } = useAuth()
  const { version, refresh, views, teamMemberIds } = useData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const [tab, setTab] = useState<ListTab>(() => (params.get('tab') as ListTab | null) ?? 'all')
  const [term, setTerm] = useState(() => params.get('q') ?? '')
  const [filters, setFilters] = useState<CaseFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [activeViewId, setActiveViewId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<CaseSortKey>('dateSubmitted')
  const [sortDir, setSortDir] = useState<SortDirection>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [viewName, setViewName] = useState('')
  const [shareView, setShareView] = useState(true)

  const debouncedTerm = useDebounced(term, 280)

  // The tab is a coarse status facet; explicit status filters win over it.
  const effective = useMemo<CaseFilters>(() => {
    const base: CaseFilters = { ...filters }
    if (debouncedTerm.trim()) base.q = debouncedTerm.trim()
    if (!base.statuses?.length) {
      const tabStatuses = TAB_STATUSES[tab]
      if (tabStatuses) base.statuses = tabStatuses
    }
    return base
  }, [filters, debouncedTerm, tab])

  const query = useAsync(
    () =>
      listCases({
        actor: user!,
        teamMemberIds,
        filters: effective,
        page,
        pageSize,
        sortBy: sortBy === 'dueDate' ? 'dueDate' : sortBy,
        sortDir,
      }),
    [user?.id, teamMemberIds.join(','), JSON.stringify(effective), page, pageSize, sortBy, sortDir, version],
  )

  // Tab counts come from the unpaginated selector so they survive pagination.
  const counts = useMemo(() => {
    if (!user) return { all: 0, filed: 0, pending: 0, concluded: 0 }
    const scoped = selectCases(user, undefined, teamMemberIds)
    const inTab = (statuses: CaseStatus[] | undefined) =>
      statuses ? scoped.filter((row) => statuses.includes(row.status)).length : scoped.length
    return {
      all: scoped.length,
      filed: inTab(TAB_STATUSES.filed),
      pending: inTab(TAB_STATUSES.pending),
      concluded: inTab(TAB_STATUSES.concluded),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, teamMemberIds, version])

  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [tab, debouncedTerm, JSON.stringify(filters), pageSize])

  useEffect(() => {
    const next = new URLSearchParams(params)
    if (tab === 'all') next.delete('tab')
    else next.set('tab', tab)
    if (debouncedTerm.trim()) next.set('q', debouncedTerm.trim())
    else next.delete('q')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, debouncedTerm])

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0

  const toggleRow = useCallback((id: string) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected((current) => {
      const allOnPage = rows.every((row) => current.has(row.id))
      const next = new Set(current)
      rows.forEach((row) => (allOnPage ? next.delete(row.id) : next.add(row.id)))
      return next
    })
  }, [rows])

  const onSort = (key: CaseSortKey) => {
    if (key === sortBy) setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(key)
      setSortDir(key === 'subject' || key === 'caseNumber' ? 'asc' : 'desc')
    }
  }

  const applyView = (view: SavedView) => {
    setFilters(view.filters)
    setActiveViewId(view.id)
    setTab('all')
    toast.info('View applied', view.name)
  }

  const changeFilters = (next: CaseFilters) => {
    setFilters(next)
    setActiveViewId(null)
  }

  const exportRows = () => {
    const source = selected.size
      ? selectCases(user!, undefined, teamMemberIds).filter((row) => selected.has(row.id))
      : selectCases(user!, effective, teamMemberIds)
    const csv = toCsv(
      ['Case number', 'Subject', 'Requestor', 'Department', 'Status', 'Priority', 'Submitted', 'Statutory due', 'Clock'],
      source.map((row) => [
        row.caseNumber,
        row.subject,
        row.requestor.name,
        row.department,
        STATUS_META[row.status].label,
        row.priority,
        formatDate(row.dateSubmitted),
        formatDate(row.statutoryDueDate),
        computeSla(row).label,
      ]),
    )
    downloadTextFile(`hyprep-foi-cases-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv')
    toast.success('Export ready', `${source.length} rows written to CSV.`)
  }

  const runBulk = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true)
    try {
      await action()
      refresh()
      toast.success('Bulk action applied', message)
      setSelected(new Set())
    } finally {
      setBusy(false)
    }
  }

  const persistView = async () => {
    if (!user || !viewName.trim()) return
    setBusy(true)
    try {
      await saveView(
        {
          id: '',
          name: viewName.trim(),
          ownerId: user.id,
          isShared: shareView,
          filters: effective,
          createdAt: new Date().toISOString(),
        },
        user.id,
      )
      refresh()
      toast.success('View saved', `"${viewName.trim()}" is now available on this page.`)
      setViewName('')
      setSaveOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const removeView = async (view: SavedView) => {
    if (!user) return
    await deleteView(view.id, user.id)
    if (activeViewId === view.id) setActiveViewId(null)
    refresh()
    toast.info('View deleted', view.name)
  }

  if (!user) return null

  const canBulk = can('case:bulk') && !isReadOnly
  const tabs: TabItem<ListTab>[] = [
    { key: 'all', label: 'All cases', count: counts.all },
    { key: 'filed', label: 'Filed', count: counts.filed },
    { key: 'pending', label: 'Pending', count: counts.pending },
    { key: 'concluded', label: 'Concluded', count: counts.concluded },
  ]

  return (
    <div className="space-y-5">
      <PageHeader
        title="Case register"
        description="Every Freedom of Information request on file, with its statutory clock and current owner."
        breadcrumbs={[{ label: 'Cases' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={exportRows}
              leadingIcon={<Download className="h-4 w-4" />}
            >
              Export
            </Button>
            <WriteOnly>
              <ButtonLink to="/cases/new" leadingIcon={<FilePlus2 className="h-4 w-4" />}>
                New FOI case
              </ButtonLink>
            </WriteOnly>
          </div>
        }
        tabs={<Tabs tabs={tabs} active={tab} onChange={setTab} label="Case status tabs" />}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SearchInput
          value={term}
          onChange={setTerm}
          label="Search cases"
          placeholder="Search case number, subject, requestor or tag"
          className="w-full sm:max-w-md"
        />
        <Button
          variant={showFilters ? 'secondary' : 'outline'}
          onClick={() => setShowFilters((open) => !open)}
          leadingIcon={<Filter className="h-4 w-4" />}
          aria-expanded={showFilters}
        >
          {showFilters ? 'Hide filters' : 'Advanced filters'}
        </Button>
        <span className="ml-auto text-xs text-ink-500">
          {query.isLoading ? 'Loading…' : `${total} ${total === 1 ? 'case' : 'cases'} match`}
        </span>
      </div>

      <SavedViewBar
        views={views}
        activeViewId={activeViewId}
        filters={effective}
        currentUserId={user.id}
        onApply={applyView}
        onSave={() => setSaveOpen(true)}
        onDelete={isReadOnly ? undefined : removeView}
        onClearFilter={(patch) => changeFilters({ ...filters, ...patch })}
        canSave={!isReadOnly}
      />

      {showFilters ? (
        <CaseFilterPanel
          filters={filters}
          onChange={changeFilters}
          onReset={() => {
            setFilters({})
            setActiveViewId(null)
          }}
        />
      ) : null}

      <Card>
        <CardBody className="p-0">
          {query.isLoading && rows.length === 0 ? (
            <div className="p-5">
              <SkeletonTable rows={8} />
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              className="py-14"
              icon={<Inbox className="h-6 w-6" />}
              title="No cases match these filters"
              description="Clear a filter or widen the date range. Saved views above jump straight to the common queues."
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilters({})
                    setTerm('')
                    setTab('all')
                    setActiveViewId(null)
                  }}
                >
                  Clear all filters
                </Button>
              }
            />
          ) : (
            <>
              <CaseTable
                rows={rows}
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={onSort}
                selectable={canBulk}
                selected={selected}
                onToggleRow={toggleRow}
                onToggleAll={toggleAll}
              />
              <div className="border-t border-ink-200/80 px-4 py-3">
                <Pagination
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                  label="cases"
                />
              </div>
            </>
          )}
        </CardBody>
      </Card>

      {canBulk && selected.size > 0 ? (
        <BulkActionBar
          count={selected.size}
          busy={busy}
          onClear={() => setSelected(new Set())}
          onExport={exportRows}
          onAssign={(assigneeId) =>
            runBulk(
              () => bulkUpdateCases([...selected], { assignedTo: assigneeId }, user.id),
              assigneeId ? 'Cases reassigned and the officer notified.' : 'Cases returned to the unassigned queue.',
            )
          }
          onStatus={(status) =>
            runBulk(
              () => bulkUpdateCases([...selected], { status }, user.id),
              `Status set to ${STATUS_META[status].label}.`,
            )
          }
          onTag={(tag) => runBulk(() => bulkAddTags([...selected], [tag], user.id), `Tag "${tag}" applied.`)}
        />
      ) : null}

      <Modal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        title="Save this view"
        description="The current tab, search term and filters are stored together so you can return to this queue in one click."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSaveOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={busy} disabled={!viewName.trim()} onClick={persistView}>
              Save view
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="View name"
            value={viewName}
            onChange={(event) => setViewName(event.target.value)}
            placeholder="e.g. Overdue procurement requests"
            autoFocus
          />
          <Toggle
            checked={shareView}
            onChange={setShareView}
            label="Share with the Legal Unit"
            description="Shared views appear for every colleague who can see this page."
          />
          <p className="text-xs text-ink-500">
            {db.views.length} views are currently stored in this prototype.
          </p>
        </div>
      </Modal>
    </div>
  )
}
