// Real-engine verification of the Weather/tide Planner's picked-moment readout
// (plan-sun-moon-readout, FR-17, NFR-01; QA-17, QA-45): the readout block's
// height, the divider's position and the day list's top edge are IDENTICAL at
// rest and on every kind of pick (an hourly pick, a daily-tail pick, the
// window's end, and a no-tide plan), the readout's text ink stays inside its
// own box, and the page never scrolls sideways with a pick on screen -- swept
// across the whole phone-to-desktop band at three text scales, in Chromium
// AND WebKit, against the built bundle.
//
// WHY A BROWSER. The height claim is a CSS property of a stacked-layer grid
// (three siblings sharing one cell, the inactive one `visibility: hidden`)
// and jsdom lays nothing out, so `PlanResult.test.tsx` can only pin the
// structure. Only an engine can settle "the cell is as tall as its tallest
// layer at this width and text scale, and a pick changes it by nothing".
//
// THE HARNESS OWNS ITS BACKEND. `serveDist` serves the files; the plan's two
// halves are the parity fixture's `reference` family (a 1.0.29 document, the
// stored shapes did not change), answered by the `routes` hook below on
// `/weather/plan` and `/tide/plan`; a second pass answers the tide half with
// the too-far notice so the no-tide readout is measured on the same nodes.
// Nothing reaches a provider: every other backend path is a 404.
//
// THE SWEEP DECLARES ITS DENOMINATOR: `measured === WIDTHS.length` per scale
// per scenario per engine, and a scale that did not apply (the root font size
// must track `--sr-text-scale`, set as an INLINE style on documentElement) is
// a failure, not a clean reading.
//
// QA-32, THE CHUNK LANDING. A second leg holds the lazy PlanChart chunk at the
// network, measures the legend, the readout, the divider and the list with
// the Suspense fallback up, releases the chunk and measures again after the
// chart has reported whether the track fits: nothing may move. Widths 320,
// 360, 390, 414 and 430 at 100% and 200%, both engines.
//
// GUARD THE GUARD. After the clean sweep, the sizer layer is neutered in the
// page (`display: none`, which removes it from the grid) and the readout is
// measured again: rest and picked must now DIFFER, or the instrument is not
// reading the property it claims to. `--expect-broken` runs only that leg and
// exits 0 when the neutered readout goes red.
//
//   node website/tools/verify/verify-plan-readout.mjs [distDir] [--expect-broken]

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveDist } from './serveDist.mjs'
import { requirePlaywright } from './playwright.mjs'

const { chromium, webkit } = requirePlaywright()

const DIST = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) ?? process.env.SR_VERIFY_DIST
  ?? fileURLToPath(new URL('../../../frontend/dist/', import.meta.url)))
const MODE = process.argv.includes('--expect-broken') ? 'broken' : 'fixed'

const FIXTURE = JSON.parse(readFileSync(fileURLToPath(new URL('../../../frontend/src/lib/weatherTidePlan.fixture.json', import.meta.url)), 'utf8'))
const REF = FIXTURE.families.find(f => f.name === 'reference')
const WEATHER_HALF = REF.expectedWeather.plan
const TIDE_HALF = REF.expectedTide
const TIDE_FAR = { status: 'too-far', station: { id: '9413623', name: 'Elkhorn Slough, Highway 1 Bridge' }, distanceMi: 58 }

/** The phone-to-desktop band in 10px steps, plus the wide widths the design
 *  measured (390 is in the band; 1200 and 1440 are the desktop card). */
const range = (from, to, step) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step)
const WIDTHS = [...new Set([...range(320, 820, 10), 900, 1000, 1200, 1440])].sort((a, b) => a - b)
const SCALES = [1, 1.5, 2]

const FILES_STATUS = { ebird: null, ml: null }

/** Which tide half the stub answers: the harness flips it between scenarios. */
let tideMode = 'ok'

function stubBackend(p, _req, res) {
  const json = (body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); return true }
  if (p === '/settings/files') return json(FILES_STATUS)
  if (p === '/settings/keys') return json({ ebird: null, openweather: null })
  if (p === '/weather/plan') return json(WEATHER_HALF)
  if (p === '/tide/plan') return json(tideMode === 'ok' ? TIDE_HALF : TIDE_FAR)
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

