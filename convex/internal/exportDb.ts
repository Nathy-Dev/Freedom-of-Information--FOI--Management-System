/**
 * Internal DB functions backing the export action.
 */
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const getUserForExport = internalQuery({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", args.authUserId))
      .first();
    if (!user) return null;
    return { _id: user._id, roleId: user.roleId };
  },
});

export const listCasesForExport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("cases").withIndex("by_date_submitted").take(5000);
    return rows.map((c) => ({
      caseNumber: c.caseNumber,
      subject: c.subject,
      requestor: c.requestor,
      department: c.department,
      status: c.status,
      priority: c.priority,
      dateSubmitted: c.dateSubmitted,
      statutoryDueDate: c.statutoryDueDate,
      dateClosed: c.dateClosed ?? null,
      outcomeCode: c.outcomeCode ?? null,
    }));
  },
});

export const listDocumentsForExport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("documents").take(5000);
    return rows.map((d) => ({
      fileName: d.fileName,
      caseId: d.caseId,
      kind: d.kind,
      version: d.version,
      fileSize: d.fileSize,
      redactionCount: d.redactionCount,
      confidentiality: d.confidentiality,
      retentionLabel: d.retentionLabel,
    }));
  },
});

export const listUsersForExport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("users").take(2000);
    return rows.map((u) => ({
      name: u.name,
      email: u.email,
      roleId: u.roleId,
      organization: u.organization,
      department: u.department ?? "",
      status: u.status,
      mfaEnabled: u.mfaEnabled,
    }));
  },
});

export const listCourtForExport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("courtDates").take(5000);
    return rows.map((cd) => ({
      suitNumber: cd.suitNumber,
      caseId: cd.caseId,
      date: cd.date,
      time: cd.time,
      courtName: cd.courtName,
      judge: cd.judge,
      hearingType: cd.hearingType,
      status: cd.status,
      outcome: cd.outcome ?? "",
    }));
  },
});

export const listAuditForExport = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("auditLogs").order("desc").take(5000);
    return rows.map((a) => ({
      timestamp: a.timestamp,
      entityType: a.entityType,
      entityLabel: a.entityLabel,
      action: a.action,
      performedBy: a.performedBy,
      severity: a.severity,
      ipAddress: a.ipAddress,
      details: a.details,
    }));
  },
});

export const recordExportAudit = internalMutation({
  args: {
    performedBy: v.id("users"),
    scope: v.string(),
    details: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      entityType: "DataExport",
      entityId: args.scope,
      entityLabel: `${args.scope} export`,
      action: "export",
      performedBy: args.performedBy,
      timestamp: new Date().toISOString(),
      details: args.details,
      ipAddress: "",
      userAgent: "",
      severity: "notice",
    });
    return null;
  },
});
