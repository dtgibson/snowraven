// Real-engine verification that the Named Birds card header keeps its text
// inside the card at 320px, at every in-app text scale (QA-56, feature
// named-birds-timelines). Promoted from a hand-run probe at
// `website/tools/probe-named-birds-header.mjs` by the QA hand-back that found
// the regression this measures.
//
// WHY IT EXISTS, and why the jsdom guard beside it is not enough. The component
// suite pins the ARRANGEMENT that makes a clip impossible -- a width cap on the
// pinned right-hand cluster and a released automatic minimum on both flex items
// under it -- and its own header says outright that jsdom has no layout engine
// and cannot see a clip. So the arrangement is guarded and the OUTCOME was not,
// until this file. The regression it exists for shipped exactly there: removing
// `white-space: nowrap` from the duration line (FR-64) made wrapping possible
// without making it happen, because a cluster that is never narrowed has no
// reason to break a line, and the widened column pushed the sighting count out
// through the card's `overflow: hidden`.
//
// WHY IT MEASURES INK AND NOT BOXES. The card is `overflow: hidden`, so the
// clipped reading is trivially zero and an element-box measurement CERTIFIES A
// BROKEN BUILD (`.claude/rules/testing.md`, v0.5.85). This harness therefore
// releases the clip for the measurement only, then measures TEXT INK through a
// `Range` per text node against the card's PADDING BOX, which is where
// `overflow: hidden` actually cuts.
//
// WHY NOT PAGE `scrollWidth`. It reports this bug as ABSENT, for two of the
// three documented reasons at once (v0.5.83): the card's own `overflow: hidden`
// swallows the signal completely, and the shell's padding absorbs what is left.
// Measured on the shipped defect at 260px the page read exactly 320 while the
// ink stood 21.66px past the card.
//
// THE ELLIPSIZED BIRD NAME IS ALLOWED, EXPLICITLY, NEVER SILENTLY. The name span
// carries `white-space: nowrap` + `overflow: hidden` + `text-overflow: ellipsis`,
// so its Range ink legitimately extends past its own box: that is an INTENDED
// TRUNCATION with a visible ellipsis, not a clip, and it is shipped chrome this
// feature never touched. Ink under such an element is classified as allowed and
// PRINTED with its measurement on every run, so the exemption is visible in the
// output rather than being a filter nobody reads. Anything else that overflows
// is a failure. The harness also asserts the exemption is not doing all the
// work: it fails if no card was measured, if a scale did not apply, or if the
// only thing keeping a run green is that every overflow was exempt.
//
// THE CSV IS THE SCENARIO, NOT THE APPARATUS, which is why this harness takes a
// dist path and NOT an `SR_VERIFY_BASE` override. The geometry it measures is a
// function of the widest string the header can render, so the fixture has to be
// fixed: a bird whose span reads `1 yr. 11 mos.` produces the longest duration
// line the band table can emit, and pointing this at an already-running server
// would measure whatever export that server happens to hold. It is deliberately
// NOT the user's real data and NOT the demo dataset directory: both are outside
// the repo's control and neither is reproducible on a runner.
//
//   node verify-named-birds-header.mjs <distDir>                     # expect all green
//   node verify-named-birds-header.mjs <preFixDist> --expect-broken  # expect red
//
// Exit code is 0 when the run matched the mode, 1 otherwise.
//
// IT HAS BEEN SEEN FAILING, which is what makes it a measurement rather than an
// assertion. Against a dist built from this feature MINUS the width cap and the
// two released minimums -- the exact state that shipped to QA -- it reports 8
// red checks, one per scale per engine, naming the offender:
//
//   scale | chromium                  | webkit
//   ------+---------------------------+---------------------------
//   100%  | 15.45px past [Notch]      | 15.45px past [Notch]
//   125%  | 69.62px past [Notch]      | 69.62px past [Notch]
//   150%  | 121.70px past [Notch]     | 121.66px past [Notch]
//   200%  | 222.77px past [Notch]     | 222.77px past [Notch]
//
// In every one of those the clipped string is `sightings`, the count pushed out
// of the card by the widened duration column -- the defect itself, not a proxy
// for it. The allowed ellipsis reading is byte-stable across both builds
// (35.06px chromium / 36.52px webkit at 200%), which is the evidence that the
// exemption is not what turns a run green: it is identical in the build that
// passes and the build that fails.

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveDist } from './serveDist.mjs'
import { requirePlaywright } from './playwright.mjs'

