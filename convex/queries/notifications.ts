/**
 * Notifications read queries (FR-012, ToR §13).
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { getCurrentUser, sessionSecurityRequirement } from "../lib/session";

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Anonymous-safe: the DataContext calls this on every render (including the
    // login screen) — return an empty list instead of throwing.
    const user = await getCurrentUser(ctx);
    if (!user || user.status !== "active" || await sessionSecurityRequirement(ctx, user)) return [];
    const limit = Math.min(args.limit ?? 100, 500);
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit);
    return rows;
  },
});

export const unread = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.status !== "active" || await sessionSecurityRequirement(ctx, user)) return 0;
    const rows = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("isRead", false))
      .take(1000);
    return rows.length;
  },
});

export const preferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.status !== "active") return [];
    const rows = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .take(100);
    return rows;
  },
});
