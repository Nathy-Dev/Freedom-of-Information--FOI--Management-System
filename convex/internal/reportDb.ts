import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { buildReport, reportResultValidator } from "../lib/reportData";
import { hasPermission } from "../lib/permissions";
import type { Id } from "../_generated/dataModel";
import { nextReportRun } from "../lib/reportSchedule";
import { securityRequirement } from "../lib/session";

export const claim = internalMutation({
  args: { reportId: v.id("reports") },
  returns: v.union(v.null(), v.object({ runId: v.id("reportRuns"), name: v.string(), format: v.union(v.literal("csv"), v.literal("pdf"), v.literal("xlsx")), recipients: v.array(v.string()) })),
  handler: async (ctx, { reportId }) => {
    const report = await ctx.db.get(reportId);
    if (!report || report.cadence === "none" || !report.nextRun || report.nextRun > new Date().toISOString()) return null;
    const previous = await ctx.db.query("reportRuns").withIndex("by_report", (query) => query.eq("reportId", reportId)).order("desc").first();
    if (previous?.status === "running" && (previous.leaseUntil ?? 0) > Date.now()) return null;
    let runId: Id<"reportRuns">;
    if (previous && previous.status !== "success") {
      if ((previous.attempts ?? 0) >= 5) return null;
      runId = previous._id;
      await ctx.db.patch(runId, { status: "running", attempts: (previous.attempts ?? 0) + 1, leaseUntil: Date.now() + 300000, error: undefined });
    } else runId = await ctx.db.insert("reportRuns", { reportId, startedAt: new Date().toISOString(), status: "running", attempts: 1, leaseUntil: Date.now() + 300000 });
    return { runId, name: report.name, format: report.format, recipients: report.recipients };
  },
});

export const data = internalQuery({
  args: { reportId: v.id("reports"), recipientEmail: v.string() },
  returns: reportResultValidator,
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    const creator = report ? await ctx.db.get(report.creatorId) : null;
    const recipient = await ctx.db.query("users").withIndex("by_email", (query) => query.eq("email", args.recipientEmail.trim().toLowerCase())).unique();
    if (!report || !creator || creator.status !== "active" || !hasPermission(creator.roleId, "report:schedule") || !recipient || recipient.status !== "active" || !hasPermission(recipient.roleId, "report:read")) throw new Error("Scheduled reports can only be sent to active, authorized HYPREP users.");
    if (await securityRequirement(ctx, creator) || await securityRequirement(ctx, recipient)) throw new Error("Complete account security requirements before scheduled delivery.");
    return buildReport(ctx, recipient, report.filters, creator);
  },
});

export const finish = internalMutation({
  args: { runId: v.id("reportRuns"), success: v.boolean(), storageId: v.optional(v.id("_storage")) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) return null;
    await ctx.db.patch(args.runId, { status: args.success ? "success" : "failed", finishedAt: new Date().toISOString(), leaseUntil: undefined, storageId: args.storageId, error: args.success ? undefined : "Report delivery failed. Check recipient access, sender settings and provider availability." });
    const report = await ctx.db.get(run.reportId);
    if (report && args.success) {
      await ctx.db.patch(report._id, { lastRun: new Date().toISOString(), nextRun: nextReportRun(report.cadence) });
    }
    return null;
  },
});
