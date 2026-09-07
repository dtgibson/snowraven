// Real-engine verification of the Weather per-species rows: that they stay
// inside their column, that a label never paints over its count, and that a
// rendered rail keeps a usable width -- across the whole viewport band where
// each can fail, at every in-app text scale, in both engines, on BOTH surfaces
// that render the shared row.
//
// WHY IT EXISTS. QA found, in real Chromium and real WebKit, that at 200% text
// scale between ~641px and ~700px a per-species row overflowed its column,
// collided with the neighbouring column, and at 641px leaked 9px of page
// horizontal scroll. Five thousand unit tests were green through it, and
// structurally had to be: `weatherPickerCss.test.ts` is declaration-only and
// says so in its own header, `WeatherStatsSection.test.tsx` runs in jsdom which
// has no layout engine, and `lib/scrollLeakCss.test.ts` carries no `.sr-wx-*`
// row. That is the second time a real-browser check has found something the
// unit suite could not see, which is why this is a committed harness in the
// gate rather than a probe in a scratch directory.
//
// WHY A SWEEP AND NOT TWO POINTS. Every defect this file measures lived in a
// BAND -- above the phone tier that handled it and below the width that is
// genuinely wide enough -- so a check at 320px and at 900px passes straight over
// it. Both of those points were measured clean while the first bug was live.
//
// ── WIDENED FOR species-detail-weather (OQ-08, FR-36, NFR-14) ───────────────
//
// The card on Species Detail renders the SAME row primitive, and Stage 4 found
// two further defects in it against the shipped v1.0.22 build. THIS HARNESS'S
// EXISTING THREE READINGS CANNOT SEE EITHER, and that is a fact about its
// instruments rather than a lapse: run against the same build and the same
// fixture it reports all checks passed, worst reading 0.01px, across 27 widths
// and three text scales in two engines, INCLUDING 320px at 200%, the exact
// configuration carrying 48.9px of painted overlap. It measures page horizontal
// scroll and overflow past THE CARD's content box; a label overrunning into its
// sibling grid column never leaves the card, and a collapsed rail overflows
// nothing at all. So repeating its method at more widths buys nothing, and the
// two additions below are different INSTRUMENTS:
//
//   * LABEL INK AGAINST THE COUNT CELL'S OWN EDGE (FR-34 / QA-38). The label's
//     painted right edge must never cross `.sr-wx-count`'s left edge. Ink, not
//     the box: the desktop tier clips with an ellipsis, so a box reading would
//     report phantom overlap there, and `Range.getClientRects()` is unclipped by
//     construction and must be cleared against its clipping ancestor.
//   * MINIMUM RENDERED RAIL WIDTH (FR-35 / QA-39). Every `.sr-wx-track` inside a
//     per-species row must measure at least 120px. The shipped section painted
//     0.0 to 32.6px in a 398px column at 200%, several rows painting no rail at
//     all while still taking the height of one.
//
// The two new instruments run on BOTH surfaces; the three existing ones stay
// exactly as they were and stay on Statistics, which is where the card box they
// need is. QA-42 is discharged by `--expect-broken`, which prints the
// card-scoped readings beside the new ones at the overlapping configuration and
// asserts the old ones really are blind there.
//
// WIDTH COVERAGE, and why three lists rather than one:
//
//   * The ORIGINAL band (600-820 by 10, plus 320, 390, 641, 667) still carries
//     the three original readings, unchanged, so a run is directly comparable to
//     the ones before this change.
//   * FR-36's two DISJOINT label bands, ~300-365 and ~620-640, in 5px steps. The
//     second exists only because `.sr-wx-pair`'s `auto-fit` grid flips from one
//     column to two at about 620px, halving each column while the 640px rules
//     are still in force: a check at 320 and 900 finds the first and misses the
//     second, and a check at 375, 414, 480 or 560 finds neither.
//   * The rail floor is asserted from 320px up, the app's supported floor. The
//     label bands reach below it deliberately -- the instrument is cheap and a
//     label painting over a figure is a defect at any width -- so those widths
//     are measured and reported but only the label reading is asserted there.
//
// THE FIXTURE IS HEAVY-BUT-ORDINARY, deliberately, and it is the scenario rather
// than the apparatus -- which is why this harness takes a dist path and no
// server override. The geometry is a function of the widest figures the row can
// render, so the data has to be fixed: a four-digit species count against a band
// holding every outing produces `1,234 · 100%` beside `outings 100%`, which is
// the pair QA measured 34.3px over. A typical row (`140 · 10%` / `outings 10%`)
// was already 2.5px over, so this is not a contrived worst case; it is the same
// shape with more digits. It ALSO produces eight sky bands the user has never
// birded, so the row that actually carries the label defect -- "Thunderstorm"
// over the string `no outings` -- is on screen in every configuration, and the
// run refuses to read as clean unless it is.
//
//   node verify-weather-species-rows.mjs <distDir>                    # expect all green
//   node verify-weather-species-rows.mjs <preFixDist> --expect-broken # expect red
//
// In `--expect-broken` mode only the Statistics surface is visited: the pre-fix
// build has no Species Detail card to measure, which is what "pre-fix" means.
//
// Exit code is 0 when the run matched the mode, 1 otherwise.

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveDist } from './serveDist.mjs'
import { requirePlaywright } from './playwright.mjs'
// The repo's own nav helper rather than a fourth copy of "click the tab": it
// knows all three nav densities and THROWS on a miss, where a hand-rolled
// matcher silently measures whatever tab happened to be open.
import { selectTab } from '../capture-lib.mjs'

