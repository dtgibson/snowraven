// @vitest-environment jsdom
//
// fix: count-cluster-scroll-leak — the right-hand count-and-view cluster on the
// Multimedia tab (LifeList) and the Breeding Codes tab (BreedingCodeList) must
// be able to WRAP inside its row's content box, instead of holding its
// max-content width and pushing page horizontal scroll at 320px / 200% text
// scale.
//
// WHAT THIS TEST PROVES: that all three ingredients of the fix are present on
// the cluster ELEMENT that actually renders, and specifically that they are
// present TOGETHER. The Evaluator's measurements showed each one is worthless
// alone:
//   1. `.sr-wrap-flex` is on the element (Multimedia had no class at all).
//   2. No inline `display` / `flex-wrap` on that element. Those are specificity
//      (1,0,0) and beat the class outright, so with them present the class
//      cannot bind and adding it is decoration.
//   3. Given an inline `flexShrink: 0`, a width cap is also present. This is the
//      one Breeding Codes shipped without: it carried the class since v0.5.81
//      and computed `flex-wrap: wrap`, yet measured 475px wide in a 296px box
//      (179px past a 320 viewport), because flexShrink: 0 pinned it at
//      max-content on its own wrapped line, so nothing ever narrowed it and a
//      flex container that is never narrowed has no reason to break a line.
//      A class-only "fix" measured 71px → 71px: literally zero change.
// Assertion 3 is what makes this test fail on the broken build rather than pass
// the way a stylesheet assertion would have (`.sr-wrap-flex` was present, real,
// and top-level in globals.css the whole time Breeding Codes was the single
// largest overflower on any tab).
//
// WHAT IT CANNOT PROVE (and is NOT evidence for): that the cluster actually
// FITS. jsdom has no layout engine, no media queries, no font metrics, and does
// not resolve the cascade against React inline styles, so it cannot show that
// the cluster's width is ≤ its row's content box, that document.scrollWidth
// equals the viewport, or that the other 39 cells of the width × text-scale
// matrix stayed byte-identical. Per CLAUDE.md that proof is a browser
// measurement, and it is dataset-dependent in a way that would let a careless
// browser test pass on a broken build too: on the demo dataset the unfiltered
// Multimedia case overflows by 0.23px, which rounds to a passing integer
// scrollWidth of 320 while the cluster is 24px wider than its box. The
// Playwright run for this fix therefore measures the cluster's own width
// against its row's content box on both revisions, at 320px / 200% scale, on
// both tabs, plus a filter-applied case; it is written up in
// pipeline/count-cluster-scroll-leak/pr-description.md. This file is the cheap
// structural half that keeps the pairing from silently regressing.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { LifeList } from './LifeList'
import { BreedingCodeList } from './BreedingCodeList'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ML_CSV =
  'Catalog Number,Common Name,Scientific Name,Format,Date,Location,County,Latitude,Longitude\n' +
  '111,American Robin,Turdus migratorius,Photo,2024-05-01,Tilden Park,Alameda,37.9,-122.24\n' +
  '222,Song Sparrow,Melospiza melodia,Audio,2024-05-02,Tilden Park,Alameda,37.9,-122.24\n'

const EBIRD_HEADER = 'Common Name,Scientific Name,County,Date,Breeding Code\n'
const OBSERVATIONS = [
  { commonName: 'American Robin', scientificName: 'Turdus migratorius', date: '2024-05-01', county: 'Alameda', breedingCode: 'NB' },
  { commonName: 'Song Sparrow', scientificName: 'Melospiza melodia', date: '2024-05-02', county: 'Alameda', breedingCode: 'FL' },
]

// ── Seams: the three both tabs autoload through ──────────────────────────────

vi.mock('../lib/storage', () => ({
  storage: {
    getFilesStatus: vi.fn(async () => ({
      ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2024-05-03' },
      ml: { filename: 'ML_12345_photo.csv', uploadedAt: '2024-05-03' },
    })),
    readFile: vi.fn(async () => ML_CSV),
  },
}))

vi.mock('../lib/observationsCache', () => ({
  loadEbirdObservations: vi.fn(async () => ({ text: EBIRD_HEADER, observations: OBSERVATIONS })),
}))

vi.mock('../lib/transport', () => ({
  transport: { post: vi.fn(async () => ({ codes: {}, orders: {}, formCodes: {}, results: [] })) },
}))

afterEach(cleanup)
beforeEach(() => { vi.clearAllMocks() })

// ── The load-bearing assertion ───────────────────────────────────────────────

/**
 * Resolve the count-and-view cluster from the count span, then assert the three
 * ingredients hold together on that element.
 *
 * Resolution is deliberately anchored on the live-region count span and then
 * guarded (tag, and that the view button is inside the same element), rather
 * than trusting a DOM path — the path differs between the two components and a
 * silently-wrong node would make every assertion below vacuous.
 */
function expectClusterCanWrap(countSpan: HTMLElement) {
  const cluster = countSpan.parentElement as HTMLElement
  expect(cluster).toBeTruthy()
  expect(cluster.tagName.toLowerCase()).toBe('div')
  // Guard the resolved node: the view toggle must live in the SAME element, or
  // we resolved the wrong parent and are asserting about something else.
  expect(cluster.querySelector('button')).toBeTruthy()
  expect(cluster.textContent).toMatch(/↔/)

  // 1. The class is on the element.
  expect(cluster.classList.contains('sr-wrap-flex')).toBe(true)

  // 2. Nothing inline out-ranks it. An inline display/flex-wrap is (1,0,0) and
  //    beats the class, which is why CLAUDE.md's rule is to LIFT them out
  //    rather than add the class alongside them.
  expect(cluster.style.display).toBe('')
  expect(cluster.style.flexWrap).toBe('')

  // 3. The class is not inert. flexShrink: 0 without a width cap holds the
  //    cluster at max-content forever, so the wrap never engages — the exact
  //    state Breeding Codes shipped in. Either the pin is gone or the cap is
  //    present; the Evaluator measured both variants as identical in effect
  //    (cluster 272px, leak 0). Today's shipped choice is the cap, which is the
  //    more conservative of the two: it preserves the do-not-get-squeezed
  //    intent rather than discarding it.
  const pinned = cluster.style.flexShrink === '0'
  const capped = cluster.style.maxWidth === '100%'
  expect(pinned && !capped).toBe(false)
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('count-cluster-scroll-leak — the cluster can wrap inside its row', () => {
  it('Multimedia (LifeList): unfiltered, where the leak rounds away on demo data', async () => {
    render(
      <LifeList
        onGoToSettings={vi.fn()}
        requestedFilter={undefined}
        onRequestedFilterConsumed={vi.fn()}
        filesVersion={0}
        onOpenSpecies={vi.fn()}
      />,
    )
    // The `N species` form: this is the case whose 0.23px overflow rounds to a
    // passing integer scrollWidth in the browser, so the structural guard here
    // is the only cheap thing that sees it at all.
    const count = await screen.findByText(/\d+ species$/)
    expect(count.getAttribute('aria-live')).toBe('polite')
    expectClusterCanWrap(count)
  })

  it('Breeding Codes (BreedingCodeList): the instance that shipped the class inert', async () => {
    render(<BreedingCodeList onGoToSettings={vi.fn()} />)
    const count = await screen.findByText(/\d+ species$/)
    expect(count.getAttribute('aria-live')).toBe('polite')
    expectClusterCanWrap(count)
  })
})
