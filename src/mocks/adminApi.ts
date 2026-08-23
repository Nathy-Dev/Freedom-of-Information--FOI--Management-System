import type {
  BackupRecord,
  Department,
  LetterTemplate,
  Paginated,
  QueryOptions,
  RoleId,
  SavedReport,
  SavedView,
  SystemSettings,
  TaxonomyTerm,
  User,
  Webhook,
} from '@/types'
import { delay } from '@/lib/utils'
import { initialsOf } from '@/lib/utils'
import { db, nextSequence, reference } from './db'
import { logAudit } from './api'

/* ------------------------------------------------------------------ *
 * Users and roles (FR-001 → FR-003)
 * ------------------------------------------------------------------ */

export interface UserQuery extends QueryOptions {
  q?: string
  roleIds?: RoleId[]
  statuses?: User['status'][]
  departments?: string[]
}

export async function listUsers(query: UserQuery = {}): Promise<Paginated<User>> {
  await delay()
  const needle = query.q?.trim().toLowerCase()
  const rows = reference.users.filter((u) => {
    if (query.roleIds?.length && !query.roleIds.includes(u.roleId)) return false
    if (query.statuses?.length && !query.statuses.includes(u.status)) return false
    if (query.departments?.length && !query.departments.includes(u.department ?? '')) return false
    if (needle) {
      const haystack = `${u.name} ${u.email} ${u.organization} ${u.position ?? ''} ${u.department ?? ''}`.toLowerCase()
      if (!haystack.includes(needle)) return false
    }
    return true
  })

  const sortBy = query.sortBy ?? 'name'
  const dir = query.sortDir === 'desc' ? -1 : 1
  const sorted = [...rows].sort((a, b) => {
    const av = String((a as unknown as Record<string, unknown>)[sortBy] ?? '')
    const bv = String((b as unknown as Record<string, unknown>)[sortBy] ?? '')
    return av.localeCompare(bv) * dir
  })

  const page = Math.max(1, query.page ?? 1)
  const pageSize = query.pageSize ?? 20
  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(page, pageCount)
  return {
    rows: sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    total: sorted.length,
    page: safePage,
    pageSize,
    pageCount,
  }
}

export interface NewUserInput {
  name: string
  email: string
  roleId: RoleId
  organization: string
  position?: string
  department?: string
  phone?: string
  mfaEnabled: boolean
}

const AVATAR_COLORS = [
  'bg-brand-600',
  'bg-brand-700',
  'bg-crest-600',
  'bg-gold-500',
  'bg-violet-600',
  'bg-sky-600',
  'bg-teal-600',
]

export async function createUser(input: NewUserInput, actorId: string): Promise<User> {
  await delay(420)
  const now = new Date().toISOString()
  const user: User = {
    id: nextSequence('usr'),
    name: input.name,
    email: input.email,
    roleId: input.roleId,
    phone: input.phone,
    organization: input.organization,
    position: input.position,
    department: input.department,
    status: 'invited',
    avatarColor: AVATAR_COLORS[reference.users.length % AVATAR_COLORS.length]!,
    initials: initialsOf(input.name),
    mfaEnabled: input.mfaEnabled,
    createdAt: now,
    updatedAt: now,
  }
  reference.users.push(user)
  reference.usersById.set(user.id, user)
  logAudit('User', user.id, user.name, 'create', actorId, `User invited with role ${input.roleId}.`)
  return user
}

export async function updateUser(id: string, patch: Partial<User>, actorId: string) {
  await delay(320)
  const user = reference.usersById.get(id)
  if (!user) return undefined
  const roleChanged = patch.roleId && patch.roleId !== user.roleId
  const previousRole = user.roleId
  Object.assign(user, patch, { updatedAt: new Date().toISOString() })
  if (patch.name) user.initials = initialsOf(patch.name)

  logAudit(
    'User',
    user.id,
    user.name,
    roleChanged ? 'permission_change' : 'update',
    actorId,
    roleChanged
      ? `Role changed from ${previousRole} to ${patch.roleId}.`
      : `Profile updated: ${Object.keys(patch).join(', ')}.`,
  )
  return user
}

export async function setUserStatus(id: string, status: User['status'], actorId: string) {
  return updateUser(id, { status }, actorId)
}

export async function resetUserMfa(id: string, actorId: string) {
  await delay(260)
  const user = reference.usersById.get(id)
  if (!user) return undefined
  user.mfaEnabled = false
  logAudit('User', user.id, user.name, 'permission_change', actorId, 'Multi-factor authentication reset; user must re-enrol at next sign-in.')
  return user
}

