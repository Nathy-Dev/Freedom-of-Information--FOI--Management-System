import { useMemo, useState } from 'react'
import { Check, Info, Lock, Minus, ShieldCheck, Users } from 'lucide-react'
import type { Permission, RoleId } from '@/types'
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  ChoiceChip,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
  Tooltip,
} from '@/components/ui'
import { PageHeader } from '@/components/common'
import { reference } from '@/mocks/db'
import { ALL_PERMISSIONS, PERMISSION_GROUPS, ROLES } from '@/lib/rbac'
import { downloadTextFile, toCsv } from '@/lib/utils'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'

/** FR-002 / FR-003: the permission matrix that governs navigation and route guards. */
export function RolesPage() {
  const { can } = useAuth()
  const toast = useToast()

  const [focus, setFocus] = useState<RoleId | null>(null)
  const [group, setGroup] = useState<string | null>(null)

  const counts = useMemo(() => {
    const map = new Map<RoleId, number>()
    reference.users.forEach((user) => map.set(user.roleId, (map.get(user.roleId) ?? 0) + 1))
    return map
  }, [])

  const groups = group ? PERMISSION_GROUPS.filter((entry) => entry.group === group) : PERMISSION_GROUPS
  const roles = focus ? ROLES.filter((role) => role.id === focus) : ROLES

  const held = (roleId: RoleId, permission: Permission) =>
    ROLES.find((role) => role.id === roleId)!.permissions.includes(permission)

  const exportMatrix = () => {
    downloadTextFile(
      `hyprep-foi-permission-matrix-${new Date().toISOString().slice(0, 10)}.csv`,
      toCsv(
        ['Group', 'Permission', ...ROLES.map((role) => role.name)],
        PERMISSION_GROUPS.flatMap((entry) =>
          entry.permissions.map((permission) => [
            entry.group,
            permission.label,
            ...ROLES.map((role) => (role.permissions.includes(permission.id) ? 'Yes' : 'No')),
          ]),
        ),
      ),
      'text/csv',
    )
    toast.success('Matrix exported', `${ALL_PERMISSIONS.length} permissions across ${ROLES.length} roles.`)
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Roles & permissions"
        description="The seven user classes in the system. Permissions granted here drive both the navigation and the route guards."
        breadcrumbs={[{ label: 'Home', to: '/' }, { label: 'Administration' }, { label: 'Roles' }]}
        actions={
          can('audit:export') ? (
            <Button variant="secondary" onClick={exportMatrix}>
              Export matrix
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {ROLES.map((role) => (
          <Card key={role.id} className={focus === role.id ? 'ring-2 ring-brand-400' : undefined}>
            <CardBody className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink-900">{role.name}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-2xs text-ink-500">
                    <Users className="h-3 w-3" />
                    {counts.get(role.id) ?? 0} account{(counts.get(role.id) ?? 0) === 1 ? '' : 's'}
                  </p>
                </div>
                {role.isSystem ? (
                  <Tooltip content="System role — the permission set is fixed">
                    <span className="rounded-md bg-ink-100 p-1 text-ink-500">
                      <Lock className="h-3.5 w-3.5" />
                    </span>
                  </Tooltip>
                ) : null}
              </div>
              <p className="text-xs leading-relaxed text-ink-600 line-clamp-4">{role.description}</p>
              <div className="flex items-center justify-between pt-1">
                <Badge tone={role.id === 'super_admin' ? 'purple' : 'brand'}>
                  {role.permissions.length}/{ALL_PERMISSIONS.length} permissions
                </Badge>
                <button
                  type="button"
                  onClick={() => setFocus(focus === role.id ? null : role.id)}
                  className="text-2xs font-medium text-brand-700 hover:underline"
                >
                  {focus === role.id ? 'Show all roles' : 'Focus'}
                </button>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ChoiceChip selected={group === null} onClick={() => setGroup(null)}>
          All groups
        </ChoiceChip>
        {PERMISSION_GROUPS.map((entry) => (
          <ChoiceChip
            key={entry.group}
            selected={group === entry.group}
            onClick={() => setGroup(group === entry.group ? null : entry.group)}
          >
            {entry.group}
          </ChoiceChip>
        ))}
      </div>

      {groups.map((entry) => (
        <Card key={entry.group}>
          <CardHeader
            title={entry.group}
            description={entry.description}
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <CardBody className="p-0">
            <TableWrap>
              <Table>
                <Thead>
                  <Tr>
                    <Th className="min-w-[18rem]">Permission</Th>
                    {roles.map((role) => (
                      <Th key={role.id} className="text-center">
                        {role.name}
                      </Th>
                    ))}
                  </Tr>
                </Thead>
                <Tbody>
                  {entry.permissions.map((permission) => (
                    <Tr key={permission.id}>
                      <Td>
                        <p className="text-sm text-ink-800">{permission.label}</p>
                        <p className="mt-0.5 font-mono text-2xs text-ink-400">{permission.id}</p>
                      </Td>
                      {roles.map((role) => (
                        <Td key={role.id} className="text-center">
                          {held(role.id, permission.id) ? (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-100 text-brand-700"
                              aria-label={`${role.name} has this permission`}
                            >
                              <Check className="h-3 w-3" />
                            </span>
                          ) : (
                            <span
                              className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-ink-400"
                              aria-label={`${role.name} does not have this permission`}
                            >
                              <Minus className="h-3 w-3" />
                            </span>
                          )}
                        </Td>
                      ))}
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      ))}

      <Card>
        <CardBody className="flex items-start gap-3">
          <span className="mt-0.5 rounded-md bg-sky-50 p-1.5 text-sky-600">
            <Info className="h-4 w-4" />
          </span>
          <div className="text-xs leading-relaxed text-ink-600">
            <p className="font-medium text-ink-800">Row-level scope sits on top of these permissions</p>
            <p className="mt-1">
              <span className="font-mono text-2xs">case:read:all</span> exposes every request,{' '}
              <span className="font-mono text-2xs">case:read:assigned</span> narrows to the officer&rsquo;s own and team
              caseload, and <span className="font-mono text-2xs">case:read:own</span> limits a requestor to the requests
              they filed. The Auditor role is read-only: write permissions are never granted, and the interface disables
              every mutating control for it.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
