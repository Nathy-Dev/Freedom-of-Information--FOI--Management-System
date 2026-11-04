import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware, getIp, isAPIError } from "better-auth/api";
import { twoFactor } from "better-auth/plugins/two-factor";
import { jwt } from "better-auth/plugins/jwt";
import { genericOAuth } from "better-auth/plugins/generic-oauth";
import { createClient } from "@convex-dev/better-auth";
import { convex as convexPlugin } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth";
import { components, internal } from "./_generated/api";
import { v } from "convex/values";
import { internalQuery, mutation, internalMutation } from "./_generated/server";
import authConfig from "./auth.config";
import { SYSTEM_ACTOR_ID, writeAudit } from "./lib/audit";

const AUTH_AUDIT_PATHS = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/sign-in/social",
  "/sign-out",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/verify-totp",
  "/two-factor/verify-backup-code",
  "/change-password",
]);

const authAuditAction = v.union(
  v.literal("create"),
  v.literal("login"),
  v.literal("login_failed"),
  v.literal("logout"),
  v.literal("permission_change"),
);

/** The public registration switch is read by the Better Auth HTTP hook. */
export const selfRegistrationEnabled = internalQuery({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const settings = await ctx.db.query("systemSettings").first();
    return settings?.selfRegistrationEnabled ?? false;
  },
});

/** Writes auth events to the app audit table and keeps the app MFA flag in sync. */
export const recordAuthEvent = internalMutation({
  args: {
    action: authAuditAction,
    entityType: v.string(),
    entityId: v.string(),
    entityLabel: v.string(),
    authUserId: v.optional(v.string()),
    email: v.optional(v.string()),
    details: v.string(),
    ipAddress: v.string(),
    userAgent: v.string(),
    mfaEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const profile = args.authUserId
      ? await ctx.db
          .query("users")
          .withIndex("by_auth_user", (q) => q.eq("authUserId", args.authUserId!))
          .first()
      : args.email
        ? await ctx.db
            .query("users")
            .withIndex("by_email", (q) => q.eq("email", args.email!.toLowerCase()))
            .first()
        : null;

    if (profile && args.mfaEnabled !== undefined) {
      await ctx.db.patch("users", profile._id, {
        mfaEnabled: args.mfaEnabled,
        updatedAt: new Date().toISOString(),
      });
    }

    await writeAudit(ctx, {
      entityType: args.entityType,
      entityId: args.entityId,
      entityLabel: args.entityLabel,
      action: args.action,
      performedBy: args.action === "login_failed" ? SYSTEM_ACTOR_ID : profile?._id ?? SYSTEM_ACTOR_ID,
      details: args.details,
      ipAddress: args.ipAddress,
      userAgent: args.userAgent,
    });
    return null;
  },
});

/**
 * Better Auth + Convex wiring (user-resolved choice: `better-auth` with the
 * `@convex-dev/better-auth` component and its Convex database adapter).
 *
 * - The component owns the auth tables (user, session, account, verification,
 *   twoFactor, ...) and exposes the adapter + HTTP routes.
 * - This file builds the Better Auth instance with the plugins the ToR needs:
 *   two-factor (TOTP, FR-002), jwt (RS256 tokens validated by Convex's
 *   `ctx.auth`), generic-oauth (Entra ID / OIDC SSO, FR-002), and admin
 *   (invite / ban / manage users, FR-001).
 * - A trigger keeps the app `users` profile table in sync: when Better Auth
 *   creates a `user`, we create the linked `users` profile row (default role
 *   `requestor`); admins later assign roles.
 */

