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
import { serveDist } from '<repo>/website/tools/verify/serveDist.mjs'
import { requirePlaywright } from '<repo>/website/tools/verify/playwright.mjs'
import { dismissWelcome } from '<repo>/website/tools/verify/dismissWelcome.mjs'

const { chromium, webkit } = requirePlaywright()
const DIST = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) ?? process.env.SR_VERIFY_DIST
  ?? fileURLToPath(new URL('../../../frontend/dist/', import.meta.url)))
const MODE = 'fixed'
const OUT = process.argv.slice(2).filter(a => !a.startsWith('--'))[1]

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
const OVERHANG = ({ root: rootSel, allow = [] }) => {
  const root = document.querySelector(rootSel)
  /** Ink past a cell of a class in `allow`: a residual measured identical on
   *  the build before this change, printed, never counted (testing.md v1.0.54). */
  const allowed = []
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
      const over = Math.max(b.left + parseFloat(cs.borderLeftWidth) - r.left, r.right - (b.right - parseFloat(cs.borderRightWidth)))
      if (over > 0.5 && allow.some(c => box.classList.contains(c))) allowed.push(`${[...box.classList].join('.')} ${over.toFixed(2)}px`)
      else worst = Math.max(worst, over)
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
  return { worst: +worst.toFixed(2), allowed: [...new Set(allowed)] }
}
const ink = async (page, root, allow = []) => page.evaluate(OVERHANG, { root, allow })

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


import { writeFile } from 'node:fs/promises'
/** Every life-list row's geometry, row-relative, to 0.01px, and the worst name
 *  overhang past its own cell (text line boxes and the name box). */
/** Wait until no finite animation inside the report's view is still running
 *  (the 160ms entrance a selection plays), so no box is read mid-transform. */
const still = page => page.waitForFunction(() => document.getAnimations().every(a => {
  const t = a.effect && a.effect.target
  const inView = t && t.closest && t.closest('.sr-hsr-view')
  return !inView || a.effect.getTiming().iterations === Infinity || a.playState !== 'running'
}))
const FP = () => {
  const r2 = n => Math.round(n * 100) / 100
  const range = document.createRange()
  const rows = []
  let over = 0
  for (const row of document.querySelectorAll('.sr-hsr-report .sr-hsr-ll-row')) {
    const rr = row.getBoundingClientRect()
    const rel = b => [r2(b.left - rr.left), r2(b.top - rr.top), r2(b.width), r2(b.height)]
    const cell = row.querySelector('.sr-hsr-ll-name')
    const link = cell.querySelector('.sr-birdname-link, .sr-birdname-text')
    range.selectNodeContents(link)
    const lines = [...range.getClientRects()].filter(r => r.width > 0)
    const cb = cell.getBoundingClientRect(), lb = link.getBoundingClientRect()
    for (const b of [lb, ...lines]) over = Math.max(over, b.right - cb.right, cb.left - b.left)
    rows.push({
      name: link.textContent, h: r2(rr.height), w: r2(rr.width), cell: rel(cb),
      box: rel(cell.querySelector('.sr-birdname').getBoundingClientRect()), link: rel(lb), lines: lines.map(rel),
      marks: [...cell.querySelectorAll('.sr-birdname-row > *')].map(e => rel(e.getBoundingClientRect())),
    })
  }
  return { over: r2(over), listH: r2(document.querySelector('.sr-hsr-ll').getBoundingClientRect().height), rows }
}
const SCALES = [1, 1.25, 1.5, 2]
const windowWidths = scale => { const o = []; for (let w = 641; w <= 1500; w += scale <= 1.25 ? 20 : 40) o.push(w); return o }
const PHONES = [320, 340, 360, 375, 390, 414, 430, 480, 540, 600, 640]
const PLACES = [['north channel', STRESS_NAME.slice(0, 40)], ['Demo place 0', 'Demo place 0']]
const result = {}
const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
try {
  for (const [name, engine] of [['chromium', chromium], ['webkit', webkit]]) {
    const browser = await engine.launch(name === 'chromium' ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {})
    try {
      for (const bar of ['classic', 'overlay']) for (const scale of SCALES) {
        const { ctx, page } = await open(browser, base, { width: 1500, height: 900 }, { scale, bar })
        await openStress(page)
        for (const w of windowWidths(scale)) {
          await page.setViewportSize({ width: w, height: 900 }); await settle(page); await still(page); await settle(page)
          result[`${name} window ${bar} ${scale * 100}% ${w}`] = await page.evaluate(FP)
        }
        await ctx.close()
      }
      for (const scale of SCALES) {
        const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { scale })
        await openTab(page)
        for (const [q, h] of PLACES) {
          await openPlace(page, q, h)
          for (const w of PHONES) {
            await page.setViewportSize({ width: w, height: 844 }); await settle(page); await still(page); await settle(page)
            result[`${name} phone ${h.slice(0, 12)} ${scale * 100}% ${w}`] = await page.evaluate(FP)
          }
        }
        await ctx.close()
      }
    } finally { await browser.close() }
  }
} finally { await close() }
const other = ebirdBacked.filter(p => !p.startsWith('/map/hotspot-region')).length
await writeFile(OUT, JSON.stringify({ ebirdBacked: ebirdBacked.length, otherEbird: other, refusedHosts, configs: result }))
console.log(`${Object.keys(result).length} configurations; eBird-backed answered by the stub ${ebirdBacked.length} (other than the hotspot lookup: ${other}); other hosts refused ${refusedHosts}`)
