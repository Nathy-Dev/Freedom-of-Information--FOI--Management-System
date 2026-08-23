import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Button, Checkbox, Input } from '@/components/ui'
import { useAuth, DEMO_MFA_CODE } from '@/store/AuthContext'
import { homeRouteFor } from '@/lib/rbac'
import { usersById } from '@/mocks/db'
import { AuthLayout } from './AuthLayout'
import { DemoAccountPicker } from './DemoAccountPicker'

export function LoginPage() {
  const { login, loginWithSso, verifyMfa, cancelMfa, pendingMfaUserId } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const intended = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<'password' | 'sso' | 'mfa' | null>(null)

  const land = (roleId: string) => navigate(intended ?? homeRouteFor(roleId), { replace: true })

  const submitCredentials = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy('password')
    const outcome = await login(email, password)
    setBusy(null)
    if (outcome.status === 'error') setError(outcome.message)
    else if (outcome.status === 'success') land(outcome.user.roleId)
  }

  const submitSso = async () => {
    setError(null)
    setBusy('sso')
    const outcome = await loginWithSso()
    setBusy(null)
    if (outcome.status === 'error') setError(outcome.message)
    else if (outcome.status === 'success') land(outcome.user.roleId)
  }

  const submitMfa = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy('mfa')
    const outcome = await verifyMfa(code)
    setBusy(null)
    if (outcome.status === 'error') setError(outcome.message)
    else if (outcome.status === 'success') land(outcome.user.roleId)
  }

  const errorBanner = error ? (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-crest-200 bg-crest-50 px-3.5 py-3 text-sm text-crest-800"
    >
      <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{error}</span>
    </div>
  ) : null

  // Stage two: the second factor for privileged roles (FR-005).
  if (pendingMfaUserId) {
    const pending = usersById.get(pendingMfaUserId)
    return (
      <AuthLayout
        title="Two-step verification"
        description={
          <>
            Enter the 6-digit code from your authenticator app to finish signing in as{' '}
            <span className="font-medium text-ink-800">{pending?.name ?? 'this account'}</span>.
          </>
        }
      >
        <form onSubmit={submitMfa} className="space-y-4">
          {errorBanner}
          <Input
            label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
            leadingIcon={<KeyRound aria-hidden className="h-4 w-4" />}
            placeholder="000000"
            hint={`Demo code: ${DEMO_MFA_CODE}`}
            className="tracking-[0.4em]"
            required
          />
          <Button type="submit" fullWidth isLoading={busy === 'mfa'} disabled={code.length < 6}>
            Verify and continue
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={cancelMfa}>
            Use a different account
          </Button>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Sign in"
      description="Use your HYPREP staff account, or the requestor account you registered on the public portal."
      footer={
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
            Demonstration accounts
          </p>
          <p className="mt-1 text-xs text-ink-500">
            This prototype runs on mock data. Choose a role to explore the screens it can reach.
          </p>
          <div className="mt-3">
            <DemoAccountPicker onPicked={(userId) => land(usersById.get(userId)?.roleId ?? 'requestor')} />
          </div>
        </div>
      }
    >
      <form onSubmit={submitCredentials} className="space-y-4">
        {errorBanner}
        <Input
          label="Work email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          leadingIcon={<Mail aria-hidden className="h-4 w-4" />}
          placeholder="name@hyprep.gov.ng"
          required
        />
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          leadingIcon={<Lock aria-hidden className="h-4 w-4" />}
          trailingSlot={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="rounded-md p-1 text-ink-400 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              {showPassword ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
            </button>
          }
          required
        />

        <div className="flex items-center justify-between gap-3">
          <Checkbox
            label="Keep me signed in"
            checked={remember}
            onChange={(event) => setRemember(event.target.checked)}
          />
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" fullWidth isLoading={busy === 'password'}>
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-200" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-400">or</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      <Button
        type="button"
        variant="outline"
        fullWidth
        isLoading={busy === 'sso'}
        onClick={submitSso}
        leadingIcon={<ShieldCheck aria-hidden className="h-4 w-4" />}
      >
        Continue with Microsoft Entra ID
      </Button>

      <p className="mt-5 text-center text-sm text-ink-600">
        Making a request as a member of the public?{' '}
        <Link to="/register" className="font-medium text-brand-700 hover:underline">
          Create a requestor account
        </Link>
      </p>
    </AuthLayout>
  )
}