const { chromium, webkit } = requirePlaywright()

const DIST = resolve(process.argv[2] ?? process.env.SR_VERIFY_DIST
  ?? fileURLToPath(new URL('../../../frontend/dist/', import.meta.url)))
const MODE = process.argv.includes('--expect-broken') ? 'broken' : 'fixed'

/**
 * The original band, walked rather than sampled, and unchanged.
 *
 * 600 to 820 in 10px steps covers the whole originally-reported failure window
 * (641-700) with room either side, plus 320 and 390 so the phone tier is
 * re-confirmed in the same run -- a fix that repaired the band by breaking the
 * phone would otherwise pass. 641 and 667 are named explicitly: 641 is the first
 * pixel above the phone tier and where QA measured the page scroll, and 667 is
 * an iPhone SE in landscape.
 */
const WIDTHS = [320, 390, 641, 667, ...Array.from({ length: 23 }, (_, i) => 600 + i * 10)]
  .filter((w, i, a) => a.indexOf(w) === i)
  .sort((a, b) => a - b)

const range = (from, to, step) =>
  Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)

/** FR-36's two disjoint bands, in 5px steps. */
const LABEL_BANDS = [...range(300, 365, 5), ...range(620, 640, 5)]

/** Widths at which the group column is wide enough that the row keeps its four
 *  INLINE tracks. Without them a run never exercises the unstacked shape at all
 *  -- the original band tops out at 820px, where this fixture's column is still
 *  under the stacking threshold at 100% -- so the desktop tier's ellipsis and
 *  the rail the threshold is chosen to guarantee would both go unmeasured, and
 *  QA-40's transition would have nothing to be monotonic across. */
const WIDE_WIDTHS = [900, 1000, 1100, 1280, 1440]

/** Everything measured in one pass, so a configuration is visited once. */
const ALL_WIDTHS = [...new Set([...WIDTHS, ...LABEL_BANDS, ...WIDE_WIDTHS])].sort((a, b) => a - b)

/** The widths the app supports, which is where the original three readings and
 *  the rail floor are asserted. The label bands reach below it on purpose. */
const SUPPORTED_WIDTHS = ALL_WIDTHS.filter(w => w >= 320)

/** The app's supported floor. Below it the rail floor is not asserted (the
 *  `.sr-wx-pair` minimum is documented as first overflowing near 270px), but the
 *  label reading still is. */
const SUPPORTED_MIN = 320

/** FR-35's floor. Chosen to separate the defect (0.0 to 32.6px) from the repair
 *  with margin at both ends rather than to sit near either. */
const MIN_RAIL_PX = 120

