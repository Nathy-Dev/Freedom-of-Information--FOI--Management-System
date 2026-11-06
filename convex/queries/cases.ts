/**
 * Case read queries (FR-020, FR-021). Row-level scoping is applied server-side
 * via `visibleCases` from the RBAC layer; direct fetches throw FORBIDDEN when
 * the caller may not see the case (so access intent is not silently hidden).
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission, requireUser, forbiddenError } from "../lib/session";
import { visibleCases } from "../lib/permissions";
import { applyCaseFilters, type CaseFilters } from "../lib/cases";
import { computeSla } from "../lib/sla";
import { canReadDocument, documentForReader } from "../lib/documentAccess";

const caseFiltersValidator = v.object({
  q: v.optional(v.string()),
  statuses: v.optional(v.array(v.string())),
  priorities: v.optional(v.array(v.string())),
  departments: v.optional(v.array(v.string())),
  assignees: v.optional(v.array(v.string())),
  tags: v.optional(v.array(v.string())),
  sla: v.optional(v.array(v.string())),
  confidentiality: v.optional(v.array(v.string())),
  dateFrom: v.optional(v.string()),
  dateTo: v.optional(v.string()),
  hasCourtDate: v.optional(v.boolean()),
  isAppeal: v.optional(v.boolean()),
});

/** FR-020: paged case list with filters and sorting. */
export const list = query({
  args: {
    filters: v.optional(caseFiltersValidator),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
    sortBy: v.optional(v.string()),
    sortDir: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, ["case:read:all", "case:read:assigned", "case:read:own"]);
    const filters = (args.filters ?? {}) as CaseFilters;
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(Math.max(1, args.pageSize ?? 20), 200);
    const sortDir = args.sortDir ?? "desc";

    // Fetch a bounded candidate window (latest by dateSubmitted), then apply
    // row-scoping + filters. A page window of ~1000 keeps list reads fast while
    // remaining bounded for production growth.
    const candidate = await ctx.db
      .query("cases")
      .withIndex("by_date_submitted")
      .order("desc")
      .take(1000);

    const scoped = visibleCases(user.roleId, user._id, candidate, [], user.teamId);
    const filtered = applyCaseFilters(scoped as never, filters) as never[];
    const sorted = sortRows(filtered, args.sortBy ?? "dateSubmitted", sortDir);

    const total = sorted.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const rows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

    return { rows, total, page: safePage, pageSize, pageCount };
  },
});

/** FR-021: a single case with SLA snapshot. */
export const get = query({
  args: { id: v.id("cases") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const c = await ctx.db.get("cases", args.id);
    if (!c) return null;

    const scoped = visibleCases(user.roleId, user._id, [c], [], user.teamId);
    if (scoped.length === 0) throw forbiddenError("This case is not visible to you.");

    const sla = computeSla(c);
    return { ...c, sla };
  },
});

/** FR-021: full case bundle (case + documents + notes + tasks + court + timeline + linked). */
export const getBundle = query({
  args: { id: v.id("cases") },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const c = await ctx.db.get("cases", args.id);
    if (!c) return null;

    const scoped = visibleCases(user.roleId, user._id, [c], [], user.teamId);
    if (scoped.length === 0) throw forbiddenError("This case is not visible to you.");

    const [documents, notes, tasks, courtDates, timeline] = await Promise.all([
      ctx.db.query("documents").withIndex("by_case", (q) => q.eq("caseId", args.id)).take(500),
      ctx.db.query("notes").withIndex("by_case", (q) => q.eq("caseId", args.id)).take(500),
      ctx.db.query("tasks").withIndex("by_case", (q) => q.eq("caseId", args.id)).take(500),
      ctx.db.query("courtDates").withIndex("by_case", (q) => q.eq("caseId", args.id)).take(500),
      ctx.db.query("timeline").withIndex("by_case", (q) => q.eq("caseId", args.id)).take(500),
    ]);

    const canReadInternal = user.roleId !== "requestor" && user.roleId !== "external";
    const visibleNotes = canReadInternal ? notes : notes.filter((n) => n.type === "public");

    const linked = (
      await Promise.all(c.linkedCaseIds.map((linkedId) => ctx.db.get("cases", linkedId)))
    ).filter((x): x is NonNullable<typeof x> => Boolean(x));

    const sla = computeSla(c);
    return {
      foiCase: { ...c, sla },
      documents: await Promise.all(documents.filter((doc) => canReadDocument(user, doc)).map((doc) => documentForReader(ctx, user, doc))),
      notes: visibleNotes,
      tasks: canReadInternal ? tasks : [],
      courtDates,
      timeline: canReadInternal ? timeline : timeline.filter((entry) => ["case_created", "document_published", "status_changed"].includes(entry.kind)).map((entry) => ({ ...entry, detail: undefined })),
      linked: visibleCases(user.roleId, user._id, linked, [], user.teamId),
    };
  },
});

/** Count badges for dashboards/tabs (scoped). */
export const counts = query({
  args: {
    filters: v.optional(caseFiltersValidator),
  },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const filters = (args.filters ?? {}) as CaseFilters;

    const candidate = await ctx.db
      .query("cases")
      .withIndex("by_date_submitted")
      .order("desc")
      .take(2000);
    const scoped = visibleCases(user.roleId, user._id, candidate, [], user.teamId);
    const filtered = applyCaseFilters(scoped as never, filters) as never[];

    const counts: Record<string, number> = { total: filtered.length };
    for (const c of filtered as Array<{ status: string }>) {
      counts[c.status] = (counts[c.status] ?? 0) + 1;
    }
    return counts;
  },
});

function sortRows(
  rows: Array<{ [key: string]: unknown; priority?: string; statutoryDueDate?: string; caseNumber?: string; subject?: string; status?: string; updatedAt?: string; dateSubmitted?: string }>,
  sortBy: string,
  sortDir: "asc" | "desc",
) {
  const dir = sortDir === "asc" ? 1 : -1;
  const PRIORITY_RANK: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
  return [...rows].sort((a, b) => {
    switch (sortBy) {
      case "priority":
        return ((PRIORITY_RANK[a.priority ?? ""] ?? 0) - (PRIORITY_RANK[b.priority ?? ""] ?? 0)) * dir;
      case "dueDate":
        return String(a.statutoryDueDate ?? "").localeCompare(String(b.statutoryDueDate ?? "")) * dir;
      case "caseNumber":
        return String(a.caseNumber ?? "").localeCompare(String(b.caseNumber ?? "")) * dir;
      case "subject":
        return String(a.subject ?? "").localeCompare(String(b.subject ?? "")) * dir;
      case "status":
        return String(a.status ?? "").localeCompare(String(b.status ?? "")) * dir;
      case "updatedAt":
        return String(a.updatedAt ?? "").localeCompare(String(b.updatedAt ?? "")) * dir;
      default:
        return String(a.dateSubmitted ?? "").localeCompare(String(b.dateSubmitted ?? "")) * dir;
    }
  });
}
