import { useState } from 'react'
import { CheckSquare, Plus } from 'lucide-react'
import type { CaseTask } from '@/types'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  Select,
  TaskStatusBadge,
  UserChip,
} from '@/components/ui'
import { addTask, setTaskStatus } from '@/mocks/api'
import { reference, usersById } from '@/mocks/db'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'

export interface CaseTasksPanelProps {
  caseId: string
  tasks: CaseTask[]
  onChanged: () => void
  readOnly?: boolean
}

function isoDaysAhead(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Working checklist for a case: who does what by when. */
export function CaseTasksPanel({ caseId, tasks, onChanged, readOnly = false }: CaseTasksPanelProps) {
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [title, setTitle] = useState('')
  const [assignee, setAssignee] = useState(reference.assignableStaff[0]?.id ?? '')
  const [due, setDue] = useState(isoDaysAhead(3))

  const outstanding = tasks.filter((task) => task.status !== 'done').length

  const create = async () => {
    if (!user || !title.trim()) return
    setBusy(true)
    try {
      await addTask(caseId, { title: title.trim(), assigneeId: assignee, dueDate: due }, user.id)
      onChanged()
      toast.success('Task created', `${usersById.get(assignee)?.name ?? 'The officer'} has been notified.`)
      setTitle('')
      setOpen(false)
    } finally {
      setBusy(false)
    }
  }

  const cycle = async (task: CaseTask) => {
    if (readOnly) return
    const next = task.status === 'done' ? 'open' : task.status === 'open' ? 'in_progress' : 'done'
    await setTaskStatus(task.id, next)
    onChanged()
  }

  return (
    <>
      <Card>
        <CardHeader
          title="Tasks"
          description={`${outstanding} outstanding of ${tasks.length}`}
          icon={<CheckSquare className="h-4 w-4" />}
          actions={
            readOnly ? null : (
              <Button size="sm" variant="outline" onClick={() => setOpen(true)} leadingIcon={<Plus className="h-3.5 w-3.5" />}>
                Add task
              </Button>
            )
          }
        />
        <CardBody>
          {tasks.length === 0 ? (
            <EmptyState
              compact
              title="No tasks on this case"
              description="Break the work down so the statutory deadline is not missed."
            />
          ) : (
            <ul className="divide-y divide-ink-200/70">
              {tasks.map((task) => {
                const owner = usersById.get(task.assigneeId)
                const overdue = task.status !== 'done' && task.dueDate.slice(0, 10) < new Date().toISOString().slice(0, 10)
                return (
                  <li key={task.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => cycle(task)}
                      disabled={readOnly}
                      aria-label={`Advance status of ${task.title}`}
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0 rounded border transition-colors',
                        task.status === 'done'
                          ? 'border-brand-600 bg-brand-600'
                          : task.status === 'in_progress'
                            ? 'border-gold-400 bg-gold-200'
                            : 'border-ink-300 bg-white hover:border-brand-400',
                        readOnly && 'cursor-not-allowed opacity-60',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'text-sm font-medium',
                          task.status === 'done' ? 'text-ink-400 line-through' : 'text-ink-900',
                        )}
                      >
                        {task.title}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-2xs text-ink-500">
                        <span className={overdue ? 'font-semibold text-crest-600' : undefined}>
                          Due {formatDate(task.dueDate)}
                        </span>
                        {owner ? <UserChip user={owner} /> : null}
                      </p>
                    </div>
                    <TaskStatusBadge status={task.status} size="sm" />
                  </li>
                )
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add a task"
        description="The assignee is notified in the portal and by email."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button isLoading={busy} disabled={!title.trim()} onClick={create}>
              Create task
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="What needs to happen?"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Obtain the departmental search certificate"
            autoFocus
          />
          <Select
            label="Assign to"
            options={reference.assignableStaff.map((staff) => ({ value: staff.id, label: staff.name }))}
            value={assignee}
            onChange={(event) => setAssignee(event.target.value)}
          />
          <Input label="Due date" type="date" value={due} onChange={(event) => setDue(event.target.value)} />
        </div>
      </Modal>
    </>
  )
}
