// QA supplementary probe for life-list-filter-toggle-state (The Tester).
//
// Covers what the Engineer's probe-filter-pill-state.mjs does not:
//   1. The Multimedia tab's REAL register controls, where that probe used a
//      fixture: "No photo" (negative), "Is Target" (target), "Has photo"
//      (pressed), the "Sort order" segment group and the "Show subspecies"
//      switch. Touch at 390px and mouse at 1280px.
//   2. Tablet-size touch (820x1180 portrait, 1180x820 landscape) on the Life
//      Lists Media pills and the Multimedia pills.
//   3. A FULL request census: every request the browser makes and every path
//      the loopback server is asked for, classified, not only the API prefixes.
//
// Same stub backend shape as the Engineer's probe (written out again here, not
// imported, so this run does not lean on that file). No key stored, every
// non-loopback request aborted, the stub never forwards.
//
//   node qa-probe-real-surfaces.mjs <distDir>                 # expect all green
//   node qa-probe-real-surfaces.mjs <preFixDist> --expect-broken
//
// --expect-broken passes when the pre-fix build fails the WebKit touch kinds and
// the mouse-selected kind while mouse-hover, census and config stay green.

import { resolve } from 'node:path'
import { serveDist } from '../../../website/tools/verify/serveDist.mjs'
import { requirePlaywright } from '../../../website/tools/verify/playwright.mjs'
import { dismissWelcome } from '../../../website/tools/verify/dismissWelcome.mjs'

const { chromium, webkit } = requirePlaywright()
const DIST = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'frontend/dist')
const MODE = process.argv.includes('--expect-broken') ? 'broken' : 'fixed'

const EBIRD_CSV = [
  'Submission ID,Common Name,Scientific Name,State/Province,Date,Location,Count,Breeding Code,Species Comments,ML Catalog Numbers,Location ID,Latitude,Longitude',
  "S920000001,Anna's Hummingbird,Calypte anna,US-CA,2025-03-02,Back Garden,1,,,,L200001,37.8044,-122.2712",
  'S920000002,Mallard,Anas platyrhynchos,US-CA,2025-04-10,Mill Pond,2,,,,L200002,37.9001,-122.3011',
  'S920000003,Song Sparrow,Melospiza melodia,US-CA,2025-05-11,Mill Pond,1,,,,L200002,37.9001,-122.3011',
  'S920000004,American Robin,Turdus migratorius,US-CA,2025-06-12,Back Garden,3,,,,L200001,37.8044,-122.2712',
].join('\n')
const ML_CSV = [
  'ML Catalog Number,Common Name,Scientific Name,Format,Date,Caption,eBird Checklist ID',
  "ML600001,Anna's Hummingbird,Calypte anna,Photo,2025-03-02,,S920000001",
  'ML600002,Mallard,Anas platyrhynchos,Photo,2025-04-10,,S920000002',
  'ML600003,Song Sparrow,Melospiza melodia,Audio,2025-05-11,,S920000003',
  'ML600004,American Robin,Turdus migratorius,Video,2025-06-12,,S920000004',
].join('\n')
const FILES_STATUS = {
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T00:00:00Z' },
  ml: { filename: 'ML__2026-06-01_123456.csv', uploadedAt: '2026-06-01T00:00:00Z' },
}

// ── Census: every path the server is asked for ─────────────────────────────
const served = new Map()
const STATIC = /^\/(?:$|index\.html$|assets\/|mapassets\/|favicon|icons\.svg|manifest|apple-touch|robots)/
// Broad on purpose: anything that could be an eBird-backed route on the real backend.
const EBIRD_BACKED = /^\/(?:checklists|map|ebird|hotspots?|region|species|recent|notable|nearby|obs|targets|geo|taxonomy-history|lifers?)\b/
function stub(p, _req, res) {
  served.set(p, (served.get(p) ?? 0) + 1)
  const json = body => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (p === '/settings/files') { json(FILES_STATUS); return true }
  if (p === '/settings/files/ebird') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(EBIRD_CSV); return true }
  if (p === '/settings/files/ml') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(ML_CSV); return true }
  if (p === '/settings/keys') { json({ ebird: null, openweather: null }); return true }
  if (p === '/media/embed-status') { json({ gated: true }); return true }
  if (!STATIC.test(p)) { res.writeHead(404); res.end('not found'); return true }
  return false
}