const { chromium, webkit } = requirePlaywright()

const DIST = resolve(process.argv[2] ?? process.env.SR_VERIFY_DIST
  ?? fileURLToPath(new URL('../../../frontend/dist/', import.meta.url)))
const MODE = process.argv.includes('--expect-broken') ? 'broken' : 'fixed'

/** The four in-app text scales the reflow requirement covers. */
const SCALES = [1, 1.25, 1.5, 2]

const FILES_STATUS = {
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T00:00:00Z' },
  ml: null,
}

// THE FIXTURE. Three named birds, chosen so the header renders the widest text
// this surface can produce rather than a comfortable average:
//
//   * `Old-Blue` spans Jan 3 2024 to Dec 6 2025, which is 1,068 days and reads
//     `1 yr. 11 mos.` -- the longest string the year band emits, and the one
//     that widened the column past the clip.
//   * `Freeway-Turkey-Fam` is a long hyphenated name, so the ellipsized span on
//     the left is genuinely exercised and its allowed ink is a real reading
//     rather than a theoretical branch.
//   * `Notch` is short, so a run cannot pass by every card being the same shape.
//
// Two checklists share 2024-03-02 for Old-Blue, so the tab's distinct-date
// collapsing is exercised while the header is being measured.
const CSV = [
  'Submission ID,Common Name,Scientific Name,Date,Location,Count,Breeding Code,Species Comments,ML Catalog Numbers,Location ID,Latitude,Longitude',
  'S900000001,Ring-billed Gull,Larus delawarensis,2024-01-03,Central Park,2,,[name:Old-Blue] banded,,L191106,40.7813,-73.9665',
  'S900000002,Ring-billed Gull,Larus delawarensis,2024-03-02,Prospect Park,1,,[name:Old-Blue] again,,L109516,40.6602,-73.9690',
  'S900000003,Ring-billed Gull,Larus delawarensis,2024-03-02,Jamaica Bay,1,,[name:Old-Blue] same day,,L152773,40.6188,-73.8233',
  'S900000004,Ring-billed Gull,Larus delawarensis,2025-06-14,Sandy Hook,3,,[name:Old-Blue] still here,,L295658,40.4376,-73.9916',
  'S900000005,Ring-billed Gull,Larus delawarensis,2025-12-06,Montauk Point,1,,[name:Old-Blue] winter,,L139721,41.0717,-71.8567',
  'S900000006,Wild Turkey,Meleagris gallopavo,2024-02-11,Garret Mountain,4,,[name:Freeway-Turkey-Fam] hen and poults,,L207514,40.9168,-74.1490',
  'S900000007,Wild Turkey,Meleagris gallopavo,2025-09-18,Doodletown,5,,[name:Freeway-Turkey-Fam] roadside,,L444485,41.3079,-73.9912',
  'S900000008,Mallard,Anas platyrhynchos,2025-01-05,Cape May Point,2,,[name:Notch] notched tail,,L137800,38.9319,-74.9610',
  'S900000009,Mallard,Anas platyrhynchos,2025-10-18,Sterling Forest,1,,[name:Notch] again,,L207471,41.1976,-74.2549',
].join('\n')

/**
 * The scenario: a stored eBird backup that parses into three named birds, and
 * nothing else answering.
 *
 * `/taxonomy/codes` deliberately 404s. The tab catches that and renders names
 * without their favicons, which is a real shipped state (offline, no key) and is
 * not load-bearing for this measurement: the species cluster sits on the LEFT of
 * the header behind `min-width: 0; overflow: hidden` and shrinks, while what is
 * measured is the pinned cluster on the right. Letting it 404 keeps the run
 * hermetic and deterministic instead of depending on a network answer.
 */
