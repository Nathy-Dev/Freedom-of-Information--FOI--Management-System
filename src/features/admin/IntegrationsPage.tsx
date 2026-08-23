import { useMemo, useState } from 'react'
import {
  Copy,
  KeyRound,
  Link2,
  Plug,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  Webhook as WebhookIcon,
} from 'lucide-react'
import type { Webhook } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  ConfirmDialog,
  Input,
  Modal,
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
import type { BadgeTone, TabItem } from '@/components/ui'
import { DescriptionList, PageHeader } from '@/components/common'
import { deleteWebhook, rotateApiSecret, saveWebhook, testWebhook } from '@/mocks/adminApi'
import { reference } from '@/mocks/db'
import { API_SCOPES, WEBHOOK_EVENTS } from '@/mocks/data/integrations'
import { getRole } from '@/lib/rbac'
import { formatDateTime, formatRelative } from '@/lib/format'
import { toggleIn } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'

type IntegrationTab = 'webhooks' | 'clients' | 'sso'

const TABS: Array<TabItem<IntegrationTab>> = [
  { key: 'webhooks', label: 'Webhooks', icon: <WebhookIcon className="h-4 w-4" /> },
  { key: 'clients', label: 'API clients', icon: <KeyRound className="h-4 w-4" /> },
  { key: 'sso', label: 'Single sign-on', icon: <ShieldCheck className="h-4 w-4" /> },
]

interface HookForm {
  id: string
  url: string
  events: string[]
  isActive: boolean
  secretMasked: string
}

const BLANK: HookForm = {
  id: '',
  url: '',
  events: ['case.created', 'case.status_changed'],
  isActive: true,
  secretMasked: 'whsec_••••••••••••new',
}

function statusTone(status: number | null): BadgeTone {
  if (status === null) return 'neutral'
  if (status >= 200 && status < 300) return 'success'
  if (status === 0) return 'warning'
  return 'danger'
}

function statusLabel(status: number | null) {
  if (status === null) return 'Never delivered'
  if (status === 0) return 'Not attempted'
  return `HTTP ${status}`
}

