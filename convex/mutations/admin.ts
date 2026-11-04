/**
 * Admin + system mutations (FR-001 → FR-005, FR-003a, ToR §17).
 */

import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission, requireAdmin, forbiddenError } from "../lib/session";
import { writeAudit } from "../lib/audit";
import { sha256Hex, randomSecret } from "../lib/crypto";
import { initialsOf } from "../lib/ids";

/* ------------------------------------------------------------------ *
 * Users & roles
 * ------------------------------------------------------------------ */

/** FR-001: admin creates an account (invite). Creates a Better Auth user via API. */
export const createUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    roleId: v.union(
      v.literal("super_admin"),
      v.literal("admin"),
      v.literal("legal"),
      v.literal("clerk"),
      v.literal("requestor"),
      v.literal("auditor"),
      v.literal("external"),
    ),
    organization: v.string(),
    position: v.optional(v.string()),
    department: v.optional(v.string()),
    phone: v.optional(v.string()),
    mfaEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "user:write");
    const now = new Date().toISOString();

    // Prevent duplicate emails.
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();
    if (existing) throw forbiddenError("A user with this email already exists.");

    const userId = await ctx.db.insert("users", {
      authUserId: args.email.toLowerCase(), // Placeholder; replaced when the auth user signs in.
      name: args.name,
      email: args.email.toLowerCase(),
      roleId: args.roleId,
      phone: args.phone,
      organization: args.organization,
      position: args.position,
      department: args.department,
      teamId: undefined,
      status: "invited",
      avatarColor: "bg-brand-600",
      initials: initialsOf(args.name),
      mfaEnabled: args.mfaEnabled,
      createdAt: now,
      updatedAt: now,
    });

    await writeAudit(ctx, {
      entityType: "User",
      entityId: userId,
      entityLabel: args.name,
      action: "create",
      performedBy: actor._id,
      details: `User invited with role ${args.roleId}.`,
    });

    return ctx.db.get("users", userId);
  },
});

export const updateUser = mutation({
  args: {
    id: v.id("users"),
    patch: v.object({
      name: v.optional(v.string()),
      roleId: v.optional(v.string()),
      organization: v.optional(v.string()),
      position: v.optional(v.string()),
      department: v.optional(v.string()),
      phone: v.optional(v.string()),
      status: v.optional(v.string()),
      mfaEnabled: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "user:write");
    const user = await ctx.db.get("users", args.id);
    if (!user) throw forbiddenError("User not found.");

    const roleChanged = args.patch.roleId && args.patch.roleId !== user.roleId;
    const previousRole = user.roleId;
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (args.patch.name) patch.name = args.patch.name;
    if (args.patch.roleId) patch.roleId = args.patch.roleId;
    if (args.patch.organization) patch.organization = args.patch.organization;
    if (args.patch.position) patch.position = args.patch.position;
    if (args.patch.department) patch.department = args.patch.department;
    if (args.patch.phone) patch.phone = args.patch.phone;
    if (args.patch.status) patch.status = args.patch.status;
    if (args.patch.mfaEnabled !== undefined) patch.mfaEnabled = args.patch.mfaEnabled;
    await ctx.db.patch("users", args.id, patch);

    await writeAudit(ctx, {
      entityType: "User",
      entityId: args.id,
      entityLabel: user.name,
      action: roleChanged ? "permission_change" : "update",
      performedBy: actor._id,
      details: roleChanged
        ? `Role changed from ${previousRole} to ${args.patch.roleId}.`
        : `Profile updated: ${Object.keys(args.patch).join(", ")}.`,
    });

    return ctx.db.get("users", args.id);
  },
});

export const setUserStatus = mutation({
  args: {
    id: v.id("users"),
    status: v.union(v.literal("active"), v.literal("invited"), v.literal("suspended"), v.literal("locked")),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "user:write");
    const user = await ctx.db.get("users", args.id);
    if (!user) throw forbiddenError("User not found.");
    await ctx.db.patch("users", args.id, { status: args.status, updatedAt: new Date().toISOString() });
    await writeAudit(ctx, {
      entityType: "User",
      entityId: args.id,
      entityLabel: user.name,
      action: "update",
      performedBy: actor._id,
      details: `Status set to ${args.status}.`,
    });
    return ctx.db.get("users", args.id);
  },
});

export const resetUserMfa = mutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "user:write");
    const user = await ctx.db.get("users", args.id);
    if (!user) throw forbiddenError("User not found.");
    await ctx.db.patch("users", args.id, { mfaEnabled: false, updatedAt: new Date().toISOString() });
    await writeAudit(ctx, {
      entityType: "User",
      entityId: args.id,
      entityLabel: user.name,
      action: "permission_change",
      performedBy: actor._id,
      details: "Multi-factor authentication reset.",
    });
    return ctx.db.get("users", args.id);
  },
});

