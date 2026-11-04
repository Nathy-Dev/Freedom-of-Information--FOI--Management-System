/**
 * Auth + identity API adapter — wraps Convex queries/mutations for AuthContext.
 */
import { useConvexAuth, useMutation, useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import type { User, Role, Permission } from '@/types'
import { mapUser } from './transform'

export interface MeResult {
  user: User
  role: Role
  permissions: Permission[]
  isReadOnly: boolean
  homeRoute: string
}

/**
 * Reactive current user + role + permissions.
 *
 * Returns `undefined` while loading and `null` when signed out. The query is
 * enabled by Convex's authenticated state, so it cannot race token setup.
 */
export function useMe(): MeResult | null | undefined {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const result = useQuery(api.queries.auth.me, !isLoading && isAuthenticated ? {} : 'skip') as
    | (Omit<MeResult, 'user'> & { user: unknown })
    | null
    | undefined
  // `undefined` = loading; `null` = definitely no session.
  if (isLoading) return undefined
  if (!isAuthenticated) return null
  if (result == null) return result
  return { ...result, user: mapUser(result.user) } as MeResult
}

/** Team member ids for row-scoping. */
export function useTeamMemberIds(): string[] | undefined {
  const { isLoading, isAuthenticated } = useConvexAuth()
  const enabled = !isLoading && isAuthenticated
  const result = useQuery(api.queries.auth.teamMemberIds, enabled ? {} : 'skip') as string[] | undefined
  return enabled ? result : []
}


/** Update the user profile (name/contact/position). */
export function useUpdateProfile() {
  const update = useMutation(api.auth.updateMyProfile)
  return async (patch: Partial<User>) => {
    await update({
      name: patch.name,
      phone: patch.phone,
      organization: patch.organization,
      position: patch.position,
      department: patch.department,
      mfaEnabled: patch.mfaEnabled,
    })
  }
}

/** Ensure the live auth identity has its application user profile. */
export function useEnsureMyProfile() {
  const ensure = useMutation(api.auth.ensureMyProfile)
  return async () => mapUser(await ensure({}))
}