// ── Looks ───────────────────────────────────────────────────────────────────
const LOOKS = {
  pillOff:   { bg: 'var(--sr-surface)', border: 'var(--sr-border)', fg: 'var(--sr-text-muted)', weight: '500' },
  pillOn:    { bg: 'var(--sr-accent-bg)', border: 'var(--sr-accent-border)', fg: 'var(--sr-accent)', weight: '600' },
  pillHover: { bg: 'var(--sr-surface-subtle)', border: 'var(--sr-border-medium)', fg: 'var(--sr-text)', weight: '500' },
  negative:  { bg: 'var(--sr-error-bg)', border: 'var(--sr-error-overlay)', fg: 'var(--sr-error)', weight: '600' },
  target:    { bg: 'var(--sr-is-target-bg)', border: 'var(--sr-is-target-border)', fg: 'var(--sr-is-target-text)', weight: '600' },
  segOff:    { bg: 'transparent', fg: 'var(--sr-text-muted)', weight: '500' },
  segOn:     { bg: 'var(--sr-accent-bg)', fg: 'var(--sr-accent)', weight: '600' },
  segHover:  { bg: 'var(--sr-surface-subtle)', fg: 'var(--sr-text)', weight: '500' },
  switchRest:  { bg: 'var(--sr-surface)', border: 'var(--sr-border)' },
  switchHover: { bg: 'var(--sr-surface-subtle)', border: 'var(--sr-border-medium)' },
}
const RESOLVE = looks => {
  const probe = document.createElement('span')
  document.body.appendChild(probe)
  const color = v => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color }
  const out = {}
  for (const [name, look] of Object.entries(looks)) {
    out[name] = {}
    for (const [k, v] of Object.entries(look)) out[name][k] = k === 'weight' ? v : color(v)
  }
  probe.remove()
  return out
}
const READ_EL = async el => {
  const frame = () => new Promise(r => requestAnimationFrame(() => r()))
  await frame(); await frame()
  await Promise.race([
    Promise.all(el.getAnimations().map(a => a.finished.catch(() => {}))),
    new Promise(r => setTimeout(r, 2000)),
  ])
  await frame()
  const cs = getComputedStyle(el)
  return {
    bg: cs.backgroundColor, border: cs.borderTopColor, fg: cs.color, weight: String(Number(cs.fontWeight)),
    pressed: el.getAttribute('aria-pressed'), checked: el.getAttribute('aria-checked'), state: el.getAttribute('data-state'),
    hover: el.matches(':hover'),
  }
}
const matches = (r, look) => Object.entries(look).every(([k, v]) => r[k] === v)
const fmt = r => `bg=${r.bg} border=${r.border} fg=${r.fg} w=${r.weight} pressed=${r.pressed} checked=${r.checked} state=${r.state} hover=${r.hover}`

