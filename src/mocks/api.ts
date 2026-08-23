import type {
  AccessLog,
  AppNotification,
  AuditLog,
  CaseFilters,
  CaseNote,
  CaseTask,
  CourtDate,
  FoiCase,
  FoiDocument,
  Paginated,
  QueryOptions,
  SearchHit,
  TimelineEvent,
  User,
} from '@/types'
import { computeSla } from '@/lib/sla'
import { delay } from '@/lib/utils'
import { visibleCases } from '@/lib/rbac'
import { db, nextCaseNumber, nextSequence, reference, userName } from './db'

/* ------------------------------------------------------------------ *
 * Query helpers
 * ------------------------------------------------------------------ */

function paginate<T>(rows: T[], options: QueryOptions = {}): Paginated<T> {
  const page = Math.max(1, options.page ?? 1)
  const pageSize = options.pageSize ?? 20
  const total = rows.length
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, pageCount)
  const start = (safePage - 1) * pageSize
  return { rows: rows.slice(start, start + pageSize), total, page: safePage, pageSize, pageCount }
}

function compare(a: unknown, b: unknown) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a ?? '').localeCompare(String(b ?? ''))
}

const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 }

function sortCases(rows: FoiCase[], sortBy = 'dateSubmitted', sortDir: 'asc' | 'desc' = 'desc') {
  const direction = sortDir === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    switch (sortBy) {
      case 'priority':
        return (PRIORITY_RANK[a.priority]! - PRIORITY_RANK[b.priority]!) * direction
      case 'dueDate':
        return compare(a.statutoryDueDate, b.statutoryDueDate) * direction
      case 'sla':
        return (computeSla(a).daysRemaining - computeSla(b).daysRemaining) * direction
      case 'caseNumber':
        return compare(a.caseNumber, b.caseNumber) * direction
      case 'subject':
        return compare(a.subject, b.subject) * direction
      case 'assignee':
        return compare(userName(a.assignedTo), userName(b.assignedTo)) * direction
      case 'status':
        return compare(a.status, b.status) * direction
      case 'updatedAt':
        return compare(a.updatedAt, b.updatedAt) * direction
      default:
        return compare(a.dateSubmitted, b.dateSubmitted) * direction
    }
  })
}

/** Every list screen funnels through one filter implementation (FR-041). */
export function applyCaseFilters(rows: FoiCase[], filters: CaseFilters = {}): FoiCase[] {
  const needle = filters.q?.trim().toLowerCase()

  return rows.filter((c) => {
    if (needle) {
      const haystack = [
        c.caseNumber,
        c.subject,
        c.description,
        c.requestor.name,
        c.requestor.organization ?? '',
        c.department,
        c.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(needle)) return false
    }

    if (filters.statuses?.length && !filters.statuses.includes(c.status)) return false
    if (filters.priorities?.length && !filters.priorities.includes(c.priority)) return false
    if (filters.departments?.length && !filters.departments.includes(c.department)) return false
    if (filters.tags?.length && !filters.tags.some((t) => c.tags.includes(t))) return false
    if (filters.confidentiality?.length && !filters.confidentiality.includes(c.confidentiality)) {
      return false
    }

    if (filters.assignees?.length) {
      const wantsUnassigned = filters.assignees.includes('unassigned')
      const matches = c.assignedTo ? filters.assignees.includes(c.assignedTo) : wantsUnassigned
      if (!matches) return false
    }

    if (filters.sla?.length && !filters.sla.includes(computeSla(c).state)) return false
    if (filters.dateFrom && c.dateSubmitted.slice(0, 10) < filters.dateFrom) return false
    if (filters.dateTo && c.dateSubmitted.slice(0, 10) > filters.dateTo) return false
    if (filters.hasCourtDate && c.courtDateCount === 0) return false
    if (filters.isAppeal && !c.isAppeal) return false

    return true
  })
}

/* ------------------------------------------------------------------ *
 * Cases
 * ------------------------------------------------------------------ */

export interface CaseQuery extends QueryOptions {
  filters?: CaseFilters
  /** Row-level security: results are scoped to what this user may see. */
  actor: User
  teamMemberIds?: string[]
}

