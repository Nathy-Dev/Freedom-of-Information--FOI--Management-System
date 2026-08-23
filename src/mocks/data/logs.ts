import type {
  AccessLog,
  AuditAction,
  AuditLog,
  AuditSeverity,
  FoiCase,
  FoiDocument,
  User,
} from '@/types'
import { pick, seededRandom } from '@/lib/utils'
import { relativeIso } from './reference'

const IP_POOL = [
  '10.20.4.18',
  '10.20.4.27',
  '10.20.5.101',
  '10.20.5.144',
  '41.58.126.9',
  '41.203.78.14',
  '105.112.44.87',
  '197.210.53.62',
  '102.89.34.120',
]

const AGENT_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/128.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) Safari/17.5',
  'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) Firefox/129.0',
  'Mozilla/5.0 (Linux; Android 14; Infinix X6819) Chrome/127.0 Mobile',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5) Mobile/15E148 Safari/604.1',
]

const SEVERITY_BY_ACTION: Record<AuditAction, AuditSeverity> = {
  create: 'info',
  update: 'info',
  view: 'info',
  download: 'notice',
  export: 'notice',
  publish: 'notice',
  redact: 'notice',
  login: 'info',
  logout: 'info',
  login_failed: 'warning',
  permission_change: 'critical',
  settings_change: 'critical',
  delete: 'critical',
}

/** Administrative events that are not tied to a single case. */
const ADMIN_EVENTS: Array<{
  entityType: string
  entityLabel: string
  action: AuditAction
  details: string
}> = [
  {
    entityType: 'User',
    entityLabel: 'Chinedu Okafor',
    action: 'permission_change',
    details: 'Role changed from Clerk / Support to Legal Unit Staff. Added permissions: case:assign, document:redact.',
  },
  {
    entityType: 'User',
    entityLabel: 'Fatima Bello',
    action: 'create',
    details: 'User account created and invitation email dispatched. Initial role: Legal Unit Staff.',
  },
  {
    entityType: 'User',
    entityLabel: 'Emeka Nwachukwu',
    action: 'update',
    details: 'Account status changed from Active to Suspended pending an internal HR review.',
  },
  {
    entityType: 'Role',
    entityLabel: 'Auditor',
    action: 'permission_change',
    details: 'Permission audit:export granted to the Auditor role by the Super Administrator.',
  },
  {
    entityType: 'SystemSettings',
    entityLabel: 'SLA configuration',
    action: 'settings_change',
    details: 'Statutory response window confirmed at 7 days; warning threshold changed from 3 to 2 days.',
  },
  {
    entityType: 'SystemSettings',
    entityLabel: 'Password policy',
    action: 'settings_change',
    details: 'Minimum length raised from 8 to 12 characters and MFA enforced for all privileged roles.',
  },
  {
    entityType: 'SystemSettings',
    entityLabel: 'Retention schedule',
    action: 'settings_change',
    details: 'Default document retention set to 7 years; legal-hold documents exempted from purge.',
  },
  {
    entityType: 'Report',
    entityLabel: 'Quarterly FOI Compliance Report',
    action: 'export',
    details: 'Report exported to PDF for onward transmission to the Attorney-General of the Federation.',
  },
  {
    entityType: 'Backup',
    entityLabel: 'Nightly encrypted backup',
    action: 'create',
    details: 'Scheduled backup completed successfully. Archive verified and replicated off-site.',
  },
  {
    entityType: 'Integration',
    entityLabel: 'Case updates webhook',
    action: 'update',
    details: 'Endpoint URL updated and signing secret rotated.',
  },
  {
    entityType: 'Taxonomy',
    entityLabel: 'Litigation Risk',
    action: 'create',
    details: 'New tag added to the case taxonomy by the Administrator.',
  },
  {
    entityType: 'AuditTrail',
    entityLabel: 'Audit trail export',
    action: 'export',
    details: 'Audit trail for the preceding 90 days exported to CSV by the Auditor.',
  },
]

const CASE_EVENT_TEXT: Partial<Record<AuditAction, string[]>> = {
  create: [
    'Case created from a portal submission. Acknowledgement queued for dispatch.',
    'Case created from an emailed request and attached to the requestor profile.',
  ],
  update: [
    'Status changed and the statutory clock recalculated.',
    'Case reassigned to a different officer within the Legal Unit.',
    'Priority raised following triage by the Head of Legal Unit.',
    'Tags amended: Litigation Risk applied.',
  ],
  view: [
    'Case record opened.',
    'Case timeline reviewed.',
  ],
  download: [
    'Response bundle downloaded.',
    'Evidence attachment downloaded.',
  ],
  publish: ['Response document published to the requestor portal.'],
  redact: ['Redactions applied and the redaction schedule saved against the document.'],
  export: ['Case list export generated with the active filters applied.'],
  delete: ['Draft attachment deleted before publication.'],
}

const CASE_ACTIONS: AuditAction[] = [
  'view',
  'view',
  'view',
  'update',
  'update',
  'download',
  'publish',
  'redact',
  'export',
]

interface AuditArgs {
  cases: FoiCase[]
  documents: FoiDocument[]
  users: User[]
}

/**
 * FR-006 / FR-062: an immutable, exportable trail. Entries are generated across
 * three streams — authentication, case activity and administration — so the
 * audit screens can be filtered meaningfully by actor, action and severity.
 */
