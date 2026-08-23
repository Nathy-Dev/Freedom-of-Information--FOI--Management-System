import type {
  AuditAction,
  AuditSeverity,
  CasePriority,
  CaseSource,
  CaseStatus,
  Confidentiality,
  CourtDateStatus,
  DocumentKind,
  HearingType,
  NotificationKind,
  OcrStatus,
  ResponseFormat,
  RoleId,
  SlaState,
  TaskStatus,
  TemplateCategory,
  TimelineKind,
  VirusScanStatus,
} from '@/types'

/**
 * Presentation metadata for every enum in the domain.
 *
 * Keeping labels + colour classes in one place is what makes status colour-coding
 * consistent across the case cards, tables, calendar, charts and reports
 * (Terms of Reference section 30: "Card components for case summaries with colour-coded status").
 */

export interface Tone {
  label: string
  /** Badge / pill classes. */
  className: string
  /** Solid dot or bar colour, for timelines and calendars. */
  dot: string
  /** Hex, for Recharts series which cannot consume Tailwind classes. */
  hex: string
  description?: string
}

export const STATUS_META: Record<CaseStatus, Tone> = {
  filed: {
    label: 'Filed',
    className: 'bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-400',
    hex: '#93A5A0',
    description: 'Request logged and acknowledged; awaiting triage.',
  },
  in_review: {
    label: 'In Review',
    className: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
    dot: 'bg-brand-500',
    hex: '#008751',
    description: 'Assigned to Legal Unit and under active review.',
  },
  pending_info: {
    label: 'Pending Info',
    className: 'bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200',
    dot: 'bg-gold-400',
    hex: '#EDAF1E',
    description: 'Awaiting clarification or further information from the requestor.',
  },
  responded: {
    label: 'Responded',
    className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
    dot: 'bg-sky-500',
    hex: '#0EA5E9',
    description: 'Response issued to the requestor within the statutory window.',
  },
  escalated: {
    label: 'Escalated',
    className: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
    dot: 'bg-orange-500',
    hex: '#F97316',
    description: 'Escalated internally per the configured escalation policy.',
  },
  appeal: {
    label: 'Appeal',
    className: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
    dot: 'bg-violet-500',
    hex: '#8B5CF6',
    description: 'Requestor has appealed the determination; may proceed to court.',
  },
  closed: {
    label: 'Closed',
    className: 'bg-brand-600/10 text-brand-800 ring-1 ring-inset ring-brand-600/20',
    dot: 'bg-brand-700',
    hex: '#005F39',
    description: 'Concluded with an outcome recorded.',
  },
  rejected: {
    label: 'Rejected',
    className: 'bg-crest-50 text-crest-700 ring-1 ring-inset ring-crest-200',
    dot: 'bg-crest-500',
    hex: '#CE1126',
    description: 'Refused under an exemption in the Freedom of Information Act.',
  },
}

/** Order used by dashboards, funnels and the case list tab strip. */
export const STATUS_ORDER: CaseStatus[] = [
  'filed',
  'in_review',
  'pending_info',
  'responded',
  'escalated',
  'appeal',
  'closed',
  'rejected',
]

export const OPEN_STATUSES: CaseStatus[] = [
  'filed',
  'in_review',
  'pending_info',
  'escalated',
  'appeal',
]

export const CONCLUDED_STATUSES: CaseStatus[] = ['closed', 'rejected']

export const PRIORITY_META: Record<CasePriority, Tone> = {
  low: {
    label: 'Low',
    className: 'bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-300',
    hex: '#C2CEC9',
  },
  medium: {
    label: 'Medium',
    className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
    dot: 'bg-sky-400',
    hex: '#38BDF8',
  },
  high: {
    label: 'High',
    className: 'bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200',
    dot: 'bg-gold-400',
    hex: '#EDAF1E',
  },
  critical: {
    label: 'Critical',
    className: 'bg-crest-50 text-crest-700 ring-1 ring-inset ring-crest-200',
    dot: 'bg-crest-500',
    hex: '#CE1126',
  },
}

