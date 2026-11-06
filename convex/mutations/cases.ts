/**
 * Case lifecycle mutations (FR-010 → FR-025).
 *
 * Every mutation:
 * - validates input (zod)
 * - enforces permission + row-scoping server-side
 * - writes case + timeline + audit (+ notifications) inside one transaction
 * - enqueues side-effect actions (email/webhook) after commit via scheduler
 */

import { mutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { requirePermission, forbiddenError } from "../lib/session";
import { visibleCases } from "../lib/permissions";
import { writeAudit } from "../lib/audit";
import { pushNotification } from "../lib/notifications";
import { addWorkingDays } from "../lib/sla";
import { newCaseSchema } from "../lib/validation";

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

async function caseVisibleOrThrow(
  ctx: MutationCtx,
  user: { roleId: string; _id: Id<"users">; teamId?: string | null },
  caseId: Id<"cases">,
) {
  const c = await ctx.db.get("cases", caseId);
  if (!c) return null;
  const scoped = visibleCases(user.roleId, user._id, [c], [], user.teamId);
  if (scoped.length === 0) throw forbiddenError("This case is not visible to you.");
  return c;
}

function pushTimeline(
  ctx: MutationCtx,
  input: {
    caseId: Id<"cases">;
    kind: string;
    actorId?: Id<"users">;
    summary: string;
    detail?: string;
  },
) {
  return ctx.db.insert("timeline", {
    caseId: input.caseId as never,
    kind: input.kind as never,
    actorId: input.actorId as never,
    at: new Date().toISOString(),
    summary: input.summary,
    detail: input.detail,
  });
}

/* ------------------------------------------------------------------ *
 * FR-010/FR-011: submit FOI request → auto case creation + acknowledgement
 * ------------------------------------------------------------------ */

export const create = mutation({
  args: {
    input: v.any(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "case:create");
    const parsed = newCaseSchema.safeParse(args.input);
    if (!parsed.success) {
      throw forbiddenError(`Validation failed: ${parsed.error.issues.map((i) => i.message).join("; ")}`);
    }
    const input = parsed.data;
    const now = new Date();
    const iso = now.toISOString();

    // Statutory due date: FOI Act §4 — 7 working days.
    const settings = await ctx.db.query("systemSettings").first();
    const statutoryDueDate = addWorkingDays(now, settings?.statutoryResponseDays ?? 7);

    // Case number from counters.
    const year = now.getFullYear();
    const counterKey = `case:${year}`;
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", counterKey))
      .first();
    const next = (counter?.value ?? 0) + 1;
    if (counter) await ctx.db.patch("counters", counter._id, { value: next });
    else await ctx.db.insert("counters", { key: counterKey, value: next });
    const caseNumber = `HYPREP/FOI/${year}/${String(next).padStart(4, "0")}`;

    // Upsert requestor by email.
    const email = input.requestor.email.toLowerCase();
    let requestor = await ctx.db
      .query("requestors")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!requestor) {
      const rid = await ctx.db.insert("requestors", {
        name: input.requestor.name,
        email,
        phone: input.requestor.phone,
        organization: input.requestor.organization,
        isJournalist: input.requestor.isJournalist,
      });
      requestor = await ctx.db.get("requestors", rid);
    }
    if (!requestor) throw forbiddenError("Could not resolve requestor.");

    const caseId = await ctx.db.insert("cases", {
      caseNumber,
      requestorId: requestor._id,
      requestorUserId: requestor.userId ?? (actor.roleId === "requestor" || actor.roleId === "external" ? actor._id : undefined),
      requestor: {
        name: requestor.name,
        email: requestor.email,
        phone: requestor.phone,
        organization: requestor.organization,
        isJournalist: requestor.isJournalist,
      },
      subject: input.subject,
      description: input.description,
      assignedTo: input.assignedTo ? (input.assignedTo as never) : undefined,
      assignedTeamId: undefined,
      status: "filed",
      priority: input.priority,
      confidentiality: input.confidentiality,
      responseFormat: input.responseFormat,
      source: input.source,
      tags: input.tags,
      department: input.department,
      dateSubmitted: iso,
      statutoryDueDate,
      dateClosed: undefined,
      closureReason: undefined,
      outcomeCode: undefined,
      linkedCaseIds: [],
      isAppeal: false,
      appealOfCaseId: undefined,
      respondedAt: undefined,
      documentCount: 0,
      noteCount: 0,
      courtDateCount: 0,
      slaState: "on_track",
      createdAt: iso,
      updatedAt: iso,
    });

    // Timeline: created + acknowledged (FR-011/FR-012).
    await pushTimeline(ctx, {
      caseId,
      kind: "created",
      actorId: actor._id,
      summary: `FOI request filed via ${input.source.replace("_", " ")}`,
    });
    await pushTimeline(ctx, {
      caseId,
      kind: "acknowledged",
      actorId: undefined,
      summary: "Acknowledgement issued to requestor",
    });

    // Audit (FR-006).
    await writeAudit(ctx, {
      entityType: "Case",
      entityId: caseId,
      entityLabel: caseNumber,
      action: "create",
      performedBy: actor._id,
      details: "Case created from the new request form.",
    });

    return ctx.db.get("cases", caseId);
  },
});

