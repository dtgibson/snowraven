// Real-engine verification for the Family Tree tab (family-rollups-and-tree
// schema 17; QA-79, QA-80, QA-97, QA-98; decisions.md D-38(b), D-55). jsdom has
// no layout and no focus fixup, so the readings the Engineer and the Tester
// took by hand in QA round 1 live here, in Chromium AND WebKit:
//
//   1. FOCUS AT A TOOL'S LIMIT. Zoom in, Zoom out and Fit, each pressed by
//      keyboard (Enter) to its limit and once past it, in the desktop toolbar
//      and in the phone's full screen: focus stays on the tool, the tool reads
//      aria-disabled and is never natively disabled, and the press past the
//      limit leaves the zoom where it was (D-38(b), QA-80).
//   2. THE TOOLS ROW'S CAPTIONS AGAINST THEIR CELLS. In the phone's full screen
//      at 320 and 390px and at the four shipped text scales: a caption shows
//      exactly when the row is at least the BUILT threshold wide (read from the
//      stylesheet, never typed in here), a shown caption is one line with no ink
//      past its cell, and every cell is at least 44px each way (QA-98, D-55(c)).
//   3. THE STILL AND THE FULL-SCREEN ROUND TRIP. On the phone (390px, the four
//      text scales) the still is a named image with an inert box and no
//      scroller of its own; Open the tree by keyboard hides the bar, shows one
//      Exit and puts focus on it, the box is never taller than the window, and
//      a zoom, an expansion and a selection made there survive Escape and a
//      reopen; Escape and Exit each return focus to the opener and the page to
//      its offset. On the desktop (1280px) the toggle opens and closes the
//      same way with focus on Exit, then on the toggle (QA-97, QA-98).
//   4. THE TABLE AT PHONE WIDTHS. Every family opened (Expand all) at 320 and
//      390px and the four text scales: no page scroll sideways, no text ink
//      past its row or the list, and each opened family's Birds of the World
//      line first in its block, one link, at least the touch target tall
//      (QA-79, D-55(a)).
//   5. A FAILED FAMILY ASSET (QA-14, FR-14; schema 8.2 after QA round 2, N1).
//      On the desktop, once with the asset's chunk aborted and once answered
//      500: the alert shows the copy module's message verbatim with one Reload
//      and no Go to Settings, and no table, tree or Not placed group; the chunk
//      was requested once; the tab hidden and shown again leaves the chunk at
//      one request, the files-status reads where they were and the alert as it
//      was; the fault is lifted and Reload pressed, and the chunk is requested
//      again and the tab comes up with its roster. A unit row cannot prove what
//      an engine asks for again; this leg is where that is held.
//   6. THE HEADLINE, TILE AGAINST TILE (QA-79, NFR-07, FR-36; design-spec 5 as
//      amended, D-73(a)). On a roster with a five-digit species count and on
//      the demo roster, at 320 to 640px and the four text scales, in each face:
//      three columns exactly where the wrapper's width over the root font size
//      is 16.5 or more; in three-up each count's text ends at least 6px before
//      the next tile; no text box of one tile crosses another's and none passes
//      the headline's content edge; each label one line; count, label,
//      denominator and share present as text; no page scroll sideways; and
//      three-up at 320 and 390px at 100%. It never asserts that a count stays
//      inside its own tile: at 320px and 100% a five-digit count is 2px past
//      its column by design, in the gap.
//   7. FIND BESIDE EXIT in the phone full screen at 320 and 390px and the four
//      text scales (design-spec 10.3, D-73(c)): Find shares Exit's row, with
//      the longest-named family selected (the readout at its tallest), and at
//      150% and 200% the tree's box holds at least BOX_SHARE_FLOOR of the
//      panel.
//   8. THE STILL'S FIGURES WHOLE at 320 and 390px and the four text scales
//      (design-spec 10.1, D-73(c)): the still's plane is no wider than its box
//      and every drawn figure lies inside the box.
//   9. THE TABLE'S NARROW FORM (design-spec 11, D-78, D-79(a)). The demo export
//      with its media export and the link marks' codes, every family open, at
//      320, 360, 390 and 430px and the four scales, in the three Names states:
//      no name breaks between two letters unless that word, measured alone in
//      its own font, is wider than its row's content width; no part of a
//      species row (name, second name, link marks, media cell) overlaps
//      another or leaves the row; no page scroll sideways; every media cell and
//      both link marks present and named, each mark at least 24px; and the
//      narrow form shows exactly where the list is under 15rem. Then a roster
//      of the long words (a laughingthrush, a scythebill, Green-capped Tanager,
//      Crowned Slaty Flycatcher, a boatbill, a flamingo) at 320px and 200%:
//      nothing breaks inside a word in Common and Both, and in Scientific
//      exactly the words wider than the row do.
//  10. FAMILY NAMES WHOLE AT 100% across the two tablet stretches where the
//      list is over 44em and at most 50em (windows of 815 to 903px and 971 to
//      1066px, measured pixel by pixel in both engines; D-79(b), D-80), with the
//      media export, in the three Names states: no name breaks inside a word
//      that fits its row. A window either side of each stretch is measured too.
//      Then a family row under a real pointer, in the column and the stacked
//      form, collapsed and expanded, light and dark: every piece of text on it
//      reads 4.5:1 or more on what is behind it (D-83, D-85, D-86).
//
// Lines starting `MEASURE` are the readings recorded in the run's evidence. The
// run declares how many configurations each leg measures and fails on a short
// count. `--expect-broken` forces one defect per leg (a tool natively disabled
// at its limit, the captions forced on, the panel's Exit hidden, the table held
// wider than a phone, the asset's fault left in place across the Reload, the
// headline held at three columns, Find given its old 11rem basis, the still's
// names untruncated, the rows' built form forced back, the family name held to
// the 48px column the old threshold left it and the hovered second name to its
// resting gray) and
// must then see a failure in EVERY leg, so the harness is shown able to see
// what it guards.
//
// THE FACE (testing.md, v1.0.75; family-rollups-and-tree D-70). The app
// bundles no font and its stack names Inter first, so a text reading is a
// reading of whatever face the page drew, and every text leg here names it:
// Chromium's own answer through CDP (`CSS.getPlatformFontsForNode`) and, in
// both engines, a width test the engine lays out itself (the measured
// element's own stack against 'Inter' over two different generic fallbacks),
// with `document.fonts.check`. The text legs (2 and 4) run in up to two
// faces: the stack as served ("first"), and the stack without its first
// family ("fallback") wherever that resolves to a face a shipped platform
// draws, which is macOS's (SF, as on Mac, iPhone and iPad) and not the Linux
// runner's (a DejaVu-metric face no platform ships, v1.0.75). When the run is
// ASKED for the first face (on CI, where `fonts-inter` is installed; or with
// `SR_VERIFY_FACE_DIR`, which `serveDist.mjs` serves; or `--face=first`), a
// page that did not draw Inter FAILS its leg rather than passing on another
// face. Asked for nothing and without Inter, a run says it measured the
// fallback only. The 1.0.76 build passed every run on a Mac without Inter
// and failed GitHub's in Inter, 5.45px of ink at 320px and 200%.
//
// SCOPE: schema 17 names more rows than these legs hold (QA-11, 43, 57,
// 59, 60, 66, 67, 81, 83, 94, 96, 99's phone leg, and Fit on a roster of 40 or
// more orders). Their readings were taken by hand-run probes and are in the
// run's decisions log; they are not legs here yet.
//
// HERMETIC: the dist is served with a stubbed backend holding a synthetic
// backup of real taxonomy names and no key. Every path a real backend answers
// by asking a third party (eBird's `/map`, `/checklists` and `/hotspot`, the
// weather and tide lookups, Nominatim, the Macaulay embed check and the
// release check) is answered by the stub with a 404 and COUNTED, and the run
// fails on any, so "no request left the page for a third party" is what it
// asserts. `/taxonomy/codes`, the tab's one designed codes batch, which a real
// server answers from its own taxonomy, is counted and reported apart: legs 1
// to 8 answer it with a 404, and legs 9 and 10, whose rows must carry their
// link marks, answer it from the app's bundled taxonomy as a real server does
// offline. Every other host is refused in the browser and counted. It reads
// tracked files only: the dist, the demo exports under `website/demo/` and the
// bundled taxonomy under `frontend/src/assets/`.
//
// WHERE IT LIVES (schema 17): held in `pipeline/family-rollups-and-tree/held/`
// until the user approved the `website/` change at the 1.0.76 sign-off, then
// moved here, where `run.mjs` picks it up. It still finds the shared helpers
// from either place:
//
//   node website/tools/verify/verify-family-tree.mjs [dist] [--expect-broken] [--legs=1,2,3,4,5,6,7,8,9,10]

import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const VERIFY = existsSync(join(HERE, 'serveDist.mjs')) ? HERE : resolve(HERE, '../../../website/tools/verify')
const ROOT = resolve(VERIFY, '../../..')
const { serveDist } = await import(pathToFileURL(join(VERIFY, 'serveDist.mjs')).href)
const { requirePlaywright } = await import(pathToFileURL(join(VERIFY, 'playwright.mjs')).href)
const { dismissWelcome } = await import(pathToFileURL(join(VERIFY, 'dismissWelcome.mjs')).href)

const { chromium, webkit } = requirePlaywright()
const DIST = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) ?? process.env.SR_VERIFY_DIST ?? join(ROOT, 'frontend/dist'))
const MODE = process.argv.includes('--expect-broken') ? 'broken' : 'fixed'
// `--legs=1,3` runs only those legs (a development aid; the gate runs all ten).
const LEGS_RUN = (process.argv.find(a => a.startsWith('--legs=')) ?? '--legs=1,2,3,4,5,6,7,8,9,10').slice(7).split(',').map(Number)
/** Asked to measure in the stack's first face: a page that draws another fails. */
const ASK_FIRST = process.env.CI === 'true' || Boolean(process.env.SR_VERIFY_FACE_DIR) || process.argv.includes('--face=first')
/** The stack without its first family resolves to a shipped platform's face here (macOS: SF). */
const FALLBACK_SHIPPED = process.platform === 'darwin'

// -- The synthetic backup: every 8th species of the family asset ---------------
// Real names, so each is placed; every order the asset has is reached, so the
// tree is as wide as a real life list's and the table holds every long family
// name the asset carries in its first species.

