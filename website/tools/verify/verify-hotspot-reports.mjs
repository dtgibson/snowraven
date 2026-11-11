// HELD: lands at website/tools/verify/verify-hotspot-reports.mjs with the
// user's yes on website/ (everything committed under website/ is published).
//
// Real-engine verification for the Hotspot Reports tab (hotspot-reports QA-05,
// QA-68; schema 10.3 and 13.4; decisions.md D-07, D-08). jsdom has no layout,
// and `hotspotReportsCss.test.ts` is declaration-only by design, so the three
// geometric claims live here:
//
//   1. THE MORE SHEET holds every destination with nothing to scroll on the
//      reference phone (393x852, `.sr-ios-app`, a 34px bottom inset, text at
//      100%), and the cap it replaced, `min(70dvh, 528px)`, does not (so the leg
//      can reject a revert).
//   2. THE WIDER FORMS FIT ABOVE THEIR THRESHOLDS. The life list's wide row,
//      forced, has no text ink or control box past its grid cell or its card at
//      every width from just above the list threshold to 4em above it; the
//      two-column report, forced, likewise above the report threshold. Content
//      at the bounds: a 200-character name, five-digit counts, a 79-character
//      protocol, and eBird's longest unbreakable name tokens. The thresholds are
//      read from the BUILT stylesheet, never typed in here.
//   3. REAL WINDOWS: 641 to 1500px in 20px steps, text at 100% and 200%, a
//      classic 15px scrollbar and an overlay one, both engines: no ink past a
//      cell or card, no page scroll, and never two columns over a stacked list.
//
// It declares how many configurations it measured and fails on a short count
// (a denominator of nothing is the commonest way a geometric harness reports
// green). `--expect-broken` neuters both container queries (the wide row and
// two columns at every width) and must then FAIL leg 3, so the harness is shown
// able to see the defect it guards.
//
// HERMETIC: the dist is served with a stubbed backend; `/map`, `/taxonomy`,
// `/weather`, `/tide` and every other backend path answer 404, and every host
// but the served one is refused, so no eBird or tile request leaves the run.
//
//   node verify-hotspot-reports.mjs [dist] [--expect-broken]

import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveDist } from './serveDist.mjs'
import { requirePlaywright } from './playwright.mjs'
import { dismissWelcome } from './dismissWelcome.mjs'

const { chromium, webkit } = requirePlaywright()
const DIST = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) ?? process.env.SR_VERIFY_DIST
  ?? fileURLToPath(new URL('../../../frontend/dist/', import.meta.url)))
const MODE = process.argv.includes('--expect-broken') ? 'broken' : 'fixed'

// ── The synthetic backup ─────────────────────────────────────────────────────

const HEADER = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Latitude,Longitude,Date,Time,Protocol,Duration (Min),All Obs Reported,Distance Traveled (km),Area Covered (ha),Number of Observers,Breeding Code,Observation Details,Checklist Comments,ML Catalog Numbers'
const STRESS_NAME = 'Jamaica Bay Wildlife Refuge North Channel Bridge and the West Pond Loop Trail including the Terrapin Nesting Area, the Big John Pond Blind, the East Pond Overlook and the Raunt Boardwalk at high tide in late summer evenings'
const PROTOCOLS = ['Traveling', 'Traveling', 'Traveling', 'Stationary', 'Incidental', 'Area', 'Banding', 'Nocturnal Flight Call Count',
  'Heron Area Count', 'Oiled Birds', 'Pelagic', 'Historical', 'Random', 'Custom survey protocol for the refuge shorebird census with extra long label text']
const SPECIES = [['Northern Rough-winged Swallow', 'Stelgidopteryx serripennis'], ['Yellow-throated Laughingthrush', 'Garrulax galbanus'],
  ["MacGillivray's Warbler", 'Geothlypis tolmiei'], ['Superciliaried Hemispingus', 'Hemispingus superciliaris'], ['Black-crowned Night Heron', 'Nycticorax nycticorax']]
const q = s => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)

