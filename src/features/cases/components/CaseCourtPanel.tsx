import { useState } from 'react'
import { CalendarPlus, Gavel, MapPin, Scale } from 'lucide-react'
import type { CourtDate, CourtDateStatus, HearingType } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CourtStatusBadge,
  EmptyState,
  Input,
  Modal,
  Select,
  Textarea,
} from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { recordCourtOutcome, scheduleCourtDate } from '@/mocks/api'
import { reference, usersById } from '@/mocks/db'
import { HEARING_TYPE_LABELS } from '@/lib/constants'
import { formatClock, formatDate } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'

export interface CaseCourtPanelProps {
  caseId: string
  caseNumber: string
  courtDates: CourtDate[]
  onChanged: () => void
  readOnly?: boolean
}

const HEARING_OPTIONS: SelectOption[] = (
  ['mention', 'motion', 'hearing', 'judgment', 'adoption_of_address', 'pre_trial'] as HearingType[]
).map((type) => ({ value: type, label: HEARING_TYPE_LABELS[type] }))

const OUTCOME_STATUS: SelectOption[] = (
  ['held', 'adjourned', 'cancelled'] as CourtDateStatus[]
).map((status) => ({ value: status, label: status.charAt(0).toUpperCase() + status.slice(1) }))

function isoDaysAhead(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

/** FR-034 to FR-036: hearings attached to a case, and their outcomes. */
export function CaseCourtPanel({
  caseId,
  caseNumber,
  courtDates,
  onChanged,
  readOnly = false,
}: CaseCourtPanelProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [outcomeTarget, setOutcomeTarget] = useState<CourtDate | null>(null)
  const [busy, setBusy] = useState(false)

  const existingSuit = courtDates[0]?.suitNumber ?? ''
  const [suitNumber, setSuitNumber] = useState(existingSuit)
  const [courtId, setCourtId] = useState(reference.courts[0]?.id ?? '')
  const [hearingType, setHearingType] = useState<HearingType>('mention')
  const [date, setDate] = useState(isoDaysAhead(14))
  const [time, setTime] = useState('09:00')
  const [duration, setDuration] = useState('60')
  const [judge, setJudge] = useState('')
  const [counselId, setCounselId] = useState(reference.assignableStaff[0]?.id ?? '')
  const [notes, setNotes] = useState('')

  const [outcomeStatus, setOutcomeStatus] = useState<CourtDateStatus>('held')
  const [outcome, setOutcome] = useState('')
  const [nextAction, setNextAction] = useState('')

  const create = async () => {
    if (!user) return
    const court = reference.courts.find((item) => item.id === courtId)
    if (!court) return
    setBusy(true)
    try {
      await scheduleCourtDate(
        {
          caseId,
          suitNumber: suitNumber.trim() || `FHC/PH/CS/NEW/${new Date().getFullYear()}`,
          date,
          time,
          durationMinutes: Number(duration) || 60,
          courtId: court.id,
          courtName: `${court.name}, ${court.division}`,
          location: court.address,
          judge: judge.trim() || 'To be assigned',
          hearingType,
          counselIds: [counselId],
          notes: notes.trim(),
          nextActionDue: null,
          reminderLeadDays: [7, 2, 1],
        },
        user.id,
      )
      onChanged()
      toast.success('Hearing listed', `Reminders will issue 7, 2 and 1 day before ${formatDate(date)}.`)
      setNotes('')
      setScheduleOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const saveOutcome = async () => {
    if (!user || !outcomeTarget || !outcome.trim()) return
    setBusy(true)
    try {
      await recordCourtOutcome(
        outcomeTarget.id,
        { status: outcomeStatus, outcome: outcome.trim(), nextActionDue: nextAction || null },
        user.id,
      )
      onChanged()
      toast.success('Outcome recorded', `${outcomeTarget.suitNumber} updated on the case timeline.`)
      setOutcome('')
      setNextAction('')
      setOutcomeTarget(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Court dates"
          description={`Hearings and filings for ${caseNumber}`}
          icon={<Scale className="h-4 w-4" />}
          actions={
            readOnly ? null : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setScheduleOpen(true)}
                leadingIcon={<CalendarPlus className="h-3.5 w-3.5" />}
              >
                Schedule hearing
              </Button>
            )
          }
        />
        <CardBody>
          {courtDates.length === 0 ? (
            <EmptyState
              compact
              icon={<Scale className="h-5 w-5" />}
              title="No hearings listed"
              description="Schedule a hearing if this request proceeds to judicial review under section 20 of the Act."
            />
          ) : (
            <ol className="space-y-3">
              {courtDates.map((sitting) => {
                const upcoming = sitting.status === 'scheduled' && sitting.date >= new Date().toISOString().slice(0, 10)
                return (
                  <li
                    key={sitting.id}
                    className={
                      upcoming
                        ? 'rounded-lg border border-brand-200 bg-brand-50/50 p-3'
                        : 'rounded-lg border border-ink-200 bg-white p-3'
                    }
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-ink-900">
                            {HEARING_TYPE_LABELS[sitting.hearingType]}
                          </span>
                          <CourtStatusBadge status={sitting.status} size="sm" />
                          <Badge tone="neutral" size="sm">
                            {sitting.suitNumber}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-ink-600">
                          {formatDate(sitting.date)} at {formatClock(sitting.time)} · {sitting.durationMinutes} min ·
                          before {sitting.judge}
                        </p>
                        <p className="mt-0.5 inline-flex items-start gap-1 text-2xs text-ink-500">
                          <MapPin aria-hidden className="mt-0.5 h-3 w-3 shrink-0" />
                          {sitting.courtName} — {sitting.location}
                        </p>
                      </div>
                      {!readOnly && sitting.status === 'scheduled' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setOutcomeTarget(sitting)}
                          leadingIcon={<Gavel className="h-3.5 w-3.5" />}
                        >
                          Record outcome
                        </Button>
                      ) : null}
                    </div>
                    {sitting.notes ? (
                      <p className="mt-2 rounded-md bg-ink-50 p-2 text-2xs leading-relaxed text-ink-600">
                        {sitting.notes}
                      </p>
                    ) : null}
                    {sitting.outcome ? (
                      <p className="mt-2 border-l-2 border-brand-400 pl-2 text-xs leading-relaxed text-ink-700">
                        <span className="font-semibold">Outcome: </span>
                        {sitting.outcome}
                        {sitting.nextActionDue ? (
                          <span className="mt-0.5 block text-2xs text-ink-500">
                            Next action due {formatDate(sitting.nextActionDue)}
                          </span>
                        ) : null}
                      </p>
                    ) : null}
                    <p className="mt-2 text-2xs text-ink-400">
                      Counsel: {sitting.counselIds.map((id) => usersById.get(id)?.name ?? id).join(', ')}
                    </p>
                  </li>
                )
              })}
            </ol>
          )}
        </CardBody>
      </Card>

      <Modal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        title="Schedule a hearing"
        description="Counsel on record are notified and reminders are queued automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setScheduleOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={busy} onClick={create}>
              List hearing
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Suit number"
            value={suitNumber}
            onChange={(event) => setSuitNumber(event.target.value)}
            placeholder="FHC/PH/CS/123/2026"
          />
          <Select
            label="Hearing type"
            options={HEARING_OPTIONS}
            value={hearingType}
            onChange={(event) => setHearingType(event.target.value as HearingType)}
          />
          <Select
            label="Court"
            options={reference.courts.map((court) => ({
              value: court.id,
              label: `${court.name}, ${court.division}`,
            }))}
            value={courtId}
            onChange={(event) => setCourtId(event.target.value)}
          />
          <Input label="Presiding judge" value={judge} onChange={(event) => setJudge(event.target.value)} />
          <Input label="Date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <Input label="Time" type="time" value={time} onChange={(event) => setTime(event.target.value)} />
          <Input
            label="Duration (minutes)"
            type="number"
            min={15}
            step={15}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
          <Select
            label="Lead counsel"
            options={reference.assignableStaff.map((staff) => ({ value: staff.id, label: staff.name }))}
            value={counselId}
            onChange={(event) => setCounselId(event.target.value)}
          />
          <div className="sm:col-span-2">
            <Textarea
              label="Preparation notes"
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Exhibit bundle, certified true copies, travel approvals…"
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(outcomeTarget)}
        onClose={() => setOutcomeTarget(null)}
        title="Record hearing outcome"
        description={outcomeTarget ? `${outcomeTarget.suitNumber} — ${formatDate(outcomeTarget.date)}` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOutcomeTarget(null)}>
              Cancel
            </Button>
            <Button isLoading={busy} disabled={!outcome.trim()} onClick={saveOutcome}>
              Save outcome
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="What happened?"
            options={OUTCOME_STATUS}
            value={outcomeStatus}
            onChange={(event) => setOutcomeStatus(event.target.value as CourtDateStatus)}
          />
          <Textarea
            label="Outcome and directions"
            rows={4}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder="Record the ruling, any orders made and the directions given by the court."
          />
          <Input
            label="Next action due"
            type="date"
            value={nextAction}
            onChange={(event) => setNextAction(event.target.value)}
            hint="Leave blank if no further step is required."
          />
        </div>
      </Modal>
    </>
  )
}
