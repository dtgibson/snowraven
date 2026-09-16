// Real-engine verification of the Weather/tide Planner's day labels
// (plan-daylabel-overlap): every day label stays inside its own day column and
// never prints over its neighbour's, at every phone width and both in-app text
// scales, swept across first-day widths from one hour to a full day -- and the
// WIDE tier's labels keep doing the same thing they always did.
//
// WHY A BROWSER. The claim is "these two pieces of text do not overlap", which
// is a fact about glyph advance widths in a system font stack at a given date
// format. jsdom lays nothing out; `planCss.test.ts` is declaration-only and its
// own header says so; `planPhoneRender.golden.html` pins markup, not geometry.
// The defect this guards was 80.66px of overlap in a build whose every unit
// test was green.
//
// THE ONE TRAP THIS HARNESS IS BUILT AROUND. `Range.getClientRects()` IS BLIND
// TO AN ANCESTOR'S OVERFLOW CLIP. A first pass over raw ink reported the wide
// tier's working `.sr-plan-dayhdr-day { overflow: hidden }` as 6.70px of
// overlap -- it would have certified the SHIPPED wide tier as broken, and it
// reported the phone tier as equally broken before and after a clip was added,
// because the rects it returns are the text's unclipped layout boxes. So every
// ink rect here is INTERSECTED with the content box of each clipping ancestor
// (`inkOf` below), and the walk starts at the element itself, because the
// phone label now clips its own text against its own `max-width`.
//
// The walk STOPS at the first scrollable ancestor (`.sr-plan-scroller`,
// `overflow-x: auto`) and never treats it as a clip. That is not a detail: the
// chart is a wide track inside a narrow scroller under an `overflow: hidden`
// chart box, so counting the scrollport as a clip would silently answer "are
// these labels both on screen right now" instead of "do they overlap", and
// every label scrolled out of view would read as clean. False negatives, at
// exactly the widths the sweep exists to cover.
//
// THE SWEEP DECLARES ITS DENOMINATOR: `measured === expected` per leg, and a
// configuration whose text scale did not apply is a failure rather than a
// clean reading. Two more non-vacuity legs ride along, because "no overlap" is
// what an empty lane also reads as: some label must be EMITTED at every
// configuration, and the whole band must contain at least one configuration
// where the density ladder actually dropped or shortened a label.
//
// GUARD THE GUARD (`--expect-broken`). Two mutations, and the second is the one
// that matters. (1) The phone label's bound is removed. (2) The WIDE tier's
// clip is removed. Both must be SEEN. Mutation 2 is what proves the
// intersection logic discriminates rather than being blind to clipping in the
// convenient direction -- paired with the clean wide-tier leg, which reads 0
// visible overlap on the same nodes with the clip live, it pins the instrument
// from both sides. Per the v1.0.30 rule, neither mutation's signal may depend
// on font metrics: both replace every label's text with a 40-character run
// first, so the overlap they produce is hundreds of px under any font stack,
// not the ~17px a particular system stack happens to give.
//
//   node website/tools/verify/verify-plan-daylabels.mjs [distDir] [--expect-broken]

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
const BASE_WEATHER = REF.expectedWeather.plan
const TIDE_HALF = REF.expectedTide
const TZ = BASE_WEATHER.tz

/** The gutter holding the sticky tide scale, re-derived here rather than read
 *  out of the build: the harness's reference points must not come from the
 *  thing it is verifying. Mirrors PLAN_GUTTER_PX in lib/planChartGeometry.ts. */
const GUTTER_PX = 40
/** The phone tier's constant pixels per hour, re-derived (PLAN_HOUR_PX). It is
 *  what turns a target column width into a first-day width in hours. */
const PLAN_HOUR_PX = 16
/** The label's inset from its column's left edge (PLAN_DAY_LABEL_INSET_PX),
 *  re-derived here like the gutter and the ladder. This is a design constant
 *  restated, NOT a value read back off the build: the harness still computes
 *  the column from the midnight hairlines and subtracts the inset itself, so
 *  it can disagree with a build that gets the arithmetic wrong. */
const LABEL_INSET_PX = 5
/** The density ladder's thresholds, likewise re-derived (planDayLabel). */
const LADDER = [[84, 'full'], [44, 'short'], [22, 'weekday']]

