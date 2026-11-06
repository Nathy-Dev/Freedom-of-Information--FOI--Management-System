/**
 * Reports read queries (FR-050 → FR-054, ToR §14).
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission, getCurrentUser, sessionSecurityRequirement } from "../lib/session";
import { buildReport, reportFiltersValidator, reportResultValidator } from "../lib/reportData";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requirePermission(ctx, "report:read");
    const rows = actor.roleId === "super_admin" || actor.roleId === "admin" ? await ctx.db.query("reports").take(200) : await ctx.db.query("reports").withIndex("by_creator", (query) => query.eq("creatorId", actor._id)).take(200);
    return rows;
  },
});

export const get = query({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "report:read");
    const report = await ctx.db.get("reports", args.id);
    return report && (report.creatorId === actor._id || actor.roleId === "super_admin" || actor.roleId === "admin") ? report : null;
  },
});

/**
 * Run a report (ad-hoc) against the row-scoped case set. Returns rows grouped
 * by the requested groupBy with the requested metrics.
 */
export const run = query({
  args: { filters: reportFiltersValidator },
  returns: reportResultValidator,
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "report:read");
    try { return await buildReport(ctx, user, args.filters); }
    catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("Report contains more than")) throw error;
      return { groupBy: args.filters.groupBy, metrics: args.filters.metrics, rows: [], total: 0, generatedAt: new Date().toISOString(), error: error.message };
    }
  },
});

export const exportData = query({
  args: { filters: reportFiltersValidator },
  returns: reportResultValidator,
  handler: async (ctx, args) => buildReport(ctx, await requirePermission(ctx, "report:export"), args.filters),
});

export const views = query({
  args: {},
  handler: async (ctx) => {
    // Anonymous-safe: DataContext reads saved views on every render.
    const user = await getCurrentUser(ctx);
    if (!user || user.status !== "active" || await sessionSecurityRequirement(ctx, user)) return [];
    const all = await ctx.db.query("views").take(500);
    return all.filter((v) => v.isShared || v.ownerId === user._id);
  },
});
