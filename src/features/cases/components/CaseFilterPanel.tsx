import { useMemo } from 'react'
import { RotateCcw, SlidersHorizontal } from 'lucide-react'
import type {
  CaseFilters,
  CasePriority,
  CaseStatus,
  Confidentiality,
  SlaState,
} from '@/types'
import { Button, ChoiceChip, Field, Input, Select } from '@/components/ui'
import type { SelectOption } from '@/components/ui'
import {
  CONFIDENTIALITY_META,
  PRIORITY_META,
  SLA_META,
  STATUS_META,
} from '@/lib/constants'
import { reference } from '@/mocks/db'

export interface CaseFilterPanelProps {
  filters: CaseFilters
  onChange: (next: CaseFilters) => void
  onReset: () => void
  /** Hidden for the requestor portal, where most facets are meaningless. */
  showAssignee?: boolean
}

const STATUS_ORDER: CaseStatus[] = [
  'filed',
  'in_review',
  'pending_info',
  'responded',
  'escalated',
  'appeal',
  'rejected',
  'closed',
]

const PRIORITY_ORDER: CasePriority[] = ['critical', 'high', 'medium', 'low']
const SLA_ORDER: SlaState[] = ['overdue', 'due_soon', 'on_track', 'met']
const CONFIDENTIALITY_ORDER: Confidentiality[] = ['public', 'internal', 'confidential', 'restricted']

/** Toggle one value inside an optional array facet, dropping the key when empty. */
function toggle<T extends string>(current: T[] | undefined, value: T): T[] | undefined {
  const list = current ?? []
  const next = list.includes(value) ? list.filter((item) => item !== value) : [...list, value]
  return next.length ? next : undefined
}

/** FR-041: the shared advanced-filter surface for every case list. */
export function CaseFilterPanel({
  filters,
  onChange,
  onReset,
  showAssignee = true,
}: CaseFilterPanelProps) {
  const assigneeOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Anyone' },
      { value: 'unassigned', label: 'Unassigned' },
      ...reference.assignableStaff.map((staff) => ({ value: staff.id, label: staff.name })),
    ],
    [],
  )

  const departmentOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'All departments' },
      ...reference.departments.map((dept) => ({ value: dept.name, label: dept.name })),
    ],
    [],
  )

  const set = (patch: Partial<CaseFilters>) => onChange({ ...filters, ...patch })

  return (
    <div className="space-y-5 rounded-xl border border-ink-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <SlidersHorizontal aria-hidden className="h-4 w-4 text-brand-600" />
          Advanced filters
        </h3>
        <Button variant="ghost" size="sm" onClick={onReset} leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}>
          Reset
        </Button>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Status</legend>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_ORDER.map((status) => (
            <ChoiceChip
              key={status}
              selected={Boolean(filters.statuses?.includes(status))}
              dot={STATUS_META[status].dot}
              onClick={() => set({ statuses: toggle(filters.statuses, status) })}
            >
              {STATUS_META[status].label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Priority</legend>
        <div className="flex flex-wrap gap-1.5">
          {PRIORITY_ORDER.map((priority) => (
            <ChoiceChip
              key={priority}
              selected={Boolean(filters.priorities?.includes(priority))}
              dot={PRIORITY_META[priority].dot}
              onClick={() => set({ priorities: toggle(filters.priorities, priority) })}
            >
              {PRIORITY_META[priority].label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Statutory clock</legend>
        <div className="flex flex-wrap gap-1.5">
          {SLA_ORDER.map((state) => (
            <ChoiceChip
              key={state}
              selected={Boolean(filters.sla?.includes(state))}
              dot={SLA_META[state].dot}
              onClick={() => set({ sla: toggle(filters.sla, state) })}
            >
              {SLA_META[state].label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Classification</legend>
        <div className="flex flex-wrap gap-1.5">
          {CONFIDENTIALITY_ORDER.map((level) => (
            <ChoiceChip
              key={level}
              selected={Boolean(filters.confidentiality?.includes(level))}
              dot={CONFIDENTIALITY_META[level].dot}
              onClick={() => set({ confidentiality: toggle(filters.confidentiality, level) })}
            >
              {CONFIDENTIALITY_META[level].label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Tags</legend>
        <div className="flex flex-wrap gap-1.5">
          {reference.tags.map((tag) => (
            <ChoiceChip
              key={tag.id}
              selected={Boolean(filters.tags?.includes(tag.label))}
              onClick={() => set({ tags: toggle(filters.tags, tag.label) })}
            >
              {tag.label}
            </ChoiceChip>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Department" htmlFor="filter-department">
          <Select
            id="filter-department"
            options={departmentOptions}
            value={filters.departments?.[0] ?? ''}
            onChange={(event) =>
              set({ departments: event.target.value ? [event.target.value] : undefined })
            }
          />
        </Field>
        {showAssignee ? (
          <Field label="Assigned officer" htmlFor="filter-assignee">
            <Select
              id="filter-assignee"
              options={assigneeOptions}
              value={filters.assignees?.[0] ?? ''}
              onChange={(event) =>
                set({ assignees: event.target.value ? [event.target.value] : undefined })
              }
            />
          </Field>
        ) : null}
        <Field label="Submitted from" htmlFor="filter-from">
          <Input
            id="filter-from"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(event) => set({ dateFrom: event.target.value || undefined })}
          />
        </Field>
        <Field label="Submitted to" htmlFor="filter-to">
          <Input
            id="filter-to"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(event) => set({ dateTo: event.target.value || undefined })}
          />
        </Field>
      </div>

      <div className="flex flex-wrap gap-1.5 border-t border-ink-200/70 pt-4">
        <ChoiceChip
          selected={Boolean(filters.hasCourtDate)}
          onClick={() => set({ hasCourtDate: filters.hasCourtDate ? undefined : true })}
        >
          Has a court date
        </ChoiceChip>
        <ChoiceChip
          selected={Boolean(filters.isAppeal)}
          onClick={() => set({ isAppeal: filters.isAppeal ? undefined : true })}
        >
          Appeals only
        </ChoiceChip>
      </div>
    </div>
  )
}
