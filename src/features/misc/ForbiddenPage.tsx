import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, LifeBuoy, Lock, ShieldAlert } from 'lucide-react'
import { Badge, ButtonLink, Card, CardBody } from '@/components/ui'
import { DescriptionList } from '@/components/common'
import { formatDateTime } from '@/lib/format'
import { useAuth } from '@/store/AuthContext'

/**
 * FR-003: a denied route explains *why* rather than dead-ending, and records
 * enough detail for the user to quote when asking an administrator for access.
 */
export function ForbiddenPage() {
  const { user, role, homeRoute } = useAuth()
  const location = useLocation()

  const attempted = (location.state as { from?: string } | null)?.from ?? location.pathname

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center py-10 text-center">
      <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-crest-50 text-crest-600">
        <ShieldAlert className="h-7 w-7" />
      </span>

      <Badge tone="danger" className="mt-4">
        403 — Access denied
      </Badge>

      <h1 className="mt-3 text-2xl font-semibold text-ink-900">You do not have permission for this page</h1>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-ink-600">
        Permissions in this system are granted by role, not per person. Your current role does not carry the permission
        this page requires, so the request was refused and the attempt was written to the audit trail.
      </p>

      <Card className="mt-6 w-full text-left">
        <CardBody>
          <DescriptionList
            columns={2}
            items={[
              { label: 'Page requested', value: <span className="font-mono text-xs">{attempted}</span>, span: true },
              { label: 'Signed in as', value: user?.name ?? 'Not signed in' },
              { label: 'Role', value: role?.name ?? '—' },
              { label: 'Permissions held', value: role ? `${role.permissions.length}` : '0' },
              { label: 'Attempted at', value: formatDateTime(new Date().toISOString()) },
            ]}
          />
        </CardBody>
      </Card>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <ButtonLink to={homeRoute} leadingIcon={<ArrowLeft className="h-4 w-4" />}>
          Back to my dashboard
        </ButtonLink>
        <ButtonLink to="/profile?tab=permissions" variant="secondary" leadingIcon={<Lock className="h-4 w-4" />}>
          See my permissions
        </ButtonLink>
        <ButtonLink to="/help" variant="ghost" leadingIcon={<LifeBuoy className="h-4 w-4" />}>
          Get help
        </ButtonLink>
      </div>

      <p className="mt-5 text-xs text-ink-500">
        Need this access for your work? Ask an administrator to review your role on the{' '}
        <Link to="/help" className="font-medium text-brand-700 underline-offset-2 hover:underline">
          contact page
        </Link>
        , quoting the page path above.
      </p>
    </div>
  )
}
