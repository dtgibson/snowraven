// Real-engine verification for the Hotspot Reports tab (hotspot-reports QA-05,
// QA-68; schema 10.3 and 13.4; decisions.md D-07, D-08; hotspot-report-order-
// and-stats decisions.md D-08 and D-09). jsdom has no layout, and
// `hotspotReportsCss.test.ts` is declaration-only by design, so the geometric
// claims live here:
//
//   1. THE MORE SHEET holds every destination with nothing to scroll on the
//      reference phone (393x852, `.sr-ios-app`, a 34px bottom inset, text at
//      100%), and the cap it replaced, `min(70dvh, 528px)`, does not (so the leg
//      can reject a revert).
//   2. THE WIDER FORMS FIT ABOVE THEIR THRESHOLDS. The life list's wide row,
//      forced, has no text ink or control box past any grid cell it sits in or
//      its card at every width from just above the list threshold to 4em above
//      it; the two-column report (the rail first, the list second), forced,
//      likewise above the report threshold. Then the At a glance card's own
//      self-collapsing grids, swept in 2px steps across each place a track
//      appears: no ink past a cell, every tile label on one line wherever the
//      tiles are two or more across, and every fact's term and value side by
//      side wherever the facts are two across. Content at the bounds: a
//      200-character name, five-digit counts, a 79-character protocol, and
//      eBird's longest unbreakable name tokens. The thresholds are read from the
//      BUILT stylesheet, never typed in here.
//   3. REAL WINDOWS: 641 to 1500px at the four shipped text scales, a classic
//      15px scrollbar and an overlay one, both engines, with the coupled pair's
//      flip read to 2px at 100% and 125% (the only scales whose report can
//      reach 53.25em under the 1280px panel): no ink past a cell or card, no
//      page scroll, never two columns over a stacked list, the jump row shown
//      exactly while one column, and the sections' screen order equal to their
//      DOM order (header, At a glance, the rail top to bottom, the life list
//      last).
//   4. PHONES: 320 to 640px at the four shipped text scales, for the stress place
//      and for a place with one species: the same ink, page and order checks,
//      the jump row's chips equal to the sections after it, and the card body
//      and track counts the design's thresholds were drawn against.
//
// Lines starting `MEASURE` are the readings recorded in the run's evidence. It
// declares how many configurations it measured and fails on a short count (a
// denominator of nothing is the commonest way a geometric harness reports
// green). `--expect-broken` neuters both container queries (the wide row and
// two columns at every width) and must then FAIL leg 3, and forces the glance
// grids wide and the rail after the list on a phone, which must FAIL leg 4, so
// the harness is shown able to see each defect it guards.
//
// HERMETIC: the dist is served with a stubbed backend; `/map`, `/taxonomy`,
// `/weather`, `/tide` and every other backend path answer 404, and every host
// but the served one is refused, so no eBird or tile request leaves the run.
// Both are counted, and an eBird-backed path other than the shared hotspot
// lookup the tab already reuses fails the run.
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
// The fifth is the stress place's NEWEST species and the first its oldest, so
// At a glance's two species rows carry the longest unbreakable tokens.
const SPECIES = [['Northern Rough-winged Swallow', 'Stelgidopteryx serripennis'], ['Black-crowned Night Heron', 'Nycticorax nycticorax'],
  ["MacGillivray's Warbler", 'Geothlypis tolmiei'], ['Superciliaried Hemispingus', 'Hemispingus superciliaris'], ['Yellow-throated Laughingthrush', 'Garrulax galbanus']]
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

