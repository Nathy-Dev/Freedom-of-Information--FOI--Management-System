import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AppNotification, NotificationPreference, SavedView } from '@/types'
import { db, reference } from '@/mocks/db'
import { markAllNotificationsRead, markNotificationRead, notificationsFor } from '@/mocks/api'
import { notificationPreferenceDefaults } from '@/mocks/data/reference'
import { useAuth } from './AuthContext'

interface DataContextValue {
  /** Bumped after any mutation so dependent screens re-query the mock store. */
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
}

const DataContext = createContext<DataContextValue | null>(null)

const SIDEBAR_KEY = 'hyprep-foi.sidebar'

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [version, setVersion] = useState(0)
  const [preferences, setPreferences] = useState<NotificationPreference[]>(
    () => notificationPreferenceDefaults.map((p) => ({ ...p })),
  )
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
      await markNotificationRead(id)
      refresh()
    },
    [refresh],
  )

  const markAllRead = useCallback(async () => {
    if (!user) return
    await markAllNotificationsRead(user.id)
    refresh()
  }, [user, refresh])

  const setPreference = useCallback(
    (kind: NotificationPreference['kind'], channel: 'inApp' | 'email' | 'sms', value: boolean) => {
      setPreferences((current) =>
        current.map((p) => (p.kind === kind ? { ...p, [channel]: value } : p)),
      )
    },
    [],
  )

  const value = useMemo<DataContextValue>(() => {
    const notifications = user ? notificationsFor(user.id) : []
    const team = user?.teamId
      ? reference.legalTeams.find((t) => t.id === user.teamId)?.memberIds ?? []
      : []

    return {
      version,
      refresh,
      notifications,
      unread: notifications.filter((n) => !n.isRead).length,
      markRead,
      markAllRead,
      preferences,
      setPreference,
      views: db.views.filter((v) => v.isShared || v.ownerId === user?.id),
      teamMemberIds: team,
      sidebarCollapsed,
      toggleSidebar,
    }
    // `version` is an explicit dependency: it is the signal that the mutable
    // mock store changed and these derived lists must be recomputed.
  }, [user, version, refresh, markRead, markAllRead, preferences, setPreference, sidebarCollapsed, toggleSidebar])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const context = useContext(DataContext)
  if (!context) throw new Error('useData must be used inside a DataProvider')
  return context
}
