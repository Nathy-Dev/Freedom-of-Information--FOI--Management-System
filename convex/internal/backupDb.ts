import { internalQuery, internalMutation } from '../_generated/server';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

export const exportTables = ['users', 'roles', 'requestors', 'departments', 'courts', 'legalTeams', 'taxonomyTerms', 'organizations', 'cases', 'documents', 'documentVersions', 'notes', 'timeline', 'courtDates', 'tasks', 'notifications', 'notificationPreferences', 'notificationDeliveries', 'auditLogs', 'accessLogs', 'templates', 'reports', 'reportRuns', 'views', 'systemSettings', 'backups', 'importBatches', 'serviceHealth', 'counters'] as const;

export const page = internalQuery({
  args: { table: v.union(...exportTables.map((table) => v.literal(table))), paginationOpts: paginationOptsValidator },
  returns: v.object({ page: v.array(v.any()), isDone: v.boolean(), continueCursor: v.string() }),
  handler: async (ctx, args) => {
    const result = await ctx.db.query(args.table).paginate({ ...args.paginationOpts, numItems: Math.min(100, args.paginationOpts.numItems), maximumBytesRead: 500000 });
    return { page: result.page, isDone: result.isDone, continueCursor: result.continueCursor };
  },
});

export const finish = internalMutation({
  args: { id: v.id('backups'), storageId: v.optional(v.id('_storage')), sizeMb: v.number(), checksum: v.optional(v.string()), error: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const backup = await ctx.db.get(args.id);
    if (!backup) return null;
    await ctx.db.patch(args.id, { status: args.error ? 'failed' : 'success', storageId: args.storageId, sizeMb: args.sizeMb, checksum: args.checksum, error: args.error, completedAt: new Date().toISOString() });
    return null;
  },
});
