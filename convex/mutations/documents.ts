/**
 * Document mutations + upload pipeline (ToR §12, FR-014/FR-015/FR-032).
 *
 * Flow: `generateUploadUrl` (auth) → client PUTs to the returned upload URL →
 * `completeUpload` records metadata + versions + enqueues scan/OCR →
 * `recordAccess` logs view/download/denied. `redact` and `publish` are the
 * document lifecycle actions. Uses Web Crypto (default runtime — no node
 * built-ins in mutations).
 */

import { mutation, type MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { requirePermission, forbiddenError } from "../lib/session";
import { visibleCases } from "../lib/permissions";
import { writeAudit, writeAccessLog } from "../lib/audit";
import { pushNotification } from "../lib/notifications";
import { canReadDocument } from "../lib/documentAccess";

async function assertCaseAccess(
  ctx: MutationCtx,
  user: { roleId: string; _id: Id<"users">; teamId?: string | null },
  caseId: Id<"cases">,
) {
  const c = await ctx.db.get("cases", caseId);
  if (!c) throw forbiddenError("Case not found.");
  const scoped = visibleCases(user.roleId, user._id, [c], [], user.teamId);
  if (scoped.length === 0) throw forbiddenError("This case is not visible to you.");
  return c;
}

/** FR-014: start an upload — returns a short-lived upload URL scoped to the case. */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "document:upload");
    return ctx.storage.generateUploadUrl();
  },
});

/** FR-014/FR-015: complete an upload and record the document + version lineage. */
export const completeUpload = mutation({
  args: {
    caseId: v.id("cases"),
    storageId: v.id("_storage"),
    fileName: v.string(),
    fileSize: v.number(),
    kind: v.union(
      v.literal("request"),
      v.literal("response"),
      v.literal("evidence"),
      v.literal("court_filing"),
      v.literal("correspondence"),
      v.literal("internal_memo"),
    ),
    confidentiality: v.union(
      v.literal("public"),
      v.literal("internal"),
      v.literal("confidential"),
      v.literal("restricted"),
    ),
    isPublic: v.boolean(),
    retentionLabel: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "document:upload");
    const c = await assertCaseAccess(ctx, actor, args.caseId);
    if (!c) throw forbiddenError("Case not found.");

    const now = new Date().toISOString();
    const fileType = args.fileName.split(".").pop()?.toLowerCase() ?? "pdf";
    const stored = await ctx.db.system.get(args.storageId);
    if (!stored || stored.size !== args.fileSize || stored.size < 1 || stored.size > 50 * 1024 * 1024) throw forbiddenError("Upload a file between 1 byte and 50 MB.");
    if (!["pdf", "doc", "docx", "xls", "xlsx", "png", "jpg", "jpeg", "msg", "eml", "txt", "csv"].includes(fileType)) throw forbiddenError("Unsupported file type.");
    if (args.isPublic) throw forbiddenError("Files must be checked and published separately after upload.");

    // Same filename on the same case = new version (FR-015).
    const existing = await ctx.db
      .query("documents")
      .withIndex("by_case", (q) => q.eq("caseId", args.caseId))
      .filter((q) => q.eq("fileName", args.fileName))
      .first();

    if (existing) {
      const newVersion = existing.version + 1;
      await ctx.db.patch("documents", existing._id, {
        fileSize: args.fileSize,
        uploadedBy: actor._id,
        storageId: args.storageId,
        version: newVersion,
        isPublic: false,
        isRedacted: false,
        redactionVerified: false,
        redactionCount: 0,
        text: undefined,
        embedding: undefined,
        createdAt: now,
        virusScan: "pending",
        ocr: OCR_FILE_TYPES.has(fileType) ? "queued" : "not_required",
      });
      await ctx.db.insert("documentVersions", {
        documentId: existing._id,
        version: newVersion,
        uploadedBy: actor._id,
        createdAt: now,
        fileSize: args.fileSize,
        checksum: "",
        changeNote: "Replacement uploaded from the case file",
        storageId: args.storageId,
      });
      await ctx.db.insert("timeline", {
        caseId: args.caseId,
        kind: "document_uploaded",
        actorId: actor._id,
        at: now,
        summary: `Uploaded version ${newVersion} of ${args.fileName}`,
      });
      await writeAudit(ctx, {
        entityType: "Document",
        entityId: existing._id,
        entityLabel: args.fileName,
        action: "update",
        performedBy: actor._id,
        details: `New version ${newVersion} uploaded.`,
      });
      await enqueuePipeline(ctx, existing._id);
      return ctx.db.get("documents", existing._id);
    }

    const documentId = await ctx.db.insert("documents", {
      caseId: args.caseId,
      fileName: args.fileName,
      fileType,
      fileSize: args.fileSize,
      storageId: args.storageId,
      uploadedBy: actor._id,
      isPublic: args.isPublic,
      version: 1,
      checksum: "",
      kind: args.kind,
      confidentiality: args.confidentiality,
      isRedacted: false,
      redactionCount: 0,
      virusScan: "pending",
      ocr: OCR_FILE_TYPES.has(fileType) ? "queued" : "not_required",
      retentionLabel: args.retentionLabel,
      retainUntil: new Date(Date.now() + 7 * 365 * 86_400_000).toISOString(),
      createdAt: now,
    });

    await ctx.db.insert("documentVersions", {
      documentId,
      version: 1,
      uploadedBy: actor._id,
      createdAt: now,
      fileSize: args.fileSize,
      checksum: "",
      changeNote: "Initial upload",
      storageId: args.storageId,
    });

    await ctx.db.patch("cases", args.caseId, { documentCount: c.documentCount + 1, updatedAt: now });
    await ctx.db.insert("timeline", {
      caseId: args.caseId,
      kind: "document_uploaded",
      actorId: actor._id,
      at: now,
      summary: `Uploaded ${args.fileName}`,
      detail: `${args.kind.replace("_", " ")} · version 1`,
    });
    await writeAudit(ctx, {
      entityType: "Document",
      entityId: documentId,
      entityLabel: args.fileName,
      action: "create",
      performedBy: actor._id,
      details: "Document uploaded; scan queued.",
    });

    await enqueuePipeline(ctx, documentId);
    return ctx.db.get("documents", documentId);
  },
});

