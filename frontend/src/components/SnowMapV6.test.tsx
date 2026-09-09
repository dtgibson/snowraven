// @vitest-environment jsdom

import { expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

const h = vi.hoisted(() => ({
  order: [] as string[],
  mapProps: [] as Record<string, unknown>[],
}))

vi.mock('maplibre-gl', () => ({
  setWorkerUrl: (url: string) => { h.order.push(`worker:${url}`) },
}))

vi.mock('maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url', () => ({
  default: '/assets/maplibre-gl-worker-test.js',
}))

vi.mock('react-map-gl/maplibre', () => ({
  default: (props: Record<string, unknown>) => {
    h.order.push('map')
    h.mapProps.push(props)
    return <>{props.children as ReactNode}</>
  },
  NavigationControl: () => null,
  AttributionControl: () => null,
  Source: ({ children }: { children?: ReactNode }) => <>{children}</>,
  Layer: () => null,
}))

vi.mock('../lib/persistedStyle', () => ({
  readPersistedStyle: async () => ({ style: { version: 8, sources: {}, layers: [] } }),
  persistStyle: async () => {},
  revalidateStyleOnce: () => {},
}))

import { SnowMap } from './SnowMap'

it('sets the emitted v6 worker URL before constructing a map and opts out of the new overscale default', async () => {
  render(<SnowMap />)
  await waitFor(() => expect(h.mapProps.length).toBeGreaterThan(0))

  expect(h.order[0]).toBe('worker:/assets/maplibre-gl-worker-test.js')
  expect(h.order.indexOf('worker:/assets/maplibre-gl-worker-test.js')).toBeLessThan(h.order.indexOf('map'))

  const firstProps = h.mapProps[0]
  expect(Object.hasOwn(firstProps, 'zoomLevelsToOverscale')).toBe(true)
  expect(firstProps.zoomLevelsToOverscale).toBeUndefined()
})
