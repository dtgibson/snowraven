// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { GraphPoint } from '../../lib/sightingsGraph'

// Capture every <Line> element's props so the color-blind-safe series cues
// (distinct dash patterns + legend icon shapes — F071) can be asserted without
// depending on recharts' layout, which doesn't compute a width in jsdom. The
// real recharts is otherwise stubbed to inert passthrough wrappers, so this file
// mounts no actual chart (no autoBatch-timer wait-out needed).
const lineProps: Array<Record<string, unknown>> = []
vi.mock('recharts', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>
  return {
    ResponsiveContainer: Passthrough,
    LineChart: Passthrough,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    Legend: () => null,
    Line: (props: Record<string, unknown>) => { lineProps.push(props); return null },
  }
})

import { SightingsGraph } from './SightingsGraph'

beforeEach(() => { lineProps.length = 0 })
afterEach(cleanup)

const withMedia: GraphPoint[] = [
  { key: '2024-01', individuals: 3, checklists: 2, photo: 2, audio: 1, video: 0 },
  { key: '2024-02', individuals: 5, checklists: 3, photo: 1, audio: 0, video: 2 },
  { key: '2024-03', individuals: 4, checklists: 2, photo: 3, audio: 2, video: 1 },
]

describe('SightingsGraph', () => {
  it('renders nothing with fewer than two points', () => {
    const { container } = render(
      <SightingsGraph data={[withMedia[0]]} interval="monthly" viewMode="per-period" hasML />
    )
    expect(container.firstChild).toBeNull()
  })

  it('labels each chart with role=img for assistive tech', () => {
    const { getAllByRole } = render(
      <SightingsGraph data={withMedia} interval="monthly" viewMode="per-period" hasML />
    )
    const labels = getAllByRole('img').map(el => el.getAttribute('aria-label'))
    expect(labels.some(l => l?.startsWith('Sightings over time line chart'))).toBe(true)
    expect(labels.some(l => l?.startsWith('Checklists over time line chart'))).toBe(true)
    expect(labels.some(l => l?.includes('photo, audio, and video'))).toBe(true)
  })

  it('distinguishes the media series by dash pattern + legend shape, not hue alone (F071)', () => {
    render(<SightingsGraph data={withMedia} interval="monthly" viewMode="per-period" hasML />)
    const byName = (n: string) => lineProps.find(p => p.name === n)
    const photo = byName('Photo')!
    const audio = byName('Audio')!
    const video = byName('Video')!
    expect(photo).toBeTruthy(); expect(audio).toBeTruthy(); expect(video).toBeTruthy()
    // Photo stays solid; audio and video carry distinct, non-empty dash patterns.
    expect(photo.strokeDasharray).toBeUndefined()
    expect(audio.strokeDasharray).toBe('6 3')
    expect(video.strokeDasharray).toBe('2 3')
    // Legend icons also differ by shape so the legend isn't hue-only.
    const shapes = [photo.legendType, audio.legendType, video.legendType]
    expect(new Set(shapes).size).toBe(3)
  })

  it('hides the media chart when there is no media data', () => {
    const noMedia: GraphPoint[] = withMedia.map(p => ({ ...p, photo: 0, audio: 0, video: 0 }))
    const { queryAllByRole } = render(
      <SightingsGraph data={noMedia} interval="monthly" viewMode="per-period" hasML />
    )
    const labels = queryAllByRole('img').map(el => el.getAttribute('aria-label'))
    expect(labels.some(l => l?.includes('photo, audio, and video'))).toBe(false)
  })
})
