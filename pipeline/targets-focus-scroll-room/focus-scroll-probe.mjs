// Focus scroll-room probe for the Targets table (targets-focus-scroll-room).
//
// THE CLAIM. Where the Targets table scrolls sideways inside its own wrapper,
// a control that takes keyboard focus is shown WHOLE: its box, the hotspot
// link's hanging open-on-eBird glyph, and the focus ring (outline width plus
// outline offset) all lie inside the wrapper's visible box. The claim is
// geometric and per-engine, so jsdom and the stylesheet guard cannot see it
// (`frontend/src/lib/targetsSortSelectCss.test.ts` pins the cascade; this
// measures what the engines do with it).
//
// HOW IT RUNS. Against the BUILT app, served by a real backend from an
// isolated tree, never the user's data or a real key:
//   1. Copy `backend/` (no `.env`) and a built `frontend/dist` side by side in
//      a scratch folder, one pair per build being compared.
//   2. Copy `website/tools/demo-data` (the synthetic dataset, made by
//      `website/tools/gen-demo-data.mjs`) per build and point the backend at it
//      with `SR_DATA_DIR`; write `"US-NY-047"` to `settings/targetsCounty.json`.
//   3. `uvicorn main:app --port <port>` from each backend copy.
//   4. node pipeline/targets-focus-scroll-room/focus-scroll-probe.mjs \
//        --base before=http://127.0.0.1:18741 --base after=http://127.0.0.1:18742 \
//        --out /path/to/result.json [--engines chromium,webkit] [--scales 1,2]
//        [--widths 641,680-1280:40] [--inject label=<css>] [--keep-stops]
//      `--inject` adds a leg that runs the first base with that stylesheet added
//      (a candidate rule, tried like for like); `--keep-stops` writes every stop.
//
// WHAT IS STUBBED, IN THE BROWSER ONLY. The eBird-backed answers, because they
// need the network and a key: the county's species list (`/map/county-species`),
// the per-day reports (`/map/county-day-obs`), the public-hotspot list
// (`/map/hotspot-region`), and every other `/map/*` call as empty. The key
// lookup (`GET /settings/keys`) answers a placeholder that is never sent
// anywhere, the text scale (`GET /settings/textScale`) answers the leg's scale,
// and the bar-chart manifest and file are answered with a synthetic file, so the
// table carries every column. All of them are built here from the demo dataset
// (the county's own species, their scientific names from its taxonomy), so the
// run needs no network. Everything else, the app, its CSS and its storage, is
// the shipped code.
//
// WHAT IT MEASURES, per (build, engine, scale, width). Focus is placed on the
// control just before the wrapper's first control, then Tab is pressed until
// focus leaves the wrapper, then Shift+Tab until it leaves at the start: the
// order a keyboard user produces (testing.md, v1.0.47: a ring's visibility in a
// sideways scroller depends on its scroll history). At every stop inside the
// wrapper it reads the focused control's box (the union of its client rects and
// its glyph's), the ring from its own computed outline width and offset, and
// the wrapper's visible box (client area), and records how far the ringed box
// sits past each edge. A stop is CLIPPED when either overhang exceeds 0.5px.
//
// IT REFUSES TO MEASURE NOTHING. Each leg asserts the root font size tracks the
// scale (testing.md, v1.0.6), that the table rendered rows with hotspot links,
// that every stop matched :focus-visible with a ring (WebKit's programmatic
// focus does not, testing.md v1.0.47), and that the wrapper was entered.

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { requirePlaywright } from '../../website/tools/verify/playwright.mjs'
import { dismissWelcome } from '../../website/tools/verify/dismissWelcome.mjs'

const REPO = fileURLToPath(new URL('../../', import.meta.url))

// ── Arguments ────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { keepStops: false, bases: [], injects: [], engines: ['chromium', 'webkit'], scales: [1, 2], widths: null, out: null, data: `${REPO}website/tools/demo-data`, pool: 60, lifers: 10 }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const v = () => argv[++i]
    if (a === '--base') { const [k, ...u] = v().split('='); out.bases.push({ name: k, url: u.join('=') }) }
    else if (a === '--inject') { const [k, ...c] = v().split('='); out.injects.push({ name: k, css: c.join('=') }) }
    else if (a === '--engines') out.engines = v().split(',')
    else if (a === '--scales') out.scales = v().split(',').map(Number)
    else if (a === '--widths') out.widths = v()
    else if (a === '--out') out.out = v()
    else if (a === '--data') out.data = v()
    else if (a === '--pool') out.pool = Number(v())
    else if (a === '--keep-stops') out.keepStops = true
    else throw new Error(`unknown argument ${a}`)
  }
  if (!out.bases.length) throw new Error('at least one --base name=url is required')
  return out
}

