import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, CornerDownLeft, FileText, Folder, Gavel, Search, StickyNote, User } from 'lucide-react'
import type { RoleId, SearchHit } from '@/types'
import { NAV_SECTIONS, UTILITY_NAV } from '@/lib/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useDebounced } from '@/hooks/useAsync'
import { globalSearch } from '@/mocks/api'
import { Portal, useEscapeKey, useScrollLock } from '@/components/ui'
import { NavIcon } from './NavIcon'

const HIT_ICONS = {
  case: Folder,
  document: FileText,
  user: User,
  court_date: Gavel,
  note: StickyNote,
} as const

const HIT_LABELS = {
  case: 'Case',
  document: 'Document',
  user: 'Person',
  court_date: 'Hearing',
  note: 'Note',
} as const

interface Entry {
  key: string
  title: string
  subtitle: string
  badge: string
  link: string
  icon: JSX.Element
}

/** Cmd/Ctrl-K search across records and pages, filtered by the caller's role. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, can } = useAuth()
  const navigate = useNavigate()
  const [term, setTerm] = useState('')
  const [cursor, setCursor] = useState(0)
  const [hits, setHits] = useState<SearchHit[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const debounced = useDebounced(term, 180)

  useScrollLock(open)
  useEscapeKey(open, onClose)

  useEffect(() => {
    if (!open) return undefined
    setTerm('')
    setCursor(0)
    // Focus after the panel paints so the caret lands in the field.
    const id = window.setTimeout(() => inputRef.current?.focus(), 20)
    return () => window.clearTimeout(id)
  }, [open])

  const pages = useMemo<Entry[]>(() => {
    const roleId = (user?.roleId ?? 'requestor') as RoleId
    const items = [
      ...NAV_SECTIONS.flatMap((section) =>
        section.items
          .filter((item) => (!item.roles || item.roles.includes(roleId)) && (!item.permission || can(item.permission)))
          .map((item) => ({ ...item, group: section.label ?? 'Workspace' })),
      ),
      ...UTILITY_NAV.map((item) => ({ ...item, group: 'Account', description: undefined })),
    ]
    return items.map((item) => ({
      key: `page-${item.to}-${item.label}`,
      title: item.label,
      subtitle: item.description ?? item.group,
      badge: 'Page',
      link: item.to,
      icon: <NavIcon name={item.icon} className="h-4 w-4" />,
    }))
  }, [can, user])

  // Record search is async (it mirrors the eventual API), pages are local.
  useEffect(() => {
    const query = debounced.trim()
    if (!user || query.length < 2) {
      setHits([])
      return undefined
    }
    let live = true
    globalSearch(query, user, 18)
      .then((found) => {
        if (live) setHits(found)
      })
      .catch(() => {
        if (live) setHits([])
      })
    return () => {
      live = false
    }
  }, [debounced, user])

  const results = useMemo<Entry[]>(() => {
    const query = debounced.trim()
    if (!user) return []

    const matchedPages = pages.filter((page) =>
      query.length === 0 ? true : `${page.title} ${page.subtitle}`.toLowerCase().includes(query.toLowerCase()),
    )
    if (query.length < 2) return matchedPages.slice(0, 8)

    const records = hits.map((hit) => {
      const Icon = HIT_ICONS[hit.type]
      return {
        key: `${hit.type}-${hit.id}`,
        title: hit.title,
        subtitle: hit.subtitle,
        badge: HIT_LABELS[hit.type],
        link: hit.link,
        icon: <Icon className="h-4 w-4" />,
      }
    })
    return [...records, ...matchedPages.slice(0, 4)]
  }, [debounced, hits, pages, user])

  useEffect(() => setCursor(0), [debounced])

  if (!open) return null

  const go = (link: string) => {
    onClose()
    navigate(link)
  }

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]">
        <div aria-hidden onClick={onClose} className="fixed inset-0 animate-fade-in bg-ink-900/45 backdrop-blur-[2px]" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
          className="relative z-10 w-full max-w-2xl animate-scale-in overflow-hidden rounded-2xl bg-white shadow-overlay"
        >
          <div className="flex items-center gap-3 border-b border-ink-200 px-4">
            <Search aria-hidden className="h-4.5 w-4.5 shrink-0 text-ink-400" />
            <input
              ref={inputRef}
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setCursor((c) => Math.min(c + 1, results.length - 1))
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setCursor((c) => Math.max(c - 1, 0))
                } else if (event.key === 'Enter') {
                  event.preventDefault()
                  const entry = results[cursor]
                  if (entry) go(entry.link)
                }
              }}
              placeholder="Search cases, documents, hearings, people or jump to a page"
              aria-label="Search"
              className="h-14 flex-1 border-0 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0"
            />
            <kbd className="hidden shrink-0 rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 font-mono text-[10px] text-ink-500 sm:block">
              Esc
            </kbd>
          </div>

          <div className="max-h-[52vh] overflow-y-auto py-1.5">
            {results.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-ink-500">
                No matches for {debounced}. Try a case number, subject, requestor name or suit number.
              </p>
            ) : (
              <ul>
                {results.map((entry, index) => (
                  <li key={entry.key}>
                    <button
                      type="button"
                      onMouseEnter={() => setCursor(index)}
                      onClick={() => go(entry.link)}
                      className={cn(
                        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors',
                        index === cursor ? 'bg-brand-50' : 'hover:bg-ink-50',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg',
                          index === cursor ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500',
                        )}
                      >
                        {entry.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-900">{entry.title}</span>
                        <span className="block truncate text-2xs text-ink-500">{entry.subtitle}</span>
                      </span>
                      <span className="shrink-0 rounded-md bg-ink-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-500">
                        {entry.badge}
                      </span>
                      {index === cursor ? <CornerDownLeft aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-600" /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="flex items-center justify-between gap-3 border-t border-ink-200 bg-ink-50/70 px-4 py-2 text-[10px] text-ink-500">
            <span className="flex items-center gap-3">
              <span>Arrow keys to navigate</span>
              <span>Enter to open</span>
            </span>
            {debounced.trim().length >= 2 ? (
              <button
                type="button"
                onClick={() => go(`/search?q=${encodeURIComponent(debounced.trim())}`)}
                className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
              >
                See all results
                <ArrowRight aria-hidden className="h-3 w-3" />
              </button>
            ) : null}
          </footer>
        </div>
      </div>
    </Portal>
  )
}