const localOf = (ts) => {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(ts * 1000)).reduce((a, x) => (a[x.type] = x.value, a), {})
  return `${p.year}-${p.month}-${p.day} ${p.hour === '24' ? '00' : p.hour}:${p.minute}`
}

/**
 * The plan document with its first day narrowed to `hours`.
 *
 * `composePlan` TRUSTS `window.axisStartTs`, so moving it is what pins the
 * trigger to the plan rather than to the wall clock -- the defect appears when
 * a plan is FETCHED late in the day, and nothing else about the document needs
 * to change to reproduce it. `startTs` (the "Now" hairline) is clamped inside
 * the axis so a marker drawn off the left edge can never enter a reading.
 */
function weatherFor(hours) {
  const axisStartTs = BASE_WEATHER.days[1].startTs - Math.round(hours * 3600)
  const startTs = Math.max(BASE_WEATHER.window.startTs, axisStartTs + 60)
  return {
    ...BASE_WEATHER,
    fetchedAt: Math.max(BASE_WEATHER.fetchedAt, axisStartTs + 60),
    window: {
      ...BASE_WEATHER.window,
      axisStartTs, axisStartLocal: localOf(axisStartTs),
      startTs, startLocal: localOf(startTs),
    },
  }
}

/** Which document the stub is serving; the harness flips it between loads. */
let firstDayHours = 9

function stubBackend(p, _req, res) {
  const json = (body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); return true }
  if (p === '/settings/files') return json({ ebird: null, ml: null })
  if (p === '/settings/keys') return json({ ebird: null, openweather: null })
  if (p === '/weather/plan') return json(weatherFor(firstDayHours))
  if (p === '/tide/plan') return json(TIDE_HALF)
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

const settle = (page) => page.evaluate(() => new Promise(done => {
  requestAnimationFrame(() => requestAnimationFrame(() => done()))
}))

/**
 * One reading, in the page.
 *
 * Everything is CANVAS-RELATIVE, never viewport-relative: the track scrolls,
 * and a raw `getBoundingClientRect()` comparison across two readings at
 * different scroll positions makes every element look moved (the v0.5.85
 * rule). Returns, per day: the column's own box, the label's text, and the
 * label's RAW ink and its VISIBLE ink -- raw intersected with every clipping
 * ancestor's content box, stopping at the scrollport.
 */
