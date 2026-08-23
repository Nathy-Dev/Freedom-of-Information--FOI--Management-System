import { Link } from 'react-router-dom'
import { CheckSquare, ListChecks } from 'lucide-react'
import type { CaseTask } from '@/types'
import { Card, CardBody, CardHeader, EmptyState, TaskStatusBadge } from '@/components/ui'
import { formatSmartDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import { db } from '@/mocks/db'

/** "My work" panel: the tasks assigned to the signed-in officer (FR-022). */
export function TaskListCard({
  tasks,
  title = 'My tasks',
  description = 'Actions assigned to you across open case files.',
  limit = 6,
  onToggle,
}: {
  tasks: CaseTask[]
  title?: string
  description?: string
  limit?: number
  onToggle?: (task: CaseTask) => void
}) {
  const today = new Date().toISOString().slice(0, 10)
  const rows = tasks.slice(0, limit)

  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        icon={<ListChecks aria-hidden className="h-4.5 w-4.5 text-brand-600" />}
      />
      <CardBody className="p-0">
        {rows.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState
              compact
              icon={<CheckSquare aria-hidden className="h-5 w-5" />}
              title="No open tasks"
              description="Nothing is waiting on you. New work appears here as cases are assigned."
            />
          </div>
        ) : (
          <ul className="divide-y divide-ink-100">
            {rows.map((task) => {
              const parent = db.cases.find((row) => row.id === task.caseId)
              const overdue = task.status !== 'done' && task.dueDate.slice(0, 10) < today
              return (
                <li key={task.id} className="flex items-start gap-3 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onToggle?.(task)}
                    aria-label={task.status === 'done' ? 'Reopen task' : 'Mark task complete'}
                    disabled={!onToggle}
                    className={cn(
                      'mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition',
                      task.status === 'done'
                        ? 'border-brand-500 bg-brand-500 text-white'
                        : 'border-ink-300 bg-white hover:border-brand-400',
                      !onToggle && 'cursor-default',
                    )}
                  >
                    {task.status === 'done' ? <CheckSquare aria-hidden className="h-3 w-3" /> : null}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-sm font-medium text-ink-900',
                        task.status === 'done' && 'text-ink-400 line-through',
                      )}
                    >
                      {task.title}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                      <Link to={`/cases/${task.caseId}`} className="font-mono text-[11px] hover:underline">
                        {parent?.caseNumber ?? task.caseId}
                      </Link>
                      <span aria-hidden>·</span>
                      <span className={overdue ? 'font-medium text-crest-600' : undefined}>
                        Due {formatSmartDate(task.dueDate)}
                      </span>
                    </p>
                  </div>
                  <TaskStatusBadge status={task.status} />
                </li>
              )
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
