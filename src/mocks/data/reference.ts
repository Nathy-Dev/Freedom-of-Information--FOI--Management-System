import type {
  BackupRecord,
  Court,
  Department,
  LegalTeam,
  NotificationPreference,
  ServiceHealth,
  SystemSettings,
  TaxonomyTerm,
} from '@/types'
import { NOTIFICATION_META, STATUTORY_RESPONSE_DAYS } from '@/lib/constants'

/**
 * Organisation reference data (Terms of Reference section 17).
 * Grounded in HYPREP's actual operating context: Ogoniland remediation,
 * Rivers State, Federal Ministry of Environment.
 */

export const departments: Department[] = [
  { id: 'dep-legal', name: 'Legal Unit', code: 'LEG', headUserId: 'usr-004', caseCount: 0 },
  { id: 'dep-remediation', name: 'Remediation & Restoration', code: 'REM', headUserId: 'usr-012', caseCount: 0 },
  { id: 'dep-procurement', name: 'Procurement', code: 'PRC', headUserId: 'usr-013', caseCount: 0 },
  { id: 'dep-finance', name: 'Finance & Accounts', code: 'FIN', headUserId: 'usr-014', caseCount: 0 },
  { id: 'dep-community', name: 'Community Engagement', code: 'CEG', headUserId: 'usr-015', caseCount: 0 },
  { id: 'dep-hse', name: 'Health, Safety & Environment', code: 'HSE', headUserId: 'usr-016', caseCount: 0 },
  { id: 'dep-me', name: 'Monitoring & Evaluation', code: 'M&E', headUserId: 'usr-017', caseCount: 0 },
  { id: 'dep-water', name: 'Water & Sanitation', code: 'WAS', headUserId: null, caseCount: 0 },
  { id: 'dep-livelihood', name: 'Livelihood & Empowerment', code: 'LIV', headUserId: null, caseCount: 0 },
  { id: 'dep-pr', name: 'Public Relations', code: 'PRL', headUserId: null, caseCount: 0 },
  { id: 'dep-ict', name: 'ICT & Data Management', code: 'ICT', headUserId: 'usr-001', caseCount: 0 },
]

export const departmentNames = departments.map((d) => d.name)

export const courts: Court[] = [
  {
    id: 'crt-fhc-ph',
    name: 'Federal High Court',
    division: 'Port Harcourt Judicial Division',
    state: 'Rivers',
    address: 'Moscow Road, Port Harcourt, Rivers State',
  },
  {
    id: 'crt-fhc-abj',
    name: 'Federal High Court',
    division: 'Abuja Judicial Division',
    state: 'FCT',
    address: 'Shehu Shagari Way, Maitama, Abuja',
  },
  {
    id: 'crt-coa-ph',
    name: 'Court of Appeal',
    division: 'Port Harcourt Division',
    state: 'Rivers',
    address: 'Aba Road, Port Harcourt, Rivers State',
  },
  {
    id: 'crt-fhc-yen',
    name: 'Federal High Court',
    division: 'Yenagoa Judicial Division',
    state: 'Bayelsa',
    address: 'Ovom Road, Yenagoa, Bayelsa State',
  },
  {
    id: 'crt-nicn-ph',
    name: 'National Industrial Court',
    division: 'Port Harcourt Division',
    state: 'Rivers',
    address: 'Elelenwo Street, GRA, Port Harcourt',
  },
  {
    id: 'crt-hc-rivers',
    name: 'Rivers State High Court',
    division: 'Port Harcourt Judicial Division',
    state: 'Rivers',
    address: 'Justice Layout, Port Harcourt, Rivers State',
  },
]

export const legalTeams: LegalTeam[] = [
  {
    id: 'team-disclosure',
    name: 'Disclosure & Compliance Team',
    leadUserId: 'usr-004',
    memberIds: ['usr-004', 'usr-005', 'usr-008'],
    focus: 'FOI determinations, exemption analysis and statutory correspondence',
  },
  {
    id: 'team-litigation',
    name: 'Litigation Team',
    leadUserId: 'usr-006',
    memberIds: ['usr-006', 'usr-007', 'usr-009'],
    focus: 'Court appearances, appeals and judicial review proceedings',
  },
  {
    id: 'team-contracts',
    name: 'Contracts & Advisory Team',
    leadUserId: 'usr-007',
    memberIds: ['usr-007', 'usr-010'],
    focus: 'Procurement disclosure, contractor records and commercial confidentiality',
  },
]

