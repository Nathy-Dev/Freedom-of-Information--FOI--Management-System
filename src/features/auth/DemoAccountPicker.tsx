import { useState } from 'react'
import { ArrowRight, Loader2 } from 'lucide-react'
import { reference } from '@/mocks/db'
import { ROLE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { UserAvatar } from '@/components/ui'
import { useAuth } from '@/store/AuthContext'

/**
 * Review aid: the prototype has no real identity provider, so every role is
 * reachable in one click. This panel is the only place that shortcut lives.
 */
export function DemoAccountPicker({
  onPicked,
  columns = 1,
}: {
  onPicked?: (userId: string) => void
  columns?: 1 | 2
}) {
  const { loginAs } = useAuth()
  const [busyId, setBusyId] = useState<string | null>(null)

  const accounts = reference.demoAccounts
    .map((entry) => ({ ...entry, user: reference.usersById.get(entry.userId) }))
    .filter((entry): entry is { userId: string; blurb: string; user: NonNullable<typeof entry.user> } =>
      Boolean(entry.user),
    )

  const pick = async (userId: string) => {
    setBusyId(userId)
    const outcome = await loginAs(userId)
    setBusyId(null)
    if (outcome.status === 'success') onPicked?.(userId)
  }

  return (
    <ul className={cn('grid gap-2', columns === 2 && 'sm:grid-cols-2')}>
      {accounts.map(({ userId, blurb, user }) => (
        <li key={userId}>
          <button
            type="button"
            onClick={() => pick(userId)}
            disabled={busyId !== null}
            className={cn(
              'group flex w-full items-center gap-3 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-left transition',
              'hover:border-brand-300 hover:bg-brand-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
              'disabled:cursor-wait disabled:opacity-60',
            )}
          >
            <UserAvatar user={user} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold text-ink-900">{user.name}</span>
                <span className="shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700">
                  {ROLE_LABELS[user.roleId]}
                </span>
              </span>
              <span className="mt-0.5 block truncate text-xs text-ink-500">{blurb}</span>
            </span>
            {busyId === userId ? (
              <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-brand-600" />
            ) : (
              <ArrowRight
                aria-hidden
                className="h-4 w-4 shrink-0 text-ink-300 transition group-hover:translate-x-0.5 group-hover:text-brand-600"
              />
            )}
          </button>
        </li>
      ))}
    </ul>
  )
}
