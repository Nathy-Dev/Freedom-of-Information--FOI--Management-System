import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { TrendPoint } from '@/types'
import { AXIS_STYLE, ChartFrame, TOOLTIP_STYLE } from './ChartFrame'

const SERIES = [
  { key: 'received', label: 'Received', color: '#008751' },
  { key: 'responded', label: 'Responded', color: '#0EA5E9' },
  { key: 'closed', label: 'Concluded', color: '#EDAF1E' },
] as const

/** FR-052: monthly volume trend across received / responded / concluded. */
export function TrendChart({
  data,
  title = 'Request volume trend',
  description = 'Requests received against responses issued and cases concluded, by month.',
  height = 280,
  className,
}: {
  data: TrendPoint[]
  title?: string
  description?: string
  height?: number
  className?: string
}) {
  return (
    <ChartFrame title={title} description={description} height={height} isEmpty={data.length === 0} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: -14, bottom: 0 }}>
          <defs>
            {SERIES.map((series) => (
              <linearGradient key={series.key} id={`grad-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={series.color} stopOpacity={0.28} />
                <stop offset="100%" stopColor={series.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F0" vertical={false} />
          <XAxis dataKey="period" {...AXIS_STYLE} />
          <YAxis allowDecimals={false} {...AXIS_STYLE} width={44} />
          <Tooltip {...TOOLTIP_STYLE} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={7}
            wrapperStyle={{ fontSize: 11, paddingBottom: 8 }}
          />
          {SERIES.map((series) => (
            <Area
              key={series.key}
              type="monotone"
              dataKey={series.key}
              name={series.label}
              stroke={series.color}
              strokeWidth={2}
              fill={`url(#grad-${series.key})`}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
