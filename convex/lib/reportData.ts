import { v, type Infer } from "convex/values";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { visibleCases } from "./permissions";
import { computeSla, slaComplianceRate, averageResponseDays } from "./sla";

export const reportFiltersValidator = schema.tables.reports.validator.fields.filters;
export const reportResultValidator = v.object({ groupBy: v.string(), metrics: v.array(v.string()), rows: v.array(v.record(v.string(), v.union(v.string(), v.number()))), total: v.number(), generatedAt: v.string(), error: v.optional(v.string()) });
export type ReportFilters = Infer<typeof reportFiltersValidator>;

export async function buildReport(ctx: QueryCtx, user: Doc<"users">, filters: ReportFilters, creator?: Doc<"users">) {
  const periodDays = { weekly: 7, monthly: 30, quarterly: 90, yearly: 365, custom: 0 }[filters.period];
  const dateFrom = filters.dateFrom ?? (periodDays ? new Date(Date.now() - periodDays * 86400000).toISOString().slice(0, 10) : "0000");
  const dateTo = filters.dateTo ?? "9999-12-31";
  const candidate = await ctx.db.query("cases").withIndex("by_date_submitted", (query) => query.gte("dateSubmitted", dateFrom).lt("dateSubmitted", `${dateTo}T99`)).order("desc").take(3001);
  if (candidate.length > 3000) throw new Error("Report contains more than 3,000 requests. Select a shorter date period; no partial figures were returned.");
  const ownerScoped = creator ? visibleCases(creator.roleId, creator._id, candidate, [], creator.teamId) : candidate;
  const scoped = visibleCases(user.roleId, user._id, ownerScoped, [], user.teamId);
  const rows = scoped.filter((record) => {
    if (filters.statuses.length && !filters.statuses.includes(record.status)) return false;
    if (filters.priorities.length && !filters.priorities.includes(record.priority)) return false;
    if (filters.departments.length && !filters.departments.includes(record.department)) return false;
    if (filters.assignees.length && !filters.assignees.includes(record.assignedTo ?? "unassigned")) return false;
    if (filters.tags.length && !filters.tags.some((tag) => record.tags.includes(tag))) return false;
    return true;
  });
  const groups = new Map<string, Doc<"cases">[]>();
  for (const record of rows) {
    const key = filters.groupBy === "department" ? record.department : filters.groupBy === "assignee" ? record.assignedTo ?? "unassigned" : filters.groupBy === "priority" ? record.priority : filters.groupBy === "month" ? record.dateSubmitted.slice(0, 7) : filters.groupBy === "requestor" ? record.requestor.organization || "Private individual" : record.status;
    const group = groups.get(key) ?? [];
    group.push(record);
    groups.set(key, group);
  }
  const metrics = [...new Set(["count", ...filters.metrics])];
  const result = [...groups.entries()].map(([group, cases]) => {
    const allMetrics: Record<string, number> = { count: cases.length, avg_response_days: averageResponseDays(cases), sla_compliance: slaComplianceRate(cases), overdue_count: cases.filter((record) => computeSla(record).state === "overdue").length, appeals: cases.filter((record) => record.isAppeal || record.status === "appeal").length, escalations: cases.filter((record) => record.status === "escalated").length };
    return { group, ...Object.fromEntries(metrics.map((metric) => [metric, allMetrics[metric]!])) };
  });
  return { groupBy: filters.groupBy, metrics, rows: result, total: rows.length, generatedAt: new Date().toISOString() };
}