function roster(every = 8) {
  const A = join(ROOT, 'frontend/src/assets/')
  const fam = JSON.parse(readFileSync(A + 'ebird-families.json', 'utf8'))
  const snap = JSON.parse(readFileSync(A + 'ebird-taxonomy.json', 'utf8'))
  const out = []
  let n = 0
  for (const [, , families] of fam.orders) {
    for (const [, , , , genera] of families) {
      for (const [genus, list] of genera) {
        for (let i = 0; i < list.length; i += 2) {
          const code = snap.byCom[list[i]]
          const name = code ? snap.byCode[code] : null
          if (typeof name === 'string' && n++ % every === 0) out.push([name, `${genus} ${list[i + 1]}`])
        }
      }
    }
  }
  return out
}
const HEADER = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Latitude,Longitude,Date,Time,Protocol,Duration (Min),All Obs Reported,Distance Traveled (km),Area Covered (ha),Number of Observers,Breeding Code,Observation Details,Checklist Comments,ML Catalog Numbers'
const q = s => (/[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
const SPECIES = roster()
const CSV = [HEADER, ...SPECIES.map(([cn, sci], i) => [
  `S9${String(Math.floor(i / 10)).padStart(9, '0')}`, cn, sci, String(i), '1', 'US-NY', 'Kings', 'L100001', 'Prospect Park', '40.66', '-73.97',
  `20${10 + (i % 15)}-0${1 + (i % 9)}-1${i % 10}`, '07:15 AM', 'Traveling', '60', '1', '1.2', '', '1', '', '', '', '',
].map(q).join(','))].join('\n') + '\n'
const FILES_STATUS = { ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T00:00:00Z' }, ml: null }
/** The demo media export (tracked, synthetic), and the bundled taxonomy that
 *  answers the link marks' codes batch, for legs 9 and 10 only. */
const DEMO_ML = readFileSync(join(ROOT, 'website/demo/snowraven-demo-ml-export.csv'), 'utf8')
const TAXONOMY = JSON.parse(readFileSync(join(ROOT, 'frontend/src/assets/ebird-taxonomy.json'), 'utf8'))
/** A leg that needs media or codes sets these before it opens a page. */
let servedMl = null
let servedCodes = false
/** Every species of the asset (a five-digit count), for the headline leg. */
const FIVE_DIGIT = roster(1)
const FIVE_CSV = [HEADER, ...FIVE_DIGIT.map(([cn, sci], i) => [
  `S9${String(Math.floor(i / 10)).padStart(9, '0')}`, cn, sci, String(i), '1', 'US-NY', 'Kings', 'L100001', 'Prospect Park', '40.66', '-73.97',
  `20${10 + (i % 15)}-0${1 + (i % 9)}-1${i % 10}`, '07:15 AM', 'Traveling', '60', '1', '1.2', '', '1', '', '', '', '',
].map(q).join(','))].join('\n') + '\n'
/** The demo export the website publishes (synthetic, S9 ids): the TRACKED copy
 *  under website/demo/, which the frontend's suites read too. Never
 *  website/tools/demo-data/, which is gitignored, so a clone and GitHub's
 *  runner have none (family-rollups-and-tree D-77, the Auditor's N-1). */
const DEMO_CSV = readFileSync(join(ROOT, 'website/demo/snowraven-demo-ebird-backup.csv'), 'utf8')
/** What the stub serves as the backup; a leg that needs another roster sets it before opening a page. */
let servedCsv = CSV

/** Backend paths a real server answers by asking a third party. */
const THIRD_PARTY = /^\/(map|checklists|hotspot|weather|tide|nominatim|media)(\/|$)|^\/version\/check/
/** Requests to such a path that reached the stub: the run fails on any. */
const thirdParty = []
/** The tab's designed codes batch, answered by a real server from its own taxonomy. */
const taxonomyCalls = []
/** Codes batches legs 9 and 10 answered from the bundled taxonomy. */
let codesAnswered = 0
function stubBackend(p, req, res) {
  if (p === '/settings/files') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(servedMl ? { ...FILES_STATUS, ml: { filename: 'ml.csv', uploadedAt: '2026-06-01T00:00:00Z' } } : FILES_STATUS))
    return true
  }
  if (p === '/settings/files/ml' && servedMl) { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(servedMl); return true }
  // The codes a real server reads from its own taxonomy, answered from the
  // bundled one: no third party involved either way.
  if (p === '/taxonomy/codes' && servedCodes) {
    codesAnswered++
    let body = ''
    req.on('data', c => { body += c })
    req.on('end', () => {
      const codes = {}
      try {
        for (const sp of JSON.parse(body).species) {
          const name = String(sp.commonName).toLowerCase()
          if (Object.hasOwn(TAXONOMY.byCom, name)) codes[sp.commonName] = TAXONOMY.byCom[name]
        }
      } catch { /* a malformed body answers no codes */ }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ codes }))
    })
    return true
  }
  if (p === '/settings/files/ebird') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(servedCsv); return true }
  if (p === '/settings/keys') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ebird: null, openweather: null })); return true }
  if (THIRD_PARTY.test(p)) { thirdParty.push(p); res.writeHead(404); res.end('not found'); return true }
  if (p.startsWith('/taxonomy')) taxonomyCalls.push(p)
  if (p.startsWith('/settings/') || p.startsWith('/taxonomy') || p.startsWith('/version') || p.startsWith('/stats') || p.startsWith('/health')) {
    res.writeHead(404); res.end('not found'); return true
  }
  return false
}
let refusedHosts = 0

// -- The built threshold, read from the stylesheet the dist ships -------------

/** The app's stack, read from the built stylesheet: the `--font-sans` that names a quoted family first. */
async function fontStack() {
  const html = await readFile(join(DIST, 'index.html'), 'utf8')
  let css = ''
  for (const m of html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)) css += await readFile(join(DIST, m[1]), 'utf8')
  const m = /--font-sans:\s*(["'])([^"']+)\1\s*,([^;}]+)/.exec(css)
  if (!m) throw new Error('the built stylesheet carries no --font-sans that names a family first')
  return { first: m[2], rest: m[3].trim() }
}

async function captionThreshold() {
  const html = await readFile(join(DIST, 'index.html'), 'utf8')
  let css = ''
  for (const m of html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)) css += await readFile(join(DIST, m[1]), 'utf8')
  // The minifier writes `(width < Nrem)` as `not (width>=Nrem)`.
  const t = /@container sr-ft-tools (?:\(width\s*<\s*|not \(width\s*>=\s*)([\d.]+)rem\)/.exec(css)
  if (!t) throw new Error('the built stylesheet carries no Family Tree tools-row threshold')
  return Number(t[1])
}

// -- The forced defects of --expect-broken, one per leg ------------------------

// Leg 1: the round-1 shape, a tool natively disabled once it reads aria-disabled.
// It observes `document`, which an init script always has (`documentElement` may not exist yet).
const BREAK_FOCUS = `new MutationObserver(() => {
  for (const b of document.querySelectorAll('.sr-ft-tool[aria-disabled="true"]')) b.disabled = true
}).observe(document, { subtree: true, attributes: true, attributeFilter: ['aria-disabled'] })`
const BREAK_CAPTIONS = '.sr-ft-host.sr-map-fs-panel .sr-ft-tools .sr-ft-tool .cap { display: block !important; }'
const BREAK_EXIT = '.sr-ft-host.sr-map-fs-panel .sr-map-fullscreen-btn { display: none !important; }'
const BREAK_TABLE = '.sr-ft-list { min-width: 27rem !important; }'
// Leg 6: the headline held at three columns whatever its width (the 1.0.76 shape).
const BREAK_HEADLINE = '.sr-ft-glance { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; } .sr-ft-tile { flex-direction: column !important; flex-wrap: nowrap !important; }'
// Leg 7: Find's old basis, which dropped it under Exit at large text.
const BREAK_FIND = '.sr-ft-host.sr-map-fs-panel .sr-ft-find { flex: 1 1 11rem !important; min-width: min(11rem, 100%) !important; }'
// Leg 8: the still's rows at their natural width (their inline width is the
// plane's), so a long name pushes its figure past the box, as the 17rem plane did.
const BREAK_STILL = '.sr-ft-boxwrap.is-still .sr-ft-node { width: max-content !important; max-width: none !important; }'
// Leg 9: the rows' built form forced back (design-spec 11's own mutation).
const BREAK_NARROW = '.sr-ft-sp { grid-template-columns: minmax(0, 1fr) max(46px, 2.5rem) !important; } .sr-ft-sp .sr-birdname { display: inline-flex !important; } .sr-ft-open { padding-left: calc(12px + 1rem + 12px) !important; }'
// Leg 10: the family name held to the 48px column the 44em threshold left it.
const BREAK_FAMILY = '.sr-ft-fname { max-width: 48px !important; } .sr-ft-fname .n { overflow-wrap: anywhere !important; }'
  // ...and the hovered second name held to its resting gray (D-86).
  + ' .sr-ft-frow:hover .sr-ft-fname .s { color: var(--sr-text-gray) !important; }'

// -- Measurement ---------------------------------------------------------------

const failures = []
const legFailures = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
const legMeasured = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
function check(leg, name, ok, detail = '') {
  legMeasured[leg - 1]++
  if (!ok) legFailures[leg - 1]++
  if (MODE === 'broken' && ok) return
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok && MODE === 'fixed') failures.push(name)
}

const SCALES = [1, 1.25, 1.5, 2]
const ENGINES = [['chromium', chromium], ['webkit', webkit]]

async function open(browser, base, viewport, { scale = 1, css = '', script = '', routes = null, tab = true } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width <= 640 })
  await ctx.route('**/*', route => {
    if (new URL(route.request().url()).origin === base) return route.continue()
    refusedHosts++
    return route.abort()
  })
  // Registered after the catch-all, so it wins for what it matches.
  if (routes) await routes(ctx)
  if (script) await ctx.addInitScript({ content: script })
  const page = await ctx.newPage()
  await page.goto(base, { waitUntil: 'domcontentloaded' })
  const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
  if (await welcome.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) await dismissWelcome(welcome)
  if (css) await page.addStyleTag({ content: css })
  await setScale(page, scale)
  if (tab) await openTab(page)
  return { ctx, page }
}

async function setScale(page, s) {
  await page.evaluate(v => document.documentElement.style.setProperty('--sr-text-scale', String(v)), s)
  await page.waitForFunction(v => Math.abs(parseFloat(getComputedStyle(document.documentElement).fontSize) - 16 * v) < 0.01, s)
  await page.evaluate(() => document.fonts.ready)
  await settle(page)
}

