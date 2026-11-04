/**
 * Global search API adapter (FR-040, ToR §15).
 */
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { SearchHit } from '@/types'

/** Reactive global search across cases, documents, notes, court dates, users. */
export function useGlobalSearch(term: string, limit = 40): SearchHit[] | undefined {
  const result = useQuery(
    api.queries.search.globalSearch,
    term.trim().length >= 2 ? { term, limit } : 'skip',
  ) as SearchHit[] | undefined
  return term.trim().length >= 2 ? result : []
}
