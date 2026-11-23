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
//
// Lines starting `MEASURE` are the readings recorded in the run's evidence. The
// run declares how many configurations each leg measures and fails on a short
// count. `--expect-broken` forces one defect per leg (a tool natively disabled
// at its limit, the captions forced on, the panel's Exit hidden, the table held
// wider than a phone, the asset's fault left in place across the Reload) and
// must then see a failure in EVERY leg, so the harness is shown able to see
// what it guards.
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
// server answers from its own taxonomy, is counted and reported apart. Every
// other host is refused in the browser and counted.
//
// WHERE IT LIVES (schema 17): held in `pipeline/family-rollups-and-tree/held/`
// until the user approved the `website/` change at the 1.0.76 sign-off, then
// moved here, where `run.mjs` picks it up. It still finds the shared helpers
// from either place:
//
//   node website/tools/verify/verify-family-tree.mjs [dist] [--expect-broken] [--legs=1,2,3,4,5]

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
// `--legs=1,3` runs only those legs (a development aid; the gate runs all four).
const LEGS_RUN = (process.argv.find(a => a.startsWith('--legs=')) ?? '--legs=1,2,3,4,5').slice(7).split(',').map(Number)

// -- The synthetic backup: every 8th species of the family asset ---------------
// Real names, so each is placed; every order the asset has is reached, so the
// tree is as wide as a real life list's and the table holds every long family
// name the asset carries in its first species.

function roster() {
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
          if (typeof name === 'string' && n++ % 8 === 0) out.push([name, `${genus} ${list[i + 1]}`])
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

/** Backend paths a real server answers by asking a third party. */
const THIRD_PARTY = /^\/(map|checklists|hotspot|weather|tide|nominatim|media)(\/|$)|^\/version\/check/
/** Requests to such a path that reached the stub: the run fails on any. */
const thirdParty = []
/** The tab's designed codes batch, answered by a real server from its own taxonomy. */
const taxonomyCalls = []
function stubBackend(p, _req, res) {
  if (p === '/settings/files') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(FILES_STATUS)); return true }
  if (p === '/settings/files/ebird') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(CSV); return true }
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

// -- Measurement ---------------------------------------------------------------

const failures = []
const legFailures = [0, 0, 0, 0, 0]
const legMeasured = [0, 0, 0, 0, 0]
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

async function captionsLeg(name, browser, base, threshold) {
  const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { css: MODE === 'broken' ? BREAK_CAPTIONS : '' })
  await showView(page, 'Tree')
  await openFullScreen(page)
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
      check(2, `${name} tools row ${w}px ${s * 100}%`, ok,
        `row ${c.rowRem}rem (threshold ${threshold}rem), captions ${c.shown} of ${c.cells}, ink ${c.worstInk}px, lines ${c.maxLines}, smallest cell ${c.minW}x${c.minH}px`)
    }
  }
  console.log(`MEASURE ${name} tools row ${rows.join('; ')}`)
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

async function tableLeg(name, browser, base) {
  const { ctx, page } = await open(browser, base, { width: 390, height: 844 }, { css: MODE === 'broken' ? BREAK_TABLE : '' })
  await showView(page, 'Table')
  await page.locator('.sr-ft-toolbar').getByRole('button', { name: 'Expand all', exact: true }).click()
  await page.waitForFunction(() => {
    const fams = document.querySelectorAll('.sr-ft-list .sr-ft-frow').length
    return fams > 0 && document.querySelectorAll('.sr-ft-list .sr-ft-fblock .sr-ft-open').length >= fams
  }, null, { timeout: 60_000 })
  const rows = []
  for (const w of [320, 390]) {
    await page.setViewportSize({ width: w, height: 844 })
    for (const s of SCALES) {
      await setScale(page, s)
      await page.waitForTimeout(100)
      const t = await page.evaluate(TABLE)
      rows.push(`${w}px/${s * 100}%: ink ${t.worst}px, page ${t.pageOver}px, link ${t.minLinkH}px`)
      check(4, `${name} table ${w}px ${s * 100}%`,
        t.worst <= 0.5 && t.pageOver <= 0 && t.linkFirst && t.links === t.blocks && t.blocks === t.families && t.unplacedLinks === 0 && t.minLinkH >= t.wantLinkH,
        `ink ${t.worst}px, page over ${t.pageOver}px, ${t.blocks} blocks of ${t.families} families, ${t.links} links first ${t.linkFirst}, Not placed ${t.unplacedLinks}, shortest link ${t.minLinkH}px against ${t.wantLinkH + 0.5}px`)
    }
  }
  console.log(`MEASURE ${name} table ${rows.join('; ')}`)
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

// -- The run --------------------------------------------------------------------

const threshold = await captionThreshold()
console.log(`built tools-row threshold ${threshold}rem; ${SPECIES.length} species in the backup (mode: expect-${MODE})`)
const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
const started = Date.now()
// Per engine: leg 1 eight presses, leg 2 eight settings, leg 3 six checks at
// each of four scales plus two on the desktop, leg 4 eight settings, leg 5
// four checks for each of two faults.
const EXPECTED = [8, 8, 26, 8, 8].map((n, i) => (LEGS_RUN.includes(i + 1) ? n * ENGINES.length : 0))
try {
  for (const [name, engine] of ENGINES) {
    const browser = await engine.launch()
    try {
      if (LEGS_RUN.includes(1)) await focusLeg(name, browser, base)
      if (LEGS_RUN.includes(2)) await captionsLeg(name, browser, base, threshold)
      if (LEGS_RUN.includes(3)) await roundTripLeg(name, browser, base)
      if (LEGS_RUN.includes(4)) await tableLeg(name, browser, base)
      if (LEGS_RUN.includes(5)) await assetLeg(name, browser, base)
    } finally {
      await browser.close()
    }
  }
} finally {
  await close()
}

const seconds = Math.round((Date.now() - started) / 1000)
const LEGS = ['focus at a limit', 'tools row captions', 'still and round trip', 'table at phone widths', 'a failed family asset']
for (let i = 0; i < LEGS.length; i++) {
  if (!LEGS_RUN.includes(i + 1)) continue
  const full = legMeasured[i] === EXPECTED[i]
  console.log(`MEASURE leg ${i + 1} (${LEGS[i]}): ${legMeasured[i]} of ${EXPECTED[i]} declared checks measured, ${legFailures[i]} failed`)
  if (!full) failures.push(`leg ${i + 1} measured ${legMeasured[i]} of ${EXPECTED[i]}`)
}
const hermetic = thirdParty.length === 0
console.log(`${hermetic ? 'PASS' : 'FAIL'}  no request left the page for a third party  ${thirdParty.length} backend-forwarded third-party paths answered by the stub (${[...new Set(thirdParty)].slice(0, 5).join(', ')}); ${refusedHosts} requests to other hosts refused in the browser`)
console.log(`MEASURE the tab's codes batch: ${taxonomyCalls.length} /taxonomy requests across the run, answered by the stub with a 404`)
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