async function openTab(page, { wait = true } = {}) {
  const tab = page.locator('[role="tab"]', { hasText: 'Family Tree' })
  if (await tab.count()) await tab.first().click()
  else {
    await page.locator('.sr-navbar button[aria-haspopup="dialog"]').click()
    await page.locator('[role="dialog"] .sr-nav-item', { hasText: 'Family Tree' }).first().click()
  }
  if (wait) await page.waitForSelector('.sr-ft-glance', { timeout: 60_000 })
}

async function showView(page, name) {
  const b = page.locator('.sr-ft-viewseg').getByRole('button', { name, exact: true })
  if ((await b.getAttribute('aria-pressed')) !== 'true') await b.click()
  if (name === 'Tree') await page.waitForSelector('.sr-ft-box', { timeout: 30_000 })
  else await page.waitForSelector('.sr-ft-list .sr-ft-frow', { timeout: 30_000 })
  await settle(page)
}

const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))

// -- The face a text leg measured ---------------------------------------------

/** Both engines: lay the same string out in the element's own stack, and in
 *  the first family over two different generic fallbacks. The two agree only
 *  when the first family is there; the element drew it only when its own
 *  stack lays out as they do. */
const FACE_TEST = ({ sel, first }) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const cs = getComputedStyle(el)
  const width = family => {
    const s = document.createElement('span')
    s.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px'
    s.style.fontStyle = cs.fontStyle
    s.style.fontWeight = cs.fontWeight
    s.style.fontSize = '32px'
    s.style.fontFamily = family
    s.textContent = 'Campylorhamphus Laughingthrush 0123456789'
    document.body.appendChild(s)
    const w = s.getBoundingClientRect().width
    s.remove()
    return w
  }
  const own = width(cs.fontFamily)
  const overSerif = width(`'${first}', serif`)
  const overMono = width(`'${first}', monospace`)
  const available = Math.abs(overSerif - overMono) < 0.01
  return {
    available, drawn: available && Math.abs(own - overSerif) < 0.01, stack: cs.fontFamily,
    fontsCheck: document.fonts.check(`${cs.fontStyle} ${cs.fontWeight} 16px '${first}'`),
  }
}

/** Chromium's own name for the face it drew (CDP). WebKit has no such call here. */
async function platformFace(page, sel) {
  let cdp
  try { cdp = await page.context().newCDPSession(page) } catch { return null }
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable')
    const { root } = await cdp.send('DOM.getDocument', { depth: -1 })
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: sel })
    if (!nodeId) return null
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    return fonts.map(f => `${f.familyName}${f.isCustomFont ? ' (served)' : ''}`).join(', ')
  } finally { await cdp.detach() }
}

/** Name the face this leg measured, and hold it to the pass it ran in. */
async function assertFace(leg, page, engine, label, pass, sel) {
  await page.evaluate(() => document.fonts.ready)
  const t = await page.evaluate(FACE_TEST, { sel, first: STACK.first })
  const named = await platformFace(page, sel)
  const said = t === null ? 'no element to read' : `${named ?? (t.drawn ? STACK.first : 'not ' + STACK.first)} by ${named ? 'CDP' : 'width'}; ${STACK.first} ${t.drawn ? 'drawn' : 'not drawn'} by width, ${t.available ? 'available' : 'not available'}, fonts.check ${t.fontsCheck}`
  console.log(`MEASURE ${engine} ${label} face [${pass.id}] ${said}`)
  if (pass.id === 'first' && ASK_FIRST) {
    faceCheck(`${engine} ${label} drew ${STACK.first}, the face the run was asked for`, t !== null && t.drawn, said)
  } else if (pass.id === 'fallback') {
    faceCheck(`${engine} ${label} drew the fallback, not ${STACK.first}`, t !== null && !t.drawn, said)
  }
}
let facesChecked = 0
function faceCheck(name, ok, detail) {
  facesChecked++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)
  if (!ok) failures.push(name)
}

/** Open the phone's full screen from the still, by keyboard. */
async function openFullScreen(page) {
  const opener = page.getByRole('button', { name: 'Open the tree' })
  await opener.scrollIntoViewIfNeeded()
  await opener.focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector('.sr-ft-host.sr-map-fs-panel')
  await page.waitForSelector('[role="tree"] [role="treeitem"]')
  await page.waitForTimeout(300)
}

const STATE = () => {
  const a = document.activeElement
  const t = document.querySelector('[role="tree"]')
  const act = t?.getAttribute('aria-activedescendant')
  const box = document.querySelector('.sr-ft-box')
  return {
    expanded: !!document.querySelector('.sr-ft-host.sr-map-fs-panel'),
    attr: document.documentElement.hasAttribute('data-sr-fs-open'),
    navbar: (() => { const n = document.querySelector('.sr-navbar'); return n ? getComputedStyle(n).visibility : 'none' })(),
    focus: a && a !== document.body ? (a.getAttribute('aria-label') ?? a.textContent?.trim().slice(0, 30)) : 'body',
    exits: [...document.querySelectorAll('button')].filter(b => b.getAttribute('aria-label') === 'Exit fullscreen' && b.getClientRects().length > 0).length,
    zoom: document.querySelector('.sr-ft-zoomval')?.textContent ?? null,
    active: act ? document.getElementById(act)?.getAttribute('aria-label') : null,
    openBranches: document.querySelectorAll('[role="treeitem"][aria-expanded="true"]').length,
    scrollY: Math.round(window.scrollY),
    boxTop: Math.round(box?.scrollTop ?? -1),
    boxH: Math.round(box?.getBoundingClientRect().height ?? 0),
    winH: innerHeight,
    pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    docH: document.documentElement.scrollHeight,
    stillH: Math.round(document.querySelector('.sr-ft-boxwrap')?.getBoundingClientRect().height ?? 0),
  }
}

// Leg 1 ------------------------------------------------------------------------

/** Press `name` by keyboard until it reads aria-disabled, then once more. */
async function pressToLimit(page, toolbar, name) {
  const tool = toolbar.getByRole('button', { name, exact: true })
  await tool.focus()
  for (let i = 0; i < 80 && (await tool.getAttribute('aria-disabled')) !== 'true'; i++) {
    await page.keyboard.press('Enter')
    await settle(page)
  }
  const reached = (await tool.getAttribute('aria-disabled')) === 'true'
  const zoom = await page.evaluate(() => document.querySelector('.sr-ft-zoomval')?.textContent)
  await page.keyboard.press('Enter')
  await settle(page)
  const after = await page.evaluate(n => {
    const a = document.activeElement
    return {
      focusOn: a?.getAttribute('aria-label') === n && a.classList.contains('sr-ft-tool'),
      focus: a && a !== document.body ? a.getAttribute('aria-label') ?? a.tagName : 'body',
      native: [...document.querySelectorAll('.sr-ft-tool')].some(b => b.disabled && b.getAttribute('aria-label') === n),
      zoom: document.querySelector('.sr-ft-zoomval')?.textContent,
    }
  }, name)
  return { reached, ...after, zoomSame: after.zoom === zoom }
}

async function focusLeg(name, browser, base) {
  const script = MODE === 'broken' ? BREAK_FOCUS : ''
  // Desktop: the tools sit in the tab's toolbar.
  {
    const { ctx, page } = await open(browser, base, { width: 1280, height: 800 }, { script })
    await showView(page, 'Tree')
    await page.waitForSelector('[role="tree"] [role="treeitem"]')
    const bar = page.getByRole('toolbar', { name: 'View tools' })
    for (const tool of ['Zoom in', 'Zoom out', 'Fit the whole tree', 'Zoom in']) {
      const r = await pressToLimit(page, bar, tool)
      check(1, `${name} desktop ${tool} keeps focus at its limit`, r.reached && r.focusOn && !r.native && r.zoomSame,
        `reached ${r.reached}, focus ${r.focus}, native disabled ${r.native}, zoom ${r.zoom}`)
    }
    await ctx.close()
  }
  // Phone: the tools sit in the full screen's row.
  {
    const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { script })
    await showView(page, 'Tree')
    await openFullScreen(page)
    const bar = page.locator('.sr-ft-host.sr-map-fs-panel').getByRole('toolbar', { name: 'View tools' })
    for (const tool of ['Zoom in', 'Zoom out', 'Fit the whole tree', 'Zoom in']) {
      const r = await pressToLimit(page, bar, tool)
      check(1, `${name} phone full screen ${tool} keeps focus at its limit`, r.reached && r.focusOn && !r.native && r.zoomSame,
        `reached ${r.reached}, focus ${r.focus}, native disabled ${r.native}, zoom ${r.zoom}`)
    }
    await ctx.close()
  }
}

// Leg 2 ------------------------------------------------------------------------

const CAPTIONS = () => {
  const row = document.querySelector('.sr-ft-host.sr-map-fs-panel .sr-ft-tools')
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const cells = [...row.querySelectorAll('.sr-ft-tool')].filter(c => c.getClientRects().length > 0)
  const out = { rowRem: +(row.getBoundingClientRect().width / rem).toFixed(3), cells: cells.length, shown: 0, worstInk: 0, maxLines: 0, minW: 1e9, minH: 1e9 }
  const range = document.createRange()
  for (const c of cells) {
    const b = c.getBoundingClientRect()
    out.minW = Math.min(out.minW, +b.width.toFixed(2))
    out.minH = Math.min(out.minH, +b.height.toFixed(2))
    const cap = c.querySelector('.cap')
    if (!cap || getComputedStyle(cap).display === 'none') continue
    out.shown++
    range.selectNodeContents(cap)
    const rects = [...range.getClientRects()].filter(r => r.width > 0)
    out.maxLines = Math.max(out.maxLines, new Set(rects.map(r => Math.round(r.top))).size)
    for (const r of rects) out.worstInk = Math.max(out.worstInk, +(b.left - r.left).toFixed(2), +(r.right - b.right).toFixed(2))
  }
  return out
}

async function captionsLeg(name, browser, base, threshold, pass) {
  const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { css: (MODE === 'broken' ? BREAK_CAPTIONS : '') + pass.css })
  await showView(page, 'Tree')
  await openFullScreen(page)
  await assertFace(2, page, name, 'tools row', pass, '.sr-ft-host.sr-map-fs-panel .sr-ft-tools .sr-ft-tool')
  const rows = []
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 844 })
    for (const s of SCALES) {
      await setScale(page, s)
      await page.waitForTimeout(100)
      const c = await page.evaluate(CAPTIONS)
      const wantShown = c.rowRem >= threshold
      const ok = c.cells >= 6 && (wantShown ? c.shown === c.cells : c.shown === 0) && c.worstInk <= 0.5 && c.maxLines <= 1 && c.minW >= 44 && c.minH >= 44
      rows.push(`${w}px/${s * 100}%: row ${c.rowRem}rem, ${c.shown}/${c.cells} captions, ink ${c.worstInk}px, ${c.maxLines} line, cell ${c.minW}x${c.minH}`)
      check(2, `${name} [${pass.id}] tools row ${w}px ${s * 100}%`, ok,
        `row ${c.rowRem}rem (threshold ${threshold}rem), captions ${c.shown} of ${c.cells}, ink ${c.worstInk}px, lines ${c.maxLines}, smallest cell ${c.minW}x${c.minH}px`)
    }
  }
  console.log(`MEASURE ${name} [${pass.id}] tools row ${rows.join('; ')}`)
  await ctx.close()
}

