import type { FoiCase, Permission, Role, RoleId, User } from '@/types'

/**
 * Role-based access control (FR-003).
 *
 * The permission catalogue is the single source of truth for both navigation
 * visibility and route guards, so a role can never see a link it cannot open.
 * Row-level scoping (all / assigned / own) is layered on top by `visibleCases`.
 */

export const PERMISSION_GROUPS: Array<{
  group: string
  description: string
  permissions: Array<{ id: Permission; label: string }>
}> = [
  {
    group: 'Cases',
    description: 'FOI request records and their lifecycle',
    permissions: [
      { id: 'case:read:all', label: 'View all cases across the organisation' },
      { id: 'case:read:assigned', label: 'View cases assigned to me or my team' },
      { id: 'case:read:own', label: 'View cases I submitted' },
      { id: 'case:create', label: 'Create cases and submit FOI requests' },
      { id: 'case:update', label: 'Update case fields, tags and metadata' },
      { id: 'case:assign', label: 'Assign and reassign cases' },
      { id: 'case:triage', label: 'Triage the review queue' },
      { id: 'case:escalate', label: 'Escalate cases' },
      { id: 'case:link', label: 'Link related cases' },
      { id: 'case:close', label: 'Close cases and record outcomes' },
      { id: 'case:bulk', label: 'Perform bulk actions' },
      { id: 'case:delete', label: 'Delete cases' },
    ],
  },
  {
    group: 'Documents',
    description: 'Uploads, versioning, redaction and publication',
    permissions: [
      { id: 'document:read', label: 'View documents and previews' },
      { id: 'document:upload', label: 'Upload documents and new versions' },
      { id: 'document:download', label: 'Download documents' },
      { id: 'document:publish', label: 'Publish responses to requestors' },
      { id: 'document:redact', label: 'Apply redactions' },
      { id: 'document:retention', label: 'Manage retention labels' },
      { id: 'document:delete', label: 'Delete documents' },
    ],
  },
  {
    group: 'Collaboration',
    description: 'Notes, mentions and tasks',
    permissions: [
      { id: 'note:read:internal', label: 'Read internal notes' },
      { id: 'note:write:internal', label: 'Write internal notes' },
      { id: 'note:write:public', label: 'Write notes visible to the requestor' },
      { id: 'task:manage', label: 'Create and assign tasks' },
    ],
  },
  {
    group: 'Court',
    description: 'Hearings, calendar and outcomes',
    permissions: [
      { id: 'court:read', label: 'View the court calendar' },
      { id: 'court:write', label: 'Schedule and amend court dates' },
      { id: 'court:outcome', label: 'Record hearing outcomes' },
    ],
  },
  {
    group: 'Templates',
    description: 'Letter and affidavit generation',
    permissions: [
      { id: 'template:read', label: 'Use templates to generate letters' },
      { id: 'template:manage', label: 'Create and edit templates' },
    ],
  },
  {
    group: 'Reporting',
    description: 'Standard reports, report builder and exports',
    permissions: [
      { id: 'report:read', label: 'View standard reports and dashboards' },
      { id: 'report:build', label: 'Build custom reports' },
      { id: 'report:schedule', label: 'Schedule report delivery' },
      { id: 'report:export', label: 'Export reports to CSV / PDF' },
    ],
  },
  {
    group: 'Users and roles',
    description: 'Account administration',
    permissions: [
      { id: 'user:read', label: 'View user directory' },
      { id: 'user:write', label: 'Create and edit users' },
      { id: 'user:delete', label: 'Deactivate or delete users' },
      { id: 'role:manage', label: 'Manage roles and permissions' },
    ],
  },
  {
    group: 'Organisation',
    description: 'Departments, courts, teams and taxonomies',
    permissions: [{ id: 'org:manage', label: 'Manage organisation reference data' }],
  },
  {
    group: 'Audit',
    description: 'Compliance trails',
    permissions: [
      { id: 'audit:read', label: 'View audit and access logs' },
      { id: 'audit:export', label: 'Export audit logs' },
    ],
  },
  {
    group: 'System',
    description: 'Reserved for Super-Admin',
    permissions: [
      { id: 'system:settings', label: 'Change system settings' },
      { id: 'system:monitor', label: 'View system health and metrics' },
      { id: 'system:backup', label: 'Run backups and restores' },
      { id: 'system:export', label: 'Run full-dataset emergency exports' },
      { id: 'system:retention', label: 'Manage data retention policy' },
      { id: 'integration:manage', label: 'Manage API clients and webhooks' },
      { id: 'import:bulk', label: 'Bulk import records' },
    ],
  },
]

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.id),
)

const LEGAL_PERMISSIONS: Permission[] = [
  'case:read:all',
  'case:read:assigned',
  'case:create',
  'case:update',
  'case:assign',
  'case:triage',
  'case:escalate',
  'case:link',
  'case:close',
  'case:bulk',
  'document:read',
  'document:upload',
  'document:download',
  'document:publish',
  'document:redact',
  'note:read:internal',
  'note:write:internal',
  'note:write:public',
  'task:manage',
  'court:read',
  'court:write',
  'court:outcome',
  'template:read',
  'report:read',
  'report:build',
  'report:export',
  'user:read',
]

