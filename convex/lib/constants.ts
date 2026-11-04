/**
 * Shared domain constants for the FOI Management System backend.
 * Ported from `src/lib/constants.ts` (labels/colours are a UI concern and stay
 * on the client; the backend keeps the enum sets and statutory defaults).
 */

export const STATUTORY_RESPONSE_DAYS = 7;

export const STATUS_ORDER = [
  "filed",
  "in_review",
  "pending_info",
  "responded",
  "escalated",
  "appeal",
  "closed",
  "rejected",
] as const;

export type StatusLiteral = (typeof STATUS_ORDER)[number];

export const OPEN_STATUSES: StatusLiteral[] = [
  "filed",
  "in_review",
  "pending_info",
  "escalated",
  "appeal",
];

export const CONCLUDED_STATUSES: StatusLiteral[] = ["closed", "rejected"];

export const PRIORITY_ORDER = ["critical", "high", "medium", "low"] as const;

export const NOTIFICATION_KINDS = [
  "case_assigned",
  "status_changed",
  "response_uploaded",
  "due_soon",
  "overdue",
  "court_reminder",
  "mention",
  "task_assigned",
  "admin_alert",
  "appeal_filed",
] as const;

export type NotificationKindLiteral = (typeof NOTIFICATION_KINDS)[number];

export const TIMELINE_KINDS = [
  "created",
  "acknowledged",
  "assigned",
  "status_changed",
  "note_added",
  "document_uploaded",
  "document_published",
  "document_redacted",
  "court_scheduled",
  "court_outcome",
  "linked",
  "escalated",
  "appeal_filed",
  "closed",
  "reopened",
  "sla_warning",
  "sla_breach",
] as const;

export type TimelineKindLiteral = (typeof TIMELINE_KINDS)[number];

/** Nigerian FOI Act 2011 statutory timezone. */
export const TIMEZONE = "Africa/Lagos";