function stubBackend(p, _req, res) {
  if (p === '/settings/files') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(FILES_STATUS))
    return true
  }
  if (p === '/settings/files/ebird') {
    res.writeHead(200, { 'content-type': 'text/csv' })
    res.end(CSV)
    return true
  }
  if (p === '/settings/files/ml') { res.writeHead(404); res.end('not found'); return true }
  if (p === '/settings/keys') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ebird: null, openweather: null }))
    return true
  }
  if (p.startsWith('/settings/') || p.startsWith('/weather') || p.startsWith('/tide')
      || p.startsWith('/map') || p.startsWith('/taxonomy') || p.startsWith('/version')) {
    res.writeHead(404); res.end('not found'); return true
  }
  return false
}

const failures = []
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

/**
 * Measure one scale, in the page.
 *
 * Returns every text node in every card header whose ink passes the card's
 * padding box, split into `clipped` (a failure) and `truncated` (allowed: the
 * node sits under an element that ellipsizes), plus the tightest clearance seen
 * so a green run still reports a number.
 */
const MEASURE = (scale) => {
  document.documentElement.style.setProperty('--sr-text-scale', String(scale))
  // PROVE THE SCALE APPLIED before trusting a number: the root font size must
  // track it, or this leg measures 100% under another name (v1.0.6).
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize)

  // A NAMED-BIRD CARD HEADER, not merely "a button with aria-expanded". At
  // 320px the nav is the bottom bar, whose More button ALSO carries
  // `aria-expanded`, so the broader selector found four headers and walked the
  // nav's own text against the nav container as if it were a card -- a
  // meaningless clip box producing a real-looking number. The duration line's
  // own class is what makes a header a card header, and it is the element this
  // measurement exists for, so it is the right anchor rather than a convenient
  // one. Visibility filtering stays: a tab is hidden with `display: none` and
  // never unmounted, so every other mounted tab's disclosures are in the DOM.
  const headers = [...document.querySelectorAll('button[aria-expanded]')]
    .filter(b => b.getClientRects().length > 0 && b.querySelector('.sr-nbt-durline'))

  const clipped = []
  const truncated = []
  let tightest = null

  for (const header of headers) {
    const card = header.parentElement
    if (!card) continue
    const prevOverflow = card.style.overflow
    // Measurement only, and it changes no width: the card is a block box either
    // way, so releasing the clip reveals the ink without moving it.
    card.style.overflow = 'visible'

    const cs = getComputedStyle(card)
    const clipRight = card.getBoundingClientRect().right
      - parseFloat(cs.borderRightWidth || '0')

    const nameOf = (header.querySelector('span:nth-of-type(2)')?.textContent || '').trim().slice(0, 26)
    const walker = document.createTreeWalker(header, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      if (!node.nodeValue || !node.nodeValue.trim()) continue

      // Is this text under an element that ellipsizes? That is an intended
      // truncation with a visible ellipsis, not a clip.
      let ellipsized = false
      for (let el = node.parentElement; el && el !== header.parentElement; el = el.parentElement) {
        const s = getComputedStyle(el)
        if (s.textOverflow === 'ellipsis' && s.overflow !== 'visible') { ellipsized = true; break }
      }

      const range = document.createRange()
      range.selectNodeContents(node)
      for (const rect of range.getClientRects()) {
        if (rect.width === 0 && rect.height === 0) continue
        const over = +(rect.right - clipRight).toFixed(2)
        const entry = { over, card: nameOf, text: node.nodeValue.trim().slice(0, 40) }
        if (over > 0) (ellipsized ? truncated : clipped).push(entry)
        if (!ellipsized && (tightest === null || over > tightest.over)) tightest = entry
      }
    }
    card.style.overflow = prevOverflow
  }

  return { rootPx, cards: headers.length, clipped, truncated, tightest }
}

