// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useRef, type ReactNode } from 'react'

const h = vi.hoisted(() => ({
  order: [] as string[],
  mapProps: [] as Record<string, unknown>[],
  // The persisted copy a mount reads first (null: none, so the network path
  // runs), and what that network fetch does. The first row keeps both defaults.
  persisted: { style: { version: 8, sources: {}, layers: [] } } as { style: unknown } | null,
  fetch: null as null | (() => Promise<unknown>),
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
  // The corner row (a map child in the D-38 rows below) reads the instance.
  useMap: () => ({ current: undefined }),
}))

vi.mock('../lib/persistedStyle', () => ({
  readPersistedStyle: async () => h.persisted,
  persistStyle: async () => {},
  revalidateStyleOnce: () => {},
}))

vi.mock('../lib/mapStyle', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/mapStyle')>()),
  fetchTunedBaseStyle: () => (h.fetch ? h.fetch() : Promise.reject(new Error('no fetch set'))),
}))

import { SnowMap } from './SnowMap'
import { MapCornerControls } from './map/MapCornerControls'
import { FsOpenRow } from './ui/FsOpenRow'
import { MapExitStandIn } from './ui/MapExitStandIn'
import { useMapFullscreen, MapFullscreenProvider, FS_OPEN_ATTR } from '../lib/useMapFullscreen'
import { installExactMatchMedia, PHONE_MEDIA_QUERY } from '../test/matchMedia'
import { isStandIn, theOneExit } from '../test/mapReadiness'

it('sets the emitted v6 worker URL before constructing a map and opts out of the new overscale default', async () => {
  render(<SnowMap />)
  await waitFor(() => expect(h.mapProps.length).toBeGreaterThan(0))

  expect(h.order[0]).toBe('worker:/assets/maplibre-gl-worker-test.js')
  expect(h.order.indexOf('worker:/assets/maplibre-gl-worker-test.js')).toBeLessThan(h.order.indexOf('map'))

  const firstProps = h.mapProps[0]
  expect(Object.hasOwn(firstProps, 'zoomLevelsToOverscale')).toBe(true)
  expect(firstProps.zoomLevelsToOverscale).toBeUndefined()
})

// ── Retry in an open panel (map-scroll-on-phones D-38, the security review's M-1)
//
// The REAL SnowMap, so the failed placeholder, its Retry and the loading line
// that replaces it are the shipped ones; the corner row is a real SnowMap
// child, and the host is in the shape every real one takes. Order matters in
// this file: SnowMap caches a fetched style at module scope, so the row that
// ends with the style arriving comes last.
describe('Retry inside an open panel keeps the keyboard focus (D-38)', () => {
  const STYLE = { version: 8, sources: {}, layers: [] }

  function PanelHost() {
    const ref = useRef<HTMLDivElement>(null)
    const fs = useMapFullscreen({ containerRef: ref, baseClass: 'sr-map-container' })
    return (
      <>
        <div ref={ref} className={fs.hostClassName}>
          <div className="sr-map-still-body" inert={fs.still}>
            <MapFullscreenProvider value={fs}>
              <MapExitStandIn compact={false}>
                <SnowMap style={{ height: '100%', width: '100%' }}>
                  <MapCornerControls compact={false} share={false} fsOnly={false} />
                </SnowMap>
              </MapExitStandIn>
            </MapFullscreenProvider>
          </div>
        </div>
        <FsOpenRow fs={fs} label="Open the map" note="It opens in fullscreen, where it pans and zooms." />
      </>
    )
  }

  it('control: with no stand-in (the page, the Map Explorer) Retry behaves as at HEAD and moves no focus', async () => {
    h.persisted = null
    h.fetch = () => Promise.reject(new Error('style host down'))
    render(<SnowMap />)
    const retry = await screen.findByRole('button', { name: 'Retry' })
    retry.focus()
    h.fetch = () => new Promise(() => {})                 // the retry stays pending
    fireEvent.click(retry)
    expect(screen.getByRole('status').textContent).toBe('Loading map…')
    expect(document.activeElement).toBe(document.body)
    cleanup()
  })

  it('a focused Retry hands the focus to the stand-in, and the map it brings takes it from there', async () => {
    const media = installExactMatchMedia({ [PHONE_MEDIA_QUERY]: true })
    try {
      h.persisted = null
      h.fetch = () => Promise.reject(new Error('style host down'))
      render(<PanelHost />)
      await screen.findByRole('alert')
      const opener = screen.getByRole('button', { name: 'Open the map' })
      opener.focus()
      fireEvent.click(opener)
      expect(document.documentElement.hasAttribute(FS_OPEN_ATTR)).toBe(true)
      expect(isStandIn(theOneExit())).toBe(true)

      const retry = screen.getByRole('button', { name: 'Retry' })
      retry.focus()
      let arrive: ((s: unknown) => void) | null = null
      h.fetch = () => new Promise(r => { arrive = r })
      fireEvent.click(retry)
      expect(screen.getByRole('status').textContent).toBe('Loading map…')
      expect(document.activeElement).toBe(theOneExit())
      expect(isStandIn(theOneExit())).toBe(true)

      // The retry's fetch starts after an awaited persisted-style read; wait for
      // the fetch itself, the observable the release below consumes.
      await waitFor(() => expect(arrive).not.toBeNull())
      await act(async () => { arrive!(STYLE) })
      await waitFor(() => expect(isStandIn(theOneExit())).toBe(false))
      expect(document.activeElement).toBe(theOneExit())
      fireEvent.click(theOneExit())
      expect(document.documentElement.hasAttribute(FS_OPEN_ATTR)).toBe(false)
      expect(document.activeElement).toBe(opener)
    } finally {
      media.restore()
      cleanup()
      document.documentElement.removeAttribute(FS_OPEN_ATTR)
    }
  })
})