/** Settle two frames after a resize before reading any geometry. */
const settle = (page) => page.evaluate(() => new Promise(done => {
  requestAnimationFrame(() => requestAnimationFrame(() => done()))
}))

/**
 * One reading, in the page: the readout's height, the divider's and the list's
 * top edges relative to the region (container-relative, never viewport), the
 * readout's text-ink overflow past its own box, the page's scroll width and
 * the root font size (the evidence the scale applied).
 */
const MEASURE = ({ scale }) => {
  document.documentElement.style.setProperty('--sr-text-scale', String(scale))
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const region = document.querySelector('.sr-plan-result')
  const ro = document.querySelector('.sr-plan-readout')
  const week = document.querySelector('.sr-plan-week')
  const days = document.querySelector('.sr-plan-days')
  const box = document.querySelector('.sr-plan-chartbox')
  if (!region || !ro || !week || !days || !box) return { ok: false, why: 'the plan region is not on screen', rootPx }
  const r0 = region.getBoundingClientRect()
  const rr = ro.getBoundingClientRect()
  // Text INK of every visible text node in the readout, against the readout's
  // box: the range covers the node's non-whitespace span only, because a
  // trailing space at a line end is a glyph box with no ink in it and WebKit
  // reports it past the container (measured: 3.80px at 1000px / 150%, on a
  // build whose element boxes, divider and page were all clean).
  let inkOver = 0
  let inkWho = ''
  const active = ro.querySelector('.sr-plan-ro-layer.is-on') ?? ro
  const walker = document.createTreeWalker(active, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent
    const start = text.length - text.trimStart().length
    const end = text.trimEnd().length
    if (end <= start) continue
    const range = document.createRange()
    range.setStart(n, start)
    range.setEnd(n, end)
    for (const rect of range.getClientRects()) {
      if (rect.width === 0) continue
      const over = Math.max(rect.right - rr.right, rr.left - rect.left)
      if (over > inkOver) { inkOver = over; inkWho = text.trim().slice(0, 40) }
    }
  }
  const pickText = ro.querySelector('.sr-plan-ro-pick.is-on')?.textContent ?? ''
  return {
    ok: true, rootPx,
    height: rr.height,
    weekTop: week.getBoundingClientRect().top - r0.top,
    daysTop: days.getBoundingClientRect().top - r0.top,
    boxHeight: box.getBoundingClientRect().height,
    inkOver,
    inkWho,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    pickText,
    hasMark: !!document.querySelector('.sr-plan-pickmark'),
  }
}

/** Open the Plan form, enter the fixture's place and build the plan. */
async function openPlan(page, base) {
  await page.goto(base)
  // With no stored file this is a COLD START and the first-run WelcomeScreen
  // is up; Escape dismisses it (the palette harness does the same). The
  // dialog mounts only after the settings request answers, so a bare count()
  // right after navigation can precede it (measured in WebKit): wait for it
  // to appear, and treat its absence after that wait as "not a cold start".
  const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
  await page.getByRole('button', { name: 'Plan weather and tide for a place' }).waitFor({ timeout: 60_000 })
  const up = await welcome.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)
  if (up) {
    await page.keyboard.press('Escape')
    await welcome.waitFor({ state: 'detached', timeout: 5000 })
  }
  await page.getByRole('button', { name: 'Plan weather and tide for a place' }).click()
  await page.getByLabel('Latitude (-90 to 90)').fill('36.603')
  await page.getByLabel('Longitude (-180 to 180)').fill('-121.876')
  await page.getByRole('button', { name: 'See all upcoming weather and tide data' }).click()
  await page.getByRole('region', { name: 'Weather and tide plan' }).waitFor({ timeout: 60_000 })
  await page.locator('.sr-plan-scroller[role="slider"]').waitFor({ timeout: 60_000 })
}

/** The four states measured at one configuration: rest, an hourly pick, a
 *  daily-tail pick, the window's end. Picks are keyboard steps so the box's
 *  scroll never enters the measurement (a pointer pick never scrolls either). */