export async function listCases({
  filters,
  actor,
  teamMemberIds = [],
  ...options
}: CaseQuery): Promise<Paginated<FoiCase>> {
  await delay()
  const scoped = visibleCases(actor, db.cases, teamMemberIds)
  const filtered = applyCaseFilters(scoped, filters)
  const sorted = sortCases(filtered, options.sortBy, options.sortDir)
  return paginate(sorted, options)
}

/** Unpaginated variant for dashboards, exports and count badges. */
export function selectCases(actor: User, filters?: CaseFilters, teamMemberIds: string[] = []) {
  return applyCaseFilters(visibleCases(actor, db.cases, teamMemberIds), filters)
}

export async function getCase(id: string): Promise<FoiCase | undefined> {
  await delay(160)
  return db.cases.find((c) => c.id === id)
}

export interface CaseBundle {
  foiCase: FoiCase
  documents: FoiDocument[]
  notes: CaseNote[]
  tasks: CaseTask[]
  courtDates: CourtDate[]
  timeline: TimelineEvent[]
  linked: FoiCase[]
}

export async function getCaseBundle(id: string): Promise<CaseBundle | undefined> {
  await delay(240)
  const foiCase = db.cases.find((c) => c.id === id)
  if (!foiCase) return undefined

  return {
    foiCase,
    documents: db.documents
      .filter((d) => d.caseId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    notes: db.notes
      .filter((n) => n.caseId === id)
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.createdAt.localeCompare(a.createdAt)),
    tasks: db.tasks.filter((t) => t.caseId === id).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    courtDates: db.courtDates.filter((c) => c.caseId === id).sort((a, b) => a.date.localeCompare(b.date)),
    timeline: db.timeline.filter((e) => e.caseId === id),
    linked: foiCase.linkedCaseIds
      .map((linkedId) => db.cases.find((c) => c.id === linkedId))
      .filter((c): c is FoiCase => Boolean(c)),
  }
}

export interface NewCaseInput {
  subject: string
  description: string
  department: string
  priority: FoiCase['priority']
  confidentiality: FoiCase['confidentiality']
  responseFormat: FoiCase['responseFormat']
  source: FoiCase['source']
  tags: string[]
  requestor: FoiCase['requestor']
  requestorId: string
  assignedTo?: string | null
}

/** FR-010/FR-011: creating a request opens a case and starts the statutory clock. */
export async function createCase(input: NewCaseInput, actorId: string): Promise<FoiCase> {
  await delay(420)
  const now = new Date()
  const due = new Date(now)
  due.setDate(due.getDate() + 7)

  const foiCase: FoiCase = {
    id: nextSequence('case'),
    caseNumber: nextCaseNumber(),
    requestorId: input.requestorId,
    requestor: input.requestor,
    subject: input.subject,
    description: input.description,
    assignedTo: input.assignedTo ?? null,
    assignedTeamId: null,
    status: 'filed',
    priority: input.priority,
    confidentiality: input.confidentiality,
    responseFormat: input.responseFormat,
    source: input.source,
    tags: input.tags,
    department: input.department,
    dateSubmitted: now.toISOString(),
    statutoryDueDate: due.toISOString().slice(0, 10),
    dateClosed: null,
    linkedCaseIds: [],
    isAppeal: false,
    documentCount: 0,
    noteCount: 0,
    courtDateCount: 0,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }

  db.cases.unshift(foiCase)
  pushTimeline(foiCase.id, 'created', actorId, `FOI request filed via ${input.source.replace('_', ' ')}`)
  pushTimeline(foiCase.id, 'acknowledged', 'system', 'Acknowledgement issued to requestor')
  pushAudit('Case', foiCase.id, foiCase.caseNumber, 'create', actorId, 'Case created from the new request form.')
  return foiCase
}

/* ------------------------------------------------------------------ *
 * Case mutations
 * ------------------------------------------------------------------ */

function touch(foiCase: FoiCase) {
  foiCase.updatedAt = new Date().toISOString()
}