/** Requests to an eBird-backed path that reached the stub: the run fails on any. */
const ebirdBacked = []
function stubBackend(p, _req, res) {
  if (p === '/settings/files') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(FILES_STATUS)); return true }
  if (p === '/settings/files/ebird') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(CSV); return true }
  if (p === '/settings/keys') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ebird: null, openweather: null })); return true }
  // With no key saved, nothing here may ask eBird; the stub answers as a keyless
  // backend would and records the path so the run can fail on it.
  if (p.startsWith('/map') || p.startsWith('/checklists')) ebirdBacked.push(p)
  if (p.startsWith('/settings/') || p.startsWith('/weather') || p.startsWith('/tide') || p.startsWith('/map')
      || p.startsWith('/taxonomy') || p.startsWith('/checklists') || p.startsWith('/version')) { res.writeHead(404); res.end('not found'); return true }
  return false
}
/** Requests to any other host, refused in the browser and counted. */
let refusedHosts = 0

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
// The two columns as built: the 24rem rail first, the life list second.
const FORCE_TWO_COL = '.sr-hsr-body { grid-template-columns: minmax(0, 24rem) minmax(0, 1fr) !important; } .sr-hsr-jump { display: none !important; }'
// --expect-broken, phones: the glance grids held wide and the rail moved after
// the list on screen only, which the ink and the order checks must each see.
const NEUTER_PHONE = '.sr-hsr-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)) !important; } .sr-hsr-facts { grid-template-columns: repeat(2, 8rem) !important; } .sr-hsr-rail { order: 2; }'

/** Worst text ink or control box past ANY grid cell it sits in, or its card
 *  (px), within `rootSel` (the report, or one card of it). A cell is a box
 *  whose parent is one of the row or grid classes below; every such ancestor
 *  is checked, not only the innermost, so a value cell inside a fact row
 *  inside the facts grid is held to both (ui.md v1.0.71: per grid cell). */
