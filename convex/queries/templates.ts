/**
 * Letter templates read queries (FR-033).
 */

import { query } from "../_generated/server";
import { v } from "convex/values";
import { requirePermission } from "../lib/session";

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "template:read");
    return ctx.db.query("templates").take(200);
  },
});

export const get = query({
  args: { id: v.id("templates") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "template:read");
    return ctx.db.get("templates", args.id);
  },
});