/** FR-032: record redactions (server-side burn via action in production). */
export const redact = mutation({
  args: {
    documentId: v.id("documents"),
    redactionCount: v.number(),
    grounds: v.string(),
    storageId: v.id("_storage"),
    fileSize: v.number(),
    confirmedPermanentRemoval: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "document:redact");
    const doc = await ctx.db.get("documents", args.documentId);
    if (!doc) throw forbiddenError("Document not found.");
    await assertCaseAccess(ctx, actor, doc.caseId);
    const stored = await ctx.db.system.get(args.storageId);
    if (!args.confirmedPermanentRemoval || !Number.isInteger(args.redactionCount) || args.redactionCount < 1 || args.grounds.trim().length < 5) throw forbiddenError("Confirm the permanent removal of sensitive content and state the legal grounds.");
    if (!stored || stored.contentType !== "application/pdf" || stored.size !== args.fileSize || stored.size < 1 || stored.size > 50 * 1024 * 1024 || args.storageId === doc.storageId) throw forbiddenError("Upload a separate, permanently edited disclosure PDF (maximum 50 MB).");

    const now = new Date().toISOString();
    await ctx.db.patch("documents", args.documentId, {
      isRedacted: true,
      redactionVerified: true,
      storageId: args.storageId,
      fileSize: args.fileSize,
      fileType: "pdf",
      fileName: doc.fileName.replace(/\.[^.]+$/, "") + ".pdf",
      virusScan: "pending",
      checksum: "",
      ocr: "queued",
      text: undefined,
      embedding: undefined,
      isPublic: false,
      redactionCount: args.redactionCount,
      version: doc.version + 1,
      updatedAt: now,
    });
    await ctx.db.insert("documentVersions", {
      documentId: args.documentId,
      version: doc.version + 1,
      uploadedBy: actor._id,
      createdAt: now,
      fileSize: args.fileSize,
      checksum: "",
      storageId: args.storageId,
      virusScan: "pending",
      changeNote: `Redactions applied — ${args.grounds}`,
    });
    await ctx.db.insert("timeline", {
      caseId: doc.caseId,
      kind: "document_redacted",
      actorId: actor._id,
      at: now,
      summary: `${args.redactionCount} redactions applied to ${doc.fileName}`,
      detail: args.grounds,
    });
    await writeAudit(ctx, {
      entityType: "Document",
      entityId: args.documentId,
      entityLabel: doc.fileName,
      action: "redact",
      performedBy: actor._id,
      details: `${args.redactionCount} severances applied. Grounds: ${args.grounds}`,
    });
    await enqueuePipeline(ctx, args.documentId);
    return ctx.db.get("documents", args.documentId);
  },
});

