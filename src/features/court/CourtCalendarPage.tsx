import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Download, Gavel, MapPin } from 'lucide-react'
import type { CourtDate } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CourtStatusBadge,
  EmptyState,
  Select,
  StatCard,
  Tabs,
} from '@/components/ui'
import type { SelectOption, TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { HearingDrawer } from './components/HearingDrawer'
import { db, reference } from '@/mocks/db'
import { COURT_STATUS_META, HEARING_TYPE_LABELS } from '@/lib/constants'
import { formatClock, formatDate } from '@/lib/format'
import { cn, downloadTextFile, toCsv } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'

type CalendarView = 'month' | 'week' | 'day' | 'list'

const VIEWS: Array<TabItem<CalendarView>> = [
  { key: 'month', label: 'Month' },
  { key: 'week', label: 'Week' },
  { key: 'day', label: 'Day' },
  { key: 'list', label: 'List' },
]

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** FR-034/FR-035: the court diary. One dataset, four views, reminders per hearing. */
export function CourtCalendarPage() {
  const { user, can } = useAuth()
  const { version } = useData()

  const { hearingId } = useParams()
  const navigate = useNavigate()
  const deepLinked = hearingId ? (db.courtDates.find((date) => date.id === hearingId) ?? null) : null

  const [view, setView] = useState<CalendarView>('month')
  // A deep link lands the diary on the month that actually holds the hearing.
  const [cursor, setCursor] = useState(() => (deepLinked ? new Date(deepLinked.date) : new Date()))
  const [courtFilter, setCourtFilter] = useState('')
  const [counselFilter, setCounselFilter] = useState('')
  const [selected, setSelected] = useState<CourtDate | null>(deepLinked)

  /** Closing the drawer drops the deep-link segment so the URL stays honest. */
  function closeHearing() {
    setSelected(null)
    if (hearingId) navigate('/court', { replace: true })
  }

  const hearings = useMemo(() => {
    let rows = [...db.courtDates]
    if (courtFilter) rows = rows.filter((row) => row.courtId === courtFilter)
    if (counselFilter) rows = rows.filter((row) => row.counselIds.includes(counselFilter))
    return rows.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courtFilter, counselFilter, version])

  const byDate = useMemo(() => {
    const map = new Map<string, CourtDate[]>()
    hearings.forEach((row) => {
      const list = map.get(row.date) ?? []
      list.push(row)
      map.set(row.date, list)
    })
    return map
  }, [hearings])

  const monthDays = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 })
    const days: Date[] = []
    for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) days.push(day)
    return days
  }, [cursor])

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, index) => addDays(start, index))
  }, [cursor])

  const stats = useMemo(() => {
    const today = new Date()
    const upcoming = hearings.filter((row) => parseISO(row.date) >= today && row.status === 'scheduled')
    const thisWeek = upcoming.filter((row) => parseISO(row.date) <= addDays(today, 7))
    const awaitingOutcome = hearings.filter(
      (row) => parseISO(row.date) < today && row.status === 'scheduled',
    )
    const actionsDue = hearings.filter((row) => row.nextActionDue && parseISO(row.nextActionDue) >= today)
    return { upcoming, thisWeek, awaitingOutcome, actionsDue }
  }, [hearings])

  const courtOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'All courts' },
      ...reference.courts.map((court) => ({ value: court.id, label: `${court.name}, ${court.division}` })),
    ],
    [],
  )

  const counselOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'All counsel' },
      ...reference.assignableStaff.map((staff) => ({ value: staff.id, label: staff.name })),
    ],
    [],
  )

  const step = (direction: -1 | 1) => {
    if (view === 'month') setCursor((current) => addMonths(current, direction))
    else if (view === 'week') setCursor((current) => addDays(current, direction * 7))
    else setCursor((current) => addDays(current, direction))
  }

  const rangeLabel =
    view === 'month'
      ? format(cursor, 'MMMM yyyy')
      : view === 'week'
        ? `${format(weekDays[0]!, 'd MMM')} – ${format(weekDays[6]!, 'd MMM yyyy')}`
        : view === 'day'
          ? format(cursor, 'EEEE, d MMMM yyyy')
          : 'All listed hearings'

  const exportDiary = () => {
    const csv = toCsv(
      ['Date', 'Time', 'Suit number', 'Court', 'Judge', 'Hearing type', 'Status', 'Case number'],
      hearings.map((row) => [
        row.date,
        row.time,
        row.suitNumber,
        row.courtName,
        row.judge,
        HEARING_TYPE_LABELS[row.hearingType],
        COURT_STATUS_META[row.status].label,
        db.cases.find((item) => item.id === row.caseId)?.caseNumber ?? '',
      ]),
    )
    downloadTextFile(`hyprep-court-diary-${format(new Date(), 'yyyy-MM-dd')}.csv`, csv)
  }

  const renderChip = (row: CourtDate, dense = false) => (
    <button
      key={row.id}
      type="button"
      onClick={() => setSelected(row)}
      className={cn(
        'w-full truncate rounded-md px-1.5 py-1 text-left text-[11px] font-medium ring-1 ring-inset transition-colors',
        row.status === 'scheduled'
          ? 'bg-brand-50 text-brand-800 ring-brand-200 hover:bg-brand-100'
          : row.status === 'adjourned'
            ? 'bg-gold-50 text-gold-800 ring-gold-200 hover:bg-gold-100'
            : row.status === 'cancelled'
              ? 'bg-ink-50 text-ink-500 ring-ink-200 line-through hover:bg-ink-100'
              : 'bg-ink-50 text-ink-700 ring-ink-200 hover:bg-ink-100',
      )}
    >
      {formatClock(row.time)} · {dense ? row.suitNumber : HEARING_TYPE_LABELS[row.hearingType]}
    </button>
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Court calendar"
        description="Hearings, mentions and judgments in FOI matters. Reminders fire from each hearing's lead days."
        actions={
          <>
            <Button variant="outline" onClick={exportDiary} leadingIcon={<Download className="h-4 w-4" />}>
              Export diary
            </Button>
            {can('court:write') ? (
              <Button
                variant="primary"
                onClick={() => setCursor(new Date())}
                leadingIcon={<CalendarPlus className="h-4 w-4" />}
              >
                Today
              </Button>
            ) : null}
          </>
        }
        tabs={<Tabs tabs={VIEWS} active={view} onChange={setView} label="Calendar views" />}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Upcoming hearings"
          value={stats.upcoming.length}
          hint="Scheduled from today"
          icon={<Gavel className="h-5 w-5" />}
          tone="brand"
        />
        <StatCard label="Next seven days" value={stats.thisWeek.length} hint="Listed this week" icon={<CalendarDays className="h-5 w-5" />} />
        <StatCard
          label="Awaiting outcome"
          value={stats.awaitingOutcome.length}
          hint="Past dates not yet recorded"
          icon={<Gavel className="h-5 w-5" />}
          tone="warning"
        />
        <StatCard
          label="Directions due"
          value={stats.actionsDue.length}
          hint="Filing deadlines from adjournments"
          icon={<CalendarDays className="h-5 w-5" />}
          tone="info"
        />
      </div>

      <Card>
        <CardHeader
          title={rangeLabel}
          description={`${hearings.length} hearing${hearings.length === 1 ? '' : 's'} in view.`}
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={courtFilter}
                options={courtOptions}
                onChange={(event) => setCourtFilter(event.target.value)}
                className="w-full sm:w-56"
              />
              <Select
                value={counselFilter}
                options={counselOptions}
                onChange={(event) => setCounselFilter(event.target.value)}
                className="w-full sm:w-44"
              />
              {view !== 'list' ? (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => step(-1)} aria-label="Previous period">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCursor(new Date())}>
                    Today
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => step(1)} aria-label="Next period">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              ) : null}
            </div>
          }
        />

        {view === 'month' ? (
          <CardBody className="p-0">
            <div className="grid grid-cols-7 border-b border-ink-100 bg-ink-50/60">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {monthDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const rows = byDate.get(key) ?? []
                return (
                  <div
                    key={key}
                    className={cn(
                      'min-h-[104px] space-y-1 border-b border-r border-ink-100 p-1.5',
                      !isSameMonth(day, cursor) && 'bg-ink-50/40',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setCursor(day)
                        setView('day')
                      }}
                      className={cn(
                        'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                        isToday(day)
                          ? 'bg-brand-600 text-white'
                          : isSameMonth(day, cursor)
                            ? 'text-ink-700 hover:bg-ink-100'
                            : 'text-ink-400',
                      )}
                    >
                      {format(day, 'd')}
                    </button>
                    {rows.slice(0, 3).map((row) => renderChip(row, true))}
                    {rows.length > 3 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCursor(day)
                          setView('day')
                        }}
                        className="px-1.5 text-[11px] font-medium text-brand-700 hover:underline"
                      >
                        +{rows.length - 3} more
                      </button>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </CardBody>
        ) : null}

        {view === 'week' ? (
          <CardBody className="p-0">
            <div className="grid grid-cols-1 sm:grid-cols-7">
              {weekDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const rows = byDate.get(key) ?? []
                return (
                  <div key={key} className="min-h-[220px] space-y-1.5 border-b border-r border-ink-100 p-2">
                    <p className={cn('text-xs font-semibold', isToday(day) ? 'text-brand-700' : 'text-ink-600')}>
                      {format(day, 'EEE d MMM')}
                    </p>
                    {rows.length === 0 ? (
                      <p className="text-[11px] text-ink-400">No sittings</p>
                    ) : (
                      rows.map((row) => renderChip(row, true))
                    )}
                  </div>
                )
              })}
            </div>
          </CardBody>
        ) : null}

        {view === 'day' || view === 'list' ? (
          <CardBody className="p-0">
            {(() => {
              const rows =
                view === 'day' ? hearings.filter((row) => isSameDay(parseISO(row.date), cursor)) : hearings
              if (rows.length === 0) {
                return (
                  <EmptyState
                    icon={<Gavel className="h-6 w-6" />}
                    title={view === 'day' ? 'No sittings on this date' : 'No hearings match these filters'}
                    description={
                      view === 'day'
                        ? 'Use the arrows to move to another date, or switch to the month view.'
                        : 'Clear the court or counsel filter to see the full diary.'
                    }
                  />
                )
              }
              return (
                <ul className="divide-y divide-ink-100">
                  {rows.map((row) => {
                    const foiCase = db.cases.find((item) => item.id === row.caseId)
                    return (
                      <li key={row.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                        <div className="w-24 shrink-0">
                          <p className="text-sm font-semibold text-ink-900">{formatClock(row.time)}</p>
                          <p className="text-xs text-ink-500">{formatDate(row.date)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-semibold text-ink-700">{row.suitNumber}</span>
                            <Badge tone="neutral">{HEARING_TYPE_LABELS[row.hearingType]}</Badge>
                            <CourtStatusBadge status={row.status} />
                          </div>
                          <p className="mt-1 truncate text-sm font-medium text-ink-800">{row.courtName}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-500">
                            <MapPin className="h-3 w-3" />
                            {row.location} · {row.judge}
                          </p>
                          {foiCase ? (
                            <Link
                              to={`/cases/${foiCase.id}?tab=court`}
                              className="mt-1 inline-block truncate text-xs font-medium text-brand-700 hover:underline"
                            >
                              {foiCase.caseNumber} — {foiCase.subject}
                            </Link>
                          ) : null}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSelected(row)}>
                          Open
                        </Button>
                      </li>
                    )
                  })}
                </ul>
              )
            })()}
          </CardBody>
        ) : null}
      </Card>

      <HearingDrawer
        hearing={selected}
        onClose={closeHearing}
        canRecord={Boolean(user) && can('court:outcome')}
      />
    </div>
  )
}
