import { useEffect, useMemo, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Portal, Toaster, useEscapeKey, useScrollLock } from '@/components/ui'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { db } from '@/mocks/db'
import { selectCases } from '@/mocks/api'
import { computeSla } from '@/lib/sla'
import { Sidebar } from './Sidebar'
import type { SidebarCounts } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette } from './CommandPalette'

/**
 * Application chrome: fixed left navigation, sticky utility bar and the routed
 * page area. Badge counts are derived from the caller's visible rows so a
 * clerk and the Head of Legal Unit never see the same numbers.
 */
export function AppShell() {
  const { user } = useAuth()
  const { version, unread, teamMemberIds } = useData()
  const location = useLocation()
  const [mobileNav, setMobileNav] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)

  useScrollLock(mobileNav)
  useEscapeKey(mobileNav, () => setMobileNav(false))

  // Close transient surfaces on navigation so the shell never traps the user.
  useEffect(() => {
    setMobileNav(false)
    setPaletteOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isPaletteChord = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      if (isPaletteChord) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
        return
      }
      // Bare "/" opens search too, unless the caret is already in a field.
      const target = event.target as HTMLElement | null
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.tagName === 'SELECT' ||
        target?.isContentEditable
      if (event.key === '/' && !typing) {
        event.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const counts = useMemo<SidebarCounts>(() => {
    if (!user) return { overdue: 0, review: 0, unread: 0, hearings: 0 }

    const visible = selectCases(user, undefined, teamMemberIds)
    const overdue = visible.filter((row) => computeSla(row).state === 'overdue').length
    const review = visible.filter(
      (row) => row.status === 'in_review' || row.status === 'escalated' || row.status === 'appeal',
    ).length

    const visibleIds = new Set(visible.map((row) => row.id))
    const todayIso = new Date().toISOString().slice(0, 10)
    const horizon = new Date()
    horizon.setDate(horizon.getDate() + 14)
    const horizonIso = horizon.toISOString().slice(0, 10)
    const hearings = db.courtDates.filter(
      (sitting) =>
        sitting.status === 'scheduled' &&
        sitting.date >= todayIso &&
        sitting.date <= horizonIso &&
        visibleIds.has(sitting.caseId),
    ).length

    return { overdue, review, unread, hearings }
    // `version` re-derives the badges after any mock-store mutation.
  }, [user, teamMemberIds, unread, version])

  return (
    /*
     * The chrome owns the viewport: the shell is exactly one screen tall and
     * clips, so the navigation column and the utility bar are always on screen
     * and only the routed content scrolls.
     */
    <div className="h-dvh overflow-hidden bg-ink-50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-brand-700 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      <div className="flex h-full">
        {/* Full-height, never scrolled by the page. The sidebar scrolls internally. */}
        <div className="hidden h-full shrink-0 lg:block">
          <Sidebar counts={counts} />
        </div>

        {mobileNav ? (
          <Portal>
            <div className="fixed inset-0 z-50 lg:hidden">
              <div
                className="absolute inset-0 bg-ink-900/50 backdrop-blur-[1px]"
                onClick={() => setMobileNav(false)}
                aria-hidden
              />
              <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in-left">
                <Sidebar counts={counts} mobile onNavigate={() => setMobileNav(false)} />
              </div>
            </div>
          </Portal>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0">
            <Topbar
              onOpenMobileNav={() => setMobileNav(true)}
              onOpenPalette={() => setPaletteOpen(true)}
            />
          </div>
          {/*
           * The one scroll container in the app. `min-h-0` is what lets it shrink
           * inside the flex column instead of pushing the shell past the viewport.
           */}
          <main id="main-content" className="min-h-0 flex-1 overflow-y-auto px-4 pb-12 pt-5 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-[1600px]">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <Toaster />
    </div>
  )
}