async function run(browserType, label, base) {
  const browser = await browserType.launch()
  const ctx = await browser.newContext({ viewport: { width: 320, height: 900 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  await page.goto(base)

  // Drive the nav by ACCESSIBLE NAME, never by `[role="tab"]`: at 320px the nav
  // is the bottom bar, whose cells are plain buttons, and the overflow lives
  // behind More (v0.5.84, restated for the responsive nav).
  //
  // THE MORE BUTTON'S ACCESSIBLE NAME IS `More destinations`, not `More` -- it
  // carries an `aria-label` that its visible text does not match, which is
  // exactly why a probe drives a control by the name the accessibility tree
  // reports rather than by the word on screen. An `exact: true` match on `More`
  // waits 20 s and then fails, which is how this was found.
  const openTab = async () => {
    const direct = page.getByRole('button', { name: 'Named Birds', exact: true })
    if (await direct.count()) { await direct.first().click(); return }
    await page.getByRole('button', { name: /^More\b/ }).first().click()
    const row = page.getByRole('button', { name: 'Named Birds', exact: true })
    await row.first().waitFor()
    await row.first().click()
  }
  await openTab()

  // The cards are what is measured, so wait for them rather than for a timeout --
  // and wait for a VISIBLE one. This app hides a tab with `display: none` and
  // never unmounts it, so a bare `button[aria-expanded]` locator resolves to 43
  // hidden buttons belonging to tabs that are not on screen, and the wait times
  // out against elements that were never going to appear (v1.0.18).
  await page.locator('button[aria-expanded]:visible').first().waitFor()
  // ...and wait for the figure itself, which proves the CSV parsed into the
  // named birds this fixture is built around rather than merely that some card
  // rendered. `Old-Blue` spans 703 days, which is the `1 yr. 11 mos.` band.
  await page.getByText('1 yr. 11 mos.', { exact: false }).first().waitFor()

  for (const scale of SCALES) {
    const r = await page.evaluate(MEASURE, scale)
    const pct = `${Math.round(scale * 100)}%`

    check(`${label} ${pct}: the text scale actually applied`,
      Math.abs(r.rootPx - 16 * scale) < 0.6, `root=${r.rootPx}px`)
    // The count IS the point here, so it is asserted rather than described: the
    // fixture has three named birds, and a run that measured two of them, or
    // four things one of which was the navigation, is not the measurement this
    // harness claims to make.
    check(`${label} ${pct}: all three fixture cards were measured, and nothing else`,
      r.cards === 3, `cards=${r.cards}`)

    const worst = r.clipped.reduce((a, b) => (a && a.over >= b.over ? a : b), null)
    check(`${label} ${pct}: no header text is clipped by the card`,
      r.clipped.length === 0,
      worst
        ? `worst ${worst.over}px past the card [${worst.card}: "${worst.text}"]`
        : `clearance ${r.tightest ? (-r.tightest.over).toFixed(2) : '?'}px`)

    // The allowed exemption, PRINTED on every run rather than filtered away.
    for (const t of r.truncated) {
      console.log(`      allowed: ${t.over}px of "${t.text}" [${t.card}] — ellipsized, an intended truncation`)
    }
    // ...and it may not be doing all the work. If every card's every string were
    // exempt there would be nothing left for the assertion above to reject.
    check(`${label} ${pct}: something non-exempt was actually measured`,
      r.tightest !== null)
  }

  await browser.close()
}

const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
console.log(`serving ${DIST} at ${base} (mode: expect-${MODE})`)
console.log('320px viewport, in-app text scale 100 / 125 / 150 / 200%\n')

try {
  await run(chromium, 'chromium', base)
  console.log('')
  await run(webkit, 'webkit', base)
} finally {
  await close()
}

console.log('')
if (MODE === 'fixed') {
  console.log(failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILURES: ${failures.join(' | ')}`)
  process.exit(failures.length === 0 ? 0 : 1)
} else {
  console.log(failures.length > 0
    ? `HARNESS DISCRIMINATES: ${failures.length} check(s) failed on the pre-fix build`
    : 'HARNESS IS VACUOUS: the pre-fix build passed every check')
  process.exit(failures.length > 0 ? 0 : 1)
}
