"use node";

/**
 * Outbound webhook delivery (ToR §19). Sends signed JSON payloads to
 * registered webhook URLs with retry/backoff handled by the cron `webhookRetry`.
 * Uses node:crypto for HMAC signing (Node runtime).
 */

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { createHmac } from "node:crypto";

/** Deliver an event to all active webhooks subscribed to that event type. */
export const deliver = internalAction({
  args: {
    event: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const secret = process.env.WEBHOOK_SECRET;
    const hooks = await ctx.runQuery(internal.internal.webhookDb.listActive, {
      event: args.event,
    });

    const results: Array<{ url: string; status: number | null }> = [];
    for (const hook of hooks) {
      try {
        const body = JSON.stringify({ event: args.event, ...args.payload });
        const signature = secret
          ? createHmac("sha256", secret).update(body).digest("hex")
          : "";

        const res = await fetch(hook.url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-hyprep-event": args.event,
            "x-hyprep-signature": `sha256=${signature}`,
          },
          body,
        });

        results.push({ url: hook.url, status: res.status });
        await ctx.runMutation(internal.internal.webhookDb.recordDelivery, {
          webhookId: hook._id,
          status: res.status,
          at: new Date().toISOString(),
        });
      } catch (e) {
        console.error(`[webhooks] delivery to ${hook.url} failed:`, e);
        results.push({ url: hook.url, status: null });
        await ctx.runMutation(internal.internal.webhookDb.recordDelivery, {
          webhookId: hook._id,
          status: 0,
          at: new Date().toISOString(),
        });
      }
    }

    return results;
  },
});
