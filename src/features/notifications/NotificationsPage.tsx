import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlarmClock,
  AlertTriangle,
  ArrowRightLeft,
  AtSign,
  Bell,
  BellRing,
  CheckCheck,
  CheckSquare,
  FileUp,
  Gavel,
  Mail,
  ShieldAlert,
  Smartphone,
  Undo2,
  UserCheck,
} from 'lucide-react'
import type { JSX } from 'react'
import type { AppNotification, NotificationKind } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChoiceChip,
  EmptyState,
  Tabs,
  Toggle,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { MetaItem, PageHeader } from '@/components/common'
import { NOTIFICATION_META } from '@/lib/constants'
import { formatRelative, formatDateTime } from '@/lib/format'
import { useData } from '@/store/DataContext'

type NotificationTab = 'unread' | 'all' | 'preferences'

const ICONS: Record<NotificationKind, JSX.Element> = {
  case_assigned: <UserCheck className="h-4 w-4" />,
  status_changed: <ArrowRightLeft className="h-4 w-4" />,
  response_uploaded: <FileUp className="h-4 w-4" />,
  due_soon: <AlarmClock className="h-4 w-4" />,
  overdue: <AlertTriangle className="h-4 w-4" />,
  court_reminder: <Gavel className="h-4 w-4" />,
  mention: <AtSign className="h-4 w-4" />,
  task_assigned: <CheckSquare className="h-4 w-4" />,
  admin_alert: <ShieldAlert className="h-4 w-4" />,
  appeal_filed: <Undo2 className="h-4 w-4" />,
}

const ACCENTS: Partial<Record<NotificationKind, string>> = {
  overdue: 'bg-crest-50 text-crest-600',
  due_soon: 'bg-gold-50 text-gold-700',
  court_reminder: 'bg-gold-50 text-gold-700',
  admin_alert: 'bg-violet-50 text-violet-600',
  appeal_filed: 'bg-crest-50 text-crest-600',
}

const CHANNEL_ICONS = {
  in_app: <Bell className="h-3 w-3" />,
  email: <Mail className="h-3 w-3" />,
  sms: <Smartphone className="h-3 w-3" />,
}

