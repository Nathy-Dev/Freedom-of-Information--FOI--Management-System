import { internalQuery, internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { writeAudit } from "../lib/audit";

export const accountBinding = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => (await ctx.db.get(args.userId))?.authUserId ?? null,
});

export const ssoEnabled = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => (await ctx.db.query("systemSettings").first())?.ssoEnabled ?? false,
});

export const reserveSecondFactorAttempt = internalMutation({
  args: { sessionId: v.string(), authUserId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const session = await ctx.db.query("userSessions").withIndex("by_session", (query) => query.eq("authSessionId", args.sessionId)).unique();
    if (!session || session.authUserId !== args.authUserId || (session.secondFactorAttempts ?? 0) >= 5) return false;
    await ctx.db.patch(session._id, { secondFactorAttempts: (session.secondFactorAttempts ?? 0) + 1 });
    return true;
  },
});

export const claimInvitation = internalMutation({
  args: { invitationId: v.id("invitations") },
  returns: v.union(v.null(), v.object({ userId: v.id("users"), email: v.string(), name: v.string(), token: v.string(), expiresAt: v.number() })),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation || invitation.status === "sent" || invitation.attempts >= 5 || invitation.expiresAt <= Date.now() || (invitation.leaseUntil ?? 0) > Date.now()) return null;
    const user = await ctx.db.get(invitation.userId);
    if (!user || user.status !== "invited") return null;
    await ctx.db.patch(invitation._id, { status: "sending", attempts: invitation.attempts + 1, leaseUntil: Date.now() + 120000 });
    return { userId: user._id, email: user.email, name: user.name, token: invitation.token, expiresAt: invitation.expiresAt };
  },
});

export const bindAccount = internalMutation({
  args: { userId: v.id("users"), authUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user || user.status !== "invited" || (!user.authUserId.startsWith("invited:") && user.authUserId !== user.email && user.authUserId !== args.authUserId)) throw new Error("The invitation account changed; contact an administrator.");
    await ctx.db.patch(args.userId, { authUserId: args.authUserId });
    return null;
  },
});

export const finishInvitation = internalMutation({
  args: { invitationId: v.id("invitations"), status: v.union(v.literal("sent"), v.literal("blocked"), v.literal("failed")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) return null;
    await ctx.db.patch(invitation._id, { status: args.status, leaseUntil: undefined, error: args.status === "sent" ? undefined : "Invitation could not be delivered. Check the email service and resend." });
    if (await ctx.db.get(invitation.userId)) await ctx.db.patch(invitation.userId, { invitationStatus: args.status });
    if (args.status === "failed" && invitation.attempts < 5) await ctx.scheduler.runAfter(60000 * 2 ** invitation.attempts, internal.accountActions.deliverInvitation, { invitationId: invitation._id });
    return null;
  },
});

export const activate = internalMutation({
  args: { authUserId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_auth_user", (query) => query.eq("authUserId", args.authUserId)).unique();
    if (user) {
      await ctx.db.patch(user._id, { status: user.status === "invited" ? "active" : user.status, passwordChangedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      await writeAudit(ctx, { entityType: "User", entityId: user._id, entityLabel: user.name, action: "permission_change", performedBy: user._id, details: user.status === "invited" ? "Password set and invitation activated." : "Password changed." });
    }
    return null;
  },
});

export const passwordPolicy = internalQuery({
  args: { email: v.optional(v.string()) },
  returns: v.object({ minLength: v.number(), unavailable: v.boolean(), reserved: v.boolean() }),
  handler: async (ctx, args) => {
    const settings = await ctx.db.query("systemSettings").first();
    const user = args.email ? await ctx.db.query("users").withIndex("by_email", (query) => query.eq("email", args.email!.trim().toLowerCase())).unique() : null;
    return { minLength: Math.max(8, settings?.passwordMinLength ?? 8), unavailable: user?.status === "locked" || user?.status === "suspended", reserved: !!user };
  },
});

export const mfaRequirement = internalQuery({
  args: { authUserId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.query("users").withIndex("by_auth_user", (query) => query.eq("authUserId", args.authUserId)).unique();
    const settings = await ctx.db.query("systemSettings").first();
    return !!user && !!(user.mfaRequired || (settings?.mfaRequiredForPrivileged && ["super_admin", "admin", "legal", "clerk"].includes(user.roleId)));
  },
});
