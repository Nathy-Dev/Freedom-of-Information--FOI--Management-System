/**
 * Internal REST handlers — these run as internalQuery/internalMutation so the
 * HTTP action layer can delegate DB work through `ctx.runQuery`/`ctx.runMutation`
 * (HTTP actions have no `ctx.db`).
 */
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { SYSTEM_ACTOR_ID, writeAudit } from "../lib/audit";

/** Resolve an API client by clientId (used by the REST auth layer). */
export const lookupClient = internalQuery({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    const client = await ctx.db
      .query("apiClients")
      .withIndex("by_client_id", (q) => q.eq("clientId", args.clientId))
      .first();
    if (!client) return null;
    return {
      id: client._id,
      name: client.name,
      clientId: client.clientId,
      secretHash: client.secretHash,
      scopes: client.scopes,
      isActive: client.isActive,
    };
  },
});

/** List cases for the API client (scoped, bounded). */
export const apiListCases = internalQuery({
  args: {
    status: v.optional(v.string()),
    limit: v.number(),
  },
  handler: async (ctx, args) => {
    let rows;
    if (args.status) {
      rows = await ctx.db
        .query("cases")
        .withIndex("by_status", (q) => q.eq("status", args.status as never))
        .order("desc")
        .take(args.limit);
    } else {
      rows = await ctx.db
        .query("cases")
        .withIndex("by_date_submitted")
        .order("desc")
        .take(args.limit);
    }
    return rows.map((c) => ({
      id: c._id,
      caseNumber: c.caseNumber,
      subject: c.subject,
      status: c.status,
      priority: c.priority,
      department: c.department,
      dateSubmitted: c.dateSubmitted,
      statutoryDueDate: c.statutoryDueDate,
    }));
  },
});

export const apiGetCase = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, args) => {
    const c = await ctx.db.get("cases", args.id as never);
    if (!c) return null;
    return {
      id: c._id,
      caseNumber: c.caseNumber,
      subject: c.subject,
      description: c.description,
      status: c.status,
      priority: c.priority,
      department: c.department,
      dateSubmitted: c.dateSubmitted,
      statutoryDueDate: c.statutoryDueDate,
      dateClosed: c.dateClosed ?? null,
      outcomeCode: c.outcomeCode ?? null,
    };
  },
});

export const apiListReports = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("reports").take(args.limit);
    return rows.map((r) => ({ id: r._id, name: r.name, cadence: r.cadence }));
  },
});

export const apiCreateCase = internalMutation({
  args: {
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    const payload = args.payload as {
      subject: string;
      description: string;
      priority?: string;
      confidentiality?: string;
      responseFormat?: string;
      source?: string;
      tags?: string[];
      department?: string;
      requestorName?: string;
      requestorEmail?: string;
      requestorPhone?: string;
      requestorOrganization?: string;
    };

    const now = new Date();
    const iso = now.toISOString();

    // Case number from counters.
    const year = now.getFullYear();
    const counterKey = `case:${year}`;
    const counter = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", counterKey))
      .first();
    const next = (counter?.value ?? 0) + 1;
    if (counter) {
      await ctx.db.patch("counters", counter._id, { value: next });
    } else {
      await ctx.db.insert("counters", { key: counterKey, value: next });
    }
    const caseNumber = `HYPREP/FOI/${year}/${String(next).padStart(4, "0")}`;

    // Requestor upsert by email.
    const email = (payload.requestorEmail ?? "unknown@hyprep.gov.ng").toLowerCase();
    let requestor = await ctx.db
      .query("requestors")
      .withIndex("by_email", (q) => q.eq("email", email))
      .first();
    if (!requestor) {
      const rid = await ctx.db.insert("requestors", {
        name: payload.requestorName ?? email,
        email,
        phone: payload.requestorPhone || undefined,
        organization: payload.requestorOrganization || undefined,
        isJournalist: false,
      });
      requestor = await ctx.db.get("requestors", rid);
    }
    if (!requestor) throw new Error("Could not resolve requestor.");

    const caseId = await ctx.db.insert("cases", {
      caseNumber,
      requestorId: requestor._id,
      requestor: {
        name: requestor.name,
        email: requestor.email,
        phone: requestor.phone,
        organization: requestor.organization,
        isJournalist: requestor.isJournalist,
      },
      subject: payload.subject,
      description: payload.description,
      assignedTo: undefined,
      assignedTeamId: undefined,
      status: "filed",
      priority: (payload.priority as never) ?? "medium",
      confidentiality: (payload.confidentiality as never) ?? "internal",
      responseFormat: (payload.responseFormat as never) ?? "electronic",
      source: (payload.source as never) ?? "api",
      tags: payload.tags ?? [],
      department: payload.department ?? "Legal Unit",
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
      summary: "Case created via API",
      detail: "Imported through the public REST API.",
    });

    await writeAudit(ctx, {
      entityType: "Case",
      entityId: caseId,
      entityLabel: caseNumber,
      action: "create",
      performedBy: SYSTEM_ACTOR_ID,
      details: "Case created through the public REST API.",
    });

    return { id: caseId, caseNumber };
  },
});

export const apiTouchClient = internalMutation({
  args: { clientId: v.id("apiClients") },
  handler: async (ctx, args) => {
    await ctx.db.patch("apiClients", args.clientId, {
      lastUsedAt: new Date().toISOString(),
    });
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
