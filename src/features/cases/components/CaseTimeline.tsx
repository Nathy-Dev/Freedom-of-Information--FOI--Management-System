import { Link } from 'react-router-dom'
import type { TimelineEvent } from '@/types'
import { EmptyState } from '@/components/ui'
import { NavIcon } from '@/components/layout'
import { TIMELINE_META } from '@/lib/constants'
import { formatDateTime, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { db, userName } from '@/mocks/db'

/**
 * FR-021: the case timeline. Rendered from derived events so it can never
 * disagree with the documents, notes and hearings on the file.
 */
export function CaseTimeline({
  events,
  showCase = false,
  limit,
  className,
}: {
  events: TimelineEvent[]
  /** Dashboards show which case each event belongs to; the case page does not. */
  showCase?: boolean
  limit?: number
  className?: string
}) {
  const rows = limit ? events.slice(0, limit) : events

  if (rows.length === 0) {
    return (
      <EmptyState
        compact
        title="No activity yet"
        description="Events appear here as the request is acknowledged, assigned, answered and closed."
      />
    )
  }

  return (
    <ol className={cn('relative space-y-0', className)}>
      {rows.map((event, index) => {
        const meta = TIMELINE_META[event.kind]
        const parent = showCase ? db.cases.find((row) => row.id === event.caseId) : undefined
        const isLast = index === rows.length - 1

        return (
          <li key={event.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {!isLast ? (
              <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] w-px bg-ink-200" />
            ) : null}

            <span
              className={cn(
                'relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ring-4 ring-white',
                meta.dot,
              )}
            >
              <NavIcon name={meta.icon} className="h-4 w-4" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-medium text-ink-900">{event.summary}</p>
                <time
                  dateTime={event.at}
                  title={formatDateTime(event.at)}
                  className="shrink-0 text-[11px] text-ink-400"
                >
                  {formatRelative(event.at)}
                </time>
              </div>

              <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-500">
                <span className="font-medium text-ink-600">
                  {event.actorId === 'system' ? 'System' : userName(event.actorId)}
                </span>
                <span aria-hidden>·</span>
                <span>{meta.label}</span>
                {parent ? (
                  <>
                    <span aria-hidden>·</span>
                    <Link
                      to={`/cases/${parent.id}`}
                      className="font-mono text-[11px] text-brand-700 hover:underline"
                    >
                      {parent.caseNumber}
                    </Link>
                  </>
                ) : null}
              </p>

              {event.detail ? (
                <p className="mt-1.5 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-600">
                  {event.detail}
                </p>
              ) : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
