/**
 * Document read queries (ToR §12). Access is permission-gated; document
 * download/view events are logged via the access-log mutation.
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission, forbiddenError } from "../lib/session";
import { visibleCases } from "../lib/permissions";
import { canReadDocument, documentForReader } from "../lib/documentAccess";

export const list = query({
  args: {
    q: v.optional(v.string()),
    kinds: v.optional(v.array(v.string())),
    caseId: v.optional(v.id("cases")),
    redactedOnly: v.optional(v.boolean()),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "document:read");
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(Math.max(1, args.pageSize ?? 20), 200);
    const needle = args.q?.trim().toLowerCase();

    // Candidate window: all documents (bounded) then scope by case visibility.
    const docs = await ctx.db.query("documents").withIndex("by_kind").take(1000);
    const caseIds = new Set(
      visibleCases(
        user.roleId,
        user._id,
        await ctx.db.query("cases").withIndex("by_date_submitted").take(2000) as never,
        [],
        user.teamId,
      ).map((c) => c._id),
    );

    const rows = docs.filter((d) => {
      if (!caseIds.has(d.caseId)) return false;
      if (!canReadDocument(user, d)) return false;
      if (args.caseId && d.caseId !== args.caseId) return false;
      if (args.kinds?.length && !args.kinds.includes(d.kind)) return false;
      if (args.redactedOnly && !d.isRedacted) return false;
      if (needle && !d.fileName.toLowerCase().includes(needle)) return false;
      return true;
    });

    const total = rows.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const pageRows = rows.slice((safePage - 1) * pageSize, safePage * pageSize);

    const rowsWithUrls = await Promise.all(pageRows.map((doc) => documentForReader(ctx, user, doc)));
    return { rows: rowsWithUrls, total, page: safePage, pageSize, pageCount };
  },
});

export const get = query({
  args: { id: v.id("documents") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "document:read");
    const doc = await ctx.db.get("documents", args.id);
    if (!doc) return null;

    const foiCase = await ctx.db.get("cases", doc.caseId);
    if (!foiCase) return null;
    const scoped = visibleCases(user.roleId, user._id, [foiCase], [], user.teamId);
    if (scoped.length === 0) throw forbiddenError("This document is not visible to you.");

    const versions = await ctx.db
      .query("documentVersions")
      .withIndex("by_document", (q) => q.eq("documentId", args.id))
      .take(100);

    return { ...await documentForReader(ctx, user, doc), versions: user.roleId === "requestor" ? [] : versions.map((version) => ({ ...version, storageId: null })) };
  },
});

export const versionFile = query({
  args: { id: v.id("documents"), version: v.number() },
  returns: v.object({ url: v.union(v.string(), v.null()) }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "document:read");
    const document = await ctx.db.get(args.id);
    if (!document) return { url: null };
    const foiCase = await ctx.db.get(document.caseId);
    if (!foiCase || !visibleCases(user.roleId, user._id, [foiCase], [], user.teamId).length) throw forbiddenError();
    if (!canReadDocument(user, document) || (user.roleId === "requestor" && args.version !== document.version)) throw forbiddenError();
    if (args.version === document.version) return { url: null };
    return { url: null };
  },
});