export const authComponent = createClient(components.betterAuth, {
  triggers: {
    user: {
      async onCreate(ctx: import("./_generated/server").MutationCtx, doc) {
        const now = new Date().toISOString();
        // `phone`/`organization` come from the self-registration form via
        // Better Auth additionalFields; absent for SSO/CSV-created users.
        const extra = doc as { phone?: string; organization?: string };
        // Email verification is not required (ToR allows filing immediately
        // after registration), so a fresh account is active, not invited.
        await ctx.db.insert("users", {
          authUserId: doc._id,
          name: doc.name,
          email: doc.email,
          roleId: "requestor",
          phone: extra.phone || undefined,
          organization: extra.organization ?? "",
          status: "active",
          avatarColor: "bg-brand-600",
          initials: doc.name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((p) => p[0]!.toUpperCase())
            .join(""),
          mfaEnabled: false,
          createdAt: now,
          updatedAt: now,
        });
      },
      async onUpdate(ctx: import("./_generated/server").MutationCtx, newDoc, _oldDoc) {
        if (!newDoc) return;
        const profile = await ctx.db
          .query("users")
          .withIndex("by_auth_user", (q) => q.eq("authUserId", newDoc._id))
          .first();
        if (profile) {
          await ctx.db.patch("users", profile._id, {
            name: newDoc.name,
            email: newDoc.email,
            updatedAt: new Date().toISOString(),
          });
        }
      },
    },
  },
  authFunctions: {},
});

/** The Better Auth instance factory — used by the HTTP handler and `getAuth`. */
export const createAuth = (ctx: GenericCtx, options: { allowSystemProvisioning?: boolean } = {}) => {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    throw new Error("BETTER_AUTH_SECRET is not configured");
  }
  return betterAuth({
    secret,
    baseURL: process.env.BETTER_AUTH_URL,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
    },
    advanced: {
      ipAddress: {
        // Convex deployments and reverse proxies commonly use one of these
        // headers. Better Auth uses the first valid value for rate limiting
        // and session tracking.
        ipAddressHeaders: ["x-forwarded-for", "x-real-ip", "cf-connecting-ip", "x-client-ip"],
      },
    },
    hooks: {
      before: createAuthMiddleware(async (hookContext) => {
        if (options.allowSystemProvisioning || hookContext.path !== "/sign-up/email") return;

        const enabled = await ctx.runQuery(internal.auth.selfRegistrationEnabled, {});
        if (!enabled) {
          throw new APIError("FORBIDDEN", {
            message: "Public self-registration is currently disabled.",
            code: "SELF_REGISTRATION_DISABLED",
          });
        }
      }),
      after: createAuthMiddleware(async (hookContext) => {
        const path = hookContext.path;
        if (!AUTH_AUDIT_PATHS.has(path)) return;

        const returned = hookContext.context.returned;
        const failed = isAPIError(returned) || (returned instanceof Response && returned.status >= 400);
        const body =
          typeof hookContext.body === "object" && hookContext.body !== null
            ? (hookContext.body as Record<string, unknown>)
            : {};
        const sessionUser = hookContext.context.newSession?.user ?? hookContext.context.session?.user;
        const email = sessionUser?.email ?? (typeof body.email === "string" ? body.email : undefined);
        const authUserId = sessionUser?.id;
        const entityId = authUserId ?? email ?? "unknown";
        const entityLabel = email ?? authUserId ?? "Unknown user";
        let action: "create" | "login" | "login_failed" | "logout" | "permission_change" | undefined;
        let entityType = "Session";
        let details = "";
        let mfaEnabled: boolean | undefined;

        if (path === "/sign-up/email") {
          if (failed) return;
          action = "create";
          entityType = "User";
          details = "Account created and signed in.";
        } else if (path.startsWith("/sign-in/")) {
          action = failed ? "login_failed" : "login";
          details = failed ? "Sign-in attempt failed." : "Signed in successfully.";
        } else if (path === "/sign-out") {
          action = "logout";
          details = failed ? "Sign-out attempt failed." : "Signed out.";
        } else if (path === "/two-factor/enable") {
          action = "permission_change";
          entityType = "User";
          details = failed ? "MFA enrollment attempt failed." : "MFA enrollment started.";
        } else if (path === "/two-factor/disable") {
          action = "permission_change";
          entityType = "User";
          details = failed ? "MFA disable attempt failed." : "MFA disabled.";
          if (!failed) mfaEnabled = false;
        } else if (path === "/two-factor/verify-totp" || path === "/two-factor/verify-backup-code") {
          action = failed ? "login_failed" : "login";
          entityType = "User";
          details = failed ? "Second-factor verification failed." : "Second-factor verification succeeded.";
          if (!failed && path === "/two-factor/verify-totp") mfaEnabled = true;
        } else if (path === "/change-password") {
          action = "permission_change";
          entityType = "User";
          details = failed ? "Password change attempt failed." : "Password changed.";
        }

        if (!action || !("runMutation" in ctx)) return;

        try {
          await ctx.runMutation(internal.auth.recordAuthEvent, {
            action,
            entityType,
            entityId,
            entityLabel,
            authUserId,
            email,
            details,
            ipAddress: hookContext.request ? getIp(hookContext.request, hookContext.context.options) ?? "" : "",
            userAgent: hookContext.request?.headers.get("user-agent") ?? "",
            mfaEnabled,
          });
        } catch (error) {
          // Auditing must not turn a successful authentication response into a
          // 500, but the failure remains visible in the Convex function logs.
          console.error("[audit] Could not record auth event", error);
        }
      }),
    },
    // Self-registration (ToR §31): the public requestor form collects the
    // applicant's phone and organisation. Because the `@convex-dev/better-auth`
    // component has a strict internal schema that cannot be extended with `additionalFields`,
    // we don't declare them here. Instead, the frontend calls `updateMyProfile`
    // immediately after `signUp.email` to persist these fields in the app's `users` table.
    trustedOrigins: [
      process.env.BETTER_AUTH_URL as string,
      ...(process.env.FRONTEND_ORIGINS ?? "http://localhost:5173")
        .split(",")
        .map((origin) => origin.trim()),
    ].filter(Boolean),
    plugins: [
      twoFactor({ issuer: "FOI-HYPREP" }),
      jwt({
        jwks: {
          keyPairConfig: {
            alg: "RS256",
            modulusLength: 2048,
          },
        },
      }),
      genericOAuth({
        config: [
          {
            providerId: "microsoft-entra-id",
            clientId: process.env.ENTRA_ID_CLIENT_ID ?? "",
            clientSecret: process.env.ENTRA_ID_CLIENT_SECRET ?? "",
            scopes: ["openid", "email", "profile"],
          },
        ],
      }),
      convexPlugin({ authConfig }),
    ],
  });
};