// Leg 3 ------------------------------------------------------------------------

async function roundTripLeg(name, browser, base) {
  const css = MODE === 'broken' ? BREAK_EXIT : ''
  for (const s of SCALES) {
    const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { scale: s, css })
    await showView(page, 'Tree')
    await page.waitForSelector('.sr-ft-boxwrap[role="img"]')
    await settle(page)
    if (s === 1) await assertFace(3, page, name, 'still', FIRST, '#panel-family-tree .sr-ft-plane .sr-ft-nm')
    const s0 = await page.evaluate(STATE)
    const still = await page.evaluate(() => {
      const w = document.querySelector('.sr-ft-boxwrap[role="img"]')
      const box = document.querySelector('.sr-ft-box')
      return { named: !!w?.getAttribute('aria-label'), inert: !!box?.hasAttribute('inert'), tabStop: w?.hasAttribute('tabindex') ?? true,
        scroll: box ? box.scrollHeight > box.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(box).overflowY) : true }
    })
    check(3, `${name} phone ${s * 100}% the still is a named image, inert, no tab stop, no scroller`, still.named && still.inert && !still.tabStop && !still.scroll, JSON.stringify(still))
    // The page placed with the opener in view and room both ways, so a
    // restoration to the top or to the end is not mistaken for the offset.
    const place = await page.evaluate(() => {
      const o = [...document.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Open the tree' || b.textContent.trim() === 'Open the tree')
      const max = document.documentElement.scrollHeight - innerHeight
      const top = o.getBoundingClientRect().top + scrollY
      window.scrollTo(0, Math.max(41, Math.min(max - 41, top - innerHeight / 2)))
      return { max, top: Math.round(top) }
    })
    await settle(page)
    const y0 = await page.evaluate(() => Math.round(window.scrollY))
    check(3, `${name} phone ${s * 100}% the page is placed off both ends`, y0 > 40 && y0 < place.max - 40, `page at ${y0}px of ${place.max}px`)
    await openFullScreen(page)
    const s1 = await page.evaluate(STATE)
    check(3, `${name} phone ${s * 100}% open: bar hidden, one Exit, focus on it, box within the window`,
      s1.attr && s1.navbar === 'hidden' && s1.exits === 1 && s1.focus === 'Exit fullscreen' && s1.boxH <= s1.winH,
      `attr ${s1.attr}, bar ${s1.navbar}, exits ${s1.exits}, focus ${s1.focus}, box ${s1.boxH}px of ${s1.winH}px`)
    const bar = page.locator('.sr-ft-host.sr-map-fs-panel').getByRole('toolbar', { name: 'View tools' })
    await bar.getByRole('button', { name: 'Zoom out', exact: true }).click()
    await page.locator('[role="tree"]').focus()
    for (const k of ['ArrowDown', 'ArrowRight', 'ArrowDown']) await page.keyboard.press(k)
    await page.waitForTimeout(300)
    const before = await page.evaluate(STATE)
    await page.keyboard.press('Escape')
    await page.waitForSelector('.sr-ft-host.sr-map-fs-panel', { state: 'detached' })
    await page.waitForTimeout(300)
    const s2 = await page.evaluate(STATE)
    check(3, `${name} phone ${s * 100}% Escape: focus on the opener, the page where it was`,
      s2.focus === 'Open the tree' && !s2.attr && Math.abs(s2.scrollY - y0) <= 1, `focus ${s2.focus}, attr ${s2.attr}, page ${s2.scrollY}px against ${y0}px`)
    await page.getByRole('button', { name: 'Open the tree' }).click()
    await page.waitForSelector('.sr-ft-host.sr-map-fs-panel')
    await page.waitForTimeout(500)
    const s3 = await page.evaluate(STATE)
    const same = before.zoom === s3.zoom && before.active === s3.active && before.openBranches === s3.openBranches && Math.abs(before.boxTop - s3.boxTop) <= 2
    check(3, `${name} phone ${s * 100}% reopen: zoom, selection, expansion and offset kept`, same,
      `zoom ${before.zoom} > ${s3.zoom}, active ${before.active} > ${s3.active}, open ${before.openBranches} > ${s3.openBranches}, top ${before.boxTop} > ${s3.boxTop}`)
    await page.getByRole('button', { name: 'Exit fullscreen' }).click({ timeout: 3000 }).catch(() => {})
    await page.waitForSelector('.sr-ft-host.sr-map-fs-panel', { state: 'detached', timeout: 3000 }).catch(() => {})
    await page.waitForTimeout(300)
    const s4 = await page.evaluate(STATE)
    check(3, `${name} phone ${s * 100}% Exit: focus on the opener, attribute gone, no page scroll sideways`,
      s4.focus === 'Open the tree' && !s4.attr && s4.pageOver <= 0, `focus ${s4.focus}, attr ${s4.attr}, page over ${s4.pageOver}px`)
    console.log(`MEASURE ${name} phone ${s * 100}% round trip page ${y0} > ${s2.scrollY}px (document ${s0.docH} > ${s2.docH}px, still ${s0.stillH} > ${s2.stillH}px), box ${s1.boxH}/${s1.winH}px, view ${before.zoom} ${before.openBranches} open`)
    await ctx.close()
  }
  const { ctx, page } = await open(browser, base, { width: 1280, height: 800 }, { css })
  await showView(page, 'Tree')
  await page.waitForSelector('[role="tree"] [role="treeitem"]')
  const toggle = page.getByRole('button', { name: 'Enter fullscreen' })
  await toggle.focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector('.sr-ft-host.sr-map-fs-panel')
  await page.waitForTimeout(300)
  const d1 = await page.evaluate(STATE)
  check(3, `${name} desktop toggle opens with focus on Exit`, d1.exits === 1 && d1.focus === 'Exit fullscreen', `exits ${d1.exits}, focus ${d1.focus}`)
  await page.keyboard.press('Escape')
  await page.waitForSelector('.sr-ft-host.sr-map-fs-panel', { state: 'detached' })
  await page.waitForTimeout(300)
  const d2 = await page.evaluate(STATE)
  check(3, `${name} desktop Escape returns focus to the toggle`, d2.focus === 'Enter fullscreen' && !d2.attr, `focus ${d2.focus}, attr ${d2.attr}`)
  await ctx.close()
}

// Leg 4 ------------------------------------------------------------------------

const TABLE = () => {
  const list = document.querySelector('.sr-ft-list')
  const lb = list.getBoundingClientRect()
  const ROWS = '.sr-ft-frow, .sr-ft-genus, .sr-ft-sp, .sr-ft-oband, .sr-ft-open-links, .sr-ft-reason'
  let worst = 0
  const range = document.createRange()
  const walker = document.createTreeWalker(list, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!n.textContent.trim() || el.closest('.sr-only')) continue
    let clipped = false
    for (let e = el; e && e !== list; e = e.parentElement) {
      const cs = getComputedStyle(e)
      if (cs.overflowX === 'hidden' && cs.textOverflow === 'ellipsis') { clipped = true; break }
    }
    if (clipped) continue
    const row = el.closest(ROWS)
    const boxes = [lb, ...(row ? [row.getBoundingClientRect()] : [])]
    range.selectNodeContents(n)
    for (const r of range.getClientRects()) {
      if (r.width === 0) continue
      for (const b of boxes) worst = Math.max(worst, b.left - r.left, r.right - b.right)
    }
  }
  const blocks = [...list.querySelectorAll('.sr-ft-fblock .sr-ft-open')].filter(b => !b.closest('.sr-ft-unplaced'))
  const linkFirst = blocks.every(b => b.firstElementChild?.classList.contains('sr-ft-open-links') && b.querySelectorAll('.sr-ft-open-links a').length === 1)
  const links = [...list.querySelectorAll('.sr-ft-open-links a')]
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const minLinkH = links.length ? Math.min(...links.map(a => a.getBoundingClientRect().height)) : 0
  return {
    worst: +worst.toFixed(2), pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    blocks: blocks.length, families: list.querySelectorAll('.sr-ft-frow:not(.sr-ft-frow--unplaced)').length, linkFirst,
    links: links.length, minLinkH: +minLinkH.toFixed(2), wantLinkH: Math.max(44, 2.75 * rem) - 0.5,
    unplacedLinks: list.querySelectorAll('.sr-ft-unplaced .sr-ft-open-links').length,
  }
}

async function tableLeg(name, browser, base, pass) {
  const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { css: (MODE === 'broken' ? BREAK_TABLE : '') + pass.css })
  await showView(page, 'Table')
  await page.locator('.sr-ft-toolbar').getByRole('button', { name: 'Expand all', exact: true }).click()
  await page.waitForFunction(() => {
    const fams = document.querySelectorAll('.sr-ft-list .sr-ft-frow').length
    return fams > 0 && document.querySelectorAll('.sr-ft-list .sr-ft-fblock .sr-ft-open').length >= fams
  }, null, { timeout: 60_000 })
  await assertFace(4, page, name, 'table', pass, '#panel-family-tree .sr-ft-list .sr-ft-genus b')
  const rows = []
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 844 })
    for (const s of SCALES) {
      await setScale(page, s)
      await page.waitForTimeout(100)
      const t = await page.evaluate(TABLE)
      rows.push(`${w}px/${s * 100}%: ink ${t.worst}px, page ${t.pageOver}px, link ${t.minLinkH}px`)
      check(4, `${name} [${pass.id}] table ${w}px ${s * 100}%`,
        t.worst <= 0.5 && t.pageOver <= 0 && t.linkFirst && t.links === t.blocks && t.blocks === t.families && t.unplacedLinks === 0 && t.minLinkH >= t.wantLinkH,
        `ink ${t.worst}px, page over ${t.pageOver}px, ${t.blocks} blocks of ${t.families} families, ${t.links} links first ${t.linkFirst}, Not placed ${t.unplacedLinks}, shortest link ${t.minLinkH}px against ${t.wantLinkH + 0.5}px`)
    }
  }
  console.log(`MEASURE ${name} [${pass.id}] table ${rows.join('; ')}`)
  await ctx.close()
}

