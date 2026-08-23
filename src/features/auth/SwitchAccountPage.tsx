import { useNavigate } from 'react-router-dom'
import { Repeat, ShieldCheck } from 'lucide-react'
import type { RoleId } from '@/types'
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { ROLE_LABELS } from '@/lib/constants'
import { homeRouteFor, ROLES } from '@/lib/rbac'
import { usersById } from '@/mocks/db'
import { useAuth } from '@/store/AuthContext'
import { useToast } from '@/store/ToastContext'
import { DemoAccountPicker } from './DemoAccountPicker'

/**
 * Review aid, reachable from the account menu: swap identity without signing
 * out, so a reviewer can compare the same screen across roles.
 */
export function SwitchAccountPage() {
  const { user, role, switchRole } = useAuth()
  const navigate = useNavigate()
  const toast = useToast()

  const applyRole = (roleId: RoleId) => {
    switchRole(roleId)
    toast.info(`Now viewing as ${ROLE_LABELS[roleId]}`, 'Navigation and permissions updated.')
    navigate(homeRouteFor(roleId))
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Switch demo account"
        description="This prototype ships with one account per user class so the review can move between them freely. No password is required."
        icon={<Repeat aria-hidden className="h-5 w-5" />}
        breadcrumbs={[{ label: 'Account' }, { label: 'Switch account' }]}
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Sign in as another user"
            description="Each account carries its own permissions, row-level visibility and dashboard."
          />
          <CardBody>
            <DemoAccountPicker
              columns={2}
              onPicked={(userId) => {
                const next = usersById.get(userId)
                toast.success(`Signed in as ${next?.name ?? 'demo user'}`)
                navigate(homeRouteFor(next?.roleId ?? 'requestor'))
              }}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Or keep this account and change role"
            description="Useful for showing how one screen behaves under a different permission set."
            icon={<ShieldCheck aria-hidden className="h-4.5 w-4.5 text-brand-600" />}
          />
          <CardBody className="space-y-2">
            {ROLES.map((entry) => {
              const active = entry.id === user?.roleId
              return (
                <div
                  key={entry.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-ink-200 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                      {entry.name}
                      {active ? <Badge tone="brand">Current</Badge> : null}
                    </p>
                    <p className="mt-0.5 line-clamp-2-safe text-xs text-ink-500">{entry.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={active ? 'subtle' : 'outline'}
                    disabled={active}
                    onClick={() => applyRole(entry.id)}
                  >
                    {active ? 'Active' : 'Use role'}
                  </Button>
                </div>
              )
            })}
            <p className="pt-1 text-xs text-ink-500">
              Signed in as <span className="font-medium text-ink-700">{user?.name}</span> ·{' '}
              {role.name} · {user?.email}
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
