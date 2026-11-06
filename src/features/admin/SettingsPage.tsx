import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  DownloadCloud,
  FileCog,
  HardDriveDownload,
  Save,
  ShieldCheck,
  Sliders,
  XCircle,
} from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { BackupRecord, ServiceHealth, SystemSettings } from '@/types'
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
} from '@/components/ui'
import type { BadgeTone, SelectOption, TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { useBackups, useRunBackup, useServiceHealth, useSystemSettings, useUpdateSettings } from '@/api/directory'
import { useExport } from '@/api/reports'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { TIMEZONE_LABEL, formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type SettingsTab = 'general' | 'security' | 'documents' | 'monitoring' | 'backups'
type ExportScope = 'cases' | 'documents' | 'users' | 'audit' | 'court_dates'

const TABS: Array<TabItem<SettingsTab>> = [
  { key: 'general', label: 'General', icon: <Sliders className="h-4 w-4" /> },
  { key: 'security', label: 'Security', icon: <ShieldCheck className="h-4 w-4" /> },
  { key: 'documents', label: 'Documents', icon: <FileCog className="h-4 w-4" /> },
  { key: 'monitoring', label: 'Monitoring', icon: <Activity className="h-4 w-4" /> },
  { key: 'backups', label: 'Backups & export', icon: <Database className="h-4 w-4" /> },
]

/** The three system routes in the sidebar map onto tabs of this one screen. */
const TAB_ROUTES: Record<SettingsTab, string> = {
  general: '/system/settings',
  security: '/system/settings',
  documents: '/system/settings',
  monitoring: '/system/monitoring',
  backups: '/system/backups',
}

function tabForPath(pathname: string): SettingsTab {
  if (pathname.startsWith('/system/monitoring')) return 'monitoring'
  if (pathname.startsWith('/system/backups')) return 'backups'
  return 'general'
}



const SSO_OPTIONS: SelectOption[] = [
  { value: 'saml', label: 'SAML 2.0' },
  { value: 'oauth2', label: 'OAuth 2.0 / OpenID Connect' },
  { value: 'none', label: 'Not configured' },
]

const HEALTH_TONES: Record<ServiceHealth['status'], { tone: BadgeTone; label: string }> = {
  operational: { tone: 'success', label: 'Operational' },
  degraded: { tone: 'warning', label: 'Degraded' },
  down: { tone: 'danger', label: 'Down' },
}

const BACKUP_TONES: Record<BackupRecord['status'], BadgeTone> = {
  success: 'success',
  running: 'info',
  failed: 'danger',
}

const EXPORT_SCOPES: Array<{ scope: ExportScope; label: string; description: string }> = [
  { scope: 'cases', label: 'Case register', description: 'Every request with status, owner, SLA and outcome.' },
  { scope: 'documents', label: 'Document index', description: 'Attachments with version, retention and scan state.' },
  { scope: 'users', label: 'User accounts', description: 'Accounts, roles, departments and MFA state.' },
  { scope: 'audit', label: 'Audit trail', description: 'Immutable action log for the retention period.' },
  { scope: 'court_dates', label: 'Court diary', description: 'Listed hearings, suit numbers and outcomes.' },
]

export function SettingsPage() {
  const { user, can, isReadOnly } = useAuth()
  const { refresh } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [tab, setTab] = useState<SettingsTab>(() => tabForPath(pathname))
  const settings = useSystemSettings(can('system:settings') || can('system:monitor'))
  const health = useServiceHealth(can('system:monitor'))
  const backups = useBackups(can('system:backup'))
  const updateSettings = useUpdateSettings()
  const runBackup = useRunBackup()
  const downloadBackup = useMutation(api.fileAccess.downloadBackup)
  const [downloadingBackup, setDownloadingBackup] = useState<string | null>(null)
  const exportData = useExport()
  const [form, setForm] = useState<SystemSettings | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [busyScope, setBusyScope] = useState<ExportScope | null>(null)
  const [backupType, setBackupType] = useState<BackupRecord['type']>('full')
  const [isBackingUp, setIsBackingUp] = useState(false)
  const lastLoadedSettings = useRef<string | null>(null)

  useEffect(() => {
    if (!settings) return
    const snapshot = JSON.stringify(settings)
    if (snapshot === lastLoadedSettings.current) return
    lastLoadedSettings.current = snapshot
    setForm(settings)
  }, [settings])

  const canManage = can('system:settings') && !isReadOnly

  const tabs = useMemo(
    () =>
      TABS.filter((item) => {
        if (item.key === 'monitoring') return can('system:monitor')
        if (item.key === 'backups') return can('system:backup') || can('system:export')
        return can('system:settings')
      }),
    [can],
  )

  function switchTab(next: SettingsTab) {
    setTab(next)
    const route = TAB_ROUTES[next]
    if (route !== pathname) navigate(route, { replace: true })
  }

  const sortedBackups = useMemo(
    () => [...(backups ?? [])].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    [backups],
  )

  const isDirty = useMemo(
    () => Boolean(form && settings && JSON.stringify(form) !== JSON.stringify(settings)),
    [form, settings],
  )

  const degraded = health.filter((row) => row.status !== 'operational')
  const lastBackup = sortedBackups[0]

  function set<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function number(value: string, fallback: number) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  async function save() {
    if (!user || !form) return
    setIsSaving(true)
    try {
      await updateSettings(form as unknown as Record<string, unknown>)
      refresh()
      toast.success('Settings saved', 'The configuration now applies to every new request.')
    } catch (error) {
      toast.error(
        'Settings could not be saved',
        error instanceof Error ? error.message : 'Please try again.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  function reset() {
    if (settings) setForm(settings)
  }

  async function triggerBackup() {
    if (!user) return
    setIsBackingUp(true)
    try {
      const record = await runBackup(backupType)
      refresh()
      toast.success(
        `${backupType === 'full' ? 'Full' : 'Incremental'} backup started`,
        `Job ${record.id} is writing to ${record.target}.`,
      )
    } catch (error) {
      toast.error('Record export failed', error instanceof Error ? error.message : 'Please try again.')
    } finally {
      setIsBackingUp(false)
    }
  }

  async function download(scope: ExportScope) {
    if (!user) return
    setBusyScope(scope)
    try {
      const { fileName, url } = await exportData(scope)
      if (!url) throw new Error('The export did not produce a download URL.')
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      toast.success('Export ready', `${fileName} has been downloaded.`)
    } finally {
      setBusyScope(null)
    }
  }

  if (!form) return <p className="p-6 text-sm text-ink-500">Loading live system settings…</p>

  return (
    <div className="space-y-5">
      <PageHeader
        title={tab === 'monitoring' ? 'Monitoring' : tab === 'backups' ? 'Backups & export' : 'System settings'}
        description={
          tab === 'monitoring'
            ? 'Live service health for every component of the FOI Management System.'
            : tab === 'backups'
              ? 'Snapshot schedule, restore verification and register extracts.'
              : 'Statutory clocks, security policy, document handling and platform health.'
        }
        icon={tab === 'monitoring' ? <Activity className="h-5 w-5" /> : tab === 'backups' ? <Database className="h-5 w-5" /> : <Sliders className="h-5 w-5" />}
        breadcrumbs={[
          { label: 'System' },
          { label: tab === 'monitoring' ? 'Monitoring' : tab === 'backups' ? 'Backups & export' : 'Settings' },
        ]}
        actions={
          canManage && tab !== 'monitoring' && tab !== 'backups' ? (
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={reset} disabled={!isDirty}>
                Discard changes
              </Button>
              <Button leadingIcon={<Save className="h-4 w-4" />} onClick={save} isLoading={isSaving} disabled={!isDirty}>
                Save settings
              </Button>
            </div>
          ) : !canManage ? (
            <Badge tone="neutral">View only</Badge>
          ) : null
        }
      />

      {isDirty && canManage && tab !== 'monitoring' && tab !== 'backups' ? (
        <div className="flex items-center gap-2 rounded-lg border border-gold-300 bg-gold-50 px-3 py-2 text-sm text-gold-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>You have unsaved changes. They apply to new requests only — cases already in flight keep their original deadline.</span>
        </div>
      ) : null}

      <Tabs tabs={tabs} active={tab} onChange={switchTab} label="Settings sections" />

      {tab === 'general' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Institution" description="Shown on acknowledgements, determinations and exports." />
            <CardBody className="space-y-3">
              <Input
                label="Organisation name"
                value={form.organizationName}
                onChange={(event) => set('organizationName', event.target.value)}
                disabled={!canManage}
              />
              <Input label="Timezone" value={form.timezone} disabled hint={`All timestamps render as ${TIMEZONE_LABEL}.`} />
              <Toggle
                checked={form.selfRegistrationEnabled}
                onChange={(value) => set('selfRegistrationEnabled', value)}
                label="Allow public self-registration"
                description="Members of the public can create a requestor account from the login page."
                disabled={!canManage}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Statutory clock"
              description="Section 4 of the Freedom of Information Act 2011 sets the response window."
            />
            <CardBody className="space-y-3">
              <Input
                label="Statutory response days"
                type="number"
                min={1}
                max={30}
                value={form.statutoryResponseDays}
                onChange={(event) => set('statutoryResponseDays', number(event.target.value, 7))}
                hint="7 days by statute; a section 6 extension adds a further 7."
                disabled={!canManage}
              />
              <Input
                label="Due-soon warning (days before deadline)"
                type="number"
                min={1}
                max={7}
                value={form.slaWarningThresholdDays}
                onChange={(event) => set('slaWarningThresholdDays', number(event.target.value, 2))}
                hint="Drives the amber SLA badge and the due-soon notification."
                disabled={!canManage}
              />
              <Input
                label="Default document retention (years)"
                type="number"
                min={1}
                max={25}
                value={form.defaultRetentionYears}
                onChange={(event) => set('defaultRetentionYears', number(event.target.value, 7))}
                disabled={!canManage}
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'security' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Authentication" description="Password policy and multi-factor rules for every account." />
            <CardBody className="space-y-3">
              <Toggle
                checked={form.mfaRequiredForPrivileged}
                onChange={(value) => set('mfaRequiredForPrivileged', value)}
                label="Require MFA for privileged roles"
                description="Super-Admin, Admin and Legal Unit accounts must enrol a second factor."
                disabled={!canManage}
              />
              <Input
                label="Minimum password length"
                type="number"
                min={8}
                max={64}
                value={form.passwordMinLength}
                onChange={(event) => set('passwordMinLength', number(event.target.value, 12))}
                hint="Complexity is enforced separately: upper, lower, digit and symbol."
                disabled={!canManage}
              />
              <Input
                label="Password rotation (days)"
                type="number"
                min={30}
                max={365}
                value={form.passwordRotationDays}
                onChange={(event) => set('passwordRotationDays', number(event.target.value, 90))}
                disabled={!canManage}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Sessions & lockout" description="Applies to every interactive session, including SSO." />
            <CardBody className="space-y-3">
              <Input
                label="Idle session timeout (minutes)"
                type="number"
                min={5}
                max={240}
                value={form.sessionTimeoutMinutes}
                onChange={(event) => set('sessionTimeoutMinutes', number(event.target.value, 30))}
                disabled={!canManage}
              />
              <Input
                label="Failed attempts before lockout"
                type="number"
                min={3}
                max={10}
                value={form.lockoutAttempts}
                onChange={(event) => set('lockoutAttempts', number(event.target.value, 5))}
                hint="Locked accounts appear under Users with a Locked status for an administrator to release."
                disabled={!canManage}
              />
              <Select
                label="Single sign-on provider"
                options={SSO_OPTIONS}
                value={form.ssoProvider}
                onChange={(event) => set('ssoProvider', event.target.value as SystemSettings['ssoProvider'])}
                disabled={!canManage}
              />
              <Toggle
                checked={form.ssoEnabled}
                onChange={(value) => set('ssoEnabled', value)}
                label="Enable SSO on the login page"
                description="Staff sign in with their HYPREP directory account; requestors continue to use email and password."
                disabled={!canManage}
              />
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'documents' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Uploads" description="File type, size and scanning limits applied to every upload." />
            <CardBody className="space-y-3">
              <Input
                label="Maximum upload size (MB)"
                type="number"
                min={1}
                max={200}
                value={form.maxUploadSizeMb}
                onChange={(event) => set('maxUploadSizeMb', number(event.target.value, 25))}
                disabled={!canManage}
              />
              <Input
                label="Permitted file types"
                value={form.allowedFileTypes.join(', ')}
                onChange={(event) =>
                  set(
                    'allowedFileTypes',
                    event.target.value
                      .split(',')
                      .map((part) => part.trim().replace(/^\./, '').toLowerCase())
                      .filter(Boolean),
                  )
                }
                hint="Comma separated extensions. Anything else is rejected at the upload boundary."
                disabled={!canManage}
              />
              <div className="flex flex-wrap gap-1.5">
                {form.allowedFileTypes.map((type) => (
                  <Badge key={type} tone="neutral">
                    .{type}
                  </Badge>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Processing" description="Applied to every attachment as it lands." />
            <CardBody className="space-y-3">
              <Toggle
                checked={form.virusScanEnabled}
                onChange={(value) => set('virusScanEnabled', value)}
                label="Scan uploads for malware"
                description="Files stay quarantined until the scanner returns a clean verdict."
                disabled={!canManage}
              />
              <Toggle
                checked={form.ocrEnabled}
                onChange={(value) => set('ocrEnabled', value)}
                label="Run OCR on scanned documents"
                description="Makes scanned PDFs searchable from global search and the case file."
                disabled={!canManage}
              />
              <p className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
                Documents are encrypted at rest with AES-256 and in transit over TLS 1.3. Retention labels on each file
                override the institution default and a legal hold suspends destruction entirely.
              </p>
            </CardBody>
          </Card>
        </div>
      ) : null}



      {tab === 'monitoring' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardBody className="space-y-1">
                <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Platform status</p>
                <p className="text-lg font-semibold text-ink-900">
                  {degraded.length === 0 ? 'All systems operational' : `${degraded.length} service(s) degraded`}
                </p>
                <p className="text-xs text-ink-500">{health.length} monitored services</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1">
                <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Median latency</p>
                <p className="text-lg font-semibold tabular-nums text-ink-900">
                  {formatNumber(health.length ? Math.round(health.reduce((total, row) => total + row.latencyMs, 0) / health.length) : 0)} ms
                </p>
                <p className="text-xs text-ink-500">Across all probes, last minute</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="space-y-1">
                <p className="text-2xs font-semibold uppercase tracking-wide text-ink-500">Last backup</p>
                <p className="text-lg font-semibold text-ink-900">
                  {lastBackup ? formatRelative(lastBackup.startedAt) : '—'}
                </p>
                <p className="text-xs text-ink-500">
                  {lastBackup ? `${lastBackup.type === 'full' ? 'Full' : 'Incremental'} · ${lastBackup.status}` : 'No runs recorded'}
                </p>
              </CardBody>
            </Card>
          </div>

          <Card>
            <CardHeader title="Service health" description="Synthetic probes run every 60 seconds from the Lagos region." />
            <CardBody className="p-0">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Service</Th>
                      <Th>Status</Th>
                      <Th className="text-right">Latency</Th>
                      <Th>Detail</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {health.map((row) => {
                      const meta = HEALTH_TONES[row.status]
                      return (
                        <Tr key={row.name}>
                          <Td className="font-medium text-ink-900">{row.name}</Td>
                          <Td>
                            <span className="inline-flex items-center gap-1.5">
                              {row.status === 'operational' ? (
                                <CheckCircle2 className="h-4 w-4 text-brand-600" />
                              ) : row.status === 'degraded' ? (
                                <AlertTriangle className="h-4 w-4 text-gold-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-crest-600" />
                              )}
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                            </span>
                          </Td>
                          <Td className="text-right tabular-nums">{formatNumber(row.latencyMs)} ms</Td>
                          <Td className="text-ink-600">{row.detail}</Td>
                        </Tr>
                      )
                    })}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'backups' ? (
        <div className="space-y-4">
          <Card>
            <CardHeader
              title="Backups"
              description="Nightly incrementals with a weekly full copy, retained for 35 days."
              actions={
                canManage ? (
                  <div className="flex items-center gap-2">
                    <Select
                      options={[
                        { value: 'full', label: 'Full record export' },
                      ]}
                      value={backupType}
                      onChange={(event) => setBackupType(event.target.value as BackupRecord['type'])}
                      size="sm"
                      containerClassName="w-36"
                      label="Backup type"
                    />
                    <Button
                      leadingIcon={<HardDriveDownload className="h-4 w-4" />}
                      onClick={triggerBackup}
                      isLoading={isBackingUp}
                    >
                      Export records
                    </Button>
                  </div>
                ) : null
              }
            />
            <CardBody className="p-0">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Job</Th>
                      <Th>Started</Th>
                      <Th>Type</Th>
                      <Th className="text-right">Size</Th>
                      <Th>Status</Th>
                      <Th>Restore tested</Th>
                      <Th>Target</Th>
                      <Th>Archive</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {sortedBackups.map((row) => (
                      <Tr key={row.id}>
                        <Td className="font-mono text-xs text-ink-700">{row.id}</Td>
                        <Td>
                          <span title={formatDateTime(row.startedAt)}>{formatRelative(row.startedAt)}</span>
                        </Td>
                        <Td className="capitalize text-ink-600">{row.type}</Td>
                        <Td className="text-right tabular-nums">{formatNumber(row.sizeMb)} MB</Td>
                        <Td>
                          <Badge tone={BACKUP_TONES[row.status]} className="capitalize">
                            {row.status}
                          </Badge>
                        </Td>
                        <Td>
                          {row.restoreTested ? (
                            <span className="inline-flex items-center gap-1 text-xs text-brand-700">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                            </span>
                          ) : (
                            <span className="text-xs text-ink-400">Not tested</span>
                          )}
                        </Td>
                        <Td className="font-mono text-2xs text-ink-500">{row.target}{row.error ? <p role="alert" className="text-crest-700">{row.error}</p> : null}</Td>
                        <Td>{row.status === 'success' && row.storageId ? <Button size="sm" variant="secondary" isLoading={downloadingBackup === row.id} onClick={async () => {
                          setDownloadingBackup(row.id)
                          try {
                            const archive = await downloadBackup({ id: row.id as never })
                            const response = await fetch(archive.url)
                            if (!response.ok) throw new Error('Archive download failed or access expired.')
                            const bytes = await response.arrayBuffer()
                            if (archive.checksum) {
                              const digest = await crypto.subtle.digest('SHA-256', bytes)
                              const checksum = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, '0')).join('')
                              if (checksum !== archive.checksum) throw new Error('Archive integrity check failed. Do not use this file.')
                            }
                            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/gzip' }))
                            const link = document.createElement('a'); link.href = url; link.download = archive.filename; link.click()
                            window.setTimeout(() => URL.revokeObjectURL(url), 1000)
                          } catch (error) { toast.error('Download failed', error instanceof Error ? error.message : 'Please try again.') }
                          finally { setDownloadingBackup(null) }
                        }}>Download</Button> : <span className="text-xs text-ink-500">{row.status === 'success' ? 'Legacy job: no archive verified' : 'Not available'}</span>}</Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Data export"
              description="Extract a register as CSV for the annual return to the Attorney-General."
            />
            <CardBody className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {EXPORT_SCOPES.map((item) => (
                <div key={item.scope} className="flex flex-col justify-between gap-3 rounded-lg border border-ink-200 p-3">
                  <div>
                    <p className="text-sm font-semibold text-ink-900">{item.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink-500">{item.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    leadingIcon={<DownloadCloud className="h-4 w-4" />}
                    onClick={() => download(item.scope)}
                    isLoading={busyScope === item.scope}
                    disabled={!can('system:export')}
                    fullWidth
                  >
                    Export CSV
                  </Button>
                </div>
              ))}
            </CardBody>
          </Card>

        </div>
      ) : null}
    </div>
  )
}
