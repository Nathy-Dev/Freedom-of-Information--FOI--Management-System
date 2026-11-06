"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { sendEmail } from "./email";
import { sendSms } from "./sms";


export const deliver = internalAction({
  args: { deliveryId: v.id("notificationDeliveries") },
  returns: v.null(),
  handler: async (ctx, { deliveryId }): Promise<null> => {
    const delivery = await ctx.runMutation(internal.internal.notificationDb.claim, { deliveryId });
    if (!delivery) return null;
    try {
      const result = delivery.channel === "email"
        ? await sendEmail({ to: delivery.to, subject: 'HYPREP portal update', html: '<p>A HYPREP portal update is available. Sign in to view information you are permitted to access.</p>', text: 'A HYPREP portal update is available. Sign in to view information you are permitted to access.', idempotencyKey: `foi-notification-${deliveryId}` })
        : await sendSms({ to: delivery.to, message: 'A HYPREP portal update is available. Sign in to view it securely.' });
      const providerId = "id" in result ? result.id : result.messageId;
      await ctx.runMutation(internal.internal.notificationDb.finish, { deliveryId, attempt: delivery.attempt, status: result.skipped ? "blocked" : "sent", providerId: providerId ?? undefined });
    } catch {
      await ctx.runMutation(internal.internal.notificationDb.finish, { deliveryId, attempt: delivery.attempt, status: "failed" });
    }
    return null;
  },
});