async function states(page, scale) {
  const slider = page.locator('.sr-plan-scroller[role="slider"]')
  const out = {}
  await page.keyboard.press('Escape')
  out.rest = await page.evaluate(MEASURE, { scale })
  await slider.focus()
  await page.keyboard.press('ArrowRight')            // the first quarter mark after Now: hourly
  await settle(page)
  out.hourly = await page.evaluate(MEASURE, { scale })
  for (let i = 0; i < 3; i += 1) await page.keyboard.press('PageUp')   // three days on: the daily tail
  await settle(page)
  out.daily = await page.evaluate(MEASURE, { scale })
  await page.keyboard.press('End')
  await settle(page)
  out.end = await page.evaluate(MEASURE, { scale })
  await page.keyboard.press('Escape')
  await settle(page)
  out.cleared = await page.evaluate(MEASURE, { scale })
  return out
}

async function sweep(page, label, tide) {
  const worst = { d: 0, at: '' }
  let inkWorst = { over: 0, at: '' }
  for (const scale of SCALES) {
    let measured = 0
    let failed = 0
    let first = ''
    let sawDaily = 0
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 1400 })
      await settle(page)
      const s = await states(page, scale)
      const rows = Object.values(s)
      if (rows.some(r => !r.ok)) { check(`${label} ${width}px @${scale}x: the plan is on screen`, false, rows.find(r => !r.ok).why); continue }
      // The scale applied: the root font size tracks it (16px at 1x on every engine).
      if (Math.abs(s.rest.rootPx - 16 * scale) > 0.5) { check(`${label} ${width}px @${scale}x: the text scale applied`, false, `root ${s.rest.rootPx}px`); continue }
      measured += 1
      const heights = rows.map(r => r.height)
      const weekTops = rows.map(r => r.weekTop)
      const daysTops = rows.map(r => r.daysTop)
      const spread = a => Math.max(...a) - Math.min(...a)
      const dH = spread(heights), dW = spread(weekTops), dD = spread(daysTops)
      const d = Math.max(dH, dW, dD)
      if (d > worst.d) worst = Object.assign(worst, { d, at: `${label} ${width}px @${scale}x` })
      const ink = Math.max(...rows.map(r => r.inkOver))
      if (ink > inkWorst.over) inkWorst = { over: ink, at: `${label} ${width}px @${scale}x (${rows.find(r => r.inkOver === ink).inkWho})` }
      const pageOk = rows.every(r => r.scrollWidth <= r.innerWidth)
      const marks = s.hourly.hasMark && s.daily.hasMark && s.end.hasMark && !s.rest.hasMark && !s.cleared.hasMark
      const dailyOk = /FORECAST · DAILY/.test(s.daily.pickText) && /FORECAST · HOURLY/.test(s.hourly.pickText)
      if (dailyOk) sawDaily += 1
      const tideOk = tide === 'ok' ? /Tide −?\d+\.\d ft/.test(s.hourly.pickText) : /No tide in this plan/.test(s.hourly.pickText)
      const ok = d <= 0.5 && ink <= 0.5 && pageOk && marks && dailyOk && tideOk
      if (!ok) {
        failed += 1
        if (!first) first = `${width}px @${scale}x: dH ${dH.toFixed(2)} dWeek ${dW.toFixed(2)} dList ${dD.toFixed(2)} ink ${ink.toFixed(2)} page ${pageOk} marks ${marks} daily ${dailyOk} tide ${tideOk}`
      }
    }
    check(`${label} @${scale}x: every width measured`, measured === WIDTHS.length, `${measured}/${WIDTHS.length}`)
    check(`${label} @${scale}x: the readout, the divider and the list hold their place across rest, an hourly pick, a daily-tail pick, the window's end and a clear, the ink stays in the box, and the page never scrolls sideways`,
      failed === 0 && measured === WIDTHS.length, failed === 0 ? `${measured} widths ${WIDTHS[0]}-${WIDTHS[WIDTHS.length - 1]}` : `first: ${first}`)
    check(`${label} @${scale}x: the daily-tail pick really read a daily cell (non-vacuity)`, sawDaily === measured, `${sawDaily}/${measured}`)
  }
  console.log(`      worst movement: ${worst.d.toFixed(2)}px at ${worst.at || 'n/a'}; worst ink overflow: ${inkWorst.over.toFixed(2)}px at ${inkWorst.at || 'n/a'}`)
}