const PROBE = ({ scale, gutter }) => {
  document.documentElement.style.setProperty('--sr-text-scale', String(scale))
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const canvas = document.querySelector('.sr-plan-canvas')
  const lane = document.querySelector('.sr-plan-axislane')
  if (!canvas || !lane) return { ok: false, why: 'the chart canvas is not on screen', rootPx }
  const c0 = canvas.getBoundingClientRect()

  // The clipping ancestors of `el`, as content boxes. Starts AT the element
  // (the phone label clips its own text) and stops at the first scrollable
  // ancestor, which is a viewport, not a clip.
  const clipsFor = (el) => {
    const out = []
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p)
      const ox = cs.overflowX, oy = cs.overflowY
      if (ox === 'auto' || ox === 'scroll' || oy === 'auto' || oy === 'scroll') break
      if (ox === 'hidden' || ox === 'clip' || oy === 'hidden' || oy === 'clip') {
        const r = p.getBoundingClientRect()
        out.push({
          left: r.left + (parseFloat(cs.borderLeftWidth) || 0),
          right: r.right - (parseFloat(cs.borderRightWidth) || 0),
          top: r.top + (parseFloat(cs.borderTopWidth) || 0),
          bottom: r.bottom - (parseFloat(cs.borderBottomWidth) || 0),
        })
      }
    }
    return out
  }

  const grow = (a, b) => (a ? {
    left: Math.min(a.left, b.left), right: Math.max(a.right, b.right),
    top: Math.min(a.top, b.top), bottom: Math.max(a.bottom, b.bottom),
  } : { left: b.left, right: b.right, top: b.top, bottom: b.bottom })

  // Text INK, not the element box: once a box is allowed to shrink to its
  // line, an unbreakable run simply ink-overflows it and the box cannot see
  // that (the v0.5.85 rule). A range covers the node's non-whitespace span
  // only, because a trailing space is a glyph box with no ink in it.
  const inkOf = (el) => {
    const clips = clipsFor(el)
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    const lineTops = new Set()
    let raw = null, vis = null
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent
      const s = t.length - t.trimStart().length
      const e = t.trimEnd().length
      if (e <= s) continue
      const range = document.createRange()
      range.setStart(n, s)
      range.setEnd(n, e)
      for (const rc of range.getClientRects()) {
        if (rc.width <= 0 || rc.height <= 0) continue
        lineTops.add(Math.round(rc.top))
        raw = grow(raw, rc)
        let v = { left: rc.left, right: rc.right, top: rc.top, bottom: rc.bottom }
        for (const cl of clips) {
          v = {
            left: Math.max(v.left, cl.left), right: Math.min(v.right, cl.right),
            top: Math.max(v.top, cl.top), bottom: Math.min(v.bottom, cl.bottom),
          }
        }
        if (v.right - v.left <= 0.01 || v.bottom - v.top <= 0.01) continue
        vis = grow(vis, v)
      }
    }
    const rel = (r) => r && { left: r.left - c0.left, right: r.right - c0.left, top: r.top - c0.top, bottom: r.bottom - c0.top }
    return {
      raw: rel(raw), vis: rel(vis), lines: lineTops.size,
      clippedX: raw && vis ? (raw.right - raw.left) - (vis.right - vis.left) : (raw ? raw.right - raw.left : 0),
      clippedY: raw && vis ? (raw.bottom - raw.top) - (vis.bottom - vis.top) : (raw ? raw.bottom - raw.top : 0),
    }
  }

  // The tier decides which lane owns the labels: the phone tier draws them in
  // the axis lane, the wide tier in its own day-header lane.
  const wide = !!document.querySelector('.sr-plan-dayhdr')
  const cols = [...lane.querySelectorAll('.sr-plan-axisday')].map(el => {
    const r = el.getBoundingClientRect()
    return { left: r.left - c0.left, right: r.right - c0.left, width: r.width }
  })
  const labelEls = wide
    ? [...document.querySelectorAll('.sr-plan-dayhdr-lbl')]
    : [...lane.querySelectorAll('.sr-plan-daylabel')]
  // The width this label actually GETS, which is not its rendered width: an
  // untruncated label renders narrower than its bound, so `clientWidth` would
  // read "Fri" as a 14px budget and fire on every short weekday. The bound is
  // the element's own `max-width` (the phone tier) and every clipping
  // ancestor's right edge measured from the label's left (the wide tier's day
  // div). The smallest of those is what the label has to live in.
  const availOf = (el) => {
    const boxLeft = el.getBoundingClientRect().left
    const mw = parseFloat(getComputedStyle(el).maxWidth)
    let avail = Number.isFinite(mw) ? mw : Infinity
    for (const cl of clipsFor(el.parentElement)) avail = Math.min(avail, cl.right - boxLeft)
    return avail
  }

  const labels = labelEls.map(el => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return {
      text: el.textContent ?? '', left: r.left - c0.left, right: r.right - c0.left, ink: inkOf(el),
      availW: availOf(el),
      // The declarations this fix RESTS on, read off the element. Without this
      // the sweep is blind to the stylesheet rule going missing: a label that
      // loses `position: absolute` and `white-space: nowrap` wraps inside its
      // own column and reads as perfectly non-overlapping. Measured, not
      // hypothetical -- a malformed comment swallowed this rule during the
      // build and the whole 168-configuration sweep stayed green over it.
      cs: { position: cs.position, whiteSpace: cs.whiteSpace, overflowX: cs.overflowX, textOverflow: cs.textOverflow, maxWidth: cs.maxWidth },
    }
  })
  const ticks = [...document.querySelectorAll('.sr-plan-ticktext')].map(el => inkOf(el))

  // The column widths the LADDER should have been applied to, derived from the
  // MIDNIGHT HAIRLINES of whichever lane owns the labels -- never from the day
  // divs' own boxes.
  //
  // This is the harness's own version of the trap it was written for, and it
  // was measured rather than reasoned about. Deriving these from
  // `.sr-plan-axisday` read every column as 0 on a PRE-FIX build, because
  // giving that div a width is part of the fix: the probe then reported the
  // SHIPPED wide tier as emitting seven full labels into columns of `(none)`
  // -- a confident false failure against correct code, from a reference point
  // derived from the thing being verified. The hairlines are absolutely
  // positioned at each day's own left edge and are present, unchanged, on both
  // builds and both tiers. The first day has no hairline (its midnight is off
  // the left of the axis), so the axis start -- the gutter -- opens the list,
  // and the canvas's right edge closes it.
  const labelLane = wide ? document.querySelector('.sr-plan-dayhdr') : lane
  const hairlines = [...labelLane.querySelectorAll('.sr-plan-midnight')]
    .map(el => el.getBoundingClientRect().left - c0.left)
    .filter(x => x > gutter + 0.5)
    .sort((a, b) => a - b)
  const edges = [gutter, ...hairlines, c0.width]
  const dayWs = edges.slice(1).map((right, i) => right - edges[i])

  return {
    ok: true, rootPx, wide,
    canvasW: c0.width, cols, labels, ticks, dayWs,
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }
}

