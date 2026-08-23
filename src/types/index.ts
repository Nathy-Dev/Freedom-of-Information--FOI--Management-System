/**
 * Domain model for the HYPREP FOI Management System.
 *
 * Field semantics track the Terms of Reference (section 27, Data Model) one-for-one;
 * names are camelCase here because this is the client contract - the REST payload
 * mapping (snake_case) will be owned by the backend adapter.
 */

/* ------------------------------------------------------------------ *
 * Access control (FR-003)
 * ------------------------------------------------------------------ */

export type RoleId =
  | 'super_admin'
  | 'admin'
  | 'legal'
  | 'clerk'
  | 'requestor'
  | 'auditor'
  | 'external'

export type Permission =
  /* Cases */
  | 'case:read:all'
  | 'case:read:assigned'
  | 'case:read:own'
  | 'case:create'
  | 'case:update'
  | 'case:assign'
  | 'case:close'
  | 'case:escalate'
  | 'case:link'
  | 'case:delete'
  | 'case:bulk'
  | 'case:triage'
  /* Documents */
  | 'document:read'
  | 'document:upload'
  | 'document:download'
  | 'document:publish'
  | 'document:redact'
  | 'document:delete'
  | 'document:retention'
  /* Notes and collaboration */
  | 'note:read:internal'
  | 'note:write:internal'
  | 'note:write:public'
  | 'task:manage'
  /* Court */
  | 'court:read'
  | 'court:write'
  | 'court:outcome'
  /* Templates */
  | 'template:read'
  | 'template:manage'
  /* Reports */
  | 'report:read'
  | 'report:build'
  | 'report:schedule'
  | 'report:export'
  /* Users and roles */
  | 'user:read'
  | 'user:write'
  | 'user:delete'
  | 'role:manage'
  /* Organisation */
  | 'org:manage'
  /* System (super-admin) */
  | 'system:settings'
  | 'system:monitor'
  | 'system:backup'
  | 'system:export'
  | 'system:retention'
  /* Audit */
  | 'audit:read'
  | 'audit:export'
  /* Integration */
  | 'integration:manage'
  | 'import:bulk'

export interface Role {
  id: RoleId | string
  name: string
  description: string
  permissions: Permission[]
  isSystem: boolean
  userCount?: number
}

/* ------------------------------------------------------------------ *
 * Users (FR-004)
 * ------------------------------------------------------------------ */

export type UserStatus = 'active' | 'invited' | 'suspended' | 'locked'

