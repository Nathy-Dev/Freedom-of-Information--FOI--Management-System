import { useState } from 'react'
import { AlertTriangle, Link2, Lock, Workflow } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { CaseFilters, CasePriority, CaseStatus, FoiCase } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  Modal,
  Select,
  Textarea,
} from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import {
  assignCase,
  changeCaseStatus,
  closeCase,
  linkCases,
  selectCases,
  unlinkCases,
  updateCase,
} from '@/mocks/api'
import { reference } from '@/mocks/db'
import { PRIORITY_META, STATUS_META } from '@/lib/constants'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'

export interface CaseActionsPanelProps {
  foiCase: FoiCase
  linked: FoiCase[]
  onChanged: () => void
}

const STATUS_OPTIONS: SelectOption[] = (
  ['filed', 'in_review', 'pending_info', 'responded', 'escalated', 'appeal', 'rejected', 'closed'] as CaseStatus[]
).map((status) => ({ value: status, label: STATUS_META[status].label }))

const PRIORITY_OPTIONS: SelectOption[] = (
  ['low', 'medium', 'high', 'critical'] as CasePriority[]
).map((priority) => ({ value: priority, label: PRIORITY_META[priority].label }))

/** FR-014, FR-016, FR-023 to FR-025: the caseworker's action rail. */
export function CaseActionsPanel({ foiCase, linked, onChanged }: CaseActionsPanelProps) {
  const { user, can, isReadOnly } = useAuth()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [closeOpen, setCloseOpen] = useState(false)
  const [linkOpen, setLinkOpen] = useState(false)
  const [escalateOpen, setEscalateOpen] = useState(false)

  const [outcomeCode, setOutcomeCode] = useState(reference.outcomeCodes[0]?.label ?? 'Granted in full')
  const [closureReason, setClosureReason] = useState(reference.closureReasons[0]?.label ?? '')
  const [closureNote, setClosureNote] = useState('')
  const [linkTarget, setLinkTarget] = useState('')

  if (!user) return null

  const run = async (action: () => Promise<unknown>, title: string, detail?: string) => {
    setBusy(true)
    try {
      await action()
      onChanged()
      toast.success(title, detail)
    } finally {
      setBusy(false)
    }
  }

  const candidates = selectCases(user, { q: '' } as CaseFilters)
    .filter((row) => row.id !== foiCase.id && !foiCase.linkedCaseIds.includes(row.id))
    .slice(0, 60)

  const canAssign = can('case:assign') && !isReadOnly
  const canUpdate = can('case:update') && !isReadOnly
  const canClose = can('case:close') && !isReadOnly
  const isConcluded = foiCase.status === 'closed' || foiCase.status === 'rejected'

  return (
    <>
      <Card>
        <CardHeader title="Case actions" icon={<Workflow className="h-4 w-4" />} />
        <CardBody className="space-y-4">
          <Select
            label="Assigned officer"
            disabled={!canAssign || busy}
            value={foiCase.assignedTo ?? ''}
            options={[
              { value: '', label: 'Unassigned' },
              ...reference.assignableStaff.map((staff) => ({ value: staff.id, label: staff.name })),
            ]}
            onChange={(event) =>
              run(
                () => assignCase(foiCase.id, event.target.value || null, user.id),
                event.target.value ? 'Case reassigned' : 'Assignment cleared',
                event.target.value ? 'The officer has been notified.' : undefined,
              )
            }
          />

          <Select
            label="Status"
            disabled={!canUpdate || busy}
            value={foiCase.status}
            options={STATUS_OPTIONS}
            hint="Changing the status notifies the requestor and writes to the timeline."
            onChange={(event) =>
              run(
                () => changeCaseStatus(foiCase.id, event.target.value as CaseStatus, user.id),
                'Status updated',
                `Now ${STATUS_META[event.target.value as CaseStatus].label}.`,
              )
            }
          />

          <Select
            label="Priority"
            disabled={!canUpdate || busy}
            value={foiCase.priority}
            options={PRIORITY_OPTIONS}
            onChange={(event) =>
              run(
                () =>
                  updateCase(
                    foiCase.id,
                    { priority: event.target.value as CasePriority },
                    user.id,
                    `Priority set to ${event.target.value}.`,
                  ),
                'Priority updated',
              )
            }
          />

          <div className="space-y-2 border-t border-ink-200/70 pt-4">
            {can('case:escalate') && !isReadOnly && !isConcluded ? (
              <Button
                fullWidth
                variant="outline"
                onClick={() => setEscalateOpen(true)}
                leadingIcon={<AlertTriangle className="h-4 w-4" />}
              >
                Escalate to Head of Legal
              </Button>
            ) : null}
            {can('case:link') && !isReadOnly ? (
              <Button
                fullWidth
                variant="outline"
                onClick={() => setLinkOpen(true)}
                leadingIcon={<Link2 className="h-4 w-4" />}
              >
                Link a related case
              </Button>
            ) : null}
            {canClose && !isConcluded ? (
              <Button fullWidth onClick={() => setCloseOpen(true)} leadingIcon={<Lock className="h-4 w-4" />}>
                Close case
              </Button>
            ) : null}
            {isReadOnly ? (
              <p className="rounded-lg bg-ink-50 p-3 text-xs text-ink-600">
                You are signed in with read-only access. Case data cannot be changed from this account.
              </p>
            ) : null}
          </div>
        </CardBody>
      </Card>

      {linked.length > 0 ? (
        <Card>
          <CardHeader title="Linked cases" description="Related requests and appeals" />
          <CardBody>
            <ul className="space-y-2">
              {linked.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-2">
                  <Link to={`/cases/${row.id}`} className="min-w-0 flex-1 text-xs hover:text-brand-700">
                    <span className="block font-mono text-2xs text-ink-500">{row.caseNumber}</span>
                    <span className="line-clamp-2 font-medium text-ink-800">{row.subject}</span>
                  </Link>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge tone="neutral" size="sm">
                      {STATUS_META[row.status].label}
                    </Badge>
                    {can('case:link') && !isReadOnly ? (
                      <button
                        type="button"
                        className="text-2xs text-ink-400 underline hover:text-crest-600"
                        onClick={() =>
                          run(() => unlinkCases(foiCase.id, row.id, user.id), 'Link removed', row.caseNumber)
                        }
                      >
                        Unlink
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Close this case"
        description="Closure records an outcome code and a reason against the file. The requestor is notified."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button
              isLoading={busy}
              onClick={async () => {
                await run(
                  () =>
                    closeCase(
                      foiCase.id,
                      { outcomeCode, closureReason, note: closureNote.trim() || undefined },
                      user.id,
                    ),
                  'Case closed',
                  `${foiCase.caseNumber} — ${outcomeCode}.`,
                )
                setCloseOpen(false)
              }}
            >
              Close case
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Outcome"
            options={reference.outcomeCodes.map((code) => ({ value: code.label, label: code.label }))}
            value={outcomeCode}
            onChange={(event) => setOutcomeCode(event.target.value)}
          />
          <Select
            label="Closure reason"
            options={reference.closureReasons.map((item) => ({ value: item.label, label: item.label }))}
            value={closureReason}
            onChange={(event) => setClosureReason(event.target.value)}
          />
          <Textarea
            label="Note for the file (optional)"
            rows={3}
            value={closureNote}
            onChange={(event) => setClosureNote(event.target.value)}
          />
        </div>
      </Modal>

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="Link a related case"
        description="Links are reciprocal — the other case shows this one too."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button
              isLoading={busy}
              disabled={!linkTarget}
              onClick={async () => {
                await run(() => linkCases(foiCase.id, linkTarget, user.id), 'Cases linked')
                setLinkTarget('')
                setLinkOpen(false)
              }}
            >
              Link case
            </Button>
          </>
        }
      >
        <Select
          label="Case to link"
          value={linkTarget}
          onChange={(event) => setLinkTarget(event.target.value)}
          options={[
            { value: '', label: 'Select a case…' },
            ...candidates.map((row) => ({
              value: row.id,
              label: `${row.caseNumber} — ${row.subject.slice(0, 60)}`,
            })),
          ]}
        />
      </Modal>

      <ConfirmDialog
        open={escalateOpen}
        onClose={() => setEscalateOpen(false)}
        isBusy={busy}
        title="Escalate this case"
        confirmLabel="Escalate"
        message={
          <span>
            The Head of Legal Unit is notified immediately and {foiCase.caseNumber} moves to the escalated queue.
            Use this where the statutory deadline is at risk or the request carries litigation exposure.
          </span>
        }
        onConfirm={async () => {
          await run(
            () => changeCaseStatus(foiCase.id, 'escalated', user.id, 'Escalated from the case file.'),
            'Case escalated',
            'The Head of Legal Unit has been notified.',
          )
          setEscalateOpen(false)
        }}
      />
    </>
  )
}