/** The form a piece of label text is in, by SHAPE rather than by string
 *  equality, so the check owns no copy of the app's date formatting. */
function formOf(text) {
  const t = text.trim()
  if (!t) return 'none'
  if (/\d{4}/.test(t)) return 'full'
  if (/\d/.test(t)) return 'short'
  return 'weekday'
}
const expectedForm = (dayW) => (LADDER.find(([px]) => dayW >= px) ?? [0, 'none'])[1]
/** The width the ladder demands before it will emit a given form. */
const THRESHOLD = Object.fromEntries(LADDER.map(([px, form]) => [form, px]))

async function openPlan(page, base) {
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
  await page.locator('.sr-plan-scroller[role="slider"]').waitFor({ timeout: 60_000 })
}

/**
 * Judge one reading. Returns null when it is clean, else the first complaint.
 *
 * The overlap is measured between ADJACENT labels' VISIBLE ink, in document
 * order, which is the reading a person actually gets. Everything else here is
 * the set of ways "no overlap" could be true and the lane still be wrong:
 * ink outside the canvas, a label clipped vertically (a descender eaten by its
 * own bound), an hour tick clipped by the new column width, or a label in a
 * form the density ladder does not allow at that column's width.
 */
function judge(r, gutter) {
  const shown = r.labels.filter(l => l.ink.vis)
  for (let i = 1; i < shown.length; i += 1) {
    const over = shown[i - 1].ink.vis.right - shown[i].ink.vis.left
    if (over > 0.5) return `overlap ${over.toFixed(2)}px between "${shown[i - 1].text}" and "${shown[i].text}"`
  }
  for (const l of shown) {
    if (l.ink.vis.right > r.canvasW + 0.5) return `"${l.text}" ink runs ${(l.ink.vis.right - r.canvasW).toFixed(2)}px past the canvas`
    if (l.ink.vis.left < -0.5) return `"${l.text}" ink starts ${l.ink.vis.left.toFixed(2)}px left of the canvas`
    if (l.ink.clippedY > 0.5) return `"${l.text}" is clipped vertically by ${l.ink.clippedY.toFixed(2)}px`
    // A wrapped label does not overlap its neighbour either, so the overlap
    // check alone cannot tell a bounded label from a broken one.
    if (l.ink.lines !== 1) return `"${l.text}" wrapped onto ${l.ink.lines} lines`
    // LEGIBILITY. A form may only be emitted if it still fits the width the
    // BOUND leaves it. Shape classification alone cannot see this: a `Wed`
    // squeezed into 17px and painted `W..` is still shaped like the weekday
    // form and passed the form check happily. Comparing the width the label
    // actually got against the width its own form is chosen at is the ladder's
    // own promise, checked where it is kept or broken -- and it is
    // font-independent, which a pixel budget or a "retains N characters" rule
    // would not be.
    const form = formOf(l.text)
    const need = THRESHOLD[form]
    if (need !== undefined && l.availW + 0.5 < need - LABEL_INSET_PX) {
      return `"${l.text}" is the ${form} form, admitted at a ${need}px column, but it was left only ${l.availW.toFixed(2)}px`
        + ` -- below the ${need - LABEL_INSET_PX}px that column guarantees after the inset, so the bound and the ladder are out of step`
    }
    if (l.cs.position !== 'absolute') return `"${l.text}" is ${l.cs.position}, not absolutely positioned -- its stylesheet rule is not live`
    if (l.cs.whiteSpace !== 'nowrap') return `"${l.text}" has white-space ${l.cs.whiteSpace} -- its stylesheet rule is not live`
    if (!r.wide) {
      if (l.cs.overflowX !== 'hidden') return `"${l.text}" has overflow-x ${l.cs.overflowX} -- the phone label's own clip is not live`
      // Pinned as a deliberate choice rather than left to drift: an ellipsis
      // on a three-character weekday spends its budget on the glyph and
      // renders `W..`, so the phone tier plain-clips exactly as the wide tier
      // always has. `clip` is the initial value, so this asserts the absence.
      if (l.cs.textOverflow !== 'clip') return `"${l.text}" has text-overflow ${l.cs.textOverflow} -- the phone tier must plain-clip, matching the wide tier`
      if (l.cs.maxWidth === 'none') return `"${l.text}" carries no max-width -- the per-column bound is not live`
    }
  }
  for (const t of r.ticks) {
    if (t.clippedX > 0.5 || t.clippedY > 0.5) return `an hour tick is clipped (${t.clippedX.toFixed(2)}x ${t.clippedY.toFixed(2)}y)`
  }
  // The ladder, re-derived: the emitted form must be the one the column's own
  // width allows. `cols` and `labels` are different lists once a label is
  // dropped, so the forms are compared as a multiset against the widths.
  // Against the COLUMN, which is what the ladder is asked about.
  const want = r.dayWs.map(expectedForm).filter(f => f !== 'none').sort()
  const got = r.labels.map(l => formOf(l.text)).filter(f => f !== 'none').sort()
  if (want.join(',') !== got.join(',')) return `label forms ${got.join('/') || '(none)'} but the columns (${r.dayWs.map(w => w.toFixed(0)).join('/')}) allow ${want.join('/') || '(none)'}`
  if (r.scrollWidth > r.innerWidth) return `the page scrolls sideways (${r.scrollWidth} > ${r.innerWidth})`
  if (shown.length === 0) return 'no label carried any visible ink (the reading is vacuous)'
  return null
}

