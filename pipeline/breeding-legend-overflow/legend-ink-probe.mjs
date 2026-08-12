#!/usr/bin/env node
// Geometric verification for breeding-legend-overflow.
//
// A GENUINE BUILD A/B. Both halves are real artifacts, never simulated by toggling
// a class on the live page: the stylesheet is the built `dist/assets/index-*.css`
// from each revision, and the DOM is the card `outerHTML` the real component
// renders at that revision (dumped through jsdom, so nothing is retyped into a
// fixture). Toggling a class would exercise only the DOM half of the change and
// could not tell a defect this build introduced from one that was already there.
//
// MEASURES TEXT INK, NOT ELEMENT BOXES. Two of the five mutations in the design
// leave a box measurement reading a clean zero while text hangs 22px and 81px
// outside it: once a box may shrink to the line, an unbreakable run simply
// ink-overflows it and getBoundingClientRect() on the element cannot see that. So
// every text node is measured through a Range's client rects against the legend's
// CONTENT box. Both figures are reported side by side, because the divergence
// between them is itself the finding.
//
// Usage:
//   node pipeline/breeding-legend-overflow/legend-ink-probe.mjs <fixtureDir>
// where fixtureDir holds before.css / after.css and dom-before/ dom-after/.
import { chromium } from '/Users/developer/devwork/snowraven/website/tools/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const DIR = process.argv[2]
if (!DIR) { console.error('usage: legend-ink-probe.mjs <fixtureDir>'); process.exit(1) }

const WIDTHS = [320, 360, 390, 430, 480, 560, 640, 768, 1024, 1440]
const SCALES = [1, 1.25, 1.5, 2]
const VIEWS = ['normal', 'wide']
const SETS = ['all23', 'demo13']

/** The app's real chrome around the card: .sr-panel with 24px side padding. */
const page = (css, cardHtml, scale) => `<!doctype html><html style="--sr-text-scale:${scale}">
<head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="sr-panel" style="padding:40px 24px 24px"><div style="display:flex;flex-direction:column;gap:0">${cardHtml}</div></div></body></html>`

const measure = () => {
  const legend = document.querySelector('.sr-bc-legend')
  const cs = getComputedStyle(legend)
  const r = legend.getBoundingClientRect()
  const px = v => parseFloat(v) || 0
  const contentLeft = r.left + px(cs.borderLeftWidth) + px(cs.paddingLeft)
  const contentRight = r.right - px(cs.borderRightWidth) - px(cs.paddingRight)

  // --- ink: every text node, via Range client rects ---
  let inkPast = 0, inkPastViewport = 0, worst = null
  const walker = document.createTreeWalker(legend, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim()) continue
    const range = document.createRange()
    range.selectNodeContents(n)
    for (const rect of range.getClientRects()) {
      if (rect.width === 0) continue
      const past = rect.right - contentRight
      if (past > inkPast) { inkPast = past; worst = n.parentElement?.textContent?.trim().slice(0, 40) ?? '' }
      inkPastViewport = Math.max(inkPastViewport, rect.right - document.documentElement.clientWidth)
    }
    range.detach?.()
  }

  // --- box: the proxy that certifies a half-fixed build as clean ---
  let boxPast = 0
  for (const el of legend.querySelectorAll('*')) {
    const b = el.getBoundingClientRect()
    if (b.width === 0) continue
    boxPast = Math.max(boxPast, b.right - contentRight)
  }

  // --- the guarantee: no flex line holds a wrapped chip beside another chip ---
  let sharedLineWithWrapped = 0, wrappedChips = 0, chipsSeen = 0
  for (const row of legend.querySelectorAll('.sr-bc-legend-tier, .sr-bc-legend > div')) {
    const chips = [...row.querySelectorAll(':scope > div > span > span')]
      .filter(s => s.childElementCount > 0) // a chip holds the bold <span> code
    chipsSeen += chips.length
    const lines = new Map()
    for (const chip of chips) {
      const b = chip.getBoundingClientRect()
      const key = Math.round(b.top * 2) / 2
      lines.set(key, [...(lines.get(key) ?? []), chip])
    }
    for (const [, group] of lines) {
      for (const chip of group) {
        // A chip is a FLEX ITEM, so it is blockified and getClientRects() on the
        // element returns exactly one border-box rect however many lines its text
        // takes — which made the first cut of this check structurally unable to
        // see a wrap and report a vacuous zero. Count LINE BOXES through a Range
        // over the chip's contents instead.
        const range = document.createRange()
        range.selectNodeContents(chip)
        const tops = new Set([...range.getClientRects()].filter(x => x.width > 0).map(x => Math.round(x.top)))
        range.detach?.()
        if (tops.size > 1) {
          wrappedChips++
          if (group.length > 1) sharedLineWithWrapped++
        }
      }
    }
  }

  return {
    inkPast: Math.round(inkPast * 100) / 100,
    boxPast: Math.round(boxPast * 100) / 100,
    inkPastViewport: Math.round(inkPastViewport * 100) / 100,
    scrollWidth: document.documentElement.scrollWidth,
    legendWidth: Math.round((contentRight - contentLeft) * 100) / 100,
    wrappedChips, sharedLineWithWrapped, chipsSeen, worst,
  }
}