export async function bulkSetUserStatus(ids: string[], status: User['status'], actorId: string) {
  await delay(480)
  ids.forEach((id) => {
    const user = reference.usersById.get(id)
    if (!user) return
    user.status = status
    user.updatedAt = new Date().toISOString()
    logAudit('User', user.id, user.name, 'update', actorId, `Status set to ${status} in a bulk action.`)
  })
}

/* ------------------------------------------------------------------ *
 * Organisation reference data (FR-060)
 * ------------------------------------------------------------------ */

export async function saveDepartment(input: Omit<Department, 'caseCount'>, actorId: string) {
  await delay(280)
  const existing = reference.departments.find((d) => d.id === input.id)
  if (existing) {
    Object.assign(existing, input)
    logAudit('Department', existing.id, existing.name, 'update', actorId, 'Department updated.')
    return existing
  }
  const created: Department = { ...input, caseCount: 0 }
  reference.departments.push(created)
  logAudit('Department', created.id, created.name, 'create', actorId, 'Department created.')
  return created
}

export async function saveTaxonomyTerm(input: Omit<TaxonomyTerm, 'usageCount'>, actorId: string) {
  await delay(240)
  const collection =
    input.kind === 'tag'
      ? reference.tags
      : input.kind === 'outcome_code'
        ? reference.outcomeCodes
        : input.kind === 'closure_reason'
          ? reference.closureReasons
          : reference.retentionLabels

  const existing = collection.find((t) => t.id === input.id)
  if (existing) {
    Object.assign(existing, input)
    logAudit('Taxonomy', existing.id, existing.label, 'update', actorId, `${input.kind} updated.`)
    return existing
  }
  const created: TaxonomyTerm = { ...input, usageCount: 0 }
  collection.push(created)
  logAudit('Taxonomy', created.id, created.label, 'create', actorId, `${input.kind} created.`)
  return created
}

export async function deleteTaxonomyTerm(id: string, kind: TaxonomyTerm['kind'], actorId: string) {
  await delay(200)
  const collection =
    kind === 'tag'
      ? reference.tags
      : kind === 'outcome_code'
        ? reference.outcomeCodes
        : kind === 'closure_reason'
          ? reference.closureReasons
          : reference.retentionLabels
  const index = collection.findIndex((t) => t.id === id)
  if (index === -1) return false
  const [removed] = collection.splice(index, 1)
  logAudit('Taxonomy', id, removed!.label, 'delete', actorId, `${kind} removed from the taxonomy.`)
  return true
}

/* ------------------------------------------------------------------ *
 * System settings, monitoring and backups (FR-061, FR-064 → FR-066)
 * ------------------------------------------------------------------ */

export async function updateSettings(patch: Partial<SystemSettings>, actorId: string) {
  await delay(360)
  Object.assign(reference.systemSettings, patch)
  logAudit(
    'SystemSettings',
    'settings',
    'System settings',
    'settings_change',
    actorId,
    `Settings changed: ${Object.keys(patch).join(', ')}.`,
  )
  return reference.systemSettings
}

export async function runBackup(type: BackupRecord['type'], actorId: string): Promise<BackupRecord> {
  await delay(900)
  const record: BackupRecord = {
    id: nextSequence('bak'),
    startedAt: new Date().toISOString(),
    type,
    sizeMb: type === 'full' ? 2450 : 180,
    status: 'success',
    target: 's3://hyprep-foi-backups/manual',
    restoreTested: false,
  }
  reference.backups.unshift(record)
  logAudit('Backup', record.id, `${type} backup`, 'create', actorId, 'Manual backup triggered and completed.')
  return record
}

export type ExportScope = 'cases' | 'documents' | 'users' | 'audit' | 'court_dates'