/** The phone band. The defect is independent of viewport width (the track is a
 *  fixed-px scroller), so these widths are a control on that claim rather than
 *  the axis the defect lives on; 640 is the last width still on the tier. */
const PHONE_WIDTHS = [320, 360, 390, 414, 430, 640]
const WIDE_WIDTHS = [700, 900, 1200, 1440]
const SCALES = [1, 2]
/** First-day widths, in hours: the whole band the overlap lived in (it starts
 *  under ~6.04h and grows linearly to 11 PM), its boundary, and out the far
 *  side to a full day. 5.25h is the 84px column -- the one the density ladder
 *  calls full while the label is wider than the column, which is the band the
 *  per-column bound exists for. */
const PHONE_HOURS = [1, 2, 3, 4, 5, 5.25, 5.5, 6, 6.35, 7, 9, 12, 18, 24]
const WIDE_HOURS = [1, 5.25, 5.5, 6.75, 9, 11, 12.25, 21, 22.75, 24]

/**
 * The band sweep: first-day widths chosen so `dayW` lands ON and just ABOVE
 * each of the ladder's own thresholds, where a form is emitted into the
 * narrowest column that form is ever allowed.
 *
 * `PHONE_HOURS` above steps `dayW` 16 -> 32 in one jump and so passes straight
 * over the whole [22, 29.08) band where the weekday form is emitted into a
 * column too narrow to hold it. That is not a gap in the widths chosen, it is
 * a gap in what the sweep was sampling ALONG: the defect lives in `dayW`, and
 * a sweep indexed by viewport width cannot find it however many widths it
 * tries. Sampled at two widths rather than six because the brief measured this
 * axis independent of viewport (the track is a fixed-px scroller), and the
 * coarse sweep above holds that control.
 */
