import type { ReactNode } from 'react'
import type {
  CasePriority,
  CaseSla,
  CaseStatus,
  Confidentiality,
  CourtDateStatus,
  DocumentKind,
  TaskStatus,
} from '@/types'
import type { Tone } from '@/lib/constants'
import {
  CONFIDENTIALITY_META,
  COURT_STATUS_META,
  DOCUMENT_KIND_META,
  PRIORITY_META,
  SLA_META,
  STATUS_META,
  TASK_STATUS_META,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

interface MetaBadgeProps {
  tone: Tone
  label?: ReactNode
  showDot?: boolean
  size?: 'sm' | 'md'
  className?: string
  title?: string
}

/**
 * Renders any of the domain `Tone` records from `lib/constants`, so a status
 * looks identical in a table, a card, the calendar and a report.
 */
export function MetaBadge({ tone, label, showDot = true, size = 'sm', className, title }: MetaBadgeProps) {
  return (
    <span
      title={title ?? tone.description ?? tone.label}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        tone.className,
        className,
      )}
    >
      {showDot ? <span aria-hidden className={cn('h-1.5 w-1.5 shrink-0 rounded-full', tone.dot)} /> : null}
      <span className="truncate">{label ?? tone.label}</span>
    </span>
  )
}

export function StatusBadge({ status, size, className }: { status: CaseStatus; size?: 'sm' | 'md'; className?: string }) {
  return <MetaBadge tone={STATUS_META[status]} size={size} className={className} />
}

export function PriorityBadge({ priority, size, className }: { priority: CasePriority; size?: 'sm' | 'md'; className?: string }) {
  return <MetaBadge tone={PRIORITY_META[priority]} size={size} className={className} />
}

export function ConfidentialityBadge({ level, size, className }: { level: Confidentiality; size?: 'sm' | 'md'; className?: string }) {
  return <MetaBadge tone={CONFIDENTIALITY_META[level]} size={size} className={className} />
}

export function TaskStatusBadge({ status, size, className }: { status: TaskStatus; size?: 'sm' | 'md'; className?: string }) {
  return <MetaBadge tone={TASK_STATUS_META[status]} size={size} className={className} />
}

export function CourtStatusBadge({ status, size, className }: { status: CourtDateStatus; size?: 'sm' | 'md'; className?: string }) {
  return <MetaBadge tone={COURT_STATUS_META[status]} size={size} className={className} />
}

export function DocumentKindBadge({ kind, size, className }: { kind: DocumentKind; size?: 'sm' | 'md'; className?: string }) {
  return <MetaBadge tone={DOCUMENT_KIND_META[kind]} size={size} className={className} />
}

/** SLA pill shows the countdown text ("2 days left", "3 days overdue"), not just the state. */
export function SlaBadge({ sla, size, showLabel = true, className }: { sla: CaseSla; size?: 'sm' | 'md'; showLabel?: boolean; className?: string }) {
  const tone = SLA_META[sla.state]
  return (
    <MetaBadge
      tone={tone}
      size={size}
      className={className}
      title={sla.label}
      label={showLabel ? sla.label : tone.label}
    />
  )
}

/** Thin left bar used on cards and calendar chips to carry the status colour. */
export function ToneBar({ tone, className }: { tone: Tone; className?: string }) {
  return <span aria-hidden className={cn('block w-1 shrink-0 rounded-l-xl', tone.dot, className)} />
}
