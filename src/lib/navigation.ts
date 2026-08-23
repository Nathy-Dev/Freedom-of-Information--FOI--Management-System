import type { Permission, RoleId } from '@/types'

/**
 * Single source of truth for the left navigation (Terms of Reference section 30:
 * Dashboard, Cases, Court Dates, Documents, Reports, Admin).
 *
 * Every entry declares the permission that reveals it, so the sidebar, the
 * command palette and the route guards can never disagree about who sees what.
 */
export interface NavItem {
  label: string
  to: string
  /** lucide-react icon name, resolved by the sidebar. */
  icon: string
  permission?: Permission | Permission[]
  /** Restrict to specific roles even where the permission is broader. */
  roles?: RoleId[]
  /** Match nested routes, e.g. /cases/case-0001 highlights Cases. */
  match?: string
  description?: string
  /** Key into the sidebar live badge counts. */
  badge?: 'overdue' | 'review' | 'unread' | 'hearings'
  end?: boolean
}

export interface NavSection {
  id: string
  label: string | null
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    id: 'work',
    label: null,
    items: [
      {
        label: 'Dashboard',
        to: '/dashboard/system',
        icon: 'LayoutDashboard',
        roles: ['super_admin'],
        description: 'System-wide health, adoption and compliance.',
      },
      {
        label: 'Dashboard',
        to: '/dashboard/admin',
        icon: 'LayoutDashboard',
        roles: ['admin'],
        description: 'Users, workload and organisational performance.',
      },
      {
        label: 'Dashboard',
        to: '/dashboard/legal',
        icon: 'LayoutDashboard',
        roles: ['legal', 'clerk'],
        description: 'Your queue, deadlines and hearings.',
      },
      {
        label: 'Dashboard',
        to: '/dashboard/audit',
        icon: 'LayoutDashboard',
        roles: ['auditor'],
        description: 'Compliance posture and audit coverage.',
      },
      {
        label: 'My requests',
        to: '/my-requests',
        icon: 'FileText',
        roles: ['requestor', 'external'],
        match: '/my-requests',
        description: 'Requests you have submitted and their status.',
      },
      {
        label: 'New FOI request',
        to: '/requests/new',
        icon: 'FilePlus2',
        roles: ['requestor', 'external'],
        description: 'Submit a request under the FOI Act 2011.',
      },
      {
        label: 'Cases',
        to: '/cases',
        icon: 'Folders',
        permission: ['case:read:all', 'case:read:assigned'],
        match: '/cases',
        badge: 'overdue',
        description: 'All FOI cases with filters and saved views.',
      },
      {
        label: 'Review queue',
        to: '/review-queue',
        icon: 'ClipboardList',
        permission: 'case:triage',
        badge: 'review',
        description: 'Unassigned and awaiting-decision work.',
      },
      {
        label: 'Court diary',
        to: '/court',
        icon: 'Gavel',
        permission: 'court:read',
        match: '/court',
        badge: 'hearings',
        description: 'Hearings, adjournments and outcomes.',
      },
      {
        label: 'Documents',
        to: '/documents',
        icon: 'FolderOpen',
        permission: 'document:read',
        match: '/documents',
        description: 'Central library with versions and retention.',
      },
      {
        label: 'Templates',
        to: '/templates',
        icon: 'FileSignature',
        permission: 'template:read',
        match: '/templates',
        description: 'Statutory letters and merge fields.',
      },
      {
        label: 'Reports',
        to: '/reports',
        icon: 'BarChart3',
        permission: 'report:read',
        match: '/reports',
        description: 'Standard reports, builder and schedules.',
      },
    ],
  },
  {
    id: 'oversight',
    label: 'Oversight',
    items: [
      {
        label: 'Audit trail',
        to: '/audit',
        icon: 'ScrollText',
        permission: 'audit:read',
        end: true,
        description: 'Immutable record of every action.',
      },
      {
        label: 'Access logs',
        to: '/audit/access',
        icon: 'Eye',
        permission: 'audit:read',
        description: 'Who viewed, downloaded or printed a document.',
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      {
        label: 'Users',
        to: '/admin/users',
        icon: 'Users',
        permission: 'user:read',
        match: '/admin/users',
        description: 'Accounts, roles, MFA and status.',
      },
      {
        label: 'Roles & permissions',
        to: '/admin/roles',
        icon: 'ShieldCheck',
        permission: 'role:manage',
        description: 'The permission matrix for every role.',
      },
      {
        label: 'Organisation',
        to: '/admin/organisation',
        icon: 'Building2',
        permission: 'org:manage',
        description: 'Departments, teams, courts and taxonomies.',
      },
      {
        label: 'Bulk import',
        to: '/admin/import',
        icon: 'Upload',
        permission: 'import:bulk',
        description: 'CSV import with column mapping and validation.',
      },
      {
        label: 'Integrations',
        to: '/admin/integrations',
        icon: 'Plug',
        permission: 'integration:manage',
        description: 'API clients, webhooks and single sign-on.',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      {
        label: 'Settings',
        to: '/system/settings',
        icon: 'Settings',
        permission: 'system:settings',
        description: 'SLA, security, retention and notifications.',
      },
      {
        label: 'Monitoring',
        to: '/system/monitoring',
        icon: 'Activity',
        permission: 'system:monitor',
        description: 'Service health, queues and error rates.',
      },
      {
        label: 'Backups & export',
        to: '/system/backups',
        icon: 'DatabaseBackup',
        permission: ['system:backup', 'system:export'],
        description: 'Snapshots, restores and data extracts.',
      },
    ],
  },
]

/** Items reachable from the utility bar rather than the sidebar. */
export const UTILITY_NAV: NavItem[] = [
  { label: 'Notifications', to: '/notifications', icon: 'Bell', badge: 'unread' },
  { label: 'Global search', to: '/search', icon: 'Search' },
  { label: 'My profile', to: '/profile', icon: 'UserCircle' },
  { label: 'Help & guidance', to: '/help', icon: 'LifeBuoy' },
]
