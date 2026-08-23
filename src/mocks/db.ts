import type {
  AccessLog,
  AppNotification,
  AuditLog,
  CaseNote,
  CaseTask,
  CourtDate,
  FoiCase,
  FoiDocument,
  LetterTemplate,
  SavedReport,
  SavedView,
  TimelineEvent,
} from '@/types'
import { relativeIso } from './data/reference'
import {
  backups,
  closureReasons,
  courts,
  departments,
  legalTeams,
  outcomeCodes,
  retentionLabels,
  serviceHealth,
  systemSettings,
  tags,
} from './data/reference'
import { assignableStaff, demoAccounts, userName, users, usersById } from './data/users'
import { buildCases } from './data/cases'
import { buildDocuments } from './data/documents'
import { buildNotes, buildTasks } from './data/notes'
import { buildCourtDates } from './data/court'
import { buildTimeline } from './data/timeline'
import { buildAccessLogs, buildAuditLogs } from './data/logs'
import { buildNotifications } from './data/notifications'
import { letterTemplates } from './data/templates'
import { savedReports, savedViews } from './data/reports'
import { apiClients, ssoConfig, webhooks } from './data/integrations'

/**
 * The mock database is a single mutable in-memory graph, assembled once at module
 * load. Generators are pure and deterministically seeded, so every reload produces
 * the same records; only the dates move, because they are computed relative to
 * today. That keeps SLA states, calendars and dashboards alive for a demo without
 * making the data shift under the reviewer's feet.
 */
export interface MockDb {
  cases: FoiCase[]
  documents: FoiDocument[]
  notes: CaseNote[]
  tasks: CaseTask[]
  courtDates: CourtDate[]
  timeline: TimelineEvent[]
  auditLogs: AuditLog[]
  accessLogs: AccessLog[]
  notifications: AppNotification[]
  templates: LetterTemplate[]
  reports: SavedReport[]
  views: SavedView[]
}

const requestors = users.filter((u) => u.roleId === 'requestor')
const legalStaff = assignableStaff
const staffIds = users
  .filter((u) => ['legal', 'clerk', 'admin', 'super_admin'].includes(u.roleId))
  .map((u) => u.id)
const counselIds = users.filter((u) => u.roleId === 'legal').map((u) => u.id)

const cases = buildCases({ requestors, legalStaff })
const documents = buildDocuments(cases, staffIds)
const notes = buildNotes(cases, staffIds)
const tasks = buildTasks(cases, staffIds)
const courtDates = buildCourtDates(cases, counselIds)

addAppealCases(cases)
backfillCounts(cases, documents, notes, courtDates)
backfillReferenceUsage(cases)

const timeline = buildTimeline(cases, documents, notes, courtDates, userName)
const auditLogs = buildAuditLogs({ cases, documents, users })
const accessLogs = buildAccessLogs(documents, cases, users)
const notifications = buildNotifications({ cases, courtDates, tasks, users, userName })

export const db: MockDb = {
  cases,
  documents,
  notes,
  tasks,
  courtDates,
  timeline,
  auditLogs,
  accessLogs,
  notifications,
  templates: letterTemplates,
  reports: savedReports,
  views: savedViews,
}

/** Re-export the static reference data so consumers have a single import site. */
export const reference = {
  users,
  usersById,
  demoAccounts,
  assignableStaff,
  departments,
  courts,
  legalTeams,
  tags,
  outcomeCodes,
  closureReasons,
  retentionLabels,
  systemSettings,
  serviceHealth,
  backups,
  webhooks,
  apiClients,
  ssoConfig,
}

export { userName, usersById }

/**
 * FR-023: an appeal is its own case that points back at the determination being
 * challenged. Cases already carrying the `appeal` status are relabelled and linked
 * to the closest preceding case from the same requestor.
 */
function addAppealCases(all: FoiCase[]) {
  const byRequestor = new Map<string, FoiCase[]>()
  all.forEach((c) => {
    const list = byRequestor.get(c.requestorId) ?? []
    list.push(c)
    byRequestor.set(c.requestorId, list)
  })

  all
    .filter((c) => c.status === 'appeal')
    .forEach((appeal) => {
      const siblings = (byRequestor.get(appeal.requestorId) ?? []).filter(
        (c) => c.id !== appeal.id && (c.status === 'rejected' || c.status === 'closed'),
      )
      const parent = siblings.find(
        (c) => new Date(c.dateSubmitted).getTime() < new Date(appeal.dateSubmitted).getTime(),
      )

      appeal.isAppeal = true
      appeal.subject = appeal.subject.startsWith('Appeal —')
        ? appeal.subject
        : `Appeal — ${appeal.subject}`

      if (parent) {
        appeal.appealOfCaseId = parent.id
        if (!appeal.linkedCaseIds.includes(parent.id)) appeal.linkedCaseIds.push(parent.id)
        if (!parent.linkedCaseIds.includes(appeal.id)) parent.linkedCaseIds.push(appeal.id)
      }
    })
}

/** Denormalised counters keep list rendering cheap and match the child records. */
function backfillCounts(
  all: FoiCase[],
  docs: FoiDocument[],
  allNotes: CaseNote[],
  hearings: CourtDate[],
) {
  const counts = new Map<string, { d: number; n: number; c: number }>()
  const bump = (caseId: string, key: 'd' | 'n' | 'c') => {
    const entry = counts.get(caseId) ?? { d: 0, n: 0, c: 0 }
    entry[key] += 1
    counts.set(caseId, entry)
  }

  docs.forEach((d) => bump(d.caseId, 'd'))
  allNotes.forEach((n) => bump(n.caseId, 'n'))
  hearings.forEach((h) => bump(h.caseId, 'c'))

  all.forEach((c) => {
    const entry = counts.get(c.id)
    c.documentCount = entry?.d ?? 0
    c.noteCount = entry?.n ?? 0
    c.courtDateCount = entry?.c ?? 0
  })
}

/** Department and taxonomy counters shown on the admin screens. */
function backfillReferenceUsage(all: FoiCase[]) {
  departments.forEach((department) => {
    department.caseCount = all.filter((c) => c.department === department.name).length
  })

  tags.forEach((tag) => {
    tag.usageCount = all.filter((c) => c.tags.includes(tag.label)).length
  })

  outcomeCodes.forEach((code) => {
    code.usageCount = all.filter((c) => c.outcomeCode === code.label).length
  })

  closureReasons.forEach((reason) => {
    reason.usageCount = all.filter((c) => c.closureReason === reason.label).length
  })
}

/** Monotonic id helper for records created during a demo session. */
let sequence = 1000
export function nextSequence(prefix: string) {
  sequence += 1
  return `${prefix}-${sequence}`
}

export function nextCaseNumber() {
  const year = new Date().getFullYear()
  const highest = db.cases.reduce((max, c) => {
    const tail = Number(c.caseNumber.split('/').pop())
    return Number.isFinite(tail) && tail > max ? tail : max
  }, 0)
  return `HYPREP/FOI/${year}/${String(highest + 1).padStart(4, '0')}`
}

export const DEMO_NOW = relativeIso(0)