export function buildAuditLogs({ cases, users }: AuditArgs): AuditLog[] {
  const rand = seededRandom(90223)
  const logs: AuditLog[] = []
  let counter = 0

  const staff = users.filter((u) => !['requestor', 'external'].includes(u.roleId))
  const staffIds = staff.map((u) => u.id)

  const push = (
    entityType: string,
    entityId: string,
    entityLabel: string,
    action: AuditAction,
    performedBy: string,
    dayOffset: number,
    details: string,
  ) => {
    counter += 1
    logs.push({
      id: `aud-${String(counter).padStart(6, '0')}`,
      entityType,
      entityId,
      entityLabel,
      action,
      performedBy,
      timestamp: relativeIso(dayOffset, 7 + Math.floor(rand() * 11), Math.floor(rand() * 60)),
      details,
      ipAddress: pick(rand, IP_POOL),
      userAgent: pick(rand, AGENT_POOL),
      severity: SEVERITY_BY_ACTION[action],
    })
  }

  // Stream 1 — authentication over the last 30 days.
  for (let day = 0; day < 30; day += 1) {
    const sessions = 4 + Math.floor(rand() * 6)
    for (let s = 0; s < sessions; s += 1) {
      const actor = pick(rand, staff)
      push('Session', actor.id, actor.name, 'login', actor.id, -day, `Successful sign-in${actor.mfaEnabled ? ' with multi-factor authentication' : ''}.`)
      if (rand() > 0.72) {
        push('Session', actor.id, actor.name, 'logout', actor.id, -day, 'Signed out of the session.')
      }
      if (rand() > 0.9) {
        push('Session', actor.id, actor.name, 'login_failed', actor.id, -day, 'Sign-in failed: incorrect password. Attempt 1 of 5 before lockout.')
      }
    }
  }

  // Stream 2 — case activity, weighted to recent cases.
  cases.forEach((foiCase, index) => {
    const ageDays = Math.max(
      1,
      Math.round((Date.now() - new Date(foiCase.dateSubmitted).getTime()) / 86_400_000),
    )
    const events = ageDays < 30 ? 3 + Math.floor(rand() * 5) : index % 3 === 0 ? 1 + Math.floor(rand() * 2) : 0

    if (events > 0) {
      push('Case', foiCase.id, foiCase.caseNumber, 'create', foiCase.requestorId, -ageDays, pick(rand, CASE_EVENT_TEXT.create!))
    }

    for (let e = 0; e < events; e += 1) {
      const action = pick(rand, CASE_ACTIONS)
      const text = CASE_EVENT_TEXT[action]
      if (!text) continue
      const actor = foiCase.assignedTo && rand() > 0.35 ? foiCase.assignedTo : pick(rand, staffIds)
      const offset = -Math.max(0, Math.round(rand() * Math.min(ageDays, 45)))
      push('Case', foiCase.id, foiCase.caseNumber, action, actor, offset, pick(rand, text))
    }
  })

  // Stream 3 — administration, spread across the quarter.
  ADMIN_EVENTS.forEach((event, index) => {
    const actor = event.action === 'export' && index % 2 === 0 ? 'usr-019' : pick(rand, ['usr-001', 'usr-002', 'usr-003'])
    push(event.entityType, `${event.entityType.toLowerCase()}-${index + 1}`, event.entityLabel, event.action, actor, -Math.round(rand() * 80), event.details)
  })

  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
}

/**
 * FR-063: per-document access logs. Every view, download, print and denied
 * attempt is recorded so the Legal Unit can prove who saw a sensitive record.
 */
export function buildAccessLogs(
  documents: FoiDocument[],
  cases: FoiCase[],
  users: User[],
): AccessLog[] {
  const rand = seededRandom(114577)
  const logs: AccessLog[] = []
  let counter = 0

  const caseById = new Map(cases.map((c) => [c.id, c]))
  const staffIds = users.filter((u) => !['requestor', 'external'].includes(u.roleId)).map((u) => u.id)
  const requestorIds = users.filter((u) => u.roleId === 'requestor').map((u) => u.id)

  documents.forEach((doc) => {
    const foiCase = caseById.get(doc.caseId)
    if (!foiCase) return

    const ageDays = Math.max(
      1,
      Math.round((Date.now() - new Date(doc.createdAt).getTime()) / 86_400_000),
    )
    const reads = 1 + Math.floor(rand() * (ageDays < 40 ? 5 : 3))

    for (let i = 0; i < reads; i += 1) {
      counter += 1
      // Sensitive documents occasionally attract a denied attempt — useful signal
      // for the security review screens.
      const denied = doc.confidentiality !== 'public' && rand() > 0.94
      const byRequestor = doc.isPublic && rand() > 0.55

      const action: AccessLog['action'] = denied
        ? 'denied'
        : rand() > 0.62
          ? 'download'
          : rand() > 0.94
            ? 'print'
            : 'view'

      logs.push({
        id: `acc-${String(counter).padStart(6, '0')}`,
        documentId: doc.id,
        documentName: doc.fileName,
        caseId: foiCase.id,
        caseNumber: foiCase.caseNumber,
        userId: denied
          ? pick(rand, requestorIds)
          : byRequestor
            ? foiCase.requestorId
            : pick(rand, staffIds),
        action,
        at: relativeIso(-Math.round(rand() * Math.min(ageDays, 60)), 8 + Math.floor(rand() * 10), Math.floor(rand() * 60)),
        ipAddress: pick(rand, IP_POOL),
      })
    }
  })

  return logs.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}
