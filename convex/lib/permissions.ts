/**
 * Server-side RBAC — the authoritative permission catalogue and role
 * definitions, ported from `src/lib/rbac.ts` (ToR FR-003).
 *
 * The client copy in `src/lib/rbac.ts` is kept only for UI affordance
 * (navigation/button visibility); every query and mutation re-checks
 * server-side through `requirePermission` and row-scoping helpers.
 */

export type RoleId =
  | "super_admin"
  | "admin"
  | "legal"
  | "clerk"
  | "requestor"
  | "auditor"
  | "external";

export type Permission =
  /* Cases */
  | "case:read:all"
  | "case:read:assigned"
  | "case:read:own"
  | "case:create"
  | "case:update"
  | "case:assign"
  | "case:close"
  | "case:escalate"
  | "case:link"
  | "case:delete"
  | "case:bulk"
  | "case:triage"
  /* Documents */
  | "document:read"
  | "document:upload"
  | "document:download"
  | "document:publish"
  | "document:redact"
  | "document:delete"
  | "document:retention"
  /* Notes and collaboration */
  | "note:read:internal"
  | "note:write:internal"
  | "note:write:public"
  | "task:manage"
  /* Court */
  | "court:read"
  | "court:write"
  | "court:outcome"
  /* Templates */
  | "template:read"
  | "template:manage"
  /* Reports */
  | "report:read"
  | "report:build"
  | "report:schedule"
  | "report:export"
  /* Users and roles */
  | "user:read"
  | "user:write"
  | "user:delete"
  | "role:manage"
  /* Organisation */
  | "org:manage"
  /* System (super-admin) */
  | "system:settings"
  | "system:monitor"
  | "system:backup"
  | "system:export"
  | "system:retention"
  /* Audit */
  | "audit:read"
  | "audit:export"
  /* Integration */
  | "integration:manage"
  | "import:bulk";

const LEGAL_PERMISSIONS: Permission[] = [
  "case:read:all",
  "case:read:assigned",
  "case:create",
  "case:update",
  "case:assign",
  "case:triage",
  "case:escalate",
  "case:link",
  "case:close",
  "case:bulk",
  "document:read",
  "document:upload",
  "document:download",
  "document:publish",
  "document:redact",
  "note:read:internal",
  "note:write:internal",
  "note:write:public",
  "task:manage",
  "court:read",
  "court:write",
  "court:outcome",
  "template:read",
  "report:read",
  "report:build",
  "report:export",
  "user:read",
];

const CLERK_PERMISSIONS: Permission[] = [
  "case:read:all",
  "case:read:assigned",
  "case:create",
  "case:update",
  "document:read",
  "document:upload",
  "document:download",
  "document:retention",
  "note:read:internal",
  "note:write:internal",
  "court:read",
  "court:write",
  "template:read",
  "report:read",
  "report:export",
  "user:read",
];

const ADMIN_PERMISSIONS: Permission[] = [
  ...LEGAL_PERMISSIONS,
  "document:retention",
  "document:delete",
  "template:manage",
  "report:schedule",
  "user:write",
  "user:delete",
  "org:manage",
  "audit:read",
  "audit:export",
  "import:bulk",
];

export const ALL_PERMISSIONS: Permission[] = Array.from(
  new Set([
    ...ADMIN_PERMISSIONS,
    "system:settings",
    "system:monitor",
    "system:backup",
    "system:export",
    "system:retention",
    "integration:manage",
    "role:manage",
  ]),
);

export interface RoleDefinition {
  id: RoleId;
  name: string;
  description: string;
  permissions: Permission[];
  isSystem: boolean;
}