function backup() {
  const lines = [HEADER]
  const row = (sub, loc, name, st, county, lat, lng, date, proto, cn, sci) =>
    [sub, cn, sci, '1', '2', st, county, loc, name, lat, lng, date, '07:30 AM', proto, '60', '1', '1', '', '1', '', '', '', ''].map(q).join(',')
  // The stress location: 10,050 checklists, so every count is five digits.
  for (let k = 0; k < 10_050; k++) {
    const sub = `S95${String(k).padStart(8, '0')}`
    const date = `${2010 + (k % 16)}-${String(1 + (k % 12)).padStart(2, '0')}-${String(1 + (k % 28)).padStart(2, '0')}`
    lines.push(row(sub, 'L999000001', STRESS_NAME, 'US-NY', 'Queens', '40.6170', '-73.8250', date, PROTOCOLS[k % PROTOCOLS.length], SPECIES[0][0], SPECIES[0][1]))
    if (k < SPECIES.length) lines.push(row(sub, 'L999000001', STRESS_NAME, 'US-NY', 'Queens', '40.6170', '-73.8250', date, PROTOCOLS[k % PROTOCOLS.length], SPECIES[k][0], SPECIES[k][1]))
  }
  // A few ordinary locations, so the overview ranks more than one.
  for (let l = 0; l < 6; l++) {
    for (let c = 0; c < 5 + l; c++) lines.push(row(`S96${String(l * 100 + c).padStart(8, '0')}`, `L10${l}`, `Demo place ${l}`, l % 2 ? 'US-NJ' : 'US-NY', 'Kings', '40.66', '-73.97', '2024-05-0' + (1 + (c % 9)), 'Traveling', 'Song Sparrow', 'Melospiza melodia'))
  }
  return lines.join('\n') + '\n'
}
const CSV = backup()
const FILES_STATUS = { ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T00:00:00Z' }, ml: null }

function stubBackend(p, _req, res) {
  if (p === '/settings/files') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(FILES_STATUS)); return true }
  if (p === '/settings/files/ebird') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(CSV); return true }
  if (p === '/settings/keys') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ebird: null, openweather: null })); return true }
  if (p.startsWith('/settings/') || p.startsWith('/weather') || p.startsWith('/tide') || p.startsWith('/map')
      || p.startsWith('/taxonomy') || p.startsWith('/checklists') || p.startsWith('/version')) { res.writeHead(404); res.end('not found'); return true }
  return false
}

// ── The built thresholds, read from the stylesheet the dist ships ───────────

async function thresholds() {
  const html = await readFile(join(DIST, 'index.html'), 'utf8')
  const cssFiles = [...html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)].map(m => m[1])
  let css = ''
  for (const f of cssFiles) css += await readFile(join(DIST, f), 'utf8')
  // The minifier writes `(max-width: Nem)` as the range form `(width<=Nem)`.
  const report = /@container sr-hsr-report \((?:max-width:\s*|width\s*<=\s*)([\d.]+)em\)/.exec(css)
  const list = /@container sr-hsr-ll \((?:max-width:\s*|width\s*<=\s*)([\d.]+)em\)/.exec(css)
  if (!report || !list) throw new Error('the built stylesheet carries no Hotspot Reports container thresholds')
  return { report: Number(report[1]), list: Number(list[1]) }
}

// ── Measurement ─────────────────────────────────────────────────────────────

const failures = []
let measured = 0
/** The windows leg's OWN count, checked by equality: the total above also counts
 *  legs 1 and 2, so a windows leg that fell short could hide behind them. */
let windowsMeasured = 0
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

const FORCE_WIDE_LIST = '.sr-hsr-ll-cols { display: grid !important; } .sr-hsr-ll-row { grid-template-columns: 2.5rem minmax(0, 1fr) 5.6rem 1.5rem 5.25rem !important; grid-template-areas: "num name date link on" !important; column-gap: 14px !important; } .sr-hsr-ll-meta { display: contents !important; } .sr-hsr-ll-date, .sr-hsr-ll-on-fig { white-space: nowrap !important; } .sr-hsr-ll-on { display: flex !important; } .sr-hsr-ll-words { display: none !important; } .sr-hsr-ll-bar { display: block !important; } .sr-hsr-ll-cl, .sr-hsr-ll-dash { width: 1.5rem !important; height: 1.5rem !important; }'
const FORCE_TWO_COL = '.sr-hsr-body { grid-template-columns: minmax(0, 1fr) minmax(0, 24rem) !important; } .sr-hsr-jump { display: none !important; }'

