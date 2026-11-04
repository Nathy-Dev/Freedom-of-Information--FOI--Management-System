/**
 * Notification mutations (FR-012, ToR §13).
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requireUser } from "../lib/session";

export const markRead = mutation({
  args: { notificationId: v.id("notifications") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const n = await ctx.db.get("notifications", args.notificationId);
    if (!n || n.userId !== user._id) return null;
    await ctx.db.patch("notifications", args.notificationId, { isRead: true });
    return ctx.db.get("notifications", args.notificationId);
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", user._id).eq("isRead", false))
      .collect();
    for (const n of unread) {
      await ctx.db.patch("notifications", n._id, { isRead: true });
    }
  },
});

export const setPreference = mutation({
  args: {
    kind: v.union(
      v.literal("case_assigned"),
      v.literal("status_changed"),
      v.literal("response_uploaded"),
      v.literal("due_soon"),
      v.literal("overdue"),
      v.literal("court_reminder"),
      v.literal("mention"),
      v.literal("task_assigned"),
      v.literal("admin_alert"),
      v.literal("appeal_filed"),
    ),
    channel: v.union(v.literal("in_app"), v.literal("email"), v.literal("sms")),
    value: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const pref = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq("kind", args.kind))
      .first();
    if (!pref) {
      await ctx.db.insert("notificationPreferences", {
        userId: user._id,
        kind: args.kind,
        label: args.kind.replace(/_/g, " "),
        description: "",
        inApp: true,
        email: true,
        sms: false,
        ...(args.channel === "in_app" ? { inApp: args.value } : {}),
        ...(args.channel === "email" ? { email: args.value } : {}),
        ...(args.channel === "sms" ? { sms: args.value } : {}),
      });
    } else {
      await ctx.db.patch("notificationPreferences", pref._id, {
        ...(args.channel === "in_app" ? { inApp: args.value } : {}),
        ...(args.channel === "email" ? { email: args.value } : {}),
        ...(args.channel === "sms" ? { sms: args.value } : {}),
      });
    }
    return null;
  },
});