export async function updateCase(
  id: string,
  patch: Partial<FoiCase>,
  actorId: string,
  detail = 'Case updated.',
): Promise<FoiCase | undefined> {
  await delay(300)
  const foiCase = db.cases.find((c) => c.id === id)
  if (!foiCase) return undefined
  Object.assign(foiCase, patch)
  touch(foiCase)
  pushAudit('Case', foiCase.id, foiCase.caseNumber, 'update', actorId, detail)
  return foiCase
}

/** FR-014: assignment is auditable and notifies the new owner. */
export async function assignCase(id: string, assigneeId: string | null, actorId: string) {
  const foiCase = db.cases.find((c) => c.id === id)
  if (!foiCase) return undefined
  const result = await updateCase(
    id,
    { assignedTo: assigneeId, status: foiCase.status === 'filed' && assigneeId ? 'in_review' : foiCase.status },
    actorId,
    assigneeId ? `Assigned to ${userName(assigneeId)}.` : 'Assignment cleared.',
  )
  if (result && assigneeId) {
    pushTimeline(id, 'assigned', actorId, `Assigned to ${userName(assigneeId)}`)
    pushNotification(assigneeId, 'case_assigned', `Assigned to you: ${foiCase.caseNumber}`, foiCase.subject, `/cases/${id}`)
  }
  return result
}

/** FR-016: status transitions are recorded on the timeline and the audit trail. */
export async function changeCaseStatus(id: string, status: FoiCase['status'], actorId: string, note?: string) {
  const foiCase = db.cases.find((c) => c.id === id)
  if (!foiCase) return undefined
  const previous = foiCase.status

  const patch: Partial<FoiCase> = { status }
  if (status === 'responded') patch.respondedAt = new Date().toISOString()
  if (status === 'closed' || status === 'rejected') patch.dateClosed = new Date().toISOString()

  const result = await updateCase(id, patch, actorId, `Status changed from ${previous} to ${status}.`)
  pushTimeline(id, status === 'closed' ? 'closed' : 'status_changed', actorId, `Status changed from ${previous} to ${status}`, note)
  pushNotification(
    foiCase.requestorId,
    'status_changed',
    `Update on ${foiCase.caseNumber}`,
    `The status of your request is now ${status.replace('_', ' ')}.`,
    `/my-requests/${id}`,
  )
  return result
}

/** FR-025: closure captures an outcome code and a reason. */
export async function closeCase(
  id: string,
  payload: { outcomeCode: string; closureReason: string; note?: string },
  actorId: string,
) {
  const foiCase = db.cases.find((c) => c.id === id)
  if (!foiCase) return undefined
  await updateCase(
    id,
    {
      status: 'closed',
      dateClosed: new Date().toISOString(),
      outcomeCode: payload.outcomeCode,
      closureReason: payload.closureReason,
    },
    actorId,
    `Case closed — ${payload.outcomeCode}. ${payload.closureReason}`,
  )
  pushTimeline(id, 'closed', actorId, `Case closed — ${payload.outcomeCode}`, payload.closureReason)
  return db.cases.find((c) => c.id === id)
}

/** FR-024: reciprocal linking so both cases show the relationship. */
export async function linkCases(id: string, otherId: string, actorId: string) {
  await delay(200)
  const a = db.cases.find((c) => c.id === id)
  const b = db.cases.find((c) => c.id === otherId)
  if (!a || !b) return undefined
  if (!a.linkedCaseIds.includes(b.id)) a.linkedCaseIds.push(b.id)
  if (!b.linkedCaseIds.includes(a.id)) b.linkedCaseIds.push(a.id)
  touch(a)
  touch(b)
  pushTimeline(a.id, 'linked', actorId, `Linked to ${b.caseNumber}`, b.subject)
  pushAudit('Case', a.id, a.caseNumber, 'update', actorId, `Linked to ${b.caseNumber}.`)
  return a
}

export async function unlinkCases(id: string, otherId: string, actorId: string) {
  await delay(180)
  const a = db.cases.find((c) => c.id === id)
  const b = db.cases.find((c) => c.id === otherId)
  if (!a || !b) return undefined
  a.linkedCaseIds = a.linkedCaseIds.filter((x) => x !== b.id)
  b.linkedCaseIds = b.linkedCaseIds.filter((x) => x !== a.id)
  pushAudit('Case', a.id, a.caseNumber, 'update', actorId, `Unlinked from ${b.caseNumber}.`)
  return a
}

