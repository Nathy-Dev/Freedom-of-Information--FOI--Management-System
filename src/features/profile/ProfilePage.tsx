import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BellRing, KeyRound, LogOut, Save, ShieldCheck, ShieldOff, Smartphone, UserCircle } from 'lucide-react'
import * as QRCode from 'qrcode'
import { Badge, Button, Card, CardBody, CardHeader, Input, Modal, Select, Tabs, Toggle } from '@/components/ui'
import type { SelectOption, TabItem } from '@/components/ui'
import { DescriptionList, PageHeader } from '@/components/common'
import { usePublicSettings } from '@/api/directory'
import { authClient } from '@/convexClient'
import { PERMISSION_GROUPS } from '@/lib/rbac'
import { TIMEZONE_LABEL, formatDateTime, formatRelative } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type ProfileTab = 'details' | 'security' | 'notifications' | 'permissions'
const TABS: Array<TabItem<ProfileTab>> = [
  { key: 'details', label: 'My details', icon: <UserCircle className="h-4 w-4" /> },
  { key: 'security', label: 'Security', icon: <ShieldCheck className="h-4 w-4" /> },
  { key: 'notifications', label: 'Notifications', icon: <BellRing className="h-4 w-4" /> },
  { key: 'permissions', label: 'My permissions', icon: <KeyRound className="h-4 w-4" /> },
]
type ChannelKey = 'inApp' | 'email' | 'sms'
const CHANNELS: Array<{ key: ChannelKey; label: string }> = [
  { key: 'inApp', label: 'In-app' },
  { key: 'email', label: 'Email' },
  { key: 'sms', label: 'SMS' },
]

function getTotpSecret(totpUri: string) {
  try {
    return new URL(totpUri).searchParams.get('secret') ?? totpUri
  } catch {
    return totpUri
  }
}

