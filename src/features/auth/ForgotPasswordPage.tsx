import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Mail } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { delay } from '@/lib/utils'
import { reference } from '@/mocks/db'
import { AuthLayout } from './AuthLayout'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    await delay(680)
    setBusy(false)
    // Deliberately does not reveal whether the address is registered.
    setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout eyebrow="Password recovery" title="Check your email">
        <div className="rounded-r-lg border-l-2 border-brand-500 bg-brand-50/70 px-4 py-3.5">
          <CheckCircle2 aria-hidden className="h-5 w-5 text-brand-600" />
          <p className="mt-2.5 text-sm leading-relaxed text-ink-700">
            If <span className="font-medium text-ink-900">{email}</span> matches an account on this
            system, a password reset link has been sent to it. The link expires in 60 minutes and can
            be used once.
          </p>
          <p className="mt-3 text-xs text-ink-500">
            Reset messages are sent from {reference.systemSettings.smtpFromAddress}. Check your junk
            folder before contacting the administrator.
          </p>
        </div>
        <Button
          className="mt-5"
          variant="outline"
          fullWidth
          onClick={() => setSent(false)}
        >
          Use a different email address
        </Button>
        <p className="mt-5 text-center text-sm">
          <Link to="/login" className="font-medium text-brand-700 hover:underline">
            Back to sign in
          </Link>
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Password recovery"
      title="Reset your password"
      description="Enter the email address on your account and we will send you a link to set a new password."
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          leadingIcon={<Mail aria-hidden className="h-4 w-4" />}
          placeholder="name@hyprep.gov.ng"
          className="h-11"
          required
        />
        <Button type="submit" size="lg" fullWidth isLoading={busy}>
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-xs leading-relaxed text-ink-500">
        Passwords must be at least {reference.systemSettings.passwordMinLength} characters and are
        rotated every {reference.systemSettings.passwordRotationDays} days. Staff accounts that use
        single sign-on should reset through the ministry identity provider instead.
      </p>

      <p className="mt-6 text-center text-sm">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-medium text-brand-700 hover:underline"
        >
          <ArrowLeft aria-hidden className="h-3.5 w-3.5" />
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  )
}
