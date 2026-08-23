import { useMemo, useState } from 'react'
import {
  KeyRound,
  Pencil,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  Users as UsersIcon,
} from 'lucide-react'
import type { RoleId, User, UserStatus } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  Checkbox,
  ChoiceChip,
  ConfirmDialog,
  EmptyState,
  Pagination,
  SearchInput,
  StatCard,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  UserChip,
} from '@/components/ui'
import { PageHeader } from '@/components/common'
import { bulkSetUserStatus, listUsers, resetUserMfa, setUserStatus } from '@/mocks/adminApi'
import { reference } from '@/mocks/db'
import { ROLES } from '@/lib/rbac'
import { ROLE_LABELS } from '@/lib/constants'
import { formatDateTime, formatRelative } from '@/lib/format'
import { downloadTextFile, toCsv, toggleIn } from '@/lib/utils'
import { useAsync, useDebounced } from '@/hooks/useAsync'
import { useAuth } from '@/store/AuthContext'
import { useData } from '@/store/DataContext'
import { useToast } from '@/store/ToastContext'
import { UserFormDrawer } from './components/UserFormDrawer'

const STATUS_TONES: Record<UserStatus, 'success' | 'info' | 'warning' | 'danger'> = {
  active: 'success',
  invited: 'info',
  suspended: 'warning',
  locked: 'danger',
}

const STATUS_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  invited: 'Invited',
  suspended: 'Suspended',
  locked: 'Locked',
}

const STATUS_ORDER: UserStatus[] = ['active', 'invited', 'suspended', 'locked']

