import { useNavigate } from 'react-router-dom'
import { Command, HelpCircle, LogOut, Menu, Plus, Search, Settings, UserCircle, UserCog } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/constants'
import { TIMEZONE_LABEL } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { reference } from '@/mocks/db'
import { Badge, Button, Dropdown, Tooltip, UserAvatar } from '@/components/ui'
import { NotificationBell } from './NotificationBell'

interface TopbarProps {
  onOpenMobileNav: () => void
  onOpenPalette: () => void
}

/**
 * Top utility bar: global search, prominent quick-create, notifications and the
 * account menu (Terms of Reference section 30). The role switcher is a
 * demonstration aid so a reviewer can see every user class without signing out.
 */
export function Topbar({ onOpenMobileNav, onOpenPalette }: TopbarProps) {
  const { user, role, isReadOnly, can, logout, loginAs } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const canCreateInternally = can('case:create') && !isReadOnly
  const isRequestor = user.roleId === 'requestor' || user.roleId === 'external'
  const createTo = isRequestor ? '/requests/new' : '/cases/new'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-ink-200 bg-white/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-white/80 sm:px-4">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800 lg:hidden"
      >
        <Menu aria-hidden className="h-4.5 w-4.5" />
      </button>

      {/* Global search opens the command palette, which searches cases, documents, people and pages. */}
      <button
        type="button"
        onClick={onOpenPalette}
        className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-ink-200 bg-ink-50/80 px-3 text-left text-sm text-ink-400 transition-colors hover:border-brand-300 hover:bg-white sm:max-w-md"
      >
        <Search aria-hidden className="h-4 w-4 shrink-0 text-ink-400 group-hover:text-brand-600" />
        <span className="min-w-0 flex-1 truncate">Search cases, documents, people…</span>
        <kbd className="hidden shrink-0 items-center gap-0.5 rounded border border-ink-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-ink-500 sm:inline-flex">
          <Command aria-hidden className="h-2.5 w-2.5" />K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <span className="hidden text-2xs text-ink-400 xl:inline">{TIMEZONE_LABEL}</span>

        {canCreateInternally || isRequestor ? (
          <Button
            size="sm"
            leadingIcon={<Plus aria-hidden className="h-4 w-4" />}
            onClick={() => navigate(createTo)}
            className="shrink-0"
          >
            <span className="hidden sm:inline">{isRequestor ? 'New request' : 'New FOI case'}</span>
            <span className="sm:hidden">New</span>
          </Button>
        ) : null}

        <Tooltip content="Help & guidance" side="bottom">
          <button
            type="button"
            onClick={() => navigate('/help')}
            aria-label="Help and guidance"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-800"
          >
            <HelpCircle aria-hidden className="h-4.5 w-4.5" />
          </button>
        </Tooltip>

        <NotificationBell />

        <Dropdown
          width="w-64"
          label="Account"
          trigger={({ toggle, open }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label="Account menu"
              className={cn(
                'flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-ink-100',
                open && 'bg-ink-100',
              )}
            >
              <UserAvatar user={user} size="sm" />
              <span className="hidden min-w-0 text-left leading-tight sm:block">
                <span className="block max-w-[9rem] truncate text-xs font-semibold text-ink-800">{user.name}</span>
                <span className="block text-[10px] text-ink-500">{ROLE_LABELS[role.id as keyof typeof ROLE_LABELS] ?? role.name}</span>
              </span>
            </button>
          )}
          header={
            <div className="space-y-1">
              <p className="truncate text-xs font-semibold text-ink-900">{user.name}</p>
              <p className="truncate text-2xs text-ink-500">{user.email}</p>
              <div className="flex flex-wrap items-center gap-1 pt-0.5">
                <Badge tone="brand">{role.name}</Badge>
                {isReadOnly ? <Badge tone="warning">Read-only</Badge> : null}
              </div>
            </div>
          }
          items={[
            { key: 'profile', label: 'My profile', icon: <UserCircle className="h-4 w-4" />, onSelect: () => navigate('/profile') },
            { key: 'security', label: 'Security & sessions', icon: <Settings className="h-4 w-4" />, onSelect: () => navigate('/profile?tab=security') },
            {
              key: 'switch',
              label: 'Switch demo account',
              icon: <UserCog className="h-4 w-4" />,
              separated: true,
              onSelect: () => navigate('/switch-account'),
            },
            {
              key: 'logout',
              label: 'Sign out',
              icon: <LogOut className="h-4 w-4" />,
              danger: true,
              separated: true,
              onSelect: () => {
                logout()
                navigate('/login', { replace: true })
              },
            },
          ]}
          footer={
            <p className="text-[10px] leading-relaxed text-ink-400">
              Demonstration build · {reference.demoAccounts.length} sample accounts ·{' '}
              <button type="button" className="font-medium text-brand-700 hover:underline" onClick={() => loginAs('usr-001')}>
                reset to Super-Admin
              </button>
            </p>
          }
        />
      </div>
    </header>
  )
}