const OVERHANG = ({ root: rootSel }) => {
  const root = document.querySelector(rootSel)
  const ROWS = ['sr-hsr-ll-row', 'sr-hsr-ll-meta', 'sr-hsr-ll-cols', 'sr-wx-row', 'sr-hsr-fact', 'sr-hsr-rankrow',
    'sr-hsr-tiles', 'sr-hsr-tile', 'sr-hsr-facts', 'sr-hsr-fact-sp', 'sr-hsr-toprow', 'sr-hsr-top-main']
  const cellsOf = el => {
    const out = []
    for (let e = el; e && e !== root; e = e.parentElement) {
      const p = e.parentElement
      if (p && ROWS.some(c => p.classList.contains(c)) && getComputedStyle(e).display !== 'contents') out.push(e)
    }
    return out
  }
  let worst = 0
  const range = document.createRange()
  const check = (el, r, isBox) => {
    for (let e = el; e && e !== root; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.overflowX === 'hidden' && cs.textOverflow === 'ellipsis') return
    }
    const boxes = cellsOf(el).filter(c => !(isBox && c === el))
    boxes.push(el.closest('.sr-hsr-card') ?? root)
    for (const box of boxes) {
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
  return { worst: +worst.toFixed(2) }
}
const ink = async (page, root) => page.evaluate(OVERHANG, { root })

/** The report's shape: columns, the order the sections are SEEN in against
 *  their DOM order, the jump row's chips against the sections after it, and the
 *  At a glance card's grids (body width, track counts, label lines, and whether
 *  each fact's term and value share a line). */
const SHAPE = () => {
  const report = document.querySelector('.sr-hsr-report')
  const body = report.querySelector('.sr-hsr-body')
  const two = getComputedStyle(body).gridTemplateColumns.split(' ').length === 2
  const stacked = getComputedStyle(report.querySelector('.sr-hsr-ll-cols') ?? document.body).display === 'none'
  // Every top-level part of the report in DOM order, the header and the cards.
  const parts = [...report.querySelectorAll('.sr-hsr-hero, section.sr-hsr-card')]
    .map(el => ({ name: el.matches('.sr-hsr-hero') ? 'header' : el.querySelector('h4').textContent, r: el.getBoundingClientRect() }))
  // Seen order: by column (left edge to the px), then top.
  const seen = [...parts].sort((a, b) => Math.round(a.r.left) - Math.round(b.r.left) || a.r.top - b.r.top)
  const orderOk = seen.every((p, i) => p.name === parts[i].name) && parts[parts.length - 1].name === 'Life list'
  const jump = report.querySelector('.sr-hsr-jump')
  const jumpShown = jump.getBoundingClientRect().height > 0
  const chips = [...jump.querySelectorAll('a')].map(a => a.getAttribute('href').slice(1))
  const after = [...report.querySelectorAll('section.sr-hsr-card h4')].filter(h => jump.compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING).map(h => h.id)
  const chipsOk = chips.length === after.length && chips.every((c, i) => c === after[i])
  const glance = report.querySelector('.sr-hsr-glance')
  const tiles = glance.querySelector('.sr-hsr-tiles')
  const facts = glance.querySelector('.sr-hsr-facts')
  // Tracks with width: auto-fit lists a collapsed empty track as 0px.
  const tracks = el => (el ? getComputedStyle(el).gridTemplateColumns.split(' ').filter(v => parseFloat(v) > 0).length : 0)
  const lines = el => {
    const rg = document.createRange(); rg.selectNodeContents(el)
    return new Set([...rg.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size
  }
  const labelLines = tiles ? Math.max(...[...tiles.querySelectorAll('dt')].map(lines)) : 0
  const sideBySide = [...facts.querySelectorAll('.sr-hsr-fact')].every(f => {
    const dt = f.querySelector('dt').getBoundingClientRect(), dd = f.querySelector('dd').getBoundingClientRect()
    return Math.abs(dd.top - dt.top) < 1 && dd.left >= dt.right - 0.5
  })
  return {
    two, stacked, orderOk, seen: seen.map(p => p.name), jumpShown, chipsOk,
    pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    glanceBody: +glance.getBoundingClientRect().width.toFixed(2),
    tileCols: tracks(tiles), factCols: tracks(facts), labelLines, sideBySide,
  }
}

async function open(browser, base, viewport, { scale = 1, bar = 'overlay', inject = '' } = {}) {
  const ctx = await browser.newContext({ viewport })
  await ctx.route('**/*', route => {
    if (new URL(route.request().url()).origin === base) return route.continue()
    refusedHosts++
    return route.abort()
  })
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

async function openTab(page) {
  const tab = page.locator('[role="tab"]', { hasText: 'Hotspot Reports' })
  if (await tab.count()) await tab.first().click()
  else {
    await page.locator('.sr-navbar button[aria-haspopup="dialog"]').click()
    await page.locator('[role="dialog"] .sr-nav-item', { hasText: 'Hotspot Reports' }).first().click()
  }
}

/** Choose a place by typing `query` and pressing Enter, and wait for ITS report. */
async function openPlace(page, query, heading) {
  const input = page.locator('input.sr-hsr-input')
  await input.click()
  await input.fill(query)
  await page.waitForSelector('.sr-hsr-opt')
  await input.press('Enter')
  await page.waitForFunction(h => document.querySelector('.sr-hsr-name')?.textContent.startsWith(h) && document.querySelector('.sr-hsr-report .sr-hsr-ll-row'), heading)
  await page.evaluate(() => document.activeElement?.blur())
}

async function openStress(page) {
  await openTab(page)
  await openPlace(page, 'north channel', STRESS_NAME.slice(0, 40))
}

const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))

const t = await thresholds()
console.log(`built thresholds: report ${t.report}em, list ${t.list}em (mode: expect-${MODE})`)
const NEUTER = MODE === 'broken' ? `${FORCE_WIDE_LIST} ${FORCE_TWO_COL}` : ''
const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
const started = Date.now()
// The four text scales the app ships (lib/textScale.ts TEXT_SCALES).
const SCALES = [1, 1.25, 1.5, 2]
// Windows: 641 to 1500px, every 20px where two columns can appear and every
// 40px where they cannot. The panel is capped at 1280px, so the report is at
// most 1232px wide and reaches 53.25em only up to about 144% text: at 150% and
// 200% it is one column at every window width, and at 100% and 125% the leg
// also sweeps the 20px below the first two-column width in 2px steps, so the
// width at which the coupled pair flips is read to 2px in both scrollbars.
const FLIP_SCALES = [1, 1.25]
const windowWidths = scale => {
  const out = []
  for (let w = 641; w <= 1500; w += FLIP_SCALES.includes(scale) ? 20 : 40) out.push(w)
  return out
}
const FINE = 11
const EXPECTED_WINDOWS = 2 * 2 * (SCALES.reduce((n, sc) => n + windowWidths(sc).length, 0) + FLIP_SCALES.length * FINE)
let windowFailures = 0
const PHONE_WIDTHS = [320, 340, 360, 375, 390, 414, 430, 480, 540, 600, 640]
const PHONE_SCALES = SCALES
/** The stress place, then a place holding one species on five dated checklists. */
const PHONE_PLACES = [['north channel', STRESS_NAME.slice(0, 40)], ['Demo place 0', 'Demo place 0']]
const EXPECTED_PHONES = 2 * PHONE_SCALES.length * PHONE_PLACES.length * PHONE_WIDTHS.length
let phonesMeasured = 0
let phoneFailures = 0

/** The At a glance card's body width (px) at which `n` tile tracks, or two fact
 *  tracks, first fit: the track minimum times n plus the gaps between. */
const tileStart = (n, em) => n * 8 * em + (n - 1) * 16
const factStart = em => 2 * 19 * em + 36

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
        for (const scale of SCALES) {
          const { ctx, page } = await open(browser, base, { width: 1600, height: 1000 }, { scale })
          await openStress(page)
          const em = 16 * scale
          let worstList = 0, worstReport = 0
          for (let w = t.list + 0.25; w <= t.list + 4; w += 0.25) {
            await page.addStyleTag({ content: `${FORCE_WIDE_LIST} .sr-hsr-body { grid-template-columns: minmax(0, 1fr) !important; } .sr-hsr-report { width: ${w * em + 2}px !important; max-width: none !important; }` })
            await settle(page)
            worstList = Math.max(worstList, (await ink(page, '.sr-hsr-report')).worst); measured++
          }
          for (let w = t.report + 0.25; w <= t.report + 4; w += 0.25) {
            await page.addStyleTag({ content: `${FORCE_TWO_COL} .sr-hsr-report { width: ${w * em}px !important; max-width: none !important; }` })
            await settle(page)
            worstReport = Math.max(worstReport, (await ink(page, '.sr-hsr-report')).worst); measured++
          }
          check(`${name} ${scale * 100}% the wide life-list row fits above ${t.list}em`, worstList <= 0.5, `worst ${worstList}px`)
          check(`${name} ${scale * 100}% two columns fit above ${t.report}em`, worstReport <= 0.5, `worst ${worstReport}px`)
          // The At a glance grids, swept in 2px steps across each place a track
          // appears. The card body is the report less the card's 2px border and
          // the body's 36px of side padding (the desktop tier at this viewport).
          await page.addStyleTag({ content: '.sr-hsr-body { grid-template-columns: minmax(0, 1fr) !important; }' })
          let worstGlance = 0, labelBad = 0, sideBad = 0
          const firstAt = {}
          const targets = [[2, tileStart(2, em)], [3, tileStart(3, em)], [4, tileStart(4, em)], [5, tileStart(5, em)], ['facts', factStart(em)]]
          for (const [key, at] of targets) {
            for (let body = Math.round(at) - 24; body <= Math.round(at) + 24; body += 2) {
              await page.addStyleTag({ content: `.sr-hsr-report { width: ${body + 38}px !important; max-width: none !important; }` })
              await settle(page)
              const gi = (await ink(page, '.sr-hsr-glance')).worst
              const sh = await page.evaluate(SHAPE)
              measured++
              worstGlance = Math.max(worstGlance, gi)
              if (sh.tileCols >= 2 && sh.labelLines !== 1) labelBad++
              if (sh.factCols === 2 && !sh.sideBySide) sideBad++
              if (key === 'facts' ? sh.factCols === 2 : sh.tileCols >= key) firstAt[key] ??= { body: sh.glanceBody, predicted: +at.toFixed(2) }
            }
          }
          console.log(`MEASURE ${name} glance ${scale * 100}% ${JSON.stringify(firstAt)} worst ink ${worstGlance}px`)
          check(`${name} ${scale * 100}% At a glance: no ink past a tile, a fact or the card across every track change`, worstGlance <= 0.5, `worst ${worstGlance}px`)
          check(`${name} ${scale * 100}% every tile label is one line wherever the tiles are two or more across`, labelBad === 0, `${labelBad} configurations wrapped a label`)
          check(`${name} ${scale * 100}% every fact's term and value sit side by side wherever the facts are two across`, sideBad === 0, `${sideBad} configurations stacked a fact`)
          check(`${name} ${scale * 100}% each track appeared where its minimum says`, targets.every(([k, at]) => firstAt[k] && Math.abs(firstAt[k].body - at) <= 2.5), JSON.stringify(firstAt))
          // Guard-the-guard: the detector sees a wide row forced far too narrow.
          await page.addStyleTag({ content: `${FORCE_WIDE_LIST} .sr-hsr-report { width: ${12 * em}px !important; }` })
          await settle(page)
          const guard = (await ink(page, '.sr-hsr-report')).worst
          check(`${name} ${scale * 100}% the detector sees a forced overflow`, guard > 50, `${guard}px`)
          await ctx.close()
        }
      }
      // ── 3. Real windows ────────────────────────────────────────────────────
      for (const bar of ['classic', 'overlay']) {
        for (const scale of SCALES) {
          const { ctx, page } = await open(browser, base, { width: 1500, height: 900 }, { scale, bar, inject: NEUTER })
          await openStress(page)
          let twoFrom = null
          const measureAt = async w => {
            await page.setViewportSize({ width: w, height: 900 })
            await settle(page)
            const r = (await ink(page, '.sr-hsr-report')).worst
            const shape = await page.evaluate(SHAPE)
            measured++
            windowsMeasured++
            const bad = r > 0.5 || shape.pageOver > 0 || (shape.two && shape.stacked) || !shape.orderOk || shape.jumpShown === shape.two || !shape.chipsOk
            if (bad) {
              windowFailures++
              if (MODE === 'fixed') check(`${name} ${bar} ${scale * 100}% ${w}px`, false, `ink ${r}px, page ${shape.pageOver}px, two over stacked ${shape.two && shape.stacked}, order ${shape.orderOk ? 'ok' : shape.seen.join(' > ')}, jump ${shape.jumpShown}, chips ${shape.chipsOk}`)
            }
            return shape
          }
          for (const w of windowWidths(scale)) {
            const shape = await measureAt(w)
            if (shape.two && twoFrom === null) twoFrom = w
          }
          if (FLIP_SCALES.includes(scale)) {
            // The 20px below the first two-column width, every 2px: the flip to 2px.
            let exact = null
            let reportEm = null
            const from = (twoFrom ?? 1500) - 20
            for (let w = from; w < from + FINE * 2; w += 2) {
              const shape = await measureAt(w)
              if (shape.two && exact === null) {
                exact = w
                reportEm = await page.evaluate(s => document.querySelector('.sr-hsr-report').getBoundingClientRect().width / (16 * s), scale)
              }
            }
            console.log(`MEASURE ${name} windows ${bar} ${scale * 100}% two columns from ${exact ?? 'never'}px (report ${reportEm === null ? '-' : reportEm.toFixed(3)}em)`)
            if (MODE === 'fixed') check(`${name} ${bar} ${scale * 100}% the coupled pair flips inside the windows swept`, exact !== null && reportEm > t.report, `at ${exact}px, report ${reportEm?.toFixed(3)}em against ${t.report}em`)
          } else {
            console.log(`MEASURE ${name} windows ${bar} ${scale * 100}% two columns from ${twoFrom ?? 'never'} (the report cannot reach ${t.report}em under the 1280px panel)`)
            if (MODE === 'fixed') check(`${name} ${bar} ${scale * 100}% one column at every window`, twoFrom === null, `${twoFrom}`)
          }
          await ctx.close()
        }
      }
      // ── 4. Phones ──────────────────────────────────────────────────────────
      for (const scale of PHONE_SCALES) {
        const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { scale, inject: MODE === 'broken' ? NEUTER_PHONE : '' })
        await openTab(page)
        for (const [query, heading] of PHONE_PLACES) {
          await openPlace(page, query, heading)
          const rows = []
          for (const w of PHONE_WIDTHS) {
            await page.setViewportSize({ width: w, height: 844 })
            await settle(page)
            // No allowance: the life list's name cell, which overran into the
            // link column here until hotspot-report-order-and-stats D-11, is
            // held like every other cell.
            const r = (await ink(page, '.sr-hsr-report')).worst
            const sh = await page.evaluate(SHAPE)
            measured++
            phonesMeasured++
            rows.push(`${w}:${sh.glanceBody}/${sh.tileCols}t/${sh.factCols}f/${sh.labelLines}l`)
            const bad = r > 0.5 || sh.pageOver > 0 || sh.two || !sh.orderOk || !sh.jumpShown || !sh.chipsOk
            if (bad) {
              phoneFailures++
              if (MODE === 'fixed') check(`${name} phone ${heading.slice(0, 12)} ${scale * 100}% ${w}px`, false, `ink ${r}px, page ${sh.pageOver}px, two ${sh.two}, order ${sh.orderOk ? 'ok' : sh.seen.join(' > ')}, jump ${sh.jumpShown}, chips ${sh.chipsOk}`)
            }
          }
          console.log(`MEASURE ${name} phone ${heading.slice(0, 12)} ${scale * 100}% width:glanceBody/tiles/facts/labelLines ${rows.join(' ')}`)
        }
        await ctx.close()
      }
    } finally {
      await browser.close()
    }
  }
} finally {
  await close()
}