const CLERK_PERMISSIONS: Permission[] = [
  'case:read:all',
  'case:read:assigned',
  'case:create',
  'case:update',
  'document:read',
  'document:upload',
  'document:download',
  'document:retention',
  'note:read:internal',
  'note:write:internal',
  'court:read',
  'court:write',
  'template:read',
  'report:read',
  'report:export',
  'user:read',
]

const ADMIN_PERMISSIONS: Permission[] = [
  ...LEGAL_PERMISSIONS,
  'document:retention',
  'document:delete',
  'template:manage',
  'report:schedule',
  'user:write',
  'user:delete',
  'org:manage',
  'audit:read',
  'audit:export',
  'import:bulk',
]

export const ROLES: Array<Role & { id: RoleId }> = [
  {
    id: 'super_admin',
    name: 'Super-Admin',
    description:
      'Full system control: organisations, users and roles, system settings, retention, emergency exports. Typically an IT or governance officer.',
    permissions: ALL_PERMISSIONS,
    isSystem: true,
  },
  {
    id: 'admin',
    name: 'Admin',
    description:
      'Manage users, assign cases, manage categories and tags, review reports, moderate content and set permissions.',
    permissions: Array.from(new Set(ADMIN_PERMISSIONS)),
    isSystem: true,
  },
  {
    id: 'legal',
    name: 'Legal Unit',
    description:
      'Lawyers, paralegals and case officers: create and update case records, upload responses, add court dates, annotate documents and mark statuses.',
    permissions: Array.from(new Set(LEGAL_PERMISSIONS)),
    isSystem: true,
  },
  {
    id: 'clerk',
    name: 'Clerk / Support',
    description:
      'Administer documents, manage scheduling, perform data entry and assist Legal Unit staff.',
    permissions: Array.from(new Set(CLERK_PERMISSIONS)),
    isSystem: true,
  },
  {
    id: 'requestor',
    name: 'Requestor',
    description:
      'General users: submit FOI requests, view their own requests and responses, receive notifications and create appeals.',
    permissions: ['case:read:own', 'case:create', 'document:read', 'document:download'],
    isSystem: true,
  },
  {
    id: 'auditor',
    name: 'Auditor',
    description: 'Read-only access across cases, documents and logs for compliance and audit purposes.',
    permissions: [
      'case:read:all',
      'document:read',
      'note:read:internal',
      'court:read',
      'report:read',
      'report:export',
      'audit:read',
      'audit:export',
      'user:read',
    ],
    isSystem: true,
  },
  {
    id: 'external',
    name: 'External Stakeholder',
    description:
      'External lawyers and government officials. Access is limited to cases they are explicitly assigned to.',
    permissions: [
      'case:read:assigned',
      'document:read',
      'document:download',
      'note:write:public',
      'court:read',
    ],
    isSystem: true,
  },
]

export function getRole(roleId: RoleId | string): Role {
  return ROLES.find((role) => role.id === roleId) ?? ROLES[ROLES.length - 1]!
}

export function permissionsFor(roleId: RoleId | string): Permission[] {
  return getRole(roleId).permissions
}

export function hasPermission(
  roleId: RoleId | string,
  permission: Permission | Permission[],
  mode: 'any' | 'all' = 'any',
): boolean {
  const granted = permissionsFor(roleId)
  const required = Array.isArray(permission) ? permission : [permission]
  if (required.length === 0) return true
  return mode === 'all'
    ? required.every((p) => granted.includes(p))
    : required.some((p) => granted.includes(p))
}

/** Row-level scoping. Determines which cases a given user may see at all. */
export function caseVisibility(user: User): 'all' | 'assigned' | 'own' | 'none' {
  if (hasPermission(user.roleId, 'case:read:all')) return 'all'
  if (hasPermission(user.roleId, 'case:read:assigned')) return 'assigned'
  if (hasPermission(user.roleId, 'case:read:own')) return 'own'
  return 'none'
}

export function canSeeCase(user: User, foiCase: FoiCase, teamMemberIds: string[] = []): boolean {
  switch (caseVisibility(user)) {
    case 'all':
      return true
    case 'assigned':
      return (
        foiCase.assignedTo === user.id ||
        (!!user.teamId && foiCase.assignedTeamId === user.teamId) ||
        teamMemberIds.includes(foiCase.assignedTo ?? '')
      )
    case 'own':
      return foiCase.requestorId === user.id
    default:
      return false
  }
}

export function visibleCases(user: User, cases: FoiCase[], teamMemberIds: string[] = []): FoiCase[] {
  const scope = caseVisibility(user)
  if (scope === 'all') return cases
  if (scope === 'none') return []
  return cases.filter((c) => canSeeCase(user, c, teamMemberIds))
}

/** Read-only roles never see mutating affordances, even where a permission overlaps. */
export function isReadOnly(roleId: RoleId | string): boolean {
  return roleId === 'auditor'
}

/** The landing route each role sees after sign-in. */
export function homeRouteFor(roleId: RoleId | string): string {
  switch (roleId) {
    case 'super_admin':
      return '/dashboard/system'
    case 'admin':
      return '/dashboard/admin'
    case 'legal':
      return '/dashboard/legal'
    case 'clerk':
      return '/dashboard/legal'
    case 'auditor':
      return '/dashboard/audit'
    case 'requestor':
    case 'external':
      return '/my-requests'
    default:
      return '/my-requests'
  }
}
