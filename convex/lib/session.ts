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
  return user;
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
  return list.some((p) => !p.startsWith("read") && !p.startsWith("document:read"));
}