/** The guard-the-guard leg: neuter the sizer and expect the height to move. */
async function neutered(page, label) {
  await page.setViewportSize({ width: 390, height: 1400 })
  await settle(page)
  await page.addStyleTag({ content: '.sr-plan-ro-sizer { display: none !important; }' })
  const s = await states(page, 1)
  const moved = Math.abs(s.hourly.height - s.rest.height) > 0.5 || Math.abs(s.daily.weekTop - s.rest.weekTop) > 0.5
  check(`${label}: with the sizer neutered the readout MOVES on a pick (the instrument discriminates)`, moved,
    `rest ${s.rest.height.toFixed(2)} hourly ${s.hourly.height.toFixed(2)} week ${s.rest.weekTop.toFixed(2)} -> ${s.daily.weekTop.toFixed(2)}`)
}

/** The widths of the QA-32 finding: the legend gained a row when the chart
 *  chunk landed at 320, 360 and 390 (the 1.0.29 scroll hint) and at 414 to 430
 *  (the Sun height entry tipping the row), once per cold load. */
const LANDING_WIDTHS = [320, 360, 390, 414, 430]

/**
 * QA-32 at the PHONE tier: the legend's height, the readout's top, the
 * divider's top and the day list's top are identical BEFORE and AFTER the lazy
 * chart chunk lands. The chunk is held at the network (a Playwright route on
 * the PlanChart asset) while the fallback, the legend and the readout are
 * measured, then released; the second reading comes after the slider mounts
 * and the chart has reported whether the track fits. Measured on the pre-fix
 * build: the list dropped 22.5px at 390 and 27.5px at 320, because the
 * legend's scroll hint was `display: none` until the chart reported.
 */