export const PRIORITY_ORDER: CasePriority[] = ['critical', 'high', 'medium', 'low']

export const SLA_META: Record<SlaState, Tone> = {
  on_track: {
    label: 'On track',
    className: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
    dot: 'bg-brand-500',
    hex: '#008751',
  },
  due_soon: {
    label: 'Due soon',
    className: 'bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200',
    dot: 'bg-gold-400',
    hex: '#EDAF1E',
  },
  overdue: {
    label: 'Overdue',
    className: 'bg-crest-50 text-crest-700 ring-1 ring-inset ring-crest-200',
    dot: 'bg-crest-500',
    hex: '#CE1126',
  },
  met: {
    label: 'Met',
    className: 'bg-brand-600/10 text-brand-800 ring-1 ring-inset ring-brand-600/20',
    dot: 'bg-brand-700',
    hex: '#005F39',
  },
  breached: {
    label: 'Breached',
    className: 'bg-crest-100 text-crest-800 ring-1 ring-inset ring-crest-300',
    dot: 'bg-crest-700',
    hex: '#8E0B1A',
  },
  not_applicable: {
    label: 'N/A',
    className: 'bg-ink-100 text-ink-500 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-300',
    hex: '#C2CEC9',
  },
}

export const CONFIDENTIALITY_META: Record<Confidentiality, Tone> = {
  public: {
    label: 'Public',
    className: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
    dot: 'bg-brand-400',
    hex: '#2FAE7B',
    description: 'May be disclosed and published in the public disclosure log.',
  },
  internal: {
    label: 'Internal',
    className: 'bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-400',
    hex: '#93A5A0',
    description: 'Visible to HYPREP staff only.',
  },
  confidential: {
    label: 'Confidential',
    className: 'bg-gold-50 text-gold-800 ring-1 ring-inset ring-gold-200',
    dot: 'bg-gold-500',
    hex: '#D4930A',
    description: 'Restricted to assigned personnel; redaction required before release.',
  },
  restricted: {
    label: 'Restricted',
    className: 'bg-crest-50 text-crest-700 ring-1 ring-inset ring-crest-200',
    dot: 'bg-crest-500',
    hex: '#CE1126',
    description: 'Named individuals only; access is logged and reviewed.',
  },
}

export const RESPONSE_FORMAT_LABELS: Record<ResponseFormat, string> = {
  electronic: 'Electronic copy (email / portal)',
  hard_copy: 'Printed hard copy',
  inspection: 'Inspection at HYPREP office',
  certified_copy: 'Certified true copy',
}

export const SOURCE_LABELS: Record<CaseSource, string> = {
  portal: 'Online portal',
  email: 'Email',
  walk_in: 'Walk-in',
  post: 'Postal mail',
  csv_import: 'Bulk import',
  api: 'API',
}

export const DOCUMENT_KIND_META: Record<DocumentKind, Tone> = {
  request: {
    label: 'Request',
    className: 'bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-400',
    hex: '#93A5A0',
  },
  response: {
    label: 'Response',
    className: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
    dot: 'bg-brand-500',
    hex: '#008751',
  },
  evidence: {
    label: 'Evidence',
    className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
    dot: 'bg-sky-500',
    hex: '#0EA5E9',
  },
  court_filing: {
    label: 'Court filing',
    className: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
    dot: 'bg-violet-500',
    hex: '#8B5CF6',
  },
  correspondence: {
    label: 'Correspondence',
    className: 'bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200',
    dot: 'bg-gold-400',
    hex: '#EDAF1E',
  },
  internal_memo: {
    label: 'Internal memo',
    className: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
    dot: 'bg-orange-500',
    hex: '#F97316',
  },
}

export const VIRUS_SCAN_LABELS: Record<VirusScanStatus, string> = {
  pending: 'Scan queued',
  clean: 'Scanned - clean',
  infected: 'Threat detected',
  skipped: 'Scan skipped',
}

