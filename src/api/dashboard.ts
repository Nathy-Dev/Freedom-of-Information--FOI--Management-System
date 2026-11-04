import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { DashboardMetrics, FoiCase, CaseTask, CourtDate, TimelineEvent } from '@/types'
import { mapCase, mapCourtDate, mapTask, mapTimeline } from './transform'

export interface LiveDashboardMetrics extends DashboardMetrics {
  recentCases: FoiCase[]
  upcomingHearings: CourtDate[]
  tasks: CaseTask[]
  activity: TimelineEvent[]
}

export function useDashboardMetrics(enabled = true): LiveDashboardMetrics | undefined {
  const result = useQuery(api.queries.dashboard.metrics, enabled ? {} : 'skip') as
    | (DashboardMetrics & { recentCases?: unknown[]; upcomingHearings?: unknown[]; tasks?: unknown[]; activity?: unknown[] })
    | undefined
  if (!result) return undefined
  return {
    ...result,
    recentCases: (result.recentCases ?? []).map(mapCase),
    upcomingHearings: (result.upcomingHearings ?? []).map(mapCourtDate),
    tasks: (result.tasks ?? []).map(mapTask),
    activity: (result.activity ?? []).map(mapTimeline),
  }
}
