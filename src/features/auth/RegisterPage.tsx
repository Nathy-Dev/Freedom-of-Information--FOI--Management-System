import { useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Building2, Check, Eye, EyeOff, Mail, Minus, Phone, User as UserIcon } from 'lucide-react'
import { Button, Checkbox, Input } from '@/components/ui'
import { formatDate } from '@/lib/format'
import { cn, delay } from '@/lib/utils'
import { reference } from '@/mocks/db'
import { useToast } from '@/store/ToastContext'
import { AuthLayout } from './AuthLayout'

const MIN_LENGTH = reference.systemSettings.passwordMinLength
const ROTATION_DAYS = reference.systemSettings.passwordRotationDays

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
  return { checks, met }
}

/**
 * One numbered part of the application, headed like a clause of a statutory
 * form: mark in the gutter, title on a rule, then the fields it governs.
 */
function FormPart({
  mark,
  title,
  note,
  children,
}: {
  mark: string
  title: string
  note?: ReactNode
  children: ReactNode
}) {
  return (
    <section>
      <header className="flex items-baseline gap-3 border-b border-ink-200 pb-2.5">
        <span aria-hidden className="font-mono text-xs font-medium tabular-nums text-brand-600">
          {mark}
        </span>
        <h2 className="font-serif text-base leading-snug text-ink-900">{title}</h2>
      </header>
      {note ? <p className="mt-2.5 text-xs leading-relaxed text-ink-500">{note}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  )
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
  const [showPassword, setShowPassword] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)

  const set = (key: keyof typeof form) => (event: { target: { value: string } }) =>
    setForm((current) => ({ ...current, [key]: event.target.value }))

  const strength = useMemo(() => scorePassword(form.password), [form.password])
  const mismatch = form.confirm.length > 0 && form.confirm !== form.password
  const compliant = strength.met === strength.checks.length
  const canSubmit = compliant && !mismatch && accepted && form.name.trim().length > 2
  const declaredOn = useMemo(() => formatDate(new Date()), [])

  const verdict = compliant
    ? { label: 'Meets policy', text: 'text-brand-700', fill: 'bg-brand-500' }
    : strength.met >= 3
      ? { label: 'Short of policy', text: 'text-gold-700', fill: 'bg-gold-400' }
      : { label: 'Insufficient', text: 'text-crest-700', fill: 'bg-crest-500' }

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
      wide
      panel="public"
      eyebrow="Public request portal"
      title="Application for a requestor account"
      description="Complete the four parts below. An account lets you file a request, follow the statutory clock against it and appeal a determination."
      footer={
        <p className="text-center text-sm text-ink-600">
          Already registered?{' '}
          <Link
            to="/login"
            className="font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600"
          >
            Sign in instead
          </Link>
        </p>
      }
    >
      {/* Recital: the right being exercised, quoted before anything is asked. */}
      <div className="rounded-r-lg border-l-2 border-brand-500 bg-brand-50/70 px-4 py-3.5">
        <p className="text-sm leading-relaxed text-ink-700">
          An applicant need not demonstrate any specific interest in the information applied for. You
          will not be asked why you want a record, and nothing below is used to decide whether you
          may have it.
        </p>
        <p className="mt-2 font-mono text-2xs uppercase tracking-[0.16em] text-brand-700">
          Freedom of Information Act 2011 · s. 1(2)
        </p>
      </div>

      <form onSubmit={submit} className="mt-8 space-y-8">
        <FormPart
          mark="01"
          title="The applicant"
          note="This is the name entered on the case file and used in correspondence."
        >
          <Input
            label="Full name"
            value={form.name}
            onChange={set('name')}
            leadingIcon={<UserIcon aria-hidden className="h-4 w-4" />}
            autoComplete="name"
            className="h-11"
            required
          />
          <Input
            label="Organisation"
            value={form.organization}
            onChange={set('organization')}
            leadingIcon={<Building2 aria-hidden className="h-4 w-4" />}
            hint="Optional. Give it only if you are applying on behalf of a body."
            className="h-11"
          />
        </FormPart>

        <FormPart
          mark="02"
          title="Address for service"
          note="Acknowledgements, notices of extension and the determination itself are served on the address you give here."
        >
          <Input
            label="Email address"
            type="email"
            value={form.email}
            onChange={set('email')}
            leadingIcon={<Mail aria-hidden className="h-4 w-4" />}
            autoComplete="email"
            className="h-11"
            required
          />
          <Input
            label="Phone number"
            value={form.phone}
            onChange={set('phone')}
            leadingIcon={<Phone aria-hidden className="h-4 w-4" />}
            placeholder="+234…"
            autoComplete="tel"
            hint="Optional. Used only where a request needs urgent clarification."
            className="h-11"
          />
        </FormPart>

        <FormPart
          mark="03"
          title="Credentials"
          note={`Passwords must be at least ${MIN_LENGTH} characters and are rotated every ${ROTATION_DAYS} days.`}
        >
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={form.password}
            onChange={set('password')}
            autoComplete="new-password"
            className="h-11"
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

          {form.password.length > 0 ? (
            <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3.5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-mono text-2xs uppercase tracking-[0.18em] text-ink-500">
                  Policy compliance
                </p>
                <p
                  className={cn(
                    'font-mono text-2xs uppercase tracking-[0.14em] font-medium',
                    verdict.text,
                  )}
                >
                  {verdict.label}
                </p>
              </div>

              {/* One tick per rule, so the meter and the list below never disagree. */}
              <div aria-hidden className="mt-2.5 flex gap-1">
                {strength.checks.map((check, index) => (
                  <span
                    key={check.label}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      index < strength.met ? verdict.fill : 'bg-ink-200',
                    )}
                  />
                ))}
              </div>

              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {strength.checks.map((check) => (
                  <li
                    key={check.label}
                    className={cn(
                      'flex items-center gap-1.5 text-xs',
                      check.ok ? 'text-brand-800' : 'text-ink-500',
                    )}
                  >
                    {check.ok ? (
                      <Check aria-hidden className="h-3.5 w-3.5 shrink-0 text-brand-600" />
                    ) : (
                      <Minus aria-hidden className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                    )}
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
            className="h-11"
            required
          />
        </FormPart>

        <FormPart mark="04" title="Declaration">
          <div className="rounded-xl border border-ink-300 bg-ink-50/70 p-4">
            <p className="text-sm leading-relaxed text-ink-700">
              I declare that the particulars given above are true. I understand that my name, and any
              organisation I have named, are entered on the case file and may appear in HYPREP’s
              annual report on the operation of the Act to the Attorney-General of the Federation.
            </p>

            <div className="mt-3.5 border-t border-ink-200 pt-3.5">
              <Checkbox
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
                label="I make the declaration above"
              />
            </div>

            {/* Execution block: the form signs itself as the name is typed. */}
            <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-t border-dashed border-ink-300 pt-3.5">
              <div className="min-w-0">
                <p
                  className={cn(
                    'truncate font-serif text-lg font-semibold leading-snug',
                    form.name.trim() ? 'text-ink-900' : 'text-ink-300',
                  )}
                >
                  {form.name.trim() || '—'}
                </p>
                <p className="mt-1 font-mono text-2xs uppercase tracking-[0.16em] text-ink-500">
                  Applicant
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums text-ink-800">{declaredOn}</p>
                <p className="mt-1 font-mono text-2xs uppercase tracking-[0.16em] text-ink-500">
                  Date
                </p>
              </div>
            </div>
          </div>

          <Button type="submit" size="lg" fullWidth isLoading={busy} disabled={!canSubmit}>
            Submit application
          </Button>
          <p className="text-xs leading-relaxed text-ink-500">
            An activation link is sent to your email address. Once activated, the account can file
            requests and track every response against the statutory deadline.
          </p>
        </FormPart>
      </form>
    </AuthLayout>
  )
}