/** Worst text ink or control box past its grid cell or its card (px). */
const OVERHANG = () => {
  const root = document.querySelector('.sr-hsr-report')
  const ROWS = ['sr-hsr-ll-row', 'sr-hsr-ll-meta', 'sr-hsr-ll-cols', 'sr-wx-row', 'sr-hsr-fact', 'sr-hsr-rankrow']
  const cellOf = el => {
    for (let e = el; e && e !== root; e = e.parentElement) {
      const p = e.parentElement
      if (p && ROWS.some(c => p.classList.contains(c)) && getComputedStyle(e).display !== 'contents') return e
    }
    return null
  }
  let worst = 0
  const range = document.createRange()
  const check = (el, r, isBox) => {
    for (let e = el; e && e !== root; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.overflowX === 'hidden' && cs.textOverflow === 'ellipsis') return
    }
    const cell = cellOf(el)
    for (const box of [cell && !(isBox && cell === el) ? cell : null, el.closest('.sr-hsr-card') ?? root]) {
      if (!box) continue
      const cs = getComputedStyle(box), b = box.getBoundingClientRect()
      worst = Math.max(worst, b.left + parseFloat(cs.borderLeftWidth) - r.left, r.right - (b.right - parseFloat(cs.borderRightWidth)))
    }
  }
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!n.textContent.trim() || el.closest('.sr-only, .sr-hsr-map')) continue
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) if (r.width > 0) check(el, r, false)
  }
  for (const el of root.querySelectorAll('a, button, svg, .sr-wx-track, .sr-hsr-ll-bar')) {
    if (el.closest('.sr-only, .sr-hsr-map')) continue
    const r = el.getBoundingClientRect()
    if (r.width > 0) check(el, r, true)
  }
  return +worst.toFixed(2)
}

async function open(browser, base, viewport, { scale = 1, bar = 'overlay', inject = '' } = {}) {
  const ctx = await browser.newContext({ viewport })
  await ctx.route('**/*', route => (new URL(route.request().url()).origin === base ? route.continue() : route.abort()))
  const page = await ctx.newPage()
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
  if (await welcome.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) await dismissWelcome(welcome)
  await page.addStyleTag({ content: bar === 'classic'
    ? '::-webkit-scrollbar { width: 15px; height: 15px; } ::-webkit-scrollbar-thumb { background: #888; }'
    : '::-webkit-scrollbar { width: 0; height: 0; }' })
  if (inject) await page.addStyleTag({ content: inject })
  await page.evaluate(s => document.documentElement.style.setProperty('--sr-text-scale', String(s)), scale)
  await page.waitForFunction(s => Math.abs(parseFloat(getComputedStyle(document.documentElement).fontSize) - 16 * s) < 0.01, scale)
  return { ctx, page }
}

async function openStress(page) {
  const tab = page.locator('[role="tab"]', { hasText: 'Hotspot Reports' })
  if (await tab.count()) await tab.first().click()
  else {
    await page.locator('.sr-navbar button[aria-haspopup="dialog"]').click()
    await page.locator('[role="dialog"] .sr-nav-item', { hasText: 'Hotspot Reports' }).first().click()
  }
  const input = page.locator('input.sr-hsr-input')
  await input.click()
  await input.fill('north channel')
  await page.waitForSelector('.sr-hsr-opt')
  await input.press('Enter')
  await page.waitForSelector('.sr-hsr-report .sr-hsr-ll-row')
  await page.evaluate(() => document.activeElement?.blur())
}

const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))

const t = await thresholds()
console.log(`built thresholds: report ${t.report}em, list ${t.list}em (mode: expect-${MODE})`)
const NEUTER = MODE === 'broken' ? `${FORCE_WIDE_LIST} ${FORCE_TWO_COL}` : ''
const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
const WIDTHS = []
for (let w = 641; w <= 1500; w += 20) WIDTHS.push(w)
const EXPECTED_WINDOWS = 2 * 2 * 2 * WIDTHS.length
let windowFailures = 0