/** FR-045: bulk operations on a checkbox selection. */
export async function bulkUpdateCases(
  ids: string[],
  patch: Partial<Pick<FoiCase, 'status' | 'assignedTo' | 'priority' | 'department'>>,
  actorId: string,
) {
  await delay(520)
  const touched: FoiCase[] = []
  ids.forEach((id) => {
    const foiCase = db.cases.find((c) => c.id === id)
    if (!foiCase) return
    Object.assign(foiCase, patch)
    touch(foiCase)
    touched.push(foiCase)
    pushAudit('Case', foiCase.id, foiCase.caseNumber, 'update', actorId, `Bulk update applied: ${Object.keys(patch).join(', ')}.`)
  })
  return touched
}

export async function bulkAddTags(ids: string[], newTags: string[], actorId: string) {
  await delay(420)
  ids.forEach((id) => {
    const foiCase = db.cases.find((c) => c.id === id)
    if (!foiCase) return
    newTags.forEach((tag) => {
      if (!foiCase.tags.includes(tag)) foiCase.tags.push(tag)
    })
    touch(foiCase)
    pushAudit('Case', foiCase.id, foiCase.caseNumber, 'update', actorId, `Tags applied: ${newTags.join(', ')}.`)
  })
}

/* ------------------------------------------------------------------ *
 * Notes, tasks and documents
 * ------------------------------------------------------------------ */

export async function addNote(
  caseId: string,
  input: { content: string; type: CaseNote['type']; mentions?: string[] },
  actorId: string,
): Promise<CaseNote> {
  await delay(280)
  const note: CaseNote = {
    id: nextSequence('note'),
    caseId,
    userId: actorId,
    type: input.type,
    content: input.content,
    mentions: input.mentions ?? [],
    attachmentIds: [],
    isPinned: false,
    createdAt: new Date().toISOString(),
  }
  db.notes.unshift(note)

  const foiCase = db.cases.find((c) => c.id === caseId)
  if (foiCase) {
    foiCase.noteCount += 1
    touch(foiCase)
  }

  pushTimeline(
    caseId,
    'note_added',
    actorId,
    input.type === 'internal' ? 'Internal note added' : 'Note shared with requestor',
    input.content,
  )
  ;(input.mentions ?? []).forEach((userId) => {
    pushNotification(userId, 'mention', `You were mentioned on ${foiCase?.caseNumber ?? caseId}`, input.content, `/cases/${caseId}`)
  })

  return note
}

export async function togglePinNote(noteId: string) {
  await delay(120)
  const note = db.notes.find((n) => n.id === noteId)
  if (note) note.isPinned = !note.isPinned
  return note
}

export async function addTask(
  caseId: string,
  input: { title: string; assigneeId: string; dueDate: string },
  actorId: string,
): Promise<CaseTask> {
  await delay(240)
  const task: CaseTask = {
    id: nextSequence('task'),
    caseId,
    title: input.title,
    assigneeId: input.assigneeId,
    dueDate: input.dueDate,
    status: 'open',
    createdBy: actorId,
    createdAt: new Date().toISOString(),
  }
  db.tasks.unshift(task)
  pushNotification(input.assigneeId, 'task_assigned', task.title, `Due ${task.dueDate.slice(0, 10)}.`, `/cases/${caseId}`)
  return task
}

export async function setTaskStatus(taskId: string, status: CaseTask['status']) {
  await delay(140)
  const task = db.tasks.find((t) => t.id === taskId)
  if (task) task.status = status
  return task
}

export interface UploadInput {
  fileName: string
  fileSize: number
  kind: FoiDocument['kind']
  confidentiality: FoiDocument['confidentiality']
  isPublic: boolean
  retentionLabel: string
}