export function ProfilePage() {
  const { user, role, permissions, isReadOnly, securityRequired, updateProfile, logout } = useAuth()
  const { preferences, reference, setPreference } = useData()
  const settings = usePublicSettings()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const initialTab = (params.get('tab') as ProfileTab | null) ?? 'details'
  const [tab, setTab] = useState<ProfileTab>(TABS.some((item) => item.key === initialTab) ? initialTab : 'details')
  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [position, setPosition] = useState(user?.position ?? '')
  const [department, setDepartment] = useState(user?.department ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isChanging, setIsChanging] = useState(false)
  const [mfaModal, setMfaModal] = useState<null | { mode: 'enroll' | 'disable'; totpUri: string; backupCodes: string[] }>(null)
  const [mfaPassword, setMfaPassword] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [mfaBusy, setMfaBusy] = useState(false)
  const [mfaError, setMfaError] = useState<string | null>(null)
  const [sessionCode, setSessionCode] = useState('')
  const [sessionBusy, setSessionBusy] = useState(false)
  const [ssoBusy, setSsoBusy] = useState(false)
  const [mfaQrCode, setMfaQrCode] = useState<string | null>(null)
  const [mfaQrError, setMfaQrError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const totpUri = mfaModal?.totpUri

    if (!totpUri) {
      setMfaQrCode(null)
      setMfaQrError(null)
      return () => { cancelled = true }
    }

    setMfaQrCode(null)
    setMfaQrError(null)
    void QRCode.toDataURL(totpUri, {
      width: 220,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: { dark: '#102a43', light: '#ffffff' },
    }).then((dataUrl) => {
      if (!cancelled) setMfaQrCode(dataUrl)
    }).catch(() => {
      if (!cancelled) setMfaQrError('The QR code could not be generated. Use the setup key below instead.')
    })

    return () => { cancelled = true }
  }, [mfaModal?.totpUri])

  const departmentOptions = useMemo<SelectOption[]>(
    () => [{ value: '', label: 'Not applicable' }, ...(reference?.departments ?? []).map((row) => ({ value: row.name, label: row.name }))],
    [reference],
  )
  const groupedPermissions = useMemo(
    () => PERMISSION_GROUPS.map((group) => ({ ...group, held: group.permissions.filter((permission) => permissions.includes(permission.id)) })).filter((group) => group.held.length > 0),
    [permissions],
  )

  if (!user) return null

  const isDirty = name !== user.name || phone !== (user.phone ?? '') || position !== (user.position ?? '') || department !== (user.department ?? '')
  const switchTab = (nextTab: ProfileTab) => {
    setTab(nextTab)
    const search = new URLSearchParams(params)
    if (nextTab === 'details') search.delete('tab')
    else search.set('tab', nextTab)
    setParams(search, { replace: true })
  }

  const saveDetails = async () => {
    if (name.trim().length < 3) return toast.error('Name is too short', 'Enter the name your colleagues will recognise.')
    setIsSaving(true)
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim() || undefined, position: position.trim() || undefined, department: department || undefined })
      toast.success('Profile updated', 'Your live account record has been saved.')
    } finally {
      setIsSaving(false)
    }
  }

  const changePassword = async () => {
    const minLength = settings?.passwordMinLength ?? 8
    if (current.length < 1) return toast.error('Enter your current password', 'This confirms it is really you.')
    if (next.length < minLength) return toast.error('Password too short', `Policy requires at least ${minLength} characters.`)
    if (next !== confirm) return toast.error('Passwords do not match', 'Retype the new password.')
    setIsChanging(true)
    try {
      const response = await authClient.changePassword({ currentPassword: current, newPassword: next, revokeOtherSessions: false })
      if (response.error) return toast.error('Password change failed', response.error.message ?? 'Check your current password and try again.')
      setCurrent(''); setNext(''); setConfirm('')
      toast.success('Password changed', 'Your Better Auth password has been updated.')
    } finally {
      setIsChanging(false)
    }
  }

  const beginEnroll = () => {
    setMfaError(null)
    setMfaCode('')
    setMfaPassword('')
    setMfaModal({ mode: 'enroll', totpUri: '', backupCodes: [] })
  }

  const beginDisable = () => {
    setMfaError(null)
    setMfaCode('')
    setMfaPassword('')
    setMfaModal({ mode: 'disable', totpUri: '', backupCodes: [] })
  }

  const submitMfa = async () => {
    if (mfaModal?.mode === 'enroll') {
      if (mfaPassword.length < 1) return
      setMfaBusy(true)
      setMfaError(null)
      try {
        // Better Auth requires the current password to enable 2FA (unless
        // allowPasswordless). Empty password → INVALID_PASSWORD.
        const res = await authClient.twoFactor.enable({ password: mfaPassword })
        if (res.error) {
          setMfaError(res.error.message ?? 'Could not start MFA setup.')
          return
        }
        setMfaPassword('')
        if (!res.data || !('totpURI' in res.data)) throw new Error('Authenticator setup information is unavailable.')
        setMfaModal({ mode: 'enroll', totpUri: res.data.totpURI, backupCodes: res.data.backupCodes })
      } catch {
        setMfaError('Could not start MFA setup. Try again.')
      } finally {
        setMfaBusy(false)
      }
      return
    }
    // disable mode
    if (mfaPassword.length < 1) return
    setMfaBusy(true)
    setMfaError(null)
    try {
      // The password is required to disable 2FA (validated server-side).
      const res = await authClient.twoFactor.disable({ password: mfaPassword })
      if (res.error) {
        setMfaError(res.error.message ?? 'Could not disable MFA.')
        return
      }
      setMfaPassword('')
      setMfaModal(null)
      toast.success('MFA disabled', 'A second factor is no longer required at sign-in.')
    } catch {
      setMfaError('Could not disable MFA. Try again.')
    } finally {
      setMfaBusy(false)
    }
  }

  /** Enroll mode, code step: verify the TOTP code to complete enrolment. */
  const confirmMfaCode = async () => {
    if (mfaCode.length < 6) return
    setMfaBusy(true)
    setMfaError(null)
    try {
      const res = await authClient.twoFactor.verifyTotp({ code: mfaCode })
      if (res.error) {
        setMfaError(res.error.message ?? 'That code is not correct.')
        return
      }
      setMfaModal(null)
      setMfaCode('')
      setMfaPassword('')
      toast.success('MFA enabled', 'A code from your authenticator app is now required at sign-in.')
    } catch {
      setMfaError('Verification failed. Try again.')
    } finally {
      setMfaBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="My profile" description="Your details, sign-in security, alert preferences and role permissions." icon={<UserCircle className="h-5 w-5" />} breadcrumbs={[{ label: 'My profile' }]} actions={<Button variant="ghost" leadingIcon={<LogOut className="h-4 w-4" />} onClick={logout}>Sign out</Button>} />
      <Card><CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-lg font-semibold text-brand-700">{user.initials}</div><div className="min-w-0 flex-1"><p className="text-lg font-semibold text-ink-900">{user.name}</p><p className="text-sm text-ink-600">{user.position ?? role?.name}</p><p className="mt-0.5 text-xs text-ink-500">{user.email} · {user.organization}{user.department ? ` · ${user.department}` : ''}</p></div><div className="flex flex-wrap items-center gap-2"><Badge tone="brand">{role?.name ?? user.roleId}</Badge><Badge tone={user.mfaEnabled ? 'success' : 'warning'}>{user.mfaEnabled ? 'MFA enrolled' : 'MFA not enrolled'}</Badge><Badge tone="neutral">{TIMEZONE_LABEL}</Badge></div></CardBody></Card>
      <Tabs tabs={TABS} active={tab} onChange={switchTab} label="Profile sections" />
      {securityRequired ? <p role="alert" className="rounded border border-gold-200 bg-gold-50 p-3 text-sm">{securityRequired}</p> : null}
      {tab === 'security' && user.mfaEnabled && securityRequired?.startsWith('Enter an authenticator') ? (
        <Card><CardHeader title="Verify this session" description="Enter the current code from your authenticator before opening case records." /><CardBody className="max-w-xl space-y-3">
          <Input label="6-digit authenticator code" inputMode="numeric" autoComplete="one-time-code" value={sessionCode} maxLength={6} onChange={(event) => setSessionCode(event.target.value.replace(/\D/g, ''))} />
          <Button isLoading={sessionBusy} disabled={sessionCode.length !== 6} onClick={async () => {
            setSessionBusy(true)
            try {
              const response = await authClient.twoFactor.verifyTotp({ code: sessionCode })
              if (response.error) throw new Error(response.error.message ?? 'That code is not correct.')
              setSessionCode('')
              toast.success('Session verified', 'You can now use the system.')
            } catch (error) { toast.error('Verification failed', error instanceof Error ? error.message : 'Please try again.') }
            finally { setSessionBusy(false) }
          }}>Verify session</Button>
        </CardBody></Card>
      ) : null}
      {tab === 'security' && settings?.ssoEnabled && !securityRequired ? (
        <Card><CardHeader title="Link Microsoft staff account" description="Sign in to Microsoft to link your staff account. Microsoft sign-in does not grant any additional role or case access." /><CardBody>
          <Button isLoading={ssoBusy} onClick={async () => {
            setSsoBusy(true)
            try {
              const response = await authClient.linkSocial({ provider: 'microsoft-entra-id', callbackURL: '/profile?tab=security' })
              if (response.error) throw new Error(response.error.message ?? 'Microsoft account could not be linked.')
            } catch (error) { toast.error('Link failed', error instanceof Error ? error.message : 'Please try again.') }
            finally { setSsoBusy(false) }
          }}>Link Microsoft account</Button>
        </CardBody></Card>
      ) : null}

      {tab === 'details' ? <div className="grid gap-4 lg:grid-cols-2"><Card><CardHeader title="Editable details" description="These fields are read from and written to your live user profile." actions={<Button size="sm" leadingIcon={<Save className="h-4 w-4" />} onClick={saveDetails} isLoading={isSaving} disabled={!isDirty}>Save</Button>} /><CardBody className="space-y-3"><Input label="Full name" value={name} onChange={(event) => setName(event.target.value)} required /><Input label="Phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /><Input label="Position" value={position} onChange={(event) => setPosition(event.target.value)} /><Select label="Department" options={departmentOptions} value={department} onChange={(event) => setDepartment(event.target.value)} /></CardBody></Card><Card><CardHeader title="Account record" description="Managed by the live identity and profile records." /><CardBody><DescriptionList columns={1} items={[{ label: 'Email address', value: user.email }, { label: 'Role', value: role?.name ?? user.roleId, hint: role?.description }, { label: 'Organisation', value: user.organization }, { label: 'Account status', value: <Badge tone="success">{user.status}</Badge> }, { label: 'Last sign-in', value: user.lastLoginAt ? <span title={formatDateTime(user.lastLoginAt)}>{formatRelative(user.lastLoginAt)}</span> : 'This is your first session' }, { label: 'Account created', value: formatDateTime(user.createdAt) }]} /></CardBody></Card></div> : null}

      {tab === 'security' ? <div className="space-y-4"><Card><CardHeader title="Change password" description={`Minimum ${settings?.passwordMinLength ?? 8} characters; rotation is ${settings?.passwordRotationDays ?? 90} days.`} /><CardBody className="max-w-xl space-y-3"><Input label="Current password" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" /><Input label="New password" type="password" value={next} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" /><Input label="Confirm new password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" error={confirm.length > 0 && confirm !== next ? 'The passwords do not match.' : null} /><Button onClick={changePassword} isLoading={isChanging}>Update password</Button></CardBody></Card><Card><CardHeader title="Two-factor authentication" description="A code from your authenticator app is required at sign-in when enabled." /><CardBody className="space-y-3"><div className="flex items-start gap-3 rounded-lg border border-ink-200 p-3">{user.mfaEnabled ? <ShieldCheck className="h-5 w-5 text-brand-600" /> : <ShieldOff className="h-5 w-5 text-gold-600" />}<div><p className="text-sm font-semibold text-ink-900">{user.mfaEnabled ? 'Authenticator app enrolled' : 'No second factor enrolled'}</p><p className="text-xs text-ink-500">{user.mfaEnabled ? 'You will be asked for a 6-digit code at sign-in.' : 'Enrol with an authenticator app to protect this account.'}</p></div></div>{user.mfaEnabled ? <Button variant="outline" onClick={beginDisable} isLoading={mfaBusy} disabled={isReadOnly}>Disable MFA</Button> : <Button onClick={beginEnroll} isLoading={mfaBusy} disabled={isReadOnly}>Enrol authenticator app</Button>}<p className="flex items-center gap-1.5 text-xs text-ink-500"><Smartphone className="h-3.5 w-3.5" />Use Google Authenticator, Microsoft Authenticator, or any TOTP app.</p></CardBody></Card></div> : null}

      {tab === 'notifications' ? <Card><CardHeader title="Notification preferences" description="Each row is loaded from your live notification preference records." actions={<span className="text-xs text-ink-500">{preferences.length} event types</span>} /><CardBody className="space-y-2">{preferences.map((preference) => <div key={preference.kind} className="grid gap-3 rounded-lg border border-ink-200 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><div><p className="text-sm font-medium text-ink-900">{preference.label}</p><p className="text-2xs text-ink-500">{preference.description}</p></div>{CHANNELS.map((channel) => <Toggle key={channel.key} checked={preference[channel.key]} onChange={(value) => setPreference(preference.kind, channel.key, value)} label={`${preference.label} — ${channel.label}`} srOnlyLabel />)}</div>)}</CardBody></Card> : null}

      {tab === 'permissions' ? <div className="grid gap-4 md:grid-cols-2">{groupedPermissions.map((group) => <Card key={group.group}><CardHeader title={group.group} description={group.description} actions={<Badge tone="success">{group.held.length}/{group.permissions.length}</Badge>} /><CardBody className="space-y-2">{group.held.map((permission) => <div key={permission.id} className="flex items-start gap-2 rounded-lg border border-ink-100 bg-ink-50/60 p-2.5"><KeyRound className="h-3.5 w-3.5 text-brand-600" /><div><p className="text-xs font-medium text-ink-900">{permission.label}</p><p className="font-mono text-2xs text-ink-500">{permission.id}</p></div></div>)}</CardBody></Card>)}</div> : null}

      <Modal
        open={Boolean(mfaModal)}
        onClose={() => { if (!mfaBusy) { setMfaModal(null); setMfaError(null); setMfaCode(''); setMfaPassword('') } }}
        title={mfaModal?.mode === 'disable' ? 'Disable two-factor authentication' : 'Set up two-factor authentication'}
        description={
          mfaModal?.mode === 'disable'
            ? 'Enter your password to confirm you want to turn off the second factor.'
            : 'Enter your password to confirm, scan the code with your authenticator app, then enter the 6-digit code it shows.'
        }
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setMfaModal(null); setMfaError(null); setMfaCode(''); setMfaPassword('') }} disabled={mfaBusy}>Cancel</Button>
            {mfaModal?.mode === 'disable' ? (
              <Button onClick={submitMfa} isLoading={mfaBusy} disabled={mfaPassword.length < 1}>Disable MFA</Button>
            ) : mfaModal?.totpUri ? (
              <Button onClick={confirmMfaCode} isLoading={mfaBusy} disabled={mfaCode.length < 6}>Verify and enable</Button>
            ) : (
              <Button onClick={submitMfa} isLoading={mfaBusy} disabled={mfaPassword.length < 1}>Continue</Button>
            )}
          </div>
        }
      >
        <div className="space-y-4">
          {mfaModal?.totpUri ? (
            <div className="rounded-lg border border-ink-200 bg-white p-4 text-center">
              <p className="text-xs text-ink-500">Scan this QR code with your authenticator app, or enter the setup key manually:</p>
              {mfaQrCode ? (
                <img src={mfaQrCode} alt="Authenticator app setup QR code" className="mx-auto mt-3 h-52 w-52 rounded border border-ink-100" />
              ) : mfaQrError ? (
                <p role="alert" className="mt-3 text-xs text-crest-700">{mfaQrError}</p>
              ) : (
                <div className="mx-auto mt-3 flex h-52 w-52 items-center justify-center rounded border border-ink-100 bg-ink-50 text-xs text-ink-500">Generating QR code…</div>
              )}
              <details className="mt-3 text-left">
                <summary className="cursor-pointer text-xs font-medium text-brand-700">Show setup key</summary>
                <p className="mt-2 break-all rounded bg-ink-50 p-2 font-mono text-xs text-ink-700">{getTotpSecret(mfaModal.totpUri)}</p>
              </details>
            </div>
          ) : null}
          {mfaModal?.mode === 'disable' || !mfaModal?.totpUri ? (
            <Input
              label="Current password"
              type="password"
              autoComplete="current-password"
              value={mfaPassword}
              onChange={(event) => setMfaPassword(event.target.value)}
              required
            />
          ) : null}
          {mfaModal?.mode === 'enroll' && mfaModal.totpUri ? (
            <Input
              label="6-digit code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              error={mfaError ?? undefined}
            />
          ) : mfaError ? (
            <p role="alert" className="text-xs font-medium text-crest-700">{mfaError}</p>
          ) : null}
          {mfaModal?.backupCodes.length ? (
            <div className="rounded-lg border border-gold-200 bg-gold-50 p-3">
              <p className="text-xs font-semibold text-gold-800">Save these backup codes somewhere safe:</p>
              <p className="mt-1.5 font-mono text-xs text-gold-900">{mfaModal.backupCodes.join('  ')}</p>
            </div>
          ) : null}
        </div>
      </Modal>
    </div>
  )
}
