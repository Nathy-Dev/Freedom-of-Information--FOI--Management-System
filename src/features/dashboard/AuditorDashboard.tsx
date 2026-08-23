import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Eye, FileSearch, Gauge, ScrollText, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Badge, ButtonLink, Card, CardBody, CardHeader, StatCard } from '@/components/ui'
import { PageHeader } from '@/components/common'
import { BarChartCard, SlaGauge, StatusDonut } from '@/components/charts'
import { dashboardMetrics } from '@/mocks/metrics'
import { db, reference } from '@/mocks/db'
import { AUDIT_ACTION_META } from '@/lib/constants'
import { formatDateTime, formatDays, formatNumber, formatPercent } from '@/lib/format'
import { useData } from '@/store/DataContext'

/** FR-006: the Auditor's read-only compliance view. Nothing here mutates data. */
export function AuditorDashboard() {
  const { version } = useData()

  const view = useMemo(() => {
    const metrics = dashboardMetrics(db.cases, reference.assignableStaff)

    const aging = metrics.aging.map((bucket) => ({ label: bucket.bucket, value: bucket.count }))

    const breaches = db.cases
      .filter((row) => row.respondedAt && row.respondedAt.slice(0, 10) > row.statutoryDueDate)
      .slice(0, 8)

    return {
      metrics,
      aging,
      breaches,
      auditCount: db.auditLogs.length,
      accessCount: db.accessLogs.length,
      criticalCount: db.auditLogs.filter((log) => log.severity === 'critical').length,
      latest: db.auditLogs.slice(0, 8),
      redacted: db.documents.filter((doc) => doc.isRedacted).length,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const { metrics } = view

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance overview"
        description="Read-only oversight of statutory performance, disclosure decisions and system activity."
        meta={
          <Badge tone="info" className="gap-1">
            <Eye aria-hidden className="h-3 w-3" />
            Read-only access
          </Badge>
        }
        actions={
          <>
            <ButtonLink to="/audit" variant="outline" leadingIcon={<ScrollText aria-hidden className="h-4 w-4" />}>
              Audit trail
            </ButtonLink>
            <ButtonLink to="/reports" leadingIcon={<FileSearch aria-hidden className="h-4 w-4" />}>
              Reports
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Statutory compliance"
          value={formatPercent(metrics.slaComplianceRate)}
          hint={`${formatNumber(metrics.totalCases)} requests assessed`}
          icon={<Gauge aria-hidden className="h-4.5 w-4.5" />}
          tone={metrics.slaComplianceRate >= 90 ? 'success' : 'warning'}
        />
        <StatCard
          label="Currently overdue"
          value={metrics.overdueCases}
          hint={`Average response ${formatDays(metrics.avgResponseDays)}`}
          icon={<TriangleAlert aria-hidden className="h-4.5 w-4.5" />}
          tone="danger"
          to="/cases?sla=overdue"
        />
        <StatCard
          label="Audit entries"
          value={formatNumber(view.auditCount)}
          hint={`${view.criticalCount} critical · ${formatNumber(view.accessCount)} access records`}
          icon={<ScrollText aria-hidden className="h-4.5 w-4.5" />}
          tone="neutral"
          to="/audit"
        />
        <StatCard
          label="Redacted disclosures"
          value={view.redacted}
          hint="Severances recorded against grounds in the Act"
          icon={<ShieldCheck aria-hidden className="h-4.5 w-4.5" />}
          tone="info"
          to="/documents?redacted=1"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card>
          <CardHeader title="Compliance dial" description="Concluded requests answered inside the statutory window." />
          <CardBody className="flex justify-center">
            <SlaGauge
              rate={metrics.slaComplianceRate}
              caption={`${metrics.appealsCount} appeals · ${metrics.escalationsCount} escalations`}
            />
          </CardBody>
        </Card>
        <BarChartCard
          data={view.aging}
          title="Age of open requests"
          description="How long open requests have been on the register."
          color="#EDAF1E"
          showValues
        />
        <StatusDonut data={metrics.statusCounts} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Late determinations"
            description="Requests answered after the statutory response date."
            actions={
              <Link to="/reports" className="text-xs font-semibold text-brand-700 hover:underline">
                Build report
              </Link>
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {view.breaches.map((row) => (
                <li key={row.id} className="px-4 py-3">
                  <Link to={`/cases/${row.id}`} className="block hover:underline">
                    <p className="truncate text-sm font-medium text-ink-900">{row.subject}</p>
                  </Link>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-500">
                    <span className="font-mono text-[11px]">{row.caseNumber}</span>
                    <span aria-hidden>·</span>
                    <span>Due {row.statutoryDueDate}</span>
                    <span aria-hidden>·</span>
                    <span className="font-medium text-crest-600">
                      Answered {row.respondedAt?.slice(0, 10)}
                    </span>
                  </p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Latest audit entries"
            description="Every action on the register is recorded with actor, time and address."
            actions={
              <Link to="/audit" className="text-xs font-semibold text-brand-700 hover:underline">
                View all
              </Link>
            }
          />
          <CardBody className="p-0">
            <ul className="divide-y divide-ink-100">
              {view.latest.map((log) => (
                <li key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <span
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${AUDIT_ACTION_META[log.action].className}`}
                  >
                    {AUDIT_ACTION_META[log.action].label}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-900">{log.entityLabel}</p>
                    <p className="mt-0.5 line-clamp-2-safe text-xs text-ink-500">{log.details}</p>
                    <p className="mt-1 font-mono text-[10px] text-ink-400">
                      {formatDateTime(log.timestamp)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