/** FR-065: full data export. Returns CSV text the browser can save. */
export async function exportData(scope: ExportScope, actorId: string): Promise<{ fileName: string; csv: string }> {
  await delay(760)
  const stamp = new Date().toISOString().slice(0, 10)
  logAudit('DataExport', scope, `${scope} export`, 'export', actorId, `Full ${scope} export generated.`)

  const rows: Record<string, unknown>[] =
    scope === 'cases'
      ? db.cases.map((c) => ({
          case_number: c.caseNumber,
          subject: c.subject,
          requestor: c.requestor.name,
          organization: c.requestor.organization ?? '',
          department: c.department,
          status: c.status,
          priority: c.priority,
          date_submitted: c.dateSubmitted.slice(0, 10),
          statutory_due_date: c.statutoryDueDate,
          date_closed: c.dateClosed?.slice(0, 10) ?? '',
          outcome: c.outcomeCode ?? '',
        }))
      : scope === 'documents'
        ? db.documents.map((d) => ({
            file_name: d.fileName,
            case_id: d.caseId,
            kind: d.kind,
            version: d.version,
            size_bytes: d.fileSize,
            redactions: d.redactionCount,
            confidentiality: d.confidentiality,
            retention: d.retentionLabel,
          }))
        : scope === 'users'
          ? reference.users.map((u) => ({
              name: u.name,
              email: u.email,
              role: u.roleId,
              organization: u.organization,
              department: u.department ?? '',
              status: u.status,
              mfa: u.mfaEnabled,
            }))
          : scope === 'court_dates'
            ? db.courtDates.map((c) => ({
                suit_number: c.suitNumber,
                case_id: c.caseId,
                date: c.date,
                time: c.time,
                court: c.courtName,
                judge: c.judge,
                hearing_type: c.hearingType,
                status: c.status,
                outcome: c.outcome ?? '',
              }))
            : db.auditLogs.map((a) => ({
                timestamp: a.timestamp,
                entity: `${a.entityType}: ${a.entityLabel}`,
                action: a.action,
                performed_by: a.performedBy,
                severity: a.severity,
                ip_address: a.ipAddress,
                details: a.details,
              }))

  const headers = Object.keys(rows[0] ?? { empty: '' })
  const body = rows
    .map((row) => headers.map((h) => JSON.stringify(String(row[h] ?? ''))).join(','))
    .join('\n')

  return { fileName: `hyprep-foi-${scope}-${stamp}.csv`, csv: `${headers.join(',')}\n${body}` }
}

/* ------------------------------------------------------------------ *
 * Letter templates (FR-033)
 * ------------------------------------------------------------------ */

export async function saveTemplate(
  input: Omit<LetterTemplate, 'updatedAt' | 'usageCount'> & { usageCount?: number },
  actorId: string,
): Promise<LetterTemplate> {
  await delay(340)
  const existing = db.templates.find((t) => t.id === input.id)
  if (existing) {
    Object.assign(existing, input, { updatedBy: actorId, updatedAt: new Date().toISOString() })
    logAudit('Template', existing.id, existing.name, 'update', actorId, 'Letter template updated.')
    return existing
  }
  const created: LetterTemplate = {
    ...input,
    id: input.id || nextSequence('tpl'),
    updatedBy: actorId,
    updatedAt: new Date().toISOString(),
    usageCount: 0,
  }
  db.templates.push(created)
  logAudit('Template', created.id, created.name, 'create', actorId, 'Letter template created.')
  return created
}

export async function deleteTemplate(id: string, actorId: string) {
  await delay(220)
  const index = db.templates.findIndex((t) => t.id === id)
  if (index === -1) return false
  const [removed] = db.templates.splice(index, 1)
  logAudit('Template', id, removed!.name, 'delete', actorId, 'Letter template deleted.')
  return true
}

const LONG_DATE: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }

function longDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('en-NG', LONG_DATE) : ''
}

/** FR-033: merge a template against a case to produce a ready-to-sign letter. */
export function renderTemplate(template: LetterTemplate, caseId: string, actor: User) {
  const foiCase = db.cases.find((c) => c.id === caseId)
  const hearing = db.courtDates.find((c) => c.caseId === caseId)

  const values: Record<string, string> = {
    '{{case_number}}': foiCase?.caseNumber ?? '',
    '{{requestor_name}}': foiCase?.requestor.name ?? '',
    '{{requestor_organization}}': foiCase?.requestor.organization ?? '',
    '{{requestor_email}}': foiCase?.requestor.email ?? '',
    '{{requestor_address}}': foiCase?.requestor.organization ?? '',
    '{{subject}}': foiCase?.subject ?? '',
    '{{date_submitted}}': longDate(foiCase?.dateSubmitted),
    '{{statutory_due_date}}': longDate(foiCase?.statutoryDueDate),
    '{{today}}': longDate(new Date().toISOString()),
    '{{officer_name}}': actor.name,
    '{{officer_position}}': actor.position ?? 'Legal Officer',
    '{{department}}': foiCase?.department ?? '',
    '{{exemption_grounds}}': '[Set out each ground relied upon, citing the relevant section of the Act]',
    '{{records_released}}': '[List the records released]',
    '{{records_withheld}}': '[List the information severed]',
    '{{fee_amount}}': 'Nil',
    '{{suit_number}}': hearing?.suitNumber ?? '[Suit number]',
    '{{court_name}}': hearing?.courtName ?? '[Court]',
    '{{hearing_date}}': longDate(hearing?.date),
  }

  let body = template.body
  Object.entries(values).forEach(([token, value]) => {
    body = body.split(token).join(value)
  })
  template.usageCount += 1
  return body
}

