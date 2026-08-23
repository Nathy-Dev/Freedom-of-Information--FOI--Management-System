import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bell, BellOff, CheckCheck } from 'lucide-react'
import type { AppNotification } from '@/types'
import { NOTIFICATION_META } from '@/lib/constants'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useData } from '@/store/DataContext'
import { EmptyState } from '@/components/ui'
import { NavIcon } from './NavIcon'

/** One notification line, shared by the bell popover and the notifications page. */
export function NotificationRow({
  notification,
  onRead,
  clamp = true,
}: {
  notification: AppNotification
  onRead?: (id: string) => void
  clamp?: boolean
}) {
  const meta = NOTIFICATION_META[notification.kind]

  return (
    <Link
      to={notification.link}
      onClick={() => {
        if (!notification.isRead) onRead?.(notification.id)
      }}
      className={cn(
        'flex gap-3 px-3 py-2.5 transition-colors hover:bg-brand-50/70',
        !notification.isRead && 'bg-brand-50/40',
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          notification.isRead ? 'bg-ink-100 text-ink-500' : 'bg-brand-100 text-brand-700',
        )}
      >
        <NavIcon name={meta.icon} className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className={cn('block text-xs', notification.isRead ? 'font-medium text-ink-700' : 'font-semibold text-ink-900')}>
            {notification.title}
          </span>
          <span className="shrink-0 whitespace-nowrap text-[10px] text-ink-400">{formatRelative(notification.at)}</span>
        </span>
        <span className={cn('mt-0.5 block text-2xs leading-relaxed text-ink-500', clamp && 'line-clamp-2-safe')}>
          {notification.body}
        </span>
      </span>
      {!notification.isRead ? <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" /> : null}
    </Link>
  )
}

export function NotificationBell() {
  const { notifications, unread, markRead, markAllRead } = useData()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const recent = notifications.slice(0, 6)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        aria-expanded={open}
        className={cn(
          'relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800',
          open && 'bg-ink-100 text-ink-800',
        )}
      >
        <Bell aria-hidden className="h-4.5 w-4.5" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-crest-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Recent notifications"
          className="absolute right-0 z-40 mt-1.5 w-[22rem] animate-slide-up overflow-hidden rounded-xl border border-ink-200 bg-white shadow-overlay"
        >
          <div className="flex items-center justify-between gap-2 border-b border-ink-200 px-3 py-2.5">
            <p className="text-xs font-semibold text-ink-800">
              Notifications
              {unread > 0 ? <span className="ml-1.5 font-normal text-ink-500">{unread} unread</span> : null}
            </p>
            {unread > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-2xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
              >
                <CheckCheck aria-hidden className="h-3 w-3" />
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-[22rem] divide-y divide-ink-100 overflow-y-auto">
            {recent.length === 0 ? (
              <EmptyState
                compact
                icon={<BellOff className="h-4.5 w-4.5" />}
                title="You are all caught up"
                description="Deadline warnings, assignments and hearing reminders will appear here."
              />
            ) : (
              recent.map((notification) => (
                <NotificationRow
                  key={notification.id}
                  notification={notification}
                  onRead={(id) => void markRead(id)}
                />
              ))
            )}
          </div>

          <div className="border-t border-ink-200 px-3 py-2">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-brand-700 hover:underline"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