const results = []
const failedKinds = new Set()
function check(kind, name, ok, detail) {
  results.push({ kind, name, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${kind}] ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failedKinds.add(kind)
}

// ── Navigation ──────────────────────────────────────────────────────────────
async function openTab(page, label) {
  const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
  if (await welcome.count()) await dismissWelcome(welcome)
  const tab = page.getByRole('tab', { name: label, exact: true })
  if (await tab.count()) await tab.first().click()
  else {
    await page.getByRole('button', { name: /^More\b/ }).first().click()
    await page.getByRole('button', { name: label, exact: true }).first().click()
  }
}
async function waitLive(page, locator) {
  await locator.waitFor()
  await page.waitForFunction(el => !el.hasAttribute('aria-disabled') && !el.disabled, await locator.elementHandle())
}

// The expected look of a real Multimedia pill from its own attributes.
function pillWant(r, looks) {
  if (r.state === 'negative') return looks.negative
  if (r.state === 'target') return looks.target
  return r.pressed === 'true' ? looks.pillOn : looks.pillOff
}

async function newCtx(browser, opts) {
  const ctx = await browser.newContext(opts)
  const origin = { value: null }
  const census = { external: 0, externalUrls: [] }
  await ctx.route('**/*', route => {
    const url = route.request().url()
    if (origin.value && url.startsWith(origin.value)) return route.continue()
    census.external += 1
    census.externalUrls.push(url)
    return route.abort()
  })
  return { ctx, origin, census }
}

async function touchTabs(browser, engine, base, theme, viewport) {
  const { ctx, origin, census } = await newCtx(browser, { viewport, deviceScaleFactor: 1, hasTouch: true })
  origin.value = new URL(base).origin
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  await page.goto(base)
  const tag = `${engine} ${theme} touch ${viewport.width}x${viewport.height}`
  const mq = await page.evaluate(() => ({ none: matchMedia('(hover: none)').matches, hover: matchMedia('(hover: hover)').matches }))
  check('config', `${tag}: reports (hover: none)`, mq.none && !mq.hover, JSON.stringify(mq))
  await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme)

  // Life Lists Media pills (only at tablet sizes; the phone size is the Engineer's probe).
  if (viewport.width > 640) {
    await openTab(page, 'Life Lists')
    const group = page.getByRole('group', { name: 'Media', exact: true })
    for (const n of ['Photo', 'Audio', 'Video']) {
      const pill = group.getByRole('button', { name: n, exact: true })
      await waitLive(page, pill)
      const looks = await page.evaluate(RESOLVE, LOOKS)
      for (let round = 0; round < 2; round++) {
        const before = await pill.getAttribute('aria-pressed')
        await pill.tap()
        const r = await pill.evaluate(READ_EL)
        check(`touch-${engine}`, `${tag}: Life Lists ${n} tap ${round + 1}`, r.pressed !== before && matches(r, pillWant(r, looks)) && r.bg !== looks.pillHover.bg, fmt(r))
      }
    }
  }

  // Multimedia real controls.
  await openTab(page, 'Multimedia')
  const looks = await page.evaluate(RESOLVE, LOOKS)
  for (const n of ['No photo', 'Is Target', 'Has photo']) {
    const pill = page.getByRole('button', { name: n, exact: true })
    await waitLive(page, pill)
    for (let round = 0; round < 2; round++) {
      const before = await pill.getAttribute('aria-pressed')
      await pill.tap()
      const r = await pill.evaluate(READ_EL)
      check(`touch-${engine}`, `${tag}: Multimedia ${n} tap ${round + 1}`, r.pressed !== before && matches(r, pillWant(r, looks)) && r.bg !== looks.pillHover.bg, fmt(r))
    }
  }
  const seg = page.getByRole('group', { name: 'Sort order', exact: true }).getByRole('button')
  const segCount = await seg.count()
  check('config', `${tag}: Multimedia Sort order has two segments`, segCount === 2, `count=${segCount}`)
  for (const [tapIdx, offIdx] of [[1, 0], [0, 1]]) {
    await seg.nth(tapIdx).tap()
    const on = await seg.nth(tapIdx).evaluate(READ_EL)
    const off = await seg.nth(offIdx).evaluate(READ_EL)
    check(`touch-${engine}`, `${tag}: Multimedia Sort order segment ${tapIdx} tapped shows on, sibling off`,
      on.pressed === 'true' && matches(on, looks.segOn) && off.pressed === 'false' && matches(off, looks.segOff), `on: ${fmt(on)} | off: ${fmt(off)}`)
  }
  const sw = page.getByRole('switch', { name: 'Show subspecies', exact: true })
  for (let round = 0; round < 2; round++) {
    const before = await sw.getAttribute('aria-checked')
    await sw.tap()
    const r = await sw.evaluate(READ_EL)
    check(`touch-${engine}`, `${tag}: Multimedia Show subspecies tap ${round + 1} keeps the resting frame`, r.checked !== before && matches(r, looks.switchRest), fmt(r))
  }
  await ctx.close()
  return census
}

async function mouseMultimedia(browser, engine, base, theme) {
  const { ctx, origin, census } = await newCtx(browser, { viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  origin.value = new URL(base).origin
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  await page.goto(base)
  const tag = `${engine} ${theme} mouse 1280`
  const mq = await page.evaluate(() => ({ none: matchMedia('(hover: none)').matches, hover: matchMedia('(hover: hover)').matches }))
  check('config', `${tag}: reports (hover: hover)`, mq.hover && !mq.none, JSON.stringify(mq))
  await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme)
  await openTab(page, 'Multimedia')
  const looks = await page.evaluate(RESOLVE, LOOKS)
  let away = null
  for (const [x, y] of [[1276, 4], [640, 4], [1276, 450], [4, 450]]) {
    const neutral = await page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py)
      return !!el && !el.closest('button, a, input, select, label, [role="switch"]')
    }, [x, y])
    if (neutral) { away = { x, y }; break }
  }
  if (!away) throw new Error('no neutral pointer position found')
  for (const n of ['No photo', 'Is Target', 'Has photo']) {
    const pill = page.getByRole('button', { name: n, exact: true })
    await waitLive(page, pill)
    for (let round = 0; round < 2; round++) {
      await pill.click()
      const r = await pill.evaluate(READ_EL)
      if (r.pressed === 'true') check('mouse-selected', `${tag}: Multimedia ${n} on keeps its state look under the pointer`, r.hover && matches(r, pillWant(r, looks)), fmt(r))
      else check('mouse-hover', `${tag}: Multimedia ${n} off shows the hover look under the pointer`, r.hover && matches(r, looks.pillHover), fmt(r))
      await page.mouse.move(away.x, away.y)
      const left = await pill.evaluate(READ_EL)
      check('mouse-rest', `${tag}: Multimedia ${n} pointer gone shows its state look`, !left.hover && matches(left, pillWant(left, looks)), fmt(left))
    }
  }
  const seg = page.getByRole('group', { name: 'Sort order', exact: true }).getByRole('button')
  const pressedIdx = (await seg.nth(0).getAttribute('aria-pressed')) === 'true' ? 0 : 1
  await seg.nth(pressedIdx).hover()
  const segOnUnder = await seg.nth(pressedIdx).evaluate(READ_EL)
  check('mouse-selected', `${tag}: Multimedia selected Sort order segment keeps the on look under the pointer`, segOnUnder.hover && matches(segOnUnder, looks.segOn), fmt(segOnUnder))
  await seg.nth(1 - pressedIdx).hover()
  const segOffUnder = await seg.nth(1 - pressedIdx).evaluate(READ_EL)
  check('mouse-hover', `${tag}: Multimedia unselected Sort order segment shows the hover look under the pointer`, segOffUnder.hover && matches(segOffUnder, looks.segHover), fmt(segOffUnder))
  const sw = page.getByRole('switch', { name: 'Show subspecies', exact: true })
  await sw.hover()
  const swHover = await sw.evaluate(READ_EL)
  check('mouse-hover', `${tag}: Multimedia Show subspecies under the pointer shows the hover frame`, swHover.hover && matches(swHover, looks.switchHover), fmt(swHover))
  await ctx.close()
  return census
}

