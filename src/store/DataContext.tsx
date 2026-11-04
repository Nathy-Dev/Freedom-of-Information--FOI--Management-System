import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppNotification, NotificationPreference, SavedView } from '@/types'
import { useQuery, useMutation } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { useAuth } from './AuthContext'
import { useListCases } from '@/api/cases'
import { useDocuments } from '@/api/documents'
import { useCourtDates } from '@/api/court'
import { useDirectory, useReference } from '@/api/directory'
import { useViews } from '@/api/reports'
import type { FoiCase, FoiDocument, CourtDate, User } from '@/types'

interface DataContextValue {
  /** Kept for compatibility; Convex reactivity replaces the version-bump pattern. */
  version: number
  refresh: () => void
  notifications: AppNotification[]
  unread: number
  markRead: (id: string) => Promise<void>
  markAllRead: () => Promise<void>
  preferences: NotificationPreference[]
  setPreference: (kind: NotificationPreference['kind'], channel: 'inApp' | 'email' | 'sms', value: boolean) => void
  views: SavedView[]
  teamMemberIds: string[]
  sidebarCollapsed: boolean
  toggleSidebar: () => void
  cases: FoiCase[]
  documents: FoiDocument[]
  courtDates: CourtDate[]
  users: User[]
  usersById: Map<string, User>
  reference: ReturnType<typeof useReference>
}

const DataContext = createContext<DataContextValue | null>(null)

const SIDEBAR_KEY = 'hyprep-foi.sidebar'

export function DataProvider({ children }: { children: ReactNode }) {
  const { user, can } = useAuth()
  // Skip the queries entirely until a session exists — avoids firing them (and
  // any unauthenticated console noise) while the login screen is up. `'SKIP'`
  // keeps the hooks unconditional, satisfying the Rules of Hooks.
  const args = user ? ({} as const) : ('skip' as const)

  // Reactive Convex sources. `version` is retained for compatibility but is no
  // longer the driver — queries re-run when their data changes. When no session
  // exists the queries are skipped (`'skip'`), which is the Rules-of-Hooks-safe
  // way to avoid firing them (and unauthenticated noise) on the login screen.
  const notifications = useQuery(api.queries.notifications.list, args) as AppNotification[] | undefined
  const unreadCount = useQuery(api.queries.notifications.unread, args) as number | undefined
  const savedViews = useQuery(api.queries.reports.views, args) as SavedView[] | undefined
  const liveViews = useViews(Boolean(user))
  const teamIds = useQuery(api.queries.auth.teamMemberIds, args) as string[] | undefined
  const livePreferences = useQuery(api.queries.notifications.preferences, args) as NotificationPreference[] | undefined
  const casesResult = useListCases({ page: 1, pageSize: 200 }, Boolean(user))
  const documentsResult = useDocuments({ page: 1, pageSize: 200 }, Boolean(user && can('document:read')))
  const courtDates = useCourtDates(undefined, Boolean(user && can('court:read')))
  const users = useDirectory(Boolean(user && can('user:read')))
  const reference = useReference(Boolean(user))

  const markReadMutation = useMutation(api.mutations.notifications.markRead)
  const markAllReadMutation = useMutation(api.mutations.notifications.markAllRead)
  const setPrefMutation = useMutation(api.mutations.notifications.setPreference)

  const [version, setVersion] = useState(0)
  const [preferences, setPreferences] = useState<NotificationPreference[]>([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed',
  )

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((current) => {
      const next = !current
      window.localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded')
      return next
    })
  }, [])

  const markRead = useCallback(
    async (id: string) => {
      await markReadMutation({ notificationId: id as never })
      refresh()
    },
    [markReadMutation, refresh],
  )

  const markAllRead = useCallback(async () => {
    await markAllReadMutation({})
    refresh()
  }, [markAllReadMutation, refresh])

  const setPreference = useCallback(
    (kind: NotificationPreference['kind'], channel: 'inApp' | 'email' | 'sms', value: boolean) => {
      setPreferences((current) =>
        current.map((p) => (p.kind === kind ? { ...p, [channel]: value } : p)),
      )
      void setPrefMutation({
        kind,
        channel: channel === 'inApp' ? 'in_app' : channel,
        value,
      })
    },
    [setPrefMutation],
  )

  const value = useMemo<DataContextValue>(() => {
    const items = notifications ?? []
    return {
      version,
      refresh,
      notifications: items,
      unread: unreadCount ?? items.filter((n) => !n.isRead).length,
      markRead,
      markAllRead,
      preferences: livePreferences ?? preferences,
      setPreference,
      views: liveViews ?? savedViews ?? [],
      teamMemberIds: teamIds ?? [],
      sidebarCollapsed,
      toggleSidebar,
      cases: casesResult?.rows ?? [],
      documents: documentsResult?.rows ?? [],
      courtDates: courtDates ?? [],
      users,
      usersById: new Map(users.map((entry) => [entry.id, entry])),
      reference,
    }
    // `version` stays in deps so manual refresh still re-renders consumers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, notifications, unreadCount, savedViews, liveViews, livePreferences, teamIds, version, refresh, markRead, markAllRead, preferences, setPreference, sidebarCollapsed, toggleSidebar, casesResult, documentsResult, courtDates, users, reference])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside a DataProvider')
  return context
}