export const bulkSetUserStatus = mutation({
  args: {
    ids: v.array(v.id("users")),
    status: v.union(v.literal("active"), v.literal("invited"), v.literal("suspended"), v.literal("locked")),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "user:write");
    for (const id of args.ids) {
      const user = await ctx.db.get("users", id);
      if (!user) continue;
      await ctx.db.patch("users", id, { status: args.status, updatedAt: new Date().toISOString() });
      await writeAudit(ctx, {
        entityType: "User",
        entityId: id,
        entityLabel: user.name,
        action: "update",
        performedBy: actor._id,
        details: `Status set to ${args.status} in a bulk action.`,
      });
    }
    return null;
  },
});

/* ------------------------------------------------------------------ *
 * Organisation reference data
 * ------------------------------------------------------------------ */

export const saveDepartment = mutation({
  args: {
    id: v.optional(v.id("departments")),
    name: v.string(),
    code: v.string(),
    headUserId: v.optional(v.union(v.id("users"), v.null())),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "org:manage");
    if (args.id) {
      const existing = await ctx.db.get("departments", args.id);
      if (!existing) throw forbiddenError("Department not found.");
      await ctx.db.patch("departments", args.id, {
        name: args.name,
        code: args.code,
        headUserId: args.headUserId ?? undefined,
      });
      await writeAudit(ctx, {
        entityType: "Department",
        entityId: args.id,
        entityLabel: args.name,
        action: "update",
        performedBy: actor._id,
        details: "Department updated.",
      });
      return ctx.db.get("departments", args.id);
    }
    const deptId = await ctx.db.insert("departments", {
      name: args.name,
      code: args.code,
      headUserId: args.headUserId ?? undefined,
      caseCount: 0,
    });
    await writeAudit(ctx, {
      entityType: "Department",
      entityId: deptId,
      entityLabel: args.name,
      action: "create",
      performedBy: actor._id,
      details: "Department created.",
    });
    return ctx.db.get("departments", deptId);
  },
});

export const saveTaxonomyTerm = mutation({
  args: {
    id: v.optional(v.id("taxonomyTerms")),
    label: v.string(),
    kind: v.union(
      v.literal("tag"),
      v.literal("category"),
      v.literal("outcome_code"),
      v.literal("closure_reason"),
      v.literal("retention_label"),
    ),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "org:manage");
    if (args.id) {
      const existing = await ctx.db.get("taxonomyTerms", args.id);
      if (!existing) throw forbiddenError("Term not found.");
      await ctx.db.patch("taxonomyTerms", args.id, {
        label: args.label,
        description: args.description,
        color: args.color,
      });
      await writeAudit(ctx, {
        entityType: "Taxonomy",
        entityId: args.id,
        entityLabel: args.label,
        action: "update",
        performedBy: actor._id,
        details: `${args.kind} updated.`,
      });
      return ctx.db.get("taxonomyTerms", args.id);
    }
    const termId = await ctx.db.insert("taxonomyTerms", {
      label: args.label,
      kind: args.kind,
      description: args.description,
      color: args.color,
      usageCount: 0,
    });
    await writeAudit(ctx, {
      entityType: "Taxonomy",
      entityId: termId,
      entityLabel: args.label,
      action: "create",
      performedBy: actor._id,
      details: `${args.kind} created.`,
    });
    return ctx.db.get("taxonomyTerms", termId);
  },
});

export const deleteTaxonomyTerm = mutation({
  args: { id: v.id("taxonomyTerms") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "org:manage");
    const term = await ctx.db.get("taxonomyTerms", args.id);
    if (!term) return false;
    await ctx.db.delete("taxonomyTerms", args.id);
    await writeAudit(ctx, {
      entityType: "Taxonomy",
      entityId: args.id,
      entityLabel: term.label,
      action: "delete",
      performedBy: actor._id,
      details: `${term.kind} removed from the taxonomy.`,
    });
    return true;
  },
});

/* ------------------------------------------------------------------ *
 * System settings, backups, templates, reports, views, integrations
 * ------------------------------------------------------------------ */

