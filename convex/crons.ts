/**
 * Cron schedule registration (ToR §14/§23/§31).
 *
 * Kept separate from `convex/scheduled.ts` (which defines the action
 * functions) so the `cronJobs()` registration can reference those actions via
 * `internal.scheduled.*` without same-module circularity.
 *
 * - slaMonitor      → hourly: recompute SLA state, emit due-soon/overdue
 *                     timeline + notifications
 * - courtReminders  → daily: reminders for upcoming hearings
 * - scheduledReports→ daily: run due saved reports and email recipients
 * - retention       → daily: archive/delete documents past retainUntil
 * - sessionCleanup  → daily: revoke expired Better Auth sessions
 * - webhookRetry    → every 15 min: retry failed webhook deliveries
 * - filePipelineRetry → every 30 min: retry pending-scan documents
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("SLA monitor", { hours: 1 }, internal.scheduled.slaMonitor, {});
crons.interval("Court reminders", { hours: 24 }, internal.scheduled.courtReminders, {});
crons.interval("Scheduled reports", { hours: 24 }, internal.scheduled.reportDelivery, {});
crons.interval("Retention", { hours: 24 }, internal.scheduled.retention, {});
crons.interval("Session cleanup", { hours: 24 }, internal.scheduled.sessionCleanup, {});
crons.interval("Webhook retry", { minutes: 15 }, internal.actions.webhooks.deliver, {
  event: "retry",
  payload: {},
});
crons.interval("File pipeline retry", { minutes: 30 }, internal.scheduled.retryPipeline, {});

export default crons;
