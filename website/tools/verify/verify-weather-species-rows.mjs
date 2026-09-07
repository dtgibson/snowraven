// Real-engine verification that the Weather section's per-species rows stay
// inside their column, across the whole viewport band where they can fail, at
// every in-app text scale (weather-stats, QA Finding A).
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
// WHY A SWEEP AND NOT TWO POINTS. The defect lived in a BAND -- above the phone
// tier that handled it and below the width that is genuinely wide enough -- so
// a check at 320px and at 900px passes straight over it. Both of those points
// were measured clean while the bug was live. This walks the band in 10px steps
// at three text scales in two engines, which is the shape a "it fits" claim
// actually needs.
//
// WHAT IT MEASURES, and why each instrument. Three readings per configuration:
//
//   * PAGE horizontal scroll. The user-visible symptom, and the one WCAG 1.4.10
//     turns on. Necessary and NOT sufficient: `.claude/rules/testing.md` records
//     three ways it reports a real overflow as absent (a clipping ancestor
//     swallows it, a left overflow never extends scroll width, a bigger
//     co-located offender masks it), so it is never the only assertion.
//   * BOX overflow past the card's content box. The element-versus-container
//     reading, which is what catches a row leaking into its neighbour before the
//     page has grown at all.
//   * TEXT INK past the card, each reading CLEARED against its clipping
//     ancestor. `Range.getClientRects()` is unclipped by construction, so a
//     `.sr-truncate` span reports its full text extent while the browser paints
//     an ellipsis; counting that raw would report ~180px of phantom overflow at
//     phone widths. Only ink that survives its clipping ancestor is a failure.
//
// THE FIXTURE IS HEAVY-BUT-ORDINARY, deliberately, and it is the scenario rather
// than the apparatus -- which is why this harness takes a dist path and no
// server override. The geometry is a function of the widest figures the row can
// render, so the data has to be fixed: a four-digit species count against a band
// holding every outing produces `1,234 · 99%` beside `outings 100%`, which is
// the pair QA measured 34.3px over. A typical row (`140 · 10%` / `outings 10%`)
// was already 2.5px over, so this is not a contrived worst case; it is the same
// shape with more digits.
//
//   node verify-weather-species-rows.mjs <distDir>                    # expect all green
//   node verify-weather-species-rows.mjs <preFixDist> --expect-broken # expect red
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
 * The band, walked rather than sampled.
 *
 * 600 to 820 in 10px steps covers the whole reported failure window (641-700)
 * with room either side, plus 320 and 390 so the phone tier is re-confirmed in
 * the same run -- a fix that repaired the band by breaking the phone would
 * otherwise pass. 641 and 667 are named explicitly: 641 is the first pixel above
 * the phone tier and where QA measured the page scroll, and 667 is an iPhone SE
 * in landscape.
 */
const WIDTHS = [320, 390, 641, 667, ...Array.from({ length: 23 }, (_, i) => 600 + i * 10)]
  .filter((w, i, a) => a.indexOf(w) === i)
  .sort((a, b) => a - b)

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
 *     -- a run cannot pass by every group being degenerate.
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
 * Returns the three readings plus the evidence that the measurement was real:
 * the root font size (so a scale that did not apply cannot pass as a clean
 * reading), how many per-species rows were found, and whether the heavy figures
 * are actually on screen.
 */
const MEASURE = (scale) => {
  document.documentElement.style.setProperty('--sr-text-scale', String(scale))
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize)

  const pair = document.querySelector('.sr-wx-pair')
  if (!pair) return { ok: false, why: 'no .sr-wx-pair on the page', rootPx }
  const card = pair.closest('div[id]')
  if (!card) return { ok: false, why: 'no SectionCard ancestor', rootPx }

  const cs = getComputedStyle(card)
  const cb = card.getBoundingClientRect()
  const L = cb.left + parseFloat(cs.paddingLeft) + parseFloat(cs.borderLeftWidth)
  const R = cb.right - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)

  const rows = [...pair.querySelectorAll('.sr-wx-row--sp')]

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

  const texts = rows.map(r => (r.textContent || '').replace(/\s+/g, ' ').trim())
  return {
    ok: true, rootPx, rows: rows.length,
    boxOver: +boxOver.toFixed(2), boxWho,
    inkOver: +inkOver.toFixed(2), inkWho,
    colOver: +colOver.toFixed(2), colWho,
    pageScroll: document.documentElement.scrollWidth,
    pageClient: document.documentElement.clientWidth,
    // The widest pair must actually be on screen, or a clean reading is a
    // reading of a chart that never rendered the case this harness exists for.
    heavy: texts.some(t => /1,234 · 100%/.test(t) && /outings 100%/.test(t)),
    sample: texts.find(t => /1,234/.test(t)) ?? texts[0] ?? '',
  }
}

