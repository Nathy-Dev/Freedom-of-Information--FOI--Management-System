/**
 * Internal mutations invoked by the inbound webhook receiver. Each ingests an
 * external event (court scheduling, external case creation) into the domain,
 * with validation and audit logging.
 */
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { SYSTEM_ACTOR_ID, writeAudit } from "../lib/audit";

export const ingestCourtEvent = internalMutation({
  args: {
    hookId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const p = args.payload as Record<string, unknown>;
    const caseId = typeof p.caseId === "string" ? p.caseId : undefined;
    const suitNumber = typeof p.suitNumber === "string" ? p.suitNumber : undefined;
    const date = typeof p.date === "string" ? p.date : undefined;
    if (!caseId || !suitNumber || !date) {
      throw new Error("Court event requires caseId, suitNumber and date.");
    }

    const foiCase = await ctx.db.get("cases", caseId as never);
    if (!foiCase) throw new Error(`Unknown case: ${caseId}`);

    const now = new Date().toISOString();
    await ctx.db.insert("courtDates", {
      caseId: foiCase._id,
      suitNumber,
      date,
      time: typeof p.time === "string" ? p.time : "09:00",
      durationMinutes: typeof p.durationMinutes === "number" ? p.durationMinutes : 60,
      courtId: undefined,
      courtName: typeof p.courtName === "string" ? p.courtName : "Federal High Court",
      location: typeof p.location === "string" ? p.location : "",
      judge: typeof p.judge === "string" ? p.judge : "",
      hearingType: (p.hearingType as never) ?? "hearing",
      status: "scheduled",
      counselIds: [],
      notes: typeof p.notes === "string" ? p.notes : "",
      outcome: undefined,
      nextActionDue: undefined,
      reminderLeadDays: [2],
      createdBy: undefined as never,
      createdAt: now,
    });

    await ctx.db.patch("cases", foiCase._id, {
      courtDateCount: foiCase.courtDateCount + 1,
      updatedAt: now,
    });

    await ctx.db.insert("timeline", {
      caseId: foiCase._id,
      kind: "court_scheduled",
      actorId: undefined,
      at: now,
      summary: `Hearing listed (${suitNumber}) via webhook`,
      detail: `${date} at ${typeof p.time === "string" ? p.time : "09:00"} · ${typeof p.courtName === "string" ? p.courtName : ""}`,
    });

    await writeAudit(ctx, {
      entityType: "CourtDate",
      entityId: suitNumber,
      entityLabel: suitNumber,
      action: "create",
      performedBy: SYSTEM_ACTOR_ID,
      details: `Court date ingested from webhook ${args.hookId}.`,
    });

    return null;
  },
});

export const ingestExternalCase = internalMutation({
  args: {
    hookId: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const p = args.payload as Record<string, unknown>;
    if (typeof p.subject !== "string" || typeof p.description !== "string") {
      throw new Error("External case requires subject and description.");
    }
    const email = (typeof p.requestorEmail === "string" ? p.requestorEmail : "external@hyprep.gov.ng").toLowerCase();

    const now = new Date();
    const iso = now.toISOString();
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

    const caseId = await ctx.db.insert("cases", {
      caseNumber,
      requestorId: undefined as never,
      requestor: {
        name: typeof p.requestorName === "string" ? p.requestorName : email,
        email,
        phone: typeof p.requestorPhone === "string" ? p.requestorPhone : undefined,
        organization: typeof p.requestorOrganization === "string" ? p.requestorOrganization : undefined,
        isJournalist: false,
      },
      subject: p.subject,
      description: p.description,
      assignedTo: undefined,
      assignedTeamId: undefined,
      status: "filed",
      priority: (p.priority as never) ?? "medium",
      confidentiality: (p.confidentiality as never) ?? "internal",
      responseFormat: "electronic",
      source: "api",
      tags: [],
      department: typeof p.department === "string" ? p.department : "Legal Unit",
      dateSubmitted: iso,
      statutoryDueDate: addWorkingDays(now, 7),
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

    await ctx.db.insert("timeline", {
      caseId,
      kind: "created",
      actorId: undefined,
      at: iso,
      summary: "Case created via webhook",
      detail: `Ingested from hook ${args.hookId}.`,
    });

    await writeAudit(ctx, {
      entityType: "Case",
      entityId: caseId,
      entityLabel: caseNumber,
      action: "create",
      performedBy: SYSTEM_ACTOR_ID,
      details: `Case created through webhook ${args.hookId}.`,
    });

    return null;
  },
});

function addWorkingDays(start: Date, days: number): string {
  const d = new Date(start);
  let added = 0;
  while (added < days) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return d.toISOString().slice(0, 10);
}
