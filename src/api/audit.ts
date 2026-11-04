import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { AccessLog, AuditLog, Paginated } from '@/types'
import { mapAccessLog, mapAuditLog } from './transform'

export interface AuditQuery {
  q?: string
  actions?: string[]
  severities?: string[]
  actorIds?: string[]
  entityTypes?: string[]
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export function useAuditLogs(options: AuditQuery = {}, enabled = true): Paginated<AuditLog> | undefined {
  const result = useQuery(api.queries.audit.listAuditLogs, enabled ? options : 'skip') as
    | { rows: unknown[]; total: number; page: number; pageSize: number; pageCount: number }
    | undefined
  return result ? { ...result, rows: result.rows.map(mapAuditLog) } : undefined
}

export function useAccessLogs(options: { q?: string; action?: string; page?: number; pageSize?: number } = {}, enabled = true): Paginated<AccessLog> | undefined {
  const result = useQuery(api.queries.audit.listAccessLogs, enabled ? options : 'skip') as
    | { rows: unknown[]; total: number; page: number; pageSize: number; pageCount: number }
    | undefined
  return result ? { ...result, rows: result.rows.map(mapAccessLog) } : undefined
}
