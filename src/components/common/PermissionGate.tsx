import type { ReactNode } from 'react'
import type { Permission } from '@/types'
import { useAuth } from '@/store/AuthContext'

export interface PermissionGateProps {
  permission: Permission | Permission[]
  mode?: 'any' | 'all'
  children: ReactNode
  fallback?: ReactNode
  /** Additionally require a writable role (hides actions from the Auditor). */
  requireWrite?: boolean
}

/**
 * Hides an affordance the signed-in role may not use. Route-level guarding is
 * handled separately in the router; this is for buttons, menu items and panels.
 */
export function PermissionGate({ permission, mode = 'any', children, fallback = null, requireWrite }: PermissionGateProps) {
  const { can, isReadOnly } = useAuth()
  if (requireWrite && isReadOnly) return <>{fallback}</>
  if (!can(permission, mode)) return <>{fallback}</>
  return <>{children}</>
}

/** Convenience wrapper for content that only writable roles may act on. */
export function WriteOnly({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { isReadOnly } = useAuth()
  return <>{isReadOnly ? fallback : children}</>
}