/** FR-060 to FR-063: the notification centre and per-kind channel preferences. */
export function NotificationsPage() {
  const { notifications, unread, markRead, markAllRead, preferences, setPreference } = useData()

  const [tab, setTab] = useState<NotificationTab>(unread > 0 ? 'unread' : 'all')
  const [kinds, setKinds] = useState<NotificationKind[]>([])
  const [isBusy, setBusy] = useState(false)

  const presentKinds = useMemo(() => {
    const seen = new Map<NotificationKind, number>()
    notifications.forEach((row) => seen.set(row.kind, (seen.get(row.kind) ?? 0) + 1))
    return Array.from(seen.entries()).sort((a, b) => b[1] - a[1])
  }, [notifications])

  const rows = useMemo(() => {
    let list: AppNotification[] = notifications
    if (tab === 'unread') list = list.filter((row) => !row.isRead)
    if (kinds.length) list = list.filter((row) => kinds.includes(row.kind))
    return list
  }, [notifications, tab, kinds])

  const tabs: Array<TabItem<NotificationTab>> = [
    { key: 'unread', label: 'Unread', count: unread, icon: <BellRing className="h-4 w-4" /> },
    { key: 'all', label: 'All activity', count: notifications.length, icon: <Bell className="h-4 w-4" /> },
    { key: 'preferences', label: 'Preferences', icon: <Mail className="h-4 w-4" /> },
  ]

  const clearAll = async () => {
    setBusy(true)
    try {
      await markAllRead()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifications"
        description="Assignment, deadline, court and escalation alerts raised for your account."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Notifications' }]}
        meta={
          <>
            <MetaItem icon={<BellRing className="h-3.5 w-3.5" />} label="Unread" value={String(unread)} />
            <MetaItem icon={<Bell className="h-3.5 w-3.5" />} label="Total" value={String(notifications.length)} />
          </>
        }
        actions={
          unread > 0 ? (
            <Button
              variant="secondary"
              leadingIcon={<CheckCheck className="h-4 w-4" />}
              onClick={clearAll}
              isLoading={isBusy}
            >
              Mark all as read
            </Button>
          ) : null
        }
      />

      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Notification views" />

      {tab === 'preferences' ? (
        <Card>
          <CardHeader
            title="Delivery preferences"
            description="Choose how each alert reaches you. In-app alerts cannot be disabled for statutory deadline warnings."
          />
          <CardBody className="p-0">
            <div className="hidden grid-cols-[minmax(0,1fr)_5rem_5rem_5rem] gap-2 border-b border-ink-200 bg-ink-50 px-5 py-2 text-2xs font-semibold uppercase tracking-wide text-ink-500 md:grid">
              <span>Alert</span>
              <span className="text-center">In-app</span>
              <span className="text-center">Email</span>
              <span className="text-center">SMS</span>
            </div>
            <ul className="divide-y divide-ink-200/70">
              {preferences.map((preference) => {
                const locked = preference.kind === 'overdue' || preference.kind === 'due_soon'
                return (
                  <li
                    key={preference.kind}
                    className="grid gap-3 px-5 py-3.5 md:grid-cols-[minmax(0,1fr)_5rem_5rem_5rem] md:items-center md:gap-2"
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 rounded-md bg-brand-50 p-1.5 text-brand-600">
                        {ICONS[preference.kind]}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-800">{preference.label}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{preference.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 md:justify-center">
                      <span className="text-xs text-ink-500 md:hidden">In-app</span>
                      <Toggle
                        checked={preference.inApp}
                        disabled={locked}
                        onChange={(value) => setPreference(preference.kind, 'inApp', value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 md:justify-center">
                      <span className="text-xs text-ink-500 md:hidden">Email</span>
                      <Toggle
                        checked={preference.email}
                        onChange={(value) => setPreference(preference.kind, 'email', value)}
                      />
                    </div>
                    <div className="flex items-center gap-2 md:justify-center">
                      <span className="text-xs text-ink-500 md:hidden">SMS</span>
                      <Toggle
                        checked={preference.sms}
                        onChange={(value) => setPreference(preference.kind, 'sms', value)}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-4">
          {presentKinds.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <ChoiceChip selected={kinds.length === 0} onClick={() => setKinds([])}>
                All types
              </ChoiceChip>
              {presentKinds.map(([kind, count]) => (
                <ChoiceChip
                  key={kind}
                  selected={kinds.includes(kind)}
                  onClick={() => setKinds(kinds.includes(kind) ? kinds.filter((k) => k !== kind) : [...kinds, kind])}
                >
                  {NOTIFICATION_META[kind].label} ({count})
                </ChoiceChip>
              ))}
            </div>
          ) : null}

          <Card>
            <CardBody className="p-0">
              {rows.length === 0 ? (
                <div className="p-5">
                  <EmptyState
                    icon={<CheckCheck className="h-6 w-6" />}
                    title={tab === 'unread' ? 'Nothing unread' : 'No notifications yet'}
                    description={
                      tab === 'unread'
                        ? 'You are up to date. New assignments and deadline warnings will appear here.'
                        : 'Alerts are raised when a request is assigned to you, a deadline nears, or a hearing is listed.'
                    }
                  />
                </div>
              ) : (
                <ul className="divide-y divide-ink-200/70">
                  {rows.map((row) => (
                    <li
                      key={row.id}
                      className={row.isRead ? 'bg-white' : 'bg-brand-50/40'}
                    >
                      <div className="flex items-start gap-3 px-5 py-3.5">
                        <span
                          className={`mt-0.5 shrink-0 rounded-md p-1.5 ${ACCENTS[row.kind] ?? 'bg-brand-50 text-brand-600'}`}
                        >
                          {ICONS[row.kind]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {!row.isRead ? (
                              <span aria-label="Unread" className="h-1.5 w-1.5 rounded-full bg-brand-500" />
                            ) : null}
                            <p className="truncate text-sm font-medium text-ink-900">{row.title}</p>
                            <Badge tone="neutral">{NOTIFICATION_META[row.kind].label}</Badge>
                          </div>
                          <p className="mt-1 text-xs leading-relaxed text-ink-600">{row.body}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-3 text-2xs text-ink-400">
                            <span title={formatDateTime(row.at)}>{formatRelative(row.at)}</span>
                            <span className="flex items-center gap-1.5">
                              {row.channels.map((channel) => (
                                <span key={channel} className="flex items-center gap-0.5" title={`Delivered by ${channel.replace('_', '-')}`}>
                                  {CHANNEL_ICONS[channel]}
                                </span>
                              ))}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <Link
                            to={row.link}
                            onClick={() => (row.isRead ? undefined : markRead(row.id))}
                            className="text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
                          >
                            Open
                          </Link>
                          {!row.isRead ? (
                            <button
                              type="button"
                              onClick={() => markRead(row.id)}
                              className="text-2xs text-ink-400 hover:text-ink-700 hover:underline"
                            >
                              Mark read
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}
