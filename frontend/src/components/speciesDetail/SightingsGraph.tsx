import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import type { GraphPoint, GraphInterval } from '../../lib/sightingsGraph'
import { formatPeriodLabel } from '../../lib/sightingsGraph'
import { SectionCard, SectionHead } from './ui'

function GraphTooltip({ active, payload, label, interval }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
  interval: GraphInterval
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--sr-surface)', border: '1px solid var(--sr-border)',
      borderRadius: 8, padding: '9px 12px', fontSize: '0.75rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.1)', minWidth: 130,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--sr-text)' }}>
        {formatPeriodLabel(label ?? '', interval)}
      </div>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 3, alignItems: 'center' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--sr-text-muted)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.color, flexShrink: 0, display: 'inline-block' }} />
            {p.name}
          </span>
          <span style={{ fontWeight: 600, color: 'var(--sr-text)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export function SightingsGraph({ data, interval, viewMode, hasML }: {
  data: GraphPoint[]
  interval: GraphInterval
  viewMode: 'per-period' | 'cumulative'
  hasML: boolean
}) {
  const displayData = useMemo(() => {
    if (viewMode === 'per-period') return data
    let ci = 0, cc = 0, cp = 0, ca = 0, cv = 0
    return data.map(p => {
      ci += p.individuals; cc += p.checklists; cp += p.photo; ca += p.audio; cv += p.video
      return { key: p.key, individuals: ci, checklists: cc, photo: cp, audio: ca, video: cv }
    })
  }, [data, viewMode])

  if (data.length < 2) return null

  const hasAnyMedia = hasML && data.some(p => p.photo > 0 || p.audio > 0 || p.video > 0)
  const periodLabel = interval === 'weekly' ? 'week' : interval === 'monthly' ? 'month' : 'year'
  const sightingsAxisLabel = viewMode === 'per-period'
    ? `Individuals per ${periodLabel}`
    : 'Cumulative individuals'
  const checklistsAxisLabel = viewMode === 'per-period'
    ? `Checklists per ${periodLabel}`
    : 'Cumulative checklists'
  const mediaAxisLabel = viewMode === 'per-period'
    ? `Items per ${periodLabel}`
    : 'Cumulative items'

  const xAxisProps = {
    dataKey: 'key' as const,
    tickFormatter: (k: string) => formatPeriodLabel(k, interval),
    tick: { fontSize: '0.6875rem', fill: 'var(--sr-text-muted)', fontFamily: 'inherit' },
    tickLine: false as const,
    axisLine: false as const,
    interval: 'preserveStartEnd' as const,
  }
  const yAxisProps = {
    tick: { fontSize: '0.6875rem', fill: 'var(--sr-text-muted)', fontFamily: 'inherit' },
    tickLine: false as const,
    axisLine: false as const,
    allowDecimals: false as const,
  }

  return (
    <>
      <SectionCard>
        <SectionHead icon={<TrendingUp size={14} strokeWidth={2.2} />} title="Sightings Over Time" />
        <div style={{ padding: '14px 18px 0' }} role="img" aria-label={`Sightings over time line chart. ${sightingsAxisLabel}`}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', letterSpacing: '0.01em' }}>{sightingsAxisLabel}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={displayData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sr-border-subtle)" vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <RechartsTooltip
                content={<GraphTooltip interval={interval} />}
                cursor={{ stroke: 'var(--sr-border)', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Line
                type="monotone" dataKey="individuals" name="Individuals"
                stroke="var(--sr-graph-individuals)" strokeWidth={2.5}
                dot={{ r: 3, fill: 'var(--sr-graph-individuals)', stroke: 'white', strokeWidth: 1.5 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      <SectionCard>
        <SectionHead icon={<TrendingUp size={14} strokeWidth={2.2} />} title="Checklists Over Time" />
        <div style={{ padding: '14px 18px 0' }} role="img" aria-label={`Checklists over time line chart. ${checklistsAxisLabel}`}>
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', letterSpacing: '0.01em' }}>{checklistsAxisLabel}</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={displayData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--sr-border-subtle)" vertical={false} />
              <XAxis {...xAxisProps} />
              <YAxis {...yAxisProps} />
              <RechartsTooltip
                content={<GraphTooltip interval={interval} />}
                cursor={{ stroke: 'var(--sr-border)', strokeWidth: 1, strokeDasharray: '3 3' }}
              />
              <Line
                type="monotone" dataKey="checklists" name="Checklists"
                stroke="var(--sr-graph-individuals)" strokeWidth={2.5} opacity={0.6}
                dot={{ r: 3, fill: 'var(--sr-graph-individuals)', stroke: 'white', strokeWidth: 1.5 }}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      {hasAnyMedia && (
        <SectionCard>
          <SectionHead icon={<TrendingUp size={14} strokeWidth={2.2} />} title="Media Over Time" />
          <div style={{ padding: '14px 18px 0' }} role="img" aria-label={`Media over time line chart — photo, audio, and video. ${mediaAxisLabel}`}>
            <div style={{ marginBottom: 12 }}>
              <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', letterSpacing: '0.01em' }}>{mediaAxisLabel}</span>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={displayData} margin={{ top: 4, right: 8, left: -16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--sr-border-subtle)" vertical={false} />
                <XAxis {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <RechartsTooltip
                  content={<GraphTooltip interval={interval} />}
                  cursor={{ stroke: 'var(--sr-border)', strokeWidth: 1, strokeDasharray: '3 3' }}
                />
                <Legend
                  iconSize={9}
                  wrapperStyle={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', paddingTop: 8 }}
                />
                {/* Series differ by dash pattern + legend icon shape, not hue
                    alone (color-blind safe — F071). */}
                <Line
                  type="monotone" dataKey="photo" name="Photo" legendType="circle"
                  stroke="var(--sr-graph-photo)" strokeWidth={1.8} opacity={0.85}
                  dot={{ r: 2.5, fill: 'var(--sr-graph-photo)', stroke: 'white', strokeWidth: 1.5 }}
                  activeDot={{ r: 3.5 }}
                />
                <Line
                  type="monotone" dataKey="audio" name="Audio" legendType="triangle"
                  stroke="var(--sr-graph-audio)" strokeWidth={1.8} opacity={0.85}
                  strokeDasharray="6 3"
                  dot={{ r: 2.5, fill: 'var(--sr-graph-audio)', stroke: 'white', strokeWidth: 1.5 }}
                  activeDot={{ r: 3.5 }}
                />
                <Line
                  type="monotone" dataKey="video" name="Video" legendType="rect"
                  stroke="var(--sr-graph-video)" strokeWidth={1.8} opacity={0.85}
                  strokeDasharray="2 3"
                  dot={{ r: 2.5, fill: 'var(--sr-graph-video)', stroke: 'white', strokeWidth: 1.5 }}
                  activeDot={{ r: 3.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}
    </>
  )
}