/** "641,680-1280:40" -> [641, 680, 720, ..., 1280] */
function parseWidths(spec) {
  const w = []
  for (const part of spec.split(',')) {
    const m = /^(\d+)-(\d+):(\d+)$/.exec(part)
    if (m) for (let x = +m[1]; x <= +m[2]; x += +m[3]) w.push(x)
    else w.push(Number(part))
  }
  return w
}

// ── Fixtures, built from the demo dataset ────────────────────────────────────

function parseCsv(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else q = false }
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = '' }
    else cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

const REGION = 'US-NY-047'
// Invented location ids with realistic names of several lengths; the fourth is
// a personal place, so it stays plain text (HotspotLink's not-a-hotspot path).
const LOCS = [
  { locId: 'L109516', locName: 'Prospect Park--Lookout Hill, the Peninsula and the Lullwater Bridge', lat: 40.6602, lng: -73.969, hotspot: true },
  { locId: 'L1095234', locName: 'Green-Wood Cemetery', lat: 40.6525, lng: -73.9905, hotspot: true },
  { locId: 'L285884', locName: 'Floyd Bennett Field--North Forty Natural Area', lat: 40.5915, lng: -73.8912, hotspot: true },
  { locId: 'L99999901', locName: 'Backyard feeder', lat: 40.672, lng: -73.97, hotspot: false },
  { locId: 'L1813453', locName: 'Brooklyn Bridge Park--Pier 1 Salt Marsh', lat: 40.7008, lng: -73.9967, hotspot: true },
  { locId: 'L152742', locName: 'Marine Park--Salt Marsh Nature Center', lat: 40.5975, lng: -73.9235, hotspot: true },
]
// Species absent from the whole demo record, so they are Lifer targets.
const LIFER_NAMES = [
  'Northern Rough-winged Swallow', 'Black-throated Green Warbler', 'Yellow-bellied Sapsucker',
  'Louisiana Waterthrush', 'Sharp-shinned Hawk', 'Ruby-crowned Kinglet', 'Blue-headed Vireo',
  'Rose-breasted Grosbeak', 'Black-billed Cuckoo', 'Semipalmated Sandpiper', 'Yellow-crowned Night Heron',
]

function buildFixtures(dataDir, poolSize, liferCount) {
  const tax = JSON.parse(readFileSync(`${dataDir}/taxonomy.json`, 'utf8'))
  const sciOf = new Map(Object.entries(tax.bySci).map(([sci, code]) => [code, sci]))
  const cap = s => s.replace(/^./, c => c.toUpperCase())
  const rows = parseCsv(readFileSync(`${dataDir}/ebird-backup.csv`, 'utf8'))
  const head = rows[0]
  const col = n => head.indexOf(n)
  const [cCom, cSci, cOrd, cSt, cCo] = ['Common Name', 'Scientific Name', 'Taxonomic Order', 'State/Province', 'County'].map(col)
  const seenAnywhere = new Set()
  const kings = new Map()
  for (const r of rows.slice(1)) {
    if (r.length < head.length) continue
    seenAnywhere.add(r[cCom].toLowerCase())
    if (r[cSt] !== 'US-NY' || r[cCo] !== 'Kings') continue
    const code = tax.bySci[r[cSci].toLowerCase()] ?? tax.byCom[r[cCom].toLowerCase()]
    if (!code || kings.has(code) || r[cCom].includes('/') || r[cCom].includes(' sp.') || r[cCom].includes('(')) continue
    kings.set(code, { speciesCode: code, commonName: r[cCom], order: Number(r[cOrd]) })
  }
  const recorded = [...kings.values()].sort((a, b) => a.order - b.order).slice(0, poolSize)
  const lifers = []
  for (const n of LIFER_NAMES) {
    if (lifers.length >= liferCount) break
    const code = tax.byCom[n.toLowerCase()]
    if (code && !seenAnywhere.has(n.toLowerCase())) lifers.push({ speciesCode: code, commonName: tax.byCode[code] ?? n })
  }
  const species = [...recorded.map(({ speciesCode, commonName }) => ({ speciesCode, commonName })), ...lifers]
  const pool = { regionCode: REGION, speciesCount: species.length, species }

  // A synthetic full-year bar-chart file over the same species (the eBird
  // download's layout, scientific name in the current `<em class="sci">` form).
  const lines = ['SYNTHETIC probe fixture, not eBird data. Frequency of observations in the selected location(s).:', `Number of taxa: \t${species.length}`, '']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  lines.push('\t' + months.map(m => `${m}\t\t\t`).join(''))
  lines.push('Sample Size:\t' + Array.from({ length: 48 }, (_, w) => `${50 + w}.0`).join('\t') + '\t', '')
  species.forEach((s, i) => {
    const sci = sciOf.get(s.speciesCode)
    const name = sci ? `${s.commonName} (<em class="sci">${cap(sci)}</em>)` : s.commonName
    const f = Array.from({ length: 48 }, (_, w) => ((i + w) % 5 === 0 ? '0.0' : String(((i * 7 + w * 3) % 40) / 100 + 0.01)))
    lines.push(`${name}\t${f.join('\t')}\t`, '')
  })
  const barChart = lines.join('\n')
  const filename = `ebird_${REGION}__2016_2026_1_12_barchart.txt`
  const manifest = { version: 1, counties: { [REGION]: { filename, uploadedAt: '2026-09-01T12:00:00Z' } } }
  return { pool, barChart, manifest, recordedCount: recorded.length, liferCount: lifers.length }
}

