// Real-engine probe for life-list-filter-toggle-state: after a tap, a filter
// pill shows its new state, never the hover look; under a mouse a selected
// control keeps its selected look; keyboard focus still draws the global ring.
//
// jsdom cannot evaluate `:hover` or a media query, so this is the evidence for
// the fix, not the unit guard (lib/controlRegisters.test.ts is the guard).
//
// WHAT IT DRIVES. The BUILT app (frontend/dist), served on loopback by the
// verify gate's own serveDist, with a stub backend answering a small eBird
// export and a Macaulay Library export, so the Life Lists Media pills are live
// (without a readable export they are inert and have no hover). No API key is
// stored, every request to a host other than the loopback server is aborted,
// and every API path the app asks the stub for is counted and printed, with
// the eBird-backed ones counted separately before any loop runs.
//
// The registers Life Lists does not draw (a segment group, the red "No ..."
// pill, the Is Target pill, two Breeding Codes tier pills) are measured on a
// small FIXTURE injected into the same live page, so they are painted by the
// same built stylesheet in the same engine. It is labelled as a fixture in the
// output.
//
// LEGS, each in Chromium and WebKit, light and dark:
//   touch     hasTouch at 390px; the context must report (hover: none). Each
//             Media pill is tapped on and off, each switch is tapped, each
//             fixture control is tapped. After every tap the control must show
//             exactly its state's look; a pill's fill must never be
//             --sr-surface-subtle.
//   mouse     1280px, no touch; the context must report (hover: hover). A
//             pill clicked ON must read --sr-accent-bg with the pointer still
//             on it; a pill clicked OFF must read the hover look under the
//             pointer (mouse feedback is kept) and the off look once the
//             pointer leaves. Fixture selected states keep their look under
//             the pointer; an unselected segment shows the hover look.
//   keyboard  in both contexts: focus the Include Exotics switch, press a
//             REAL Tab (WebKit does not match :focus-visible after a scripted
//             focus(), .claude/rules/testing.md v1.0.47), assert the Photo pill
//             is the active element and draws an outline (style not none,
//             width > 0); then Space toggles it and the state look follows.
//
//   node probe-filter-pill-state.mjs <distDir>                  # expect all green
//   node probe-filter-pill-state.mjs <preFixDist> --expect-broken
//
// `--expect-broken` passes only when the pre-fix build fails the touch pill,
// touch switch, touch fixture and mouse selected kinds, while the mouse hover
// and keyboard kinds stay green: the probe must see the defect, and only it.

import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import { serveDist } from '../../../website/tools/verify/serveDist.mjs'
import { requirePlaywright } from '../../../website/tools/verify/playwright.mjs'
import { dismissWelcome } from '../../../website/tools/verify/dismissWelcome.mjs'

const { chromium, webkit } = requirePlaywright()

const DIST = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) ?? 'frontend/dist')
const MODE = process.argv.includes('--expect-broken') ? 'broken' : 'fixed'
const OUT = process.argv.find(a => a.startsWith('--out='))?.slice(6)

// ── The scenario: a stub backend ────────────────────────────────────────────

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

/** Every API path the app asked the stub for, with a count. */
const apiSeen = new Map()
/** Paths whose real route is backed by an eBird request. The stub answers them 404. */
const EBIRD_BACKED = /^\/(?:checklists|map|ebird|hotspots?|region|species-obs|recent|notable)\b/

function stubBackend(p, _req, res) {
  const json = body => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
  const api = /^\/(?:settings|weather|tide|media|map|taxonomy|version|nominatim|checklists|ebird|hotspots?|region|species|recent|notable|files|stats)\b/.test(p)
  if (api) apiSeen.set(p, (apiSeen.get(p) ?? 0) + 1)
  if (p === '/settings/files') { json(FILES_STATUS); return true }
  if (p === '/settings/files/ebird') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(EBIRD_CSV); return true }
  if (p === '/settings/files/ml') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(ML_CSV); return true }
  if (p === '/settings/keys') { json({ ebird: null, openweather: null }); return true }
  if (p === '/media/embed-status') { json({ gated: true }); return true }
  if (api) { res.writeHead(404); res.end('not found'); return true }
  return false
}

// ── Looks: each state's declared tokens, resolved in the page ───────────────