export const OCR_LABELS: Record<OcrStatus, string> = {
  not_required: 'Not required',
  queued: 'OCR queued',
  processing: 'OCR running',
  complete: 'Searchable',
  failed: 'OCR failed',
}

export const HEARING_TYPE_LABELS: Record<HearingType, string> = {
  mention: 'Mention',
  motion: 'Motion',
  hearing: 'Hearing',
  judgment: 'Judgment',
  adoption_of_address: 'Adoption of address',
  pre_trial: 'Pre-trial conference',
}

export const COURT_STATUS_META: Record<CourtDateStatus, Tone> = {
  scheduled: {
    label: 'Scheduled',
    className: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
    dot: 'bg-brand-500',
    hex: '#008751',
  },
  held: {
    label: 'Held',
    className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
    dot: 'bg-sky-500',
    hex: '#0EA5E9',
  },
  adjourned: {
    label: 'Adjourned',
    className: 'bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200',
    dot: 'bg-gold-400',
    hex: '#EDAF1E',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-ink-100 text-ink-500 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-300',
    hex: '#C2CEC9',
  },
}

export const TASK_STATUS_META: Record<TaskStatus, Tone> = {
  open: {
    label: 'Open',
    className: 'bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-400',
    hex: '#93A5A0',
  },
  in_progress: {
    label: 'In progress',
    className: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200',
    dot: 'bg-brand-500',
    hex: '#008751',
  },
  done: {
    label: 'Done',
    className: 'bg-brand-600/10 text-brand-800 ring-1 ring-inset ring-brand-600/20',
    dot: 'bg-brand-700',
    hex: '#005F39',
  },
  blocked: {
    label: 'Blocked',
    className: 'bg-crest-50 text-crest-700 ring-1 ring-inset ring-crest-200',
    dot: 'bg-crest-500',
    hex: '#CE1126',
  },
}

export const TIMELINE_META: Record<TimelineKind, { label: string; dot: string; icon: string }> = {
  created: { label: 'Request filed', dot: 'bg-ink-400', icon: 'FilePlus2' },
  acknowledged: { label: 'Acknowledgement sent', dot: 'bg-sky-500', icon: 'MailCheck' },
  assigned: { label: 'Assigned', dot: 'bg-brand-500', icon: 'UserCheck' },
  status_changed: { label: 'Status changed', dot: 'bg-brand-500', icon: 'ArrowRightLeft' },
  note_added: { label: 'Note added', dot: 'bg-ink-400', icon: 'MessageSquare' },
  document_uploaded: { label: 'Document uploaded', dot: 'bg-sky-500', icon: 'Upload' },
  document_published: { label: 'Response published', dot: 'bg-brand-600', icon: 'Send' },
  document_redacted: { label: 'Document redacted', dot: 'bg-gold-500', icon: 'EyeOff' },
  court_scheduled: { label: 'Court date scheduled', dot: 'bg-violet-500', icon: 'Gavel' },
  court_outcome: { label: 'Court outcome recorded', dot: 'bg-violet-600', icon: 'Scale' },
  linked: { label: 'Case linked', dot: 'bg-sky-500', icon: 'Link2' },
  escalated: { label: 'Escalated', dot: 'bg-orange-500', icon: 'TrendingUp' },
  appeal_filed: { label: 'Appeal filed', dot: 'bg-violet-500', icon: 'Undo2' },
  closed: { label: 'Case closed', dot: 'bg-brand-700', icon: 'CheckCircle2' },
  reopened: { label: 'Case reopened', dot: 'bg-gold-500', icon: 'RotateCcw' },
  sla_warning: { label: 'SLA warning', dot: 'bg-gold-500', icon: 'AlarmClock' },
  sla_breach: { label: 'SLA breach', dot: 'bg-crest-500', icon: 'AlertTriangle' },
}