const seconds = Math.round((Date.now() - started) / 1000)
// The stub forwards nothing, so no request reached eBird; what is checked is
// that the only eBird-backed path the tab asked for is the shared hotspot
// lookup it already reuses (hotspot-reports NFR-01 (b)), answered by the stub as
// a keyless backend would, and every other host was refused in the browser.
const otherEbird = ebirdBacked.filter(p => !p.startsWith('/map/hotspot-region'))
check('the only eBird-backed path asked for is the shared hotspot lookup, answered by the stub', otherEbird.length === 0,
  `${ebirdBacked.length} hotspot-region lookups answered by the stub, ${otherEbird.length} other (${[...new Set(otherEbird)].slice(0, 5).join(', ')}); ${refusedHosts} requests to other hosts refused in the browser`)
if (MODE === 'fixed') {
  check(`windows leg measured every configuration`, windowsMeasured === EXPECTED_WINDOWS, `${windowsMeasured} of ${EXPECTED_WINDOWS} window configurations measured`)
  check(`phone leg measured every configuration`, phonesMeasured === EXPECTED_PHONES, `${phonesMeasured} of ${EXPECTED_PHONES} phone configurations measured`)
  // The denominator is what was measured, never what was declared: a short leg
  // is the check above's failure, and this line must not read as if it covered more.
  check('no window configuration failed', windowFailures === 0, `${windowFailures} of the ${windowsMeasured} measured`)
  check('no phone configuration failed', phoneFailures === 0, `${phoneFailures} of the ${phonesMeasured} measured`)
  console.log(`${measured} configurations measured (${windowsMeasured} of them windows, ${phonesMeasured} phones) in ${seconds} s; ${failures.length ? 'FAILED' : 'all green'}`)
  process.exit(failures.length ? 1 : 0)
} else {
  // A short leg cannot certify the harness either way, and each leg must see
  // its own defect.
  const full = windowsMeasured === EXPECTED_WINDOWS && phonesMeasured === EXPECTED_PHONES
  const sees = windowFailures > 0 && phoneFailures > 0 && full
  console.log(`expect-broken: ${windowFailures} of the ${windowsMeasured} window configurations measured (${EXPECTED_WINDOWS} declared) fail with both container queries neutered; ${phoneFailures} of the ${phonesMeasured} phone configurations measured (${EXPECTED_PHONES} declared) fail with the glance grids held wide and the rail moved after the list; ${seconds} s`)
  console.log(sees ? 'HARNESS DISCRIMINATES'
    : !full ? `HARNESS CANNOT CERTIFY: the windows leg measured ${windowsMeasured} of ${EXPECTED_WINDOWS}, the phone leg ${phonesMeasured} of ${EXPECTED_PHONES}`
      : 'HARNESS IS BLIND: a leg saw no failure with its defect forced')
  process.exit(sees && failures.length === 0 ? 0 : 1)
}