/** Spans each threshold from BELOW, not just at and above it. The first cut
 *  started at 22 and so could never see a label dropped, which made this
 *  sweep's own non-vacuity check unsatisfiable -- it reported `0 dropped` as a
 *  failure against a perfectly good build. Starting under the weekday
 *  threshold both fixes that and tests the boundary where a label stops being
 *  emitted at all, which is the one transition the coarse sweep also reaches. */
const BAND_DAYW = [18, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 44, 45, 46, 47, 48, 49, 50, 84, 85, 86, 87, 88, 89, 90, 92]
const BAND_HOURS = BAND_DAYW.map(w => w / PLAN_HOUR_PX)
const BAND_WIDTHS = [320, 390]

const TIERS = {
  phone: { hours: PHONE_HOURS, widths: PHONE_WIDTHS, wide: false },
  band: { hours: BAND_HOURS, widths: BAND_WIDTHS, wide: false },
  wide: { hours: WIDE_HOURS, widths: WIDE_WIDTHS, wide: true },
}

async function sweep(page, base, engine, tier) {
  const { hours, widths, wide: wantWide } = TIERS[tier]
  const expected = hours.length * widths.length * SCALES.length
  let measured = 0, failed = 0, first = ''
  let worstOverlap = { px: -Infinity, at: '' }
  let worstClip = { px: 0, at: '', text: '', retained: 1 }
  let sawShortened = 0, sawDropped = 0
  for (const h of hours) {
    firstDayHours = h
    await page.setViewportSize({ width: widths[0], height: 1400 })
    await openPlan(page, base)
    for (const width of widths) {
      for (const scale of SCALES) {
        await page.setViewportSize({ width, height: 1400 })
        await settle(page)
        const r = await page.evaluate(PROBE, { scale, gutter: GUTTER_PX })
        const at = `${engine} ${tier} ${h}h @${width}px/${scale}x`
        if (!r.ok) { check(`${at}: the chart is on screen`, false, r.why); continue }
        if (Math.abs(r.rootPx - 16 * scale) > 0.5) { check(`${at}: the text scale applied`, false, `root ${r.rootPx}px`); continue }
        if (r.wide !== wantWide) { check(`${at}: the expected tier is live`, false, `wide=${r.wide}`); continue }
        measured += 1
        const shown = r.labels.filter(l => l.ink.vis)
        for (let i = 1; i < shown.length; i += 1) {
          const over = shown[i - 1].ink.vis.right - shown[i].ink.vis.left
          if (over > worstOverlap.px) worstOverlap = { px: over, at }
        }
        if (r.labels.some(l => formOf(l.text) !== 'full')) sawShortened += 1
        if (r.labels.length < r.cols.length) sawDropped += 1
        // How much a form admitted at its threshold actually loses to the
        // bound. Reported, never asserted: the amount is a property of the
        // font stack, and a numeric floor here would fail on CI's Linux fonts
        // while passing on this Mac (the v1.0.30 rule).
        for (const l of shown) {
          if (l.ink.clippedX > worstClip.px) {
            const rawW = l.ink.raw.right - l.ink.raw.left
            worstClip = { px: l.ink.clippedX, at, text: l.text, retained: rawW > 0 ? (rawW - l.ink.clippedX) / rawW : 1 }
          }
        }
        const why = judge(r, GUTTER_PX)
        if (why) { failed += 1; if (!first) first = `${at}: ${why}` }
      }
    }
  }
  check(`${engine} ${tier}: every configuration measured`, measured === expected, `${measured}/${expected}`)
  check(`${engine} ${tier}: every day label stays inside its own column and never prints over its neighbour, the hour ticks stay unclipped, and the emitted form is the one the column's width allows`,
    failed === 0 && measured === expected, failed === 0 ? `worst adjacent gap ${(-worstOverlap.px).toFixed(2)}px of clearance` : `first: ${first}`)
  // Non-vacuity: a lane that never shortens or drops anything would pass the
  // overlap check by never being asked the question.
  check(`${engine} ${tier}: the density ladder really engaged somewhere in the band`, sawShortened > 0 && sawDropped > 0,
    `${sawShortened} configurations shortened a label, ${sawDropped} dropped one`)
  console.log(`      worst clip: ${worstClip.px.toFixed(2)}px off "${worstClip.text || 'nothing'}"`
    + `${worstClip.at ? ` at ${worstClip.at}` : ''} (retains ${(worstClip.retained * 100).toFixed(1)}% of its ink)`)
}

