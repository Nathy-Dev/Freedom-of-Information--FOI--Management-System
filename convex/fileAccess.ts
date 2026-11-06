import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { api, components, internal } from "./_generated/api";
import { v } from "convex/values";
import { requirePermission, sessionSecurityRequirement } from "./lib/session";
import { writeAudit } from "./lib/audit";
import { hasPermission, visibleCases } from "./lib/permissions";
import { canReadDocument } from "./lib/documentAccess";

const permission = v.union(v.literal("system:backup"), v.literal("system:export"), v.literal("report:export"), v.literal("document:read"), v.literal("document:download"));

export const exportAccess = query({
  args: { permission },
  returns: v.object({ userId: v.id("users"), authSessionId: v.string() }),
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.permission);
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.sessionId) throw new Error("Sign in again.");
    return { userId: user._id, authSessionId: String(identity.sessionId) };
  },
});

export const createTicket = internalMutation({
  args: { storageId: v.id("_storage"), userId: v.id("users"), authSessionId: v.string(), permission, filename: v.string(), token: v.string(), documentId: v.optional(v.id("documents")), version: v.optional(v.number()), inline: v.optional(v.boolean()) },
  returns: v.string(),
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("fileTickets", { ...args, expiresAt: Date.now() + 600000 });
    await ctx.scheduler.runAfter(600000, internal.fileAccess.removeTicket, { id });
    return `${process.env.CONVEX_SITE_URL}/files/${args.token}`;
  },
});

export const removeTicket = internalMutation({
  args: { id: v.id("fileTickets") },
  returns: v.null(),
  handler: async (ctx, args) => { if (await ctx.db.get(args.id)) await ctx.db.delete(args.id); return null; },
});

export const readTicket = internalQuery({
  args: { token: v.string() },
  returns: v.union(v.null(), v.object({ storageId: v.id("_storage"), filename: v.string(), inline: v.boolean(), contentType: v.string() })),
  handler: async (ctx, args) => {
    const ticket = await ctx.db.query("fileTickets").withIndex("by_token", (query) => query.eq("token", args.token)).unique();
    if (!ticket || ticket.expiresAt <= Date.now()) return null;
    const user = await ctx.db.get(ticket.userId);
    if (!user || user.status !== "active") return null;
    const session = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "session", where: [{ field: "_id", value: ticket.authSessionId }] });
    if (!session || session.userId !== user.authUserId || session.expiresAt <= Date.now()) return null;
    const activity = await ctx.db.query("userSessions").withIndex("by_session", (query) => query.eq("authSessionId", ticket.authSessionId)).unique();
    const settings = await ctx.db.query("systemSettings").first();
    if (settings?.sessionTimeoutMinutes && Date.now() - (activity?.lastSeenAt ?? session.createdAt) > settings.sessionTimeoutMinutes * 60000) return null;
    if (!hasPermission(user.roleId, ticket.permission) || await sessionSecurityRequirement(ctx, user, ticket.authSessionId)) return null;
    let contentType = "application/octet-stream";
    if (ticket.documentId) {
      const document = await ctx.db.get(ticket.documentId);
      const record = document ? await ctx.db.get(document.caseId) : null;
      if (!document || !record || !canReadDocument(user, document) || !visibleCases(user.roleId, user._id, [record], [], user.teamId).length) return null;
      if (user.roleId === "requestor" && (ticket.version !== document.version || ticket.storageId !== document.storageId)) return null;
      if (ticket.version === document.version) {
        if (document.virusScan !== "clean" || document.storageId !== ticket.storageId) return null;
      } else {
        const versions = await ctx.db.query("documentVersions").withIndex("by_document", (query) => query.eq("documentId", document._id)).take(100);
        if (!versions.some((version) => version.version === ticket.version && version.storageId === ticket.storageId && version.virusScan === "clean")) return null;
      }
      contentType = ({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" } as Record<string, string>)[document.fileType.toLowerCase()] ?? contentType;
    }
    return { storageId: ticket.storageId, filename: ticket.filename, inline: ticket.inline === true, contentType };
  },
});

export const documentFile = mutation({
  args: { id: v.id("documents"), version: v.optional(v.number()), preview: v.optional(v.boolean()) },
  returns: v.object({ url: v.string(), filename: v.string() }),
  handler: async (ctx, args): Promise<{ url: string; filename: string }> => {
    const access = await ctx.runQuery(api.fileAccess.exportAccess, { permission: args.preview ? "document:read" : "document:download" });
    const user = await ctx.db.get(access.userId);
    const document = await ctx.db.get(args.id);
    const record = document ? await ctx.db.get(document.caseId) : null;
    if (!user || !document || !record || !canReadDocument(user, document) || !visibleCases(user.roleId, user._id, [record], [], user.teamId).length) throw new Error("This document is not available to you.");
    const version = args.version ?? document.version;
    if (user.roleId === "requestor" && version !== document.version) throw new Error("Only the released version is available.");
    if (args.preview && !["pdf", "png", "jpg", "jpeg"].includes(document.fileType.toLowerCase())) throw new Error("Use Download to open this file in its desktop application.");
    let storageId = document.storageId;
    let scan = document.virusScan;
    if (version !== document.version) {
      const versions = await ctx.db.query("documentVersions").withIndex("by_document", (query) => query.eq("documentId", args.id)).take(100);
      const historical = versions.find((entry) => entry.version === version);
      if (!historical?.storageId) throw new Error("This version has no stored file.");
      storageId = historical.storageId;
      scan = historical.virusScan ?? "pending";
    }
    if (scan !== "clean") throw new Error("This file must pass virus scanning before it can be opened.");
    const url = await ctx.runMutation(internal.fileAccess.createTicket, { ...access, storageId, permission: args.preview ? "document:read" : "document:download", filename: document.fileName, documentId: args.id, version, inline: args.preview ?? false, token: crypto.randomUUID() });
    await writeAudit(ctx, { entityType: "Document", entityId: document._id, entityLabel: document.fileName, action: args.preview ? "view" : "download", performedBy: user._id, details: `File access requested for version ${version}.` });
    return { url, filename: document.fileName };
  },
});

export const downloadBackup = mutation({
  args: { id: v.id("backups") },
  returns: v.object({ url: v.string(), filename: v.string(), checksum: v.union(v.string(), v.null()) }),
  handler: async (ctx, args): Promise<{ url: string; filename: string; checksum: string | null }> => {
    const access = await ctx.runQuery(api.fileAccess.exportAccess, { permission: "system:backup" });
    const backup = await ctx.db.get(args.id);
    if (!backup || backup.status !== "success" || !backup.storageId) throw new Error("No verified archive exists for this job. Create a new record export.");
    const filename = `hyprep-foi-records-${backup.startedAt.slice(0, 10)}.jsonl.gz`;
    const url = await ctx.runMutation(internal.fileAccess.createTicket, { ...access, storageId: backup.storageId, permission: "system:backup", filename, token: crypto.randomUUID() });
    await writeAudit(ctx, { entityType: "Backup", entityId: backup._id, entityLabel: filename, action: "download", performedBy: access.userId, details: "Application-record archive download requested. This is not a recovery snapshot." });
    return { url, filename, checksum: backup.checksum ?? null };
  },
});
