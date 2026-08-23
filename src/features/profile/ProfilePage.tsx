import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  BellRing,
  KeyRound,
  Laptop,
  LogOut,
  Save,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  UserCircle,
} from 'lucide-react'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Input,
  Select,
  Table,
  TableWrap,
  Tabs,
  Tbody,
  Td,
  Th,
  Thead,
  Toggle,
  Tr,
  UserAvatar,
} from '@/components/ui'
import type { SelectOption, TabItem } from '@/components/ui'
import { DescriptionList, PageHeader } from '@/components/common'
import { PERMISSION_GROUPS } from '@/lib/rbac'
import { TIMEZONE_LABEL, formatDateTime, formatRelative } from '@/lib/format'
import { reference } from '@/mocks/db'
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

const CHANNELS: Array<{ key: ChannelKey; label: string; hint: string }> = [
  { key: 'inApp', label: 'In-app', hint: 'Bell menu inside the system' },
  { key: 'email', label: 'Email', hint: 'Sent to your official address' },
  { key: 'sms', label: 'SMS', hint: 'Text message to your phone' },
]

const SESSIONS = [
  {
    id: 'ses-1',
    device: 'Windows 11 · Chrome 128',
    location: 'Port Harcourt, Rivers State',
    ip: '197.210.64.18',
    lastActive: 'Now',
    isCurrent: true,
  },
  {
    id: 'ses-2',
    device: 'iPhone 15 · Safari',
    location: 'Port Harcourt, Rivers State',
    ip: '197.210.71.202',
    lastActive: '3 hours ago',
    isCurrent: false,
  },
  {
    id: 'ses-3',
    device: 'Windows 10 · Edge 127',
    location: 'Abuja, FCT',
    ip: '105.112.44.90',
    lastActive: 'Yesterday, 16:40',
    isCurrent: false,
  },
]

const DIGEST_OPTIONS: SelectOption[] = [
  { value: 'immediate', label: 'Send each notification immediately' },
  { value: 'hourly', label: 'Hourly digest' },
  { value: 'daily', label: 'Daily digest at 08:00' },
  { value: 'weekly', label: 'Weekly digest on Monday' },
]

const QUIET_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'No quiet hours' },
  { value: '18-08', label: '18:00 – 08:00 (evenings)' },
  { value: '20-06', label: '20:00 – 06:00 (nights)' },
  { value: 'weekend', label: 'Weekends only' },
]