export const tags: TaxonomyTerm[] = [
  { id: 'tag-remediation', label: 'Remediation', kind: 'tag', color: 'brand', usageCount: 0 },
  { id: 'tag-procurement', label: 'Procurement', kind: 'tag', color: 'sky', usageCount: 0 },
  { id: 'tag-budget', label: 'Budget & Expenditure', kind: 'tag', color: 'gold', usageCount: 0 },
  { id: 'tag-contractor', label: 'Contractor Records', kind: 'tag', color: 'violet', usageCount: 0 },
  { id: 'tag-water', label: 'Water Quality', kind: 'tag', color: 'sky', usageCount: 0 },
  { id: 'tag-health', label: 'Public Health', kind: 'tag', color: 'crest', usageCount: 0 },
  { id: 'tag-livelihood', label: 'Livelihood Programme', kind: 'tag', color: 'brand', usageCount: 0 },
  { id: 'tag-eia', label: 'Environmental Assessment', kind: 'tag', color: 'brand', usageCount: 0 },
  { id: 'tag-community', label: 'Community Relations', kind: 'tag', color: 'gold', usageCount: 0 },
  { id: 'tag-media', label: 'Media Enquiry', kind: 'tag', color: 'violet', usageCount: 0 },
  { id: 'tag-litigation', label: 'Litigation Risk', kind: 'tag', color: 'crest', usageCount: 0 },
  { id: 'tag-personnel', label: 'Personnel', kind: 'tag', color: 'ink', usageCount: 0 },
  { id: 'tag-audit', label: 'Audit Query', kind: 'tag', color: 'gold', usageCount: 0 },
  { id: 'tag-urgent', label: 'Ministerial Interest', kind: 'tag', color: 'crest', usageCount: 0 },
]

export const tagLabels = tags.map((t) => t.label)

export const outcomeCodes: TaxonomyTerm[] = [
  {
    id: 'oc-granted-full',
    label: 'Granted in full',
    kind: 'outcome_code',
    description: 'All requested records released without redaction.',
    usageCount: 0,
  },
  {
    id: 'oc-granted-part',
    label: 'Granted in part',
    kind: 'outcome_code',
    description: 'Records released with redactions applied under a statutory exemption.',
    usageCount: 0,
  },
  {
    id: 'oc-refused-exempt',
    label: 'Refused - exempt',
    kind: 'outcome_code',
    description: 'Refused under sections 11, 12, 14, 15 or 19 of the FOI Act 2011.',
    usageCount: 0,
  },
  {
    id: 'oc-refused-notheld',
    label: 'Refused - records not held',
    kind: 'outcome_code',
    description: 'HYPREP does not hold the records described.',
    usageCount: 0,
  },
  {
    id: 'oc-transferred',
    label: 'Transferred to another institution',
    kind: 'outcome_code',
    description: 'Referred to the Federal Ministry of Environment or NOSDRA.',
    usageCount: 0,
  },
  {
    id: 'oc-withdrawn',
    label: 'Withdrawn by requestor',
    kind: 'outcome_code',
    description: 'Requestor withdrew the application before determination.',
    usageCount: 0,
  },
  {
    id: 'oc-court',
    label: 'Determined by court',
    kind: 'outcome_code',
    description: 'Disposed of by order of a court of competent jurisdiction.',
    usageCount: 0,
  },
]

export const closureReasons: TaxonomyTerm[] = [
  { id: 'cr-responded', label: 'Response issued and acknowledged', kind: 'closure_reason', usageCount: 0 },
  { id: 'cr-exempt', label: 'Exemption applied and communicated', kind: 'closure_reason', usageCount: 0 },
  { id: 'cr-nofurther', label: 'No further correspondence from requestor', kind: 'closure_reason', usageCount: 0 },
  { id: 'cr-duplicate', label: 'Duplicate of an existing request', kind: 'closure_reason', usageCount: 0 },
  { id: 'cr-court', label: 'Concluded by court judgment', kind: 'closure_reason', usageCount: 0 },
  { id: 'cr-withdrawn', label: 'Withdrawn by requestor', kind: 'closure_reason', usageCount: 0 },
]

export const retentionLabels: TaxonomyTerm[] = [
  {
    id: 'rl-standard',
    label: 'Standard - 7 years',
    kind: 'retention_label',
    description: 'Default retention for FOI correspondence and responses.',
    usageCount: 0,
  },
  {
    id: 'rl-legal',
    label: 'Legal hold - indefinite',
    kind: 'retention_label',
    description: 'Retained while litigation or an appeal is live.',
    usageCount: 0,
  },
  {
    id: 'rl-permanent',
    label: 'Permanent - archival',
    kind: 'retention_label',
    description: 'Records of enduring public and historical value.',
    usageCount: 0,
  },
  {
    id: 'rl-short',
    label: 'Short - 3 years',
    kind: 'retention_label',
    description: 'Transitory administrative records.',
    usageCount: 0,
  },
]

export const systemSettings: SystemSettings = {
  organizationName: 'Hydrocarbon Pollution Remediation Project (HYPREP)',
  statutoryResponseDays: STATUTORY_RESPONSE_DAYS,
  slaWarningThresholdDays: 2,
  selfRegistrationEnabled: true,
  mfaRequiredForPrivileged: true,
  sessionTimeoutMinutes: 30,
  passwordMinLength: 12,
  passwordRotationDays: 90,
  lockoutAttempts: 5,
  maxUploadSizeMb: 25,
  allowedFileTypes: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'png', 'jpg', 'jpeg', 'zip'],
  virusScanEnabled: true,
  ocrEnabled: true,
  defaultRetentionYears: 7,
  smtpHost: 'smtp.hyprep.gov.ng',
  smtpPort: 587,
  smtpFromAddress: 'foi-noreply@hyprep.gov.ng',
  storageProvider: 's3',
  storageBucket: 'hyprep-foi-documents-prod',
  timezone: 'Africa/Lagos',
  ssoEnabled: true,
  ssoProvider: 'saml',
}

