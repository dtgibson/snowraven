// The search-outcome sequence and copy (feature: search-this-area).
//
// The three reducer properties below are where the live region's discrimination
// actually lives. The component test cannot reject a missing sequence on its
// own: the message node unmounts between searches (each handler clears the
// outcome before its fetch, and a result also self-dismisses on a timer), so a
// remount is already a real DOM addition and an unkeyed child would pass a
// mutation count. This file is the half that rejects it.

import { describe, it, expect } from 'vitest'
import {
  searchOutcomeReducer, searchOutcomeMessage, searchAreaSearchedLabel,
  SEARCH_OUTCOME_NONE, SEARCH_OUTCOME_DISMISS_MS, SEARCH_AREA_LABEL, SEARCH_AREA_TEXT,
} from './searchOutcomeState'
import type { CenterViewMode } from './mapExplorerTypes'

describe('searchOutcomeReducer', () => {
  it('starts empty, as a result, at sequence 0', () => {
    expect(SEARCH_OUTCOME_NONE).toEqual({ text: '', kind: 'result', seq: 0 })
  })

  /**
   * PROPERTY 1, and the reason the reducer exists. `aria-live` announces on DOM
   * MUTATION and React bails out reconciling a text node to an identical string,
   * so two searches that both produce "3 hotspots found in this area." would
   * announce once if the region's text were the only thing that changed. The
   * advancing sequence is what makes the second one a real node replacement.
   */
  it('ALWAYS advances the sequence on a message, including an identical repeat', () => {
    let s = SEARCH_OUTCOME_NONE
    s = searchOutcomeReducer(s, '3 hotspots found in this area.')
    expect(s.seq).toBe(1)
    s = searchOutcomeReducer(s, '3 hotspots found in this area.')
    expect(s.seq).toBe(2)
    expect(s.text).toBe('3 hotspots found in this area.')
  })

  it('NEVER advances the sequence on a clear, so clearing cannot itself announce', () => {
    let s = searchOutcomeReducer(SEARCH_OUTCOME_NONE, 'a message')
    const before = s.seq
    s = searchOutcomeReducer(s, '')
    expect(s.text).toBe('')
    expect(s.seq).toBe(before)
  })

  it('returns the SAME object when clearing an already-clear state (a render bail-out)', () => {
    // Every search opens with setSearchOutcome(''), so without this each one
    // would cost a re-render for no state change.
    const s = searchOutcomeReducer(SEARCH_OUTCOME_NONE, '')
    expect(s).toBe(SEARCH_OUTCOME_NONE)
    const cleared = searchOutcomeReducer(searchOutcomeReducer(SEARCH_OUTCOME_NONE, 'x'), '')
    expect(searchOutcomeReducer(cleared, '')).toBe(cleared)
  })

  it('carries the failure kind, and a bare string is a result', () => {
    const ok = searchOutcomeReducer(SEARCH_OUTCOME_NONE, '1 hotspot found in this area.')
    expect(ok.kind).toBe('result')
    const bad = searchOutcomeReducer(ok, { text: 'Failed to fetch hotspots.', kind: 'error' })
    expect(bad.kind).toBe('error')
    expect(bad.text).toBe('Failed to fetch hotspots.')
    expect(bad.seq).toBe(ok.seq + 1)
    // ...and a failure repeated with the identical string still announces twice.
    const again = searchOutcomeReducer(bad, { text: 'Failed to fetch hotspots.', kind: 'error' })
    expect(again.seq).toBe(bad.seq + 1)
  })

  it('holds a result on screen for six seconds', () => {
    // The dimmed area is the durable answer; the count is a confirmation. A
    // failure is deliberately NOT on this timer (asserted in the component test).
    expect(SEARCH_OUTCOME_DISMISS_MS).toBe(6000)
  })
})

// ── The copy (FR-20 / FR-21, QA-22) ─────────────────────────────────────────