function dayIndex(date) {
  return Math.round(Date.parse(`${date}T12:00:00Z`) / 86400000)
}

async function stub(ctx, fx, scale) {
  const json = body => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  await ctx.route('**/settings/keys', r => (r.request().method() === 'GET' ? r.fulfill(json({ ebird: 'FIXTURE-NOT-A-KEY', openweather: null })) : r.continue()))
  await ctx.route('**/settings/textScale', r => (r.request().method() === 'GET' ? r.fulfill(json(scale)) : r.fulfill(json({ ok: true }))))
  await ctx.route('**/settings/barcharts', r => (r.request().method() === 'GET' ? r.fulfill(json(fx.manifest)) : r.continue()))
  await ctx.route(`**/settings/barcharts/${REGION}`, r => (r.request().method() === 'GET' ? r.fulfill({ status: 200, contentType: 'text/plain', body: fx.barChart }) : r.continue()))
  await ctx.route('**/map/county-species*', r => r.fulfill(json(fx.pool)))
  await ctx.route('**/map/county-day-obs*', r => {
    const date = new URL(r.request().url()).searchParams.get('date')
    const d = dayIndex(date)
    const species = []
    fx.pool.species.forEach((s, i) => {
      if ((d + i) % 3 !== 0) return
      const loc = LOCS[i % LOCS.length]
      species.push({ speciesCode: s.speciesCode, obsDt: `${date} 0${7 + (i % 3)}:${String((i * 7) % 60).padStart(2, '0')}`, locId: loc.locId, locName: loc.locName, lat: loc.lat, lng: loc.lng })
    })
    return r.fulfill(json({ regionCode: REGION, date, species }))
  })
  await ctx.route('**/map/hotspot-region*', r => r.fulfill(json(LOCS.filter(l => l.hotspot).map(l => l.locId))))
  await ctx.route(/\/map\/(?!county-species|county-day-obs|hotspot-region)/, r => r.fulfill(json([])))
}

// ── In-page measurement (serialized into the page) ──────────────────────────

const WRAP = '.sr-tg-list-card .sr-scroll-x'

