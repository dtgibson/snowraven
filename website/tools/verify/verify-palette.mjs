// Browser verification for the command palette, in Chromium AND WebKit, against
// the PRODUCTION build (feature: command-palette). Promoted from
// `pipeline/command-palette/` by the playwright-gate build; the scenario below
// is unchanged from the artifact it was promoted from, and the two absolute
// paths under the author's home directory that made it dead on every other
// machine are gone (see FIXTURE below).
//
// WHY THIS FILE EXISTS. Three of the palette's claims are invisible to vitest,
// and each has a repo rule saying so:
//
//   * TAB CONTAINMENT (QA-15). jsdom has no tab order, so a jsdom containment
//     test only re-asserts the assumption v1.0.15 measured as broken. The method
//     here is that measurement's: Tab N times, type into an input BEHIND the
//     overlay, and read the value back. WebKit is the engine the shipped Mac,
//     iPhone and iPad apps run.
//   * THE 320px / 200% GEOMETRY (QA-59). No layout engine in jsdom. The text
//     scale is set as an INLINE style on documentElement, never an injected
//     `html {}` rule, which loses to the shipped `:root` declaration on
//     specificity and would silently measure 100% twice.
//   * THE IDLE LIVE REGION (QA-36). jsdom has no accessibility tree at all.
//
// It serves `frontend/dist` with no backend, so `storage` rejects and the
// species half lands on its stored-but-unloadable state. That is deliberate: it
// is a real state, it renders the status region with a sentence, and the
// destination half must keep working through it. The 404 fallback is what makes
// it a real state -- an SPA fallback would answer `/settings/keys` with
// index.html and the app would parse HTML as JSON instead.
//
// FIXTURE. The dist is the first argument, else `SR_VERIFY_DIST`, else the
// repo's own `frontend/dist` resolved RELATIVE TO THIS FILE. `SR_VERIFY_BASE`
// overrides the base URL, in which case no server is started -- the static
// server here is pure apparatus (compare `verify-backlog-alert.mjs`, whose stub
// backend is the scenario and therefore takes no such override).
//
//   node verify-palette.mjs [distDir]          # after `npm run build`
//   SR_VERIFY_BASE=http://localhost:1620 node verify-palette.mjs

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveDist } from './serveDist.mjs'
import { requirePlaywright } from './playwright.mjs'

const { chromium, webkit } = requirePlaywright()

const DIST = resolve(process.argv[2] ?? process.env.SR_VERIFY_DIST
  ?? fileURLToPath(new URL('../../../frontend/dist/', import.meta.url)))