/** FR-001 / FR-004: the user directory with role, status and MFA administration. */
export function UsersPage() {
  const { user, can, isReadOnly } = useAuth()
  const { version, refresh } = useData()
  const toast = useToast()

  const [term, setTerm] = useState('')
  const [roleIds, setRoleIds] = useState<RoleId[]>([])
  const [statuses, setStatuses] = useState<UserStatus[]>([])
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const [editing, setEditing] = useState<User | null | undefined>(undefined)
  const [pending, setPending] = useState<{ user: User; status: UserStatus } | null>(null)
  const [isBusy, setBusy] = useState(false)

  const debounced = useDebounced(term)
  const canWrite = can('user:write') && !isReadOnly

  const result = useAsync(
    () =>
      listUsers({
        q: debounced || undefined,
        roleIds: roleIds.length ? roleIds : undefined,
        statuses: statuses.length ? statuses : undefined,
        page,
        pageSize: 15,
      }),
    [debounced, roleIds, statuses, page, version],
  )

  const rows = result.data?.rows ?? []

  const stats = useMemo(() => {
    const all = reference.users
    return {
      total: all.length,
      active: all.filter((row) => row.status === 'active').length,
      pending: all.filter((row) => row.status === 'invited').length,
      restricted: all.filter((row) => row.status === 'suspended' || row.status === 'locked').length,
      mfa: all.filter((row) => row.mfaEnabled).length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const roleCounts = useMemo(() => {
    const map = new Map<RoleId, number>()
    reference.users.forEach((row) => map.set(row.roleId, (map.get(row.roleId) ?? 0) + 1))
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const allOnPageSelected = rows.length > 0 && rows.every((row) => selected.includes(row.id))

  const toggleAll = () => setSelected(allOnPageSelected ? [] : rows.map((row) => row.id))

  const applyStatus = async () => {
    if (!pending || !user) return
    setBusy(true)
    try {
      await setUserStatus(pending.user.id, pending.status, user.id)
      refresh()
      toast.success(
        `${pending.user.name} ${pending.status === 'active' ? 'reinstated' : STATUS_LABELS[pending.status].toLowerCase()}`,
        'The change is recorded in the audit trail.',
      )
    } finally {
      setBusy(false)
      setPending(null)
    }
  }

  const bulk = async (status: UserStatus) => {
    if (!user || selected.length === 0) return
    setBusy(true)
    try {
      const count = selected.length
      await bulkSetUserStatus(selected, status, user.id)
      refresh()
      setSelected([])
      toast.success(`${count} account${count === 1 ? '' : 's'} updated`, `Status set to ${STATUS_LABELS[status]}.`)
    } finally {
      setBusy(false)
    }
  }

  const resetMfa = async (target: User) => {
    if (!user) return
    await resetUserMfa(target.id, user.id)
    refresh()
    toast.success('MFA reset', `${target.name} will be asked to re-enrol at next sign-in.`)
  }

  const exportDirectory = () => {
    downloadTextFile(
      `hyprep-foi-users-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['Name', 'Email', 'Role', 'Department', 'Status', 'MFA', 'Last login'],
        reference.users.map((row) => [
          row.name,
          row.email,
          ROLE_LABELS[row.roleId],
          row.department ?? '',
          STATUS_LABELS[row.status],
          row.mfaEnabled ? 'Enabled' : 'Disabled',
          row.lastLoginAt ?? '',
        ]),
      ),
      'text/csv',
    )
    toast.success('Directory exported', `${reference.users.length} accounts written to CSV.`)
  }

  const resetFilters = () => {
    setTerm('')
    setRoleIds([])
    setStatuses([])
    setPage(1)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="User management"
        description="Create accounts, assign roles, enforce multi-factor authentication and suspend access."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Administration' }, { label: 'Users' }]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="ghost" onClick={exportDirectory}>
              Export directory
            </Button>
            {canWrite ? (
              <Button leadingIcon={<UserPlus className="h-4 w-4" />} onClick={() => setEditing(null)}>
                Invite user
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Accounts" value={stats.total} icon={<UsersIcon className="h-5 w-5" />} />
        <StatCard label="Active" value={stats.active} tone="success" hint="Signed in at least once" />
        <StatCard label="Awaiting first sign-in" value={stats.pending} tone="info" hint="Invitations sent" />
        <StatCard
          label="MFA enrolled"
          value={`${Math.round((stats.mfa / Math.max(1, stats.total)) * 100)}%`}
          tone={stats.mfa === stats.total ? 'success' : 'warning'}
          hint={`${stats.restricted} suspended or locked`}
          icon={<ShieldCheck className="h-5 w-5" />}
        />
      </div>

      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={term}
              onChange={(value) => {
                setTerm(value)
                setPage(1)
              }}
              placeholder="Search by name, email, position or department"
              label="Search users"
              className="min-w-[16rem] flex-1"
            />
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              Reset
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ROLES.map((role) => (
              <ChoiceChip
                key={role.id}
                selected={roleIds.includes(role.id)}
                onClick={() => {
                  setRoleIds(toggleIn(roleIds, role.id))
                  setPage(1)
                }}
              >
                {role.name} ({roleCounts.get(role.id) ?? 0})
              </ChoiceChip>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_ORDER.map((status) => (
              <ChoiceChip
                key={status}
                selected={statuses.includes(status)}
                onClick={() => {
                  setStatuses(toggleIn(statuses, status))
                  setPage(1)
                }}
              >
                {STATUS_LABELS[status]}
              </ChoiceChip>
            ))}
          </div>
        </CardBody>
      </Card>

      {selected.length > 0 && canWrite ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="text-sm font-medium text-brand-900">
            {selected.length} account{selected.length === 1 ? '' : 's'} selected
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => bulk('active')} isLoading={isBusy}>
              Reinstate
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulk('suspended')} isLoading={isBusy}>
              Suspend
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        </div>
      ) : null}

      <Card>
        <CardBody className="p-0">
          {rows.length === 0 && !result.isLoading ? (
            <div className="p-5">
              <EmptyState
                icon={<UsersIcon className="h-6 w-6" />}
                title="No accounts match these filters"
                description="Clear a filter or search a different name."
                action={
                  <Button variant="secondary" onClick={resetFilters}>
                    Reset filters
                  </Button>
                }
              />
            </div>
          ) : (
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    {canWrite ? (
                      <Th className="w-10">
                        <Checkbox
                          checked={allOnPageSelected}
                          onChange={toggleAll}
                          label=""
                          aria-label="Select all on this page"
                        />
                      </Th>
                    ) : null}
                    <Th>User</Th>
                    <Th>Role</Th>
                    <Th>Department</Th>
                    <Th>Status</Th>
                    <Th>MFA</Th>
                    <Th>Last sign-in</Th>
                    <Th className="text-right">Actions</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {rows.map((row) => (
                    <Tr key={row.id} selected={selected.includes(row.id)}>
                      {canWrite ? (
                        <Td>
                          <Checkbox
                            checked={selected.includes(row.id)}
                            onChange={() => setSelected(toggleIn(selected, row.id))}
                            label=""
                            aria-label={`Select ${row.name}`}
                          />
                        </Td>
                      ) : null}
                      <Td>
                        <UserChip user={row} secondary={row.email} />
                      </Td>
                      <Td>
                        <Badge tone={row.roleId === 'super_admin' ? 'purple' : 'brand'}>
                          {ROLE_LABELS[row.roleId]}
                        </Badge>
                      </Td>
                      <Td className="text-ink-600">
                        <p>{row.department ?? '—'}</p>
                        {row.position ? <p className="text-2xs text-ink-400">{row.position}</p> : null}
                      </Td>
                      <Td>
                        <Badge tone={STATUS_TONES[row.status]} dot>
                          {STATUS_LABELS[row.status]}
                        </Badge>
                      </Td>
                      <Td>
                        {row.mfaEnabled ? (
                          <span className="inline-flex items-center gap-1 text-xs text-brand-700">
                            <ShieldCheck className="h-3.5 w-3.5" /> Enabled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-gold-700">
                            <ShieldOff className="h-3.5 w-3.5" /> Not enrolled
                          </span>
                        )}
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-ink-500" title={formatDateTime(row.lastLoginAt)}>
                        {row.lastLoginAt ? formatRelative(row.lastLoginAt) : 'Never'}
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          {canWrite ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Edit ${row.name}`}
                                onClick={() => setEditing(row)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                aria-label={`Reset MFA for ${row.name}`}
                                onClick={() => resetMfa(row)}
                              >
                                <KeyRound className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  setPending({ user: row, status: row.status === 'active' ? 'suspended' : 'active' })
                                }
                              >
                                {row.status === 'active' ? 'Suspend' : 'Reinstate'}
                              </Button>
                            </>
                          ) : (
                            <span className="text-xs text-ink-400">View only</span>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </CardBody>
      </Card>

      {result.data && result.data.pageCount > 1 ? (
        <Pagination
          page={result.data.page}
          pageSize={result.data.pageSize}
          total={result.data.total}
          onPageChange={setPage}
          label="accounts"
        />
      ) : null}

      <UserFormDrawer
        open={editing !== undefined}
        user={editing ?? null}
        onClose={() => setEditing(undefined)}
        onSaved={() => {
          setEditing(undefined)
          refresh()
        }}
      />

      <ConfirmDialog
        open={Boolean(pending)}
        onClose={() => setPending(null)}
        onConfirm={applyStatus}
        title={pending?.status === 'active' ? 'Reinstate this account?' : 'Suspend this account?'}
        message={
          pending?.status === 'active'
            ? `${pending?.user.name ?? ''} will be able to sign in again immediately.`
            : `${pending?.user.name ?? ''} will be signed out of all sessions and blocked from signing in. Their case assignments are retained.`
        }
        confirmLabel={pending?.status === 'active' ? 'Reinstate' : 'Suspend account'}
        destructive={pending?.status !== 'active'}
        isBusy={isBusy}
      />
    </div>
  )
}
