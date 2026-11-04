/**
 * Internal DB functions for webhook delivery (called by the Node action).
 */
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

/** List active webhooks subscribed to an event. */
export const listActive = internalQuery({
  args: { event: v.string() },
  handler: async (ctx, args) => {
    const hooks = await ctx.db.query("webhooks").take(200);
    return hooks.filter((h) => h.isActive && h.events.includes(args.event));
  },
});

/** Record a delivery attempt outcome. */
export const recordDelivery = internalMutation({
  args: {
    webhookId: v.id("webhooks"),
    status: v.number(),
    at: v.string(),
  },
  handler: async (ctx, args) => {
    const hook = await ctx.db.get("webhooks", args.webhookId);
    if (!hook) return null;
    await ctx.db.patch("webhooks", args.webhookId, {
      lastDeliveryAt: args.at,
      lastStatus: args.status,
    });
    return ctx.db.get("webhooks", args.webhookId);
  },
});