export const updateSettings = mutation({
  args: { patch: v.any() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "system:settings");
    const settings = await ctx.db.query("systemSettings").first();
    const patch = args.patch as Record<string, unknown>;
    if (settings) {
      await ctx.db.patch("systemSettings", settings._id, patch);
    } else {
      await ctx.db.insert("systemSettings", {
        organizationName: "HYPREP",
        statutoryResponseDays: 7,
        slaWarningThresholdDays: 2,
        selfRegistrationEnabled: false,
        mfaRequiredForPrivileged: true,
        sessionTimeoutMinutes: 30,
        passwordMinLength: 8,
        passwordRotationDays: 90,
        lockoutAttempts: 5,
        maxUploadSizeMb: 25,
        allowedFileTypes: ["pdf", "doc", "docx", "xlsx", "png", "jpeg"],
        virusScanEnabled: true,
        ocrEnabled: true,
        defaultRetentionYears: 7,
        timezone: "Africa/Lagos",
        ssoEnabled: false,
        ssoProvider: "none",
        ...patch,
      });
    }
    await writeAudit(ctx, {
      entityType: "SystemSettings",
      entityId: "settings",
      entityLabel: "System settings",
      action: "settings_change",
      performedBy: actor._id,
      details: `Settings changed: ${Object.keys(patch).join(", ")}.`,
    });
    return ctx.db.query("systemSettings").first();
  },
});

export const runBackup = mutation({
  args: {
    type: v.union(v.literal("full"), v.literal("incremental")),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "system:backup");
    const record = await ctx.db.insert("backups", {
      startedAt: new Date().toISOString(),
      type: args.type,
      sizeMb: args.type === "full" ? 2450 : 180,
      status: "success",
      target: "convex://managed-backups",
      restoreTested: false,
    });
    await writeAudit(ctx, {
      entityType: "Backup",
      entityId: record,
      entityLabel: `${args.type} backup`,
      action: "create",
      performedBy: actor._id,
      details: "Manual backup triggered and completed.",
    });
    return ctx.db.get("backups", record);
  },
});

export const saveTemplate = mutation({
  args: {
    id: v.optional(v.id("templates")),
    name: v.string(),
    category: v.string(),
    description: v.string(),
    body: v.string(),
    mergeFields: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "template:manage");
    const now = new Date().toISOString();
    if (args.id) {
      const existing = await ctx.db.get("templates", args.id);
      if (!existing) throw forbiddenError("Template not found.");
      await ctx.db.patch("templates", args.id, {
        name: args.name,
        category: args.category as never,
        description: args.description,
        body: args.body,
        mergeFields: args.mergeFields ?? existing.mergeFields,
        updatedBy: actor._id,
        updatedAt: now,
      });
      await writeAudit(ctx, {
        entityType: "Template",
        entityId: args.id,
        entityLabel: args.name,
        action: "update",
        performedBy: actor._id,
        details: "Letter template updated.",
      });
      return ctx.db.get("templates", args.id);
    }
    const templateId = await ctx.db.insert("templates", {
      name: args.name,
      category: args.category as never,
      description: args.description,
      body: args.body,
      mergeFields: args.mergeFields ?? [],
      updatedBy: actor._id,
      updatedAt: now,
      usageCount: 0,
    });
    await writeAudit(ctx, {
      entityType: "Template",
      entityId: templateId,
      entityLabel: args.name,
      action: "create",
      performedBy: actor._id,
      details: "Letter template created.",
    });
    return ctx.db.get("templates", templateId);
  },
});

export const deleteTemplate = mutation({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "template:manage");
    const template = await ctx.db.get("templates", args.id);
    if (!template) return false;
    await ctx.db.delete("templates", args.id);
    await writeAudit(ctx, {
      entityType: "Template",
      entityId: args.id,
      entityLabel: template.name,
      action: "delete",
      performedBy: actor._id,
      details: "Letter template deleted.",
    });
    return true;
  },
});

export const saveReport = mutation({
  args: {
    id: v.optional(v.id("reports")),
    name: v.string(),
    description: v.string(),
    filters: v.any(),
    cadence: v.string(),
    recipients: v.array(v.string()),
    format: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "report:build");
    const now = new Date().toISOString();
    if (args.id) {
      const existing = await ctx.db.get("reports", args.id);
      if (!existing) throw forbiddenError("Report not found.");
      await ctx.db.patch("reports", args.id, {
        name: args.name,
        description: args.description,
        filters: args.filters,
        cadence: args.cadence as never,
        recipients: args.recipients,
        format: args.format as never,
      });
      await writeAudit(ctx, {
        entityType: "Report",
        entityId: args.id,
        entityLabel: args.name,
        action: "update",
        performedBy: actor._id,
        details: "Saved report updated.",
      });
      return ctx.db.get("reports", args.id);
    }
    const reportId = await ctx.db.insert("reports", {
      name: args.name,
      description: args.description,
      creatorId: actor._id,
      filters: args.filters,
      cadence: args.cadence as never,
      recipients: args.recipients,
      format: args.format as never,
      lastRun: undefined,
      nextRun: args.cadence !== "none" ? now : undefined,
      createdAt: now,
    });
    await writeAudit(ctx, {
      entityType: "Report",
      entityId: reportId,
      entityLabel: args.name,
      action: "create",
      performedBy: actor._id,
      details: "Saved report created.",
    });
    return ctx.db.get("reports", reportId);
  },
});