export interface User {
  id: string
  name: string
  email: string
  roleId: RoleId
  phone?: string
  organization: string
  position?: string
  department?: string
  teamId?: string
  status: UserStatus
  avatarColor: string
  initials: string
  mfaEnabled: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

/* ------------------------------------------------------------------ *
 * FOI cases (FR-010 through FR-025)
 * ------------------------------------------------------------------ */

export type CaseStatus =
  | 'filed'
  | 'in_review'
  | 'pending_info'
  | 'responded'
  | 'escalated'
  | 'appeal'
  | 'closed'
  | 'rejected'

export type CasePriority = 'low' | 'medium' | 'high' | 'critical'

export type Confidentiality = 'public' | 'internal' | 'confidential' | 'restricted'

export type ResponseFormat = 'electronic' | 'hard_copy' | 'inspection' | 'certified_copy'

export type CaseSource = 'portal' | 'email' | 'walk_in' | 'post' | 'csv_import' | 'api'

export type SlaState = 'on_track' | 'due_soon' | 'overdue' | 'met' | 'breached' | 'not_applicable'

export interface RequestorSnapshot {
  name: string
  email: string
  phone?: string
  organization?: string
  isJournalist?: boolean
}

export interface FoiCase {
  id: string
  caseNumber: string
  requestorId: string
  requestor: RequestorSnapshot
  subject: string
  description: string
  assignedTo: string | null
  assignedTeamId: string | null
  status: CaseStatus
  priority: CasePriority
  confidentiality: Confidentiality
  responseFormat: ResponseFormat
  source: CaseSource
  tags: string[]
  department: string
  dateSubmitted: string
  statutoryDueDate: string
  dateClosed: string | null
  closureReason?: string
  outcomeCode?: string
  linkedCaseIds: string[]
  isAppeal: boolean
  appealOfCaseId?: string
  respondedAt?: string
  documentCount: number
  noteCount: number
  courtDateCount: number
  createdAt: string
  updatedAt: string
}

/** Derived, never persisted - computed in src/lib/sla.ts */
export interface CaseSla {
  state: SlaState
  daysRemaining: number
  daysElapsed: number
  totalDays: number
  percentElapsed: number
  label: string
}

/* ------------------------------------------------------------------ *
 * Documents (section 12)
 * ------------------------------------------------------------------ */

export type DocumentKind =
  | 'request'
  | 'response'
  | 'evidence'
  | 'court_filing'
  | 'correspondence'
  | 'internal_memo'

export type VirusScanStatus = 'pending' | 'clean' | 'infected' | 'skipped'

export type OcrStatus = 'not_required' | 'queued' | 'processing' | 'complete' | 'failed'

export interface DocumentVersion {
  version: number
  uploadedBy: string
  createdAt: string
  fileSize: number
  checksum: string
  changeNote?: string
}

export interface FoiDocument {
  id: string
  caseId: string
  fileName: string
  fileType: string
  fileSize: number
  url: string
  uploadedBy: string
  isPublic: boolean
  version: number
  checksum: string
  kind: DocumentKind
  confidentiality: Confidentiality
  isRedacted: boolean
  redactionCount: number
  virusScan: VirusScanStatus
  ocr: OcrStatus
  retentionLabel: string
  retainUntil: string
  versions: DocumentVersion[]
  createdAt: string
}

/* ------------------------------------------------------------------ *
 * Notes, tasks, timeline (FR-021, FR-022)
 * ------------------------------------------------------------------ */

export interface CaseNote {
  id: string
  caseId: string
  userId: string
  type: 'internal' | 'public'
  content: string
  mentions: string[]
  attachmentIds: string[]
  isPinned: boolean
  createdAt: string
}

export type TaskStatus = 'open' | 'in_progress' | 'done' | 'blocked'

export interface CaseTask {
  id: string
  caseId: string
  title: string
  assigneeId: string
  dueDate: string
  status: TaskStatus
  createdBy: string
  createdAt: string
}

export type TimelineKind =
  | 'created'
  | 'acknowledged'
  | 'assigned'
  | 'status_changed'
  | 'note_added'
  | 'document_uploaded'
  | 'document_published'
  | 'document_redacted'
  | 'court_scheduled'
  | 'court_outcome'
  | 'linked'
  | 'escalated'
  | 'appeal_filed'
  | 'closed'
  | 'reopened'
  | 'sla_warning'
  | 'sla_breach'

export interface TimelineEvent {
  id: string
  caseId: string
  kind: TimelineKind
  actorId: string
  at: string
  summary: string
  detail?: string
}

/* ------------------------------------------------------------------ *
 * Court scheduling (section 11)
 * ------------------------------------------------------------------ */

export type HearingType =
  | 'mention'
  | 'motion'
  | 'hearing'
  | 'judgment'
  | 'adoption_of_address'
  | 'pre_trial'

export type CourtDateStatus = 'scheduled' | 'held' | 'adjourned' | 'cancelled'

export interface CourtDate {
  id: string
  caseId: string
  suitNumber: string
  date: string
  time: string
  durationMinutes: number
  courtId: string
  courtName: string
  location: string
  judge: string
  hearingType: HearingType
  status: CourtDateStatus
  counselIds: string[]
  notes: string
  outcome: string | null
  nextActionDue: string | null
  reminderLeadDays: number[]
  createdBy: string
  createdAt: string
}

/* ------------------------------------------------------------------ *
 * Audit and access logs (section 16)
 * ------------------------------------------------------------------ */

export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'login_failed'
  | 'logout'
  | 'export'
  | 'permission_change'
  | 'download'
  | 'view'
  | 'publish'
  | 'redact'
  | 'settings_change'

export type AuditSeverity = 'info' | 'notice' | 'warning' | 'critical'

export interface AuditLog {
  id: string
  entityType: string
  entityId: string
  entityLabel: string
  action: AuditAction
  performedBy: string
  timestamp: string
  details: string
  ipAddress: string
  userAgent: string
  severity: AuditSeverity
}

export interface AccessLog {
  id: string
  documentId: string
  documentName: string
  caseId: string
  caseNumber: string
  userId: string
  action: 'view' | 'download' | 'print' | 'denied'
  at: string
  ipAddress: string
}

/* ------------------------------------------------------------------ *
 * Reporting (section 14)
 * ------------------------------------------------------------------ */

export type ReportPeriod = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom'

export type ReportFormat = 'csv' | 'pdf' | 'xlsx'

export type ScheduleCadence = 'none' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

export type ReportMetric =
  | 'count'
  | 'avg_response_days'
  | 'sla_compliance'
  | 'overdue_count'
  | 'appeals'
  | 'escalations'

export type ReportGroupBy =
  | 'status'
  | 'department'
  | 'assignee'
  | 'priority'
  | 'month'
  | 'requestor'

export interface ReportFilters {
  period: ReportPeriod
  dateFrom?: string
  dateTo?: string
  statuses: CaseStatus[]
  departments: string[]
  priorities: CasePriority[]
  assignees: string[]
  tags: string[]
  groupBy: ReportGroupBy
  metrics: ReportMetric[]
}

export interface SavedReport {
  id: string
  name: string
  description: string
  creatorId: string
  filters: ReportFilters
  cadence: ScheduleCadence
  recipients: string[]
  format: ReportFormat
  lastRun: string | null
  nextRun: string | null
  createdAt: string
}

export interface SavedView {
  id: string
  name: string
  ownerId: string
  isShared: boolean
  filters: CaseFilters
  createdAt: string
}

/* ------------------------------------------------------------------ *
 * Notifications (section 13)
 * ------------------------------------------------------------------ */

export type NotificationKind =
  | 'case_assigned'
  | 'status_changed'
  | 'response_uploaded'
  | 'due_soon'
  | 'overdue'
  | 'court_reminder'
  | 'mention'
  | 'task_assigned'
  | 'admin_alert'
  | 'appeal_filed'

export type NotificationChannel = 'in_app' | 'email' | 'sms'

export interface AppNotification {
  id: string
  userId: string
  kind: NotificationKind
  title: string
  body: string
  link: string
  at: string
  isRead: boolean
  channels: NotificationChannel[]
}

export interface NotificationPreference {
  kind: NotificationKind
  label: string
  description: string
  inApp: boolean
  email: boolean
  sms: boolean
}

/* ------------------------------------------------------------------ *
 * Templates (FR-033)
 * ------------------------------------------------------------------ */

export type TemplateCategory =
  | 'acknowledgement'
  | 'response'
  | 'refusal'
  | 'notice'
  | 'affidavit'
  | 'internal'

export interface LetterTemplate {
  id: string
  name: string
  category: TemplateCategory
  description: string
  body: string
  mergeFields: string[]
  updatedBy: string
  updatedAt: string
  usageCount: number
}

/* ------------------------------------------------------------------ *
 * Organisation reference data (section 17)
 * ------------------------------------------------------------------ */

export interface Department {
  id: string
  name: string
  code: string
  headUserId: string | null
  caseCount: number
}

export interface Court {
  id: string
  name: string
  division: string
  state: string
  address: string
}

export interface LegalTeam {
  id: string
  name: string
  leadUserId: string
  memberIds: string[]
  focus: string
}

export interface TaxonomyTerm {
  id: string
  label: string
  kind: 'tag' | 'category' | 'outcome_code' | 'closure_reason' | 'retention_label'
  description?: string
  color?: string
  usageCount: number
}

/* ------------------------------------------------------------------ *
 * System settings (section 17)
 * ------------------------------------------------------------------ */

export interface SystemSettings {
  organizationName: string
  statutoryResponseDays: number
  slaWarningThresholdDays: number
  selfRegistrationEnabled: boolean
  mfaRequiredForPrivileged: boolean
  sessionTimeoutMinutes: number
  passwordMinLength: number
  passwordRotationDays: number
  lockoutAttempts: number
  maxUploadSizeMb: number
  allowedFileTypes: string[]
  virusScanEnabled: boolean
  ocrEnabled: boolean
  defaultRetentionYears: number
  smtpHost: string
  smtpPort: number
  smtpFromAddress: string
  storageProvider: 's3' | 'azure_blob' | 'on_premise'
  storageBucket: string
  timezone: string
  ssoEnabled: boolean
  ssoProvider: 'saml' | 'oauth2' | 'none'
}

export interface ServiceHealth {
  name: string
  status: 'operational' | 'degraded' | 'down'
  latencyMs: number
  detail: string
}

export interface BackupRecord {
  id: string
  startedAt: string
  type: 'full' | 'incremental'
  sizeMb: number
  status: 'success' | 'running' | 'failed'
  target: string
  restoreTested: boolean
}

export interface Webhook {
  id: string
  url: string
  events: string[]
  isActive: boolean
  secretMasked: string
  lastDeliveryAt: string | null
  lastStatus: number | null
  createdAt: string
}

export interface ApiClient {
  id: string
  name: string
  clientId: string
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
  isActive: boolean
}

/* ------------------------------------------------------------------ *
 * Query contracts
 * ------------------------------------------------------------------ */

export interface CaseFilters {
  q?: string
  statuses?: CaseStatus[]
  priorities?: CasePriority[]
  departments?: string[]
  assignees?: string[]
  tags?: string[]
  sla?: SlaState[]
  confidentiality?: Confidentiality[]
  dateFrom?: string
  dateTo?: string
  hasCourtDate?: boolean
  isAppeal?: boolean
}

export type SortDir = 'asc' | 'desc'

export interface QueryOptions {
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: SortDir
}

export interface Paginated<T> {
  rows: T[]
  total: number
  page: number
  pageSize: number
  pageCount: number
}

export interface SearchHit {
  id: string
  type: 'case' | 'document' | 'user' | 'court_date' | 'note'
  title: string
  subtitle: string
  snippet: string
  link: string
  matchedOn: string
}

/* ------------------------------------------------------------------ *
 * Dashboard aggregates
 * ------------------------------------------------------------------ */

export interface StatusCount {
  status: CaseStatus
  count: number
}

export interface TrendPoint {
  period: string
  received: number
  responded: number
  closed: number
}

export interface WorkloadRow {
  userId: string
  open: number
  overdue: number
  closedThisMonth: number
}

export interface AgingBucket {
  bucket: string
  count: number
}

export interface DepartmentRow {
  department: string
  count: number
  avgDays: number
  slaRate: number
}

export interface RequestorRow {
  name: string
  organization: string
  count: number
  appeals: number
}

export interface DashboardMetrics {
  totalCases: number
  openCases: number
  overdueCases: number
  dueSoonCases: number
  closedThisMonth: number
  avgResponseDays: number
  slaComplianceRate: number
  appealsCount: number
  escalationsCount: number
  statusCounts: StatusCount[]
  trend: TrendPoint[]
  aging: AgingBucket[]
  byDepartment: DepartmentRow[]
  topRequestors: RequestorRow[]
  workload: WorkloadRow[]
}