// Leg 5 ------------------------------------------------------------------------

// The message, read from the copy module rather than typed here.
const FAMILY_DATA_ERROR = /export const FAMILY_DATA_ERROR = "([^"]+)"/.exec(readFileSync(join(ROOT, 'frontend/src/lib/familyTreeCopy.ts'), 'utf8'))?.[1]
if (!FAMILY_DATA_ERROR) throw new Error('the copy module carries no FAMILY_DATA_ERROR')
const ASSET_CHUNK = /\/assets\/ebird-families-[^/]+\.js$/

const FAILED = msg => {
  // The tab's own panel: other mounted tabs carry their own (empty) regions.
  const panel = document.getElementById('panel-family-tree')
  const region = panel?.querySelector('[role="alert"].sr-tab-load-alert') ?? null
  const frame = region?.closest('.sr-tab-load-alert-frame')
  const buttons = frame ? [...frame.querySelectorAll('button')].filter(b => b.getClientRects().length > 0).map(b => b.textContent.trim()) : []
  return {
    text: region?.textContent ?? null,
    verbatim: region?.textContent === msg,
    buttons,
    insideRegion: region ? region.querySelectorAll('button').length : -1,
    listed: panel ? panel.querySelectorAll('.sr-ft-list, .sr-ft-box, .sr-ft-unplaced, .sr-ft-glance').length : -1,
  }
}

async function assetLeg(name, browser, base) {
  for (const fault of ['abort', '500']) {
    let faulty = true
    let chunk = 0
    const routes = async ctx => {
      await ctx.route(url => ASSET_CHUNK.test(new URL(url).pathname), route => {
        chunk++
        if (!faulty) return route.continue()
        return fault === 'abort' ? route.abort() : route.fulfill({ status: 500, contentType: 'text/plain', body: 'server error' })
      })
    }
    const { ctx, page } = await open(browser, base, { width: 1280, height: 800 }, { routes, tab: false })
    let statusReads = 0
    page.on('request', r => { if (new URL(r.url()).pathname === '/settings/files') statusReads++ })
    const landing = await page.locator('[role="tab"][aria-selected="true"]').first().textContent()
    await openTab(page, { wait: false })
    await page.waitForFunction(m => document.getElementById('panel-family-tree')?.querySelector('[role="alert"].sr-tab-load-alert')?.textContent === m,
      FAMILY_DATA_ERROR, { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(300)
    const f1 = await page.evaluate(FAILED, FAMILY_DATA_ERROR)
    check(5, `${name} chunk ${fault}: the message verbatim, one Reload, nothing listed`,
      f1.verbatim && f1.buttons.length === 1 && f1.buttons[0] === 'Reload' && f1.insideRegion === 0 && f1.listed === 0,
      `text "${f1.text}", actions [${f1.buttons.join(', ')}], ${f1.insideRegion} inside the region, ${f1.listed} listed`)
    check(5, `${name} chunk ${fault}: the chunk was requested once`, chunk === 1, `${chunk} requests`)
    const reads0 = statusReads
    // Hidden behind the tab the app opened on (already mounted), then shown again.
    await page.locator('[role="tab"]', { hasText: landing.trim() }).first().click()
    await page.waitForTimeout(300)
    await openTab(page, { wait: false })
    await page.waitForTimeout(800)
    const f2 = await page.evaluate(FAILED, FAMILY_DATA_ERROR)
    check(5, `${name} chunk ${fault}: hidden and shown, still one request, no files-status read, the alert unchanged`,
      chunk === 1 && statusReads === reads0 && f2.verbatim && f2.buttons.join() === 'Reload' && f2.listed === 0,
      `${chunk} chunk requests, files-status reads ${reads0} > ${statusReads}, text "${f2.text}"`)
    // The fault lifted (left in place under --expect-broken), and Reload pressed.
    if (MODE === 'fixed') faulty = false
    const before = chunk
    const reload = page.locator('#panel-family-tree .sr-tab-load-alert-frame').getByRole('button', { name: 'Reload', exact: true })
    if ((await reload.count()) === 0) {
      check(5, `${name} chunk ${fault}: after Reload the chunk is requested and the roster comes up`, false, 'no Reload control to press')
      await ctx.close()
      continue
    }
    await Promise.all([page.waitForEvent('load', { timeout: 30_000 }), reload.click()])
    const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
    if (await welcome.waitFor({ state: 'visible', timeout: 8000 }).then(() => true, () => false)) await dismissWelcome(welcome)
    await openTab(page, { wait: false })
    const up = await page.waitForSelector('.sr-ft-glance', { timeout: 20_000 }).then(() => true, () => false)
    const tile = up ? await page.evaluate(() => document.querySelector('.sr-ft-tile-value')?.textContent) : null
    const f3 = await page.evaluate(FAILED, FAMILY_DATA_ERROR)
    check(5, `${name} chunk ${fault}: after Reload the chunk is requested and the roster comes up`,
      chunk > before && up && Number(tile?.replace(/,/g, '')) === SPECIES.length && f3.text === '',
      `${chunk - before} new chunk requests, tab up ${up}, species tile ${tile} of ${SPECIES.length}, alert "${f3.text}"`)
    console.log(`MEASURE ${name} chunk ${fault}: ${before} request before Reload, ${chunk - before} after; files-status reads ${reads0} at the alert, ${statusReads} at the end`)
    await ctx.close()
  }
}

// Leg 6 ------------------------------------------------------------------------

const HEADLINE = () => {
  const panel = document.getElementById('panel-family-tree')
  const glance = panel.querySelector('.sr-ft-glance')
  // The wrapper the rule queries; a build without it (1.0.76) is read by the
  // headline's own box, the same width (the card's inner width).
  const wrap = panel.querySelector('.sr-ft-glance-wrap') ?? glance
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const g = glance.getBoundingClientRect(), gcs = getComputedStyle(glance)
  const contentL = g.left + parseFloat(gcs.paddingLeft), contentR = g.right - parseFloat(gcs.paddingRight)
  const range = document.createRange()
  const textBoxes = el => {
    const out = []
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let t = w.nextNode(); t; t = w.nextNode()) {
      if (!t.textContent.trim()) continue
      range.selectNodeContents(t)
      for (const r of range.getClientRects()) if (r.width > 0) out.push({ l: r.left, r: r.right, t: r.top, b: r.bottom })
    }
    return out
  }
  const tiles = [...glance.querySelectorAll('.sr-ft-tile')].map(tile => {
    const value = tile.querySelector('.sr-ft-tile-value'), label = tile.querySelector('dt'), den = tile.querySelector('.sr-ft-tile-den')
    const tb = tile.getBoundingClientRect()
    range.selectNodeContents(value)
    const vr = [...range.getClientRects()].filter(r => r.width > 0)
    const lcs = getComputedStyle(label)
    const lh = lcs.lineHeight === 'normal' ? parseFloat(lcs.fontSize) * 1.25 : parseFloat(lcs.lineHeight)
    range.selectNodeContents(label)
    const labelLines = new Set([...range.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size
    return {
      l: tb.left, t: tb.top, valueRight: vr.length ? Math.max(...vr.map(r => r.right)) : null,
      texts: textBoxes(tile), labelLines, labelTall: label.getBoundingClientRect().height <= lh + 0.5,
      parts: [value?.textContent.trim(), label?.textContent.trim(), den?.children[0]?.textContent.trim(), den?.children[1]?.textContent.trim()],
    }
  })
  const threeUp = tiles.length === 3 && tiles.every(t => Math.abs(t.t - tiles[0].t) < 1) && tiles[1].l > tiles[0].l
  let gap = Infinity, cross = 0, past = 0
  if (threeUp) for (let i = 0; i < 2; i++) gap = Math.min(gap, tiles[i + 1].l - tiles[i].valueRight)
  for (let i = 0; i < tiles.length; i++) {
    for (const a of tiles[i].texts) {
      past = Math.max(past, contentL - a.l, a.r - contentR)
      for (let j = i + 1; j < tiles.length; j++) {
        for (const b of tiles[j].texts) {
          const ox = Math.min(a.r, b.r) - Math.max(a.l, b.l), oy = Math.min(a.b, b.b) - Math.max(a.t, b.t)
          if (ox > 0.5 && oy > 0.5) cross = Math.max(cross, Math.min(ox, oy))
        }
      }
    }
  }
  return {
    wrapRem: +(wrap.getBoundingClientRect().width / rem).toFixed(3), threeUp, tiles: tiles.length,
    gap: gap === Infinity ? null : +gap.toFixed(2), cross: +cross.toFixed(2), past: +past.toFixed(2),
    labelsOneLine: tiles.every(t => t.labelLines === 1 && t.labelTall),
    partsPresent: tiles.every(t => t.parts.every(x => typeof x === 'string' && x.length > 0)),
    count: tiles[0]?.parts[0], pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
}

const HEADLINE_WIDTHS = [320, 360, 390, 430, 640]
async function headlineLeg(name, browser, base, pass) {
  for (const [rosterName, csv] of [['five-digit', FIVE_CSV], ['demo', DEMO_CSV]]) {
    servedCsv = csv
    const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { css: (MODE === 'broken' ? BREAK_HEADLINE : '') + pass.css })
    servedCsv = CSV
    await assertFace(6, page, name, `headline (${rosterName})`, pass, '#panel-family-tree .sr-ft-tile-value')
    const rows = []
    for (const w of HEADLINE_WIDTHS) {
      await page.setViewportSize({ width: w, height: 844 })
      for (const s of SCALES) {
        await setScale(page, s)
        await page.waitForTimeout(80)
        const h = await page.evaluate(HEADLINE)
        const wantThree = h.wrapRem >= 16.5
        const approved = (w === 320 || w === 390) && s === 1
        const ok = h.tiles === 3 && h.threeUp === wantThree && (!h.threeUp || h.gap >= 6) && h.cross === 0 && h.past <= 0.5
          && h.labelsOneLine && h.partsPresent && h.pageOver <= 0 && (!approved || h.threeUp)
        rows.push(`${w}px/${s * 100}%: ${h.wrapRem}rem ${h.threeUp ? 'three-up' : 'one column'}${h.threeUp ? `, gap ${h.gap}px` : ''}${h.cross ? `, CROSS ${h.cross}px` : ''}`)
        check(6, `${name} [${pass.id}] headline ${rosterName} ${w}px ${s * 100}%`, ok,
          `count ${h.count}, wrapper ${h.wrapRem}rem, ${h.threeUp ? 'three-up' : 'one column'} (want ${wantThree ? 'three-up' : 'one column'}), count-to-next-tile ${h.gap}px, tile text crossing ${h.cross}px, past the content edge ${h.past}px, labels one line ${h.labelsOneLine}, parts present ${h.partsPresent}, page over ${h.pageOver}px`)
      }
    }
    console.log(`MEASURE ${name} [${pass.id}] headline ${rosterName} ${rows.join('; ')}`)
    await ctx.close()
  }
}

// Leg 7 ------------------------------------------------------------------------

/** The tree's box as a share of the full-screen panel (%), with a family
 *  selected, at 150% and 200% text. The floor comes from the Tester's round 5
 *  readings (family-rollups-and-tree D-75): the least was 28.9% at 320px and
 *  200% in Inter, against 19.9% on the build before Find's 4rem basis
 *  (be2c667a), when Find dropped under Exit and the toolbar grew. With the
 *  longest-named family selected here the least reads 28.5% (320px, 200%,
 *  Inter and SF alike), so 27% keeps 1.5 points of margin under it (D-77). */
const BOX_SHARE_FLOOR = 27
/** The roster's family whose readout is tallest: the longest common and
 *  scientific names together (Timaliidae, 54 characters, on every 8th
 *  species of the asset). */
const TALLEST_FAMILY = 'Tree-Babblers, Scimitar-Babblers, and Allies'

async function findLeg(name, browser, base, pass) {
  const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { css: (MODE === 'broken' ? BREAK_FIND : '') + pass.css })
  await showView(page, 'Tree')
  await openFullScreen(page)
  await assertFace(7, page, name, 'full-screen toolbar', pass, '#panel-family-tree .sr-ft-host.sr-map-fs-panel .sr-ft-fsbtn')
  // The family with the longest names on this roster selected through Find, so
  // the readout takes its tallest form (its height follows the name's lines).
  const find = page.locator('#panel-family-tree .sr-ft-host.sr-map-fs-panel .sr-ft-find [role="combobox"]')
  await find.fill(TALLEST_FAMILY)
  await page.waitForSelector('#panel-family-tree .sr-ft-host.sr-map-fs-panel [role="option"]', { timeout: 10_000 })
  await find.press('Enter')
  await page.waitForTimeout(400)
  const selected = await page.evaluate(() => {
    const t = document.querySelector('#panel-family-tree .sr-ft-host.sr-map-fs-panel [role="tree"]')
    const a = t.getAttribute('aria-activedescendant')
    return a ? document.getElementById(a)?.getAttribute('aria-label') ?? null : null
  })
  const rows = []
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 844 })
    for (const s of SCALES) {
      await setScale(page, s)
      await page.waitForTimeout(100)
      const f = await page.evaluate(() => {
        const host = document.querySelector('#panel-family-tree .sr-ft-host.sr-map-fs-panel')
        const exit = host.querySelector('.sr-ft-fsbtn').getBoundingClientRect()
        const find = host.querySelector('.sr-ft-find').getBoundingClientRect()
        const box = host.querySelector('.sr-ft-box').getBoundingClientRect()
        const mid = find.top + find.height / 2
        return {
          sameRow: mid > exit.top && mid < exit.bottom, beside: find.left >= exit.right - 0.5,
          findW: +find.width.toFixed(1), boxShare: +(box.height / host.getBoundingClientRect().height * 100).toFixed(1),
        }
      })
      rows.push(`${w}px/${s * 100}%: Find ${f.sameRow && f.beside ? 'beside' : 'BELOW'} Exit, ${f.findW}px, box ${f.boxShare}% of the panel`)
      check(7, `${name} [${pass.id}] Find beside Exit ${w}px ${s * 100}%`, f.sameRow && f.beside,
        `same row ${f.sameRow}, right of Exit ${f.beside}, Find ${f.findW}px wide, the tree's box ${f.boxShare}% of the panel`)
      if (s >= 1.5) {
        check(7, `${name} [${pass.id}] the tree's box holds ${BOX_SHARE_FLOOR}% of the panel, a family selected, ${w}px ${s * 100}%`,
          selected !== null && selected.startsWith(`Family, ${TALLEST_FAMILY}`) && f.boxShare >= BOX_SHARE_FLOOR,
          `selected ${selected ?? 'nothing'}, the tree's box ${f.boxShare}% of the panel (floor ${BOX_SHARE_FLOOR}%)`)
      }
    }
  }
  console.log(`MEASURE ${name} [${pass.id}] full-screen toolbar, ${selected ?? 'nothing'} selected: ${rows.join('; ')}`)
  await ctx.close()
}