const results = []
const record = (engine, name, ok, detail) => {
  results.push({ engine, name, ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${engine.padEnd(8)} ${name}${detail ? `  ${detail}` : ''}`)
}

/** Open the palette with the chord, and wait for its dialog. */
async function openPalette(page, key) {
  await page.keyboard.press(key)
  await page.waitForSelector('.sr-palette-panel .sr-palette-input', { timeout: 5000 })
}

async function run(engine, launcher, url) {
  const browser = await launcher.launch()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.sr-nav-search', { timeout: 10000 })

  // With no backend every key and file read comes back empty, so this is a COLD
  // START and the first-run WelcomeScreen is up. Dismissing it with Escape does
  // two jobs: it clears an unrelated overlay out of the way, and it is FR-50 in
  // a real engine -- with the palette CLOSED, Escape still reaches the shipped
  // layer that was listening for it before this feature existed.
  const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
  if (await welcome.count()) {
    await page.keyboard.press('Escape')
    await welcome.waitFor({ state: 'detached', timeout: 5000 })
    record(engine, 'Escape still dismisses a shipped overlay while the palette is closed (FR-50)', true)
  }

  // ── QA-01 / QA-45: both chords, on every engine ──────────────────────────
  for (const [label, key] of [['Meta+K', 'Meta+k'], ['Control+K', 'Control+k']]) {
    await openPalette(page, key)
    const rows = await page.locator('[role="option"]').count()
    // A second press closes through the same path.
    await page.keyboard.press(key)
    const closed = await page.locator('.sr-palette-panel').count()
    record(engine, `${label} opens and toggles closed`, rows > 0 && closed === 0, `${rows} destinations`)
  }

  // ── QA-15: containment, by the v1.0.15 measurement method ────────────────
  await page.evaluate(() => {
    const probe = document.createElement('input')
    probe.id = 'sr-probe-behind'
    document.body.prepend(probe)
  })
  await openPalette(page, 'Meta+k')
  for (let i = 0; i < 25; i += 1) await page.keyboard.press('Tab')
  await page.keyboard.type('ESCAPED')
  const leaked = await page.$eval('#sr-probe-behind', el => el.value)
  const stillInside = await page.evaluate(() =>
    !!document.querySelector('.sr-palette-panel')?.contains(document.activeElement))
  // WHICH HALF OF THIS ASSERTION ACTUALLY DISCRIMINATES, measured rather than
  // assumed. Neutering the trap (`useFocusTrap(false, panelRef)`), rebuilding
  // and re-running: BOTH engines report `activeElement inside=false` and BOTH
  // still report `probe=""` -- 25 Tab presses from a leaked position do not
  // happen to land on this one input. So the typed-value half is the v1.0.15
  // method kept for continuity and for the day focus leaks somewhere typable;
  // the `activeElement inside` half is what rejects the defect today.
  record(engine, 'Tab x25 never reaches a control behind the overlay',
    leaked === '' && stillInside, `probe="${leaked}" activeElement inside=${stillInside}`)
  // THE PROBE OWNS ITS TEARDOWN. This bare <input> is prepended to <body>,
  // outside every layout container, so at 320px and 200% text scale it is itself
  // wider than the viewport -- and it was the whole of a 398px "page scroll leak"
  // the geometry legs below reported in WebKit and nowhere else. Measured with a
  // clean resize and no probe: 320/320 in both engines with the palette open and
  // closed. A harness that leaves its own furniture in the page reports its own
  // furniture as a finding.
  await page.evaluate(() => document.getElementById('sr-probe-behind')?.remove())

  // ── QA-41: the overlay's tab-stop population, by REAL focusability ───────
  // THE SELECTOR BELOW IS A DELIBERATE COPY OF `FOCUSABLE_SELECTOR`, and it is
  // the ONE copy left outside frontend/src/lib/useFocusTrap.ts. It cannot import
  // the real one: this arrow runs inside `page.evaluate`, i.e. serialized into
  // the BROWSER, where there is no module graph and no bundler — the four copies
  // that used to live in src were consolidated onto the export
  // (improve: focusable-selector-single-source) and this one structurally could
  // not follow. Keep it character-for-character identical to the export. If it
  // ever drifts, this harness silently measures a different population than the
  // app traps, and the drift will read as a passing check.
  const stops = await page.evaluate(() => {
    const panel = document.querySelector('.sr-palette-panel')
    return [...panel.querySelectorAll('button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => el.getClientRects().length > 0)          // never offsetParent
      .map(el => `${el.tagName.toLowerCase()}[tabindex=${el.getAttribute('tabindex')}]`)
  })
  record(engine, 'exactly two explicit tab stops inside the overlay',
    stops.length === 2 && stops.every(s => s.includes('tabindex=0')), stops.join(' '))

  // ── QA-36: the IDLE and filled live region, in a real accessibility tree ─
  const snap = await page.locator('.sr-palette-panel').ariaSnapshot()
  const hasStatus = /- status/.test(snap)
  record(engine, 'the status region is in the accessibility tree', hasStatus,
    (snap.split('\n').find(l => l.includes('status')) ?? '(no status line)').trim())

  // ── QA-38: arrows cross the group boundary and CLAMP ─────────────────────
  // FOCUS IS PUT BACK ON THE INPUT FIRST, and verified. The containment block
  // above deliberately left focus on the close button, and a synthesized key
  // press with focus somewhere unverified is the v1.0.10 trap that reported
  // three false failures against a working build.
  await page.click('.sr-palette-input')
  const onInput = await page.evaluate(() =>
    document.activeElement?.classList.contains('sr-palette-input') ?? false)
  record(engine, 'the arrow probe starts with focus verified on the query input', onInput)
  const before = await page.getAttribute('.sr-palette-input', 'aria-activedescendant')
  await page.keyboard.press('ArrowUp')
  const afterUp = await page.getAttribute('.sr-palette-input', 'aria-activedescendant')
  const count = await page.locator('[role="option"]').count()
  for (let i = 0; i < count + 3; i += 1) await page.keyboard.press('ArrowDown')
  const lastId = await page.locator('[role="option"]').last().getAttribute('id')
  const atEnd = await page.getAttribute('.sr-palette-input', 'aria-activedescendant')
  record(engine, 'arrows clamp at both ends rather than wrapping',
    before === null && afterUp === null && atEnd === lastId, `end=${atEnd}`)

  // ── QA-59: 320px against 100% AND 200% in-app text scale ────────────────
  for (const scale of ['1', '2']) {
    await page.setViewportSize({ width: 320, height: 640 })
    // THE SETTLE IS LOAD-BEARING. The nav's density derivation is a
    // ResizeObserver plus a per-commit re-measure, so immediately after a
    // 1600 -> 320 resize the page is still mid-relayout: an early read measured
    // 398px of page scroll in WebKit that a settled read does not reproduce
    // (320/320 in both engines, measured from a fresh 320px context). Waiting on
    // the phone bar is waiting on the density flip itself rather than on a clock.
    await page.waitForSelector('.sr-navbar', { timeout: 5000 })
    // INLINE on documentElement: the shipped declaration is on :root, whose
    // pseudo-class specificity beats an injected `html {}` rule at any source
    // order, so an injected rule would silently measure 100% twice.
    await page.evaluate(s => document.documentElement.style.setProperty('--sr-text-scale', s), scale)
    await page.waitForTimeout(250)
    const m = await page.evaluate(() => {
      const panel = document.querySelector('.sr-palette-panel')
      const input = document.querySelector('.sr-palette-input')
      const row = document.querySelector('[role="option"]')
      const r = panel.getBoundingClientRect()
      return {
        pageScroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
        panelW: Math.round(r.width), panelH: Math.round(r.height),
        inputVisible: input.getBoundingClientRect().bottom <= window.innerHeight,
        rowVisible: row ? row.getBoundingClientRect().bottom <= window.innerHeight : false,
        rowH: row ? Math.round(row.getBoundingClientRect().height) : 0,
        rootFont: getComputedStyle(document.documentElement).fontSize,
        // THE ELEMENT AGAINST ITS CONTAINER, because page scrollWidth is a
        // proxy that can report a real leak as absent (an overflow:hidden
        // ancestor swallows it, a left overflow never extends it) and a leak
        // that is not ours as present. Every visible box inside the palette is
        // checked against the viewport it must fit.
        outside: [...document.querySelectorAll('.sr-palette-root *')]
          .filter(el => {
            const b = el.getBoundingClientRect()
            return (b.width || b.height) && (b.right > window.innerWidth + 0.5 || b.left < -0.5)
          })
          .map(el => `${el.tagName.toLowerCase()}.${String(el.className).split(' ')[0]}`),
      }
    })
    const fullHeight = m.panelW === m.viewport && m.panelH >= 600
    record(engine, `320px at ${scale === '1' ? '100%' : '200%'} text scale`,
      m.pageScroll <= m.viewport && m.outside.length === 0 && fullHeight && m.inputVisible && m.rowVisible,
      `scroll=${m.pageScroll}/${m.viewport} panel=${m.panelW}x${m.panelH} row=${m.rowH}px root=${m.rootFont} outside=[${m.outside.join(',')}]`)
  }
  await page.evaluate(() => document.documentElement.style.removeProperty('--sr-text-scale'))

  // ── QA-47: one Escape closes the palette and nothing else ───────────────
  await page.setViewportSize({ width: 1600, height: 1000 })
  // THE LEG THAT FOUND A REAL DEFECT. The chord captures its opener eagerly from
  // `document.activeElement`, which is `<body>` whenever nothing holds focus --
  // and `<body>` passed every clause of the liveness gate while accepting no
  // focus at all, so the restore reported success with focus exactly where FR-12
  // forbids it. `plausible()` in lib/paletteFocus.ts now rejects body and html,
  // and `tryFocus` verifies the engine took it.
  //
  // The palette is still OPEN from the containment leg, so it is closed first
  // and the close is WAITED ON: pressing the chord against an open palette
  // toggles it shut, and the wait that followed would then sit on a selector
  // that is never coming back. State is verified before it is acted on.
  await page.keyboard.press('Escape')
  await page.waitForSelector('.sr-palette-panel', { state: 'detached', timeout: 5000 })
  await page.evaluate(() => { document.activeElement?.blur?.() })
  await page.keyboard.press('Meta+k')
  await page.waitForSelector('.sr-palette-panel')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  const gone = await page.locator('.sr-palette-panel').count()
  const focusBack = await page.evaluate(() => {
    const el = document.activeElement
    return `${el ? el.tagName.toLowerCase() : 'none'}#${el && el.id ? el.id : ''}`
  })
  record(engine, 'Escape closes and focus NEVER lands on <body> (FR-12)',
    gone === 0 && !focusBack.startsWith('body'), `activeElement=${focusBack}`)

  // ── FR-05 / FR-06: the nav's own control opens it, and focus comes back ──
  await page.click('.sr-nav-search')
  await page.waitForSelector('.sr-palette-panel')
  await page.click('.sr-palette-close')
  const backOnControl = await page.evaluate(() =>
    document.activeElement?.classList.contains('sr-nav-search') ?? false)
  record(engine, 'the nav Search control opens it and gets focus back', backOnControl)

  await browser.close()
}

const override = process.env.SR_VERIFY_BASE
const served = override ? null : await serveDist(DIST, { fallback: '404' })
const url = override ? (override.endsWith('/') ? override : `${override}/`) : `${served.base}/`
console.log(`driving ${override ? url : `${DIST} at ${url}`}\n`)

try {
  await run('chromium', chromium, url)
  await run('webkit', webkit, url)
} finally {
  await served?.close()
}

const failed = results.filter(r => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) {
  for (const f of failed) console.log(`  FAILED  ${f.engine} ${f.name}  ${f.detail ?? ''}`)
  process.exit(1)
}