const LOOKS = {
  pillOff:   { bg: 'var(--sr-surface)', border: 'var(--sr-border)', fg: 'var(--sr-text-muted)', weight: '500' },
  pillOn:    { bg: 'var(--sr-accent-bg)', border: 'var(--sr-accent-border)', fg: 'var(--sr-accent)', weight: '600' },
  pillHover: { bg: 'var(--sr-surface-subtle)', border: 'var(--sr-border-medium)', fg: 'var(--sr-text)', weight: '500' },
  negative:  { bg: 'var(--sr-error-bg)', border: 'var(--sr-error-overlay)', fg: 'var(--sr-error)', weight: '600' },
  target:    { bg: 'var(--sr-is-target-bg)', border: 'var(--sr-is-target-border)', fg: 'var(--sr-is-target-text)', weight: '600' },
  tier1On:   { bg: 'rgba(var(--sr-tier-1-rgb), 0.15)', border: 'rgba(var(--sr-tier-1-rgb), 0.5)', fg: 'var(--sr-tier-1-fg)', weight: '600' },
  tier3On:   { bg: 'rgba(var(--sr-tier-3-rgb), 0.08)', border: 'rgba(var(--sr-tier-3-rgb), 0.3)', fg: 'var(--sr-tier-3-fg)', weight: '600' },
  segOff:    { bg: 'transparent', fg: 'var(--sr-text-muted)', weight: '500' },
  segOn:     { bg: 'var(--sr-accent-bg)', fg: 'var(--sr-accent)', weight: '600' },
  segHover:  { bg: 'var(--sr-surface-subtle)', fg: 'var(--sr-text)', weight: '500' },
  switchRest:  { bg: 'var(--sr-surface)', border: 'var(--sr-border)' },
  switchHover: { bg: 'var(--sr-surface-subtle)', border: 'var(--sr-border-medium)' },
}

/** In the page: resolve every look to computed rgb strings under the current theme. */
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

/** In the page: settle an element's transitions, then read its paint. */
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
    pressed: el.getAttribute('aria-pressed'), checked: el.getAttribute('aria-checked'),
    hover: el.matches(':hover'), focusVisible: el.matches(':focus-visible'),
    outlineStyle: cs.outlineStyle, outlineWidth: parseFloat(cs.outlineWidth),
  }
}

const FIXTURE_HTML = `
  <div id="probe-fixture" style="position:fixed;left:8px;bottom:8px;z-index:99999;display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:8px;background:var(--sr-surface)">
    <span class="sr-segbar" role="group" aria-label="Probe segments">
      <button type="button" class="sr-segbar-btn" data-probe="segA" aria-pressed="true">Newest</button>
      <button type="button" class="sr-segbar-btn" data-probe="segB" aria-pressed="false">Oldest</button>
    </span>
    <button type="button" class="sr-pill" data-probe="negative" data-state="negative">No photo</button>
    <button type="button" class="sr-pill" data-probe="target" data-state="target">Is Target</button>
    <button type="button" class="sr-pill" data-probe="tier1On" data-tier="1" aria-pressed="true">Possible</button>
    <button type="button" class="sr-pill" data-probe="tier3On" data-tier="3" aria-pressed="true">Confirmed</button>
  </div>`

async function injectFixture(page) {
  await page.evaluate(html => {
    document.getElementById('probe-fixture')?.remove()
    document.body.insertAdjacentHTML('beforeend', html)
    const segs = [...document.querySelectorAll('#probe-fixture .sr-segbar-btn')]
    for (const b of segs) b.addEventListener('click', () => { for (const o of segs) o.setAttribute('aria-pressed', String(o === b)) })
  }, FIXTURE_HTML)
}

// ── Checks ───────────────────────────────────────────────────────────────────

const results = []
const failedKinds = new Set()
function check(kind, name, ok, detail) {
  results.push({ kind, name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  [${kind}] ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) failedKinds.add(kind)
}

/** Compare a reading with a look, property by property. */
function matches(reading, look) {
  return Object.entries(look).every(([k, v]) => reading[k] === v)
}
const fmt = r => `bg=${r.bg} border=${r.border} fg=${r.fg} w=${r.weight}${r.pressed !== null ? ` pressed=${r.pressed}` : ''}${r.checked !== null ? ` checked=${r.checked}` : ''} hover=${r.hover} fv=${r.focusVisible}`

const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))

