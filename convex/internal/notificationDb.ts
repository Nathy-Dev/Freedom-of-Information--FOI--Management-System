import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

export const claim = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.union(v.null(), v.object({ attempt: v.number(), channel: v.union(v.literal("email"), v.literal("sms")), to: v.string(), title: v.string(), body: v.string(), link: v.string() })),
  handler: async (ctx, { deliveryId }) => {
    const delivery = await ctx.db.get(deliveryId);
    if (!delivery || delivery.status === "sent" || delivery.attempts >= 5 || delivery.nextAttemptAt > Date.now() || (delivery.status === "sending" && (delivery.leaseUntil ?? 0) > Date.now())) return null;
    const notification = await ctx.db.get(delivery.notificationId);
    const user = notification ? await ctx.db.get(notification.userId) : null;
    const preference = notification ? await ctx.db.query("notificationPreferences").withIndex("by_user_kind", (query) => query.eq("userId", notification.userId).eq("kind", notification.kind)).first() : null;
    const to = delivery.channel === "email" ? user?.email : user?.phone;
    if (!notification || !user || user.status !== "active" || !to || (preference && !preference[delivery.channel])) {
      await ctx.db.patch(deliveryId, { status: "blocked", error: "Recipient is unavailable or delivery is disabled.", nextAttemptAt: Date.now() + 3600000 });
      return null;
    }
    const attempt = delivery.attempts + 1;
    await ctx.db.patch(deliveryId, { status: "sending", attempts: attempt, leaseUntil: Date.now() + 120000 });
    return { attempt, channel: delivery.channel, to, title: notification.title, body: notification.body, link: notification.link };
  },
});

export const finish = internalMutation({
  args: { deliveryId: v.id("notificationDeliveries"), attempt: v.number(), status: v.union(v.literal("sent"), v.literal("failed"), v.literal("blocked")), providerId: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery || delivery.attempts !== args.attempt || delivery.status !== "sending") return null;
    const delay = Math.min(3600000, 60000 * 2 ** args.attempt);
    await ctx.db.patch(args.deliveryId, { status: args.status, providerId: args.providerId, sentAt: args.status === "sent" ? new Date().toISOString() : undefined, error: args.status === "sent" ? undefined : args.status === "blocked" ? "Delivery service is not configured." : "Delivery failed; retry scheduled if attempts remain.", nextAttemptAt: Date.now() + delay, leaseUntil: undefined, attempts: args.status === "blocked" ? delivery.attempts - 1 : delivery.attempts });
    if (args.status === "failed" && delivery.attempts < 5) await ctx.scheduler.runAfter(delay, internal.actions.notifications.deliver, { deliveryId: args.deliveryId });
    return null;
  },
});

export const retry = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    let count = 0;
    for (const status of ["pending", "failed", "blocked", "sending"] as const) {
      const deliveries = await ctx.db.query("notificationDeliveries").withIndex("by_status_due", (query) => query.eq("status", status).lte("nextAttemptAt", Date.now())).take(50);
      for (const delivery of deliveries) {
        if (delivery.attempts >= 5 || (delivery.leaseUntil ?? 0) > Date.now()) continue;
        await ctx.scheduler.runAfter(0, internal.actions.notifications.deliver, { deliveryId: delivery._id });
        count += 1;
      }
    }
    return count;
  },
});