/**
 * The guard-the-guard legs.
 *
 * Mutation 1 removes the phone label's bound; mutation 2 removes the WIDE
 * tier's shipped clip. Both are measured with every label's text replaced by a
 * 40-character run first, so the overlap produced is hundreds of px under any
 * font stack rather than the ~17px a particular system stack gives -- the
 * v1.0.30 rule that a mutation's signal must be larger than anything the
 * hardware can move. Mutation 2 is the one that pins the intersection logic:
 * with the clip live the SAME hostile text must read clean, so the two halves
 * together prove the probe can tell clipped ink from unclipped ink rather than
 * being blind to clipping in whichever direction flatters the build.
 */
async function neutered(page, base, engine) {
  const HOSTILE = 'M'.repeat(40)
  const paint = () => {
    for (const el of document.querySelectorAll('.sr-plan-daylabel, .sr-plan-dayhdr-lbl')) el.textContent = 'M'.repeat(40)
  }
  const worstOverlap = (r) => {
    const shown = r.labels.filter(l => l.ink.vis)
    let w = -Infinity
    for (let i = 1; i < shown.length; i += 1) w = Math.max(w, shown[i - 1].ink.vis.right - shown[i].ink.vis.left)
    return w
  }

  // ── phone: the bound removed must be SEEN
  firstDayHours = 5.25
  await page.setViewportSize({ width: 390, height: 1400 })
  await openPlan(page, base)
  await page.evaluate(paint)
  await settle(page)
  const phoneHeld = await page.evaluate(PROBE, { scale: 1, gutter: GUTTER_PX })
  await page.addStyleTag({ content: '.sr-plan-daylabel { max-width: none !important; overflow: visible !important; }' })
  await page.evaluate(paint)
  await settle(page)
  const phoneLoose = await page.evaluate(PROBE, { scale: 1, gutter: GUTTER_PX })
  check(`${engine}: with the phone label's bound removed the probe SEES the overlap (the instrument discriminates)`,
    worstOverlap(phoneLoose) > 5, `bound live ${worstOverlap(phoneHeld).toFixed(2)}px, bound removed ${worstOverlap(phoneLoose).toFixed(2)}px, text ${HOSTILE.length} chars`)
  check(`${engine}: the phone bound holds that same hostile text clean`, worstOverlap(phoneHeld) <= 0.5,
    `${worstOverlap(phoneHeld).toFixed(2)}px`)

  // ── wide: the shipped clip removed must be SEEN, and kept must read clean.
  // This is the leg that catches an ink probe blind to ancestor clipping: a
  // raw-rects probe reads these two as identical.
  firstDayHours = 9
  await page.setViewportSize({ width: 700, height: 1400 })
  await openPlan(page, base)
  await page.evaluate(paint)
  await settle(page)
  const wideHeld = await page.evaluate(PROBE, { scale: 1, gutter: GUTTER_PX })
  await page.addStyleTag({ content: '.sr-plan-dayhdr-day { overflow: visible !important; }' })
  await page.evaluate(paint)
  await settle(page)
  const wideLoose = await page.evaluate(PROBE, { scale: 1, gutter: GUTTER_PX })
  check(`${engine}: with the WIDE tier's clip removed the probe SEES the overlap`,
    worstOverlap(wideLoose) > 5, `clip live ${worstOverlap(wideHeld).toFixed(2)}px, clip removed ${worstOverlap(wideLoose).toFixed(2)}px`)
  check(`${engine}: with the WIDE tier's clip live the same hostile text reads CLEAN (the probe is not blind to clipping)`,
    worstOverlap(wideHeld) <= 0.5, `${worstOverlap(wideHeld).toFixed(2)}px`)

  // ── the ellipsis regression, which is NOT an overlap signal at all.
  //
  // The geometry is identical with and without `text-overflow`, and that is
  // exactly why it needs its own leg: an ellipsis spends its budget on its own
  // glyph, so the same 17px that plain-clips `Sat` to a legible `Sa` renders
  // `S...` -- one character, and in Chromium the ellipsis is itself clipped to
  // two dots. A sweep that classifies label forms by SHAPE cannot see it,
  // because `S...` is still spelled `Sat` in the DOM. This pins the
  // declaration check that refuses it, at a column width inside the band where
  // the clip actually bites.
  firstDayHours = 22 / PLAN_HOUR_PX
  await page.setViewportSize({ width: 390, height: 1400 })
  await openPlan(page, base)
  await settle(page)
  const clipped = judge(await page.evaluate(PROBE, { scale: 1, gutter: GUTTER_PX }), GUTTER_PX)
  await page.addStyleTag({ content: '.sr-plan-daylabel { text-overflow: ellipsis !important; }' })
  await settle(page)
  const ellipsised = judge(await page.evaluate(PROBE, { scale: 1, gutter: GUTTER_PX }), GUTTER_PX)
  check(`${engine}: the label plain-clips, and forcing text-overflow: ellipsis is REFUSED (the \`W..\` regression)`,
    clipped === null && ellipsised !== null && /text-overflow/.test(ellipsised),
    `plain-clipped: ${clipped ?? 'clean'} | ellipsised: ${ellipsised ?? 'NOT CAUGHT'}`)

  // ── the legibility invariant, and what it can and cannot be.
  //
  // "The chosen form always fits its bound" is NOT the invariant and asserting
  // it would be false: the ladder is one threshold per form while each form
  // spans a range of widths (weekday 14.28 to 24.08 in the shipped stack), so
  // a form admitted at its threshold can be a little wider than its room and
  // is plain-clipped -- `Wed` to `We`, exactly as the wide tier has always
  // done. What MUST hold is that the bound is never tighter than the ladder's
  // own promise: a form admitted at a T px column is left at least T - inset.
  // That is what `judge` checks, and this leg starves the bound past it so the
  // check is proven capable of failing rather than assumed to be.
  firstDayHours = 44 / PLAN_HOUR_PX
  await page.setViewportSize({ width: 390, height: 1400 })
  await openPlan(page, base)
  await settle(page)
  const sound = judge(await page.evaluate(PROBE, { scale: 1, gutter: GUTTER_PX }), GUTTER_PX)
  await page.addStyleTag({ content: '.sr-plan-daylabel { max-width: 12px !important; }' })
  await settle(page)
  const starved = judge(await page.evaluate(PROBE, { scale: 1, gutter: GUTTER_PX }), GUTTER_PX)
  check(`${engine}: a bound tighter than the ladder's promise is REFUSED (the legibility invariant)`,
    sound === null && starved !== null && /out of step/.test(starved),
    `sound: ${sound ?? 'clean'} | starved: ${starved ?? 'NOT CAUGHT'}`)
}

