import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, Gavel, MapPin, Scale, Users } from 'lucide-react'
import type { CourtDate, CourtDateStatus } from '@/types'
import {
  Badge,
  Button,
  CourtStatusBadge,
  Drawer,
  Input,
  Select,
  Textarea,
} from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { DescriptionList } from '@/components/common'
import { recordCourtOutcome } from '@/mocks/api'
import { db, userName } from '@/mocks/db'
import { COURT_STATUS_META, HEARING_TYPE_LABELS } from '@/lib/constants'
import { formatClock, formatDate, formatDateTime } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

const OUTCOME_STATUS: SelectOption[] = (
  ['held', 'adjourned', 'cancelled'] as CourtDateStatus[]
).map((value) => ({ value, label: COURT_STATUS_META[value].label }))

export interface HearingDrawerProps {
  hearing: CourtDate | null
  onClose: () => void
  canRecord?: boolean
}

/** FR-036: record what the court did, and the direction it gave, against the hearing. */
export function HearingDrawer({ hearing, onClose, canRecord = false }: HearingDrawerProps) {
  const { user } = useAuth()
  const { refresh } = useData()
  const toast = useToast()

  const [status, setStatus] = useState<CourtDateStatus>('held')
  const [outcome, setOutcome] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!hearing) return
    setStatus(hearing.status === 'scheduled' ? 'held' : hearing.status)
    setOutcome(hearing.outcome ?? '')
    setNextAction(hearing.nextActionDue ?? '')
  }, [hearing])

  if (!hearing) return null

  const foiCase = db.cases.find((item) => item.id === hearing.caseId)
  const isPast = new Date(`${hearing.date}T23:59:59`) < new Date()

  const save = async () => {
    if (!user || !outcome.trim()) {
      toast.warning('Outcome required', 'Record what the court did before saving.')
      return
    }
    setBusy(true)
    try {
      await recordCourtOutcome(
        hearing.id,
        { status, outcome: outcome.trim(), nextActionDue: nextAction || null },
        user.id,
      )
      refresh()
      toast.success('Outcome recorded', `${hearing.suitNumber} updated to ${COURT_STATUS_META[status].label}.`)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Drawer
      open={Boolean(hearing)}
      onClose={onClose}
      width="lg"
      title={
        <span className="flex items-center gap-2">
          <Gavel className="h-4 w-4 text-brand-600" />
          {hearing.suitNumber}
        </span>
      }
      description={`${HEARING_TYPE_LABELS[hearing.hearingType]} · ${formatDate(hearing.date)} at ${formatClock(hearing.time)}`}
      footer={
        canRecord ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
            <Button onClick={save} isLoading={busy} leadingIcon={<Scale className="h-4 w-4" />}>
              Record outcome
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        )
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <CourtStatusBadge status={hearing.status} />
          <Badge tone="neutral">{HEARING_TYPE_LABELS[hearing.hearingType]}</Badge>
          {hearing.nextActionDue ? (
            <Badge tone="warning">Direction due {formatDate(hearing.nextActionDue)}</Badge>
          ) : null}
        </div>

        <DescriptionList
          columns={1}
          items={[
            { label: 'Court', value: hearing.courtName },
            {
              label: 'Location',
              value: (
                <span className="flex items-start gap-1.5">
                  <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  {hearing.location}
                </span>
              ),
            },
            { label: 'Presiding', value: hearing.judge },
            { label: 'Sitting time', value: `${formatClock(hearing.time)} · ${hearing.durationMinutes} minutes` },
            {
              label: 'Counsel',
              value: (
                <span className="flex items-start gap-1.5">
                  <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  {hearing.counselIds.map((id) => userName(id)).join(', ') || 'Not assigned'}
                </span>
              ),
            },
            {
              label: 'Reminders',
              value: (
                <span className="flex items-start gap-1.5">
                  <BellRing className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                  {hearing.reminderLeadDays.map((days) => `${days}d`).join(', ')} before the sitting
                </span>
              ),
            },
            {
              label: 'FOI case',
              value: foiCase ? (
                <Link to={`/cases/${foiCase.id}?tab=court`} className="font-medium text-brand-700 hover:underline">
                  {foiCase.caseNumber} — {foiCase.subject}
                </Link>
              ) : (
                '—'
              ),
            },
            { label: 'Listed on', value: formatDateTime(hearing.createdAt) },
          ]}
        />

        {hearing.notes ? (
          <div className="rounded-lg bg-ink-50 p-3 text-sm text-ink-600">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Preparation notes</p>
            {hearing.notes}
          </div>
        ) : null}

        {hearing.outcome ? (
          <div className="rounded-lg border-l-2 border-brand-400 bg-brand-50/50 p-3 text-sm text-ink-700">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">Recorded outcome</p>
            {hearing.outcome}
          </div>
        ) : null}

        {canRecord ? (
          <div className="space-y-3 rounded-lg border border-ink-200 p-4">
            <div>
              <p className="text-sm font-semibold text-ink-800">
                {hearing.outcome ? 'Amend the record' : 'Record the outcome'}
              </p>
              <p className="mt-0.5 text-xs text-ink-500">
                {isPast
                  ? 'This sitting has passed. Record what the court did so the matter leaves the outstanding list.'
                  : 'The sitting is still ahead. Outcomes are normally entered on the day.'}
              </p>
            </div>
            <Select
              label="Disposition"
              value={status}
              options={OUTCOME_STATUS}
              onChange={(event) => setStatus(event.target.value as CourtDateStatus)}
            />
            <Textarea
              label="What the court did"
              rows={4}
              maxLength={800}
              showCount
              placeholder="e.g. Motion for extension granted; respondent to file its counter-affidavit within 14 days."
              value={outcome}
              onChange={(event) => setOutcome(event.target.value)}
            />
            <Input
              label="Direction or filing due"
              type="date"
              hint="Leave blank if the court gave no timetable."
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </div>
        ) : null}
      </div>
    </Drawer>
  )
}