// Leg 8 ------------------------------------------------------------------------

async function stillLeg(name, browser, base, pass) {
  const rows = []
  for (const w of [320, 390]) {
    const { ctx, page } = await open(browser, base, { width: w, height: 844 }, { css: (MODE === 'broken' ? BREAK_STILL : '') + pass.css })
    await showView(page, 'Tree')
    await page.waitForSelector('#panel-family-tree .sr-ft-boxwrap.is-still')
    if (w === 320) await assertFace(8, page, name, 'still', pass, '#panel-family-tree .sr-ft-plane .sr-ft-nm')
    for (const s of SCALES) {
      await setScale(page, s)
      await page.waitForTimeout(250)
      const r = await page.evaluate(() => {
        const wrap = document.querySelector('#panel-family-tree .sr-ft-boxwrap.is-still')
        const box = wrap.querySelector('.sr-ft-box'), plane = wrap.querySelector('.sr-ft-plane')
        const b = box.getBoundingClientRect()
        const range = document.createRange()
        let cut = 0, worst = 0, figures = 0
        for (const ct of wrap.querySelectorAll('.sr-ft-ct')) {
          const er = ct.getBoundingClientRect()
          if (er.width === 0 || er.bottom <= b.top || er.top >= b.bottom) continue
          figures++
          range.selectNodeContents(ct)
          for (const t of range.getClientRects()) {
            if (t.width === 0) continue
            const o = Math.max(b.left - t.left, t.right - b.right)
            if (o > 0.5) { cut++; worst = Math.max(worst, o) }
          }
        }
        return { planeW: +plane.getBoundingClientRect().width.toFixed(2), boxW: +b.width.toFixed(2), figures, cut, worst: +worst.toFixed(2) }
      })
      rows.push(`${w}px/${s * 100}%: plane ${r.planeW} of ${r.boxW}px, ${r.figures} figures, ${r.cut} cut`)
      check(8, `${name} [${pass.id}] still figures whole ${w}px ${s * 100}%`, r.planeW <= r.boxW + 0.5 && r.figures > 0 && r.cut === 0,
        `plane ${r.planeW}px in a ${r.boxW}px box, ${r.figures} figures drawn, ${r.cut} past the box (worst ${r.worst}px)`)
    }
    await ctx.close()
  }
  console.log(`MEASURE ${name} [${pass.id}] still ${rows.join('; ')}`)
}

// Legs 9 and 10 ------------------------------------------------------------------

/** Names broken between two letters, each with its word measured alone in the
 *  element's own font against the content width of its row. */
const BREAKS = () => {
  const list = document.querySelector('#panel-family-tree .sr-ft-list')
  const sels = '.sr-ft-sp .sr-birdname-link, .sr-ft-sp .sr-birdname-text, .sr-ft-sp .sr-birdname-sci, .sr-ft-fname .n, .sr-ft-fname .s, .sr-ft-genus b, .sr-ft-genus .alt, .sr-ft-oband h3'
  const range = document.createRange()
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;left:-9999px;top:0'
  document.body.appendChild(probe)
  const measure = (el, word) => {
    const cs = getComputedStyle(el)
    probe.style.font = cs.font
    probe.style.letterSpacing = cs.letterSpacing
    probe.style.textTransform = cs.textTransform
    probe.textContent = word
    return probe.getBoundingClientRect().width
  }
  const breaks = [], wideWords = new Set()
  for (const el of list.querySelectorAll(sels)) {
    if (el.getClientRects().length === 0) continue
    const row = el.closest('.sr-ft-sp, .sr-ft-frow, .sr-ft-genus, .sr-ft-oband')
    const rcs = getComputedStyle(row), rr = row.getBoundingClientRect()
    const rowW = rr.width - parseFloat(rcs.paddingLeft) - parseFloat(rcs.paddingRight)
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let t = tw.nextNode(); t; t = tw.nextNode()) {
      const s = t.textContent
      // A node drawn on one line, no wider than its row, holds no break and no
      // word wider than the row, so only the others are read letter by letter.
      range.selectNodeContents(t)
      const lines = [...range.getClientRects()].filter(x => x.height > 0)
      if (lines.length === 0) continue
      const oneLine = lines.every(x => Math.abs(x.top - lines[0].top) < x.height * 0.5)
      if (oneLine && Math.max(...lines.map(x => x.right)) - Math.min(...lines.map(x => x.left)) <= rowW + 0.01) continue
      // Measured in the text node's own font (a second name sits in a smaller
      // child), and wider by any amount: a word 0.4px wider than its row is
      // broken by the engine, as it must be (Inter's Catamblyrhynchus at 320px
      // and 200%).
      const own = t.parentElement
      for (const word of s.split(/[\s\-/]+/)) if (word && measure(own, word) > rowW + 0.01) wideWords.add(word)
      let prevTop = null
      for (let i = 0; i < s.length; i++) {
        range.setStart(t, i)
        range.setEnd(t, i + 1)
        const r = [...range.getClientRects()].find(x => x.height > 0)
        if (!r) continue
        if (prevTop !== null && r.top > prevTop + r.height * 0.5 && !/[\s\-/]/.test(s[i - 1]) && !/\s/.test(s[i])) {
          const word = (s.slice(0, i).match(/[^\s\-/]+$/)?.[0] ?? '') + (s.slice(i).match(/^[^\s\-/]+/)?.[0] ?? '')
          breaks.push({ word, wider: measure(own, word) > rowW + 0.01 })
        }
        prevTop = r.top
      }
    }
  }
  probe.remove()
  return { breaks, wideWords: [...wideWords] }
}

/** The species rows' parts: overlaps, parts outside the row, missing or
 *  unnamed marks, and the narrow form's state against the list's width. */