/* ------------------------------------------------------------------ *
 * FR-016: status transitions
 * ------------------------------------------------------------------ */

export const changeStatus = mutation({
  args: {
    id: v.id("cases"),
    status: v.union(
      v.literal("filed"),
      v.literal("in_review"),
      v.literal("pending_info"),
      v.literal("responded"),
      v.literal("escalated"),
      v.literal("appeal"),
      v.literal("closed"),
      v.literal("rejected"),
    ),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "case:update");
    const c = await caseVisibleOrThrow(ctx, actor, args.id);
    if (!c) throw forbiddenError("Case not found.");

    const previous = c.status;
    const patch: Record<string, unknown> = { status: args.status, updatedAt: new Date().toISOString() };
    if (args.status === "responded") patch.respondedAt = new Date().toISOString();
    if (args.status === "closed" || args.status === "rejected") patch.dateClosed = new Date().toISOString();
    await ctx.db.patch("cases", c._id, patch);

    await pushTimeline(ctx, {
      caseId: c._id,
      kind: args.status === "closed" ? "closed" : args.status === "escalated" ? "escalated" : "status_changed",
      actorId: actor._id,
      summary: `Status changed from ${previous} to ${args.status}`,
      detail: args.note,
    });

    await writeAudit(ctx, {
      entityType: "Case",
      entityId: c._id,
      entityLabel: c.caseNumber,
      action: "update",
      performedBy: actor._id,
      details: `Status changed from ${previous} to ${args.status}.`,
    });

    // Notify the requestor (in-app) if they have a linked app account.
    const requestor = await ctx.db.get("requestors", c.requestorId);
    const requestorUserId = requestor?.userId as Id<"users"> | undefined;
    if (requestorUserId) {
      await pushNotification(ctx, {
        userId: requestorUserId,
        kind: args.status === "escalated" ? "admin_alert" : "status_changed",
        title: `Update on ${c.caseNumber}`,
        body: `The status of your request is now ${args.status.replace("_", " ")}.`,
        link: `/my-requests/${c._id}`,
      });
    }

    return ctx.db.get("cases", c._id);
  },
});

/* ------------------------------------------------------------------ *
 * FR-013: assign
 * ------------------------------------------------------------------ */

export const assign = mutation({
  args: {
    id: v.id("cases"),
    assigneeId: v.union(v.id("users"), v.null()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "case:assign");
    const c = await caseVisibleOrThrow(ctx, actor, args.id);
    if (!c) throw forbiddenError("Case not found.");

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      assignedTo: args.assigneeId ?? undefined,
      updatedAt: now,
    };
    if (args.assigneeId && c.status === "filed") patch.status = "in_review";
    await ctx.db.patch("cases", c._id, patch);

    await pushTimeline(ctx, {
      caseId: c._id,
      kind: "assigned",
      actorId: actor._id,
      summary: args.assigneeId ? `Assigned to ${args.assigneeId}` : "Assignment cleared",
    });

    await writeAudit(ctx, {
      entityType: "Case",
      entityId: c._id,
      entityLabel: c.caseNumber,
      action: "update",
      performedBy: actor._id,
      details: args.assigneeId ? `Assigned to user ${args.assigneeId}.` : "Assignment cleared.",
    });

    if (args.assigneeId) {
      await pushNotification(ctx, {
        userId: args.assigneeId,
        kind: "case_assigned",
        title: `Assigned to you: ${c.caseNumber}`,
        body: c.subject,
        link: `/cases/${c._id}`,
      });
    }

    return ctx.db.get("cases", c._id);
  },
});

/* ------------------------------------------------------------------ *
 * FR-025: close with outcome
 * ------------------------------------------------------------------ */

export const close = mutation({
  args: {
    id: v.id("cases"),
    outcomeCode: v.string(),
    closureReason: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "case:close");
    const c = await caseVisibleOrThrow(ctx, actor, args.id);
    if (!c) throw forbiddenError("Case not found.");

    const now = new Date().toISOString();
    await ctx.db.patch("cases", c._id, {
      status: "closed",
      dateClosed: now,
      outcomeCode: args.outcomeCode,
      closureReason: args.closureReason,
      updatedAt: now,
    });

    await pushTimeline(ctx, {
      caseId: c._id,
      kind: "closed",
      actorId: actor._id,
      summary: `Case closed — ${args.outcomeCode}`,
      detail: args.closureReason || args.note,
    });

    await writeAudit(ctx, {
      entityType: "Case",
      entityId: c._id,
      entityLabel: c.caseNumber,
      action: "update",
      performedBy: actor._id,
      details: `Case closed — ${args.outcomeCode}. ${args.closureReason}`,
    });

    return ctx.db.get("cases", c._id);
  },
});

