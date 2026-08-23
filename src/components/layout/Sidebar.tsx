import { useMemo } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, PanelLeftClose } from 'lucide-react'
import type { NavItem } from '@/lib/navigation'
import { NAV_SECTIONS } from '@/lib/navigation'
import type { RoleId } from '@/types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { BrandLockup, FlagRule } from '@/components/common/CoatOfArms'
import { CountPill, Tooltip } from '@/components/ui'
import { NavIcon } from './NavIcon'

export interface SidebarCounts {
  overdue: number
  review: number
  unread: number
  hearings: number
}

interface SidebarProps {
  counts: SidebarCounts
  /** Mobile drawer mode: always expanded, closes on navigation. */
  mobile?: boolean
  onNavigate?: () => void
}

export function Sidebar({ counts, mobile, onNavigate }: SidebarProps) {
  const { can, user } = useAuth()
  const { sidebarCollapsed, toggleSidebar } = useData()
  const location = useLocation()
  const collapsed = mobile ? false : sidebarCollapsed
  const roleId = (user?.roleId ?? 'requestor') as RoleId

  const sections = useMemo(
    () =>
      NAV_SECTIONS.map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          if (item.roles && !item.roles.includes(roleId)) return false
          if (item.permission && !can(item.permission)) return false
          return true
        }),
      })).filter((section) => section.items.length > 0),
    [can, roleId],
  )

  const isItemActive = (item: NavItem) =>
    item.match ? location.pathname === item.match || location.pathname.startsWith(`${item.match}/`) : location.pathname === item.to

  return (
    <aside
      className={cn(
        'flex h-full min-h-0 flex-col border-r border-brand-700/60 bg-brand-600 text-brand-50',
        collapsed ? 'w-[4.5rem]' : 'w-68',
      )}
    >
      <div className={cn('flex items-center gap-2 px-4 pb-3 pt-4', collapsed && 'justify-center px-2')}>
        <BrandLockup size="sm" compact={collapsed} onDark />
        {mobile ? (
          <button
            type="button"
            onClick={onNavigate}
            aria-label="Close navigation"
            className="ml-auto rounded-lg p-1.5 text-brand-50 transition-colors hover:bg-brand-700"
          >
            <PanelLeftClose aria-hidden className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <FlagRule className="opacity-90" />

      <nav aria-label="Main" className="scrollbar-none min-h-0 flex-1 space-y-5 overflow-y-auto px-2.5 py-4">
        {sections.map((section) => (
          <div key={section.id}>
            {section.label && !collapsed ? (
              <p className="mb-1.5 px-2.5 text-2xs font-semibold uppercase tracking-wider text-brand-100">
                {section.label}
              </p>
            ) : null}
            {section.label && collapsed ? <div aria-hidden className="mx-2 mb-2 h-px bg-brand-500" /> : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = isItemActive(item)
                const badgeValue = item.badge ? counts[item.badge] : 0
                const link = (
                  <NavLink
                    to={item.to}
                    end={item.end}
                    onClick={onNavigate}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                      // Collapsed items sit inside an inline-flex tooltip wrapper, so
                      // they need an explicit full width for `justify-center` to bite.
                      collapsed && 'w-full justify-center px-0',
                      active
                        ? 'bg-white text-brand-700 shadow-sm'
                        : 'text-brand-50 hover:bg-brand-700 hover:text-white',
                    )}
                  >
                    <NavIcon name={item.icon} className="h-4.5 w-4.5 shrink-0" />
                    {collapsed ? null : (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {badgeValue > 0 ? (
                          <CountPill
                            value={badgeValue}
                            tone={item.badge === 'overdue' ? 'danger' : active ? 'brand' : 'neutral'}
                            className={cn(!active && 'bg-brand-800 text-white ring-brand-700')}
                          />
                        ) : null}
                      </>
                    )}
                    {collapsed && badgeValue > 0 ? (
                      <span aria-hidden className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-crest-400" />
                    ) : null}
                  </NavLink>
                )

                return (
                  <li key={`${section.id}-${item.to}-${item.label}`} className="relative">
                    {collapsed ? (
                      <Tooltip side="right" content={item.label} className="w-full">
                        {link}
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {mobile ? null : (
        <div className="border-t border-brand-700/60 p-2.5">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-brand-50 transition-colors hover:bg-brand-700 hover:text-white',
              collapsed && 'justify-center px-0',
            )}
          >
            {collapsed ? (
              <ChevronsRight aria-hidden className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft aria-hidden className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </aside>
  )
}