const ROWS = () => {
  const list = document.querySelector('#panel-family-tree .sr-ft-list')
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const range = document.createRange()
  let overlaps = 0, outside = 0, unnamed = 0, small = 0, rows = 0
  const boxesOf = el => {
    if (!el) return []
    range.selectNodeContents(el)
    return [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0)
  }
  for (const row of list.querySelectorAll('.sr-ft-sp')) {
    if (row.getClientRects().length === 0) continue
    rows++
    const rr = row.getBoundingClientRect()
    const media = row.querySelector('.sr-lfl-media')
    const marks = [...row.querySelectorAll('a')]
    if (!media || !media.getAttribute('aria-label') || marks.length !== 2 || marks.some(a => !a.getAttribute('aria-label'))) unnamed++
    // A mark's target is its anchor (5px of padding round a 14px slot, so two
    // targets meet by design); what is drawn, and must not overlap, is the slot.
    for (const a of marks) { const b = a.getBoundingClientRect(); if (b.width < 24 - 0.5 || b.height < 24 - 0.5) small++ }
    const slots = marks.map(a => (a.querySelector('.sr-favicon-slot') ?? a).getBoundingClientRect())
    const groups = [
      boxesOf(row.querySelector('.sr-birdname-link, .sr-birdname-text')),
      boxesOf(row.querySelector('.sr-birdname-sci')),
      ...slots.map(r => [r]),
      media ? [media.getBoundingClientRect()] : [],
    ]
    const parts = groups.flat()
    for (const p of parts) if (p.left < rr.left - 0.5 || p.right > rr.right + 0.5 || p.top < rr.top - 0.5 || p.bottom > rr.bottom + 0.5) outside++
    for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) {
      for (const a of groups[i]) for (const b of groups[j]) {
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5) overlaps++
      }
    }
  }
  const first = list.querySelector('.sr-ft-sp .sr-birdname')
  const frow = list.querySelector('.sr-ft-frow')
  return {
    rows, overlaps, outside, unnamed, small,
    listRem: +(list.getBoundingClientRect().width / rem).toFixed(3),
    narrowSpecies: first ? getComputedStyle(first).display === 'contents' : null,
    narrowFamily: frow ? getComputedStyle(frow).display === 'flex' : null,
    pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
}

/** Open the table in a Names state with media and codes served: every family
 *  open, or (leg 10, which reads family rows only) every family closed. */
async function openTable(browser, base, css, names, viewport, { expand = true } = {}) {
  const { ctx, page } = await open(browser, base, viewport, { css })
  await showView(page, 'Table')
  await page.locator('#panel-family-tree .sr-ft-namesseg').getByRole('button', { name: names, exact: true }).click()
  if (!expand) {
    await page.waitForSelector('#panel-family-tree .sr-ft-tab[data-media="on"] .sr-ft-list .sr-ft-frow', { timeout: 60_000 })
    return { ctx, page }
  }
  await page.locator('#panel-family-tree .sr-ft-toolbar').getByRole('button', { name: 'Expand all', exact: true }).click()
  await page.waitForFunction(() => {
    const l = document.querySelector('#panel-family-tree .sr-ft-list')
    const f = l.querySelectorAll('.sr-ft-frow').length
    return f > 0 && l.querySelectorAll('.sr-ft-fblock .sr-ft-open').length >= f
  }, null, { timeout: 60_000 })
  await page.waitForSelector('#panel-family-tree .sr-ft-list .sr-lfl-media', { timeout: 30_000 })
  await page.waitForFunction(() => document.querySelectorAll('#panel-family-tree .sr-ft-sp a').length > 0, null, { timeout: 30_000 })
  return { ctx, page }
}

/** The long words' roster: a laughingthrush, a scythebill, Green-capped
 *  Tanager, Crowned Slaty Flycatcher, a boatbill and a flamingo, with a media
 *  export built on the demo export's own row form. */
const LONG_NAMES = ['Chestnut-crowned Laughingthrush', 'Red-billed Scythebill', 'Green-capped Tanager', 'Crowned Slaty Flycatcher', 'Yellow-breasted Boatbill', 'Greater Flamingo']
const LONG = FIVE_DIGIT.filter(([cn]) => LONG_NAMES.includes(cn))
const LONG_CSV = [HEADER, ...LONG.map(([cn, sci], i) => [
  `S9${String(900000000 + i).padStart(9, '0')}`, cn, sci, String(i), '1', 'US-NY', 'Kings', 'L100001', 'Prospect Park', '40.66', '-73.97',
  '2024-01-03', '07:15 AM', 'Traveling', '60', '1', '1.2', '', '1', '', '', '', '',
].map(q).join(','))].join('\n') + '\n'
const ML_LINES = DEMO_ML.split('\n')
const ML_TEMPLATE_REST = ML_LINES[1].split(',').slice(4).join(',')
const LONG_ML = [ML_LINES[0], ...LONG.map(([cn, sci], i) =>
  [String(613000000 + i), 'Photo', q(cn), q(sci), ML_TEMPLATE_REST.replace('S9000000000', `S9${String(900000000 + i).padStart(9, '0')}`)].join(','))].join('\n') + '\n'

const NAMES_STATES = ['Common', 'Both', 'Scientific']
const NARROW_WIDTHS = [320, 360, 390, 430]
async function narrowLeg(name, browser, base, pass) {
  servedCodes = true
  try {
    servedMl = DEMO_ML
    servedCsv = DEMO_CSV
    for (const names of NAMES_STATES) {
      const { ctx, page } = await openTable(browser, base, (MODE === 'broken' ? BREAK_NARROW : '') + pass.css, names, { width: 390, height: 844 })
      if (names === 'Both') await assertFace(9, page, name, 'narrow rows', pass, '#panel-family-tree .sr-ft-sp .sr-birdname-link')
      const rows = []
      for (const w of NARROW_WIDTHS) {
        await page.setViewportSize({ width: w, height: 844 })
        for (const s of SCALES) {
          await setScale(page, s)
          await page.waitForTimeout(80)
          const b = await page.evaluate(BREAKS)
          const r = await page.evaluate(ROWS)
          const inside = b.breaks.filter(x => !x.wider)
          const wantNarrow = r.listRem < 15
          const ok = inside.length === 0 && r.rows > 0 && r.overlaps === 0 && r.outside === 0 && r.unnamed === 0 && r.small === 0 && r.pageOver <= 0
            && r.narrowSpecies === wantNarrow && r.narrowFamily === wantNarrow
          rows.push(`${w}px/${s * 100}%: list ${r.listRem}rem ${r.narrowSpecies ? 'narrow' : 'wide'}, ${b.breaks.length} breaks (${inside.length} inside a word that fits)`)
          check(9, `${name} [${pass.id}] narrow rows ${names} ${w}px ${s * 100}%`, ok,
            `list ${r.listRem}rem, narrow form ${r.narrowSpecies}/${r.narrowFamily} (want ${wantNarrow}), ${inside.length} names broken inside a word that fits the row (${inside.slice(0, 3).map(x => x.word).join(', ')}), ${r.rows} rows, ${r.overlaps} overlaps, ${r.outside} parts outside their row, ${r.unnamed} rows missing a named mark, ${r.small} marks under 24px, page over ${r.pageOver}px`)
        }
      }
      console.log(`MEASURE ${name} [${pass.id}] narrow rows ${names}: ${rows.join('; ')}`)
      await ctx.close()
    }
    // The long words, at 320px and 200%.
    servedMl = LONG_ML
    servedCsv = LONG_CSV
    for (const names of NAMES_STATES) {
      const { ctx, page } = await openTable(browser, base, (MODE === 'broken' ? BREAK_NARROW : '') + pass.css, names, { width: 320, height: 844 })
      await setScale(page, 2)
      await page.waitForTimeout(150)
      const b = await page.evaluate(BREAKS)
      const broken = [...new Set(b.breaks.map(x => x.word))].sort()
      const wide = [...b.wideWords].sort()
      const ok = names === 'Scientific'
        ? broken.length === wide.length && broken.every((w, i) => w === wide[i]) && b.breaks.every(x => x.wider)
        : b.breaks.length === 0
      check(9, `${name} [${pass.id}] long words ${names} 320px 200%`, ok,
        `broken inside a word: [${broken.join(', ')}]; words wider than their row: [${wide.join(', ')}]`)
      console.log(`MEASURE ${name} [${pass.id}] long words ${names} 320px 200%: broken [${broken.join(', ')}], wider than the row [${wide.join(', ')}]`)
      await ctx.close()
    }
  } finally {
    servedMl = null
    servedCodes = false
    servedCsv = CSV
  }
}

// The two stretches measured pixel by pixel (D-80): the list is over 44em and
// at most 50em in windows of 815 to 903px (at 904 the side menu widens) and
// 971 to 1066px; each edge is read on both sides.
/** Leg 10's hovered-row checks per pass: two forms, collapsed and expanded,
 *  light and dark. */
const HOVER_CHECKS = 2 * 2 * 2
const TABLET_WIDTHS = [812, 814, 815, 820, 834, 860, 880, 903, 904, 940, 970, 971, 980, 1000, 1024, 1032, 1050, 1066, 1067, 1100]
async function familyNamesLeg(name, browser, base, pass) {
  servedCodes = true
  servedMl = DEMO_ML
  servedCsv = DEMO_CSV
  try {
    for (const names of NAMES_STATES) {
      const { ctx, page } = await openTable(browser, base, (MODE === 'broken' ? BREAK_FAMILY : '') + pass.css, names, { width: 1024, height: 800 }, { expand: false })
      if (names === 'Both') await assertFace(10, page, name, 'family names', pass, '#panel-family-tree .sr-ft-fname .n')
      const rows = []
      for (const w of TABLET_WIDTHS) {
        await page.setViewportSize({ width: w, height: 800 })
        await settle(page)
        await page.waitForTimeout(60)
        const b = await page.evaluate(BREAKS)
        const fam = b.breaks.filter(x => !x.wider)
        const r = await page.evaluate(() => {
          const l = document.querySelector('#panel-family-tree .sr-ft-list')
          const cols = document.querySelector('#panel-family-tree .sr-ft-cols')
          const media = document.querySelector('#panel-family-tree .sr-ft-tab')?.getAttribute('data-media')
          const names = [...l.querySelectorAll('.sr-ft-fname .n')].filter(n => n.getClientRects().length > 0).length
          return { em: +(l.getBoundingClientRect().width / 16).toFixed(2), form: cols && getComputedStyle(cols).display !== 'none' ? 'columns' : 'stacked', media, names }
        })
        rows.push(`${w}px: ${r.em}em ${r.form}, ${fam.length} breaks`)
        // Non-vacuity: the media export is loaded and the family names are drawn.
        check(10, `${name} [${pass.id}] family names whole ${names} ${w}px 100%`, fam.length === 0 && r.media === 'on' && r.names > 0,
          `list ${r.em}em (${r.form}), media ${r.media}, ${r.names} family names drawn, ${fam.length} broken inside a word that fits (${fam.slice(0, 3).map(x => x.word).join(', ')})`)
      }
      console.log(`MEASURE ${name} [${pass.id}] family names ${names} at 100%: ${rows.join('; ')}`)
      if (names === 'Both') await hoverContrast(name, page, pass)
      await ctx.close()
    }
  } finally {
    servedMl = null
    servedCodes = false
    servedCsv = CSV
  }
}