/** FR-015/FR-030: uploads are versioned, scanned and audit-logged. */
export async function uploadDocument(
  caseId: string,
  input: UploadInput,
  actorId: string,
): Promise<FoiDocument> {
  await delay(650)
  const now = new Date().toISOString()
  const foiCase = db.cases.find((c) => c.id === caseId)
  const existing = db.documents.find((d) => d.caseId === caseId && d.fileName === input.fileName)

  if (existing) {
    // Same filename on the same case is treated as a new version (FR-032).
    existing.version += 1
    existing.fileSize = input.fileSize
    existing.uploadedBy = actorId
    existing.createdAt = now
    existing.versions.push({
      version: existing.version,
      uploadedBy: actorId,
      createdAt: now,
      fileSize: input.fileSize,
      checksum: Math.random().toString(16).slice(2, 14),
      changeNote: 'Replacement uploaded from the case file',
    })
    pushTimeline(caseId, 'document_uploaded', actorId, `Uploaded version ${existing.version} of ${existing.fileName}`)
    pushAudit('Document', existing.id, existing.fileName, 'update', actorId, `New version ${existing.version} uploaded.`)
    return existing
  }

  const doc: FoiDocument = {
    id: nextSequence('doc'),
    caseId,
    fileName: input.fileName,
    fileType: input.fileName.split('.').pop()?.toLowerCase() ?? 'pdf',
    fileSize: input.fileSize,
    url: `/mock-storage/${(foiCase?.caseNumber ?? caseId).replace(/\//g, '-')}/${input.fileName}`,
    uploadedBy: actorId,
    isPublic: input.isPublic,
    version: 1,
    checksum: Math.random().toString(16).slice(2, 14),
    kind: input.kind,
    confidentiality: input.confidentiality,
    isRedacted: false,
    redactionCount: 0,
    virusScan: 'clean',
    ocr: input.fileName.toLowerCase().endsWith('.pdf') ? 'complete' : 'not_required',
    retentionLabel: input.retentionLabel,
    retainUntil: new Date(Date.now() + 7 * 365 * 86_400_000).toISOString(),
    versions: [
      {
        version: 1,
        uploadedBy: actorId,
        createdAt: now,
        fileSize: input.fileSize,
        checksum: Math.random().toString(16).slice(2, 14),
        changeNote: 'Initial upload',
      },
    ],
    createdAt: now,
  }

  db.documents.unshift(doc)
  if (foiCase) {
    foiCase.documentCount += 1
    touch(foiCase)
  }
  pushTimeline(caseId, 'document_uploaded', actorId, `Uploaded ${doc.fileName}`, `${input.kind.replace('_', ' ')} · version 1`)
  pushAudit('Document', doc.id, doc.fileName, 'create', actorId, 'Document uploaded and scanned.')
  return doc
}

/** FR-031: redaction saves a severance count and the grounds relied upon. */
export async function redactDocument(
  documentId: string,
  payload: { redactionCount: number; grounds: string },
  actorId: string,
) {
  await delay(480)
  const doc = db.documents.find((d) => d.id === documentId)
  if (!doc) return undefined
  doc.isRedacted = true
  doc.redactionCount = payload.redactionCount
  doc.version += 1
  doc.versions.push({
    version: doc.version,
    uploadedBy: actorId,
    createdAt: new Date().toISOString(),
    fileSize: doc.fileSize,
    checksum: Math.random().toString(16).slice(2, 14),
    changeNote: `Redactions applied — ${payload.grounds}`,
  })
  pushTimeline(doc.caseId, 'document_redacted', actorId, `${payload.redactionCount} redactions applied to ${doc.fileName}`, payload.grounds)
  pushAudit('Document', doc.id, doc.fileName, 'redact', actorId, `${payload.redactionCount} severances applied. Grounds: ${payload.grounds}`)
  return doc
}

export async function publishDocument(documentId: string, actorId: string) {
  await delay(300)
  const doc = db.documents.find((d) => d.id === documentId)
  if (!doc) return undefined
  doc.isPublic = true
  const foiCase = db.cases.find((c) => c.id === doc.caseId)
  pushTimeline(doc.caseId, 'document_published', actorId, `Published ${doc.fileName} to the requestor`)
  pushAudit('Document', doc.id, doc.fileName, 'publish', actorId, 'Document published to the requestor portal.')
  if (foiCase) {
    pushNotification(
      foiCase.requestorId,
      'response_uploaded',
      `New document on ${foiCase.caseNumber}`,
      doc.fileName,
      `/my-requests/${foiCase.id}`,
    )
  }
  return doc
}

