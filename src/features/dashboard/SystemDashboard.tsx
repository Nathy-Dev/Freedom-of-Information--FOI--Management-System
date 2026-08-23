import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Database,
  HardDriveDownload,
  Server,
  Settings2,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { Badge, ButtonLink, Card, CardBody, CardHeader, StatCard, Table, TableWrap, Tbody, Td, Th, Thead, Tr } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { BarChartCard, StatusDonut, TrendChart } from '@/components/charts'
import { dashboardMetrics } from '@/mocks/metrics'
import { db, reference } from '@/mocks/db'
import { AUDIT_SEVERITY_META, ROLE_LABELS } from '@/lib/constants'
import { formatBytes, formatDateTime, formatNumber, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { useData } from '@/store/DataContext'
import { CaseMiniList } from './components/CaseMiniList'

const HEALTH_TONE = {
  operational: 'bg-brand-500',
  degraded: 'bg-gold-400',
  down: 'bg-crest-500',
} as const

/** FR-060: the Super-Admin view — platform health, accounts, storage, audit. */
export function SystemDashboard() {
  const { version } = useData()

  const view = useMemo(() => {
    const metrics = dashboardMetrics(db.cases, reference.assignableStaff)
    const users = reference.users

    const byRole = Object.entries(
      users.reduce<Record<string, number>>((acc, user) => {
        acc[user.roleId] = (acc[user.roleId] ?? 0) + 1
        return acc
      }, {}),
    ).map(([roleId, count]) => ({
      label: ROLE_LABELS[roleId as keyof typeof ROLE_LABELS] ?? roleId,
      value: count,
    }))

    const storageBytes = db.documents.reduce((total, doc) => total + doc.fileSize, 0)
    const criticalAudit = db.auditLogs
      .filter((log) => log.severity === 'critical' || log.severity === 'warning')
      .slice(0, 7)

    return {
      metrics,
      users,
      byRole,
      storageBytes,
      criticalAudit,
      activeUsers: users.filter((user) => user.status === 'active').length,
      lockedUsers: users.filter((user) => user.status === 'suspended').length,
      invited: users.filter((user) => user.status === 'invited').length,
      mfaAdoption: Math.round((users.filter((user) => user.mfaEnabled).length / users.length) * 100),
      recent: db.cases.slice(0, 6),
      backups: reference.backups,
      health: reference.serviceHealth,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return (
    <div className="space-y-6">
      <PageHeader
        title="System overview"
        description="Platform health, accounts, storage and security posture for the FOI Management System."
        actions={
          <>
            <ButtonLink to="/system/monitoring" variant="outline" leadingIcon={<Activity aria-hidden className="h-4 w-4" />}>
              Monitoring
            </ButtonLink>
            <ButtonLink to="/system/settings" leadingIcon={<Settings2 aria-hidden className="h-4 w-4" />}>
              System settings
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Cases on file"
          value={formatNumber(view.metrics.totalCases)}
          hint={`${view.metrics.openCases} open · ${view.metrics.overdueCases} overdue`}
          icon={<Database aria-hidden className="h-4.5 w-4.5" />}
          tone="brand"
          to="/cases"
        />
        <StatCard
          label="User accounts"
          value={view.users.length}
          hint={`${view.activeUsers} active · ${view.invited} invited · ${view.lockedUsers} suspended`}
          icon={<Users aria-hidden className="h-4.5 w-4.5" />}
          tone="info"
          to="/admin/users"
        />
        <StatCard
          label="MFA adoption"
          value={`${view.mfaAdoption}%`}
          hint="Required for Super-Admin, Admin and Legal Unit roles"
          icon={<ShieldAlert aria-hidden className="h-4.5 w-4.5" />}
          tone={view.mfaAdoption >= 80 ? 'success' : 'warning'}
          to="/admin/users?mfa=off"
        />
        <StatCard
          label="Document storage"
          value={formatBytes(view.storageBytes)}
          hint={`${formatNumber(db.documents.length)} files in ${reference.systemSettings.storageBucket}`}
          icon={<HardDriveDownload aria-hidden className="h-4.5 w-4.5" />}
          tone="neutral"
          to="/documents"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Service health"
            description="Live status of the components the FOI system depends on."
            icon={<Server aria-hidden className="h-4.5 w-4.5 text-brand-600" />}
            actions={
              <Link to="/system/monitoring" className="text-xs font-semibold text-brand-700 hover:underline">
                Open monitoring
              </Link>
            }
          />
          <CardBody className="grid gap-2.5 sm:grid-cols-2">
            {view.health.map((service) => (
              <div
                key={service.name}
                className="flex items-start gap-2.5 rounded-xl border border-ink-200 px-3 py-2.5"
              >
                <span
                  aria-hidden
                  className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', HEALTH_TONE[service.status])}
                />
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-ink-900">
                    <span className="truncate">{service.name}</span>
                    <span className="shrink-0 font-mono text-[10px] text-ink-400">{service.latencyMs} ms</span>
                  </p>
                  <p className="mt-0.5 line-clamp-2-safe text-xs text-ink-500">{service.detail}</p>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <BarChartCard
          data={view.byRole}
          title="Accounts by user class"
          description="Distribution of accounts across the seven user classes."
          layout="vertical"
          yAxisWidth={140}
          showValues
          height={300}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <TrendChart data={view.metrics.trend} className="xl:col-span-2" />
        <StatusDonut data={view.metrics.statusCounts} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Security events needing attention"
            description="Warning and critical entries from the audit trail."
            icon={<ShieldAlert aria-hidden className="h-4.5 w-4.5 text-crest-600" />}
            actions={
              <Link to="/audit" className="text-xs font-semibold text-brand-700 hover:underline">
                Full trail
              </Link>
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {view.criticalAudit.map((log) => (
                <li key={log.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{log.entityLabel}</p>
                      <p className="mt-0.5 line-clamp-2-safe text-xs text-ink-500">{log.details}</p>
                      <p className="mt-1 font-mono text-[10px] text-ink-400">
                        {log.ipAddress} · {formatRelative(log.timestamp)}
                      </p>
                    </div>
                    <Badge
                      tone={log.severity === 'critical' ? 'danger' : 'warning'}
                      className="shrink-0"
                    >
                      {AUDIT_SEVERITY_META[log.severity].label}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Backups"
            description="Nightly incremental with a weekly full copy to off-site storage."
            icon={<HardDriveDownload aria-hidden className="h-4.5 w-4.5 text-brand-600" />}
            actions={
              <Link to="/system/backups" className="text-xs font-semibold text-brand-700 hover:underline">
                Manage
              </Link>
            }
          />
          <CardBody className="p-0">
            <TableWrap className="max-h-80">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Started</Th>
                    <Th>Type</Th>
                    <Th>Size</Th>
                    <Th>Status</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {view.backups.slice(0, 6).map((backup) => (
                    <Tr key={backup.id}>
                      <Td className="whitespace-nowrap text-xs">{formatDateTime(backup.startedAt)}</Td>
                      <Td className="text-xs capitalize">{backup.type}</Td>
                      <Td className="whitespace-nowrap text-xs">{backup.sizeMb.toLocaleString()} MB</Td>
                      <Td>
                        <Badge
                          tone={
                            backup.status === 'success' ? 'success' : backup.status === 'running' ? 'info' : 'danger'
                          }
                        >
                          {backup.status}
                        </Badge>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </CardBody>
        </Card>
      </div>

      <CaseMiniList
        title="Most recent requests"
        description="The latest FOI requests received across every department."
        cases={view.recent}
        viewAllTo="/cases"
      />
    </div>
  )
}