/** 100% is the shipped default; 200% is the reflow requirement's ceiling; 150%
 *  sits between them because the failure is a continuous function of both text
 *  scale and width and two points cannot show a band. */
const SCALES = [1, 1.5, 2]

const FILES_STATUS = {
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T00:00:00Z' },
  ml: null,
}

const SPECIES = 'Ruby-crowned Kinglet'
const SCI = 'Corthylio calendula'

/**
 * A backup that renders the WIDEST row the chart can produce.
 *
 * The geometry is a function of the widest figures on a row, so the fixture is
 * built to produce them rather than to look average:
 *
 *   * Every checklist sits in ONE temperature band, so that band holds every
 *     outing and its reference reads `outings 100%` -- the widest reference.
 *   * The kinglet is on 1,234 of them and in no other band, so its count is four
 *     digits and its share is `100%` -- the widest count. The temperature row
 *     therefore reads `1,234 · 100%` beside `outings 100%`, which is the widest
 *     pair the component can render at all.
 *   * The SKY axis meanwhile spans three conditions, so that group is a
 *     populated multi-row chart with ordinary sub-100 shares rather than one row
 *     -- a run cannot pass by every group being degenerate -- AND eight of its
 *     eleven bands hold no outings at all, which is what puts the label defect's
 *     own pair ("Thunderstorm" over `no outings`) on screen.
 *
 * That is heavier than QA's reported case and deliberately so, but it is not
 * contrived: QA measured the TYPICAL row (`140 · 10%` / `outings 10%`) already
 * 2.5px over, so the defect is reachable with ordinary data and this is the same
 * shape with more digits. A second species keeps the picker from having one
 * option.
 *
 * The block is the real format the app writes and reads: emoji header, condition
 * line, labelled values, SnowRaven attribution. It has to be, or the attribution
 * gate refuses it and the section never renders at all.
 */