function readStop(wrapSel) {
  const el = document.activeElement
  const wrap = document.querySelector(wrapSel)
  const describe = e => (e ? `${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : ''}` : 'none')
  if (!wrap || !el || el === document.body || !wrap.contains(el)) return { inside: false, desc: describe(el) }
  const wr = wrap.getBoundingClientRect()
  const vl = wr.left + wrap.clientLeft
  const vr = vl + wrap.clientWidth
  let L = Infinity, R = -Infinity
  const add = r => { if (r.width > 0 || r.height > 0) { L = Math.min(L, r.left); R = Math.max(R, r.right) } }
  for (const r of el.getClientRects()) add(r)
  for (const s of el.querySelectorAll('svg')) add(s.getBoundingClientRect())
  const cs = getComputedStyle(el)
  const ow = cs.outlineStyle === 'none' ? 0 : parseFloat(cs.outlineWidth) || 0
  const oo = parseFloat(cs.outlineOffset) || 0
  const ring = ow > 0 ? ow + oo : 0
  const kind = el.closest('th') ? 'sort'
    : el.classList.contains('sr-birdname-link') ? 'name'
    : el.closest('.sr-tg-place') ? 'hotspot'
    : el.closest('.sr-birdname') && el.tagName === 'A' ? 'refmark'
    : 'other'
  return {
    inside: true, kind, desc: describe(el), label: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 60),
    focusVisible: el.matches(':focus-visible'), ring,
    scrollLeft: wrap.scrollLeft, maxScroll: wrap.scrollWidth - wrap.clientWidth,
    endOver: +(R + ring - vr).toFixed(2), startOver: +(vl - (L - ring)).toFixed(2),
    boxEndOver: +(R - vr).toFixed(2), boxStartOver: +(vl - L).toFixed(2), width: +(R - L).toFixed(2),
  }
}

function focusBeforeWrap(wrapSel) {
  const wrap = document.querySelector(wrapSel)
  const all = [...document.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')]
    .filter(e => e.tabIndex >= 0 && !e.disabled && e.getClientRects().length > 0 && !e.closest('[inert]'))
  const first = all.findIndex(e => wrap.contains(e))
  if (first <= 0) return null
  all[first - 1].focus()
  return document.activeElement === all[first - 1]
}

// ── The run ──────────────────────────────────────────────────────────────────

const CLIP = 0.5
const MAX_PRESSES = 1200

async function settle(page) {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
}

async function openTargets(page, base, scale) {
  await page.goto(`${base}/`)
  const welcome = page.getByRole('dialog', { name: /welcome/i })
  if (await welcome.isVisible().catch(() => false)) await dismissWelcome(welcome)
  await page.getByRole('tab', { name: 'Targets', exact: true }).first().click()
  await page.locator('table.sr-tg-table').waitFor({ timeout: 60000 })
  const breeding = page.getByRole('button', { name: 'Breeding', exact: true })
  if ((await breeding.getAttribute('aria-pressed')) !== 'true') await breeding.click()
  // The per-day sweep fills Last report; wait until it has finished and the
  // hotspot links have stopped growing.
  await page.waitForFunction(() => document.querySelectorAll('table.sr-tg-table .sr-tg-place > a').length > 0, null, { timeout: 120000 })
  let prev = -1
  for (let i = 0; i < 60; i++) {
    const n = await page.evaluate(() => document.querySelectorAll('table.sr-tg-table .sr-tg-place > a').length)
    const st = await page.evaluate(() => document.querySelector('.sr-tg-sweep .sr-tg-status')?.textContent ?? '')
    if (n === prev && !/hecking/.test(st)) break
    prev = n
    await page.waitForTimeout(1000)
  }
  const rootFont = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize))
  if (Math.abs(rootFont - 16 * scale) > 0.01) throw new Error(`text scale did not apply: root font ${rootFont}px at scale ${scale}`)
}

async function sweepFocus(page) {
  const stops = []
  const ok = await page.evaluate(focusBeforeWrap, WRAP)
  if (!ok) throw new Error('could not place focus before the wrapper')
  let entered = false
  for (let i = 0; i < MAX_PRESSES; i++) {
    await page.keyboard.press('Tab')
    const s = await page.evaluate(readStop, WRAP)
    if (!s.inside) { if (entered) break; continue }
    entered = true
    stops.push({ dir: 'fwd', ...s })
  }
  if (!entered) throw new Error('Tab never entered the wrapper')
  entered = false
  for (let i = 0; i < MAX_PRESSES; i++) {
    await page.keyboard.press('Shift+Tab')
    const s = await page.evaluate(readStop, WRAP)
    if (!s.inside) { if (entered) break; continue }
    entered = true
    stops.push({ dir: 'back', ...s })
  }
  if (!entered) throw new Error('Shift+Tab never entered the wrapper')
  return stops
}

