import type {
  CaseNote,
  CourtDate,
  FoiCase,
  FoiDocument,
  TimelineEvent,
  TimelineKind,
} from '@/types'
import { STATUS_META } from '@/lib/constants'
import { computeSla } from '@/lib/sla'
import { formatDate } from '@/lib/format'

/**
 * The case timeline (FR-021) is derived, not seeded: it is assembled from the
 * records that already exist on the case so it can never contradict them.
 */
export function buildTimeline(
  cases: FoiCase[],
  documents: FoiDocument[],
  notes: CaseNote[],
  courtDates: CourtDate[],
  userName: (id: string) => string,
): TimelineEvent[] {
  const events: TimelineEvent[] = []
  let counter = 0

  const push = (
    caseId: string,
    kind: TimelineKind,
    actorId: string,
    at: string,
    summary: string,
    detail?: string,
  ) => {
    counter += 1
    events.push({ id: `tl-${String(counter).padStart(6, '0')}`, caseId, kind, actorId, at, summary, detail })
  }

  const docsByCase = groupById(documents, (d) => d.caseId)
  const notesByCase = groupById(notes, (n) => n.caseId)
  const courtByCase = groupById(courtDates, (c) => c.caseId)

  cases.forEach((foiCase) => {
    push(
      foiCase.id,
      'created',
      foiCase.requestorId,
      foiCase.dateSubmitted,
      `FOI request filed via ${foiCase.source.replace('_', ' ')}`,
      `Case ${foiCase.caseNumber} opened with status Filed. Statutory response date ${formatDate(foiCase.statutoryDueDate)}.`,
    )

    push(
      foiCase.id,
      'acknowledged',
      'system',
      addHours(foiCase.dateSubmitted, 1),
      'Acknowledgement issued to requestor',
      `Email and in-app acknowledgement sent to ${foiCase.requestor.email} quoting the case number and expected response date.`,
    )

    if (foiCase.assignedTo) {
      push(
        foiCase.id,
        'assigned',
        'usr-002',
        addHours(foiCase.dateSubmitted, 6),
        `Assigned to ${userName(foiCase.assignedTo)}`,
        foiCase.assignedTeamId ? `Routed to the ${foiCase.assignedTeamId.replace('team-', '')} team queue.` : undefined,
      )
      push(
        foiCase.id,
        'status_changed',
        foiCase.assignedTo,
        addHours(foiCase.dateSubmitted, 8),
        'Status changed from Filed to In Review',
      )
    }

    ;(docsByCase.get(foiCase.id) ?? []).forEach((doc) => {
      push(
        foiCase.id,
        'document_uploaded',
        doc.uploadedBy,
        doc.createdAt,
        `Uploaded ${doc.fileName}`,
        `Version ${doc.version} · ${doc.kind.replace('_', ' ')} · scan ${doc.virusScan}.`,
      )
      if (doc.isRedacted) {
        push(
          foiCase.id,
          'document_redacted',
          doc.uploadedBy,
          addHours(doc.createdAt, 3),
          `${doc.redactionCount} redactions applied to ${doc.fileName}`,
          'Severances recorded against grounds in the Freedom of Information Act 2011.',
        )
      }
      if (doc.isPublic) {
        push(
          foiCase.id,
          'document_published',
          doc.uploadedBy,
          addHours(doc.createdAt, 5),
          `Published ${doc.fileName} to the requestor`,
        )
      }
    })
    ;(notesByCase.get(foiCase.id) ?? []).forEach((note) => {
      push(
        foiCase.id,
        'note_added',
        note.userId,
        note.createdAt,
        note.type === 'internal' ? 'Internal note added' : 'Note shared with requestor',
        note.content,
      )
    })
    ;(courtByCase.get(foiCase.id) ?? []).forEach((court) => {
      push(
        foiCase.id,
        'court_scheduled',
        court.createdBy,
        court.createdAt,
        `${court.hearingType.replace(/_/g, ' ')} listed at ${court.courtName}`,
        `${formatDate(court.date)} at ${court.time} before ${court.judge}. Suit no. ${court.suitNumber}.`,
      )
      if (court.outcome) {
        push(
          foiCase.id,
          'court_outcome',
          court.createdBy,
          `${court.date}T${court.time}:00.000Z`,
          'Hearing outcome recorded',
          court.outcome,
        )
      }
    })

    const sla = computeSla(foiCase)
    if (sla.state === 'overdue') {
      push(
        foiCase.id,
        'sla_breach',
        'system',
        `${foiCase.statutoryDueDate}T00:05:00.000Z`,
        'Statutory response deadline passed',
        `${sla.label}. Escalation policy triggered and the Head of Legal Unit was notified.`,
      )
    } else if (sla.state === 'due_soon') {
      push(
        foiCase.id,
        'sla_warning',
        'system',
        addHours(new Date().toISOString(), -6),
        'Statutory deadline approaching',
        sla.label,
      )
    }

    if (foiCase.status === 'escalated') {
      push(foiCase.id, 'escalated', 'usr-004', foiCase.updatedAt, 'Case escalated to the Head of Legal Unit')
    }

    if (foiCase.status === 'appeal') {
      push(
        foiCase.id,
        'appeal_filed',
        foiCase.requestorId,
        foiCase.updatedAt,
        'Requestor appealed the determination',
        'Appeal lodged under section 20 of the Freedom of Information Act 2011.',
      )
    }

    if (foiCase.respondedAt) {
      push(
        foiCase.id,
        'status_changed',
        foiCase.assignedTo ?? 'usr-004',
        foiCase.respondedAt,
        `Status changed to ${STATUS_META.responded.label}`,
        'Determination communicated to the requestor.',
      )
    }

    if (foiCase.dateClosed) {
      push(
        foiCase.id,
        'closed',
        foiCase.assignedTo ?? 'usr-004',
        foiCase.dateClosed,
        `Case closed — ${foiCase.outcomeCode ?? 'concluded'}`,
        foiCase.closureReason,
      )
    }
  })

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

function addHours(iso: string, hours: number) {
  const date = new Date(iso)
  date.setHours(date.getHours() + hours)
  return date.toISOString()
}

function groupById<T>(list: T[], key: (item: T) => string) {
  const map = new Map<string, T[]>()
  list.forEach((item) => {
    const k = key(item)
    const existing = map.get(k)
    if (existing) existing.push(item)
    else map.set(k, [item])
  })
  return map
}
