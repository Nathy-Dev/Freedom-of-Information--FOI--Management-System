/**
 * Shared case query/filter helpers. Every list screen funnels through one
 * implementation so dashboards, exports and badges always agree with the
 * case list (FR-041). Row-level scoping is applied by the caller using
 * `visibleCases` from `./permissions`.
 */

import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { computeSla } from "./sla";

export interface CaseFilters {
  q?: string;
  statuses?: string[];
  priorities?: string[];
  departments?: string[];
  assignees?: string[];
  tags?: string[];
  sla?: string[];
  confidentiality?: string[];
  dateFrom?: string;
  dateTo?: string;
  hasCourtDate?: boolean;
  isAppeal?: boolean;
}

/** Index-first: pull candidates by the most selective index, then filter. */
export function queryCases(
  ctx: QueryCtx | MutationCtx,
  filters: CaseFilters = {},
) {
  // Base query: by status when a single status filter is given (index-select),
  // else by date_submitted desc. Multi-status + remaining predicates are applied
  // in `applyCaseFilters` after the bounded fetch.
  const single = filters.statuses?.length === 1 ? (filters.statuses[0] as Doc<"cases">["status"]) : null;
  if (single) {
    return ctx.db.query("cases").withIndex("by_status", (q) => q.eq("status", single)).order("desc");
  }
  return ctx.db.query("cases").withIndex("by_date_submitted").order("desc");
}

export function applyCaseFilters(rows: Doc<"cases">[], filters: CaseFilters = {}): Doc<"cases">[] {
  const needle = filters.q?.trim().toLowerCase();

  return rows.filter((c) => {
    if (needle) {
      const haystack = [
        c.caseNumber,
        c.subject,
        c.description,
        c.requestor.name,
        c.requestor.organization ?? "",
        c.department,
        c.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    if (filters.statuses?.length && !filters.statuses.includes(c.status)) return false;
    if (filters.priorities?.length && !filters.priorities.includes(c.priority)) return false;
    if (filters.departments?.length && !filters.departments.includes(c.department)) return false;
    if (filters.tags?.length && !filters.tags.some((t) => c.tags.includes(t))) return false;
    if (filters.confidentiality?.length && !filters.confidentiality.includes(c.confidentiality)) {
      return false;
    }

    if (filters.assignees?.length) {
      const wantsUnassigned = filters.assignees.includes("unassigned");
      const matches = c.assignedTo
        ? filters.assignees.includes(c.assignedTo)
        : wantsUnassigned;
      if (!matches) return false;
    }

    if (filters.sla?.length) {
      const sla = computeSla(c).state;
      if (!filters.sla.includes(sla)) return false;
    }
    if (filters.dateFrom && c.dateSubmitted.slice(0, 10) < filters.dateFrom) return false;
    if (filters.dateTo && c.dateSubmitted.slice(0, 10) > filters.dateTo) return false;
    if (filters.hasCourtDate && c.courtDateCount === 0) return false;
    if (filters.isAppeal && !c.isAppeal) return false;

    return true;
  });
}

/** Materialize SLA state for a case (cached on the document). */
export function slaStateOf(c: Doc<"cases">): Doc<"cases">["slaState"] {
  return computeSla(c).state;
}