function buildCsv() {
  const header = 'Submission ID,Common Name,Scientific Name,Date,Location,Count,'
    + 'Breeding Code,Species Comments,ML Catalog Numbers,Location ID,Latitude,Longitude,'
    + 'Protocol,Duration (Min),All Obs Reported,Distance Traveled (km),Number of Observers,'
    + 'State/Province,County,Time,Checklist Comments'
  // Quoted because the block carries commas, and written on one line because
  // that is what eBird's own export does to a pasted block.
  const block = (glyph, cond) =>
    `"${glyph}  ${cond}  Temperature: 60°F  Wind: Light breeze  Wind Direction: W  `
    + `Cloud Cover: 20%  Humidity: 72%  Dew point: 55°F  Sunrise: 6:16am  Sunset: 7:56pm  `
    + `Weather generated by <a href=""https://github.com/dtgibson/snowraven"">SnowRaven</a>"`
  const rows = [header]
  let n = 0
  const push = (glyph, cond, withKinglet) => {
    const id = `S90${String(n++).padStart(7, '0')}`
    const tail = `,2024-05-24,Pond,1,,,,L191106,40.78,-73.96,Traveling,60,1,1.5,1,`
      + `US-CA,Marin,07:00 AM,${block(glyph, cond)}`
    rows.push(`${id},${withKinglet ? `${SPECIES},${SCI}` : 'American Crow,Corvus brachyrhynchos'}${tail}`)
    if (withKinglet) rows.push(`${id},American Crow,Corvus brachyrhynchos${tail}`)
  }
  // Every checklist is 60°F, so the temperature axis is one band at 100% of
  // outings. The sky varies, so that axis is a real multi-row chart.
  for (let i = 0; i < 1234; i++) push('☁️', 'Overcast clouds', true)
  for (let i = 0; i < 40; i++) push('☀️', 'Clear sky', false)
  for (let i = 0; i < 20; i++) push('⛅', 'Scattered clouds', false)
  return rows.join('\n')
}
const CSV = buildCsv()

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
 * One configuration, measured in the page.
 *
 * Returns the readings plus the evidence that the measurement was real: the root
 * font size (so a scale that did not apply cannot pass as a clean reading), how
 * many per-species rows were found, whether the heavy figures are actually on
 * screen, and whether the label defect's own row is present.
 *
 * `cardScoped` selects the ORIGINAL three readings, which need the card box and
 * therefore run only where one is addressable (the Statistics section, whose
 * card carries the jump-nav's id). The two NEW readings need no card box at all
 * -- that is exactly why they can see what the originals could not -- so they run
 * on every surface.
 */
const MEASURE = ({ scale, cardScoped }) => {
  document.documentElement.style.setProperty('--sr-text-scale', String(scale))
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize)

  const pair = document.querySelector('.sr-wx-pair')
  if (!pair) return { ok: false, why: 'no .sr-wx-pair on the page', rootPx }

  const rows = [...pair.querySelectorAll('.sr-wx-row--sp')]

  /** The visible ink of a text node, cleared against its clipping ancestors.
   *  `Range` rects are unclipped by construction, so a truncating span reports
   *  its full text extent while the browser paints an ellipsis. */
  const inkRight = (el, stopAt) => {
    let right = -Infinity
    const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    let n
    while ((n = walk.nextNode())) {
      if (!n.nodeValue.trim()) continue
      const rg = document.createRange(); rg.selectNodeContents(n)
      for (const rect of rg.getClientRects()) {
        if (!rect.width) continue
        let r = rect.right
        let a = n.parentElement
        while (a && a !== stopAt) {
          const s = getComputedStyle(a)
          if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
            r = Math.min(r, a.getBoundingClientRect().right)
          }
          a = a.parentElement
        }
        if (r > right) right = r
      }
    }
    return right
  }

  // ── NEW 1 (FR-34 / QA-38): the label's ink against the count cell's own left
  //    edge. Not the card's box, not page scroll: the overlap happens entirely
  //    inside the card, between two siblings, and leaves nothing at all.
  let labelOver = 0, labelWho = ''
  let sawNoOutingsRow = false
  for (const row of rows) {
    const label = row.querySelector('.sr-wx-label')
    const count = row.querySelector('.sr-wx-count')
    if (!label || !count) continue
    const countText = (count.textContent || '').trim()
    if (countText === 'no outings') sawNoOutingsRow = true
    const right = inkRight(label, row)
    if (right === -Infinity) continue
    const over = right - count.getBoundingClientRect().left
    if (over > labelOver) {
      labelOver = over
      labelWho = `"${(label.textContent || '').trim()}" over "${countText}"`
    }
  }

  // ── NEW 2 (FR-35 / QA-39): the narrowest RENDERED rail. Every per-species row
  //    draws one, filled or dashed, so a row painting no rail while still taking
  //    a rail's height is the defect stated as a number.
  // Which SHAPE the row is in, read off the computed grid rather than inferred
  // from the width: three tracks is the stacked tier, four (or five with the
  // glyph) the inline one. QA-40 asserts this is monotonic in width.
  const firstRow = rows[0]
  const stacked = firstRow
    ? getComputedStyle(firstRow).gridTemplateColumns.trim().split(/\s+/).length <= 3
    : null
  const colWidth = pair.firstElementChild
    ? +pair.firstElementChild.getBoundingClientRect().width.toFixed(1)
    : -1
  // The QUERY CONTAINER's own font size, read rather than assumed: `em` inside a
  // container query resolves against the container, not the root, and an
  // intervening font-size would move the threshold without moving the root.
  const containerPx = pair.firstElementChild
    ? parseFloat(getComputedStyle(pair.firstElementChild).fontSize)
    : -1

  let minRail = Infinity, railWho = '', zeroRails = 0
  for (const row of rows) {
    const track = row.querySelector('.sr-wx-track')
    if (!track) continue
    const w = track.getBoundingClientRect().width
    if (w < 0.5) zeroRails++
    if (w < minRail) {
      minRail = w
      railWho = (row.querySelector('.sr-wx-label')?.textContent || '').trim()
    }
  }
  if (!Number.isFinite(minRail)) minRail = -1

  const texts = rows.map(r => (r.textContent || '').replace(/\s+/g, ' ').trim())
  const out = {
    ok: true, rootPx, rows: rows.length, stacked, colWidth, containerPx,
    labelOver: +labelOver.toFixed(2), labelWho,
    minRail: +minRail.toFixed(2), railWho, zeroRails,
    pageScroll: document.documentElement.scrollWidth,
    pageClient: document.documentElement.clientWidth,
    // The widest pair must actually be on screen, or a clean reading is a
    // reading of a chart that never rendered the case this harness exists for.
    heavy: texts.some(t => /1,234 · 100%/.test(t) && /outings 100%/.test(t)),
    noOutings: sawNoOutingsRow,
    sample: texts.find(t => /1,234/.test(t)) ?? texts[0] ?? '',
  }
  if (!cardScoped) return out

  const card = pair.closest('div[id]')
  if (!card) return { ...out, ok: false, why: 'no SectionCard ancestor' }
  const cs = getComputedStyle(card)
  const cb = card.getBoundingClientRect()
  const L = cb.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)
  const R = cb.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)

  // 1. Box overflow past the card's content box.
  let boxOver = 0, boxWho = ''
  for (const el of pair.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) continue
    const o = Math.max(0, r.right - R) + Math.max(0, L - r.left)
    if (o > boxOver) { boxOver = o; boxWho = `${el.className || el.tagName}: ${(el.textContent || '').trim().slice(0, 28)}` }
  }

  // 2. Text ink past the card, each reading cleared against its clipping
  //    ancestor -- Range rects are unclipped, so a truncating span reports its
  //    full extent while the browser paints an ellipsis.
  let inkOver = 0, inkWho = ''
  const walk = document.createTreeWalker(pair, NodeFilter.SHOW_TEXT)
  let n
  while ((n = walk.nextNode())) {
    if (!n.nodeValue.trim()) continue
    const rg = document.createRange(); rg.selectNodeContents(n)
    for (const rect of rg.getClientRects()) {
      if (!rect.width) continue
      const raw = Math.max(0, rect.right - R) + Math.max(0, L - rect.left)
      if (raw <= 0.5) continue
      let el = n.parentElement, clip = null
      while (el && el !== card.parentElement) {
        const s = getComputedStyle(el)
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { clip = el; break }
        el = el.parentElement
      }
      const c = clip ? clip.getBoundingClientRect() : null
      const vis = c
        ? Math.max(0, Math.min(rect.right, c.right) - R) + Math.max(0, L - Math.max(rect.left, c.left))
        : raw
      if (vis > inkOver) { inkOver = vis; inkWho = `"${n.nodeValue.trim().slice(0, 28)}"` }
    }
  }

  // 3. A row colliding with the neighbouring column: any row's right edge past
  //    its own grid column's right edge. Measured directly rather than inferred
  //    from the card, because a collision can happen while the card is still
  //    clean.
  let colOver = 0, colWho = ''
  for (const group of pair.children) {
    const gb = group.getBoundingClientRect()
    for (const el of group.querySelectorAll('.sr-wx-row--sp > *')) {
      const r = el.getBoundingClientRect()
      if (!r.width && !r.height) continue
      const o = Math.max(0, r.right - gb.right) + Math.max(0, gb.left - r.left)
      if (o > colOver) { colOver = o; colWho = `${el.className}: ${(el.textContent || '').trim().slice(0, 24)}` }
    }
  }

  return {
    ...out,
    boxOver: +boxOver.toFixed(2), boxWho,
    inkOver: +inkOver.toFixed(2), inkWho,
    colOver: +colOver.toFixed(2), colWho,
  }
}

