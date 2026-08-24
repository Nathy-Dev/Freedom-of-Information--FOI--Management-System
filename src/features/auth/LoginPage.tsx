import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, KeyRound, Lock, Mail, ShieldCheck } from 'lucide-react'
import { Button, Checkbox, Input, UserAvatar } from '@/components/ui'
import { ROLE_LABELS } from '@/lib/constants'
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

  /* Refusals are set as a notice against a rule, not as a rounded alert pill. */
  const errorBanner = error ? (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-r-lg border-l-2 border-crest-500 bg-crest-50 px-3.5 py-3 text-sm text-crest-800"
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
        eyebrow="Second factor"
        title="Two-step verification"
        description="This account holds a privileged role, so a code from your authenticator is required before the session opens."
      >
        <form onSubmit={submitMfa} className="space-y-5">
          {errorBanner}

          {pending ? (
            <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50/70 px-3.5 py-3">
              <UserAvatar user={pending} size="sm" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{pending.name}</p>
                <p className="truncate font-mono text-2xs uppercase tracking-[0.16em] text-ink-500">
                  {ROLE_LABELS[pending.roleId]}
                </p>
              </div>
            </div>
          ) : null}

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
            className="h-14 pl-9 pr-4 text-center font-mono text-lg tracking-[0.45em]"
            required
          />

          <div className="space-y-2.5">
            <Button
              type="submit"
              size="lg"
              fullWidth
              isLoading={busy === 'mfa'}
              disabled={code.length < 6}
            >
              Verify and continue
            </Button>
            <Button type="button" variant="ghost" fullWidth onClick={cancelMfa}>
              Use a different account
            </Button>
          </div>
        </form>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Registry access"
      title="Sign in"
      description="For officers of the HYPREP Legal Unit, and for members of the public tracking a request they have already filed."
      footer={
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="flex items-center gap-2.5 font-mono text-2xs uppercase tracking-[0.2em] text-ink-500">
              <span aria-hidden className="h-3 w-0.5 shrink-0 bg-ink-300" />
              Demonstration accounts
            </p>
            <span className="shrink-0 rounded-full border border-gold-300 bg-gold-50 px-2 py-0.5 font-mono text-2xs uppercase tracking-[0.14em] text-gold-700">
              Prototype
            </span>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-ink-500">
            This build holds no live records. Enter as any user class to see the register under that
            permission set — no password required.
          </p>
          <div className="mt-4">
            <DemoAccountPicker
              variant="ledger"
              onPicked={(userId) => land(usersById.get(userId)?.roleId ?? 'requestor')}
            />
          </div>
        </div>
      }
    >
      <form onSubmit={submitCredentials} className="space-y-5">
        {errorBanner}

        <Input
          label="Work email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          leadingIcon={<Mail aria-hidden className="h-4 w-4" />}
          placeholder="name@hyprep.gov.ng"
          className="h-11"
          required
        />

        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          leadingIcon={<Lock aria-hidden className="h-4 w-4" />}
          className="h-11"
          labelSuffix={
            <Link
              to="/forgot-password"
              className="font-mono text-2xs uppercase tracking-[0.14em] text-brand-700 hover:text-brand-800 hover:underline"
            >
              Forgot password?
            </Link>
          }
          trailingSlot={
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="rounded-md p-1 text-ink-400 hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
            >
              {showPassword ? (
                <EyeOff aria-hidden className="h-4 w-4" />
              ) : (
                <Eye aria-hidden className="h-4 w-4" />
              )}
            </button>
          }
          required
        />

        <Checkbox
          label="Keep me signed in on this device"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />

        <Button type="submit" size="lg" fullWidth isLoading={busy === 'password'}>
          Sign in
        </Button>
      </form>

      <div className="my-7 flex items-center gap-3">
        <span className="h-px flex-1 bg-ink-200" />
        <span className="font-mono text-2xs uppercase tracking-[0.2em] text-ink-400">or</span>
        <span className="h-px flex-1 bg-ink-200" />
      </div>

      {/* Federated sign-in named for what it is, rather than left as a bare button. */}
      <div className="rounded-xl border border-ink-200 bg-ink-50/70 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">Staff single sign-on</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Federated through the Federal Ministry of Environment tenant. Privileged roles are
              challenged for a second factor on every session.
            </p>
          </div>
          <ShieldCheck aria-hidden className="mt-0.5 h-4.5 w-4.5 shrink-0 text-brand-600" />
        </div>
        <Button
          type="button"
          variant="outline"
          fullWidth
          isLoading={busy === 'sso'}
          onClick={submitSso}
          className="mt-3.5 bg-white"
        >
          Continue with Microsoft Entra ID
        </Button>
      </div>

      <p className="mt-6 text-sm leading-relaxed text-ink-600">
        Making a request as a member of the public?{' '}
        <Link
          to="/register"
          className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600"
        >
          Create a requestor account
        </Link>{' '}
        — the right of access under section 1 of the Freedom of Information Act 2011 belongs to any
        person.
      </p>
    </AuthLayout>
  )
}
