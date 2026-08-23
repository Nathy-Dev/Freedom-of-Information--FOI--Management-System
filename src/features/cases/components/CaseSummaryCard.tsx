import { Building2, CalendarClock, Mail, Phone, User2 } from 'lucide-react'
import type { FoiCase } from '@/types'
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  ConfidentialityBadge,
  Progress,
  UserChip,
} from '@/components/ui'
import { DescriptionList } from '@/components/common'
import { SOURCE_LABELS, RESPONSE_FORMAT_LABELS, STATUTORY_RESPONSE_DAYS } from '@/lib/constants'
import { computeSla } from '@/lib/sla'
import { formatDate, formatDateTime, formatRelative } from '@/lib/format'
import { usersById } from '@/mocks/db'

/** FR-021: the facts panel at the head of a case file. */
export function CaseSummaryCard({ foiCase }: { foiCase: FoiCase }) {
  const sla = computeSla(foiCase)
  const assignee = foiCase.assignedTo ? usersById.get(foiCase.assignedTo) : undefined

  return (
    <Card>
      <CardHeader
        title="Request details"
        description={`Received via ${SOURCE_LABELS[foiCase.source]} on ${formatDateTime(foiCase.dateSubmitted)}`}
        actions={<ConfidentialityBadge level={foiCase.confidentiality} />}
      />
      <CardBody className="space-y-5">
        <div className="rounded-lg border border-ink-200/80 bg-ink-50/60 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-600">
              <CalendarClock aria-hidden className="h-3.5 w-3.5" />
              Statutory clock
            </span>
            <span className="text-xs text-ink-600">
              Day {Math.min(sla.daysElapsed, sla.totalDays)} of {sla.totalDays} · due{' '}
              {formatDate(foiCase.statutoryDueDate)}
            </span>
          </div>
          <Progress
            className="mt-2.5"
            value={sla.percentElapsed}
            barClassName={
              sla.state === 'overdue'
                ? 'bg-crest-500'
                : sla.state === 'due_soon'
                  ? 'bg-gold-400'
                  : 'bg-brand-500'
            }
          />
          <p className="mt-2 text-xs text-ink-600">
            {sla.label}. The Act allows {STATUTORY_RESPONSE_DAYS} days, extendable once by a further{' '}
            {STATUTORY_RESPONSE_DAYS} days under section 6.
          </p>
        </div>

        <DescriptionList
          items={[
            {
              label: 'Requestor',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  <User2 aria-hidden className="h-3.5 w-3.5 text-ink-400" />
                  {foiCase.requestor.name}
                  {foiCase.requestor.isJournalist ? (
                    <Badge tone="warning" size="sm">
                      Journalist
                    </Badge>
                  ) : null}
                </span>
              ),
            },
            {
              label: 'Organisation',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  <Building2 aria-hidden className="h-3.5 w-3.5 text-ink-400" />
                  {foiCase.requestor.organization || '—'}
                </span>
              ),
            },
            {
              label: 'Email',
              value: (
                <a
                  href={`mailto:${foiCase.requestor.email}`}
                  className="inline-flex items-center gap-1.5 text-brand-700 hover:underline"
                >
                  <Mail aria-hidden className="h-3.5 w-3.5" />
                  {foiCase.requestor.email}
                </a>
              ),
            },
            {
              label: 'Telephone',
              value: (
                <span className="inline-flex items-center gap-1.5">
                  <Phone aria-hidden className="h-3.5 w-3.5 text-ink-400" />
                  {foiCase.requestor.phone || 'Not supplied'}
                </span>
              ),
            },
            { label: 'Responsible department', value: foiCase.department },
            {
              label: 'Assigned officer',
              value: assignee ? <UserChip user={assignee} /> : <span className="italic text-ink-400">Unassigned</span>,
            },
            { label: 'Preferred format', value: RESPONSE_FORMAT_LABELS[foiCase.responseFormat] },
            { label: 'Last activity', value: formatRelative(foiCase.updatedAt) },
            {
              label: 'Determination issued',
              value: foiCase.respondedAt ? formatDateTime(foiCase.respondedAt) : 'Not yet issued',
            },
            {
              label: 'Closed',
              value: foiCase.dateClosed
                ? `${formatDate(foiCase.dateClosed)}${foiCase.outcomeCode ? ` — ${foiCase.outcomeCode}` : ''}`
                : 'Open',
            },
            {
              label: 'Records requested',
              span: true,
              value: <p className="whitespace-pre-line leading-relaxed">{foiCase.description}</p>,
            },
          ]}
        />
      </CardBody>
    </Card>
  )
}
