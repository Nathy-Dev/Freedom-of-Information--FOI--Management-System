/**
 * Cron action functions (ToR §14/§23/§31). Worker functions live in
 * `convex/internal/cronWorkers.ts`; the schedule registration lives in
 * `convex/crons.ts` (split so no module self-references).
 *
 * - slaMonitor      → hourly: recompute SLA state, emit due-soon/overdue
 * - courtReminders  → daily: reminders for upcoming hearings
 * - reportDelivery  → daily: run due saved reports
 * - retention       → daily: archive/delete documents past retainUntil
 * - sessionCleanup  → daily: revoke expired Better Auth sessions
 * - retryPipeline   → every 30 min: retry pending-scan documents
 */

import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const slaMonitor = internalAction({
  args: { now: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ scanned: number }> => {
    const now = args.now ?? new Date().toISOString();
    const events = (await ctx.runQuery(internal.internal.cronWorkers.slaScan, { now })) as Array<{
      id: string;
      caseNumber: string;
      sla: { state: string; label: string };
    }>;
    const mapped = events.map((e) => ({
      caseId: e.id as never,
      caseNumber: e.caseNumber,
      state: e.sla.state as "due_soon" | "overdue",
      label: e.sla.label,
    }));
    if (mapped.length > 0) {
      await ctx.runMutation(internal.internal.cronWorkers.applySlaEvents, { events: mapped });
    }
    return { scanned: events.length };
  },
});

export const courtReminders = internalAction({
  args: { today: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ hearings: number }> => {
    const today = args.today ?? new Date().toISOString().slice(0, 10);
    const hearings = (await ctx.runQuery(internal.internal.cronWorkers.dueHearings, { today })) as Array<{
      id: string;
      caseId: string;
      suitNumber: string;
      date: string;
      courtName: string;
      counselIds: string[];
    }>;
    const mapped = hearings.map((h) => ({
      hearingId: h.id as never,
      caseId: h.caseId as never,
      suitNumber: h.suitNumber,
      date: h.date,
      courtName: h.courtName,
      counselIds: h.counselIds as never,
    }));
    if (mapped.length > 0) {
      await ctx.runMutation(internal.internal.cronWorkers.sendCourtReminders, { hearings: mapped, today });
    }
    return { hearings: hearings.length };
  },
});

export const reportDelivery = internalAction({
  args: {},
  handler: async (ctx): Promise<{ due: number }> => {
    const now = new Date().toISOString();
    const due = (await ctx.runQuery(internal.internal.cronWorkers.dueReports, { now })) as Array<{
      id: string;
      name: string;
      recipients: string[];
    }>;
    for (const r of due) {
      await ctx.scheduler.runAfter(0, internal.actions.reports.deliver, { reportId: r.id as never });
    }
    return { due: due.length };
  },
});

export const retention = internalAction({
  args: { now: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ deleted: number }> => {
    const now = args.now ?? new Date().toISOString();
    return ctx.runMutation(internal.internal.cronWorkers.applyRetention, { now });
  },
});

export const sessionCleanup = internalAction({
  args: {},
  returns: v.object({ removed: v.number() }),
  handler: async (ctx): Promise<{ removed: number }> => ctx.runMutation(internal.internal.cronWorkers.cleanupSessions, {}),
});

export const retryPipeline = internalAction({
  args: {},
  handler: async (ctx): Promise<{ retried: number }> => {
    const docs = (await ctx.runQuery(internal.internal.cronWorkers.pendingDocuments, {})) as Array<{
      id: string;
    }>;
    for (const d of docs.slice(0, 50)) {
      await ctx.runAction(internal.actions.filePipeline.process, { documentId: d.id as never });
    }
    return { retried: Math.min(docs.length, 50) };
  },
});

