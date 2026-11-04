/**
 * Seed script — idempotent. Creates the reference data (roles, departments,
 * courts, taxonomy and system settings), plus an optional initial Better Auth
 * administrator (from SEED_ADMIN_* env vars) so a deployment can be commissioned.
 *
 * Run: `npx convex run seed:run`
 */

import { action, internalMutation, internalQuery, env } from "./_generated/server";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { createAuth } from "./auth";
import { ROLES } from "./lib/permissions";

/** Internal mutation that does the actual reference-data seeding (idempotent). */
export const seedData = internalMutation({
  args: {
    organization: v.string(),
    departmentNames: v.array(v.string()),
    courtNames: v.array(v.object({ name: v.string(), division: v.string(), state: v.string(), address: v.string() })),
  },
  handler: async (ctx, args) => {
    // Guard: skip if already seeded.
    const meta = await ctx.db
      .query("counters")
      .withIndex("by_key", (q) => q.eq("key", "seed:meta"))
      .first();
    if (meta) {
      return { skipped: true };
    }

    const iso = new Date().toISOString();

    // Roles (the 7 system roles from the RBAC catalogue).
    for (const role of ROLES) {
      await ctx.db.insert("roles", {
        name: role.name,
        description: role.description,
        permissions: role.permissions,
        isSystem: role.isSystem,
      });
    }

    // System settings.
    await ctx.db.insert("systemSettings", {
      organizationName: args.organization,
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
    });

    // Departments.
    for (const name of args.departmentNames) {
      await ctx.db.insert("departments", {
        name,
        code: name.replace(/[^A-Za-z]/g, "").slice(0, 4).toUpperCase(),
        headUserId: undefined,
        caseCount: 0,
      });
    }

    // Courts.
    for (const court of args.courtNames) {
      await ctx.db.insert("courts", {
        name: court.name,
        division: court.division,
        state: court.state,
        address: court.address,
      });
    }

    // Taxonomy terms.
    const tags = ["Contracts", "Remediation", "Environmental Data", "Water & Sanitation", "Procurement", "Media Enquiry", "Health & Safety"];
    for (const tag of tags) {
      await ctx.db.insert("taxonomyTerms", { label: tag, kind: "tag", usageCount: 0 });
    }
    const outcomeCodes = ["Fully Granted", "Partially Granted", "Refused", "Withdrawn"];
    for (const code of outcomeCodes) {
      await ctx.db.insert("taxonomyTerms", { label: code, kind: "outcome_code", usageCount: 0 });
    }
    const closureReasons = ["Request satisfied", "Statutory exemption applied", "Request withdrawn"];
    for (const reason of closureReasons) {
      await ctx.db.insert("taxonomyTerms", { label: reason, kind: "closure_reason", usageCount: 0 });
    }
    const retentionLabels = ["7 years", "Permanent"];
    for (const label of retentionLabels) {
      await ctx.db.insert("taxonomyTerms", { label, kind: "retention_label", usageCount: 0 });
    }

    // Legal team.
    await ctx.db.insert("legalTeams", {
      name: "Legal Unit",
      leadUserId: undefined,
      memberIds: [],
      focus: "Freedom of Information & litigation",
    });

    // Mark seeded.
    await ctx.db.insert("counters", { key: "seed:meta", value: 1 });

    return { skipped: false, seededAt: iso };
  },
});

/** Find the app profile row linked to a Better Auth user id. */
export const findProfileByAuth = internalQuery({
  args: { authUserId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", args.authUserId))
      .first();
    return profile ? { _id: profile._id } : null;
  },
});

/** Promote a profile to super_admin. */
export const promoteToSuperAdmin = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const profile = await ctx.db.get("users", args.userId);
    if (!profile) return null;
    await ctx.db.patch("users", args.userId, {
      roleId: "super_admin",
      status: "active",
      organization: profile.organization || "HYPREP",
      updatedAt: new Date().toISOString(),
    });
    return ctx.db.get("users", args.userId);
  },
});

