/**
 * Internal DB functions for the file pipeline (called by the Node-runtime
 * action via ctx.runQuery/ctx.runMutation — actions have no ctx.db).
 * Lives outside /actions because it exports queries/mutations, which cannot
 * carry the `"use node"` directive.
 */
import { internalQuery, internalMutation } from "../_generated/server";
import { v } from "convex/values";

/** Fetch document metadata + a signed URL for the stored blob. */
export const getDocument = internalQuery({
  args: { documentId: v.id("documents") },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get("documents", args.documentId);
    if (!doc) return null;
    const url = await ctx.storage.getUrl(doc.storageId);
    const settings = await ctx.db.query("systemSettings").first();
    return {
      _id: doc._id,
      storageId: doc.storageId,
      fileName: doc.fileName,
      fileType: doc.fileType,
      url: url ?? undefined,
      virusScanEnabled: settings?.virusScanEnabled ?? true,
      ocrEnabled: settings?.ocrEnabled ?? true,
    };
  },
});

/** Persist pipeline results (checksum, virus scan, OCR text). */
export const updateDocument = internalMutation({
  args: {
    documentId: v.id("documents"),
    storageId: v.id("_storage"),
    checksum: v.optional(v.string()),
    virusScan: v.optional(v.union(v.literal("pending"), v.literal("clean"), v.literal("infected"), v.literal("skipped"))),
    ocr: v.optional(v.union(v.literal("not_required"), v.literal("queued"), v.literal("processing"), v.literal("complete"), v.literal("failed"))),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get("documents", args.documentId);
    if (!doc || doc.storageId !== args.storageId) return null;
    const patch: Record<string, unknown> = {};
    if (args.checksum) patch.checksum = args.checksum;
    if (args.virusScan) patch.virusScan = args.virusScan;
    if (args.ocr) patch.ocr = args.ocr;
    if (args.text !== undefined) patch.text = args.text;
    await ctx.db.patch("documents", args.documentId, patch);
    const versions = await ctx.db.query("documentVersions").withIndex("by_document", (query) => query.eq("documentId", doc._id)).take(100);
    const version = versions.find((entry) => entry.version === doc.version && entry.storageId === args.storageId);
    if (version) await ctx.db.patch(version._id, { checksum: args.checksum ?? version.checksum, virusScan: args.virusScan ?? version.virusScan });
    return ctx.db.get("documents", args.documentId);
  },
});