export const setLegalHold = mutation({
  args: { documentId: v.id("documents"), enabled: v.boolean(), reason: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "document:retention");
    const document = await ctx.db.get(args.documentId);
    if (!document) throw forbiddenError("Document not found.");
    await assertCaseAccess(ctx, actor, document.caseId);
    if (args.reason.trim().length < 10 || args.reason.length > 1000) throw forbiddenError("Give a reason between 10 and 1,000 characters.");
    await ctx.db.patch(document._id, { legalHold: args.enabled, updatedAt: new Date().toISOString() });
    await writeAudit(ctx, { entityType: "Document", entityId: document._id, entityLabel: document.fileName, action: "update", performedBy: actor._id, details: `Legal hold ${args.enabled ? "placed" : "released"}: ${args.reason.trim()}` });
    return null;
  },
});

/** FR-014: publish a response to the requestor. */
export const publish = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "document:publish");
    const doc = await ctx.db.get("documents", args.documentId);
    if (!doc) throw forbiddenError("Document not found.");
    await assertCaseAccess(ctx, actor, doc.caseId);
    if (doc.virusScan !== "clean") throw forbiddenError("The file must pass a virus scan before release.");
    if (doc.isRedacted && doc.redactionVerified !== true) throw forbiddenError("Upload an approved disclosure copy before publishing this redacted record.");

    const now = new Date().toISOString();
    await ctx.db.patch("documents", args.documentId, { isPublic: true, updatedAt: now });
    await ctx.db.insert("timeline", {
      caseId: doc.caseId,
      kind: "document_published",
      actorId: actor._id,
      at: now,
      summary: `Published ${doc.fileName} to the requestor`,
    });
    await writeAudit(ctx, {
      entityType: "Document",
      entityId: args.documentId,
      entityLabel: doc.fileName,
      action: "publish",
      performedBy: actor._id,
      details: "Document published to the requestor portal.",
    });

    const c = await ctx.db.get("cases", doc.caseId);
    const requestor = c ? await ctx.db.get("requestors", c.requestorId) : null;
    const requestorUserId = requestor?.userId as Id<"users"> | undefined;
    if (requestorUserId) {
      await pushNotification(ctx, {
        userId: requestorUserId,
        kind: "response_uploaded",
        title: `New document on ${c?.caseNumber ?? ""}`,
        body: doc.fileName,
        link: `/my-requests/${doc.caseId}`,
      });
    }

    return ctx.db.get("documents", args.documentId);
  },
});

/** FR-073: delete a document with audit. */
export const deleteDocument = mutation({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "document:delete");
    const doc = await ctx.db.get("documents", args.documentId);
    if (!doc) throw forbiddenError("Document not found.");
    await assertCaseAccess(ctx, actor, doc.caseId);
    await ctx.db.delete("documents", args.documentId);
    await writeAudit(ctx, {
      entityType: "Document",
      entityId: args.documentId,
      entityLabel: doc.fileName,
      action: "delete",
      performedBy: actor._id,
      details: "Document deleted.",
    });
    return null;
  },
});

/** Record access (view/download/denied) for the access log (ToR §16). */
export const recordAccess = mutation({
  args: {
    documentId: v.id("documents"),
    action: v.union(v.literal("view"), v.literal("download"), v.literal("print"), v.literal("denied")),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "document:read");
    const doc = await ctx.db.get("documents", args.documentId);
    if (!doc) return null;
    const c = await assertCaseAccess(ctx, actor, doc.caseId);
    if (!canReadDocument(actor, doc)) throw forbiddenError("This document has not been released to you.");
    await writeAccessLog(ctx, {
      documentId: args.documentId,
      documentName: doc.fileName,
      caseId: doc.caseId,
      caseNumber: c?.caseNumber ?? doc.caseId,
      userId: actor._id,
      action: args.action,
    });
    if (args.action === "download") {
      await writeAudit(ctx, {
        entityType: "Document",
        entityId: args.documentId,
        entityLabel: doc.fileName,
        action: "download",
        performedBy: actor._id,
        details: "Document downloaded.",
      });
    }
    return null;
  },
});

/** File types eligible for OCR (PDFs + images supported by Cloud Vision). */
const OCR_FILE_TYPES = new Set(["pdf", "png", "jpg", "jpeg", "webp", "gif", "tif", "tiff", "bmp"]);

/** Enqueue the file-pipeline action (virus scan + OCR) for a document. */
async function enqueuePipeline(ctx: MutationCtx, documentId: Id<"documents">): Promise<void> {
  // The pipeline action is registered in convex/actions/filePipeline.ts.
  await ctx.scheduler.runAfter(0, internal.actions.filePipeline.process, { documentId });
}
