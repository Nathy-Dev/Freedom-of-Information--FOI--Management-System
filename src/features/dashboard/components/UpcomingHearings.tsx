import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react'
import type { CourtDate } from '@/types'
import { Badge, Card, CardBody, CardHeader, EmptyState } from '@/components/ui'
import { HEARING_TYPE_LABELS } from '@/lib/constants'
import { formatClock, formatSmartDate } from '@/lib/format'
import { db } from '@/mocks/db'

/** Next sittings, newest first — FR-041 hearing awareness on the dashboard. */
export function UpcomingHearings({ hearings, limit = 5 }: { hearings: CourtDate[]; limit?: number }) {
  const rows = hearings.slice(0, limit)

  return (
    <Card>
      <CardHeader
        title="Upcoming court dates"
        description="Scheduled sittings for matters arising from FOI determinations."
        icon={<CalendarDays aria-hidden className="h-4.5 w-4.5 text-brand-600" />}
        actions={
          <Link
            to="/court"
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
          >
            Calendar
            <ArrowRight aria-hidden className="h-3.5 w-3.5" />
          </Link>
        }
      />
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState
              compact
              title="No sittings listed"
              description="Nothing is currently before the court for the matters you can see."
            />
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((sitting) => {
              const parent = db.cases.find((row) => row.id === sitting.caseId)
              return (
                <li key={sitting.id}>
                  <Link
                    to={`/court/${sitting.id}`}
                    className="flex gap-3 px-4 py-3 transition hover:bg-brand-50/50 focus-visible:outline-none"
                  >
                    <div className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-brand-50 py-1.5 text-brand-800 ring-1 ring-brand-100">
                      <span className="text-[10px] font-semibold uppercase tracking-wide">
                        {formatSmartDate(sitting.date).split(' ')[0]}
                      </span>
                      <span className="text-base font-semibold leading-tight">
                        {new Date(sitting.date).getDate()}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2">
                        <Badge tone="info">{HEARING_TYPE_LABELS[sitting.hearingType]}</Badge>
                        <span className="font-mono text-[11px] text-ink-500">{sitting.suitNumber}</span>
                      </p>
                      <p className="mt-1 truncate text-sm font-medium text-ink-900">
                        {parent?.subject ?? 'Case file'}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-500">
                        <MapPin aria-hidden className="h-3 w-3 shrink-0" />
                        {formatClock(sitting.time)} · {sitting.courtName}
                      </p>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
