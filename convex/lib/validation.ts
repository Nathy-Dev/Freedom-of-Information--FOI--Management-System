/**
 * Shared zod schemas for mutation/action input validation (ToR §20).
 * Used at every function boundary to reject malformed payloads before any
 * database work begins.
 */
import { z } from "zod";

export const emailSchema = z.string().email().max(254).trim().toLowerCase();

export const caseStatusSchema = z.enum([
  "filed",
  "in_review",
  "pending_info",
  "responded",
  "escalated",
  "appeal",
  "closed",
  "rejected",
]);

export const casePrioritySchema = z.enum(["low", "medium", "high", "critical"]);

export const confidentialitySchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);

export const responseFormatSchema = z.enum([
  "electronic",
  "hard_copy",
  "inspection",
  "certified_copy",
]);

export const caseSourceSchema = z.enum([
  "portal",
  "email",
  "walk_in",
  "post",
  "csv_import",
  "api",
]);

export const requestorSnapshotSchema = z.object({
  name: z.string().min(1).max(200),
  email: emailSchema,
  phone: z.string().max(40).optional(),
  organization: z.string().max(200).optional(),
  isJournalist: z.boolean().default(false),
});

export const newCaseSchema = z.object({
  subject: z.string().min(3).max(300),
  description: z.string().min(3).max(20_000),
  department: z.string().min(1).max(120),
  priority: casePrioritySchema,
  confidentiality: confidentialitySchema,
  responseFormat: responseFormatSchema,
  source: caseSourceSchema,
  tags: z.array(z.string().min(1).max(60)).max(30),
  requestor: requestorSnapshotSchema,
  assignedTo: z.string().optional(),
});

export const documentKindSchema = z.enum([
  "request",
  "response",
  "evidence",
  "court_filing",
  "correspondence",
  "internal_memo",
]);

export const hearingTypeSchema = z.enum([
  "mention",
  "motion",
  "hearing",
  "judgment",
  "adoption_of_address",
  "pre_trial",
]);

export const courtDateStatusSchema = z.enum([
  "scheduled",
  "held",
  "adjourned",
  "cancelled",
]);

export const taskStatusSchema = z.enum(["open", "in_progress", "done", "blocked"]);

export const noteTypeSchema = z.enum(["internal", "public"]);

export const userStatusSchema = z.enum(["active", "invited", "suspended", "locked"]);

export const roleIdSchema = z.enum([
  "super_admin",
  "admin",
  "legal",
  "clerk",
  "requestor",
  "auditor",
  "external",
]);

export const reportPeriodSchema = z.enum(["weekly", "monthly", "quarterly", "yearly", "custom"]);

export const reportGroupBySchema = z.enum([
  "status",
  "department",
  "assignee",
  "priority",
  "month",
  "requestor",
]);

export const reportMetricSchema = z.enum([
  "count",
  "avg_response_days",
  "sla_compliance",
  "overdue_count",
  "appeals",
  "escalations",
]);

export const scheduleCadenceSchema = z.enum(["none", "weekly", "monthly", "quarterly", "yearly"]);

export const reportFiltersSchema = z.object({
  period: reportPeriodSchema,
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  statuses: z.array(caseStatusSchema).default([]),
  departments: z.array(z.string()).default([]),
  priorities: z.array(casePrioritySchema).default([]),
  assignees: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  groupBy: reportGroupBySchema,
  metrics: z.array(reportMetricSchema).default([]),
});

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(20),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).default("desc"),
});
