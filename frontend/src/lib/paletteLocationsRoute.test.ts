// The App-level route from a Search location row into Hotspot Reports
// (visited-hotspots-in-search FR-26 to FR-29, QA-26 to QA-28; schema 5.1).
//
// No suite in this repo renders App.tsx (paletteSpeciesLoad.test.ts records
// why), so these rows hold the route's SHAPE to the shipped species route it
// copies, which is what makes FR-28's "the same state the species route
// produces" a property of the code: the two callbacks are the same sequence of
// state changes with the other tab. The behaviour itself (from another tab, from
// the tab, with the tab never opened, with it hidden, from a fullscreen Map
// Explorer) is measured in the built app in Chromium and WebKit (decisions.md).

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const APP = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8')
const CODE = APP.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

function callback(name: string): string {
  const start = CODE.indexOf(`const ${name} = useCallback(`)
  expect(start, `App.tsx defines ${name}`).toBeGreaterThan(-1)
  const end = CODE.indexOf('])', start)
  return CODE.slice(start, end + 2)
}

describe('the location route copies the species route (FR-28)', () => {
  it('openLocationFromPalette is openSpeciesFromPalette with the other tab, line for line', () => {
    const species = callback('openSpeciesFromPalette')
      .replace('openSpeciesFromPalette', 'X').replace(/navigateToSpeciesDetail/g, 'NAV').replace(/\bname\b/g, 'ARG')
    const location = callback('openLocationFromPalette')
      .replace('openLocationFromPalette', 'X').replace(/navigateToHotspotReport/g, 'NAV').replace(/\blocationId\b/g, 'ARG')
    expect(location.replace(/: string/g, '')).toBe(species.replace(/: string/g, ''))
    expect(location).toContain('setMapFullscreen(false)')
  })

  it('navigateToHotspotReport is navigateToSpeciesDetail with the other tab and the other request', () => {
    const species = callback('navigateToSpeciesDetail')
      .replace('navigateToSpeciesDetail', 'X').replace("'species-detail'", 'TAB').replace('setRequestedSpecies', 'REQ').replace(/\bcommonName\b/g, 'ARG')
    const location = callback('navigateToHotspotReport')
      .replace('navigateToHotspotReport', 'X').replace("'hotspot-reports'", 'TAB').replace('setRequestedLocation', 'REQ').replace(/\blocationId\b/g, 'ARG')
    expect(location).toBe(species)
  })

  it('the overlay is handed the route, and the tab the request and its clear', () => {
    expect(CODE).toMatch(/onOpenLocation=\{openLocationFromPalette\}/)
    expect(CODE).toMatch(/requestedLocationId=\{requestedLocation\}/)
    expect(CODE).toMatch(/onRequestedLocationConsumed=\{clearRequestedLocation\}/)
    expect(callback('clearRequestedLocation')).toContain('setRequestedLocation(undefined)')
  })

  it('every embedded-map host\'s panel tells its maps whether its tab is showing (QA-28, E-09)', () => {
    // The route above collapses the Map Explorer's fullscreen; an EXPANDED
    // EMBEDDED map is released by the tab-showing input instead, which App must
    // provide around each host keyed to that host's own tab.
    for (const [tab, host] of [['species-detail', 'SpeciesDetail'], ['birding-stats', 'BirdingStats'], ['named-birds', 'NamedBirds']]) {
      const wrapped = new RegExp(String.raw`<MapTabShowingProvider value=\{activeTab === '${tab}'\}>\s*(?:<Suspense fallback=\{[^}]*\}>\s*)?<${host}\b`)
      expect(wrapped.test(CODE), `${host} is wrapped for '${tab}'`).toBe(true)
    }
  })

  it('and the hosts are the complete set: every caller of useMapFullscreen is one of them', () => {
    // NamedBirdRow renders inside NamedBirds and inside SpeciesDetail, both wrapped.
    // A fourth caller turns this red until its tab is wrapped too.
    const dir = new URL('../components/', import.meta.url)
    const callers = readdirSync(dir, { recursive: true, withFileTypes: true })
      .filter(d => d.isFile() && /\.tsx$/.test(d.name) && !/\.test\.tsx$/.test(d.name))
      .filter(d => readFileSync(join(d.parentPath, d.name), 'utf8').includes('useMapFullscreen({'))
      .map(d => d.name)
      .sort()
    expect(callers).toEqual(['BirdingStats.tsx', 'NamedBirdRow.tsx', 'SpeciesDetail.tsx'])
  })

  it('GUARD THE GUARD: a route that forgot the fullscreen collapse would not equal the species route', () => {
    const species = callback('openSpeciesFromPalette')
    expect(species.replace('setMapFullscreen(false)\n', '')).not.toBe(species)
  })
})
