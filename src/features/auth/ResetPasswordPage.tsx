import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Input } from '@/components/ui'
import { authClient } from '@/convexClient'
import { usePublicSettings } from '@/api/directory'
import { AuthLayout } from './AuthLayout'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const settings = usePublicSettings()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const token = params.get('token')

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) return setError('This link is missing its security code. Request a new password recovery email.')
    if (password !== confirmation) return setError('The two passwords do not match.')
    setBusy(true)
    setError(null)
    try {
      const result = await authClient.resetPassword({ token, newPassword: password })
      if (result.error) throw new Error(result.error.message ?? 'This link has expired or has already been used.')
      await authClient.signOut()
      setDone(true)
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Password reset failed. Request a new link and try again.')
    } finally {
      setBusy(false)
    }
  }

  return <AuthLayout eyebrow="Account recovery" title={done ? 'Your password is saved' : 'Set your password'} description={done ? 'Your account is ready. Sign in with your new password.' : 'Choose a new password to activate or recover your account.'}>
    {done ? <Link to="/login">Go to sign in</Link> : <form onSubmit={submit} className="space-y-4">
      {error || !token || params.has('error') ? <p role="alert">{error ?? 'This password link is invalid. Request a new recovery email.'}</p> : null}
      <Input label="New password" type="password" autoComplete="new-password" value={password} minLength={settings?.passwordMinLength ?? 8} required onChange={(event) => setPassword(event.target.value)} />
      <Input label="Confirm password" type="password" autoComplete="new-password" value={confirmation} required onChange={(event) => setConfirmation(event.target.value)} />
      <Button type="submit" isLoading={busy} disabled={!token || params.has('error')} fullWidth>Save password</Button>
      <Link to="/forgot-password">Request a new recovery link</Link>
    </form>}
  </AuthLayout>
}