/** Recorded so the access log screens reflect what the demo user actually did. */
export function recordAccess(doc: FoiDocument, actorId: string, action: AccessLog['action']) {
  const foiCase = db.cases.find((c) => c.id === doc.caseId)
  db.accessLogs.unshift({
    id: nextSequence('acc'),
    documentId: doc.id,
    documentName: doc.fileName,
    caseId: doc.caseId,
    caseNumber: foiCase?.caseNumber ?? doc.caseId,
    userId: actorId,
    action,
    at: new Date().toISOString(),
    ipAddress: '10.20.4.18',
  })
  if (action === 'download') {
    pushAudit('Document', doc.id, doc.fileName, 'download', actorId, 'Document downloaded.')
  }
}

export async function listDocuments(options: {
  q?: string
  kinds?: FoiDocument['kind'][]
  caseId?: string
  redactedOnly?: boolean
} & QueryOptions = {}): Promise<Paginated<FoiDocument>> {
  await delay()
  const needle = options.q?.trim().toLowerCase()
  const rows = db.documents.filter((d) => {
    if (options.caseId && d.caseId !== options.caseId) return false
    if (options.kinds?.length && !options.kinds.includes(d.kind)) return false
    if (options.redactedOnly && !d.isRedacted) return false
    if (needle && !d.fileName.toLowerCase().includes(needle)) return false
    return true
  })
  return paginate(
    [...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    options,
  )
}

/* ------------------------------------------------------------------ *
 * Court diary
 * ------------------------------------------------------------------ */

export async function listCourtDates(range?: { from: string; to: string }): Promise<CourtDate[]> {
  await delay(180)
  if (!range) return db.courtDates
  return db.courtDates.filter((c) => c.date >= range.from && c.date <= range.to)
}

export async function scheduleCourtDate(
  input: Omit<CourtDate, 'id' | 'createdAt' | 'createdBy' | 'outcome' | 'status'>,
  actorId: string,
): Promise<CourtDate> {
  await delay(400)
  const record: CourtDate = {
    ...input,
    id: nextSequence('crtd'),
    status: 'scheduled',
    outcome: null,
    createdBy: actorId,
    createdAt: new Date().toISOString(),
  }
  db.courtDates.push(record)
  db.courtDates.sort((a, b) => a.date.localeCompare(b.date))

  const foiCase = db.cases.find((c) => c.id === input.caseId)
  if (foiCase) {
    foiCase.courtDateCount += 1
    touch(foiCase)
  }

  pushTimeline(
    input.caseId,
    'court_scheduled',
    actorId,
    `${input.hearingType.replace(/_/g, ' ')} listed at ${input.courtName}`,
    `${input.date} at ${input.time} before ${input.judge}. Suit no. ${input.suitNumber}.`,
  )
  input.counselIds.forEach((counselId) => {
    pushNotification(
      counselId,
      'court_reminder',
      `Hearing listed: ${input.suitNumber}`,
      `${input.courtName} on ${input.date} at ${input.time}.`,
      `/court`,
    )
  })
  return record
}

/** FR-036: recording an outcome closes the loop on a hearing. */
export async function recordCourtOutcome(
  courtDateId: string,
  payload: { status: CourtDate['status']; outcome: string; nextActionDue?: string | null },
  actorId: string,
) {
  await delay(340)
  const record = db.courtDates.find((c) => c.id === courtDateId)
  if (!record) return undefined
  record.status = payload.status
  record.outcome = payload.outcome
  record.nextActionDue = payload.nextActionDue ?? null
  pushTimeline(record.caseId, 'court_outcome', actorId, 'Hearing outcome recorded', payload.outcome)
  pushAudit('CourtDate', record.id, record.suitNumber, 'update', actorId, `Outcome recorded: ${payload.outcome}`)
  return record
}

/* ------------------------------------------------------------------ *
 * Notifications
 * ------------------------------------------------------------------ */

export function notificationsFor(userId: string) {
  return db.notifications.filter((n) => n.userId === userId)
}

export function unreadCount(userId: string) {
  return db.notifications.filter((n) => n.userId === userId && !n.isRead).length
}

export async function markNotificationRead(id: string) {
  await delay(90)
  const item = db.notifications.find((n) => n.id === id)
  if (item) item.isRead = true
  return item
}

export async function markAllNotificationsRead(userId: string) {
  await delay(160)
  db.notifications.forEach((n) => {
    if (n.userId === userId) n.isRead = true
  })
}

/* ------------------------------------------------------------------ *
 * Audit and access logs
 * ------------------------------------------------------------------ */

export interface AuditQuery extends QueryOptions {
  q?: string
  actions?: AuditLog['action'][]
  severities?: AuditLog['severity'][]
  actorIds?: string[]
  entityTypes?: string[]
  dateFrom?: string
  dateTo?: string
}

export async function listAuditLogs(query: AuditQuery = {}): Promise<Paginated<AuditLog>> {
  await delay()
  const needle = query.q?.trim().toLowerCase()
  const rows = db.auditLogs.filter((log) => {
    if (query.actions?.length && !query.actions.includes(log.action)) return false
    if (query.severities?.length && !query.severities.includes(log.severity)) return false
    if (query.actorIds?.length && !query.actorIds.includes(log.performedBy)) return false
    if (query.entityTypes?.length && !query.entityTypes.includes(log.entityType)) return false
    if (query.dateFrom && log.timestamp.slice(0, 10) < query.dateFrom) return false
    if (query.dateTo && log.timestamp.slice(0, 10) > query.dateTo) return false
    if (needle) {
      const haystack = `${log.entityLabel} ${log.details} ${userName(log.performedBy)} ${log.ipAddress}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })
  return paginate(rows, { pageSize: 25, ...query })
}

export async function listAccessLogs(query: { q?: string; action?: AccessLog['action'] } & QueryOptions = {}) {
  await delay()
  const needle = query.q?.trim().toLowerCase()
  const rows = db.accessLogs.filter((log) => {
    if (query.action && log.action !== query.action) return false
    if (needle) {
      const haystack = `${log.documentName} ${log.caseNumber} ${userName(log.userId)} ${log.ipAddress}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })
  return paginate(rows, { pageSize: 25, ...query })
}

/* ------------------------------------------------------------------ *
 * Global search (FR-040)
 * ------------------------------------------------------------------ */

export async function globalSearch(term: string, actor: User, limit = 40): Promise<SearchHit[]> {
  await delay(200)
  const needle = term.trim().toLowerCase()
  if (needle.length < 2) return []

  const hits: SearchHit[] = []
  const scoped = visibleCases(actor, db.cases)
  const caseIds = new Set(scoped.map((c) => c.id))
  const isRequestor = actor.roleId === 'requestor' || actor.roleId === 'external'
  const base = isRequestor ? '/my-requests' : '/cases'

  scoped.forEach((c) => {
    const matchedOn =
      c.caseNumber.toLowerCase().includes(needle)
        ? 'Case number'
        : c.subject.toLowerCase().includes(needle)
          ? 'Subject'
          : c.requestor.name.toLowerCase().includes(needle) || (c.requestor.organization ?? '').toLowerCase().includes(needle)
            ? 'Requestor'
            : c.description.toLowerCase().includes(needle)
              ? 'Request body'
              : c.tags.some((t) => t.toLowerCase().includes(needle))
                ? 'Tag'
                : ''
    if (!matchedOn) return
    hits.push({
      id: c.id,
      type: 'case',
      title: `${c.caseNumber} — ${c.subject}`,
      subtitle: `${c.requestor.organization ?? 'Individual requestor'} · ${c.department}`,
      snippet: c.description.slice(0, 180),
      link: `${base}/${c.id}`,
      matchedOn,
    })
  })

  db.documents.forEach((d) => {
    if (!caseIds.has(d.caseId)) return
    if (!d.fileName.toLowerCase().includes(needle)) return
    const foiCase = db.cases.find((c) => c.id === d.caseId)
    hits.push({
      id: d.id,
      type: 'document',
      title: d.fileName,
      subtitle: `${foiCase?.caseNumber ?? ''} · version ${d.version}`,
      snippet: `${d.kind.replace('_', ' ')} · ${d.isRedacted ? `${d.redactionCount} redactions` : 'no redactions'}`,
      link: `${base}/${d.caseId}?tab=documents`,
      matchedOn: 'File name',
    })
  })

  if (!isRequestor) {
    db.notes.forEach((n) => {
      if (!caseIds.has(n.caseId)) return
      if (n.type === 'internal' && actor.roleId === 'auditor') return
      if (!n.content.toLowerCase().includes(needle)) return
      const foiCase = db.cases.find((c) => c.id === n.caseId)
      hits.push({
        id: n.id,
        type: 'note',
        title: n.type === 'internal' ? 'Internal note' : 'Note to requestor',
        subtitle: `${foiCase?.caseNumber ?? ''} · ${userName(n.userId)}`,
        snippet: n.content.slice(0, 180),
        link: `${base}/${n.caseId}?tab=notes`,
        matchedOn: 'Note content',
      })
    })

    db.courtDates.forEach((c) => {
      const haystack = `${c.suitNumber} ${c.courtName} ${c.judge}`.toLowerCase()
      if (!haystack.includes(needle)) return
      hits.push({
        id: c.id,
        type: 'court_date',
        title: `${c.suitNumber} — ${c.hearingType.replace(/_/g, ' ')}`,
        subtitle: `${c.courtName} · ${c.date} at ${c.time}`,
        snippet: c.outcome ?? c.notes,
        link: `/court?date=${c.date}`,
        matchedOn: 'Suit number',
      })
    })

    reference.users.forEach((u: User) => {
      const haystack = `${u.name} ${u.email} ${u.organization} ${u.position ?? ''}`.toLowerCase()
      if (!haystack.includes(needle)) return
      hits.push({
        id: u.id,
        type: 'user',
        title: u.name,
        subtitle: `${u.position ?? u.organization} · ${u.email}`,
        snippet: `Role: ${u.roleId.replace('_', ' ')} · status ${u.status}`,
        link: `/admin/users?focus=${u.id}`,
        matchedOn: 'Name or email',
      })
    })
  }

  return hits.slice(0, limit)
}

/* ------------------------------------------------------------------ *
 * Internal event writers — every mutation above funnels through these so the
 * timeline, audit trail and notification centre stay consistent.
 * ------------------------------------------------------------------ */

function pushTimeline(
  caseId: string,
  kind: TimelineEvent['kind'],
  actorId: string,
  summary: string,
  detail?: string,
) {
  db.timeline.unshift({
    id: nextSequence('tl'),
    caseId,
    kind,
    actorId,
    at: new Date().toISOString(),
    summary,
    detail,
  })
}

function pushAudit(
  entityType: string,
  entityId: string,
  entityLabel: string,
  action: AuditLog['action'],
  performedBy: string,
  details: string,
) {
  const SEVERITY: Partial<Record<AuditLog['action'], AuditLog['severity']>> = {
    delete: 'critical',
    permission_change: 'critical',
    settings_change: 'critical',
    login_failed: 'warning',
    export: 'notice',
    download: 'notice',
    publish: 'notice',
    redact: 'notice',
  }
  db.auditLogs.unshift({
    id: nextSequence('aud'),
    entityType,
    entityId,
    entityLabel,
    action,
    performedBy,
    timestamp: new Date().toISOString(),
    details,
    ipAddress: '10.20.4.18',
    userAgent: navigator.userAgent,
    severity: SEVERITY[action] ?? 'info',
  })
}

function pushNotification(
  userId: string,
  kind: AppNotification['kind'],
  title: string,
  body: string,
  link: string,
) {
  db.notifications.unshift({
    id: nextSequence('ntf'),
    userId,
    kind,
    title,
    body,
    link,
    at: new Date().toISOString(),
    isRead: false,
    channels: kind === 'mention' ? ['in_app'] : ['in_app', 'email'],
  })
}

/** Exposed so screens can log an explicit user action (exports, views). */
export function logAudit(
  entityType: string,
  entityId: string,
  entityLabel: string,
  action: AuditLog['action'],
  performedBy: string,
  details: string,
) {
  pushAudit(entityType, entityId, entityLabel, action, performedBy, details)
}
