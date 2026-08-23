import type { ReactNode } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import type { Permission, RoleId } from '@/types'
import { BrandLockup } from '@/components/common'
import { Spinner } from '@/components/ui'
import { useAuth } from '@/store/AuthContext'
import { ForbiddenPage } from '@/features/misc/ForbiddenPage'

/** Shown while the session is restored from storage, so no screen flashes twice. */
export function BootSplash() {
  return (
    <div className="auth-canvas flex min-h-screen flex-col items-center justify-center gap-6 text-brand-50">
      <BrandLockup size="lg" onDark subtitle="Freedom of Information Management System" />
      <div className="flex items-center gap-2 text-sm text-brand-100">
        <Spinner className="h-4 w-4" />
        Restoring your session…
      </div>
    </div>
  )
}

/**
 * Route-level authentication. An unauthenticated visitor is sent to sign-in
 * with the attempted path preserved, so they land where they meant to go.
 */
export function RequireAuth() {
  const { isAuthenticated, isBooting } = useAuth()
  const location = useLocation()

  if (isBooting) return <BootSplash />
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return <Outlet />
}

/** Sign-in, registration and recovery are unreachable once signed in. */
export function RequireAnonymous() {
  const { isAuthenticated, isBooting, homeRoute } = useAuth()

  if (isBooting) return <BootSplash />
  if (isAuthenticated) return <Navigate to={homeRoute} replace />
  return <Outlet />
}

export interface RequirePermissionProps {
  permission?: Permission | Permission[]
  mode?: 'any' | 'all'
  /** Restrict to specific roles even where the permission is broader. */
  roles?: RoleId[]
  children?: ReactNode
}

/**
 * FR-003: the route guard. A denied route renders the 403 explainer in place
 * rather than redirecting, so the address bar still shows what was attempted
 * and the user can quote it when requesting access.
 */
export function RequirePermission({ permission, mode = 'any', roles, children }: RequirePermissionProps) {
  const { can, user } = useAuth()

  const roleId = (user?.roleId ?? 'requestor') as RoleId
  const roleAllowed = !roles || roles.includes(roleId)
  const permissionAllowed = !permission || can(permission, mode)

  if (!roleAllowed || !permissionAllowed) return <ForbiddenPage />
  return <>{children ?? <Outlet />}</>
}

/** `/` resolves to the dashboard the signed-in role actually owns. */
export function HomeRedirect() {
  const { isAuthenticated, isBooting, homeRoute } = useAuth()

  if (isBooting) return <BootSplash />
  return <Navigate to={isAuthenticated ? homeRoute : '/login'} replace />
}
