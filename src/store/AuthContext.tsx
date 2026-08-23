import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Permission, RoleId, User } from '@/types'
import { getRole, hasPermission, homeRouteFor, isReadOnly, permissionsFor } from '@/lib/rbac'
import { delay } from '@/lib/utils'
import { reference, usersById } from '@/mocks/db'
import { logAudit } from '@/mocks/api'

const SESSION_KEY = 'hyprep-foi.session'

export type LoginOutcome =
  | { status: 'mfa_required'; userId: string }
  | { status: 'success'; user: User }
  | { status: 'error'; message: string }

interface AuthContextValue {
  user: User | null
  role: ReturnType<typeof getRole>
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
  loginAs: (userId: string) => Promise<LoginOutcome>
  switchRole: (roleId: RoleId) => void
  logout: () => void
  updateProfile: (patch: Partial<User>) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** The prototype accepts any password of a plausible length; MFA is simulated. */
const DEMO_PASSWORD_MIN = 4
export const DEMO_MFA_CODE = '123456'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [pendingMfaUserId, setPendingMfaUserId] = useState<string | null>(null)
  const [isBooting, setIsBooting] = useState(true)

  // Restore the session so a page refresh during a review does not sign the
  // reviewer out mid-demonstration.
  useEffect(() => {
    const stored = window.localStorage.getItem(SESSION_KEY)
    if (stored) {
      const restored = usersById.get(stored)
      if (restored) setUser(restored)
    }
    setIsBooting(false)
  }, [])

  const persist = useCallback((next: User | null) => {
    setUser(next)
    if (next) window.localStorage.setItem(SESSION_KEY, next.id)
    else window.localStorage.removeItem(SESSION_KEY)
  }, [])

  const completeSignIn = useCallback(
    (candidate: User): LoginOutcome => {
      candidate.lastLoginAt = new Date().toISOString()
      persist(candidate)
      setPendingMfaUserId(null)
      logAudit('Session', candidate.id, candidate.name, 'login', candidate.id, 'Successful sign-in.')
      return { status: 'success', user: candidate }
    },
    [persist],
  )

  const login = useCallback(
    async (email: string, password: string): Promise<LoginOutcome> => {
      await delay(520)
      const candidate = reference.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())

      if (!candidate || password.trim().length < DEMO_PASSWORD_MIN) {
        if (candidate) {
          logAudit('Session', candidate.id, candidate.name, 'login_failed', candidate.id, 'Sign-in failed: incorrect password.')
        }
        return { status: 'error', message: 'Those credentials do not match an account on this system.' }
      }
      if (candidate.status === 'suspended') {
        return { status: 'error', message: 'This account is suspended. Contact the system administrator.' }
      }
      if (candidate.status === 'invited') {
        return { status: 'error', message: 'This account has not been activated. Please use the link in your invitation email.' }
      }

      // FR-005: privileged roles must complete a second factor.
      if (candidate.mfaEnabled) {
        setPendingMfaUserId(candidate.id)
        return { status: 'mfa_required', userId: candidate.id }
      }
      return completeSignIn(candidate)
    },
    [completeSignIn],
  )

  const verifyMfa = useCallback(
    async (code: string): Promise<LoginOutcome> => {
      await delay(460)
      if (!pendingMfaUserId) return { status: 'error', message: 'The sign-in session expired. Please try again.' }
      const candidate = usersById.get(pendingMfaUserId)
      if (!candidate) return { status: 'error', message: 'The sign-in session expired. Please try again.' }
      if (code.trim() !== DEMO_MFA_CODE) {
        logAudit('Session', candidate.id, candidate.name, 'login_failed', candidate.id, 'Multi-factor verification failed.')
        return { status: 'error', message: 'That verification code is not correct.' }
      }
      return completeSignIn(candidate)
    },
    [pendingMfaUserId, completeSignIn],
  )

  const loginWithSso = useCallback(async (): Promise<LoginOutcome> => {
    await delay(880)
    // Entra ID returns the first mapped staff account in this prototype.
    const candidate = usersById.get('usr-004')
    if (!candidate) return { status: 'error', message: 'Single sign-on is not available.' }
    logAudit('Session', candidate.id, candidate.name, 'login', candidate.id, 'Signed in via Microsoft Entra ID single sign-on.')
    return completeSignIn(candidate)
  }, [completeSignIn])

  /** Demo convenience: jump straight into any role from the login screen. */
  const loginAs = useCallback(
    async (userId: string): Promise<LoginOutcome> => {
      await delay(320)
      const candidate = usersById.get(userId)
      if (!candidate) return { status: 'error', message: 'That demo account is not available.' }
      return completeSignIn(candidate)
    },
    [completeSignIn],
  )

  const cancelMfa = useCallback(() => setPendingMfaUserId(null), [])

  /** Lets a reviewer see the same account through a different role's lens. */
  const switchRole = useCallback(
    (roleId: RoleId) => {
      if (!user) return
      const next: User = { ...user, roleId }
      persist(next)
    },
    [user, persist],
  )

  const logout = useCallback(() => {
    if (user) logAudit('Session', user.id, user.name, 'logout', user.id, 'Signed out.')
    persist(null)
    setPendingMfaUserId(null)
  }, [user, persist])

  const updateProfile = useCallback(
    (patch: Partial<User>) => {
      if (!user) return
      const stored = usersById.get(user.id)
      if (stored) Object.assign(stored, patch, { updatedAt: new Date().toISOString() })
      persist({ ...user, ...patch })
    },
    [user, persist],
  )

  const value = useMemo<AuthContextValue>(() => {
    const roleId = (user?.roleId ?? 'requestor') as RoleId
    return {
      user,
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
      loginAs,
      switchRole,
      logout,
      updateProfile,
    }
  }, [user, isBooting, pendingMfaUserId, login, loginWithSso, verifyMfa, cancelMfa, loginAs, switchRole, logout, updateProfile])

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
