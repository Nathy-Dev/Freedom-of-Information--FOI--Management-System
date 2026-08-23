import { useState } from 'react'
import { Download, Tag, UserCheck, Workflow, X } from 'lucide-react'
import type { CaseStatus } from '@/types'
import { Button, Modal, Select } from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import { STATUS_META } from '@/lib/constants'
import { reference } from '@/mocks/db'

export interface BulkActionBarProps {
  count: number
  onClear: () => void
  onAssign: (assigneeId: string | null) => Promise<void> | void
  onStatus: (status: CaseStatus) => Promise<void> | void
  onTag: (tag: string) => Promise<void> | void
  onExport: () => void
  busy?: boolean
}

type Sheet = 'assign' | 'status' | 'tag' | null

const STATUS_OPTIONS: SelectOption[] = (
  ['filed', 'in_review', 'pending_info', 'responded', 'escalated', 'appeal', 'rejected', 'closed'] as CaseStatus[]
).map((status) => ({ value: status, label: STATUS_META[status].label }))

/** FR-051: floating bar that appears once rows are checked in the case register. */
export function BulkActionBar({
  count,
  onClear,
  onAssign,
  onStatus,
  onTag,
  onExport,
  busy = false,
}: BulkActionBarProps) {
  const [sheet, setSheet] = useState<Sheet>(null)
  const [assignee, setAssignee] = useState('')
  const [status, setStatus] = useState<CaseStatus>('in_review')
  const [tag, setTag] = useState(reference.tags[0]?.label ?? '')

  const close = () => setSheet(null)

  const assigneeOptions: SelectOption[] = [
    { value: '', label: 'Unassign' },
    ...reference.assignableStaff.map((staff) => ({
      value: staff.id,
      label: `${staff.name} — ${staff.position ?? staff.department ?? "Legal Unit"}`,
    })),
  ]

  return (
    <>
      <div className="sticky bottom-4 z-20 mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-white/95 px-4 py-3 shadow-elevated backdrop-blur">
        <span className="mr-auto text-sm font-semibold text-ink-900">
          {count} {count === 1 ? 'case' : 'cases'} selected
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSheet('assign')}
          leadingIcon={<UserCheck className="h-3.5 w-3.5" />}
        >
          Assign
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSheet('status')}
          leadingIcon={<Workflow className="h-3.5 w-3.5" />}
        >
          Change status
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setSheet('tag')}
          leadingIcon={<Tag className="h-3.5 w-3.5" />}
        >
          Add tag
        </Button>
        <Button size="sm" variant="ghost" onClick={onExport} leadingIcon={<Download className="h-3.5 w-3.5" />}>
          Export CSV
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onClear}
          aria-label="Clear selection"
          leadingIcon={<X className="h-3.5 w-3.5" />}
        >
          Clear
        </Button>
      </div>

      <Modal
        open={sheet === 'assign'}
        onClose={close}
        title="Assign selected cases"
        description={`${count} ${count === 1 ? 'case' : 'cases'} will be routed to the chosen officer, who is notified immediately.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              isLoading={busy}
              onClick={async () => {
                await onAssign(assignee || null)
                close()
              }}
            >
              Assign
            </Button>
          </>
        }
      >
        <Select
          label="Officer"
          options={assigneeOptions}
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
        />
      </Modal>

      <Modal
        open={sheet === 'status'}
        onClose={close}
        title="Change status"
        description="The change is written to each case timeline and the audit trail."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              isLoading={busy}
              onClick={async () => {
                await onStatus(status)
                close()
              }}
            >
              Apply to {count}
            </Button>
          </>
        }
      >
        <Select
          label="New status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(event) => setStatus(event.target.value as CaseStatus)}
          hint="Statutory clocks are not reset by a status change."
        />
      </Modal>

      <Modal
        open={sheet === 'tag'}
        onClose={close}
        title="Add a tag"
        description="Tags drive saved views and reporting categories."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              isLoading={busy}
              onClick={async () => {
                await onTag(tag)
                close()
              }}
            >
              Add tag
            </Button>
          </>
        }
      >
        <Select
          label="Tag"
          options={reference.tags.map((item) => ({ value: item.label, label: item.label }))}
          value={tag}
          onChange={(event) => setTag(event.target.value)}
        />
      </Modal>
    </>
  )
}
