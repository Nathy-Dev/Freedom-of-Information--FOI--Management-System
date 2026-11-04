import type {
  AccessLog,
  AppNotification,
  AuditLog,
  CaseNote,
  CaseTask,
  CourtDate,
  Department,
  FoiCase,
  FoiDocument,
  LetterTemplate,
  LegalTeam,
  SavedReport,
  SavedView,
  ServiceHealth,
  SystemSettings,
  TaxonomyTerm,
  TimelineEvent,
  User,
  Webhook,
  ApiClient,
  BackupRecord,
  Role,
  Court,
} from '@/types'

type RawDocument = { _id: string; [key: string]: unknown }

function raw(value: unknown): RawDocument {
  return (value ?? {}) as RawDocument
}

function id(value: unknown): string {
  return String(value ?? '')
}

function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function mapUser(value: unknown): User {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id) } as unknown as User
}

export function mapCase(value: unknown): FoiCase {
  const row = raw(value)
  return {
    ...row,
    id: id(row._id ?? row.id),
    requestorUserId: row.requestorUserId == null ? undefined : id(row.requestorUserId),
    assignedTo: row.assignedTo == null ? null : id(row.assignedTo),
    assignedTeamId: row.assignedTeamId == null ? null : id(row.assignedTeamId),
    dateClosed: row.dateClosed == null ? null : String(row.dateClosed),
    linkedCaseIds: list(row.linkedCaseIds).map(id),
  } as unknown as FoiCase
}

export function mapDocument(value: unknown): FoiDocument {
  const row = raw(value)
  const versions = list(row.versions).map((version) => {
    const entry = raw(version)
    return { ...entry, uploadedBy: id(entry.uploadedBy) }
  })
  return {
    ...row,
    id: id(row._id ?? row.id),
    caseId: id(row.caseId),
    uploadedBy: id(row.uploadedBy),
    url: typeof row.url === 'string' ? row.url : '',
    versions,
  } as unknown as FoiDocument
}

export function mapNote(value: unknown): CaseNote {
  const row = raw(value)
  return {
    ...row,
    id: id(row._id ?? row.id),
    caseId: id(row.caseId),
    userId: id(row.userId),
    mentions: list(row.mentions).map(id),
    attachmentIds: list(row.attachmentIds).map(id),
  } as unknown as CaseNote
}

export function mapTask(value: unknown): CaseTask {
  const row = raw(value)
  return {
    ...row,
    id: id(row._id ?? row.id),
    caseId: id(row.caseId),
    assigneeId: id(row.assigneeId),
    createdBy: id(row.createdBy),
  } as unknown as CaseTask
}

export function mapCourtDate(value: unknown): CourtDate {
  const row = raw(value)
  return {
    ...row,
    id: id(row._id ?? row.id),
    caseId: id(row.caseId),
    courtId: row.courtId == null ? '' : id(row.courtId),
    counselIds: list(row.counselIds).map(id),
    createdBy: id(row.createdBy),
    outcome: row.outcome == null ? null : String(row.outcome),
    nextActionDue: row.nextActionDue == null ? null : String(row.nextActionDue),
  } as unknown as CourtDate
}

export function mapTimeline(value: unknown): TimelineEvent {
  const row = raw(value)
  return {
    ...row,
    id: id(row._id ?? row.id),
    caseId: id(row.caseId),
    actorId: row.actorId == null ? 'system' : id(row.actorId),
  } as unknown as TimelineEvent
}

export function mapAuditLog(value: unknown): AuditLog {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id), performedBy: id(row.performedBy) } as unknown as AuditLog
}

export function mapAccessLog(value: unknown): AccessLog {
  const row = raw(value)
  return {
    ...row,
    id: id(row._id ?? row.id),
    documentId: id(row.documentId),
    caseId: id(row.caseId),
    userId: id(row.userId),
  } as unknown as AccessLog
}

export function mapNotification(value: unknown): AppNotification {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id), userId: id(row.userId) } as unknown as AppNotification
}

export function mapTemplate(value: unknown): LetterTemplate {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id), updatedBy: id(row.updatedBy) } as unknown as LetterTemplate
}

export function mapReport(value: unknown): SavedReport {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id), creatorId: id(row.creatorId), lastRun: row.lastRun ?? null, nextRun: row.nextRun ?? null } as unknown as SavedReport
}

export function mapView(value: unknown): SavedView {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id), ownerId: id(row.ownerId) } as unknown as SavedView
}

export function mapDepartment(value: unknown): Department {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id), headUserId: row.headUserId == null ? null : id(row.headUserId) } as unknown as Department
}

export function mapCourt(value: unknown): Court {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id) } as unknown as Court
}

export function mapLegalTeam(value: unknown): LegalTeam {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id), leadUserId: row.leadUserId == null ? '' : id(row.leadUserId), memberIds: list(row.memberIds).map(id) } as unknown as LegalTeam
}

export function mapTaxonomyTerm(value: unknown): TaxonomyTerm {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id) } as unknown as TaxonomyTerm
}

export function mapSettings(value: unknown): SystemSettings | null {
  if (!value) return null
  const { _id: _systemId, _creationTime: _createdAt, ...settings } = raw(value)
  return settings as unknown as SystemSettings
}

export function mapHealth(value: unknown): ServiceHealth {
  return raw(value) as unknown as ServiceHealth
}

export function mapBackup(value: unknown): BackupRecord {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id) } as unknown as BackupRecord
}

export function mapWebhook(value: unknown): Webhook {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id), lastDeliveryAt: row.lastDeliveryAt ?? null, lastStatus: row.lastStatus ?? null } as unknown as Webhook
}

export function mapApiClient(value: unknown): ApiClient {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id), lastUsedAt: row.lastUsedAt ?? null } as unknown as ApiClient
}

export function mapRole(value: unknown): Role {
  const row = raw(value)
  return { ...row, id: id(row._id ?? row.id) } as unknown as Role
}