/** Reach the Statistics Weather section's per-species view: pick the species. */
async function openStatistics(page) {
  await selectTab(page, 'Statistics')
  await page.getByRole('heading', { name: 'Weather' }).waitFor({ timeout: 60_000 })
  const combo = page.getByRole('combobox', { name: 'Filter by species' })
  await combo.waitFor({ timeout: 30_000 })
  await combo.click()
  await page.getByRole('option', { name: new RegExp(SPECIES) }).first().click()
  await page.locator('.sr-wx-pair').waitFor({ timeout: 30_000 })
}

/** Reach the Species Detail Weather card: select the species and let the
 *  post-paint effect land. The card is `lazy`, so its chunk is fetched only
 *  here -- which is NFR-03's structural half and is why the wait matters. */
async function openSpeciesDetail(page) {
  await selectTab(page, 'Species Detail')
  const combo = page.getByRole('combobox', { name: 'Select species' })
  await combo.waitFor({ timeout: 60_000 })
  await combo.click()
  await page.getByRole('option', { name: new RegExp(SPECIES) }).first().click()
  await page.locator('.sr-wx-pair').waitFor({ timeout: 30_000 })
}

const SURFACES = [
  { key: 'statistics', label: 'Statistics', open: openStatistics, cardScoped: true },
  { key: 'species-detail', label: 'Species Detail', open: openSpeciesDetail, cardScoped: false },
]

