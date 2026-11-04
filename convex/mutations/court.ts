/**
 * Court diary mutations (ToR §11).
 */

import { mutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requirePermission, forbiddenError } from "../lib/session";
import { visibleCases } from "../lib/permissions";
import { writeAudit } from "../lib/audit";
import { pushNotification } from "../lib/notifications";

async function assertCaseAccess(
  ctx: MutationCtx,
  user: { roleId: string; _id: Id<"users">; teamId?: string | null },
  caseId: Id<"cases">,
) {
  const c = await ctx.db.get("cases", caseId);
  if (!c) throw forbiddenError("Case not found.");
  const scoped = visibleCases(user.roleId, user._id, [c], [], user.teamId);
  if (scoped.length === 0) throw forbiddenError("This case is not visible to you.");
  return c;
}

export const schedule = mutation({
  args: {
    caseId: v.id("cases"),
    suitNumber: v.string(),
    date: v.string(),
    time: v.string(),
    durationMinutes: v.optional(v.number()),
    courtName: v.string(),
    location: v.optional(v.string()),
    judge: v.optional(v.string()),
    hearingType: v.union(
      v.literal("mention"),
      v.literal("motion"),
      v.literal("hearing"),
      v.literal("judgment"),
      v.literal("adoption_of_address"),
      v.literal("pre_trial"),
    ),
    counselIds: v.optional(v.array(v.id("users"))),
    notes: v.optional(v.string()),
    reminderLeadDays: v.optional(v.array(v.number())),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "court:write");
    const c = await assertCaseAccess(ctx, actor, args.caseId);
    if (!c) throw forbiddenError("Case not found.");

    const now = new Date().toISOString();
    const recordId = await ctx.db.insert("courtDates", {
      caseId: args.caseId,
      suitNumber: args.suitNumber,
      date: args.date,
      time: args.time,
      durationMinutes: args.durationMinutes ?? 60,
      courtId: undefined,
      courtName: args.courtName,
      location: args.location ?? "",
      judge: args.judge ?? "",
      hearingType: args.hearingType,
      status: "scheduled",
      counselIds: args.counselIds ?? [],
      notes: args.notes ?? "",
      outcome: undefined,
      nextActionDue: undefined,
      reminderLeadDays: args.reminderLeadDays ?? [2],
      createdBy: actor._id,
      createdAt: now,
    });

    await ctx.db.patch("cases", args.caseId, { courtDateCount: c.courtDateCount + 1, updatedAt: now });
    await ctx.db.insert("timeline", {
      caseId: args.caseId,
      kind: "court_scheduled",
      actorId: actor._id,
      at: now,
      summary: `${args.hearingType.replace(/_/g, " ")} listed at ${args.courtName}`,
      detail: `${args.date} at ${args.time} before ${args.judge || "the court"}. Suit no. ${args.suitNumber}.`,
    });
    await writeAudit(ctx, {
      entityType: "CourtDate",
      entityId: recordId,
      entityLabel: args.suitNumber,
      action: "create",
      performedBy: actor._id,
      details: `Hearing listed at ${args.courtName} on ${args.date}.`,
    });

    for (const counselId of args.counselIds ?? []) {
      await pushNotification(ctx, {
        userId: counselId,
        kind: "court_reminder",
        title: `Hearing listed: ${args.suitNumber}`,
        body: `${args.courtName} on ${args.date} at ${args.time}.`,
        link: `/court`,
      });
    }

    return ctx.db.get("courtDates", recordId);
  },
});

export const recordOutcome = mutation({
  args: {
    courtDateId: v.id("courtDates"),
    status: v.union(v.literal("scheduled"), v.literal("held"), v.literal("adjourned"), v.literal("cancelled")),
    outcome: v.string(),
    nextActionDue: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "court:outcome");
    const record = await ctx.db.get("courtDates", args.courtDateId);
    if (!record) throw forbiddenError("Hearing not found.");

    const c = await ctx.db.get("cases", record.caseId);
    if (!c) return null;
    const scoped = visibleCases(actor.roleId, actor._id, [c], [], actor.teamId);
    if (scoped.length === 0) throw forbiddenError("This case is not visible to you.");

    await ctx.db.patch("courtDates", args.courtDateId, {
      status: args.status,
      outcome: args.outcome,
      nextActionDue: args.nextActionDue ?? undefined,
    });

    await ctx.db.insert("timeline", {
      caseId: record.caseId,
      kind: "court_outcome",
      actorId: actor._id,
      at: new Date().toISOString(),
      summary: "Hearing outcome recorded",
      detail: args.outcome,
    });
    await writeAudit(ctx, {
      entityType: "CourtDate",
      entityId: args.courtDateId,
      entityLabel: record.suitNumber,
      action: "update",
      performedBy: actor._id,
      details: `Outcome recorded: ${args.outcome}`,
    });

    return ctx.db.get("courtDates", args.courtDateId);
  },
});