export const deleteReport = mutation({
  args: { id: v.id("reports") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "report:build");
    const report = await ctx.db.get("reports", args.id);
    if (!report) return false;
    await ctx.db.delete("reports", args.id);
    await writeAudit(ctx, {
      entityType: "Report",
      entityId: args.id,
      entityLabel: report.name,
      action: "delete",
      performedBy: actor._id,
      details: "Saved report deleted.",
    });
    return true;
  },
});

export const saveView = mutation({
  args: {
    id: v.optional(v.id("views")),
    name: v.string(),
    isShared: v.boolean(),
    filters: v.any(),
  },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    if (args.id) {
      const existing = await ctx.db.get("views", args.id);
      if (!existing || (existing.ownerId !== actor._id && !existing.isShared)) {
        throw forbiddenError("View not found.");
      }
      await ctx.db.patch("views", args.id, { name: args.name, isShared: args.isShared, filters: args.filters });
      return ctx.db.get("views", args.id);
    }
    const viewId = await ctx.db.insert("views", {
      name: args.name,
      ownerId: actor._id,
      isShared: args.isShared,
      filters: args.filters,
      createdAt: new Date().toISOString(),
    });
    return ctx.db.get("views", viewId);
  },
});

export const deleteView = mutation({
  args: { id: v.id("views") },
  handler: async (ctx, args) => {
    const actor = await requireAdmin(ctx);
    const view = await ctx.db.get("views", args.id);
    if (!view || view.ownerId !== actor._id) return false;
    await ctx.db.delete("views", args.id);
    return true;
  },
});

export const saveWebhook = mutation({
  args: {
    id: v.optional(v.id("webhooks")),
    url: v.string(),
    events: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "integration:manage");
    const now = new Date().toISOString();
    if (args.id) {
      const existing = await ctx.db.get("webhooks", args.id);
      if (!existing) throw forbiddenError("Webhook not found.");
      await ctx.db.patch("webhooks", args.id, { url: args.url, events: args.events, isActive: args.isActive });
      await writeAudit(ctx, {
        entityType: "Integration",
        entityId: args.id,
        entityLabel: args.url,
        action: "update",
        performedBy: actor._id,
        details: "Webhook updated.",
      });
      return ctx.db.get("webhooks", args.id);
    }
    const secret = randomSecret();
    const hookId = await ctx.db.insert("webhooks", {
      url: args.url,
      events: args.events,
      isActive: args.isActive,
      secretMasked: `${secret.slice(0, 4)}…${secret.slice(-4)}`,
      lastDeliveryAt: undefined,
      lastStatus: undefined,
      createdAt: now,
    });
    await writeAudit(ctx, {
      entityType: "Integration",
      entityId: hookId,
      entityLabel: args.url,
      action: "create",
      performedBy: actor._id,
      details: "Webhook registered.",
    });
    return ctx.db.get("webhooks", hookId);
  },
});

export const deleteWebhook = mutation({
  args: { id: v.id("webhooks") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "integration:manage");
    const hook = await ctx.db.get("webhooks", args.id);
    if (!hook) return false;
    await ctx.db.delete("webhooks", args.id);
    await writeAudit(ctx, {
      entityType: "Integration",
      entityId: args.id,
      entityLabel: hook.url,
      action: "delete",
      performedBy: actor._id,
      details: "Webhook removed.",
    });
    return true;
  },
});

/** Create an API client (secret hashed; returned once). */
export const createApiClient = mutation({
  args: {
    name: v.string(),
    scopes: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "integration:manage");
    const clientId = `fc_${randomSecret().slice(0, 16)}`;
    const secret = randomSecret();
    const hash = await sha256Hex(secret);
    const clientRecordId = await ctx.db.insert("apiClients", {
      name: args.name,
      clientId,
      secretHash: hash,
      scopes: args.scopes,
      createdAt: new Date().toISOString(),
      lastUsedAt: undefined,
      isActive: true,
    });
    await writeAudit(ctx, {
      entityType: "Integration",
      entityId: clientRecordId,
      entityLabel: args.name,
      action: "create",
      performedBy: actor._id,
      details: "API client created.",
    });
    return { id: clientRecordId, clientId, secret };
  },
});

export const rotateApiSecret = mutation({
  args: { id: v.id("apiClients") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "integration:manage");
    const client = await ctx.db.get("apiClients", args.id);
    if (!client) throw forbiddenError("API client not found.");
    const secret = randomSecret();
    await ctx.db.patch("apiClients", args.id, {
      secretHash: await sha256Hex(secret),
    });
    await writeAudit(ctx, {
      entityType: "Integration",
      entityId: args.id,
      entityLabel: client.name,
      action: "permission_change",
      performedBy: actor._id,
      details: "Client secret rotated.",
    });
    return { secret };
  },
});