export const ROLES: RoleDefinition[] = [
  {
    id: "super_admin",
    name: "Super-Admin",
    description:
      "Full system control: organisations, users and roles, system settings, retention, emergency exports.",
    permissions: ALL_PERMISSIONS,
    isSystem: true,
  },
  {
    id: "admin",
    name: "Admin",
    description:
      "Manage users, assign cases, manage categories and tags, review reports, moderate content and set permissions.",
    permissions: Array.from(new Set(ADMIN_PERMISSIONS)),
    isSystem: true,
  },
  {
    id: "legal",
    name: "Legal Unit",
    description:
      "Lawyers, paralegals and case officers: create and update case records, upload responses, add court dates, annotate documents and mark statuses.",
    permissions: Array.from(new Set(LEGAL_PERMISSIONS)),
    isSystem: true,
  },
  {
    id: "clerk",
    name: "Clerk / Support",
    description:
      "Administer documents, manage scheduling, perform data entry and assist Legal Unit staff.",
    permissions: Array.from(new Set(CLERK_PERMISSIONS)),
    isSystem: true,
  },
  {
    id: "requestor",
    name: "Requestor",
    description:
      "General users: submit FOI requests, view their own requests and responses, receive notifications and create appeals.",
    permissions: ["case:read:own", "case:create", "document:read", "document:download"],
    isSystem: true,
  },
  {
    id: "auditor",
    name: "Auditor",
    description:
      "Read-only access across cases, documents and logs for compliance and audit purposes.",
    permissions: [
      "case:read:all",
      "document:read",
      "note:read:internal",
      "court:read",
      "report:read",
      "report:export",
      "audit:read",
      "audit:export",
      "user:read",
    ],
    isSystem: true,
  },
  {
    id: "external",
    name: "External Stakeholder",
    description:
      "External lawyers and government officials. Access is limited to cases they are explicitly assigned to.",
    permissions: [
      "case:read:assigned",
      "document:read",
      "document:download",
      "note:write:public",
      "court:read",
    ],
    isSystem: true,
  },
];

export function getRole(roleId: RoleId | string): RoleDefinition {
  return ROLES.find((role) => role.id === roleId) ?? ROLES[ROLES.length - 1]!;
}

export function permissionsFor(roleId: RoleId | string): Permission[] {
  return getRole(roleId).permissions;
}

export function hasPermission(
  roleId: RoleId | string,
  permission: Permission | Permission[],
  mode: "any" | "all" = "any",
): boolean {
  const granted = permissionsFor(roleId);
  const required = Array.isArray(permission) ? permission : [permission];
  if (required.length === 0) return true;
  return mode === "all"
    ? required.every((p) => granted.includes(p))
    : required.some((p) => granted.includes(p));
}

export type CaseVisibility = "all" | "assigned" | "own" | "none";

/** Row-level scoping. Determines which cases a user may see at all. */
export function caseVisibility(roleId: RoleId | string): CaseVisibility {
  if (hasPermission(roleId, "case:read:all")) return "all";
  if (hasPermission(roleId, "case:read:assigned")) return "assigned";
  if (hasPermission(roleId, "case:read:own")) return "own";
  return "none";
}

export interface CaseScopedRow {
  _id: string;
  assignedTo?: string | null;
  assignedTeamId?: string | null;
  requestorId?: string;
  requestorUserId?: string;
  requestor?: { name: string; email: string };
}

export function canSeeCase(
  roleId: RoleId | string,
  userId: string,
  foiCase: CaseScopedRow,
  teamMemberIds: string[] = [],
  userTeamId?: string | null,
): boolean {
  switch (caseVisibility(roleId)) {
    case "all":
      return true;
    case "assigned":
      return (
        foiCase.assignedTo === userId ||
        (!!userTeamId && foiCase.assignedTeamId === userTeamId) ||
        (foiCase.assignedTo ? teamMemberIds.includes(foiCase.assignedTo) : false)
      );
    case "own":
        return (foiCase.requestorUserId ?? foiCase.requestorId) === userId;
    default:
      return false;
  }
}

export function visibleCases<CaseRow extends CaseScopedRow>(
  roleId: RoleId | string,
  userId: string,
  cases: CaseRow[],
  teamMemberIds: string[] = [],
  userTeamId?: string | null,
): CaseRow[] {
  const scope = caseVisibility(roleId);
  if (scope === "all") return cases;
  if (scope === "none") return [];
  return cases.filter((c) => canSeeCase(roleId, userId, c, teamMemberIds, userTeamId));
}

/** Read-only roles never see mutating affordances, even where a permission overlaps. */
export function isReadOnly(roleId: RoleId | string): boolean {
  return roleId === "auditor";
}

/** The landing route each role sees after sign-in. */
export function homeRouteFor(roleId: RoleId | string): string {
  switch (roleId) {
    case "super_admin":
      return "/dashboard/system";
    case "admin":
      return "/dashboard/admin";
    case "legal":
    case "clerk":
      return "/dashboard/legal";
    case "auditor":
      return "/dashboard/audit";
    default:
      return "/my-requests";
  }
}