function summarize(stops) {
  const clipped = stops.filter(s => s.endOver > CLIP || s.startOver > CLIP)
  const byKind = {}
  for (const s of stops) {
    const k = (byKind[s.kind] ??= { stops: 0, clipped: 0, worstEnd: -Infinity, worstStart: -Infinity })
    k.stops++
    if (s.endOver > CLIP || s.startOver > CLIP) k.clipped++
    k.worstEnd = Math.max(k.worstEnd, s.endOver)
    k.worstStart = Math.max(k.worstStart, s.startOver)
  }
  return {
    stops: stops.length,
    clipped: clipped.length,
    clippedEnd: stops.filter(s => s.endOver > CLIP).length,
    clippedStart: stops.filter(s => s.startOver > CLIP).length,
    worstEnd: Math.max(...stops.map(s => s.endOver)),
    worstStart: Math.max(...stops.map(s => s.startOver)),
    noRing: stops.filter(s => !s.focusVisible || s.ring <= 0).length,
    byKind,
    examples: clipped.slice(0, 4).map(s => ({ dir: s.dir, kind: s.kind, label: s.label, endOver: s.endOver, startOver: s.startOver, scrollLeft: s.scrollLeft, maxScroll: s.maxScroll })),
  }
}

const args = parseArgs(process.argv.slice(2))
const widths = parseWidths(args.widths ?? '641,680-1280:40')
const fx = buildFixtures(args.data, args.pool, args.lifers)
const { chromium, webkit } = requirePlaywright()
const legs = [
  ...args.bases.map(b => ({ build: b.name, url: b.url, css: null })),
  ...args.injects.map(i => ({ build: i.name, url: args.bases[0].url, css: i.css })),
]
const results = []
const t0 = Date.now()
for (const engine of args.engines) {
  const browser = await (engine === 'webkit' ? webkit : chromium).launch()
  try {
    for (const leg of legs) {
      for (const scale of args.scales) {
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
        await ctx.addInitScript(s => { try { localStorage.setItem('sr-text-scale', String(s)) } catch { /* private */ } }, scale)
        await stub(ctx, fx, scale)
        const page = await ctx.newPage()
        const pageErrors = []
        page.on('pageerror', e => pageErrors.push(String(e).slice(0, 160)))
        try {
          await openTargets(page, leg.url, scale)
          if (leg.css) await page.addStyleTag({ content: leg.css })
          const rowCount = await page.evaluate(() => document.querySelectorAll('table.sr-tg-table tbody tr').length)
          const placeLinks = await page.evaluate(() => document.querySelectorAll('table.sr-tg-table .sr-tg-place > a').length)
          if (rowCount < 10 || placeLinks < 5) throw new Error(`table too thin to measure: ${rowCount} rows, ${placeLinks} hotspot links`)
          for (const width of widths) {
            await page.setViewportSize({ width, height: 900 })
            await settle(page)
            await page.evaluate(sel => { const w = document.querySelector(sel); if (w) w.scrollLeft = 0; window.scrollTo(0, 0); document.activeElement?.blur?.() }, WRAP)
            await settle(page)
            const overflow = await page.evaluate(sel => { const w = document.querySelector(sel); return w.scrollWidth - w.clientWidth }, WRAP)
            const pageScroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
            const stops = await sweepFocus(page)
            const sum = summarize(stops)
            results.push({ build: leg.build, engine, scale, width, rows: rowCount, placeLinks, overflow, pageScroll, pageErrors: pageErrors.length, ...sum, ...(args.keepStops ? { stopList: stops } : {}) })
            console.log(`${leg.build.padEnd(10)} ${engine.padEnd(8)} ${scale}x ${String(width).padStart(4)}  overflow ${String(overflow).padStart(4)}  stops ${String(sum.stops).padStart(3)}  clipped ${String(sum.clipped).padStart(3)} (end ${sum.clippedEnd}, start ${sum.clippedStart})  worstEnd ${sum.worstEnd.toFixed(2)}  worstStart ${sum.worstStart.toFixed(2)}`)
            // A stop without a ring measured an unfocused or programmatically
            // focused control, which reads as clean whatever the engine did.
            if (sum.noRing) throw new Error(`${sum.noRing} stops had no :focus-visible ring at ${engine} ${scale}x ${width}`)
          }
        } finally {
          await ctx.close()
        }
      }
    }
  } finally {
    await browser.close()
  }
}
if (args.out) writeFileSync(args.out, JSON.stringify({ fixture: { pool: fx.pool.speciesCount, recorded: fx.recordedCount, lifers: fx.liferCount }, widths, results }, null, 1))
console.log(`legs ${results.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