async function openLifeLists(page) {
  const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
  if (await welcome.count()) await dismissWelcome(welcome)
  // Desktop draws the destinations as tabs; the phone bar keeps Life Lists
  // behind More, whose sheet lists it as a button.
  const tab = page.getByRole('tab', { name: 'Life Lists', exact: true })
  if (await tab.count()) {
    await tab.first().click()
  } else {
    await page.getByRole('button', { name: /^More\b/ }).first().click()
    await page.getByRole('button', { name: 'Life Lists', exact: true }).first().click()
  }
  const group = page.getByRole('group', { name: 'Media', exact: true })
  await group.waitFor()
  // Live, not inert: the export has been read, so no pill is aria-disabled.
  const handle = await group.elementHandle()
  try {
    await page.waitForFunction(g => {
      const b = [...g.querySelectorAll('button')]
      return b.length === 3 && b.every(x => !x.hasAttribute('aria-disabled'))
    }, handle)
  } catch (err) {
    console.log(`group never went live: ${await handle.evaluate(g => g.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '').slice(0, 800))}`)
    throw err
  } finally {
    await handle.dispose()
  }
  return group
}

const pillsOf = group => ['Photo', 'Audio', 'Video'].map(n => group.getByRole('button', { name: n, exact: true }))
const switchNamed = (page, n) => page.getByRole('switch', { name: n, exact: true })

/** A point the pointer can rest on that is no control at all. */
async function neutralPoint(page) {
  const vp = page.viewportSize()
  const candidates = [[vp.width - 4, 4], [vp.width / 2, 4], [vp.width - 4, vp.height / 2], [4, vp.height / 2]]
  for (const [x, y] of candidates) {
    const ok = await page.evaluate(([px, py]) => {
      const el = document.elementFromPoint(px, py)
      return !!el && !el.closest('button, a, input, select, label, [role="switch"], #probe-fixture')
    }, [x, y])
    if (ok) return { x, y }
  }
  throw new Error('no neutral pointer position found')
}

async function touchLeg(browser, engine, base, theme) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true })
  const origin = new URL(base).origin
  let external = 0
  await ctx.route('**/*', route => {
    if (route.request().url().startsWith(origin)) return route.continue()
    external += 1
    return route.abort()
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  await page.goto(base)
  const tag = `${engine} ${theme} touch 390`
  const mq = await page.evaluate(() => ({ none: matchMedia('(hover: none)').matches, hover: matchMedia('(hover: hover)').matches }))
  check('config', `${tag}: the context reports (hover: none)`, mq.none && !mq.hover, JSON.stringify(mq))
  const group = await openLifeLists(page)
  await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme)
  await injectFixture(page)
  await settle(page)
  const looks = await page.evaluate(RESOLVE, LOOKS)

  for (const pill of pillsOf(group)) {
    const name = await pill.textContent()
    for (let round = 0; round < 2; round++) {
      const before = await pill.getAttribute('aria-pressed')
      await pill.tap()
      const r = await pill.evaluate(READ_EL)
      const flipped = r.pressed !== before
      const want = r.pressed === 'true' ? looks.pillOn : looks.pillOff
      check('touch-pill', `${tag}: ${name.trim()} tap ${round + 1} shows its ${r.pressed === 'true' ? 'on' : 'off'} look`,
        flipped && matches(r, want) && r.bg !== looks.pillHover.bg, fmt(r))
    }
  }

  for (const label of ['Include Escapees', 'Include Exotics']) {
    const sw = switchNamed(page, label)
    for (let round = 0; round < 2; round++) {
      const before = await sw.getAttribute('aria-checked')
      await sw.tap()
      const r = await sw.evaluate(READ_EL)
      check('touch-switch', `${tag}: ${label} tap ${round + 1} keeps the resting frame`,
        r.checked !== before && matches(r, looks.switchRest), fmt(r))
    }
  }

  const fx = id => page.locator(`#probe-fixture [data-probe="${id}"]`)
  for (const [tapId, onId, offId] of [['segB', 'segB', 'segA'], ['segA', 'segA', 'segB']]) {
    await fx(tapId).tap()
    const on = await fx(onId).evaluate(READ_EL)
    const off = await fx(offId).evaluate(READ_EL)
    check('touch-fixture', `${tag}: fixture segment tapped shows on, its sibling off`,
      matches(on, looks.segOn) && matches(off, looks.segOff), `on: ${fmt(on)} | off: ${fmt(off)}`)
  }
  for (const id of ['negative', 'target', 'tier1On', 'tier3On']) {
    await fx(id).tap()
    const r = await fx(id).evaluate(READ_EL)
    check('touch-fixture', `${tag}: fixture ${id} pill tapped keeps its state look`, matches(r, looks[id]), fmt(r))
  }

  await keyboardLeg(page, group, looks, tag)
  await ctx.close()
  return external
}

