/**
 * Notes + tasks mutations (FR-021, FR-022, FR-023).
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

export const addNote = mutation({
  args: {
    caseId: v.id("cases"),
    content: v.string(),
    type: v.union(v.literal("internal"), v.literal("public")),
    mentions: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(
      ctx,
      args.type === "internal" ? "note:write:internal" : "note:write:public",
    );
    const c = await assertCaseAccess(ctx, actor, args.caseId);
    if (!c) throw forbiddenError("Case not found.");

    const now = new Date().toISOString();
    const noteId = await ctx.db.insert("notes", {
      caseId: args.caseId,
      userId: actor._id,
      type: args.type,
      content: args.content,
      mentions: args.mentions ?? [],
      attachmentIds: [],
      isPinned: false,
      createdAt: now,
    });

    await ctx.db.patch("cases", args.caseId, { noteCount: c.noteCount + 1, updatedAt: now });
    await ctx.db.insert("timeline", {
      caseId: args.caseId,
      kind: "note_added",
      actorId: actor._id,
      at: now,
      summary: args.type === "internal" ? "Internal note added" : "Note shared with requestor",
      detail: args.content,
    });
    await writeAudit(ctx, {
      entityType: "Note",
      entityId: noteId,
      entityLabel: "Note",
      action: "create",
      performedBy: actor._id,
      details: args.type === "internal" ? "Internal note added." : "Public note added.",
    });

    for (const mentionId of args.mentions ?? []) {
      await pushNotification(ctx, {
        userId: mentionId,
        kind: "mention",
        title: `You were mentioned on ${c.caseNumber}`,
        body: args.content,
        link: `/cases/${args.caseId}`,
      });
    }

    return ctx.db.get("notes", noteId);
  },
});

export const togglePin = mutation({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "note:write:internal");
    const note = await ctx.db.get("notes", args.noteId);
    if (!note) return null;
    await assertCaseAccess(ctx, actor, note.caseId);
    await ctx.db.patch("notes", args.noteId, { isPinned: !note.isPinned });
    return ctx.db.get("notes", args.noteId);
  },
});

export const addTask = mutation({
  args: {
    caseId: v.id("cases"),
    title: v.string(),
    assigneeId: v.id("users"),
    dueDate: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "task:manage");
    const c = await assertCaseAccess(ctx, actor, args.caseId);
    if (!c) throw forbiddenError("Case not found.");

    const now = new Date().toISOString();
    const taskId = await ctx.db.insert("tasks", {
      caseId: args.caseId,
      title: args.title,
      assigneeId: args.assigneeId,
      dueDate: args.dueDate,
      status: "open",
      createdBy: actor._id,
      createdAt: now,
    });

    await pushNotification(ctx, {
      userId: args.assigneeId,
      kind: "task_assigned",
      title: args.title,
      body: `Due ${args.dueDate.slice(0, 10)}.`,
      link: `/cases/${args.caseId}`,
    });

    return ctx.db.get("tasks", taskId);
  },
});

export const setTaskStatus = mutation({
  args: {
    taskId: v.id("tasks"),
    status: v.union(v.literal("open"), v.literal("in_progress"), v.literal("done"), v.literal("blocked")),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "task:manage");
    const task = await ctx.db.get("tasks", args.taskId);
    if (!task) return null;
    await assertCaseAccess(ctx, actor, task.caseId);
    await ctx.db.patch("tasks", args.taskId, { status: args.status });
    return ctx.db.get("tasks", args.taskId);
  },
});
