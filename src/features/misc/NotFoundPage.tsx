import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Compass, FileQuestion, LifeBuoy, Search } from 'lucide-react'
import { Badge, ButtonLink, Card, CardBody } from '@/components/ui'
import type { RoleId } from '@/types'
import { NAV_SECTIONS } from '@/lib/navigation'
import { useAuth } from '@/store/AuthContext'

/** 404. Suggests the pages the signed-in role can actually reach. */
export function NotFoundPage() {
  const { isAuthenticated, homeRoute, can, user } = useAuth()
  const location = useLocation()

  // Mirrors the sidebar's own filter so we never suggest a page the role cannot open.
  const roleId = (user?.roleId ?? 'requestor') as RoleId
  const suggestions = NAV_SECTIONS.flatMap((section) => section.items)
    .filter((item) => {
      if (item.roles && !item.roles.includes(roleId)) return false
      if (item.permission && !can(item.permission)) return false
      return true
    })
    .slice(0, 6)

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-500">
        <FileQuestion className="h-7 w-7" />
      </span>

      <Badge tone="neutral" className="mt-4">
        404 — Page not found
      </Badge>

      <h1 className="mt-3 text-2xl font-semibold text-ink-900">We could not find that page</h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-600">
        The address <span className="font-mono text-xs text-ink-800">{location.pathname}</span> does not match anything in
        the FOI Management System. It may have been renamed, or the link that brought you here may be out of date.
      </p>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <ButtonLink to={isAuthenticated ? homeRoute : '/login'} leadingIcon={<ArrowLeft className="h-4 w-4" />}>
          {isAuthenticated ? 'Back to my dashboard' : 'Go to sign-in'}
        </ButtonLink>
        {isAuthenticated ? (
          <ButtonLink to="/search" variant="secondary" leadingIcon={<Search className="h-4 w-4" />}>
            Search everything
          </ButtonLink>
        ) : null}
        <ButtonLink to="/help" variant="ghost" leadingIcon={<LifeBuoy className="h-4 w-4" />}>
          Help & guidance
        </ButtonLink>
      </div>

      {isAuthenticated && suggestions.length > 0 ? (
        <Card className="mt-7 w-full text-left">
          <CardBody>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              <Compass className="h-3.5 w-3.5" />
              Where you can go
            </p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {suggestions.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="block rounded-lg border border-ink-200 p-3 transition-colors hover:border-brand-300 hover:bg-brand-50"
                  >
                    <p className="text-sm font-medium text-ink-900">{item.label}</p>
                    {item.description ? <p className="mt-0.5 text-xs text-ink-500">{item.description}</p> : null}
                  </Link>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