export const serviceHealth: ServiceHealth[] = [
  { name: 'Web application', status: 'operational', latencyMs: 142, detail: '3 of 3 instances healthy' },
  { name: 'REST API', status: 'operational', latencyMs: 96, detail: 'p95 218 ms over last hour' },
  { name: 'PostgreSQL (primary)', status: 'operational', latencyMs: 8, detail: 'Replication lag 240 ms' },
  { name: 'PostgreSQL (read replica)', status: 'operational', latencyMs: 11, detail: 'Serving report queries' },
  { name: 'Redis cache & job queue', status: 'operational', latencyMs: 3, detail: '12 jobs queued' },
  { name: 'Object storage (S3)', status: 'operational', latencyMs: 74, detail: '4,318 objects, 21.4 GB' },
  { name: 'Email delivery (SMTP)', status: 'degraded', latencyMs: 1840, detail: 'Elevated queue depth: 46 pending' },
  { name: 'Virus scanner (ClamAV)', status: 'operational', latencyMs: 310, detail: 'Signature set updated 4 h ago' },
  { name: 'OCR worker', status: 'operational', latencyMs: 2260, detail: '2 documents processing' },
  { name: 'SSO (SAML identity provider)', status: 'operational', latencyMs: 188, detail: 'Metadata valid for 214 days' },
]

export const NOTIFICATION_PREFERENCE_HINTS: Record<keyof typeof NOTIFICATION_META, string> = {
  case_assigned: 'When a case is routed to you or to a team you belong to.',
  status_changed: 'When any case you follow moves to a new status.',
  response_uploaded: 'When a response document is uploaded or published on your cases.',
  due_soon: 'Ahead of the statutory response deadline, at the configured lead time.',
  overdue: 'As soon as a request passes its statutory due date.',
  court_reminder: 'Before a scheduled hearing, at each configured reminder interval.',
  mention: 'When a colleague tags you in an internal note.',
  task_assigned: 'When a task is assigned to you on a case.',
  admin_alert: 'System health, failed jobs, security and configuration alerts.',
  appeal_filed: 'When a requestor appeals a determination on one of your cases.',
}

export const notificationPreferenceDefaults: NotificationPreference[] = (
  Object.keys(NOTIFICATION_META) as Array<keyof typeof NOTIFICATION_META>
).map((kind) => ({
  kind,
  label: NOTIFICATION_META[kind].label,
  description: NOTIFICATION_PREFERENCE_HINTS[kind],
  inApp: true,
  email: kind !== 'status_changed' && kind !== 'mention',
  sms: kind === 'court_reminder' || kind === 'overdue',
}))

export const backups: BackupRecord[] = [
  {
    id: 'bkp-0142',
    startedAt: relativeIso(-0.35),
    type: 'incremental',
    sizeMb: 412,
    status: 'success',
    target: 's3://hyprep-foi-backups/2026/incremental',
    restoreTested: false,
  },
  {
    id: 'bkp-0141',
    startedAt: relativeIso(-1.35),
    type: 'full',
    sizeMb: 8642,
    status: 'success',
    target: 's3://hyprep-foi-backups/2026/full',
    restoreTested: true,
  },
  {
    id: 'bkp-0140',
    startedAt: relativeIso(-2.35),
    type: 'incremental',
    sizeMb: 388,
    status: 'success',
    target: 's3://hyprep-foi-backups/2026/incremental',
    restoreTested: false,
  },
  {
    id: 'bkp-0139',
    startedAt: relativeIso(-3.35),
    type: 'incremental',
    sizeMb: 401,
    status: 'failed',
    target: 's3://hyprep-foi-backups/2026/incremental',
    restoreTested: false,
  },
  {
    id: 'bkp-0138',
    startedAt: relativeIso(-8.35),
    type: 'full',
    sizeMb: 8511,
    status: 'success',
    target: 's3://hyprep-foi-backups/2026/full',
    restoreTested: true,
  },
]

/** Days offset from now, as an ISO string. Negative is in the past. */
export function relativeIso(days: number, hour?: number, minute = 0) {
  const date = new Date()
  date.setDate(date.getDate() + Math.trunc(days))
  const fractional = days - Math.trunc(days)
  if (hour !== undefined) {
    date.setHours(hour, minute, 0, 0)
  } else {
    date.setHours(date.getHours() + Math.round(fractional * 24), minute, 0, 0)
  }
  return date.toISOString()
}

/** Days offset from now as a plain calendar date (yyyy-MM-dd). */
export function relativeDate(days: number) {
  const date = new Date()
  date.setHours(12, 0, 0, 0)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}
