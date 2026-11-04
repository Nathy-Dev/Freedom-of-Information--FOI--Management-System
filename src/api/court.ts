import { useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { CourtDate } from '@/types'
import { mapCourtDate } from './transform'

export function useCourtDates(range?: { from?: string; to?: string }, enabled = true): CourtDate[] | undefined {
  const result = useQuery(api.queries.court.list, enabled ? range ?? {} : 'skip') as unknown[] | undefined
  return result?.map(mapCourtDate)
}

export function useCourtDate(id: string | undefined, enabled = true): CourtDate | null | undefined {
  const result = useQuery(api.queries.court.get, enabled && id ? { id: id as never } : 'skip') as unknown
  return result == null ? result : mapCourtDate(result)
}

export function useScheduleCourtDate() {
  const mutate = useMutation(api.mutations.court.schedule)
  return (input: {
    caseId: string
    suitNumber: string
    date: string
    time: string
    durationMinutes?: number
    courtName: string
    location?: string
    judge?: string
    hearingType: CourtDate['hearingType']
    counselIds?: string[]
    notes?: string
    reminderLeadDays?: number[]
  }) => mutate({ ...input, caseId: input.caseId as never, counselIds: input.counselIds as never })
}

export function useRecordCourtOutcome() {
  const mutate = useMutation(api.mutations.court.recordOutcome)
  return (courtDateId: string, status: CourtDate['status'], outcome: string, nextActionDue?: string) => mutate({ courtDateId: courtDateId as never, status, outcome, nextActionDue })
}
