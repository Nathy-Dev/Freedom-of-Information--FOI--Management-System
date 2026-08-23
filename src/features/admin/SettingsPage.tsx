import { useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  DownloadCloud,
  FileCog,
  HardDriveDownload,
  Mail,
  RefreshCw,
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
  Progress,
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
import { exportData, runBackup, updateSettings } from '@/mocks/adminApi'
import type { ExportScope } from '@/mocks/adminApi'
import { reference } from '@/mocks/db'
import { TIMEZONE_LABEL, formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import { downloadTextFile } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type SettingsTab = 'general' | 'security' | 'documents' | 'delivery' | 'monitoring' | 'backups'

const TABS: Array<TabItem<SettingsTab>> = [
  { key: 'general', label: 'General', icon: <Sliders className="h-4 w-4" /> },
  { key: 'security', label: 'Security', icon: <ShieldCheck className="h-4 w-4" /> },
  { key: 'documents', label: 'Documents', icon: <FileCog className="h-4 w-4" /> },
  { key: 'delivery', label: 'Mail & storage', icon: <Mail className="h-4 w-4" /> },
  { key: 'monitoring', label: 'Monitoring', icon: <Activity className="h-4 w-4" /> },
  { key: 'backups', label: 'Backups & export', icon: <Database className="h-4 w-4" /> },
]

/** The three system routes in the sidebar map onto tabs of this one screen. */
const TAB_ROUTES: Record<SettingsTab, string> = {
  general: '/system/settings',
  security: '/system/settings',
  documents: '/system/settings',
  delivery: '/system/settings',
  monitoring: '/system/monitoring',
  backups: '/system/backups',
}

function tabForPath(pathname: string): SettingsTab {
  if (pathname.startsWith('/system/monitoring')) return 'monitoring'
  if (pathname.startsWith('/system/backups')) return 'backups'
  return 'general'
}

const STORAGE_OPTIONS: SelectOption[] = [
  { value: 's3', label: 'Amazon S3 (object storage)' },
  { value: 'azure_blob', label: 'Azure Blob Storage' },
  { value: 'on_premise', label: 'On-premise file server' },
]

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
  const { refresh, version } = useData()
  const toast = useToast()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [tab, setTab] = useState<SettingsTab>(() => tabForPath(pathname))
  const [form, setForm] = useState<SystemSettings>(() => ({ ...reference.systemSettings }))
  const [isSaving, setIsSaving] = useState(false)
  const [busyScope, setBusyScope] = useState<ExportScope | null>(null)
  const [backupType, setBackupType] = useState<BackupRecord['type']>('incremental')
  const [isBackingUp, setIsBackingUp] = useState(false)

  const canManage = can('system:settings') && !isReadOnly

  const tabs = useMemo(
    () =>
      TABS.filter((item) => {
        if (item.key === 'monitoring') return can('system:monitor')
        if (item.key === 'backups') return can('system:backup') || can('system:export')
        return can('system:settings')
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  function switchTab(next: SettingsTab) {
    setTab(next)
    const route = TAB_ROUTES[next]
    if (route !== pathname) navigate(route, { replace: true })
  }

  const health = useMemo(() => reference.serviceHealth, [version])
  const backups = useMemo(
    () => [...reference.backups].sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  const isDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(reference.systemSettings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, version],
  )

  const degraded = health.filter((row) => row.status !== 'operational')
  const lastBackup = backups[0]

  function set<K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function number(value: string, fallback: number) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  async function save() {
    if (!user) return
    setIsSaving(true)
    try {
      await updateSettings(form, user.id)
      refresh()
      toast.success('Settings saved', 'The configuration now applies to every new request.')
    } finally {
      setIsSaving(false)
    }
  }

  function reset() {
    setForm({ ...reference.systemSettings })
  }

  async function triggerBackup() {
    if (!user) return
    setIsBackingUp(true)
    try {
      const record = await runBackup(backupType, user.id)
      refresh()
      toast.success(
        `${backupType === 'full' ? 'Full' : 'Incremental'} backup started`,
        `Job ${record.id} is writing to ${record.target}.`,
      )
    } finally {
      setIsBackingUp(false)
    }
  }

  async function download(scope: ExportScope) {
    if (!user) return
    setBusyScope(scope)
    try {
      const { fileName, csv } = await exportData(scope, user.id)
      downloadTextFile(fileName, csv, 'text/csv')
      toast.success('Export ready', `${fileName} has been downloaded.`)
    } finally {
      setBusyScope(null)
    }
  }

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

      {tab === 'delivery' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Outbound mail" description="Acknowledgements, determinations and reminder emails." />
            <CardBody className="space-y-3">
              <Input
                label="SMTP host"
                value={form.smtpHost}
                onChange={(event) => set('smtpHost', event.target.value)}
                disabled={!canManage}
              />
              <Input
                label="SMTP port"
                type="number"
                value={form.smtpPort}
                onChange={(event) => set('smtpPort', number(event.target.value, 587))}
                hint="587 with STARTTLS is recommended."
                disabled={!canManage}
              />
              <Input
                label="From address"
                type="email"
                value={form.smtpFromAddress}
                onChange={(event) => set('smtpFromAddress', event.target.value)}
                disabled={!canManage}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Document storage" description="Where case attachments physically live." />
            <CardBody className="space-y-3">
              <Select
                label="Provider"
                options={STORAGE_OPTIONS}
                value={form.storageProvider}
                onChange={(event) => set('storageProvider', event.target.value as SystemSettings['storageProvider'])}
                disabled={!canManage}
              />
              <Input
                label="Bucket or share"
                value={form.storageBucket}
                onChange={(event) => set('storageBucket', event.target.value)}
                disabled={!canManage}
              />
              <p className="rounded-lg border border-ink-200 bg-ink-50 p-3 text-xs leading-relaxed text-ink-600">
                Changing the provider does not migrate existing objects. Plan a migration window with the platform team
                and keep the previous bucket readable until every document has been copied and checksummed.
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
                  {formatNumber(Math.round(health.reduce((total, row) => total + row.latencyMs, 0) / health.length))} ms
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
                        { value: 'incremental', label: 'Incremental' },
                        { value: 'full', label: 'Full' },
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
                      Run now
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
                    </Tr>
                  </Thead>
                  <Tbody>
                    {backups.map((row) => (
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
                        <Td className="font-mono text-2xs text-ink-500">{row.target}</Td>
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

          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-ink-900">Recovery objectives</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Progress value={92} label="Recovery point objective — 1 hour" showValue barClassName="bg-brand-600" />
                  <p className="mt-1 text-xs text-ink-500">Transaction logs ship to object storage every 5 minutes.</p>
                </div>
                <div>
                  <Progress value={78} label="Recovery time objective — 4 hours" showValue barClassName="bg-brand-600" />
                  <p className="mt-1 text-xs text-ink-500">Last full restore drill completed against the weekly copy.</p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : null}
    </div>
  )
}