export function ProfilePage() {
  const { user, role, permissions, isReadOnly, updateProfile, logout } = useAuth()
  const { preferences, setPreference } = useData()
  const toast = useToast()
  const [params, setParams] = useSearchParams()

  const initialTab = (params.get('tab') as ProfileTab | null) ?? 'details'
  const [tab, setTab] = useState<ProfileTab>(
    TABS.some((item) => item.key === initialTab) ? initialTab : 'details',
  )

  const [name, setName] = useState(user?.name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [position, setPosition] = useState(user?.position ?? '')
  const [department, setDepartment] = useState(user?.department ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const [digest, setDigest] = useState('daily')
  const [quiet, setQuiet] = useState('18-08')
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [isChanging, setIsChanging] = useState(false)

  const departmentOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: 'Not applicable' },
      ...reference.departments.map((row) => ({ value: row.name, label: row.name })),
    ],
    [],
  )

  const groupedPermissions = useMemo(
    () =>
      PERMISSION_GROUPS.map((group) => ({
        group: group.group,
        description: group.description,
        held: group.permissions.filter((permission) => permissions.includes(permission.id)),
        total: group.permissions.length,
      })).filter((group) => group.held.length > 0),
    [permissions],
  )

  if (!user) return null

  const isDirty =
    name !== user.name ||
    (phone ?? '') !== (user.phone ?? '') ||
    (position ?? '') !== (user.position ?? '') ||
    (department ?? '') !== (user.department ?? '')

  function switchTab(nextTab: ProfileTab) {
    setTab(nextTab)
    const search = new URLSearchParams(params)
    if (nextTab === 'details') search.delete('tab')
    else search.set('tab', nextTab)
    setParams(search, { replace: true })
  }

  async function saveDetails() {
    if (name.trim().length < 3) {
      toast.error('Name is too short', 'Enter the name your colleagues will recognise on a case file.')
      return
    }
    setIsSaving(true)
    try {
      updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
        position: position.trim() || undefined,
        department: department || undefined,
      })
      toast.success('Profile updated', 'Your details are visible to colleagues on cases you touch.')
    } finally {
      setIsSaving(false)
    }
  }

  async function changePassword() {
    if (current.length < 4) {
      toast.error('Enter your current password', 'This confirms it is really you making the change.')
      return
    }
    if (next.length < reference.systemSettings.passwordMinLength) {
      toast.error(
        'Password too short',
        `Policy requires at least ${reference.systemSettings.passwordMinLength} characters with mixed case, a digit and a symbol.`,
      )
      return
    }
    if (next !== confirm) {
      toast.error('Passwords do not match', 'Retype the new password so we can be sure of it.')
      return
    }
    setIsChanging(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      setCurrent('')
      setNext('')
      setConfirm('')
      toast.success('Password changed', `It must be changed again within ${reference.systemSettings.passwordRotationDays} days.`)
    } finally {
      setIsChanging(false)
    }
  }

  function toggleMfa() {
    if (!user) return
    updateProfile({ mfaEnabled: !user.mfaEnabled })
    if (user.mfaEnabled) {
      toast.warning('Two-factor authentication off', 'Privileged accounts are required to keep a second factor enrolled.')
    } else {
      toast.success('Two-factor authentication on', 'You will be asked for a six-digit code at each sign-in.')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="My profile"
        description="Your details, sign-in security, alert preferences and the permissions your role carries."
        icon={<UserCircle className="h-5 w-5" />}
        breadcrumbs={[{ label: 'My profile' }]}
        actions={
          <Button variant="ghost" leadingIcon={<LogOut className="h-4 w-4" />} onClick={logout}>
            Sign out
          </Button>
        }
      />

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <UserAvatar user={user} size="lg" ring />
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-ink-900">{user.name}</p>
            <p className="text-sm text-ink-600">{user.position ?? role?.name}</p>
            <p className="mt-0.5 text-xs text-ink-500">
              {user.email} · {user.organization}
              {user.department ? ` · ${user.department}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand">{role?.name ?? user.roleId}</Badge>
            <Badge tone={user.mfaEnabled ? 'success' : 'warning'}>
              {user.mfaEnabled ? 'MFA enrolled' : 'MFA not enrolled'}
            </Badge>
            <Badge tone="neutral">{TIMEZONE_LABEL}</Badge>
          </div>
        </CardBody>
      </Card>

      <Tabs tabs={TABS} active={tab} onChange={switchTab} label="Profile sections" />

      {tab === 'details' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader
              title="Editable details"
              description="Your name and contact details appear on internal notes and case assignments."
              actions={
                <Button
                  size="sm"
                  leadingIcon={<Save className="h-4 w-4" />}
                  onClick={saveDetails}
                  isLoading={isSaving}
                  disabled={!isDirty}
                >
                  Save
                </Button>
              }
            />
            <CardBody className="space-y-3">
              <Input label="Full name" value={name} onChange={(event) => setName(event.target.value)} required />
              <Input
                label="Phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+234 803 000 0000"
                hint="Used for SMS reminders where you have enabled them."
              />
              <Input
                label="Position"
                value={position}
                onChange={(event) => setPosition(event.target.value)}
                placeholder="Senior Legal Officer"
              />
              <Select
                label="Department"
                options={departmentOptions}
                value={department}
                onChange={(event) => setDepartment(event.target.value)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Account record" description="Managed by an administrator." />
            <CardBody>
              <DescriptionList
                columns={1}
                items={[
                  { label: 'Email address', value: user.email, hint: 'Your sign-in identity; ask an administrator to change it.' },
                  { label: 'Role', value: role?.name ?? user.roleId, hint: role?.description },
                  { label: 'Organisation', value: user.organization },
                  { label: 'Account status', value: <Badge tone="success" className="capitalize">{user.status}</Badge> },
                  {
                    label: 'Last sign-in',
                    value: user.lastLoginAt ? (
                      <span title={formatDateTime(user.lastLoginAt)}>{formatRelative(user.lastLoginAt)}</span>
                    ) : (
                      'This is your first session'
                    ),
                  },
                  { label: 'Account created', value: formatDateTime(user.createdAt) },
                ]}
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'security' ? (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="Change password" description={`Minimum ${reference.systemSettings.passwordMinLength} characters, rotated every ${reference.systemSettings.passwordRotationDays} days.`} />
              <CardBody className="space-y-3">
                <Input
                  label="Current password"
                  type="password"
                  value={current}
                  onChange={(event) => setCurrent(event.target.value)}
                  autoComplete="current-password"
                />
                <Input
                  label="New password"
                  type="password"
                  value={next}
                  onChange={(event) => setNext(event.target.value)}
                  autoComplete="new-password"
                  hint="Mixed case, at least one digit and one symbol. The last five passwords cannot be reused."
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  autoComplete="new-password"
                  error={confirm.length > 0 && confirm !== next ? 'The passwords do not match.' : null}
                />
                <Button onClick={changePassword} isLoading={isChanging} fullWidth>
                  Update password
                </Button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Two-factor authentication" description="A second factor at every sign-in." />
              <CardBody className="space-y-3">
                <div
                  className={
                    user.mfaEnabled
                      ? 'flex items-start gap-3 rounded-lg border border-brand-200 bg-brand-50 p-3'
                      : 'flex items-start gap-3 rounded-lg border border-gold-300 bg-gold-50 p-3'
                  }
                >
                  {user.mfaEnabled ? (
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-brand-600" />
                  ) : (
                    <ShieldOff className="mt-0.5 h-5 w-5 shrink-0 text-gold-600" />
                  )}
                  <div>
                    <p className={user.mfaEnabled ? 'text-sm font-semibold text-brand-900' : 'text-sm font-semibold text-gold-900'}>
                      {user.mfaEnabled ? 'Authenticator app enrolled' : 'No second factor enrolled'}
                    </p>
                    <p className={user.mfaEnabled ? 'mt-0.5 text-xs text-brand-800' : 'mt-0.5 text-xs text-gold-800'}>
                      {user.mfaEnabled
                        ? 'A six-digit code from your authenticator is required alongside your password.'
                        : 'Institution policy requires a second factor for privileged accounts. Enrol now to stay compliant.'}
                    </p>
                  </div>
                </div>

                <Toggle
                  checked={user.mfaEnabled}
                  onChange={toggleMfa}
                  label="Require a code at sign-in"
                  description="Codes come from any TOTP app: Microsoft Authenticator, Google Authenticator or similar."
                />

                <div className="flex items-center gap-2 rounded-lg border border-ink-200 p-3">
                  <Smartphone className="h-4 w-4 shrink-0 text-ink-400" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-800">Backup channel</p>
                    <p className="text-2xs text-ink-500">
                      {user.phone ? `SMS to ${user.phone}` : 'No phone number on record — add one under My details.'}
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Active sessions"
              description={`Sessions end automatically after ${reference.systemSettings.sessionTimeoutMinutes} minutes of inactivity.`}
            />
            <CardBody className="p-0">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Device</Th>
                      <Th>Location</Th>
                      <Th>IP address</Th>
                      <Th>Last active</Th>
                      <Th className="text-right">Action</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {SESSIONS.map((session) => (
                      <Tr key={session.id}>
                        <Td>
                          <span className="inline-flex items-center gap-2">
                            <Laptop className="h-4 w-4 text-ink-400" />
                            <span className="font-medium text-ink-900">{session.device}</span>
                            {session.isCurrent ? <Badge tone="brand">This device</Badge> : null}
                          </span>
                        </Td>
                        <Td className="text-ink-600">{session.location}</Td>
                        <Td className="font-mono text-2xs text-ink-600">{session.ip}</Td>
                        <Td className="text-ink-600">{session.lastActive}</Td>
                        <Td className="text-right">
                          {session.isCurrent ? (
                            <span className="text-xs text-ink-400">—</span>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toast.success('Session revoked', `${session.device} has been signed out.`)}
                            >
                              Sign out
                            </Button>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'notifications' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Notification preferences"
              description="Choose how each event reaches you. In-app alerts always appear in the bell menu for statutory deadlines."
              actions={
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                  <BellRing className="h-4 w-4" />
                  {preferences.length} event types
                </span>
              }
            />
            <CardBody className="p-0">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Event</Th>
                      {CHANNELS.map((channel) => (
                        <Th key={channel.key} className="text-center">
                          <span className="block">{channel.label}</span>
                          <span className="block text-2xs font-normal normal-case text-ink-400">{channel.hint}</span>
                        </Th>
                      ))}
                    </Tr>
                  </Thead>
                  <Tbody>
                    {preferences.map((preference) => (
                      <Tr key={preference.kind}>
                        <Td>
                          <p className="font-medium text-ink-900">{preference.label}</p>
                          <p className="mt-0.5 max-w-md text-2xs text-ink-500">{preference.description}</p>
                        </Td>
                        {CHANNELS.map((channel) => (
                          <Td key={channel.key} className="text-center">
                            <div className="flex justify-center">
                              <Toggle
                                checked={preference[channel.key]}
                                onChange={(value) => setPreference(preference.kind, channel.key, value)}
                                label={`${preference.label} — ${channel.label}`}
                                srOnlyLabel
                              />
                            </div>
                          </Td>
                        ))}
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Digest & quiet hours" description="Applies to email only. Statutory overdue alerts always send immediately." />
            <CardBody className="grid gap-3 sm:grid-cols-2">
              <Select
                label="Email digest"
                options={DIGEST_OPTIONS}
                value={digest}
                onChange={(event) => setDigest(event.target.value)}
                hint="Group non-urgent notifications into a single message."
              />
              <Select
                label="Quiet hours"
                options={QUIET_OPTIONS}
                value={quiet}
                onChange={(event) => setQuiet(event.target.value)}
                hint={`Times are ${TIMEZONE_LABEL}.`}
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'permissions' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title={`${role.name} — ${permissions.length} permissions`}
              description={role.description}
              actions={<Badge tone={isReadOnly ? 'info' : 'brand'}>{isReadOnly ? 'Read-only role' : 'Read & write'}</Badge>}
            />
            <CardBody>
              <p className="text-sm text-ink-600">
                Permissions are granted by role, not per person. If you need access that is not listed here, ask an
                administrator to change your role or delegate the case to you directly — every change is written to the audit trail.
              </p>
            </CardBody>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {groupedPermissions.map((group) => (
              <Card key={group.group}>
                <CardHeader
                  title={group.group}
                  description={group.description}
                  actions={
                    <Badge tone={group.held.length === group.total ? 'success' : 'neutral'}>
                      {group.held.length}/{group.total}
                    </Badge>
                  }
                />
                <CardBody className="space-y-2">
                  {group.held.map((permission) => (
                    <div key={permission.id} className="flex items-start gap-2 rounded-lg border border-ink-100 bg-ink-50/60 p-2.5">
                      <KeyRound className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" />
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-ink-900">{permission.label}</p>
                        <p className="mt-0.5 font-mono text-2xs text-ink-500">{permission.id}</p>
                      </div>
                    </div>
                  ))}
                </CardBody>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
