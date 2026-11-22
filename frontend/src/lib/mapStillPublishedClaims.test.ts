/// <reference types="node" />
//
// map-scroll-on-phones: the sentences this build added to ACCESSIBILITY.md and
// docs/HELP.md, held to the code that makes them true (docs-and-website.md: a
// published statement is only as true as the test that reads it).
//
// Shape copied from palettePublishedClaims.test.ts: each file's own passage is
// extracted rather than the whole document scanned; each row asserts the claim
// EXISTS before checking it is right, so deleting the sentence goes red; the
// visible words are built FROM the copy constants rather than re-spelled.
//
// What this does not prove: the behaviour itself. The focus round trip, the bar
// attribute and the still are exercised in lib/useMapFullscreen.test.tsx, the
// stylesheet's resolved values in lib/mapFullscreenPanelCss.test.ts, and the
// real engines by the Tester.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EXIT_WORD, OPEN_MAP_LABEL } from './mapStillCopy'
import { FS_OPEN_ATTR } from './useMapFullscreen'

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8')
const A11Y = read('ACCESSIBILITY.md')
const HELP = read('docs/HELP.md')
const CSS = read('frontend/src/globals.css')

/** The paragraph that contains `needle`, or '' (so a deletion fails the row). */
function paragraphWith(doc: string, needle: string): string {
  return doc.split(/\n\s*\n/).find(p => p.includes(needle)) ?? ''
}

describe('ACCESSIBILITY.md: the phone-tier still and its keyboard route', () => {
  const para = paragraphWith(A11Y, 'is not interactive until it is opened in fullscreen')

  it('says so (non-vacuity), in the focus paragraph', () => {
    expect(para.startsWith('Where focus matters')).toBe(true)
  })

  it('names the opener and the exit by the words the app draws', () => {
    expect(para).toContain(`the ${OPEN_MAP_LABEL} button under it is the keyboard and screen-reader route`)
    expect(para).toContain(`focus moves to ${EXIT_WORD} when the map opens and returns to the button when it closes`)
  })

  it('scopes the corner toggle to screens wider than a phone, and names the two phone-only hosts', () => {
    expect(para).toContain("On screens wider than a phone that button sits in the map's corner.")
    expect(para).toContain("the Weather tab's Plan location picker and the map in a Hotspot Reports report, which open in fullscreen on a phone only")
    // ...and those two really are hooks' hosts with an Exit-only row.
    for (const f of ['frontend/src/components/PredictMap.tsx', 'frontend/src/components/hotspotReports/HotspotReportMap.tsx']) {
      expect(read(f), f).toContain('<MapCornerControls compact={false} share={false} fsOnly />')
    }
  })

  it('every host that renders the opener renders it with the label the sentence quotes', () => {
    for (const f of [
      'frontend/src/components/SpeciesDetail.tsx', 'frontend/src/components/BirdingStats.tsx',
      'frontend/src/components/NamedBirdRow.tsx', 'frontend/src/components/WeatherForecastPanel.tsx',
      'frontend/src/components/hotspotReports/HotspotReport.tsx', 'frontend/src/components/MapExplorer.tsx',
    ]) {
      expect(read(f), f).toMatch(/<FsOpenRow fs=\{\w+\} label=\{OPEN_MAP_LABEL\}/)
    }
    expect(OPEN_MAP_LABEL).toBe('Open the map')
    expect(EXIT_WORD).toBe('Exit')
  })
})

describe('docs/HELP.md: Maps on a phone', () => {
  const para = paragraphWith(HELP, '**Maps on a phone.**')

  it('is there (non-vacuity), with the words the app draws', () => {
    expect(para.startsWith('**Maps on a phone.**')).toBe(true)
    expect(para).toContain(`Press the map, or **${OPEN_MAP_LABEL}**, to use it in fullscreen, where it pans and zooms.`)
    expect(para).toContain(`**${EXIT_WORD}**, at the bottom right, brings you back`)
  })

  it('"the tab bar is hidden while a map is open" is the stylesheet rule keyed on the hook\'s attribute', () => {
    expect(para).toContain('The tab bar at the bottom is hidden while a map is open.')
    const stripped = CSS.replace(/\/\*[\s\S]*?\*\//g, '')
    // The rule also carries `transition-property: none` since QA round 1 (F-2);
    // the claim is about the hide, so the row reads that declaration alone.
    expect(stripped).toMatch(new RegExp(String.raw`:root\[${FS_OPEN_ATTR}\] \.sr-navbar \{[^}]*\bvisibility: hidden;[^}]*\}`))
  })

  it('the Weather, Hotspot Reports and Map Explorer passages carry their phone sentences', () => {
    expect(HELP).toContain('On a phone, open the map to drop the pin. The place search and the coordinate fields work without opening it.')
    expect(HELP).toContain('On a phone the map opens in fullscreen like the other maps. On larger screens it has no fullscreen button.')
    expect(HELP).toContain(`On a phone, where the window is too short to hold the whole map, the map is shown as a still with **${OPEN_MAP_LABEL}** under it, which opens it in fullscreen.`)
  })
})