/** Every piece of text on a family row under a real pointer, against what is
 *  behind it (D-83, D-85, D-86): WCAG's contrast, 4.5:1 or more. */
const ROW_CONTRAST = (idx) => {
  const row = [...document.querySelectorAll('#panel-family-tree .sr-ft-list .sr-ft-frow')].filter(r => r.getClientRects().length > 0)[idx]
  const parse = c => { const m = /rgba?\(([^)]+)\)/.exec(c); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 } }
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  const lum = c => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b)
  const over = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 })
  const behind = el => {
    const layers = []
    for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break } }
    return layers.reverse().reduce((acc, l) => over(l, acc), { r: 255, g: 255, b: 255, a: 1 })
  }
  const texts = []
  const tw = document.createTreeWalker(row, NodeFilter.SHOW_TEXT)
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    const el = t.parentElement
    if (!t.textContent.trim() || el.closest('.sr-only') || el.getClientRects().length === 0) continue
    const bg = behind(el)
    const fg0 = parse(getComputedStyle(el).color)
    const fg = fg0.a < 1 ? over(fg0, bg) : fg0
    const a = lum(fg), b = lum(bg)
    texts.push({ text: t.textContent.trim().slice(0, 20), ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) })
  }
  return { hovered: row.matches(':hover'), expanded: row.getAttribute('aria-expanded') === 'true', second: !!row.querySelector('.sr-ft-fname .s'), texts }
}
async function hoverContrast(name, page, pass) {
  const theme0 = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  for (const [w, form] of [[1100, 'columns'], [1024, 'stacked']]) {
    await page.setViewportSize({ width: w, height: 800 })
    await settle(page)
    // The first row with a second name and, where one is drawn, a zero figure.
    const idx = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('#panel-family-tree .sr-ft-list .sr-ft-frow')].filter(r => r.getClientRects().length > 0)
      const i = rows.findIndex(r => r.querySelector('.sr-ft-fname .s') && (r.querySelector('.sr-ft-mc.is-zero') || [...r.querySelectorAll('.sr-ft-mline b')].some(b => b.textContent.trim() === '0')))
      return i >= 0 ? i : Math.max(0, rows.findIndex(r => r.querySelector('.sr-ft-fname .s')))
    })
    const row = page.locator('#panel-family-tree .sr-ft-list .sr-ft-frow:visible').nth(idx)
    for (const state of ['collapsed', 'expanded']) {
      if (state === 'expanded') { await row.click(); await page.waitForTimeout(200) }
      await row.scrollIntoViewIfNeeded()
      for (const theme of ['light', 'dark']) {
        await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme)
        const box = await row.boundingBox()
        await page.mouse.move(box.x + Math.min(box.width - 4, 60), box.y + box.height / 2)
        await page.waitForTimeout(200)
        const r = await page.evaluate(ROW_CONTRAST, idx)
        const low = r.texts.filter(x => x.ratio < 4.5)
        const least = Math.min(...r.texts.map(x => x.ratio))
        check(10, `${name} [${pass.id}] hovered family row ${form} ${state} ${theme}`, r.hovered && r.second && r.expanded === (state === 'expanded') && r.texts.length > 2 && low.length === 0,
          `hovered ${r.hovered}, expanded ${r.expanded}, second name ${r.second}, ${r.texts.length} pieces of text, least ${least.toFixed(2)}:1, under 4.5:1: ${low.map(x => `${x.text} ${x.ratio.toFixed(2)}`).join(', ') || 'none'}`)
        await page.mouse.move(1, 1)
      }
    }
    await row.click()
  }
  await page.evaluate(t => (t === null ? document.documentElement.removeAttribute('data-theme') : document.documentElement.setAttribute('data-theme', t)), theme0)
}

// -- The run --------------------------------------------------------------------

const threshold = await captionThreshold()
const STACK = await fontStack()
console.log(`built tools-row threshold ${threshold}rem; ${SPECIES.length} species in the backup (mode: expect-${MODE}); font stack ${STACK.first}, ${STACK.rest}; asked for ${ASK_FIRST ? STACK.first : 'no face'}${process.env.SR_VERIFY_FACE_DIR ? ' (served from SR_VERIFY_FACE_DIR)' : ''}`)
const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
const started = Date.now()
/** Whether this machine's page has the first family at all, read once per engine. */
async function firstAvailable(browser) {
  const ctx = await browser.newContext()
  try {
    const page = await ctx.newPage()
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => document.fonts.ready)
    return (await page.evaluate(FACE_TEST, { sel: 'body', first: STACK.first }))?.available === true
  } finally { await ctx.close() }
}
const FIRST = { id: 'first', css: '' }
const FALLBACK = { id: 'fallback', css: `:root { --font-sans: ${STACK.rest} !important; }` }
let passCount = 0
// Per engine: leg 1 eight presses, leg 2 eight settings per face, leg 3 six
// checks at each of four scales plus two on the desktop, leg 4 eight settings
// per face, leg 5 four checks for each of two faults, leg 6 two rosters at five
// widths and four scales per face, leg 7 two widths and four scales plus its
// four box floors per face, leg 8 two widths and four scales per face. The text legs' counts are
// set once the faces each engine offers are known (below).
const PER_ENGINE = [8, 8, 26, 8, 8, 2 * HEADLINE_WIDTHS.length * 4, 12, 8,
  NAMES_STATES.length * (NARROW_WIDTHS.length * 4 + 1), NAMES_STATES.length * TABLET_WIDTHS.length + HOVER_CHECKS]
const EXPECTED = PER_ENGINE.map(() => 0)
try {
  for (const [name, engine] of ENGINES) {
    const browser = await engine.launch()
    try {
      const has = await firstAvailable(browser)
      // Two faces where both can be had and the fallback is a shipped one.
      const passes = has && FALLBACK_SHIPPED ? [FIRST, FALLBACK] : [FIRST]
      if (!has) console.log(`MEASURE ${name} face: ${STACK.first} is not available here${ASK_FIRST ? ', though the run was asked for it' : ' and the run was not asked for it'}, so the text legs measured the fallback only`)
      if (has && !FALLBACK_SHIPPED) console.log(`MEASURE ${name} face: the fallback here is not a face a shipped platform draws, so the text legs measured ${STACK.first} only`)
      passCount += passes.length
      PER_ENGINE.forEach((n, i) => {
        if (LEGS_RUN.includes(i + 1)) EXPECTED[i] += n * ([1, 3, 5, 6, 7, 8, 9].includes(i) ? passes.length : 1)
      })
      if (LEGS_RUN.includes(1)) await focusLeg(name, browser, base)
      for (const pass of passes) {
        if (LEGS_RUN.includes(2)) await captionsLeg(name, browser, base, threshold, pass)
      }
      if (LEGS_RUN.includes(3)) await roundTripLeg(name, browser, base)
      for (const pass of passes) {
        if (LEGS_RUN.includes(4)) await tableLeg(name, browser, base, pass)
      }
      if (LEGS_RUN.includes(5)) await assetLeg(name, browser, base)
      for (const pass of passes) {
        if (LEGS_RUN.includes(6)) await headlineLeg(name, browser, base, pass)
        if (LEGS_RUN.includes(7)) await findLeg(name, browser, base, pass)
        if (LEGS_RUN.includes(8)) await stillLeg(name, browser, base, pass)
        if (LEGS_RUN.includes(9)) await narrowLeg(name, browser, base, pass)
        if (LEGS_RUN.includes(10)) await familyNamesLeg(name, browser, base, pass)
      }
    } finally {
      await browser.close()
    }
  }
} finally {
  await close()
}

const seconds = Math.round((Date.now() - started) / 1000)
const LEGS = ['focus at a limit', 'tools row captions', 'still and round trip', 'table at phone widths', 'a failed family asset',
  'headline tile against tile', 'Find beside Exit', 'the still\'s figures whole', 'the table\'s narrow form', 'family names whole at 100%, and the hovered row']
for (let i = 0; i < LEGS.length; i++) {
  if (!LEGS_RUN.includes(i + 1)) continue
  const full = legMeasured[i] === EXPECTED[i]
  console.log(`MEASURE leg ${i + 1} (${LEGS[i]}): ${legMeasured[i]} of ${EXPECTED[i]} declared checks measured, ${legFailures[i]} failed`)
  if (!full) failures.push(`leg ${i + 1} measured ${legMeasured[i]} of ${EXPECTED[i]}`)
}
console.log(`MEASURE faces: ${passCount} engine-face passes, ${facesChecked} face assertions`)
const hermetic = thirdParty.length === 0
console.log(`${hermetic ? 'PASS' : 'FAIL'}  no request left the page for a third party  ${thirdParty.length} backend-forwarded third-party paths answered by the stub (${[...new Set(thirdParty)].slice(0, 5).join(', ')}); ${refusedHosts} requests to other hosts refused in the browser`)
console.log(`MEASURE the tab's codes batch: ${taxonomyCalls.length} /taxonomy requests answered by the stub with a 404 (legs 1 to 8), ${codesAnswered} codes batches answered from the bundled taxonomy (legs 9 and 10)`)
if (!hermetic) failures.push('a backend-forwarded third-party path was asked for')
if (MODE === 'fixed') {
  console.log(`${legMeasured.reduce((a, b) => a + b, 0)} checks in ${seconds} s; ${failures.length ? `FAILED: ${failures.length}` : 'all green'}`)
  process.exit(failures.length ? 1 : 0)
} else {
  const sees = LEGS_RUN.every(l => legFailures[l - 1] > 0)
  console.log(`expect-broken: ${legFailures.map((n, i) => `leg ${i + 1} ${n} of ${legMeasured[i]} failed`).join(', ')}; ${seconds} s`)
  console.log(failures.length ? `HARNESS CANNOT CERTIFY: ${failures.join('; ')}` : sees ? 'HARNESS DISCRIMINATES' : 'HARNESS IS BLIND: a leg saw no failure with its defect forced')
  process.exit(sees && failures.length === 0 ? 0 : 1)
}
