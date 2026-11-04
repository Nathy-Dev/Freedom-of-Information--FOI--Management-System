/**
 * Internal worker functions for the cron jobs. Split from `convex/scheduled.ts`
 * so the cron actions can reference them without same-module circularity.
 */
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { computeSla } from "../lib/sla";
import { pushNotification } from "../lib/notifications";
import { SYSTEM_ACTOR_ID } from "../lib/audit";

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
    const rows = await ctx.db.query("reports").take(200);
    return rows
      .filter((r) => r.cadence !== "none" && r.nextRun && r.nextRun <= args.now)
      .map((r) => ({ id: r._id, name: r.name, recipients: r.recipients }));
  },
});

export const markReportRun = internalMutation({
  args: { reportId: v.id("reports"), now: v.string() },
  handler: async (ctx, args) => {
    const report = await ctx.db.get("reports", args.reportId);
    if (!report) return null;
    const nextRun = advanceCadence(report.cadence, args.now);
    await ctx.db.patch("reports", args.reportId, { lastRun: args.now, nextRun });
    return null;
  },
});

function advanceCadence(cadence: string, fromIso: string): string {
  const d = new Date(fromIso);
  if (cadence === "weekly") d.setDate(d.getDate() + 7);
  else if (cadence === "monthly") d.setMonth(d.getMonth() + 1);
  else if (cadence === "quarterly") d.setMonth(d.getMonth() + 3);
  else if (cadence === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

/* ------------------------------------------------------------------ *
 * Retention
 * ------------------------------------------------------------------ */

export const applyRetention = internalMutation({
  args: { now: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("documents")
      .withIndex("by_retention")
      .filter((q) => q.lte("retainUntil", args.now))
      .take(500);
    for (const d of rows) {
      await ctx.db.delete("documents", d._id);
    }
    await ctx.db.insert("auditLogs", {
      entityType: "Retention",
      entityId: "cron",
      entityLabel: "Retention policy",
      action: "delete",
      performedBy: SYSTEM_ACTOR_ID,
      timestamp: args.now,
      details: `Archived ${rows.length} documents past retention date.`,
      ipAddress: "",
      userAgent: "",
      severity: "info",
    });
    return { deleted: rows.length };
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
      .withIndex("by_kind")
      .filter((q) => q.eq("virusScan", "pending"))
      .take(200);
    return rows.map((d) => ({ id: d._id }));
  },
});
