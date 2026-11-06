import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useConvexAuth, useMutation } from 'convex/react'
import type { Permission, Role, RoleId, User } from '@/types'
import { getRole, hasPermission, homeRouteFor, isReadOnly, permissionsFor } from '@/lib/rbac'
import { useEnsureMyProfile, useMe, useUpdateProfile } from '@/api/auth'
import { authClient } from '@/convexClient'
import type { MeResult } from '@/api/auth'
import { api } from '../../convex/_generated/api'
import { usePublicSettings } from '@/api/directory'

/**
 * AuthContext — backed by Better Auth + Convex.
 *
 * - `me` comes from the `auth:me` Convex query (reactively).
 * - Sign-in / MFA / SSO / logout go through the Better Auth client.
 *
 * The login flow intentionally does NOT call ensureMyProfile inline.
 * The Better Auth session is established first; the Convex JWT propagates
 * asynchronously via ConvexBetterAuthProvider. Once useConvexAuth reports
 * isAuthenticated, an effect calls ensureMyProfile to repair any missing
 * profile row, and the reactive `me` query resolves the user for the guards.
 */

export type LoginOutcome =
  | { status: 'mfa_required'; userId: string }
  | { status: 'success' }
  | { status: 'error'; message: string }

interface AuthContextValue {
  securityRequired: string | null
  user: User | null
  role: Role
  permissions: Permission[]
  isAuthenticated: boolean
  isReadOnly: boolean
  isBooting: boolean
  pendingMfaUserId: string | null
  homeRoute: string
  can: (permission: Permission | Permission[], mode?: 'any' | 'all') => boolean
  login: (email: string, password: string) => Promise<LoginOutcome>
  loginWithSso: () => Promise<LoginOutcome>
  verifyMfa: (code: string) => Promise<LoginOutcome>
  cancelMfa: () => void
  logout: () => Promise<void>
  updateProfile: (patch: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated: hasLiveSession } = useConvexAuth()
  const me = useMe()
  const touch = useMutation(api.auth.touch)
  const publicSettings = usePublicSettings()
  const updateProfileMutation = useUpdateProfile()
  const ensureMyProfile = useEnsureMyProfile()
  const [pendingMfaUserId, setPendingMfaUserId] = useState<string | null>(null)

  // `me` is `undefined` while the Convex query is in-flight (loading), and
  // `null` once it resolves with no authenticated user. Treat the loading state
  // as booting so guards don't redirect to /login before the session arrives.
  const isBooting = me === undefined

  // Once the Convex JWT is live and the `me` query returns null (no profile
  // row yet), fire ensureMyProfile exactly once to auto-repair.
  const ensuredRef = useRef(false)
  useEffect(() => {
    if (hasLiveSession && me === null && !ensuredRef.current) {
      ensuredRef.current = true
      ensureMyProfile().catch(() => {})
    }
    if (!hasLiveSession) ensuredRef.current = false
  }, [hasLiveSession, me, ensureMyProfile])

  const user: User | null = useMemo(() => {
    const result = me as MeResult | null | undefined
    return result?.user ?? null
  }, [me])

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      try {
        const res = await authClient.signIn.email({ email, password })
        if (res.error) {
          return { status: 'error', message: res.error.message ?? 'Those credentials do not match an account on this system.' }
        }
        // Better Auth returns `twoFactorRedirect: true` when the account has
        // 2FA enabled. No session is issued until the second factor is
        // verified, so the UI must switch to the MFA stage.
        const data = res.data as { twoFactorRedirect?: boolean } | null | undefined
        if (data?.twoFactorRedirect) {
          setPendingMfaUserId(email)
          return { status: 'mfa_required', userId: email }
        }
        // Session is set — the Convex provider will sync the JWT
        // asynchronously. The route guards handle redirection once `me` resolves.
        return { status: 'success' }
      } catch {
        return { status: 'error', message: 'Sign-in failed. Please try again.' }
      }
    },
    [],
  )

  const verifyMfa = useCallback(
    async (code: string): Promise<LoginOutcome> => {
      try {
        const res = await authClient.twoFactor.verifyTotp({ code })
        if (res.error) {
          return { status: 'error', message: 'That verification code is not correct.' }
        }
        setPendingMfaUserId(null)
        return { status: 'success' }
      } catch {
        return { status: 'error', message: 'Verification failed. Please try again.' }
      }
    },
    [],
  )

  const loginWithSso = useCallback(async (): Promise<LoginOutcome> => {
    try {
      const response = await authClient.signIn.social({ provider: 'microsoft-entra-id', callbackURL: '/' })
      if (response.error) return { status: 'error', message: response.error.message ?? 'Staff single sign-on is unavailable.' }
      return { status: 'success' }
    } catch {
      return { status: 'error', message: 'Single sign-on is not available.' }
    }
  }, [])

  const cancelMfa = useCallback(() => setPendingMfaUserId(null), [])

  const logout = useCallback(async () => {
    setPendingMfaUserId(null)
    try {
      await authClient.signOut()
    } catch {
      // Best-effort; the session clears on next load regardless.
    }
  }, [])

  useEffect(() => {
    if (!user || user.status !== 'active') return
    let lastActivity = Date.now()
    let lastSent = 0
    const ping = () => {
      if (document.visibilityState === 'hidden') return
      lastActivity = Date.now()
      if (lastActivity - lastSent > 60000) {
        lastSent = lastActivity
        void touch({}).catch(() => void logout())
      }
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll'] as const
    events.forEach((event) => window.addEventListener(event, ping, { passive: true }))
    const timer = window.setInterval(() => {
      if (publicSettings?.sessionTimeoutMinutes && Date.now() - lastActivity > publicSettings.sessionTimeoutMinutes * 60000) void logout()
    }, 10000)
    return () => {
      events.forEach((event) => window.removeEventListener(event, ping))
      window.clearInterval(timer)
    }
  }, [user?.id, user?.status, touch, logout, publicSettings?.sessionTimeoutMinutes])

  const updateProfile = useCallback((patch: Partial<User>) => updateProfileMutation(patch), [updateProfileMutation])

  const value = useMemo<AuthContextValue>(() => {
    const roleId = (user?.roleId ?? 'requestor') as RoleId
    return {
      user,
      securityRequired: me?.securityRequired ?? null,
      role: getRole(roleId),
      permissions: user ? permissionsFor(roleId) : [],
      isAuthenticated: Boolean(user),
      isReadOnly: user ? isReadOnly(roleId) : false,
      isBooting,
      pendingMfaUserId,
      homeRoute: homeRouteFor(roleId),
      can: (permission, mode = 'any') => (user ? hasPermission(roleId, permission, mode) : false),
      login,
      loginWithSso,
      verifyMfa,
      cancelMfa,
      logout,
      updateProfile,
    }
  }, [user, me, isBooting, pendingMfaUserId, login, loginWithSso, verifyMfa, cancelMfa, logout, updateProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider')
  return context
}

/** Convenience for screens that only render behind a guard. */
export function useCurrentUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useCurrentUser called outside an authenticated route')
  return user
}
