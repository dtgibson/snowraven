// feature: map-location-buttons — the announcement-sequence semantics the
// on-map live region's keyed child rides on (FR-14, QA-19).
//
// WHY THIS TEST EXISTS AS A SEPARATE, PURE TEST — the honest version.
//
// The Architect warned that a naive "press the button twice, count mutations"
// component test passes even WITHOUT the key, because handleUseMyLocation's
// leading setGeoError('') commits before the await resolves, so the message node
// genuinely unmounts and remounts between two failures. That warning was
// confirmed empirically during this build: the key was removed from
// MapExplorer's region and the two-press component test still passed.
//
// It is stronger than the warning suggests. In the SHIPPED component the clear
// always precedes the set, so there is no press sequence at all that lands two
// identical messages with no intervening clear — which means the DOM-level
// difference the key makes is not reachable through the component's own
// controls today. The key is still required (FR-14) and still correct: it is
// what keeps the region announcing if that leading clear is ever removed, or a
// second setGeoError call site is ever added.
//
// So the discrimination lives here, at the level where it is real: the sequence
// must advance on an identical repeat with no clear between. An implementation
// that only advanced on a CHANGED message, or that reused the previous
// sequence, fails this file and passes every component test.
//
// MapExplorerLocateFab.test.tsx covers the other half — that the region is
// mounted from first render, that the message node IS replaced across two
// presses, and that the region's textContent is exactly the message with no
// marker character appended to force a diff.

import { describe, it, expect } from 'vitest'
import { geoErrorReducer, GEO_ERROR_NONE } from './geoErrorState'

const MSG = 'Location request timed out. Try again or enter coordinates manually.'
const OTHER = 'Location requires HTTPS. Enter coordinates manually or access the app via localhost.'

describe('geoErrorReducer', () => {
  it('advances the sequence on an IDENTICAL repeat with no clear between (QA-19)', () => {
    const a = geoErrorReducer(GEO_ERROR_NONE, MSG)
    const b = geoErrorReducer(a, MSG)
    expect(a.text).toBe(MSG)
    expect(b.text).toBe(MSG)
    // The whole point: same string, different key, so the region's child is a
    // real node replacement and the message is announced twice.
    expect(b.seq).toBe(a.seq + 1)
    // An implementation that keyed on the TEXT rather than a sequence would
    // produce the same key here. Stated as the rejected alternative so the
    // assertion above is not read as arithmetic for its own sake.
    expect(b.seq).not.toBe(a.seq)
  })

  it('advances on a changed message too', () => {
    const a = geoErrorReducer(GEO_ERROR_NONE, MSG)
    const b = geoErrorReducer(a, OTHER)
    expect(b).toEqual({ text: OTHER, seq: a.seq + 1 })
  })

  it('never advances the sequence on a clear, so clearing cannot announce', () => {
    const a = geoErrorReducer(GEO_ERROR_NONE, MSG)
    const cleared = geoErrorReducer(a, '')
    expect(cleared).toEqual({ text: '', seq: a.seq })
    // ...and the next message still advances past it, so a clear cannot make two
    // successive messages collide on one key.
    expect(geoErrorReducer(cleared, MSG).seq).toBe(a.seq + 1)
  })

  it('returns the SAME object when clearing an already-clear state', () => {
    // The leading setGeoError('') of every press hits this path. Returning a new
    // object would re-render the whole Map Explorer on every press for nothing.
    expect(geoErrorReducer(GEO_ERROR_NONE, '')).toBe(GEO_ERROR_NONE)
    const cleared = geoErrorReducer(geoErrorReducer(GEO_ERROR_NONE, MSG), '')
    expect(geoErrorReducer(cleared, '')).toBe(cleared)
  })

  it('starts clear', () => {
    expect(GEO_ERROR_NONE).toEqual({ text: '', seq: 0 })
  })
})