const browser = await chromium.launch()
const ctx = await browser.newContext()
const p = await ctx.newPage()
const rows = []
for (const build of ['before', 'after']) {
  const css = readFileSync(`${DIR}/${build}.css`, 'utf8')
  for (const set of SETS) for (const view of VIEWS) {
    const card = readFileSync(`${DIR}/dom-${build}/card-${set}-${view === 'wide' ? 'wide' : 'normal'}.html`, 'utf8')
    for (const w of WIDTHS) for (const s of SCALES) {
      await p.setViewportSize({ width: w, height: 900 })
      await p.setContent(page(css, card, s), { waitUntil: 'load' })
      const m = await p.evaluate(measure)
      rows.push({ build, set, view, w, s, ...m })
    }
  }
}
await browser.close()

// ── harness sanity, before any flagged number is trusted ─────────────────────
const at = (b, set, view, w, s) => rows.find(r => r.build === b && r.set === set && r.view === view && r.w === w && r.s === s)
console.log('HARNESS SANITY')
console.log(`  legend content box, 320px/1x  : ${at('before', 'all23', 'normal', 320, 1).legendWidth}px  (brief measured 238)`)
console.log(`  known-clean desktop 1440/1x   : before ink ${at('before', 'all23', 'normal', 1440, 1).inkPast}, after ink ${at('after', 'all23', 'normal', 1440, 1).inkPast}`)
console.log(`  reproduces brief baseline 13 codes 320/2x : ${at('before', 'demo13', 'normal', 320, 2).inkPast}  (brief 64.17)`)
console.log(`  reproduces design baseline 23 codes 320/2x: ${at('before', 'all23', 'normal', 320, 2).inkPast}  (design 81.08)`)
console.log(`  scrollWidth at 320/2x before  : ${at('before', 'all23', 'normal', 320, 2).scrollWidth}  (the proxy that under-reports)`)

const leaks = rows.filter(r => r.inkPast > 0.01)
console.log(`\nINK PAST THE LEGEND'S CONTENT BOX  (${leaks.length} leaking configurations of ${rows.length})`)
console.log('build   set     view    width  scale |   ink |   box | past vp | label')
for (const r of leaks) {
  console.log(`${r.build.padEnd(7)} ${r.set.padEnd(7)} ${r.view.padEnd(7)} ${String(r.w).padStart(5)}  ${String(r.s).padEnd(5)} | ${String(r.inkPast).padStart(5)} | ${String(r.boxPast).padStart(5)} | ${String(r.inkPastViewport).padStart(7)} | ${r.worst ?? ''}`)
}

const afterLeaks = leaks.filter(r => r.build === 'after')
console.log(`\nAFTER-BUILD LEAKS: ${afterLeaks.length} (must be 0)`)

// The Unbounded view must be byte-identical across builds.
let moved = 0
for (const r of rows.filter(x => x.build === 'before' && x.view === 'wide')) {
  const a = at('after', r.set, 'wide', r.w, r.s)
  if (a.inkPast !== r.inkPast || a.boxPast !== r.boxPast || a.legendWidth !== r.legendWidth) {
    moved++
    console.log(`  UNBOUNDED MOVED: ${r.set} ${r.w}/${r.s}  ink ${r.inkPast}->${a.inkPast}  box ${r.boxPast}->${a.boxPast}  legend ${r.legendWidth}->${a.legendWidth}`)
  }
}
console.log(`UNBOUNDED CONFIGURATIONS THAT MOVED: ${moved} of ${rows.filter(x => x.build === 'before' && x.view === 'wide').length} (must be 0)`)

// Normal configurations that measured clean before must be untouched.
let normalMoved = 0, normalFixed = 0
for (const r of rows.filter(x => x.build === 'before' && x.view === 'normal')) {
  const a = at('after', r.set, 'normal', r.w, r.s)
  if (r.inkPast > 0.01) { if (a.inkPast <= 0.01) normalFixed++ }
  else if (a.legendWidth !== r.legendWidth || a.inkPast !== r.inkPast || a.boxPast !== r.boxPast) {
    normalMoved++
    console.log(`  CLEAN NORMAL MOVED: ${r.set} ${r.w}/${r.s}  ink ${r.inkPast}->${a.inkPast}  box ${r.boxPast}->${a.boxPast}`)
  }
}
console.log(`NORMAL: ${normalFixed} leaking configurations fixed, ${normalMoved} previously-clean configurations moved (must be 0)`)

const sharedBad = rows.filter(r => r.build === 'after' && r.sharedLineWithWrapped > 0)
const wrapped = rows.filter(r => r.build === 'after' && r.wrappedChips > 0)
// NON-VACUITY, per partition. The first cut of this check enumerated chips with a
// selector that matched, then asked getClientRects() of a FLEX ITEM how many lines
// its text took — which is structurally always one — and reported a confident zero
// shared lines while seeing no wraps at all. Both halves must be shown to be live:
// chips must be found, AND some configuration must actually wrap one.
const noChips = rows.filter(r => r.chipsSeen === 0)
console.log(`\nFLEX-LINE GUARANTEE`)
console.log(`  configurations where NO chip was enumerated: ${noChips.length} (must be 0, or this check is vacuous)`)
console.log(`  configurations that wrap at least one chip : ${wrapped.length} (must be > 0, or nothing is being tested)`)
console.log(`  worst-case wrapped chips (23 codes 320/2x) : ${at('after', 'all23', 'normal', 320, 2).wrappedChips} of 23  (design measured 11)`)
console.log(`  wrapped chip sharing a flex line           : ${sharedBad.length} (must be 0)`)
const ok = afterLeaks.length === 0 && moved === 0 && normalMoved === 0 && sharedBad.length === 0 && noChips.length === 0 && wrapped.length > 0
console.log(`\n${ok ? 'PASS' : 'FAIL'}`)
process.exit(ok ? 0 : 1)
