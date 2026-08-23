import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { StatusCount } from '@/types'
import { STATUS_META } from '@/lib/constants'
import { formatNumber } from '@/lib/format'
import { ChartFrame, TOOLTIP_STYLE } from './ChartFrame'

/** Status distribution, colour-matched to the status badges used in the lists. */
export function StatusDonut({
  data,
  title = 'Cases by status',
  description = 'Live distribution of every case in your view.',
  height = 260,
  className,
}: {
  data: StatusCount[]
  title?: string
  description?: string
  height?: number
  className?: string
}) {
  const rows = data.filter((row) => row.count > 0)
  const total = rows.reduce((acc, row) => acc + row.count, 0)

  return (
    <ChartFrame
      title={title}
      description={description}
      height={height}
      isEmpty={rows.length === 0}
      className={className}
      legend={rows.map((row) => (
        <span key={row.status} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-2 rounded-sm" style={{ backgroundColor: STATUS_META[row.status].hex }} />
          <span className="text-ink-600">{STATUS_META[row.status].label}</span>
          <span className="font-semibold tabular-nums text-ink-800">{formatNumber(row.count)}</span>
        </span>
      ))}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip {...TOOLTIP_STYLE} />
          <Pie
            data={rows.map((row) => ({ name: STATUS_META[row.status].label, value: row.count, status: row.status }))}
            dataKey="value"
            nameKey="name"
            innerRadius="58%"
            outerRadius="86%"
            paddingAngle={2}
            stroke="#ffffff"
            strokeWidth={2}
          >
            {rows.map((row) => (
              <Cell key={row.status} fill={STATUS_META[row.status].hex} />
            ))}
          </Pie>
          <text x="50%" y="47%" textAnchor="middle" className="fill-ink-900 text-xl font-semibold">
            {formatNumber(total)}
          </text>
          <text x="50%" y="58%" textAnchor="middle" className="fill-ink-500 text-[10px] uppercase tracking-wide">
            total cases
          </text>
        </PieChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