describe('searchOutcomeMessage', () => {
  const VIEWS: CenterViewMode[] = ['hotspots', 'targets', 'lifers']

  it.each<[CenterViewMode, number, string]>([
    ['hotspots', 0, 'No hotspots found in this area.'],
    ['hotspots', 1, '1 hotspot found in this area.'],
    ['hotspots', 2, '2 hotspots found in this area.'],
    ['hotspots', 47, '47 hotspots found in this area.'],
    ['targets', 0, 'No recent sightings of your target species found in this area.'],
    ['targets', 1, '1 recent sighting found in this area.'],
    ['targets', 2, '2 recent sightings found in this area.'],
    ['lifers', 0, 'No nearby lifers found in this area.'],
    ['lifers', 1, '1 location with nearby lifers found in this area.'],
    ['lifers', 6, '6 locations with nearby lifers found in this area.'],
  ])('%s at n=%i reads exactly the approved sentence', (view, n, expected) => {
    expect(searchOutcomeMessage(view, n)).toBe(expected)
  })

  /**
   * The `targets` zero-form is DELIBERATELY not the plural form's noun phrase.
   * "of your target species" is what distinguishes an empty result from a broken
   * search, which is the whole point of the empty-result requirement. Regularizing
   * it to "No recent sightings found in this area." must fail.
   */
  it('keeps the extra clause on the targets zero-form', () => {
    expect(searchOutcomeMessage('targets', 0)).toContain('of your target species')
    expect(searchOutcomeMessage('targets', 0)).not.toBe('No recent sightings found in this area.')
  })

  it('uses no em dash anywhere, per the repo-wide rule', () => {
    for (const view of VIEWS) {
      for (const n of [0, 1, 2, 99]) {
        expect(searchOutcomeMessage(view, n)).not.toContain('—')
      }
    }
  })

  it('is a complete sentence for every view and count, with no bare template hole', () => {
    for (const view of VIEWS) {
      for (const n of [0, 1, 2, 1000]) {
        const m = searchOutcomeMessage(view, n)
        expect(m.endsWith('.')).toBe(true)
        expect(m).toContain('in this area')
        expect(m).not.toContain('undefined')
        expect(m).not.toContain('${')
      }
    }
  })

  it('never says "0" where it should say "No"', () => {
    for (const view of VIEWS) expect(searchOutcomeMessage(view, 0).startsWith('No ')).toBe(true)
  })
})

// ── The control's names (FR-03, FR-24 / QA-04) ──────────────────────────────

describe('the control label and accessible names', () => {
  const VIEWS: CenterViewMode[] = ['hotspots', 'targets', 'lifers']

  it('is the same visible text on all three views', () => {
    expect(SEARCH_AREA_TEXT).toBe('Search this area')
  })

  it('names the search that will run, per view', () => {
    expect(SEARCH_AREA_LABEL).toEqual({
      hotspots: 'Search this area for hotspots',
      targets: 'Search this area for recent sightings',
      lifers: 'Search this area for nearby lifers',
    })
  })

  it('contains the visible text VERBATIM in every name (WCAG 2.5.3)', () => {
    // Label in Name: a Voice Control user says what is on the button.
    for (const view of VIEWS) {
      expect(SEARCH_AREA_LABEL[view]).toContain(SEARCH_AREA_TEXT)
      expect(searchAreaSearchedLabel(view)).toContain(SEARCH_AREA_TEXT)
    }
  })

  it('states the already-searched condition, and all six names stay pairwise distinct', () => {
    for (const view of VIEWS) {
      expect(searchAreaSearchedLabel(view))
        .toBe(`${SEARCH_AREA_LABEL[view]}. This area has already been searched.`)
    }
    const all = [...VIEWS.map(v => SEARCH_AREA_LABEL[v]), ...VIEWS.map(searchAreaSearchedLabel)]
    expect(new Set(all).size).toBe(all.length)
  })

  it('is distinct from every shipped map-control name in scope (FR-03)', () => {
    const shipped = [
      'Center the map on my location', 'Finding your location',
      'Copy the search center location', 'Close the location popup',
      'Set a search center to copy its location', 'Drop a pin at the map center',
      'Move the pin to the map center', 'Enter fullscreen', 'Exit fullscreen',
      'Open map filters',
    ]
    const all = [...shipped, ...VIEWS.map(v => SEARCH_AREA_LABEL[v]), ...VIEWS.map(searchAreaSearchedLabel)]
    expect(new Set(all).size).toBe(all.length)
  })

  it('uses no em dash', () => {
    for (const view of VIEWS) {
      expect(SEARCH_AREA_LABEL[view]).not.toContain('—')
      expect(searchAreaSearchedLabel(view)).not.toContain('—')
    }
    expect(SEARCH_AREA_TEXT).not.toContain('—')
  })
})
