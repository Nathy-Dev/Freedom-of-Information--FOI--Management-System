import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  FileText,
  Gavel,
  MessageSquare,
  Paperclip,
  Search as SearchIcon,
  UserRound,
} from 'lucide-react'
import type { SearchHit } from '@/types'
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  ChoiceChip,
  EmptyState,
  SearchInput,
  SkeletonCard,
} from '@/components/ui'
import { PageHeader } from '@/components/common'
import { globalSearch } from '@/mocks/api'
import { highlight } from '@/lib/utils'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'

type HitType = SearchHit['type']

const TYPE_META: Record<HitType, { label: string; plural: string; icon: JSX.Element; tone: 'brand' | 'info' | 'neutral' | 'warning' | 'purple' }> = {
  case: { label: 'Request', plural: 'Requests', icon: <FileText className="h-4 w-4" />, tone: 'brand' },
  document: { label: 'Document', plural: 'Documents', icon: <Paperclip className="h-4 w-4" />, tone: 'info' },
  note: { label: 'Note', plural: 'Notes', icon: <MessageSquare className="h-4 w-4" />, tone: 'neutral' },
  court_date: { label: 'Hearing', plural: 'Hearings', icon: <Gavel className="h-4 w-4" />, tone: 'warning' },
  user: { label: 'Person', plural: 'People', icon: <UserRound className="h-4 w-4" />, tone: 'purple' },
}

const TYPE_ORDER: HitType[] = ['case', 'document', 'note', 'court_date', 'user']

const EXAMPLES = ['HYPREP/FOI/2025', 'Ogoni', 'contract award', 'Premium Times', 'Litigation Risk']

/** Highlights every occurrence of the search term inside a result line. */
function Marked({ text, term }: { text: string; term: string }) {
  return (
    <>
      {highlight(text, term).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded bg-gold-100 px-0.5 text-ink-900">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  )
}

/** FR-040 / FR-041: cross-entity search results with type facets. */
export function SearchPage() {
  const { user } = useAuth()
  const { version } = useData()
  const [params, setParams] = useSearchParams()

  const initial = params.get('q') ?? ''
  const [term, setTerm] = useState(initial)
  const [types, setTypes] = useState<HitType[]>([])
  const debounced = useDebounced(term, 300)

  const commit = (value: string) => {
    setTerm(value)
    const draft = new URLSearchParams(params)
    if (value.trim()) draft.set('q', value)
    else draft.delete('q')
    setParams(draft, { replace: true })
  }

  const search = useAsync(
    () => (user && debounced.trim().length >= 2 ? globalSearch(debounced, user, 80) : Promise.resolve([])),
    [debounced, user, version],
  )

  const hits = search.data ?? []

  const counts = useMemo(() => {
    const map = new Map<HitType, number>()
    hits.forEach((hit) => map.set(hit.type, (map.get(hit.type) ?? 0) + 1))
    return map
  }, [hits])

  const filtered = useMemo(
    () => (types.length ? hits.filter((hit) => types.includes(hit.type)) : hits),
    [hits, types],
  )

  const grouped = useMemo(() => {
    const map = new Map<HitType, SearchHit[]>()
    filtered.forEach((hit) => {
      const list = map.get(hit.type) ?? []
      list.push(hit)
      map.set(hit.type, list)
    })
    return TYPE_ORDER.filter((type) => map.has(type)).map((type) => ({ type, rows: map.get(type)! }))
  }, [filtered])

  const isShort = debounced.trim().length < 2

  return (
    <div className="space-y-5">
      <PageHeader
        title="Search"
        description="Searches case numbers, subjects, request bodies, requestors, tags, documents, notes and hearings you are permitted to see."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Search' }]}
      />

      <Card>
        <CardBody className="space-y-3">
          <SearchInput
            value={term}
            onChange={commit}
            placeholder="Search requests, documents, requestors, suit numbers…"
            label="Search everything"
            size="md"
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-ink-500">Try:</span>
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => commit(example)}
                className="rounded-md border border-ink-200 bg-white px-2 py-0.5 text-xs text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-800"
              >
                {example}
              </button>
            ))}
          </div>
        </CardBody>
      </Card>

      {isShort ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<SearchIcon className="h-6 w-6" />}
              title="Type at least two characters"
              description="Results are scoped to your role, so a requestor only ever sees their own requests."
            />
          </CardBody>
        </Card>
      ) : search.isLoading && !search.data ? (
        <SkeletonCard lines={6} />
      ) : hits.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<SearchIcon className="h-6 w-6" />}
              title={`Nothing matched “${debounced}”`}
              description="Check the spelling, or search a case number fragment such as 2025/0042."
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <ChoiceChip selected={types.length === 0} onClick={() => setTypes([])}>
              All results ({hits.length})
            </ChoiceChip>
            {TYPE_ORDER.filter((type) => counts.get(type)).map((type) => (
              <ChoiceChip
                key={type}
                selected={types.includes(type)}
                onClick={() => setTypes(types.includes(type) ? types.filter((t) => t !== type) : [...types, type])}
              >
                {TYPE_META[type].plural} ({counts.get(type)})
              </ChoiceChip>
            ))}
          </div>

          <div className="space-y-4">
            {grouped.map((group) => (
              <Card key={group.type}>
                <CardHeader
                  title={TYPE_META[group.type].plural}
                  description={`${group.rows.length} match${group.rows.length === 1 ? '' : 'es'}`}
                  icon={TYPE_META[group.type].icon}
                />
                <CardBody className="divide-y divide-ink-200/70 p-0">
                  {group.rows.map((hit) => (
                    <Link
                      key={`${hit.type}-${hit.id}`}
                      to={hit.link}
                      className="group flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-brand-50/50"
                    >
                      <span className="mt-0.5 shrink-0 rounded-md bg-ink-50 p-1.5 text-ink-500 group-hover:bg-white group-hover:text-brand-600">
                        {TYPE_META[hit.type].icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-ink-900 group-hover:text-brand-800">
                            <Marked text={hit.title} term={debounced} />
                          </span>
                          <Badge tone={TYPE_META[hit.type].tone}>{hit.matchedOn}</Badge>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-ink-500">{hit.subtitle}</span>
                        {hit.snippet ? (
                          <span className="mt-1 block text-xs leading-relaxed text-ink-600 line-clamp-2">
                            <Marked text={hit.snippet} term={debounced} />
                          </span>
                        ) : null}
                      </span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-300 group-hover:text-brand-600" />
                    </Link>
                  ))}
                </CardBody>
              </Card>
            ))}
          </div>

          <p className="pb-2 text-xs text-ink-400">
            Showing {filtered.length} of {hits.length} matches. Search is capped at 80 results in this prototype; refine the
            term or use the case list filters for exhaustive queries.
          </p>
        </>
      )}
    </div>
  )
}
