"use node";

import { action, internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { v } from "convex/values";
import { reportFiltersValidator } from "../lib/reportData";
import { reportFile } from "../lib/reportFiles";
import { sendEmail } from "./email";
import { createHash } from "node:crypto";

export const exportReport = action({
  args: { name: v.string(), filters: reportFiltersValidator, format: v.union(v.literal("csv"), v.literal("pdf"), v.literal("xlsx")) },
  returns: v.object({ fileName: v.string(), url: v.string() }),
  handler: async (ctx, args): Promise<{ fileName: string; url: string }> => {
    const data = await ctx.runQuery(api.queries.reports.exportData, { filters: args.filters });
    const access = await ctx.runQuery(api.fileAccess.exportAccess, { permission: "report:export" });
    const file = await reportFile(args.name, data.rows, args.format);
    const storageId = await ctx.storage.store(new Blob([new Uint8Array(file.bytes)], { type: file.contentType }));
    await ctx.scheduler.runAfter(600000, internal.internal.exportDb.removeExport, { storageId });
    const url = await ctx.runMutation(internal.fileAccess.createTicket, { ...access, storageId, permission: "report:export", filename: file.filename, token: crypto.randomUUID() });
    if (!url) throw new Error("Report file unavailable.");
    await ctx.runMutation(api.mutations.admin.recordReportExport, { name: args.name, rowCount: data.rows.length });
    return { fileName: file.filename, url };
  },
});

export const deliver = internalAction({
  args: { reportId: v.id("reports") },
  returns: v.null(),
  handler: async (ctx, { reportId }): Promise<null> => {
    const report = await ctx.runMutation(internal.internal.reportDb.claim, { reportId });
    if (!report) return null;
    try {
      if (!report.recipients.length) throw new Error("No recipients.");
      for (const email of [...new Set(report.recipients.map((recipient) => recipient.trim().toLowerCase()))]) {
        const data = await ctx.runQuery(internal.internal.reportDb.data, { reportId, recipientEmail: email });
        const file = await reportFile(report.name, data.rows, report.format);
        const result = await sendEmail({ to: email, subject: `HYPREP report: ${report.name}`, html: "<p>Your scheduled HYPREP report is attached. It contains only information you are permitted to access.</p>", attachments: [{ filename: file.filename, content: Buffer.from(file.bytes).toString("base64") }], idempotencyKey: `foi-report-${report.runId}-${createHash("sha256").update(email).digest("hex").slice(0, 16)}` });
        if (result.skipped) throw new Error("Sender unavailable.");
      }
      await ctx.runMutation(internal.internal.reportDb.finish, { runId: report.runId, success: true });
    } catch {
      await ctx.runMutation(internal.internal.reportDb.finish, { runId: report.runId, success: false });
      await ctx.scheduler.runAfter(600000, internal.actions.reports.deliver, { reportId });
    }
    return null;
  },
});