async function run(browserType, engine, base) {
  const browser = await browserType.launch()
  const page = await browser.newPage()
  if (MODE === 'fixed') {
    await sweep(page, base, engine, 'phone')
    await sweep(page, base, engine, 'band')
    await sweep(page, base, engine, 'wide')
  }
  await neutered(page, base, engine)
  await browser.close()
}

const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
console.log(`serving ${DIST} at ${base} (mode: expect-${MODE})`)
console.log(`${PHONE_HOURS.length} first-day widths x ${PHONE_WIDTHS.length} phone widths x ${SCALES.length} text scales, `
  + `a ${BAND_HOURS.length}-step band sweep across the ladder's own thresholds at ${BAND_WIDTHS.length} widths, `
  + `${WIDE_HOURS.length} x ${WIDE_WIDTHS.length} x ${SCALES.length} on the wide tier, both engines\n`)

try {
  for (const [browserType, engine] of [[chromium, 'chromium'], [webkit, 'webkit']]) {
    await run(browserType, engine, base)
    console.log('')
  }
} finally {
  await close()
}

if (MODE === 'fixed') {
  console.log(failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILURES: ${failures.join(' | ')}`)
  process.exit(failures.length === 0 ? 0 : 1)
} else {
  console.log(failures.length === 0 ? 'HARNESS DISCRIMINATES: both mutations were seen, and neither clip was mistaken for overlap' : `HARNESS IS VACUOUS: ${failures.join(' | ')}`)
  process.exit(failures.length === 0 ? 0 : 1)
}
