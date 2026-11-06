"use node";

import { internalAction } from '../_generated/server';
import { internal } from '../_generated/api';
import { v } from 'convex/values';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { exportTables } from '../internal/backupDb';

export const createArchive = internalAction({
  args: { id: v.id('backups') },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    try {
      const chunks: string[] = [JSON.stringify({ manifest: 'hyprep-domain-export-v1', createdAt: new Date().toISOString(), includes: 'Application records and document metadata', excludes: ['File bytes', 'Authentication', 'Integration secrets', 'Atomic point-in-time snapshot'], restoreFormat: 'Not directly importable; use a Convex platform snapshot for recovery' })];
      let bytes = 0;
      for (const table of exportTables) {
        let cursor: string | null = null;
        do {
          const result: { page: unknown[]; isDone: boolean; continueCursor: string } = await ctx.runQuery(internal.internal.backupDb.page, { table, paginationOpts: { cursor, numItems: 100 } });
          const chunk = JSON.stringify({ table, rows: result.page });
          bytes += Buffer.byteLength(chunk);
          if (bytes > 20 * 1024 * 1024) throw new Error('This export exceeds 20 MB. Use a Convex platform snapshot.');
          chunks.push(chunk);
          cursor = result.isDone ? null : result.continueCursor;
        } while (cursor);
      }
      const archive = gzipSync(chunks.join('\n'), { level: 6 });
      const storageId = await ctx.storage.store(new Blob([archive], { type: 'application/gzip' }));
      await ctx.runMutation(internal.internal.backupDb.finish, { id: args.id, storageId, sizeMb: archive.byteLength / 1048576, checksum: createHash('sha256').update(archive).digest('hex') });
    } catch (error) {
      await ctx.runMutation(internal.internal.backupDb.finish, { id: args.id, sizeMb: 0, error: error instanceof Error ? error.message.slice(0, 400) : 'Archive creation failed.' });
    }
    return null;
  },
});