async function mouseLeg(browser, engine, base, theme) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 })
  const origin = new URL(base).origin
  let external = 0
  await ctx.route('**/*', route => {
    if (route.request().url().startsWith(origin)) return route.continue()
    external += 1
    return route.abort()
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  await page.goto(base)
  const tag = `${engine} ${theme} mouse 1280`
  const mq = await page.evaluate(() => ({ none: matchMedia('(hover: none)').matches, hover: matchMedia('(hover: hover)').matches }))
  check('config', `${tag}: the context reports (hover: hover)`, mq.hover && !mq.none, JSON.stringify(mq))
  const group = await openLifeLists(page)
  await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme)
  await injectFixture(page)
  await settle(page)
  const looks = await page.evaluate(RESOLVE, LOOKS)
  const away = await neutralPoint(page)

  for (const pill of pillsOf(group)) {
    const name = (await pill.textContent()).trim()
    for (let round = 0; round < 2; round++) {
      await pill.click()
      const under = await pill.evaluate(READ_EL)
      if (under.pressed === 'true') {
        check('mouse-selected', `${tag}: ${name} clicked on keeps the on look under the pointer`, under.hover && matches(under, looks.pillOn), fmt(under))
      } else {
        check('mouse-hover', `${tag}: ${name} clicked off shows the hover look under the pointer`, under.hover && matches(under, looks.pillHover), fmt(under))
      }
      await page.mouse.move(away.x, away.y)
      const left = await pill.evaluate(READ_EL)
      const want = left.pressed === 'true' ? looks.pillOn : looks.pillOff
      check('mouse-rest', `${tag}: ${name} with the pointer gone shows its ${left.pressed === 'true' ? 'on' : 'off'} look`, !left.hover && matches(left, want), fmt(left))
    }
  }

  const sw = switchNamed(page, 'Include Escapees')
  await sw.hover()
  const swHover = await sw.evaluate(READ_EL)
  check('mouse-hover', `${tag}: Include Escapees under the pointer shows the hover frame`, swHover.hover && matches(swHover, looks.switchHover), fmt(swHover))
  await page.mouse.move(away.x, away.y)
  const swRest = await sw.evaluate(READ_EL)
  check('mouse-rest', `${tag}: Include Escapees with the pointer gone shows the resting frame`, !swRest.hover && matches(swRest, looks.switchRest), fmt(swRest))

  const fx = id => page.locator(`#probe-fixture [data-probe="${id}"]`)
  await fx('segA').hover()
  const segOnUnder = await fx('segA').evaluate(READ_EL)
  check('mouse-selected', `${tag}: fixture selected segment keeps the on look under the pointer`, segOnUnder.hover && matches(segOnUnder, looks.segOn), fmt(segOnUnder))
  await fx('segB').hover()
  const segOffUnder = await fx('segB').evaluate(READ_EL)
  check('mouse-hover', `${tag}: fixture unselected segment shows the hover look under the pointer`, segOffUnder.hover && matches(segOffUnder, looks.segHover), fmt(segOffUnder))
  for (const id of ['negative', 'target', 'tier1On', 'tier3On']) {
    await fx(id).hover()
    const r = await fx(id).evaluate(READ_EL)
    check('mouse-selected', `${tag}: fixture ${id} pill keeps its state look under the pointer`, r.hover && matches(r, looks[id]), fmt(r))
  }

  await page.mouse.move(away.x, away.y)
  await keyboardLeg(page, group, looks, tag)
  await ctx.close()
  return external
}

