"use node";

/**
 * Data export (FR-046, FR-065, ToR §17/§18). Generates CSV for the requested
 * scope, uploads to storage, and returns a signed download URL. Audit-logged.
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getCurrentIdentity } from "../lib/session";
import type { Id } from "../_generated/dataModel";

export const exportData = action({
  args: {
    scope: v.union(v.literal("cases"), v.literal("documents"), v.literal("users"), v.literal("audit"), v.literal("court_dates")),
  },
  handler: async (ctx, args) => {
    // Permission check via the caller's identity (actions cannot call requirePermission directly).
    const identity = await getCurrentIdentity(ctx);
    if (!identity) throw new Error("Unauthenticated");

    // Authorize: super_admin / admin / auditor only.
    const user = await ctx.runQuery(internal.internal.exportDb.getUserForExport, {
      authUserId: identity.subject,
    });
    if (!user || (user.roleId !== "super_admin" && user.roleId !== "admin" && user.roleId !== "auditor")) {
      throw new Error("Forbidden: requires export permission.");
    }

    // Pull the scoped rows and build CSV.
    let csv = "";
    let fileName = "";
    const stamp = new Date().toISOString().slice(0, 10);

    if (args.scope === "cases") {
      const rows = await ctx.runQuery(internal.internal.exportDb.listCasesForExport, {});
      fileName = `hyprep-foi-cases-${stamp}.csv`;
      csv = toCsv(
        rows.map((c) => ({
          case_number: c.caseNumber,
          subject: c.subject,
          requestor: c.requestor.name,
          organization: c.requestor.organization ?? "",
          department: c.department,
          status: c.status,
          priority: c.priority,
          date_submitted: c.dateSubmitted.slice(0, 10),
          statutory_due_date: c.statutoryDueDate,
          date_closed: c.dateClosed?.slice(0, 10) ?? "",
          outcome: c.outcomeCode ?? "",
        })),
      );
    } else if (args.scope === "documents") {
      const rows = await ctx.runQuery(internal.internal.exportDb.listDocumentsForExport, {});
      fileName = `hyprep-foi-documents-${stamp}.csv`;
      csv = toCsv(
        rows.map((d) => ({
          file_name: d.fileName,
          case_id: d.caseId,
          kind: d.kind,
          version: d.version,
          size_bytes: d.fileSize,
          redactions: d.redactionCount,
          confidentiality: d.confidentiality,
          retention: d.retentionLabel,
        })),
      );
    } else if (args.scope === "users") {
      const rows = await ctx.runQuery(internal.internal.exportDb.listUsersForExport, {});
      fileName = `hyprep-foi-users-${stamp}.csv`;
      csv = toCsv(
        rows.map((u) => ({
          name: u.name,
          email: u.email,
          role: u.roleId,
          organization: u.organization,
          department: u.department ?? "",
          status: u.status,
          mfa: u.mfaEnabled,
        })),
      );
    } else if (args.scope === "court_dates") {
      const rows = await ctx.runQuery(internal.internal.exportDb.listCourtForExport, {});
      fileName = `hyprep-foi-court-${stamp}.csv`;
      csv = toCsv(
        rows.map((cd) => ({
          suit_number: cd.suitNumber,
          case_id: cd.caseId,
          date: cd.date,
          time: cd.time,
          court: cd.courtName,
          judge: cd.judge,
          hearing_type: cd.hearingType,
          status: cd.status,
          outcome: cd.outcome ?? "",
        })),
      );
    } else {
      const rows = await ctx.runQuery(internal.internal.exportDb.listAuditForExport, {});
      fileName = `hyprep-foi-audit-${stamp}.csv`;
      csv = toCsv(
        rows.map((a) => ({
          timestamp: a.timestamp,
          entity: `${a.entityType}: ${a.entityLabel}`,
          action: a.action,
          performed_by: a.performedBy,
          severity: a.severity,
          ip_address: a.ipAddress,
          details: a.details,
        })),
      );
    }

    // Upload CSV to storage, get a signed URL.
    const storageId = await ctx.storage.store(new Blob([csv], { type: "text/csv" }));
    const url = await ctx.storage.getUrl(storageId);

    // Audit the export.
    if (user) {
      await ctx.runMutation(internal.internal.exportDb.recordExportAudit, {
        performedBy: user._id as Id<"users">,
        scope: args.scope,
        details: `Full ${args.scope} export generated.`,
      });
    }

    return { fileName, url, storageId };
  },
});

function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "empty\n";
  const headers = Object.keys(rows[0]!);
  const body = rows
    .map((row) => headers.map((h) => JSON.stringify(String(row[h] ?? ""))).join(","))
    .join("\n");
  return `${headers.join(",")}\n${body}`;
}
