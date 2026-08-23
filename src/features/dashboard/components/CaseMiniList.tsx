import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import type { FoiCase } from '@/types'
import { Card, CardBody, CardHeader, EmptyState, PriorityBadge, SlaBadge, StatusBadge } from '@/components/ui'
import { computeSla } from '@/lib/sla'
import { formatRelative } from '@/lib/format'
import { userName } from '@/mocks/db'

/** Compact, colour-coded case list used across every role dashboard. */
export function CaseMiniList({
  title,
  description,
  cases,
  emptyMessage = 'Nothing here right now.',
  viewAllTo,
  showAssignee = true,
  limit = 6,
}: {
  title: string
  description?: string
  cases: FoiCase[]
  emptyMessage?: string
  viewAllTo?: string
  showAssignee?: boolean
  limit?: number
}) {
  const rows = cases.slice(0, limit)

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          viewAllTo ? (
            <Link
              to={viewAllTo}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
            >
              View all
              <ArrowRight aria-hidden className="h-3.5 w-3.5" />
            </Link>
          ) : undefined
        }
      />
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState compact title="Nothing to show" description={emptyMessage} />
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  to={`/cases/${row.id}`}
                  className="block px-4 py-3 transition hover:bg-brand-50/50 focus-visible:bg-brand-50/60 focus-visible:outline-none"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{row.subject}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">
                        <span className="font-mono text-[11px]">{row.caseNumber}</span>
                        <span aria-hidden>·</span>
                        <span>{formatRelative(row.dateSubmitted)}</span>
                        {showAssignee ? (
                          <>
                            <span aria-hidden>·</span>
                            <span>{row.assignedTo ? userName(row.assignedTo) : 'Unassigned'}</span>
                          </>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <StatusBadge status={row.status} />
                      <div className="flex items-center gap-1.5">
                        <PriorityBadge priority={row.priority} />
                        <SlaBadge sla={computeSla(row)} showLabel={false} />
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
