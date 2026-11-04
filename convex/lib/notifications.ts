/**
 * In-app notification writer (FR-012, ToR §13) + preference gating.
 * Email/SMS delivery is delegated to actions after the mutation commits.
 */

import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import type { NotificationKindLiteral } from "./constants";

export async function pushNotification(
  ctx: MutationCtx,
  input: {
    userId: Id<"users">;
    kind: NotificationKindLiteral;
    title: string;
    body: string;
    link: string;
    channels?: Array<"in_app" | "email" | "sms">;
  },
): Promise<Id<"notifications">> {
  const channels = input.channels ?? (input.kind === "mention" ? ["in_app"] : ["in_app", "email"]);
  const createdAt = new Date().toISOString();

  // Respect per-kind channel preferences.
  const pref = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user", (q) => q.eq("userId", input.userId))
    .first();
  const kind = input.kind;
  const effective = channels.filter((channel) => {
    if (!pref) return true;
    if (channel === "in_app") return pref.inApp;
    if (channel === "email") return pref.email;
    if (channel === "sms") return pref.sms;
    return true;
  });

  return ctx.db.insert("notifications", {
    userId: input.userId,
    kind,
    title: input.title,
    body: input.body,
    link: input.link,
    at: createdAt,
    isRead: false,
    channels: effective,
  });
}

export async function markNotificationRead(
  ctx: MutationCtx,
  notificationId: Id<"notifications">,
  userId: Id<"users">,
): Promise<boolean> {
  const notification = await ctx.db.get("notifications", notificationId);
  if (!notification || notification.userId !== userId) return false;
  await ctx.db.patch("notifications", notificationId, { isRead: true });
  return true;
}

export async function markAllRead(ctx: MutationCtx, userId: Id<"users">): Promise<void> {
  const unread = await ctx.db
    .query("notifications")
    .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("isRead", false))
    .collect();
  for (const n of unread) {
    await ctx.db.patch("notifications", n._id, { isRead: true });
  }
}

export async function unreadCount(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<number> {
  const rows = await ctx.db
    .query("notifications")
    .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("isRead", false))
    .take(1000);
  return rows.length;
}