/* ------------------------------------------------------------------ *
 * Saved reports and views (FR-042, FR-052, FR-054)
 * ------------------------------------------------------------------ */

export async function saveReport(input: SavedReport, actorId: string) {
  await delay(320)
  const existing = db.reports.find((r) => r.id === input.id)
  if (existing) {
    Object.assign(existing, input)
    logAudit('Report', existing.id, existing.name, 'update', actorId, 'Saved report updated.')
    return existing
  }
  const created = { ...input, id: input.id || nextSequence('rep'), createdAt: new Date().toISOString() }
  db.reports.push(created)
  logAudit('Report', created.id, created.name, 'create', actorId, 'Saved report created.')
  return created
}

export async function deleteReport(id: string, actorId: string) {
  await delay(200)
  const index = db.reports.findIndex((r) => r.id === id)
  if (index === -1) return false
  const [removed] = db.reports.splice(index, 1)
  logAudit('Report', id, removed!.name, 'delete', actorId, 'Saved report deleted.')
  return true
}

export async function saveView(input: SavedView, actorId: string) {
  await delay(240)
  const existing = db.views.find((v) => v.id === input.id)
  if (existing) {
    Object.assign(existing, input)
    return existing
  }
  const created = { ...input, id: input.id || nextSequence('view'), createdAt: new Date().toISOString() }
  db.views.push(created)
  logAudit('SavedView', created.id, created.name, 'create', actorId, 'Saved view created.')
  return created
}

export async function deleteView(id: string, actorId: string) {
  await delay(180)
  const index = db.views.findIndex((v) => v.id === id)
  if (index === -1) return false
  const [removed] = db.views.splice(index, 1)
  logAudit('SavedView', id, removed!.name, 'delete', actorId, 'Saved view deleted.')
  return true
}

/* ------------------------------------------------------------------ *
 * Integrations (FR-070)
 * ------------------------------------------------------------------ */

export async function saveWebhook(
  input: Omit<Webhook, 'lastDeliveryAt' | 'lastStatus' | 'createdAt'>,
  actorId: string,
) {
  await delay(300)
  const existing = reference.webhooks.find((w) => w.id === input.id)
  if (existing) {
    Object.assign(existing, input)
    logAudit('Integration', existing.id, existing.url, 'update', actorId, 'Webhook updated.')
    return existing
  }
  const created: Webhook = {
    ...input,
    id: input.id || nextSequence('whk'),
    lastDeliveryAt: null,
    lastStatus: null,
    createdAt: new Date().toISOString(),
  }
  reference.webhooks.push(created)
  logAudit('Integration', created.id, created.url, 'create', actorId, 'Webhook registered.')
  return created
}

export async function deleteWebhook(id: string, actorId: string) {
  await delay(200)
  const index = reference.webhooks.findIndex((w) => w.id === id)
  if (index === -1) return false
  const [removed] = reference.webhooks.splice(index, 1)
  logAudit('Integration', id, removed!.url, 'delete', actorId, 'Webhook removed.')
  return true
}

/** Sends a signed test payload so an integrator can verify their endpoint. */
export async function testWebhook(id: string, actorId: string) {
  await delay(880)
  const hook = reference.webhooks.find((w) => w.id === id)
  if (!hook) return undefined
  hook.lastDeliveryAt = new Date().toISOString()
  hook.lastStatus = hook.isActive ? 200 : 0
  logAudit('Integration', hook.id, hook.url, 'update', actorId, 'Test delivery sent.')
  return hook
}

export async function rotateApiSecret(id: string, actorId: string) {
  await delay(420)
  const client = reference.apiClients.find((c) => c.id === id)
  if (!client) return undefined
  logAudit('Integration', client.id, client.name, 'permission_change', actorId, 'Client secret rotated.')
  return `sk_live_${Math.random().toString(36).slice(2, 12)}${Math.random().toString(36).slice(2, 12)}`
}