async function chunkLanding(ctx, base, engine, scale) {
  let worst = 0
  let measured = 0
  let first = ''
  for (const width of LANDING_WIDTHS) {
    const page = await ctx.newPage()
    await page.setViewportSize({ width, height: 1400 })
    const held = []
    await page.route(/\/assets\/PlanChart-[^/]+\.js(\?.*)?$/, route => { held.push(route) })
    await page.goto(base)
    const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
    await page.getByRole('button', { name: 'Plan weather and tide for a place' }).waitFor({ timeout: 60_000 })
    if (await welcome.waitFor({ state: 'visible', timeout: 4000 }).then(() => true, () => false)) {
      await page.keyboard.press('Escape')
      await welcome.waitFor({ state: 'detached', timeout: 5000 })
    }
    await page.getByRole('button', { name: 'Plan weather and tide for a place' }).click()
    await page.getByLabel('Latitude (-90 to 90)').fill('36.603')
    await page.getByLabel('Longitude (-180 to 180)').fill('-121.876')
    await page.getByRole('button', { name: 'See all upcoming weather and tide data' }).click()
    await page.getByRole('region', { name: 'Weather and tide plan' }).waitFor({ timeout: 60_000 })
    await page.locator('.sr-plan-readout').waitFor({ timeout: 60_000 })
    // The chunk is still held: no slider yet, the Suspense fallback box is up.
    await page.evaluate((sc) => document.documentElement.style.setProperty('--sr-text-scale', String(sc)), scale)
    await settle(page)
    const before = await page.evaluate(() => {
      const r0 = document.querySelector('.sr-plan-result').getBoundingClientRect()
      const at = sel => document.querySelector(sel).getBoundingClientRect()
      return {
        slider: !!document.querySelector('.sr-plan-scroller'),
        legendH: at('.sr-plan-legend').height,
        readoutTop: at('.sr-plan-readout').top - r0.top,
        weekTop: at('.sr-plan-week').top - r0.top,
        daysTop: at('.sr-plan-days').top - r0.top,
        boxH: at('.sr-plan-chartbox').height,
      }
    })
    if (before.slider) { check(`${engine} ${width}px @${scale}x: the chunk was held before the first reading`, false, 'slider already mounted'); await page.close(); continue }
    for (const r of held) await r.continue()
    await page.unroute(/\/assets\/PlanChart-[^/]+\.js(\?.*)?$/)
    await page.locator('.sr-plan-scroller[role="slider"]').waitFor({ timeout: 60_000 })
    await settle(page)
    const after = await page.evaluate(() => {
      const r0 = document.querySelector('.sr-plan-result').getBoundingClientRect()
      const at = sel => document.querySelector(sel).getBoundingClientRect()
      const hint = document.querySelector('.sr-plan-legend-scroll')
      return {
        legendH: at('.sr-plan-legend').height,
        readoutTop: at('.sr-plan-readout').top - r0.top,
        weekTop: at('.sr-plan-week').top - r0.top,
        daysTop: at('.sr-plan-days').top - r0.top,
        boxH: at('.sr-plan-chartbox').height,
        hintVisible: !!hint && getComputedStyle(hint).visibility === 'visible' && getComputedStyle(hint).display !== 'none',
      }
    })
    measured += 1
    const d = Math.max(Math.abs(after.legendH - before.legendH), Math.abs(after.readoutTop - before.readoutTop), Math.abs(after.weekTop - before.weekTop), Math.abs(after.daysTop - before.daysTop), Math.abs(after.boxH - before.boxH))
    if (d > worst) worst = d
    if (d > 0.5 && !first) first = `${width}px: legend ${before.legendH.toFixed(1)} -> ${after.legendH.toFixed(1)}, list top ${before.daysTop.toFixed(1)} -> ${after.daysTop.toFixed(1)}, box ${before.boxH} -> ${after.boxH}`
    // Non-vacuity: at the phone tier the eight-day track never fits, so the
    // hint is VISIBLE once the chart has reported.
    if (!after.hintVisible) check(`${engine} ${width}px @${scale}x: the scroll hint is visible once the chart reports`, false)
    await page.close()
  }
  check(`${engine} @${scale}x: every landing width measured`, measured === LANDING_WIDTHS.length, `${measured}/${LANDING_WIDTHS.length}`)
  check(`${engine} @${scale}x: QA-32 the legend's height and the readout's, divider's and list's top edges are identical before and after the chart chunk lands (${LANDING_WIDTHS.join(', ')}px)`,
    worst <= 0.5 && measured === LANDING_WIDTHS.length, worst <= 0.5 ? `worst ${worst.toFixed(2)}px` : `first: ${first}`)
}

async function run(browserType, engine, base) {
  const browser = await browserType.launch()
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1400 } })
  const page = await ctx.newPage()
  for (const tide of ['ok', 'too-far']) {
    tideMode = tide
    await openPlan(page, base)
    const label = `${engine} ${tide === 'ok' ? 'with tide' : 'no tide'}`
    if (MODE === 'fixed') await sweep(page, label, tide)
    if (tide === 'ok') await neutered(page, `${engine}`)
  }
  await page.close()
  if (MODE === 'fixed') {
    tideMode = 'ok'
    for (const scale of [1, 2]) await chunkLanding(ctx, base, engine, scale)
  }
  await browser.close()
}

const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
console.log(`serving ${DIST} at ${base} (mode: expect-${MODE})`)
console.log(`${WIDTHS.length} widths from ${WIDTHS[0]} to ${WIDTHS[WIDTHS.length - 1]}px, text scale ${SCALES.map(s => `${s * 100}%`).join(' / ')}, two tide scenarios, both engines\n`)

try {
  for (const [browserType, engine] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    await run(browserType, engine, base)
    console.log('')
  }
} finally {
  await close()
}

console.log('')
if (MODE === 'fixed') {
  console.log(failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILURES: ${failures.join(' | ')}`)
  process.exit(failures.length === 0 ? 0 : 1)
} else {
  // In broken mode the ONLY checks are the neutered legs, which must PASS
  // (the instrument saw the movement); a harness that cannot see its own
  // mutation is vacuous.
  console.log(failures.length === 0 ? 'HARNESS DISCRIMINATES: the neutered readout moved in both engines' : `HARNESS IS VACUOUS: ${failures.join(' | ')}`)
  process.exit(failures.length === 0 ? 0 : 1)
}
