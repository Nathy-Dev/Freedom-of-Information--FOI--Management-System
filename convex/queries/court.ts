/**
 * Court diary read queries (ToR §11). Court dates inherit their case's
 * row-level visibility.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission, requireUser } from "../lib/session";
import { visibleCases } from "../lib/permissions";

export const list = query({
  args: {
    from: v.optional(v.string()),
    to: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "court:read");
    const cases = await ctx.db.query("cases").withIndex("by_date_submitted").take(2000) as never;
    const scopedIds = new Set(
      visibleCases(user.roleId, user._id, cases, [], user.teamId).map((c) => c._id),
    );

    let rows = await ctx.db.query("courtDates").withIndex("by_date").take(2000);
    rows = rows.filter((cd) => {
      if (!scopedIds.has(cd.caseId)) return false;
      if (args.from && cd.date < args.from) return false;
      if (args.to && cd.date > args.to) return false;
      return true;
    });

    return rows.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
  },
});

export const get = query({
  args: { id: v.id("courtDates") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "court:read");
    const record = await ctx.db.get("courtDates", args.id);
    if (!record) return null;
    const foiCase = await ctx.db.get("cases", record.caseId);
    if (!foiCase) return null;
    const scoped = visibleCases(user.roleId, user._id, [foiCase], [], user.teamId);
    if (scoped.length === 0) return null;
    return record;
  },
});

/** Upcoming hearings for a user's dashboard (scoped, bounded). */
export const upcoming = query({
  args: { from: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const today = args.from ?? new Date().toISOString().slice(0, 10);
    const limit = Math.min(args.limit ?? 10, 50);

    const cases = await ctx.db.query("cases").withIndex("by_date_submitted").take(2000) as never;
    const scopedIds = new Set(
      visibleCases(user.roleId, user._id, cases, [], user.teamId).map((c) => c._id),
    );

    const upcomingDates = await ctx.db
      .query("courtDates")
      .withIndex("by_date")
      .filter((q) => q.and(q.gte("date", today), q.eq("status", "scheduled")))
      .take(500);

    return upcomingDates
      .filter((cd) => scopedIds.has(cd.caseId))
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .slice(0, limit);
  },
});
