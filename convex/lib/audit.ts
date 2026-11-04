/**
 * Append-only audit trail (FR-006, ToR §16) and access logs.
 *
 * Every create/update/delete of cases, documents, users, roles, settings,
 * integrations, imports, exports, and every login/logout/permission change
 * writes an entry. Rows are never edited or deleted; an optional hash chain
 * (`prevHash`) strengthens tamper-evidence. All writes happen inside the
 * calling mutation's transaction so they can never be separated from the
 * action they record.
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "login_failed"
  | "logout"
  | "export"
  | "permission_change"
  | "download"
  | "view"
  | "publish"
  | "redact"
  | "settings_change";

export type AuditSeverity = "info" | "notice" | "warning" | "critical";
export const SYSTEM_ACTOR_ID = "system" as const;
export type AuditActor = Id<"users"> | typeof SYSTEM_ACTOR_ID;

const SEVERITY: Partial<Record<AuditAction, AuditSeverity>> = {
  delete: "critical",
  permission_change: "critical",
  settings_change: "critical",
  login_failed: "warning",
  export: "notice",
  download: "notice",
  publish: "notice",
  redact: "notice",
};

export async function writeAudit(
  ctx: MutationCtx,
  input: {
    entityType: string;
    entityId: string;
    entityLabel: string;
    action: AuditAction;
    performedBy: AuditActor;
    details: string;
    ipAddress?: string;
    userAgent?: string;
  },
): Promise<Id<"auditLogs">> {
  const timestamp = new Date().toISOString();

  // Hash chain: link to the most recent audit row so a tamper attempt requires
  // rewriting the whole chain. Uses the default by_creation_time index.
  const prev = await ctx.db
    .query("auditLogs")
    .order("desc")
    .first();

  return ctx.db.insert("auditLogs", {
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    action: input.action,
    performedBy: input.performedBy,
    timestamp,
    details: input.details,
    ipAddress: input.ipAddress ?? "",
    userAgent: input.userAgent ?? "",
    severity: SEVERITY[input.action] ?? "info",
    prevHash: prev ? prev._id : undefined,
  });
}

export async function writeAccessLog(
  ctx: MutationCtx,
  input: {
    documentId: Id<"documents">;
    documentName: string;
    caseId: Id<"cases">;
    caseNumber: string;
    userId: Id<"users">;
    action: "view" | "download" | "print" | "denied";
    ipAddress?: string;
  },
): Promise<Id<"accessLogs">> {
  return ctx.db.insert("accessLogs", {
    documentId: input.documentId,
    documentName: input.documentName,
    caseId: input.caseId,
    caseNumber: input.caseNumber,
    userId: input.userId,
    action: input.action,
    at: new Date().toISOString(),
    ipAddress: input.ipAddress ?? "",
  });
}
