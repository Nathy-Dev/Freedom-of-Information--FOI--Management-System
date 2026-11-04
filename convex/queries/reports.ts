/**
 * Reports read queries (FR-050 → FR-054, ToR §14).
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission, getCurrentUser } from "../lib/session";
import { visibleCases } from "../lib/permissions";
import { computeSla, slaComplianceRate, averageResponseDays } from "../lib/sla";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "report:read");
    const rows = await ctx.db.query("reports").take(200);
    return rows;
  },
});

export const get = query({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "report:read");
    return ctx.db.get("reports", args.id);
  },
});

/**
 * Run a report (ad-hoc) against the row-scoped case set. Returns rows grouped
 * by the requested groupBy with the requested metrics.
 */
export const run = query({
  args: {
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "report:build");
    const filters = args.filters as {
      period?: string;
      dateFrom?: string;
      dateTo?: string;
      statuses?: string[];
      departments?: string[];
      priorities?: string[];
      assignees?: string[];
      tags?: string[];
      groupBy?: string;
      metrics?: string[];
    };

    const candidate = await ctx.db
      .query("cases")
      .withIndex("by_date_submitted")
      .order("desc")
      .take(3000);
    const scoped = visibleCases(user.roleId, user._id, candidate as never, [], user.teamId) as never[];

    let rows = scoped.filter((c: { status: string; priority: string; department: string; tags: string[]; assignedTo?: string | null; dateSubmitted: string }) => {
      if (filters.statuses?.length && !filters.statuses.includes(c.status)) return false;
      if (filters.priorities?.length && !filters.priorities.includes(c.priority)) return false;
      if (filters.departments?.length && !filters.departments.includes(c.department)) return false;
      if (filters.assignees?.length) {
        const wantsUnassigned = filters.assignees.includes("unassigned");
        const matches = c.assignedTo ? filters.assignees.includes(c.assignedTo) : wantsUnassigned;
        if (!matches) return false;
      }
      if (filters.tags?.length && !filters.tags.some((t) => c.tags.includes(t))) return false;
      if (filters.dateFrom && c.dateSubmitted.slice(0, 10) < filters.dateFrom) return false;
      if (filters.dateTo && c.dateSubmitted.slice(0, 10) > filters.dateTo) return false;
      return true;
    });

    // Grouping.
    const groupBy = filters.groupBy ?? "status";
    const groups = new Map<string, Array<{ [key: string]: unknown }>>();
    for (const c of rows as Array<{ [key: string]: unknown }>) {
      let key = "";
      switch (groupBy) {
        case "department":
          key = String(c.department ?? "Other");
          break;
        case "assignee":
          key = String(c.assignedTo ?? "unassigned");
          break;
        case "priority":
          key = String(c.priority ?? "medium");
          break;
        case "month":
          key = String(c.dateSubmitted ?? "").slice(0, 7);
          break;
        case "requestor":
          key = String((c.requestor as { name?: string })?.name ?? "Unknown");
          break;
        default:
          key = String(c.status ?? "unknown");
      }
      const list = groups.get(key) ?? [];
      list.push(c);
      groups.set(key, list);
    }

    const metrics = filters.metrics?.length ? filters.metrics : ["count"];
    const result = Array.from(groups.entries()).map(([key, list]) => {
      const row: Record<string, unknown> = { group: key };
      const cases = list as Array<{ [key: string]: unknown }>;
      if (metrics.includes("count")) row.count = cases.length;
      if (metrics.includes("avg_response_days")) {
        row.avgResponseDays = averageResponseDays(cases as never);
      }
      if (metrics.includes("sla_compliance")) {
        row.slaCompliance = slaComplianceRate(cases as never);
      }
      if (metrics.includes("overdue_count")) {
        row.overdueCount = cases.filter((c) => computeSla(c as never).state === "overdue").length;
      }
      if (metrics.includes("appeals")) {
        row.appeals = cases.filter((c) => c.status === "appeal" || c.isAppeal).length;
      }
      if (metrics.includes("escalations")) {
        row.escalations = cases.filter((c) => c.status === "escalated").length;
      }
      return row;
    });

    return {
      groupBy,
      metrics,
      rows: result,
      total: rows.length,
      generatedAt: new Date().toISOString(),
    };
  },
});

export const views = query({
  args: {},
  handler: async (ctx) => {
    // Anonymous-safe: DataContext reads saved views on every render.
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    const all = await ctx.db.query("views").take(500);
    return all.filter((v) => v.isShared || v.ownerId === user._id);
  },
});