/**
 * Ensure a super_admin profile exists for a Better Auth user, creating the
 * app `users` row if the trigger missed it (e.g. the user was created before
 * the trigger was deployed). Idempotent.
 */
export const ensureSuperAdminProfile = internalMutation({
  args: {
    authUserId: v.string(),
    name: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_auth_user", (q) => q.eq("authUserId", args.authUserId))
      .first();
    const now = new Date().toISOString();
    if (existing) {
      await ctx.db.patch("users", existing._id, {
        roleId: "super_admin",
        status: "active",
        organization: existing.organization || "HYPREP",
        updatedAt: now,
      });
      return ctx.db.get("users", existing._id);
    }
    const initials = args.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("");
    const id = await ctx.db.insert("users", {
      authUserId: args.authUserId,
      name: args.name,
      email: args.email.toLowerCase(),
      roleId: "super_admin",
      organization: "HYPREP",
      status: "active",
      avatarColor: "bg-brand-600",
      initials,
      mfaEnabled: false,
      createdAt: now,
      updatedAt: now,
    });
    return ctx.db.get("users", id);
  },
});

/** Public entry point: run the seed with defaults. */
export const run = action({
  args: {
    organization: v.optional(v.string()),
    departmentNames: v.optional(v.array(v.string())),
    courtNames: v.optional(
      v.array(v.object({ name: v.string(), division: v.string(), state: v.string(), address: v.string() })),
    ),
  },
  handler: async (ctx, args): Promise<{ skipped: boolean; seededAt?: string }> => {
    const departments = args.departmentNames ?? [
      "Legal Unit",
      "Procurement",
      "Monitoring & Evaluation",
      "Water & Sanitation",
      "Community Relations",
      "Finance",
    ];
    const courts = args.courtNames ?? [
      { name: "Federal High Court, Port Harcourt", division: "Federal High Court", state: "Rivers", address: "Hospital Road, Port Harcourt" },
      { name: "High Court of Rivers State", division: "High Court", state: "Rivers", address: "Port Harcourt" },
      { name: "Federal High Court, Abuja", division: "Federal High Court", state: "FCT", address: "Central District, Abuja" },
    ];

    const result = await ctx.runMutation(internal.seed.seedData, {
      organization: args.organization ?? "Hydrocarbon Pollution Remediation Project (HYPREP)",
      departmentNames: departments,
      courtNames: courts,
    });

    // Seed the initial administrator into Better Auth when commissioning a deployment.
    const email = (env.SEED_ADMIN_EMAIL ?? "ibrahim.sanusi@hyprep.gov.ng").toLowerCase();
    const password = env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!";
    const name = env.SEED_ADMIN_NAME ?? "Ibrahim Sanusi";

    try {
      const auth = createAuth(ctx as never, { allowSystemProvisioning: true });
      const signup = await auth.api.signUpEmail({
        body: { email, password, name },
        headers: new Headers(),
      });
      if (signup && signup.user) {
        // Ensure the app profile exists (creates it if the trigger missed it)
        // and is a super_admin.
        await ctx.runMutation(internal.seed.ensureSuperAdminProfile, {
          authUserId: signup.user.id,
          name: signup.user.name ?? name,
          email: signup.user.email ?? email,
        });
        console.log(`[seed] Better Auth admin ready: ${email}`);
      }
    } catch (e) {
      // The user may already exist (from a previous run). Look it up via the
      // component's internal adapter `findOne` and promote the linked profile.
      const existing = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "email", operator: "eq", value: email }],
      })) as unknown as { _id?: string; name?: string; email?: string } | null;
      const found = existing;
      if (found?._id) {
        await ctx.runMutation(internal.seed.ensureSuperAdminProfile, {
          authUserId: found._id,
          name: found.name ?? name,
          email: found.email ?? email,
        });
        console.log(`[seed] Better Auth admin already existed; profile ensured: ${email}`);
      } else {
        console.warn("[seed] Better Auth admin creation skipped:", e);
      }
    }

    return result;
  },
});
