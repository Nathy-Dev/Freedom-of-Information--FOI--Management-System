/**
 * Auth/identity queries.
 */

import { query } from "../_generated/server";
import { getCurrentUser, sessionSecurityRequirement } from "../lib/session";
import { components } from "../_generated/api";
import { getRole, homeRouteFor, isReadOnly, permissionsFor } from "../lib/permissions";

/** Current signed-in user + role + permissions (used by AuthContext). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    const roleId = user.roleId;
    const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, { model: "user", where: [{ field: "_id", value: user.authUserId }] });
    return {
      user: { ...user, mfaEnabled: authUser?.twoFactorEnabled === true },
      securityRequired: await sessionSecurityRequirement(ctx, user),
      role: getRole(roleId),
      permissions: permissionsFor(roleId),
      isReadOnly: isReadOnly(roleId),
      homeRoute: homeRouteFor(roleId),
    };
  },
});

/** Team member ids for the current user (row-scoping support). Anonymous-safe. */
export const teamMemberIds = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user || user.status !== "active" || await sessionSecurityRequirement(ctx, user)) return [];
    if (!user.teamId) return [];
    // legalTeams is bounded reference data; fetch all and match by id.
    const all = await ctx.db.query("legalTeams").take(200);
    const match = all.find((t) => t._id === (user.teamId as never));
    return match?.memberIds ?? [];
  },
});
