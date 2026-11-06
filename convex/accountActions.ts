import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { createAuth } from "./auth";

export const deliverInvitation = internalAction({
  args: { invitationId: v.id("invitations") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const invitation = await ctx.runMutation(internal.internal.accountDb.claimInvitation, args);
    if (!invitation) return null;
    try {
      const auth = await createAuth(ctx, { allowSystemProvisioning: true }).$context;
      const existing = await auth.internalAdapter.findUserByEmail(invitation.email);
      const bound = await ctx.runQuery(internal.internal.accountDb.accountBinding, { userId: invitation.userId });
      if (existing && existing.user.id !== bound) throw new Error("An existing authentication account cannot be replaced by an invitation.");
      const account = existing?.user ?? await auth.internalAdapter.createUser({ email: invitation.email, name: invitation.name, emailVerified: true }, { method: "admin" });
      await ctx.runMutation(internal.internal.accountDb.bindAccount, { userId: invitation.userId, authUserId: account.id });
      const identifier = `reset-password:${invitation.token}`;
      const verification = await auth.internalAdapter.findVerificationValue(identifier);
      if (!verification) await auth.internalAdapter.createVerificationValue({ value: account.id, identifier, expiresAt: new Date(invitation.expiresAt) });
      const origin = (process.env.FRONTEND_ORIGINS ?? "").split(",")[0]?.trim();
      if (!origin || !/^https?:\/\//.test(origin)) throw new Error("Frontend origin is not configured.");
      const url = `${auth.baseURL}/reset-password/${invitation.token}?callbackURL=${encodeURIComponent(`${origin}/reset-password`)}`;
      const result = await ctx.runAction(internal.actions.email.deliverAccountEmail, { to: invitation.email, url, invitation: true, idempotencyKey: `foi-invite-${args.invitationId}-${invitation.expiresAt}` });
      await ctx.runMutation(internal.internal.accountDb.finishInvitation, { invitationId: args.invitationId, status: result ? "sent" : "blocked" });
    } catch {
      await ctx.runMutation(internal.internal.accountDb.finishInvitation, { invitationId: args.invitationId, status: "failed" });
    }
    return null;
  },
});