// ── Run ─────────────────────────────────────────────────────────────────────
const { base, close } = await serveDist(DIST, { routes: stub })
console.log(`dist: ${DIST}`)
console.log(`mode: ${MODE}`)

// Census before any loop: one cold phone load through both tabs in Chromium.
{
  const browser = await chromium.launch()
  const { ctx, origin, census } = await newCtx(browser, { viewport: { width: 390, height: 844 }, hasTouch: true })
  origin.value = new URL(base).origin
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  await page.goto(base)
  await openTab(page, 'Life Lists')
  await page.getByRole('group', { name: 'Media', exact: true }).waitFor()
  await openTab(page, 'Multimedia')
  await page.getByRole('button', { name: 'No photo', exact: true }).waitFor()
  await page.waitForTimeout(1500)
  const api = [...served].filter(([p]) => !STATIC.test(p))
  const ebird = api.filter(([p]) => EBIRD_BACKED.test(p))
  console.log(`census (cold load): every non-static path asked of the server: ${JSON.stringify(Object.fromEntries(api))}`)
  console.log(`census (cold load): eBird-backed ${ebird.length}; other hosts (aborted) ${census.external} ${JSON.stringify(census.externalUrls)}`)
  check('census', 'cold load through Life Lists and Multimedia reaches no eBird-backed path and no other host', ebird.length === 0 && census.external === 0)
  await ctx.close()
  await browser.close()
}

let external = 0
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch()
  for (const theme of ['light', 'dark']) {
    external += (await touchTabs(browser, engine, base, theme, { width: 390, height: 844 })).external
    external += (await touchTabs(browser, engine, base, theme, { width: 820, height: 1180 })).external
    external += (await touchTabs(browser, engine, base, theme, { width: 1180, height: 820 })).external
    external += (await mouseMultimedia(browser, engine, base, theme)).external
  }
  await browser.close()
}
await close()

const api = [...served].filter(([p]) => !STATIC.test(p))
const ebird = api.filter(([p]) => EBIRD_BACKED.test(p))
const staticPaths = [...served].filter(([p]) => STATIC.test(p)).reduce((n, [, c]) => n + c, 0)
console.log(`\ncensus after all legs: static requests ${staticPaths}; non-static paths ${JSON.stringify(Object.fromEntries(api))}`)
console.log(`census after all legs: eBird-backed ${ebird.length}; other hosts (aborted) ${external}`)
check('census', 'all legs: no eBird-backed path and no other host', ebird.length === 0 && external === 0)

const kinds = [...new Set(results.map(r => r.kind))].sort()
for (const k of kinds) {
  const all = results.filter(r => r.kind === k)
  console.log(`  ${k}: ${all.filter(r => r.ok).length}/${all.length} pass`)
}
const failed = results.filter(r => !r.ok)
console.log(`total: ${results.length - failed.length}/${results.length} pass`)
let ok
if (MODE === 'fixed') ok = failed.length === 0
else {
  const mustFail = ['touch-webkit', 'mouse-selected']
  const mustPass = ['mouse-hover', 'config', 'census']
  ok = mustFail.every(k => failedKinds.has(k)) && mustPass.every(k => !failedKinds.has(k))
  console.log(`expect-broken: must fail ${mustFail.join(', ')}; must pass ${mustPass.join(', ')}`)
}
console.log(ok ? `RESULT: matched mode "${MODE}"` : `RESULT: did NOT match mode "${MODE}"`)
process.exit(ok ? 0 : 1)
