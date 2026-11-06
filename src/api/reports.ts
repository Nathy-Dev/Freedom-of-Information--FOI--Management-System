/**
 * Reports API adapter — hooks wrapping the Convex report queries + mutations.
 */
import { useQuery, useMutation, useAction } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { ReportFilters, SavedReport } from '@/types'
import { mapReport, mapView } from './transform'

/** FR-050: list saved reports. */
export function useReports(): SavedReport[] | undefined {
  const result = useQuery(api.queries.reports.list, {}) as unknown[] | undefined
  return result?.map(mapReport)
}

/** Get a single saved report. */
export function useReport(id: string): SavedReport | null | undefined {
  const result = useQuery(api.queries.reports.get, { id: id as never }) as unknown
  return result == null ? result : mapReport(result)
}

export function useViews(enabled = true) {
  const result = useQuery(api.queries.reports.views, enabled ? {} : 'skip') as unknown[] | undefined
  return result?.map(mapView)
}

export interface ReportRunResult {
  error?: string
  groupBy: string
  metrics: string[]
  rows: Array<Record<string, unknown>>
  total: number
  generatedAt: string
}

/** Reactive report run (for the builder's live preview). */
export function useReportRun(filters: ReportFilters): ReportRunResult | undefined {
  return useQuery(api.queries.reports.run, { filters: filters as never }) as
    | ReportRunResult
    | undefined
}

/** Save a report (create/update). */
export function useSaveReport() {
  const mutate = useMutation(api.mutations.admin.saveReport)
  return (input: {
    id?: string
    name: string
    description: string
    filters: ReportFilters
    cadence: SavedReport['cadence']
    recipients: string[]
    format: SavedReport['format']
  }) =>
    mutate({
      id: input.id as never,
      name: input.name,
      description: input.description,
      filters: input.filters as never,
      cadence: input.cadence,
      recipients: input.recipients,
      format: input.format,
    })
}

/** Delete a saved report. */
export function useDeleteReport() {
  const mutate = useMutation(api.mutations.admin.deleteReport)
  return (id: string) => mutate({ id: id as never })
}

export function useDeleteView() {
  const mutate = useMutation(api.mutations.admin.deleteView)
  return (id: string) => mutate({ id: id as never })
}

/** Save a view (saved filter). */
export function useSaveView() {
  const mutate = useMutation(api.mutations.admin.saveView)
  return (input: { id?: string; name: string; isShared: boolean; filters: unknown }) =>
    mutate({ id: input.id as never, name: input.name, isShared: input.isShared, filters: input.filters })
}

/** Export a report as CSV via the export action. */
export function useExport() {
  const run = useAction(api.actions.export.exportData)
  return (scope: 'cases' | 'documents' | 'users' | 'audit' | 'court_dates') => run({ scope })
}
