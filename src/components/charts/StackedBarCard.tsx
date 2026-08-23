import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_STYLE, ChartFrame, TOOLTIP_STYLE } from './ChartFrame'

export interface StackSeries {
  key: string
  label: string
  color: string
}

/** Stacked comparison, e.g. open vs overdue vs concluded per officer. */
export function StackedBarCard({
  data,
  series,
  title,
  description,
  height = 300,
  categoryKey = 'label',
  yAxisWidth = 150,
  className,
}: {
  data: Array<Record<string, string | number>>
  series: StackSeries[]
  title: string
  description?: string
  height?: number
  categoryKey?: string
  yAxisWidth?: number
  className?: string
}) {
  return (
    <ChartFrame title={title} description={description} height={height} isEmpty={data.length === 0} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 20, left: 4, bottom: 4 }} barCategoryGap="24%">
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F0" horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...AXIS_STYLE} />
          <YAxis type="category" dataKey={categoryKey} width={yAxisWidth} {...AXIS_STYLE} />
          <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,135,81,0.06)' }} />
          <Legend verticalAlign="top" align="right" iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, paddingBottom: 6 }} />
          {series.map((entry, index) => (
            <Bar
              key={entry.key}
              dataKey={entry.key}
              name={entry.label}
              stackId="a"
              fill={entry.color}
              maxBarSize={22}
              radius={index === series.length - 1 ? [0, 5, 5, 0] : undefined}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
