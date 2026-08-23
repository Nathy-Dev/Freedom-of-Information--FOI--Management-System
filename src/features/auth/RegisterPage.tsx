import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, CheckCircle2, Mail, Phone, User as UserIcon } from 'lucide-react'
import { Button, Checkbox, Input, Progress } from '@/components/ui'
import { delay } from '@/lib/utils'
import { reference } from '@/mocks/db'
import { useToast } from '@/store/ToastContext'
import { AuthLayout } from './AuthLayout'

const MIN_LENGTH = reference.systemSettings.passwordMinLength

/** Scores a candidate password against the policy in FR-004. */
function scorePassword(value: string) {
  const checks = [
    { label: `At least ${MIN_LENGTH} characters`, ok: value.length >= MIN_LENGTH },
    { label: 'An uppercase letter', ok: /[A-Z]/.test(value) },
    { label: 'A lowercase letter', ok: /[a-z]/.test(value) },
    { label: 'A number', ok: /\d/.test(value) },
    { label: 'A symbol', ok: /[^A-Za-z0-9]/.test(value) },
  ]
  const met = checks.filter((check) => check.ok).length
  return { checks, met, percent: Math.round((met / checks.length) * 100) }
}

export function RegisterPage() {
  const navigate = useNavigate()
  const toast = useToast()
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    organization: '',
    password: '',
    confirm: '',
  })
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const strength = useMemo(() => scorePassword(form.password), [form.password])
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password
  const canSubmit = strength.met === strength.checks.length && !mismatch && accepted && form.name.length > 2

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!canSubmit) return
    setBusy(true)
    await delay(760)
    setBusy(false)
    toast.success(
      'Account request submitted',
      'Check your email for the activation link. You can then sign in and file a request.',
    )
    navigate('/login', { replace: true })
  }

  return (
    <AuthLayout
      title="Create a requestor account"
      description="Any person may request information held by HYPREP under section 1 of the Freedom of Information Act 2011. You do not need to give a reason for your request."
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Full name"
          value={form.name}
          onChange={set('name')}
          leadingIcon={<UserIcon aria-hidden className="h-4 w-4" />}
          autoComplete="name"
          required
        />
        <Input
          label="Email address"
          type="email"
          value={form.email}
          onChange={set('email')}
          leadingIcon={<Mail aria-hidden className="h-4 w-4" />}
          hint="Acknowledgements and determinations are sent here."
          autoComplete="email"
          required
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Phone number"
            value={form.phone}
            onChange={set('phone')}
            leadingIcon={<Phone aria-hidden className="h-4 w-4" />}
            placeholder="+234..."
            autoComplete="tel"
          />
          <Input
            label="Organisation"
            value={form.organization}
            onChange={set('organization')}
            leadingIcon={<Building2 aria-hidden className="h-4 w-4" />}
            hint="Optional"
          />
        </div>

        <Input
          label="Password"
          type="password"
          value={form.password}
          onChange={set('password')}
          autoComplete="new-password"
          required
        />

        {form.password.length > 0 ? (
          <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3">
            <Progress
              value={strength.percent}
              barClassName={
                strength.percent === 100
                  ? 'bg-brand-500'
                  : strength.percent >= 60
                    ? 'bg-gold-400'
                    : 'bg-crest-500'
              }
              label="Password strength"
            />
            <ul className="mt-2.5 grid gap-1 sm:grid-cols-2">
              {strength.checks.map((check) => (
                <li
                  key={check.label}
                  className={check.ok ? 'flex items-center gap-1.5 text-xs text-brand-700' : 'flex items-center gap-1.5 text-xs text-ink-500'}
                >
                  <CheckCircle2
                    aria-hidden
                    className={check.ok ? 'h-3.5 w-3.5 text-brand-600' : 'h-3.5 w-3.5 text-ink-300'}
                  />
                  {check.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <Input
          label="Confirm password"
          type="password"
          value={form.confirm}
          onChange={set('confirm')}
          autoComplete="new-password"
          error={mismatch ? 'The two passwords do not match.' : undefined}
          required
        />

        <Checkbox
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          label="I confirm the information above is accurate"
          description="Your name and organisation appear on the case file and may be disclosed in HYPREP's annual FOI report to the Attorney-General."
        />

        <Button type="submit" fullWidth isLoading={busy} disabled={!canSubmit}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-600">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