try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch(name === 'chromium' ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {})
    try {
      if (MODE === 'fixed') {
        // ── 1. The More sheet ────────────────────────────────────────────────
        for (const cap of [null, 'min(70dvh, 528px)']) {
          const { ctx, page } = await open(browser, base, { width: 393, height: 852 })
          await page.evaluate(() => {
            document.documentElement.classList.add('sr-ios-app')
            const s = document.createElement('style')
            s.textContent = '.sr-ios-app .sr-nav-sheet { padding-bottom: calc(14px + 34px) !important; }'
            document.head.appendChild(s)
          })
          await page.locator('.sr-navbar button[aria-haspopup="dialog"]').click()
          await page.waitForSelector('[role="dialog"] .sr-nav-sheet-body .sr-nav-item')
          await page.waitForTimeout(500)
          const r = await page.evaluate(cap => {
            const sheet = document.querySelector('.sr-nav-sheet')
            if (cap) sheet.style.maxHeight = cap
            const body = sheet.querySelector('.sr-nav-sheet-body')
            const rows = body.querySelectorAll('.sr-nav-item')
            return { scroll: body.scrollHeight, client: body.clientHeight, rows: rows.length, ios: document.documentElement.classList.contains('sr-ios-app'),
              lastInside: rows[rows.length - 1].getBoundingClientRect().bottom <= body.getBoundingClientRect().bottom + 0.5 }
          }, cap)
          measured++
          if (cap === null) check(`${name} More sheet holds every destination without scrolling`, r.ios && r.scroll === r.client && r.lastInside, `${r.rows} rows, ${r.scroll}/${r.client}`)
          else check(`${name} the replaced cap is seen to scroll (the leg can reject a revert)`, r.scroll > r.client, `${r.scroll}/${r.client}`)
          await ctx.close()
        }
        // ── 2. The wider forms fit above their thresholds ───────────────────
        for (const scale of [1, 1.5, 2]) {
          const { ctx, page } = await open(browser, base, { width: 1600, height: 1000 }, { scale })
          await openStress(page)
          const em = 16 * scale
          let worstList = 0, worstReport = 0
          for (let w = t.list + 0.25; w <= t.list + 4; w += 0.25) {
            await page.addStyleTag({ content: `${FORCE_WIDE_LIST} .sr-hsr-body { grid-template-columns: minmax(0, 1fr) !important; } .sr-hsr-report { width: ${w * em + 2}px !important; max-width: none !important; }` })
            await settle(page)
            worstList = Math.max(worstList, await page.evaluate(OVERHANG)); measured++
          }
          for (let w = t.report + 0.25; w <= t.report + 4; w += 0.25) {
            await page.addStyleTag({ content: `${FORCE_TWO_COL} .sr-hsr-report { width: ${w * em}px !important; max-width: none !important; }` })
            await settle(page)
            worstReport = Math.max(worstReport, await page.evaluate(OVERHANG)); measured++
          }
          check(`${name} ${scale * 100}% the wide life-list row fits above ${t.list}em`, worstList <= 0.5, `worst ${worstList}px`)
          check(`${name} ${scale * 100}% two columns fit above ${t.report}em`, worstReport <= 0.5, `worst ${worstReport}px`)
          // Guard-the-guard: the detector sees a wide row forced far too narrow.
          await page.addStyleTag({ content: `${FORCE_WIDE_LIST} .sr-hsr-report { width: ${12 * em}px !important; }` })
          await settle(page)
          const guard = await page.evaluate(OVERHANG)
          check(`${name} ${scale * 100}% the detector sees a forced overflow`, guard > 50, `${guard}px`)
          await ctx.close()
        }
      }
      // ── 3. Real windows ────────────────────────────────────────────────────
      for (const bar of ['classic', 'overlay']) {
        for (const scale of [1, 2]) {
          const { ctx, page } = await open(browser, base, { width: 1500, height: 900 }, { scale, bar, inject: NEUTER })
          await openStress(page)
          for (const w of WIDTHS) {
            await page.setViewportSize({ width: w, height: 900 })
            await settle(page)
            const r = await page.evaluate(OVERHANG)
            const shape = await page.evaluate(() => ({
              two: getComputedStyle(document.querySelector('.sr-hsr-body')).gridTemplateColumns.split(' ').length === 2,
              stacked: getComputedStyle(document.querySelector('.sr-hsr-ll-cols')).display === 'none',
              pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            }))
            measured++
            windowsMeasured++
            const bad = r > 0.5 || shape.pageOver > 0 || (shape.two && shape.stacked)
            if (bad) {
              windowFailures++
              if (MODE === 'fixed') check(`${name} ${bar} ${scale * 100}% ${w}px`, false, `ink ${r}px, page ${shape.pageOver}px, two over stacked ${shape.two && shape.stacked}`)
            }
          }
          await ctx.close()
        }
      }
    } finally {
      await browser.close()
    }
  }
} finally {
  await close()
}

if (MODE === 'fixed') {
  check(`windows leg measured every configuration`, windowsMeasured === EXPECTED_WINDOWS, `${windowsMeasured} of ${EXPECTED_WINDOWS} window configurations measured`)
  // The denominator is what was measured, never what was declared: a short leg
  // is the check above's failure, and this line must not read as if it covered more.
  check('no window configuration failed', windowFailures === 0, `${windowFailures} of the ${windowsMeasured} measured`)
  console.log(`${measured} configurations measured (${windowsMeasured} of them windows); ${failures.length ? 'FAILED' : 'all green'}`)
  process.exit(failures.length ? 1 : 0)
} else {
  // A short windows leg cannot certify the harness either way.
  const full = windowsMeasured === EXPECTED_WINDOWS
  const sees = windowFailures > 0 && full
  console.log(`expect-broken: ${windowFailures} of the ${windowsMeasured} window configurations measured (${EXPECTED_WINDOWS} declared) fail with both container queries neutered`)
  console.log(sees ? 'HARNESS DISCRIMINATES'
    : !full ? `HARNESS CANNOT CERTIFY: the windows leg measured ${windowsMeasured} of ${EXPECTED_WINDOWS}`
      : 'HARNESS IS BLIND: no failure with the queries neutered')
  process.exit(sees ? 0 : 1)
}
