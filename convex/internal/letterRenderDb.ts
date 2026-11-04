/**
 * Internal DB functions backing the letter-render action.
 */
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const getRenderData = internalQuery({
  args: {
    templateId: v.id("templates"),
    caseId: v.id("cases"),
    actorAuthUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const template = await ctx.db.get("templates", args.templateId);
    if (!template) return null;
    const c = await ctx.db.get("cases", args.caseId);
    if (!c) return null;

    // Authorization: caller must be staff (legal/clerk/admin/super_admin).
    const actor = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", args.actorAuthUserId))
      .first();
    if (!actor) return null;
    const allowedRoles = ["legal", "clerk", "admin", "super_admin"];
    if (!allowedRoles.includes(actor.roleId)) return { authorized: false };

    const courtDate = await ctx.db
      .query("courtDates")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .first();

    return {
      authorized: true,
      body: template.body,
      templateName: template.name,
      caseNumber: c.caseNumber,
      requestorName: c.requestor.name,
      requestorOrganization: c.requestor.organization ?? "",
      requestorEmail: c.requestor.email,
      subject: c.subject,
      dateSubmitted: c.dateSubmitted.slice(0, 10),
      statutoryDueDate: c.statutoryDueDate,
      department: c.department,
      actorName: actor.name,
      actorPosition: actor.position ?? null,
      suitNumber: courtDate?.suitNumber ?? null,
      courtName: courtDate?.courtName ?? null,
      hearingDate: courtDate?.date ?? null,
    };
  },
});

export const bumpUsage = internalMutation({
  args: { templateId: v.id("templates") },
  handler: async (ctx, args) => {
    const template = await ctx.db.get("templates", args.templateId);
    if (!template) return null;
    await ctx.db.patch("templates", args.templateId, { usageCount: template.usageCount + 1 });
    return null;
  },
});