async function run(browserType, engine, base, surface) {
  const label = `${engine} ${surface.label}`
  const browser = await browserType.launch()
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } })
  const page = await ctx.newPage()
  await page.goto(base)
  await surface.open(page)

  const worst = { over: -1, at: '' }
  const worstLabel = { over: -1, at: '' }
  const worstRail = { px: Infinity, at: '' }
  // QA-42's evidence, captured at the exact configuration the design measured.
  let qa42 = null

  for (const scale of SCALES) {
    let overflowFailed = 0
    let overflowMeasured = 0
    let labelFailed = 0
    let labelMeasured = 0
    let railFailed = 0
    let railMeasured = 0
    let firstOverflow = ''
    let firstLabel = ''
    let firstRail = ''
    // QA-40: THE SHAPE IS DECIDED BY THE COLUMN, MEASURED IN UNITS OF ITS OWN
    // TEXT -- which is the property FR-35 actually states, and it is NOT the
    // same as monotonicity in the viewport. `.sr-wx-pair` is an `auto-fit` grid,
    // so the column HALVES when it flips from one track to two (measured here at
    // ~648px at 100%, one 483px column at 641px and two 241px columns at 650px),
    // and the row's shape follows it down and back up. That is the trigger
    // reading the right quantity, not a defect: what FR-35 removes is the
    // FAILURE in those bands, not the shape change. So the assertion is the
    // predicate itself -- stacked exactly when the column is at or under
    // `max(22em, 390px)` of the container's own font size -- which is also what
    // makes a browser that silently ignored the `@container` rule, or the `or`
    // disjunction inside it, go red here rather than pass as "monotonic".
    const shapes = []
    const mispredicted = []

    for (const width of ALL_WIDTHS) {
      await page.setViewportSize({ width, height: 1200 })
      // SETTLE BEFORE MEASURING, or the reading is of an intermediate layout.
      // `setViewportSize` resolves before the engine has finished re-laying the
      // page out, and this app re-renders on resize (the nav picks its density
      // from a ResizeObserver). Reading straight after the resize produced up to
      // 205px of phantom page scroll on this very harness, at widths a separate
      // slow probe measured perfectly clean -- a false finding that would have
      // sent the fix after the wrong thing. Two frames: the first is scheduled
      // before the pending layout, the second after it.
      await page.evaluate(() => new Promise(done => {
        requestAnimationFrame(() => requestAnimationFrame(() => done()))
      }))
      const r = await page.evaluate(MEASURE, { scale, cardScoped: surface.cardScoped })
      if (!r.ok) {
        check(`${label} ${width}px @${scale}x: the section is on screen`, false, r.why)
        continue
      }

      // Non-vacuity, per configuration: a run that measured nothing, or measured
      // a scale that did not apply, must not read as clean. `noOutings` is new
      // and is what keeps the label reading honest -- the defect's own row is
      // "Thunderstorm" over `no outings`, so a run without one on screen has not
      // exercised the case this instrument exists for.
      const scaleApplied = Math.abs(r.rootPx - 16 * scale) < 0.6
      const populated = r.rows === 18 && r.heavy && r.noOutings
      if (!scaleApplied || !populated) {
        check(`${label} ${width}px @${scale}x: the measurement is real`, false,
          `rootPx=${r.rootPx} rows=${r.rows} heavy=${r.heavy} noOutings=${r.noOutings} sample="${r.sample}"`)
        continue
      }

      shapes.push({ width, stacked: r.stacked, colWidth: r.colWidth })
      {
        const threshold = Math.max(22 * r.containerPx, 390)
        // Skip the boundary itself: a column within a pixel of the threshold can
        // land either side on sub-pixel rounding, and neither answer is wrong.
        if (Math.abs(r.colWidth - threshold) > 1) {
          const expected = r.colWidth <= threshold
          if (r.stacked !== expected) {
            mispredicted.push(`${width}px: column ${r.colWidth}px vs threshold `
              + `${threshold.toFixed(1)}px, stacked=${r.stacked}`)
          }
        }
      }

      // ── The two new readings, on every surface and at every width ──────────
      labelMeasured++
      if (r.labelOver > worstLabel.over) {
        worstLabel.over = r.labelOver
        worstLabel.at = `${width}px @${scale}x ${r.labelWho}`
      }
      if (r.labelOver > 0.5) {
        labelFailed++
        if (!firstLabel) firstLabel = `${width}px: ${r.labelOver}px  [${r.labelWho}]`
      }

      if (width >= SUPPORTED_MIN) {
        railMeasured++
        if (r.minRail < worstRail.px) {
          worstRail.px = r.minRail
          worstRail.at = `${width}px @${scale}x [${r.railWho}]`
        }
        if (r.minRail < MIN_RAIL_PX || r.zeroRails > 0) {
          railFailed++
          if (!firstRail) {
            firstRail = `${width}px: narrowest rail ${r.minRail}px on "${r.railWho}", `
              + `${r.zeroRails} row(s) painting none`
          }
        }
      }

      // ── The three original readings, unchanged, where the card box is ──────
      //    Asserted from the supported floor up: the label bands deliberately
      //    reach below 320px, and the app does not claim that range.
      if (surface.cardScoped && width >= SUPPORTED_MIN) {
        overflowMeasured++
        const over = Math.max(r.boxOver, r.inkOver, r.colOver,
          Math.max(0, r.pageScroll - r.pageClient))
        if (over > worst.over) {
          worst.over = over
          worst.at = `${width}px @${scale}x [box ${r.boxOver} ink ${r.inkOver} col ${r.colOver} `
            + `page ${r.pageScroll - r.pageClient}] ${r.boxWho || r.colWho || r.inkWho}`
        }
        if (over > 0.5) {
          overflowFailed++
          if (!firstOverflow) {
            firstOverflow = `${width}px: box ${r.boxOver}px, col ${r.colOver}px, ink ${r.inkOver}px, `
              + `page +${r.pageScroll - r.pageClient}px  [${r.boxWho || r.colWho}]`
          }
        }
        if (width === 320 && scale === 2) {
          qa42 = {
            cardScoped: Math.max(r.boxOver, r.inkOver, r.colOver,
              Math.max(0, r.pageScroll - r.pageClient)),
            labelOver: r.labelOver, labelWho: r.labelWho, minRail: r.minRail,
          }
        }
      }
    }

    // NON-VACUITY BEFORE CLEANLINESS. A configuration that fails its own reality
    // check is SKIPPED, so without this a run in which every width was skipped
    // reports "clean" over a denominator of nothing -- which is exactly what this
    // harness did on its first run against the pre-fix build, and is the shape
    // `.claude/rules/testing.md` calls a green line that means "not run" and
    // reads as "verified".
    check(`${label} @${scale}x: every width was actually measured`,
      labelMeasured === ALL_WIDTHS.length, `${labelMeasured}/${ALL_WIDTHS.length}`)

    check(`${label} @${scale}x: no label paints over its count (FR-34)`,
      labelFailed === 0 && labelMeasured === ALL_WIDTHS.length,
      labelFailed === 0
        ? `${labelMeasured} widths ${ALL_WIDTHS[0]}-${ALL_WIDTHS[ALL_WIDTHS.length - 1]}, `
          + `worst ${Math.max(0, worstLabel.over).toFixed(2)}px`
        : `${labelFailed}/${labelMeasured} widths overlap; first ${firstLabel}`)

    check(`${label} @${scale}x: every rail is at least ${MIN_RAIL_PX}px (FR-35)`,
      railFailed === 0 && railMeasured > 0,
      railFailed === 0
        ? `${railMeasured} widths from ${SUPPORTED_MIN}px, narrowest ${
          Number.isFinite(worstRail.px) ? worstRail.px.toFixed(2) : 'n/a'}px`
        : `${railFailed}/${railMeasured} widths under floor; first ${firstRail}`)

    const byColumn = [...shapes].sort((a, b) => a.colWidth - b.colWidth)
    const notMonotone = byColumn.filter((s2, i) => i > 0 && s2.stacked && !byColumn[i - 1].stacked)
    check(`${label} @${scale}x: the shape is decided by the column in units of its own text (FR-35 / QA-40)`,
      mispredicted.length === 0 && notMonotone.length === 0
        && shapes.every(s2 => typeof s2.stacked === 'boolean'),
      mispredicted.length === 0 && notMonotone.length === 0
        ? `${shapes.length} widths, columns ${byColumn[0].colWidth}px to `
          + `${byColumn[byColumn.length - 1].colWidth}px, `
          + `${shapes.filter(s2 => s2.stacked).length} stacked`
        : `${mispredicted.length} mispredicted (first ${mispredicted[0] ?? '-'}), `
          + `${notMonotone.length} non-monotone in the column`)

    if (surface.cardScoped) {
      check(`${label} @${scale}x: every width from ${SUPPORTED_MIN} to ${ALL_WIDTHS[ALL_WIDTHS.length - 1]} is clean`,
        overflowFailed === 0 && overflowMeasured === SUPPORTED_WIDTHS.length,
        overflowFailed === 0
          ? `${overflowMeasured} widths, worst reading ${Math.max(0, worst.over).toFixed(2)}px`
          : `${overflowFailed}/${overflowMeasured} widths over; first ${firstOverflow}`)
    }
  }

  if (surface.cardScoped) {
    console.log(`      worst overflow: ${worst.over.toFixed(2)}px at ${worst.at}`)
  }
  console.log(`      worst label overlap: ${Math.max(0, worstLabel.over).toFixed(2)}px at ${worstLabel.at}`)
  console.log(`      narrowest rail: ${Number.isFinite(worstRail.px) ? worstRail.px.toFixed(2) : 'n/a'}px at ${worstRail.at}`)

  // QA-42: the reason the two new instruments exist, recorded rather than
  // remembered. At 320px / 200% the design measured 48.9px of painted overlap
  // while this harness's own card-scoped readings sat at 0.01px, because a label
  // overrunning into its sibling column never leaves the card and a collapsed
  // rail overflows nothing. In `--expect-broken` that is asserted; in `fixed`
  // both are zero and the line is printed as evidence rather than checked.
  if (qa42) {
    console.log(`      QA-42 @320px/200%: card-scoped ${qa42.cardScoped.toFixed(2)}px, `
      + `label overlap ${qa42.labelOver.toFixed(2)}px ${qa42.labelWho}, narrowest rail ${qa42.minRail}px`)
    if (MODE === 'broken') {
      check(`${label}: QA-42 the card-scoped readings are blind at 320px @200%`,
        qa42.cardScoped <= 0.5 && qa42.labelOver > 0.5,
        `card-scoped ${qa42.cardScoped.toFixed(2)}px vs label overlap ${qa42.labelOver.toFixed(2)}px`)
    }
  }

  await browser.close()
}

const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
const surfaces = MODE === 'broken' ? SURFACES.filter(s => s.cardScoped) : SURFACES
console.log(`serving ${DIST} at ${base} (mode: expect-${MODE})`)
console.log(`${ALL_WIDTHS.length} widths from ${ALL_WIDTHS[0]} to ${ALL_WIDTHS[ALL_WIDTHS.length - 1]}px, `
  + `text scale ${SCALES.map(s => `${s * 100}%`).join(' / ')}, `
  + `surfaces: ${surfaces.map(s => s.label).join(' + ')}\n`)

try {
  for (const [browserType, engine] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    for (const surface of surfaces) {
      await run(browserType, engine, base, surface)
      console.log('')
    }
  }
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
