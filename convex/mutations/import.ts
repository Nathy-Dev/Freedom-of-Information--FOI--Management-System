/**
 * Bulk CSV import (FR-044, ToR §18). `commit` creates real cases from validated
 * rows, recording an `importBatches` outcome row for the UI.
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission } from "../lib/session";
import { writeAudit } from "../lib/audit";
import { addWorkingDays } from "../lib/sla";
import type { Id } from "../_generated/dataModel";

const IMPORT_FIELDS = [
  "subject",
  "description",
  "requestorName",
  "requestorEmail",
  "requestorPhone",
  "requestorOrganization",
  "department",
  "priority",
  "confidentiality",
  "responseFormat",
  "source",
  "tags",
  "dateSubmitted",
] as const;

type ImportRow = Record<(typeof IMPORT_FIELDS)[number], string>;

export const commit = mutation({
  args: {
    fileName: v.string(),
    rows: v.array(v.any()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "import:bulk");
    const settings = await ctx.db.query("systemSettings").first();
    if (args.rows.length > 200) throw new Error("Import at most 200 rows at a time.");
    const rows = args.rows as ImportRow[];
    const now = new Date();
    const iso = now.toISOString();
    const year = now.getFullYear();

    const batchId = await ctx.db.insert("importBatches", {
      createdBy: actor._id,
      fileName: args.fileName,
      totalRows: rows.length,
      created: 0,
      skipped: 0,
      status: "running",
      errorRows: [],
      caseNumbers: [],
      createdAt: iso,
    });

    let created = 0;
    let skipped = 0;
    const errorRows: string[] = [];
    const caseNumbers: string[] = [];

    for (const row of rows) {
      try {
        const email = (row.requestorEmail ?? "unknown@hyprep.gov.ng").toLowerCase();
        let requestor = await ctx.db
          .query("requestors")
          .withIndex("by_email", (q) => q.eq("email", email))
          .first();
        if (!requestor) {
          const rid = await ctx.db.insert("requestors", {
            name: row.requestorName || email,
            email,
            phone: row.requestorPhone || undefined,
            organization: row.requestorOrganization || undefined,
            isJournalist: false,
          });
          requestor = await ctx.db.get("requestors", rid);
        }
        if (!requestor) {
          skipped += 1;
          errorRows.push(`Row ${created + skipped}: could not resolve requestor.`);
          continue;
        }

        const counterKey = `case:${year}`;
        const counter = await ctx.db
          .query("counters")
          .withIndex("by_key", (q) => q.eq("key", counterKey))
          .first();
        const next = (counter?.value ?? 0) + 1;
        if (counter) await ctx.db.patch("counters", counter._id, { value: next });
        else await ctx.db.insert("counters", { key: counterKey, value: next });
        const caseNumber = `HYPREP/FOI/${year}/${String(next).padStart(4, "0")}`;

        const dateSubmitted = row.dateSubmitted || iso;
        const caseId = await ctx.db.insert("cases", {
          caseNumber,
          requestorId: requestor._id,
          requestorUserId: requestor.userId,
          requestor: {
            name: requestor.name,
            email: requestor.email,
            phone: requestor.phone,
            organization: requestor.organization,
            isJournalist: requestor.isJournalist,
          },
          subject: row.subject,
          description: row.description,
          assignedTo: undefined,
          assignedTeamId: undefined,
          status: "filed",
          priority: (row.priority as never) ?? "medium",
          confidentiality: (row.confidentiality as never) ?? "internal",
          responseFormat: (row.responseFormat as never) ?? "electronic",
          source: (row.source as never) ?? "csv_import",
          tags: row.tags ? row.tags.split(";").map((t) => t.trim()).filter(Boolean) : [],
          department: row.department || "Legal Unit",
          dateSubmitted,
          statutoryDueDate: addWorkingDays(new Date(dateSubmitted), settings?.statutoryResponseDays ?? 7),
          dateClosed: undefined,
          closureReason: undefined,
          outcomeCode: undefined,
          linkedCaseIds: [],
          isAppeal: false,
          appealOfCaseId: undefined,
          respondedAt: undefined,
          documentCount: 0,
          noteCount: 0,
          courtDateCount: 0,
          slaState: "on_track",
          createdAt: iso,
          updatedAt: iso,
        });

        await ctx.db.insert("timeline", {
          caseId,
          kind: "created",
          actorId: actor._id,
          at: iso,
          summary: "Case created via CSV import",
          detail: `Imported from ${args.fileName}.`,
        });

        created += 1;
        caseNumbers.push(caseNumber);
      } catch {
        skipped += 1;
        errorRows.push(`Row ${created + skipped + 1}: import failed.`);
      }
    }

    await ctx.db.patch("importBatches", batchId, {
      created,
      skipped,
      status: "success",
      errorRows,
      caseNumbers,
    });

    await writeAudit(ctx, {
      entityType: "ImportBatch",
      entityId: batchId,
      entityLabel: args.fileName,
      action: "create",
      performedBy: actor._id,
      details: `Imported ${created} rows (${skipped} skipped).`,
    });

    return { batchId, created, skipped, caseNumbers };
  },
});

export type { Id };
