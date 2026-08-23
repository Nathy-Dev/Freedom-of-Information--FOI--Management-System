import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react'
import type { CaseFilters, SavedView } from '@/types'
import { Button, FilterChip, Tooltip } from '@/components/ui'
import {
  CONFIDENTIALITY_META,
  PRIORITY_META,
  SLA_META,
  STATUS_META,
} from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { userName } from '@/mocks/db'
import { cn } from '@/lib/utils'

export interface SavedViewBarProps {
  views: SavedView[]
  activeViewId: string | null
  filters: CaseFilters
  onApply: (view: SavedView) => void
  onSave: () => void
  onDelete?: (view: SavedView) => void
  onClearFilter: (patch: CaseFilters) => void
  canSave?: boolean
  currentUserId: string
}

interface Descriptor {
  key: string
  label: string
  value: string
  clear: CaseFilters
}

/** Turn the filter object into removable chips so users can see exactly what is applied. */
function describe(filters: CaseFilters): Descriptor[] {
  const out: Descriptor[] = []

  if (filters.q) out.push({ key: 'q', label: 'Search', value: filters.q, clear: { q: undefined } })
  if (filters.statuses?.length) {
    out.push({
      key: 'statuses',
      label: 'Status',
      value: filters.statuses.map((s) => STATUS_META[s].label).join(', '),
      clear: { statuses: undefined },
    })
  }
  if (filters.priorities?.length) {
    out.push({
      key: 'priorities',
      label: 'Priority',
      value: filters.priorities.map((p) => PRIORITY_META[p].label).join(', '),
      clear: { priorities: undefined },
    })
  }
  if (filters.sla?.length) {
    out.push({
      key: 'sla',
      label: 'Clock',
      value: filters.sla.map((s) => SLA_META[s].label).join(', '),
      clear: { sla: undefined },
    })
  }
  if (filters.confidentiality?.length) {
    out.push({
      key: 'confidentiality',
      label: 'Class',
      value: filters.confidentiality.map((c) => CONFIDENTIALITY_META[c].label).join(', '),
      clear: { confidentiality: undefined },
    })
  }
  if (filters.departments?.length) {
    out.push({
      key: 'departments',
      label: 'Department',
      value: filters.departments.join(', '),
      clear: { departments: undefined },
    })
  }
  if (filters.assignees?.length) {
    out.push({
      key: 'assignees',
      label: 'Officer',
      value: filters.assignees
        .map((id) => (id === 'unassigned' ? 'Unassigned' : userName(id)))
        .join(', '),
      clear: { assignees: undefined },
    })
  }
  if (filters.tags?.length) {
    out.push({ key: 'tags', label: 'Tag', value: filters.tags.join(', '), clear: { tags: undefined } })
  }
  if (filters.dateFrom) {
    out.push({ key: 'from', label: 'From', value: formatDate(filters.dateFrom), clear: { dateFrom: undefined } })
  }
  if (filters.dateTo) {
    out.push({ key: 'to', label: 'To', value: formatDate(filters.dateTo), clear: { dateTo: undefined } })
  }
  if (filters.hasCourtDate) {
    out.push({ key: 'court', label: 'Court', value: 'Has a listing', clear: { hasCourtDate: undefined } })
  }
  if (filters.isAppeal) {
    out.push({ key: 'appeal', label: 'Type', value: 'Appeals only', clear: { isAppeal: undefined } })
  }

  return out
}

/** FR-041: saved views plus a plain-language summary of the active filters. */
export function SavedViewBar({
  views,
  activeViewId,
  filters,
  onApply,
  onSave,
  onDelete,
  onClearFilter,
  canSave = true,
  currentUserId,
}: SavedViewBarProps) {
  const chips = describe(filters)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wide text-ink-500">
          <Bookmark aria-hidden className="h-3.5 w-3.5" />
          Saved views
        </span>
        {views.map((view) => {
          const isActive = view.id === activeViewId
          return (
            <span key={view.id} className="inline-flex items-center">
              <button
                type="button"
                onClick={() => onApply(view)}
                aria-pressed={isActive}
                className={cn(
                  'rounded-l-lg border py-1 pl-2.5 pr-2 text-xs font-medium transition-colors',
                  onDelete && view.ownerId === currentUserId ? '' : 'rounded-r-lg pr-2.5',
                  isActive
                    ? 'border-brand-500 bg-brand-500 text-white'
                    : 'border-ink-200 bg-white text-ink-700 hover:border-brand-300 hover:text-brand-700',
                )}
              >
                {view.name}
                {view.isShared ? <span className="ml-1 opacity-70">· shared</span> : null}
              </button>
              {onDelete && view.ownerId === currentUserId ? (
                <Tooltip content={`Delete "${view.name}"`}>
                  <button
                    type="button"
                    onClick={() => onDelete(view)}
                    aria-label={`Delete saved view ${view.name}`}
                    className={cn(
                      'rounded-r-lg border border-l-0 px-1.5 py-1 transition-colors',
                      isActive
                        ? 'border-brand-500 bg-brand-500 text-white/80 hover:text-white'
                        : 'border-ink-200 bg-white text-ink-400 hover:border-crest-300 hover:text-crest-600',
                    )}
                  >
                    <Trash2 aria-hidden className="h-3 w-3" />
                  </button>
                </Tooltip>
              ) : null}
            </span>
          )
        })}
        {canSave && chips.length > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            leadingIcon={<BookmarkPlus className="h-3.5 w-3.5" />}
          >
            Save this view
          </Button>
        ) : null}
      </div>

      {chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <FilterChip
              key={chip.key}
              label={chip.label}
              value={chip.value}
              onRemove={() => onClearFilter(chip.clear)}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}