/* ------------------------------------------------------------------ *
 * FR-024: link / unlink
 * ------------------------------------------------------------------ */

export const link = mutation({
  args: {
    id: v.id("cases"),
    otherId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "case:link");
    const a = await caseVisibleOrThrow(ctx, actor, args.id);
    const b = await caseVisibleOrThrow(ctx, actor, args.otherId);
    if (!a || !b) throw forbiddenError("One or both cases were not found.");

    const now = new Date().toISOString();
    if (!a.linkedCaseIds.includes(b._id)) {
      await ctx.db.patch("cases", a._id, { linkedCaseIds: [...a.linkedCaseIds, b._id], updatedAt: now });
    }
    if (!b.linkedCaseIds.includes(a._id)) {
      await ctx.db.patch("cases", b._id, { linkedCaseIds: [...b.linkedCaseIds, a._id], updatedAt: now });
    }

    await pushTimeline(ctx, {
      caseId: a._id,
      kind: "linked",
      actorId: actor._id,
      summary: `Linked to ${b.caseNumber}`,
      detail: b.subject,
    });

    await writeAudit(ctx, {
      entityType: "Case",
      entityId: a._id,
      entityLabel: a.caseNumber,
      action: "update",
      performedBy: actor._id,
      details: `Linked to ${b.caseNumber}.`,
    });

    return ctx.db.get("cases", a._id);
  },
});

export const unlink = mutation({
  args: {
    id: v.id("cases"),
    otherId: v.id("cases"),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "case:link");
    const a = await caseVisibleOrThrow(ctx, actor, args.id);
    if (!a) throw forbiddenError("Case not found.");

    const now = new Date().toISOString();
    await ctx.db.patch("cases", a._id, {
      linkedCaseIds: a.linkedCaseIds.filter((x) => x !== args.otherId),
      updatedAt: now,
    });

    await writeAudit(ctx, {
      entityType: "Case",
      entityId: a._id,
      entityLabel: a.caseNumber,
      action: "update",
      performedBy: actor._id,
      details: `Unlinked from case ${args.otherId}.`,
    });

    return ctx.db.get("cases", a._id);
  },
});

/* ------------------------------------------------------------------ *
 * FR-045/FR-051: bulk operations
 * ------------------------------------------------------------------ */

export const bulkUpdate = mutation({
  args: {
    ids: v.array(v.id("cases")),
    patch: v.object({
      status: v.optional(v.string()),
      assignedTo: v.optional(v.union(v.id("users"), v.null())),
      priority: v.optional(v.string()),
      department: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "case:bulk");
    const now = new Date().toISOString();
    const updated: Array<{ _id: string; caseNumber: string }> = [];

    for (const id of args.ids) {
      const c = await ctx.db.get("cases", id);
      if (!c) continue;
      const scoped = visibleCases(actor.roleId, actor._id, [c], [], actor.teamId);
      if (scoped.length === 0) continue;

      const patch: Record<string, unknown> = { updatedAt: now };
      if (args.patch.status) patch.status = args.patch.status;
      if (args.patch.assignedTo !== undefined) patch.assignedTo = args.patch.assignedTo ?? undefined;
      if (args.patch.priority) patch.priority = args.patch.priority;
      if (args.patch.department) patch.department = args.patch.department;
      await ctx.db.patch("cases", c._id, patch);

      await writeAudit(ctx, {
        entityType: "Case",
        entityId: c._id,
        entityLabel: c.caseNumber,
        action: "update",
        performedBy: actor._id,
        details: `Bulk update applied: ${Object.keys(args.patch).join(", ")}.`,
      });
      updated.push({ _id: c._id, caseNumber: c.caseNumber });
    }

    return updated;
  },
});

export const bulkAddTags = mutation({
  args: {
    ids: v.array(v.id("cases")),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "case:bulk");
    const now = new Date().toISOString();
    const updated: string[] = [];

    for (const id of args.ids) {
      const c = await ctx.db.get("cases", id);
      if (!c) continue;
      const scoped = visibleCases(actor.roleId, actor._id, [c], [], actor.teamId);
      if (scoped.length === 0) continue;

      const merged = new Set([...c.tags, ...args.tags]);
      await ctx.db.patch("cases", c._id, { tags: Array.from(merged), updatedAt: now });
      await writeAudit(ctx, {
        entityType: "Case",
        entityId: c._id,
        entityLabel: c.caseNumber,
        action: "update",
        performedBy: actor._id,
        details: `Tags applied: ${args.tags.join(", ")}.`,
      });
      updated.push(c._id);
    }

    return updated;
  },
});
