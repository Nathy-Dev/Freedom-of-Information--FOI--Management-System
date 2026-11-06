/**
 * Session + authorization helpers used by every query/mutation/action.
 *
 * Edge cases handled explicitly:
 * - No session / revoked session            → UNAUTHENTICATED
 * - Suspended / locked / unverified account → FORBIDDEN with reason
 * - Missing app profile row (auth drift)    → auto-repair or FORBIDDEN
 * - Permission missing                      → FORBIDDEN naming the permission
 * - Read-only roles on writes               → FORBIDDEN
 */

import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { hasPermission, isReadOnly, type Permission } from "./permissions";
import { components } from "../_generated/api";

export type AppUser = Doc<"users">;

/** Database-backed contexts (queries and mutations). */
type DbCtx = QueryCtx | MutationCtx;

/**
 * Fetch the app profile for the current auth identity from a query or mutation
 * context, or null. Pure lookup — no writes (safe for query contexts).
 */
export async function getCurrentUser(ctx: DbCtx): Promise<AppUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const session = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "session", where: [{ field: "_id", value: String(identity.sessionId ?? "") }, { field: "expiresAt", operator: "gt", value: Date.now() }] });
  if (!session || session.userId !== identity.subject) return null;
  const projection = await ctx.db.query("userSessions").withIndex("by_session", (query) => query.eq("authSessionId", String(identity.sessionId ?? ""))).unique();
  const settings = await ctx.db.query("systemSettings").first();
  if (settings?.sessionTimeoutMinutes && Date.now() - (projection?.lastSeenAt ?? session.createdAt) > settings.sessionTimeoutMinutes * 60000) return null;

  return ctx.db
    .query("users")
    .withIndex("by_auth_user", (q) => q.eq("authUserId", identity.subject))
    .first();
}

/**
 * Mutation-only variant that auto-repairs a missing profile row (auth drift:
 * e.g. the user was created before this app deployed its trigger).
 */
export async function ensureCurrentUser(ctx: MutationCtx): Promise<AppUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const existing = await ctx.db
    .query("users")
    .withIndex("by_auth_user", (q) => q.eq("authUserId", identity.subject))
    .first();
  if (existing) return existing;

  const name = identity.name || identity.email || "Unknown";
  const now = new Date().toISOString();
  const id = await ctx.db.insert("users", {
    authUserId: identity.subject,
    name,
    email: identity.email ?? "",
    roleId: "requestor",
    organization: "",
    status: "active",
    avatarColor: "bg-brand-600",
    initials: name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join(""),
    mfaEnabled: false,
    createdAt: now,
    updatedAt: now,
  });
  return ctx.db.get("users", id);
}

/** Read-only identity lookup for actions (no ctx.db). */
export async function getCurrentIdentity(ctx: ActionCtx): Promise<{
  subject: string;
  email?: string;
  name?: string;
} | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return {
    subject: identity.subject,
    email: identity.email,
    name: identity.name,
  };
}

export function requireAuthError(): ConvexError<{ code: "UNAUTHENTICATED" }> {
  return new ConvexError({ code: "UNAUTHENTICATED", message: "Sign in to continue." });
}

export function forbiddenError(reason = "You do not have permission to perform this action.") {
  return new ConvexError({ code: "FORBIDDEN", message: reason });
}

function assertActive(user: AppUser) {
  if (user.status === "suspended") {
    throw forbiddenError("This account is suspended. Contact the system administrator.");
  }
  if (user.status === "locked") {
    throw forbiddenError("This account is locked due to failed sign-in attempts.");
  }
  if (user.status === "invited") {
    throw forbiddenError("This account has not been activated. Use the link in your invitation email.");
  }
}

/** Require a signed-in user (query/mutation context). */
export async function requireUser(ctx: DbCtx): Promise<AppUser> {
  const user = await getCurrentUser(ctx);
  if (!user) throw requireAuthError();
  assertActive(user);
  if (await sessionSecurityRequirement(ctx, user)) throw forbiddenError("Complete the required security update in My Profile before using the system.");
  return user;
}

export async function securityRequirement(ctx: DbCtx, user: AppUser): Promise<string | null> {
  if (user.status !== "active") return null;
  const settings = await ctx.db.query("systemSettings").first();
  const privileged = ["super_admin", "admin", "legal", "clerk"].includes(user.roleId);
  const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "user", where: [{ field: "_id", value: user.authUserId }] });
  if ((user.mfaRequired || (settings?.mfaRequiredForPrivileged && privileged)) && !authUser?.twoFactorEnabled) return "Enrol your authenticator app in My Profile to continue.";
  if (settings?.passwordRotationDays && user.passwordChangedAt && Date.now() - Date.parse(user.passwordChangedAt) > settings.passwordRotationDays * 86400000) return "Change your expired password in My Profile to continue.";
  return null;
}

export async function sessionSecurityRequirement(ctx: DbCtx, user: AppUser, sessionId?: string): Promise<string | null> {
  const requirement = await securityRequirement(ctx, user);
  if (requirement || user.status !== "active") return requirement;
  const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "user", where: [{ field: "_id", value: user.authUserId }] });
  if (!authUser?.twoFactorEnabled) return null;
  const identity = await ctx.auth.getUserIdentity();
  const session = await ctx.db.query("userSessions").withIndex("by_session", (query) => query.eq("authSessionId", sessionId ?? String(identity?.sessionId ?? ""))).unique();
  return session?.secondFactorVerifiedAt ? null : "Enter an authenticator code in My Profile to verify this session.";
}

/** Require a signed-in user holding every listed permission. */
export async function requirePermission(
  ctx: DbCtx,
  permission: Permission | Permission[],
  mode: "any" | "all" = "any",
): Promise<AppUser> {
  const user = await requireUser(ctx);
  if (isReadOnly(user.roleId) && isWritePermission(permission)) {
    throw forbiddenError("This role is read-only.");
  }
  if (!hasPermission(user.roleId, permission, mode)) {
    const names = Array.isArray(permission) ? permission.join(", ") : permission;
    throw forbiddenError(`Requires permission: ${names}.`);
  }
  return user;
}

/** Convenience: throw if the user is not an admin/super-admin. */
export async function requireAdmin(ctx: DbCtx): Promise<AppUser> {
  const user = await requireUser(ctx);
  if (user.roleId !== "admin" && user.roleId !== "super_admin") {
    throw forbiddenError("Requires the Admin role.");
  }
  return user;
}

function isWritePermission(permission: Permission | Permission[]): boolean {
  const list = Array.isArray(permission) ? permission : [permission];
  return list.some((permission) => !permission.split(":").includes("read") && !permission.endsWith(":download") && !permission.endsWith(":export"));
}
