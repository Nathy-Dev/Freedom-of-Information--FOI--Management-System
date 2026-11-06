/**
 * Internal worker functions for the cron jobs. Split from `convex/scheduled.ts`
 * so the cron actions can reference them without same-module circularity.
 */
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { computeSla } from "../lib/sla";
import { pushNotification } from "../lib/notifications";
import { SYSTEM_ACTOR_ID } from "../lib/audit";
import { internal } from "../_generated/api";
import { components } from "../_generated/api";

/* ------------------------------------------------------------------ *
 * SLA monitor
 * ------------------------------------------------------------------ */

export const slaScan = internalQuery({
  args: { now: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("cases")
      .withIndex("by_status")
      .filter((q) =>
        q.or(
          q.eq("status", "filed"),
          q.eq("status", "in_review"),
          q.eq("status", "pending_info"),
          q.eq("status", "escalated"),
          q.eq("status", "appeal"),
        ),
      )
      .take(2000);
    return rows
      .map((c) => ({ id: c._id, caseNumber: c.caseNumber, sla: computeSla(c, 2, new Date(args.now)) }))
      .filter((r) => r.sla.state === "due_soon" || r.sla.state === "overdue");
  },
});

export const applySlaEvents = internalMutation({
  args: {
    events: v.array(
      v.object({
        caseId: v.id("cases"),
        caseNumber: v.string(),
        state: v.union(v.literal("due_soon"), v.literal("overdue")),
        label: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    for (const e of args.events) {
      const c = await ctx.db.get("cases", e.caseId);
      if (!c) continue;
      if (c.slaState === e.state) continue;

      await ctx.db.patch("cases", e.caseId, { slaState: e.state, updatedAt: new Date().toISOString() });
      await ctx.db.insert("timeline", {
        caseId: e.caseId,
        kind: e.state === "overdue" ? "sla_breach" : "sla_warning",
        actorId: undefined,
        at: new Date().toISOString(),
        summary: e.state === "overdue" ? "Statutory response date passed" : "Statutory response date approaching",
        detail: e.label,
      });

      const requestor = c.requestorId ? await ctx.db.get("requestors", c.requestorId) : null;
      const requestorUserId = requestor?.userId as never as string | undefined;
      const targets = new Set<string>();
      if (c.assignedTo) targets.add(c.assignedTo as never as string);
      if (requestorUserId) targets.add(requestorUserId);
      for (const userId of targets) {
        await pushNotification(ctx, {
          userId: userId as never,
          kind: e.state === "overdue" ? "overdue" : "due_soon",
          title: `${e.state === "overdue" ? "Overdue" : "Due soon"}: ${e.caseNumber}`,
          body: e.label,
          link: `/cases/${e.caseId}`,
        });
      }
    }
    return null;
  },
});

/* ------------------------------------------------------------------ *
 * Court reminders
 * ------------------------------------------------------------------ */

export const dueHearings = internalQuery({
  args: { today: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("courtDates")
      .withIndex("by_date")
      .filter((q) => q.and(q.gte("date", args.today), q.eq("status", "scheduled")))
      .take(500);
    return rows.map((cd) => ({
      id: cd._id,
      caseId: cd.caseId,
      suitNumber: cd.suitNumber,
      date: cd.date,
      courtName: cd.courtName,
      counselIds: cd.counselIds,
      reminderLeadDays: cd.reminderLeadDays,
    }));
  },
});

export const sendCourtReminders = internalMutation({
  args: {
    hearings: v.array(
      v.object({
        hearingId: v.id("courtDates"),
        caseId: v.id("cases"),
        suitNumber: v.string(),
        date: v.string(),
        courtName: v.string(),
        counselIds: v.array(v.id("users")),
      }),
    ),
    today: v.string(),
  },
  handler: async (ctx, args) => {
    for (const h of args.hearings) {
      const daysUntil = Math.round(
        (new Date(`${h.date}T00:00:00Z`).getTime() - new Date(`${args.today}T00:00:00Z`).getTime()) / 86_400_000,
      );
      if (daysUntil < 0) continue;
      const hearing = await ctx.db.get("courtDates", h.hearingId);
      const lead = Math.max(...(hearing?.reminderLeadDays?.length ? hearing.reminderLeadDays : [2]));
      if (daysUntil > lead) continue;

      for (const counselId of h.counselIds) {
        await pushNotification(ctx, {
          userId: counselId,
          kind: "court_reminder",
          title: `Hearing reminder: ${h.suitNumber}`,
          body: `${h.courtName} on ${h.date}`,
          link: `/court?date=${h.date}`,
        });
      }
    }
    return null;
  },
});

/* ------------------------------------------------------------------ *
 * Scheduled reports
 * ------------------------------------------------------------------ */

export const dueReports = internalQuery({
  args: { now: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("reports").withIndex("by_next_run", (query) => query.gt("nextRun", "").lte("nextRun", args.now)).take(100);
    return rows
      .filter((r) => r.cadence !== "none" && r.nextRun && r.nextRun <= args.now)
      .map((r) => ({ id: r._id, name: r.name, recipients: r.recipients }));
  },
});

/* ------------------------------------------------------------------ *
 * Retention
 * ------------------------------------------------------------------ */

export const applyRetention = internalMutation({
  args: { now: v.string() },
  returns: v.object({ deleted: v.number(), reviewRequired: v.number() }),
  handler: async (ctx, args) => {
    const state = await ctx.db.query("maintenanceCursors").withIndex("by_job", (query) => query.eq("job", "retention")).unique();
    const result = await ctx.db
      .query("documents")
      .withIndex("by_retention", (query) => query.lte("retainUntil", args.now))
      .paginate({ cursor: state?.cursor ?? null, numItems: 100, maximumBytesRead: 500000 });
    const cursor = result.isDone ? null : result.continueCursor;
    if (state) await ctx.db.patch(state._id, { cursor });
    else await ctx.db.insert("maintenanceCursors", { job: "retention", cursor });
    let reviewRequired = 0;
    for (const d of result.page) {
      const caseRecord = await ctx.db.get(d.caseId);
      if (!caseRecord || !caseRecord.dateClosed || d.legalHold || d.retentionReviewAt) continue;
      await ctx.db.patch(d._id, { retentionReviewAt: args.now });
      reviewRequired += 1;
    }
    if (reviewRequired) await ctx.db.insert("auditLogs", {
      entityType: "Retention",
      entityId: "cron",
      entityLabel: "Retention policy",
      action: "update",
      performedBy: SYSTEM_ACTOR_ID,
      timestamp: args.now,
      details: `${reviewRequired} documents marked for retention review. No files or records were deleted. Legal approval is required before disposal.`,
      ipAddress: "",
      userAgent: "",
      severity: "info",
    });
    if (!result.isDone) await ctx.scheduler.runAfter(1000, internal.internal.cronWorkers.applyRetention, { now: args.now });
    return { deleted: 0, reviewRequired };
  },
});

/* ------------------------------------------------------------------ *
 * File pipeline retry
 * ------------------------------------------------------------------ */

export const pendingDocuments = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("documents")
      .withIndex("by_virus_scan", (query) => query.eq("virusScan", "pending"))
      .take(200);
    return rows.map((d) => ({ id: d._id }));
  },
});

export const cleanupSessions = internalMutation({
  args: {},
  returns: v.object({ removed: v.number() }),
  handler: async (ctx) => {
    const settings = await ctx.db.query("systemSettings").first();
    const timeout = settings?.sessionTimeoutMinutes ?? 30;
    if (timeout <= 0) return { removed: 0 };
    const cutoff = Date.now() - Math.max(1, timeout) * 60000;
    const sessions = await ctx.db.query("userSessions").withIndex("by_last_seen", (query) => query.lt("lastSeenAt", cutoff)).take(100);
    for (const session of sessions) {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, { input: { model: "session", where: [{ field: "_id", value: session.authSessionId }] } });
      await ctx.db.delete(session._id);
    }
    if (sessions.length === 100) await ctx.scheduler.runAfter(1000, internal.internal.cronWorkers.cleanupSessions, {});
    return { removed: sessions.length };
  },
});
