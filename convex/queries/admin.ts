/**
 * Admin read queries (FR-001 → FR-005, FR-003a, ToR §17).
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission, getCurrentUser, sessionSecurityRequirement } from "../lib/session";
import { entraConfigured } from "../lib/entraSettings";

export const listUsers = query({
  args: {
    q: v.optional(v.string()),
    roleIds: v.optional(v.array(v.string())),
    statuses: v.optional(v.array(v.string())),
    departments: v.optional(v.array(v.string())),
    page: v.optional(v.number()),
    pageSize: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "user:read");
    const page = Math.max(1, args.page ?? 1);
    const pageSize = Math.min(Math.max(1, args.pageSize ?? 20), 200);
    const needle = args.q?.trim().toLowerCase();

    const rows = await ctx.db.query("users").withIndex("by_status").take(2000);
    const filtered = rows.filter((u) => {
      if (args.roleIds?.length && !args.roleIds.includes(u.roleId)) return false;
      if (args.statuses?.length && !args.statuses.includes(u.status)) return false;
      if (args.departments?.length && !args.departments.includes(u.department ?? "")) return false;
      if (needle) {
        const haystack = `${u.name} ${u.email} ${u.organization} ${u.position ?? ""} ${u.department ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    const total = sorted.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(page, pageCount);
    const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
    return { rows: pageRows, total, page: safePage, pageSize, pageCount };
  },
});

export const roles = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "role:manage");
    return ctx.db.query("roles").take(100);
  },
});

/** Organisation reference data (departments, courts, teams, taxonomy). */
export const reference = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await getCurrentUser(ctx);
    if (!currentUser || currentUser.status !== "active" || await sessionSecurityRequirement(ctx, currentUser)) return null;
    const [departments, courts, legalTeams, tags, outcomeCodes, closureReasons, retentionLabels, users] =
      await Promise.all([
        ctx.db.query("departments").take(500),
        ctx.db.query("courts").take(500),
        ctx.db.query("legalTeams").take(200),
        ctx.db.query("taxonomyTerms").withIndex("by_kind", (q) => q.eq("kind", "tag")).take(500),
        ctx.db.query("taxonomyTerms").withIndex("by_kind", (q) => q.eq("kind", "outcome_code")).take(500),
        ctx.db.query("taxonomyTerms").withIndex("by_kind", (q) => q.eq("kind", "closure_reason")).take(500),
        ctx.db.query("taxonomyTerms").withIndex("by_kind", (q) => q.eq("kind", "retention_label")).take(500),
        currentUser.roleId === "requestor" || currentUser.roleId === "external" ? Promise.resolve([]) : ctx.db.query("users").withIndex("by_status", (query) => query.eq("status", "active")).take(500),
      ]);
    const assignableStaff = users.filter(
      (user) => (user.roleId === "legal" || user.roleId === "admin") && user.status === "active",
    );
    return { departments, courts, legalTeams, tags, outcomeCodes, closureReasons, retentionLabels, assignableStaff };
  },
});

export const systemSettings = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, ["system:settings", "system:monitor", "user:read"], "any");
    const doc = await ctx.db.query("systemSettings").first();
    return doc ?? null;
  },
});

/** Public subset needed before sign-in for registration and password recovery. */
export const publicSettings = query({
  args: {},
  handler: async (ctx) => {
    const doc = await ctx.db.query("systemSettings").first();
    if (!doc) return null;
    return {
      passwordMinLength: doc.passwordMinLength,
      passwordRotationDays: doc.passwordRotationDays,
      selfRegistrationEnabled: doc.selfRegistrationEnabled,
      sessionTimeoutMinutes: doc.sessionTimeoutMinutes,
      ssoEnabled: doc.ssoEnabled && entraConfigured(process.env),
    };
  },
});

export const serviceHealth = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "system:monitor");
    return ctx.db.query("serviceHealth").take(100);
  },
});

export const backups = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "system:backup");
    const rows = await ctx.db.query("backups").order("desc").take(100);
    return rows;
  },
});

export const webhooks = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "integration:manage");
    return ctx.db.query("webhooks").take(100);
  },
});

export const apiClients = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "integration:manage");
    return ctx.db.query("apiClients").take(100);
  },
});