export function IntegrationsPage() {
  const { user, can, isReadOnly } = useAuth()
  const { refresh, version } = useData()
  const toast = useToast()

  const [tab, setTab] = useState<IntegrationTab>('webhooks')
  const [form, setForm] = useState<HookForm | null>(null)
  const [pending, setPending] = useState<Webhook | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [revealed, setRevealed] = useState<{ id: string; secret: string } | null>(null)

  const canManage = can('integration:manage') && !isReadOnly

  const hooks = useMemo(
    () => [...reference.webhooks].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )
  const clients = useMemo(
    () => [...reference.apiClients].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )
  const sso = reference.ssoConfig

  const failing = hooks.filter((hook) => hook.isActive && hook.lastStatus !== null && hook.lastStatus >= 400)

  async function persistHook() {
    if (!user || !form) return
    if (!/^https:\/\/.+/.test(form.url.trim())) {
      toast.error('Endpoint required', 'Webhook endpoints must be absolute HTTPS URLs.')
      return
    }
    if (form.events.length === 0) {
      toast.error('Pick at least one event', 'A subscription with no events would never fire.')
      return
    }
    setIsBusy(true)
    try {
      await saveWebhook({ ...form, url: form.url.trim() }, user.id)
      refresh()
      toast.success(form.id ? 'Webhook updated' : 'Webhook registered', form.url.trim())
      setForm(null)
    } finally {
      setIsBusy(false)
    }
  }

  async function removeHook() {
    if (!user || !pending) return
    setIsBusy(true)
    try {
      await deleteWebhook(pending.id, user.id)
      refresh()
      toast.success('Webhook removed', `${pending.url} will no longer receive events.`)
      setPending(null)
    } finally {
      setIsBusy(false)
    }
  }

  async function sendTest(hook: Webhook) {
    if (!user) return
    setBusyId(hook.id)
    try {
      const result = await testWebhook(hook.id, user.id)
      refresh()
      if (result && result.lastStatus === 200) {
        toast.success('Test delivered', `${hook.url} acknowledged the signed payload.`)
      } else {
        toast.warning('Not delivered', 'The subscription is inactive, so nothing was sent.')
      }
    } finally {
      setBusyId(null)
    }
  }

  async function toggleHook(hook: Webhook) {
    if (!user) return
    setBusyId(hook.id)
    try {
      await saveWebhook({ ...hook, isActive: !hook.isActive }, user.id)
      refresh()
      toast.info(hook.isActive ? 'Subscription paused' : 'Subscription resumed', hook.url)
    } finally {
      setBusyId(null)
    }
  }

  async function rotate(clientId: string, name: string) {
    if (!user) return
    setBusyId(clientId)
    try {
      const secret = await rotateApiSecret(clientId, user.id)
      refresh()
      if (secret) {
        setRevealed({ id: clientId, secret })
        toast.success('Secret rotated', `Copy the new secret for ${name} now — it is shown once.`)
      }
    } finally {
      setBusyId(null)
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Copied to clipboard')
    } catch {
      toast.error('Could not copy', 'Select the value and copy it manually.')
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Integrations"
        description="Outbound webhooks, machine-to-machine API clients and the staff single sign-on connection."
        icon={<Plug className="h-5 w-5" />}
        breadcrumbs={[{ label: 'Administration' }, { label: 'Integrations' }]}
        actions={
          canManage && tab === 'webhooks' ? (
            <Button leadingIcon={<Plus className="h-4 w-4" />} onClick={() => setForm({ ...BLANK })}>
              Add webhook
            </Button>
          ) : !canManage ? (
            <Badge tone="neutral">View only</Badge>
          ) : null
        }
      />

      {failing.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-crest-300 bg-crest-50 px-3 py-2 text-sm text-crest-900">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {failing.length} active subscription{failing.length === 1 ? '' : 's'} last returned an error. Deliveries retry
            with exponential backoff for 24 hours before the subscription is paused automatically.
          </span>
        </div>
      ) : null}

      <Tabs tabs={TABS} active={tab} onChange={setTab} label="Integration sections" />

      {tab === 'webhooks' ? (
        <Card>
          <CardHeader
            title="Outbound webhooks"
            description="Each delivery is signed with an HMAC-SHA256 header so the receiver can verify it came from HYPREP."
          />
          <CardBody className="p-0">
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th>Endpoint</Th>
                    <Th>Events</Th>
                    <Th>Last delivery</Th>
                    <Th>Result</Th>
                    <Th>State</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {hooks.map((hook) => (
                    <Tr key={hook.id}>
                      <Td>
                        <p className="max-w-xs truncate font-medium text-ink-900" title={hook.url}>
                          {hook.url}
                        </p>
                        <p className="mt-0.5 font-mono text-2xs text-ink-500">{hook.secretMasked}</p>
                      </Td>
                      <Td>
                        <div className="flex max-w-xs flex-wrap gap-1">
                          {hook.events.slice(0, 3).map((event) => (
                            <Badge key={event} tone="neutral" className="font-mono text-2xs">
                              {event}
                            </Badge>
                          ))}
                          {hook.events.length > 3 ? (
                            <Badge tone="neutral">+{hook.events.length - 3}</Badge>
                          ) : null}
                        </div>
                      </Td>
                      <Td className="text-ink-600">
                        {hook.lastDeliveryAt ? (
                          <span title={formatDateTime(hook.lastDeliveryAt)}>{formatRelative(hook.lastDeliveryAt)}</span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </Td>
                      <Td>
                        <Badge tone={statusTone(hook.lastStatus)}>{statusLabel(hook.lastStatus)}</Badge>
                      </Td>
                      <Td>
                        <Badge tone={hook.isActive ? 'success' : 'neutral'}>{hook.isActive ? 'Active' : 'Paused'}</Badge>
                      </Td>
                      <Td className="text-right">
                        {canManage ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              leadingIcon={<Send className="h-3.5 w-3.5" />}
                              onClick={() => sendTest(hook)}
                              isLoading={busyId === hook.id}
                            >
                              Test
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setForm({ ...hook })}>
                              Edit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => toggleHook(hook)}>
                              {hook.isActive ? 'Pause' : 'Resume'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Delete ${hook.url}`}
                              onClick={() => setPending(hook)}
                            >
                              <Trash2 className="h-4 w-4 text-crest-600" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-ink-400">—</span>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      ) : null}

      {tab === 'clients' ? (
        <div className="space-y-4">
          {revealed ? (
            <Card className="border-brand-300 bg-brand-50">
              <CardBody className="space-y-2">
                <p className="text-sm font-semibold text-brand-900">New client secret</p>
                <p className="text-xs text-brand-800">
                  This value is shown once. Store it in the integrator's secret manager — HYPREP keeps only a hash.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-brand-300 bg-white px-2 py-1.5 font-mono text-xs text-ink-800">
                    {revealed.secret}
                  </code>
                  <Button
                    size="sm"
                    variant="secondary"
                    leadingIcon={<Copy className="h-3.5 w-3.5" />}
                    onClick={() => copy(revealed.secret)}
                  >
                    Copy
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRevealed(null)}>
                    Dismiss
                  </Button>
                </div>
              </CardBody>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="API clients"
              description="OAuth 2.0 client-credentials grants. Scopes are least-privilege and audited on every call."
            />
            <CardBody className="p-0">
              <TableWrap>
                <Table>
                  <Thead>
                    <Tr>
                      <Th>Client</Th>
                      <Th>Client ID</Th>
                      <Th>Scopes</Th>
                      <Th>Last used</Th>
                      <Th>State</Th>
                      <Th className="text-right">Actions</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {clients.map((client) => (
                      <Tr key={client.id}>
                        <Td>
                          <p className="font-medium text-ink-900">{client.name}</p>
                          <p className="mt-0.5 text-2xs text-ink-500">Registered {formatRelative(client.createdAt)}</p>
                        </Td>
                        <Td>
                          <button
                            type="button"
                            onClick={() => copy(client.clientId)}
                            className="inline-flex items-center gap-1 rounded font-mono text-2xs text-ink-600 hover:text-brand-700"
                            title="Copy client ID"
                          >
                            {client.clientId}
                            <Copy className="h-3 w-3" />
                          </button>
                        </Td>
                        <Td>
                          <div className="flex max-w-xs flex-wrap gap-1">
                            {client.scopes.map((scope) => (
                              <Badge key={scope} tone="info" className="font-mono text-2xs">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        </Td>
                        <Td className="text-ink-600">
                          {client.lastUsedAt ? (
                            <span title={formatDateTime(client.lastUsedAt)}>{formatRelative(client.lastUsedAt)}</span>
                          ) : (
                            <span className="text-ink-400">Never</span>
                          )}
                        </Td>
                        <Td>
                          <Badge tone={client.isActive ? 'success' : 'neutral'}>
                            {client.isActive ? 'Active' : 'Revoked'}
                          </Badge>
                        </Td>
                        <Td className="text-right">
                          {canManage ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
                              onClick={() => rotate(client.id, client.name)}
                              isLoading={busyId === client.id}
                              disabled={!client.isActive}
                            >
                              Rotate secret
                            </Button>
                          ) : (
                            <span className="text-xs text-ink-400">—</span>
                          )}
                        </Td>
                      </Tr>
                    ))}
                  </Tbody>
                </Table>
              </TableWrap>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Available scopes" description="Requested at registration and reviewed annually." />
            <CardBody className="flex flex-wrap gap-1.5">
              {API_SCOPES.map((scope) => (
                <Badge key={scope} tone="neutral" className="font-mono text-2xs">
                  {scope}
                </Badge>
              ))}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === 'sso' ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <Card className="lg:col-span-3">
            <CardHeader
              title="Identity provider"
              description="Staff authenticate against the HYPREP directory; requestors keep local credentials."
              actions={<Badge tone={sso.isEnabled ? 'success' : 'neutral'}>{sso.isEnabled ? 'Connected' : 'Disabled'}</Badge>}
            />
            <CardBody>
              <DescriptionList
                columns={2}
                items={[
                  { label: 'Provider', value: sso.provider },
                  { label: 'Protocol', value: 'SAML 2.0' },
                  { label: 'Email domain', value: sso.domain },
                  { label: 'Tenant ID', value: <span className="font-mono text-2xs">{sso.tenantId}</span> },
                  {
                    label: 'Federation metadata',
                    value: (
                      <span className="flex items-center gap-1.5">
                        <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                        <span className="truncate font-mono text-2xs" title={sso.metadataUrl}>
                          {sso.metadataUrl}
                        </span>
                      </span>
                    ),
                    span: true,
                  },
                  { label: 'Default role for new sign-ins', value: getRole(sso.defaultRole)?.name ?? sso.defaultRole },
                  {
                    label: 'Last directory sync',
                    value: <span title={formatDateTime(sso.lastSyncAt)}>{formatRelative(sso.lastSyncAt)}</span>,
                  },
                ]}
              />
              <div className="mt-4 space-y-3 border-t border-ink-200 pt-4">
                <Toggle
                  checked={sso.autoProvision}
                  onChange={() => toast.info('Managed centrally', 'Provisioning rules are changed in the directory console.')}
                  label="Auto-provision accounts on first sign-in"
                  description="A matching directory group creates the account with the mapped role."
                  disabled={!canManage}
                />
                <Toggle
                  checked={sso.enforceForStaff}
                  onChange={() => toast.info('Managed centrally', 'Enforcement is set by the platform team.')}
                  label="Enforce SSO for all staff accounts"
                  description="Password sign-in is refused for any account on the hyprep.gov.ng domain."
                  disabled={!canManage}
                />
              </div>
            </CardBody>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader title="Group to role mapping" description="Directory groups decide what a staff member can do." />
            <CardBody className="space-y-2">
              {sso.mappedGroups.map((mapping) => {
                const role = getRole(mapping.roleId)
                return (
                  <div
                    key={mapping.group}
                    className="flex items-center justify-between gap-3 rounded-lg border border-ink-200 px-3 py-2"
                  >
                    <span className="truncate font-mono text-2xs text-ink-700">{mapping.group}</span>
                    <Badge tone="brand">{role?.name ?? mapping.roleId}</Badge>
                  </div>
                )
              })}
              <p className="pt-1 text-xs leading-relaxed text-ink-500">
                A member of several groups receives the most permissive mapped role. Removing someone from every mapped
                group suspends their account at the next sign-in attempt.
              </p>
            </CardBody>
          </Card>
        </div>
      ) : null}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit webhook' : 'Register webhook'}
        description="HYPREP will POST a signed JSON payload to this endpoint whenever a subscribed event occurs."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
            <Button onClick={persistHook} isLoading={isBusy}>
              {form?.id ? 'Save webhook' : 'Register webhook'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Input
            label="Endpoint URL"
            placeholder="https://portal.hyprep.gov.ng/api/hooks/foi"
            value={form?.url ?? ''}
            onChange={(event) => setForm((prev) => (prev ? { ...prev, url: event.target.value } : prev))}
            hint="Must be HTTPS. The receiver has 10 seconds to return a 2xx response."
            required
          />

          <div>
            <p className="mb-2 text-sm font-medium text-ink-700">Events</p>
            <div className="grid gap-1.5 rounded-lg border border-ink-200 p-3 sm:grid-cols-2">
              {WEBHOOK_EVENTS.map((event) => (
                <Checkbox
                  key={event}
                  label={event}
                  checked={form?.events.includes(event) ?? false}
                  onChange={() =>
                    setForm((prev) => (prev ? { ...prev, events: toggleIn(prev.events, event) } : prev))
                  }
                />
              ))}
            </div>
            <p className="mt-1.5 text-xs text-ink-500">
              {form?.events.length ?? 0} of {WEBHOOK_EVENTS.length} events selected.
            </p>
          </div>

          <Toggle
            checked={form?.isActive ?? true}
            onChange={(value) => setForm((prev) => (prev ? { ...prev, isActive: value } : prev))}
            label="Deliver events immediately"
            description="Turn this off to register the subscription without sending anything yet."
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={removeHook}
        title="Remove this webhook?"
        message={`${pending?.url ?? ''} will stop receiving events immediately. Delivery history is retained in the audit trail.`}
        confirmLabel="Remove webhook"
        destructive
        isBusy={isBusy}
      />
    </div>
  )
}
