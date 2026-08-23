import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_STYLE, ChartFrame, TOOLTIP_STYLE } from './ChartFrame'

export interface BarDatum {
  label: string
  value: number
  color?: string
}

export interface BarChartCardProps {
  data: BarDatum[]
  title: string
  description?: string
  height?: number
  layout?: 'horizontal' | 'vertical'
  color?: string
  valueLabel?: string
  className?: string
  showValues?: boolean
  yAxisWidth?: number
}

/**
 * General-purpose bar chart used for aging buckets, departmental volumes,
 * officer workload and report previews. `layout="vertical"` puts the category
 * labels on the left, which is what long department names need.
 */
export function BarChartCard({
  data,
  title,
  description,
  height = 280,
  layout = 'horizontal',
  color = '#008751',
  valueLabel = 'Cases',
  className,
  showValues,
  yAxisWidth = 150,
}: BarChartCardProps) {
  const isVertical = layout === 'vertical'

  return (
    <ChartFrame title={title} description={description} height={height} isEmpty={data.length === 0} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={layout}
          margin={isVertical ? { top: 4, right: 28, left: 4, bottom: 4 } : { top: 12, right: 16, left: -14, bottom: 0 }}
          barCategoryGap={isVertical ? '22%' : '32%'}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F0" horizontal={!isVertical} vertical={isVertical} />
          {isVertical ? (
            <>
              <XAxis type="number" allowDecimals={false} {...AXIS_STYLE} />
              <YAxis type="category" dataKey="label" width={yAxisWidth} {...AXIS_STYLE} />
            </>
          ) : (
            <>
              <XAxis type="category" dataKey="label" interval={0} {...AXIS_STYLE} />
              <YAxis type="number" allowDecimals={false} width={44} {...AXIS_STYLE} />
            </>
          )}
          <Tooltip {...TOOLTIP_STYLE} cursor={{ fill: 'rgba(0,135,81,0.06)' }} />
          <Bar dataKey="value" name={valueLabel} radius={isVertical ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={isVertical ? 20 : 46}>
            {data.map((datum, index) => (
              <Cell key={`${datum.label}-${index}`} fill={datum.color ?? color} />
            ))}
            {showValues ? (
              <LabelList
                dataKey="value"
                position={isVertical ? 'right' : 'top'}
                style={{ fontSize: 11, fill: '#4C5C58', fontWeight: 600 }}
              />
            ) : null}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartFrame>
  )
}