export const AUDIT_ACTION_META: Record<AuditAction, { label: string; className: string }> = {
  create: { label: 'Create', className: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200' },
  update: { label: 'Update', className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200' },
  delete: { label: 'Delete', className: 'bg-crest-50 text-crest-700 ring-1 ring-inset ring-crest-200' },
  login: { label: 'Login', className: 'bg-ink-100 text-ink-700 ring-1 ring-inset ring-ink-200' },
  login_failed: {
    label: 'Login failed',
    className: 'bg-crest-50 text-crest-700 ring-1 ring-inset ring-crest-200',
  },
  logout: { label: 'Logout', className: 'bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200' },
  export: { label: 'Export', className: 'bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200' },
  permission_change: {
    label: 'Permission change',
    className: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200',
  },
  download: { label: 'Download', className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200' },
  view: { label: 'View', className: 'bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200' },
  publish: { label: 'Publish', className: 'bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200' },
  redact: { label: 'Redact', className: 'bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200' },
  settings_change: {
    label: 'Settings change',
    className: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200',
  },
}

export const AUDIT_SEVERITY_META: Record<AuditSeverity, Tone> = {
  info: {
    label: 'Info',
    className: 'bg-ink-100 text-ink-600 ring-1 ring-inset ring-ink-200',
    dot: 'bg-ink-400',
    hex: '#93A5A0',
  },
  notice: {
    label: 'Notice',
    className: 'bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200',
    dot: 'bg-sky-500',
    hex: '#0EA5E9',
  },
  warning: {
    label: 'Warning',
    className: 'bg-gold-50 text-gold-700 ring-1 ring-inset ring-gold-200',
    dot: 'bg-gold-500',
    hex: '#D4930A',
  },
  critical: {
    label: 'Critical',
    className: 'bg-crest-50 text-crest-700 ring-1 ring-inset ring-crest-200',
    dot: 'bg-crest-500',
    hex: '#CE1126',
  },
}

export const NOTIFICATION_META: Record<NotificationKind, { label: string; icon: string }> = {
  case_assigned: { label: 'Case assigned to me', icon: 'UserCheck' },
  status_changed: { label: 'Case status changed', icon: 'ArrowRightLeft' },
  response_uploaded: { label: 'Response uploaded', icon: 'FileUp' },
  due_soon: { label: 'Statutory deadline approaching', icon: 'AlarmClock' },
  overdue: { label: 'Request overdue', icon: 'AlertTriangle' },
  court_reminder: { label: 'Upcoming court date', icon: 'Gavel' },
  mention: { label: 'I was mentioned in a note', icon: 'AtSign' },
  task_assigned: { label: 'Task assigned to me', icon: 'CheckSquare' },
  admin_alert: { label: 'System and admin alerts', icon: 'ShieldAlert' },
  appeal_filed: { label: 'Appeal filed', icon: 'Undo2' },
}

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  acknowledgement: 'Acknowledgement',
  response: 'Response',
  refusal: 'Refusal / exemption',
  notice: 'Notice',
  affidavit: 'Affidavit',
  internal: 'Internal memo',
}

export const ROLE_LABELS: Record<RoleId, string> = {
  super_admin: 'Super-Admin',
  admin: 'Admin',
  legal: 'Legal Unit',
  clerk: 'Clerk / Support',
  requestor: 'Requestor',
  auditor: 'Auditor',
  external: 'External Stakeholder',
}

/** Chart series palette - brand-led, colour-blind safe ordering. */
export const CHART_COLORS = [
  '#008751',
  '#0EA5E9',
  '#EDAF1E',
  '#8B5CF6',
  '#CE1126',
  '#2FAE7B',
  '#F97316',
  '#677974',
]

/** Nigerian FOI Act 2011, section 4: 7 working days to respond. */
export const STATUTORY_RESPONSE_DAYS = 7

export const FILE_TYPE_ICONS: Record<string, string> = {
  pdf: 'FileText',
  doc: 'FileText',
  docx: 'FileText',
  xls: 'FileSpreadsheet',
  xlsx: 'FileSpreadsheet',
  csv: 'FileSpreadsheet',
  png: 'FileImage',
  jpg: 'FileImage',
  jpeg: 'FileImage',
  zip: 'FileArchive',
}
