/**
 * Dashboard metrics (FR-020, FR-030, ToR §14), computed from live Convex rows.
 * to the server: figures are computed from the row-scoped case set so the
 * numbers always reconcile with the case list.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { requireUser } from "../lib/session";
import { visibleCases } from "../lib/permissions";
import { OPEN_STATUSES, STATUS_ORDER } from "../lib/constants";
import { computeSla, slaComplianceRate, averageResponseDays, agingBuckets } from "../lib/sla";

export const metrics = query({
  args: {
    // Optional override: only return the given scope's numbers (unused fields
    // computed lazily are fine for the bounded dataset).
    scope: v.optional(v.union(v.literal("all"), v.literal("assigned"), v.literal("own"))),
  },
  handler: async (ctx, _args) => {
    const user = await requireUser(ctx);
    const now = new Date();

    const candidate = await ctx.db
      .query("cases")
      .withIndex("by_date_submitted")
      .order("desc")
      .take(2000);
    const scoped = visibleCases(
      user.roleId,
      user._id,
      candidate as never,
      [],
      user.teamId,
    ) as unknown as Doc<"cases">[];

    const open = scoped.filter((c) => (OPEN_STATUSES as readonly string[]).includes(c.status));
    const thisMonth = now.toISOString().slice(0, 7);
    const slaStates = open.map((c) => computeSla(c, 2, now).state);

    // Staff workload: all staff users with open/overdue/closed counts.
    const staff = await ctx.db.query("users").withIndex("by_role").take(1000);
    const visibleIds = new Set(scoped.map((c) => c._id));
    const [recentCases, upcomingHearings, tasks, activity] = await Promise.all([
      [...scoped].sort((a, b) => b.dateSubmitted.localeCompare(a.dateSubmitted)).slice(0, 8),
      ctx.db.query("courtDates").withIndex("by_date").take(500),
      ctx.db.query("tasks").withIndex("by_due_date").take(500),
      ctx.db.query("timeline").withIndex("by_at").order("desc").take(100),
    ]);

    return {
      totalCases: scoped.length,
      openCases: open.length,
      overdueCases: slaStates.filter((s) => s === "overdue").length,
      dueSoonCases: slaStates.filter((s) => s === "due_soon").length,
      closedThisMonth: scoped.filter((c) => c.dateClosed?.startsWith(thisMonth)).length,
      avgResponseDays: averageResponseDays(scoped as never),
      slaComplianceRate: slaComplianceRate(scoped as never, now),
      appealsCount: scoped.filter((c) => c.status === "appeal" || c.isAppeal).length,
      escalationsCount: scoped.filter((c) => c.status === "escalated").length,
      statusCounts: STATUS_ORDER.map((status) => ({
        status,
        count: scoped.filter((c) => c.status === status).length,
      })),
      trend: monthlyTrend(scoped, now),
      aging: agingBuckets(scoped as never, now),
      byDepartment: byDepartment(scoped, now),
      topRequestors: topRequestors(scoped),
      workload: workload(scoped, staff as never, now),
      recentCases,
      upcomingHearings: upcomingHearings.filter((hearing) => visibleIds.has(hearing.caseId)).slice(0, 10),
      tasks: tasks.filter((task) => visibleIds.has(task.caseId)).slice(0, 20),
      activity: activity.filter((event) => visibleIds.has(event.caseId)).slice(0, 20),
    };
  },
});

function monthlyTrend(
  cases: Array<{ dateSubmitted: string; respondedAt?: string | null; dateClosed?: string | null }>,
  now: Date,
  months = 12,
) {
  const keys: string[] = [];
  const cursor = new Date(now);
  cursor.setDate(1);
  for (let i = months - 1; i >= 0; i -= 1) {
    const d = new Date(cursor);
    d.setMonth(d.getMonth() - i);
    keys.push(d.toISOString().slice(0, 7));
  }
  const empty = () => ({ received: 0, responded: 0, closed: 0 });
  const buckets = new Map(keys.map((k) => [k, empty()]));
  cases.forEach((c) => {
    const received = buckets.get(c.dateSubmitted.slice(0, 7));
    if (received) received.received += 1;
    if (c.respondedAt) {
      const responded = buckets.get(c.respondedAt.slice(0, 7));
      if (responded) responded.responded += 1;
    }
    if (c.dateClosed) {
      const closed = buckets.get(c.dateClosed.slice(0, 7));
      if (closed) closed.closed += 1;
    }
  });
  return keys.map((key) => ({ period: monthLabel(key), ...buckets.get(key)! }));
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleString("en-NG", { month: "short", year: "numeric" });
}

function byDepartment(
  cases: Doc<"cases">[],
  now: Date,
) {
  const names = Array.from(new Set(cases.map((c) => c.department)));
  return names
    .map((department) => {
      const rows = cases.filter((c) => c.department === department);
      return {
        department,
        count: rows.length,
        avgDays: averageResponseDays(rows as never),
        slaRate: slaComplianceRate(rows as never, now),
      };
    })
    .sort((a, b) => b.count - a.count);
}

function topRequestors(
  cases: Doc<"cases">[],
  limit = 8,
) {
  const map = new Map<string, { name: string; organization: string; count: number; appeals: number }>();
  cases.forEach((c) => {
    const row = map.get(c.requestorId) ?? {
      name: c.requestor.name,
      organization: c.requestor.organization ?? "Individual requestor",
      count: 0,
      appeals: 0,
    };
    row.count += 1;
    if (c.isAppeal || c.status === "appeal") row.appeals += 1;
    map.set(c.requestorId, row);
  });
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function workload(
  cases: Doc<"cases">[],
  staff: Array<{ _id: string }>,
  now: Date,
) {
  const thisMonth = now.toISOString().slice(0, 7);
  return staff
    .map((user) => {
      const owned = cases.filter((c) => c.assignedTo === user._id);
      return {
        userId: user._id,
        open: owned.filter((c) => (OPEN_STATUSES as readonly string[]).includes(c.status)).length,
        overdue: owned.filter((c) => computeSla(c, 2, now).state === "overdue").length,
        closedThisMonth: owned.filter((c) => c.dateClosed?.startsWith(thisMonth)).length,
      };
    })
    .filter((row) => row.open + row.closedThisMonth > 0)
    .sort((a, b) => b.open - a.open || b.overdue - a.overdue);
}