async function run(browserType, label, base) {
  const browser = await browserType.launch()
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 } })
  const page = await ctx.newPage()
  await page.goto(base)

  // Reach the Weather section: Statistics, then pick the species.
  await selectTab(page, 'Statistics')
  await page.getByRole('heading', { name: 'Weather' }).waitFor({ timeout: 60_000 })
  const combo = page.getByRole('combobox', { name: 'Filter by species' })
  await combo.waitFor({ timeout: 30_000 })
  await combo.click()
  await page.getByRole('option', { name: new RegExp(SPECIES) }).first().click()
  await page.locator('.sr-wx-pair').waitFor({ timeout: 30_000 })

  const worst = { over: -1, at: '' }
  for (const scale of SCALES) {
    let failedHere = 0
    let measured = 0
    let firstDetail = ''
    for (const width of WIDTHS) {
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
      const r = await page.evaluate(MEASURE, scale)
      if (!r.ok) { check(`${label} ${width}px @${scale}x: the section is on screen`, false, r.why); continue }

      // Non-vacuity, per configuration: a run that measured nothing, or measured
      // a scale that did not apply, must not read as clean.
      const scaleApplied = Math.abs(r.rootPx - 16 * scale) < 0.6
      const populated = r.rows === 18 && r.heavy
      if (!scaleApplied || !populated) {
        check(`${label} ${width}px @${scale}x: the measurement is real`, false,
          `rootPx=${r.rootPx} rows=${r.rows} heavyFigures=${r.heavy} sample="${r.sample}"`)
        continue
      }

      measured++
      const over = Math.max(r.boxOver, r.inkOver, r.colOver,
        Math.max(0, r.pageScroll - r.pageClient))
      if (over > worst.over) {
        worst.over = over
        worst.at = `${width}px @${scale}x [box ${r.boxOver} ink ${r.inkOver} col ${r.colOver} `
          + `page ${r.pageScroll - r.pageClient}] ${r.boxWho || r.colWho || r.inkWho}`
      }
      if (over > 0.5) {
        failedHere++
        if (!firstDetail) {
          firstDetail = `${width}px: box ${r.boxOver}px, col ${r.colOver}px, ink ${r.inkOver}px, `
            + `page +${r.pageScroll - r.pageClient}px  [${r.boxWho || r.colWho}]`
        }
      }
    }
    // NON-VACUITY BEFORE CLEANLINESS. A configuration that fails its own
    // reality check is SKIPPED, so without this a run in which every width was
    // skipped reports "clean" over a denominator of nothing -- which is exactly
    // what this harness did on its first run against the pre-fix build, and is
    // the shape `.claude/rules/testing.md` calls a green line that means "not
    // run" and reads as "verified".
    check(`${label} @${scale}x: every width was actually measured`,
      measured === WIDTHS.length, `${measured}/${WIDTHS.length}`)
    check(`${label} @${scale}x: every width from ${WIDTHS[0]} to ${WIDTHS[WIDTHS.length - 1]} is clean`,
      failedHere === 0 && measured === WIDTHS.length,
      failedHere === 0
        ? `${measured} widths, worst reading ${Math.max(0, worst.over).toFixed(2)}px`
        : `${failedHere}/${measured} widths over; first ${firstDetail}`)
  }
  console.log(`      worst overall: ${worst.over.toFixed(2)}px at ${worst.at}`)

  await browser.close()
}

const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
console.log(`serving ${DIST} at ${base} (mode: expect-${MODE})`)
console.log(`${WIDTHS.length} widths from ${WIDTHS[0]} to ${WIDTHS[WIDTHS.length - 1]}px, `
  + `text scale ${SCALES.map(s => `${s * 100}%`).join(' / ')}\n`)

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
