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
  variant = 'card',
}: {
  onPicked?: (userId: string) => void
  columns?: 1 | 2
  /**
   * `card` gives each account its own bordered tile — the switch-account screen.
   * `ledger` drops the tiles for a hairline-divided register, which is what the
   * sign-in sheet wants below a form.
   */
  variant?: 'card' | 'ledger'
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

  const ledger = variant === 'ledger'

  return (
    <ul
      className={cn(
        'grid grid-cols-[minmax(0,1fr)] gap-2',
        columns === 2 && 'sm:grid-cols-[repeat(2,minmax(0,1fr))]',
        ledger && 'gap-0 divide-y divide-ink-200 border-y border-ink-200',
      )}
    >
      {accounts.map(({ userId, blurb, user }) => (
        <li key={userId}>
          <button
            type="button"
            onClick={() => pick(userId)}
            disabled={busyId !== null}
            className={cn(
              'group flex w-full items-center gap-3 text-left transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40',
              ledger
                ? 'px-1.5 py-2.5 hover:bg-brand-50/70'
                : 'rounded-xl border border-ink-200 bg-white px-3 py-2.5 hover:border-brand-300 hover:bg-brand-50/60',
              'disabled:cursor-wait disabled:opacity-60',
            )}
          >
            <UserAvatar user={user} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-semibold text-ink-900">{user.name}</span>
                <span
                  className={cn(
                    'shrink-0 rounded-md bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-700',
                    ledger && 'bg-transparent px-0 font-mono tracking-[0.14em] text-brand-600',
                  )}
                >
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
