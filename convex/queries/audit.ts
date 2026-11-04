/**
 * Audit + access log read queries (FR-006, ToR §16).
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission } from "../lib/session";

export const listAuditLogs = query({
  args: {
    q: v.optional(v.string()),
    actions: v.optional(v.array(v.string())),
    severities: v.optional(v.array(v.string())),
    actorIds: v.optional(v.array(v.string())),
    entityTypes: v.optional(v.array(v.string())),
    dateFrom: v.optional(v.string()),
    dateTo: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audit:read");
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(Math.max(1, args.pageSize ?? 25), 200);
    const needle = args.q?.trim().toLowerCase();

    const rows = await ctx.db
      .query("auditLogs")
      .withIndex("by_timestamp")
      .order("desc")
      .take(Math.min((page + 1) * pageSize, 2000));

    const filtered = rows.filter((log) => {
      if (args.actions?.length && !args.actions.includes(log.action)) return false;
      if (args.severities?.length && !args.severities.includes(log.severity)) return false;
      if (args.actorIds?.length && !args.actorIds.includes(log.performedBy)) return false;
      if (args.entityTypes?.length && !args.entityTypes.includes(log.entityType)) return false;
      if (args.dateFrom && log.timestamp.slice(0, 10) < args.dateFrom) return false;
      if (args.dateTo && log.timestamp.slice(0, 10) > args.dateTo) return false;
      if (needle) {
        const haystack = `${log.entityLabel} ${log.details} ${log.ipAddress}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    return { rows: pageRows, total, page: safePage, pageSize, pageCount };
  },
});

export const listAccessLogs = query({
  args: {
    q: v.optional(v.string()),
    action: v.optional(v.string()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "audit:read");
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(Math.max(1, args.pageSize ?? 25), 200);
    const needle = args.q?.trim().toLowerCase();

    const rows = await ctx.db
      .query("accessLogs")
      .withIndex("by_at")
      .order("desc")
      .take(Math.min((page + 1) * pageSize, 2000));

    const filtered = rows.filter((log) => {
      if (args.action && log.action !== args.action) return false;
      if (needle) {
        const haystack = `${log.documentName} ${log.caseNumber} ${log.ipAddress}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const total = filtered.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    return { rows: pageRows, total, page: safePage, pageSize, pageCount };
  },
});