/** Exposed helpers (component API). */
export const getAuth = authComponent.getAuth;
export const safeGetAuthUser = authComponent.safeGetAuthUser;
export const getAuthUser = authComponent.getAuthUser;
export const getHeaders = authComponent.getHeaders;
export const clientApi = authComponent.clientApi();

/**
 * Update the current user's profile with fields that couldn't be saved
 * during the strict `betterAuth` sign-up flow.
 */
export const updateMyProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    organization: v.optional(v.string()),
    position: v.optional(v.string()),
    department: v.optional(v.string()),
    mfaEnabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const authUser = await safeGetAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", authUser._id))
      .first();
    if (!user) throw new Error("User profile not found");
    
    await ctx.db.patch("users", user._id, {
      ...(args.name !== undefined ? { name: args.name } : {}),
      ...(args.phone !== undefined ? { phone: args.phone || undefined } : {}),
      ...(args.organization !== undefined ? { organization: args.organization } : {}),
      ...(args.position !== undefined ? { position: args.position || undefined } : {}),
      ...(args.department !== undefined ? { department: args.department || undefined } : {}),
      ...(args.mfaEnabled !== undefined ? { mfaEnabled: args.mfaEnabled } : {}),
      updatedAt: new Date().toISOString(),
    });
    return null;
  },
});

/**
 * Ensure the signed-in Better Auth identity has an application profile.
 *
 * This is intentionally idempotent: it repairs accounts created before the
 * profile trigger was installed without changing an existing role or profile.
 */
export const ensureMyProfile = mutation({
  args: {},
  handler: async (ctx) => {
    const authUser = await safeGetAuthUser(ctx);
    if (!authUser) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", authUser._id))
      .first();
    if (existing) return existing;

    const now = new Date().toISOString();
    const name = authUser.name || authUser.email || "Unknown";
    const id = await ctx.db.insert("users", {
      authUserId: authUser._id,
      name,
      email: authUser.email,
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
  },
});
