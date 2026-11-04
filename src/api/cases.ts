/**
 * Cases API adapter — hooks wrapping the Convex case queries + mutations.
 * Return shapes match the client domain model while Convex remains the source
 * of truth for every read and write.
 */
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { CaseFilters, CaseNote, CaseTask, CourtDate, FoiCase, FoiDocument, Paginated, TimelineEvent } from '@/types'
import { mapCase, mapCourtDate, mapDocument, mapNote, mapTask, mapTimeline } from './transform'

export interface CaseBundle {
  foiCase: FoiCase
  documents: FoiDocument[]
  notes: CaseNote[]
  tasks: CaseTask[]
  courtDates: CourtDate[]
  timeline: TimelineEvent[]
  linked: FoiCase[]
}

export interface ListCasesArgs {
  filters?: CaseFilters
  page?: number
  pageSize?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
}

/** FR-020: reactive case list. */
export function useListCases(args: ListCasesArgs = {}, enabled = true): Paginated<FoiCase> | undefined {
  const result = useQuery(api.queries.cases.list, enabled ? {
    filters: (args.filters ?? {}) as never,
    page: args.page ?? 1,
    pageSize: args.pageSize ?? 20,
    sortBy: args.sortBy,
    sortDir: args.sortDir,
  } : 'skip') as Paginated<unknown> | undefined
  return result ? { ...result, rows: result.rows.map(mapCase) } : undefined
}

/** FR-021: reactive single case. */
export function useCase(id: string): FoiCase | null | undefined {
  const result = useQuery(api.queries.cases.get, { id: id as never }) as unknown
  return result == null ? result : mapCase(result)
}

/** FR-021: reactive case bundle. */
export function useCaseBundle(id: string): CaseBundle | null | undefined {
  const result = useQuery(api.queries.cases.getBundle, { id: id as never }) as
    | { foiCase: unknown; documents: unknown[]; notes: unknown[]; tasks: unknown[]; courtDates: unknown[]; timeline: unknown[]; linked: unknown[] }
    | null
    | undefined
  if (!result) return result
  return {
    foiCase: mapCase(result.foiCase),
    documents: result.documents.map(mapDocument),
    notes: result.notes.map(mapNote),
    tasks: result.tasks.map(mapTask),
    courtDates: result.courtDates.map(mapCourtDate),
    timeline: result.timeline.map(mapTimeline),
    linked: result.linked.map(mapCase),
  }
}

/** Dashboard/tab count badges. */
export function useCaseCounts(filters?: CaseFilters) {
  return useQuery(api.queries.cases.counts, { filters: (filters ?? {}) as never }) as
    | Record<string, number>
    | undefined
}

/* ------------------------------------------------------------------ *
 * Mutations
 * ------------------------------------------------------------------ */

export function useCreateCase() {
  const mutate = useMutation(api.mutations.cases.create)
  return async (input: Record<string, unknown>) => mapCase(await mutate({ input: input as never }))
}

export function useChangeStatus() {
  const mutate = useMutation(api.mutations.cases.changeStatus)
  return (id: string, status: FoiCase['status'], note?: string) =>
    mutate({ id: id as never, status, note })
}

export function useAssignCase() {
  const mutate = useMutation(api.mutations.cases.assign)
  return (id: string, assigneeId: string | null) =>
    mutate({ id: id as never, assigneeId: assigneeId as never })
}

export function useCloseCase() {
  const mutate = useMutation(api.mutations.cases.close)
  return (id: string, outcomeCode: string, closureReason: string, note?: string) =>
    mutate({ id: id as never, outcomeCode, closureReason, note })
}

export function useLinkCases() {
  const mutate = useMutation(api.mutations.cases.link)
  return (id: string, otherId: string) => mutate({ id: id as never, otherId: otherId as never })
}

export function useUnlinkCases() {
  const mutate = useMutation(api.mutations.cases.unlink)
  return (id: string, otherId: string) => mutate({ id: id as never, otherId: otherId as never })
}

export function useBulkUpdate() {
  const mutate = useMutation(api.mutations.cases.bulkUpdate)
  return (ids: string[], patch: Record<string, unknown>) =>
    mutate({ ids: ids as never, patch: patch as never })
}

export function useBulkAddTags() {
  const mutate = useMutation(api.mutations.cases.bulkAddTags)
  return (ids: string[], tags: string[]) => mutate({ ids: ids as never, tags })
}

export function useUpdateCase() {
  const mutate = useMutation(api.mutations.cases.bulkUpdate)
  return (id: string, patch: Record<string, unknown>) => mutate({ ids: [id as never], patch: patch as never })
}