/** A REAL Tab from the Include Exotics switch lands on Photo and draws the ring. */
async function keyboardLeg(page, group, looks, tag) {
  const exotics = switchNamed(page, 'Include Exotics')
  await exotics.evaluate(el => el.focus())
  await page.keyboard.press('Tab')
  const photo = pillsOf(group)[0]
  const isActive = await photo.evaluate(el => document.activeElement === el)
  const r = await photo.evaluate(READ_EL)
  check('keyboard', `${tag}: Tab lands on Photo and draws the focus ring`,
    isActive && r.focusVisible && r.outlineStyle !== 'none' && r.outlineWidth > 0,
    `active=${isActive} fv=${r.focusVisible} outline=${r.outlineStyle} ${r.outlineWidth}px`)
  const before = r.pressed
  await page.keyboard.press('Space')
  const after = await photo.evaluate(READ_EL)
  const want = after.pressed === 'true' ? looks.pillOn : looks.pillOff
  check('keyboard', `${tag}: Space toggles Photo, the state look follows and the ring stays`,
    after.pressed !== before && matches(after, want) && after.outlineStyle !== 'none' && after.outlineWidth > 0,
    `${fmt(after)} outline=${after.outlineStyle} ${after.outlineWidth}px`)
}

// ── Run ─────────────────────────────────────────────────────────────────────

const { base, close } = await serveDist(DIST, { routes: stubBackend })
console.log(`dist: ${DIST}`)
console.log(`mode: ${MODE}`)

// Request census BEFORE any loop: one cold load in Chromium, to the Life Lists
// tab, counting what the app asks of the backend and of the outside world.
{
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true })
  const origin = new URL(base).origin
  let external = 0
  await ctx.route('**/*', route => {
    if (route.request().url().startsWith(origin)) return route.continue()
    external += 1
    return route.abort()
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  await page.goto(base)
  await openLifeLists(page)
  await page.waitForTimeout(1500)
  const ebird = [...apiSeen].filter(([p]) => EBIRD_BACKED.test(p))
  console.log(`census: API paths asked of the stub: ${JSON.stringify(Object.fromEntries(apiSeen))}`)
  console.log(`census: eBird-backed paths asked: ${ebird.length}; requests to other hosts (aborted): ${external}`)
  check('census', 'one cold load reaches no eBird-backed path and no other host', ebird.length === 0 && external === 0,
    `ebird=${ebird.length} external=${external}`)
  await ctx.close()
  await browser.close()
}

let externalTotal = 0
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch()
  for (const theme of ['light', 'dark']) {
    externalTotal += await touchLeg(browser, engine, base, theme)
    externalTotal += await mouseLeg(browser, engine, base, theme)
  }
  await browser.close()
}
await close()

const ebirdAll = [...apiSeen].filter(([p]) => EBIRD_BACKED.test(p))
console.log(`\ncensus after all legs: eBird-backed paths asked ${ebirdAll.length}, other hosts ${externalTotal}`)
const total = results.length
const failed = results.filter(r => !r.ok)
const kinds = [...new Set(results.map(r => r.kind))].sort()
for (const k of kinds) {
  const all = results.filter(r => r.kind === k)
  console.log(`  ${k}: ${all.filter(r => r.ok).length}/${all.length} pass`)
}
console.log(`total: ${total - failed.length}/${total} pass`)

let ok
if (MODE === 'fixed') {
  ok = failed.length === 0
} else {
  const mustFail = ['touch-pill', 'touch-switch', 'touch-fixture', 'mouse-selected']
  const mustPass = ['mouse-hover', 'keyboard', 'config', 'census']
  ok = mustFail.every(k => failedKinds.has(k)) && mustPass.every(k => !failedKinds.has(k))
  console.log(`expect-broken: must fail ${mustFail.join(', ')}; must pass ${mustPass.join(', ')}`)
}
console.log(ok ? `RESULT: matched mode "${MODE}"` : `RESULT: did NOT match mode "${MODE}"`)
if (OUT) writeFileSync(OUT, JSON.stringify({ dist: DIST, mode: MODE, results, apiSeen: Object.fromEntries(apiSeen) }, null, 2))
process.exit(ok ? 0 : 1)
