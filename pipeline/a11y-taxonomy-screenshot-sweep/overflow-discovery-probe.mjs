// 320px / 200% horizontal-overflow DISCOVERY probe
// (feature: a11y-taxonomy-screenshot-sweep).
//
// WHY THIS EXISTS. Three leaks are recorded as page-level totals — Statistics
// 60px, Checklists 42px, Calendar 29px, measured during the v0.5.82 sweep — and
// a total says nothing about WHICH element is doing it. Three tabs, three
// causes (DECISIONS.md, `The count-cluster leak`, v0.5.82: "None share this
// cause"), so each needs its own offender identified before it can be designed.
//
// Page scrollWidth is deliberately NOT the signal. This repo has measured it
// certify a broken build twice: an `overflow: hidden` ancestor swallows it, and
// the v0.5.82 entry records an unfiltered Multimedia row 24.23px past its
// content box while `document.scrollWidth` read a clean integer 320. Every
// number below measures an ELEMENT's border box against its PARENT's CONTENT
// box, walking the whole active panel subtree.
//
// Run against a SnowRaven instance serving SYNTHETIC demo data (never a real
// export — website/tools/demo-data, pointed at with SR_DATA_DIR):
//
//   cd frontend && npm run build
//   cd backend  && SR_DATA_DIR=$PWD/../website/tools/demo-data \
//                  ./.venv/bin/uvicorn main:app --port 1621
//   node pipeline/a11y-taxonomy-screenshot-sweep/overflow-discovery-probe.mjs
//
//   BASE    app origin (default http://localhost:1621)
//   ENGINE  chromium (default) | webkit — the app ships in WKWebView on macOS
//           and iOS, so a layout claim is confirmed in both.
//   TABS    comma-separated tab names (default the three leaking tabs)
import { chromium, webkit } from '../../website/tools/node_modules/playwright/index.mjs'

const BASE = process.env.BASE || 'http://localhost:1621'
const ENGINE = process.env.ENGINE || 'chromium'
const TABS = (process.env.TABS || 'Statistics,Checklists,Calendar').split(',')

const browser = ENGINE === 'webkit'
  ? await webkit.launch({ headless: true })
  : await chromium.launch({ headless: true, args: ['--hide-scrollbars'] })

/** Open the app at a viewport, select a tab, and apply the in-app text scale.
 *  The scale is set the way the app itself sets it (textScale.ts writes the
 *  custom property on <html>), so the measured cascade is the shipped one. */
async function openTab(name, vp, textScale) {
  const ctx = await browser.newContext({ viewport: vp })
  const p = await ctx.newPage()
  p.setDefaultTimeout(30000)
  await p.goto(BASE, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[role="tab"], button[aria-haspopup="listbox"]')

  // The tab strip collapses to a dropdown below ~1457px, so a 320px run always
  // takes the dropdown path. Try the strip first anyway — a miss on BOTH is a
  // hard error, never a silent measurement of whatever tab happened to be open.
  let clicked = false
  for (const h of await p.$$('[role="tab"]')) {
    if ((await h.textContent() || '').trim() === name) { await h.click(); clicked = true; break }
  }
  if (!clicked) {
    const trigger = await p.$('button[aria-haspopup="listbox"]')
    if (!trigger) throw new Error('no tab strip and no nav dropdown')
    await trigger.click()
    await p.waitForTimeout(300)
    for (const o of await p.$$('[role="option"], [role="listbox"] button, [role="listbox"] li')) {
      if ((await o.textContent() || '').trim() === name) { await o.click(); clicked = true; break }
    }
  }
  if (!clicked) throw new Error(`tab not found: ${name}`)

  if (textScale && textScale !== 1) {
    await p.evaluate(s => document.documentElement.style.setProperty('--sr-text-scale', String(s)), textScale)
  }
  await p.waitForTimeout(2500)   // charts, tables and the taxonomy batch settle
  return { ctx, p }
}

/** Walk the visible subtree and report every element whose border box escapes
 *  its parent's content box to the RIGHT by more than EPS.
 *
 *  Reported per offender: the escape in px, a stable-ish selector path, the
 *  computed properties that decide whether a box CAN shrink or wrap, and
 *  whether an ancestor clips it (an offender under `overflow: hidden` is real
 *  but invisible, and must not be confused with one that leaks page scroll). */
const findOverflow = async (p, eps = 0.5) => p.evaluate(({ EPS, ROOT }) => {
  // Hidden tabs stay MOUNTED in this app (`mountedTabs` only grows, and an
  // inactive panel is `display: none`), so `[role="tabpanel"]:not([hidden])`
  // silently resolves to the first mounted panel rather than the active one —
  // it measured the Weather panel on all six runs of the first pass. Resolve by
  // what is actually rendered (an offsetParent, or a non-none display), and
  // fail loudly rather than measure the wrong tab.
  const visiblePanels = [...document.querySelectorAll('[role="tabpanel"]')]
    .filter(el => el.offsetParent !== null || getComputedStyle(el).display !== 'none')
  if (visiblePanels.length > 1) {
    throw new Error(`${visiblePanels.length} panels visible: ${visiblePanels.map(p => p.id).join(', ')}`)
  }
  // ROOT=body walks the whole document instead of the active panel. Needed when
  // a tab leaks page scroll with no leaker inside its own subtree — the driver
  // is then app chrome (header, tab bar, a fixed overlay), not the tab.
  const panel = ROOT === 'body'
    ? document.body
    : (visiblePanels[0] || document.querySelector('main') || document.body)

  const desc = el => {
    const id = el.id ? `#${el.id}` : ''
    const cls = typeof el.className === 'string' && el.className.trim()
      ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
      : ''
    return `${el.tagName.toLowerCase()}${id}${cls}`
  }
  const pathOf = el => {
    const parts = []
    for (let n = el; n && n !== panel.parentElement; n = n.parentElement) parts.unshift(desc(n))
    return parts.slice(-5).join(' > ')
  }
  const contentRight = el => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    // clientWidth excludes the scrollbar; subtracting both paddings leaves the
    // content box, which is the edge a child is actually allowed to reach.
    return r.left + parseFloat(cs.paddingLeft) + (el.clientWidth
      - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight))
  }
  const clippedBy = el => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX
      if (o === 'hidden' || o === 'auto' || o === 'scroll' || o === 'clip') return `${desc(n)}[overflow-x:${o}]`
    }
    return null
  }

  const out = []
  const walk = el => {
    for (const c of el.children) {
      const cs = getComputedStyle(c)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      const r = c.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) continue
      const escape = r.right - contentRight(el)
      // The page-leak signal. An element escaping its parent's content box
      // inside a legitimate `.sr-scroll-x` (or any hidden/auto/scroll ancestor)
      // is contained and contributes NOTHING to document scrollWidth — this
      // app's wide data tables are deliberately scrollable. What sets the page
      // leak is an element whose right edge passes the VIEWPORT edge with no
      // ancestor clipping it. Rank on that; keep `escape` as the diagnostic.
      const pastViewport = clippedBy(c) ? 0 : +(r.right - window.innerWidth).toFixed(2)
      if (escape > EPS || pastViewport > EPS) {
        out.push({
          pastViewport,
          escape: +escape.toFixed(2),
          path: pathOf(c),
          parent: desc(el),
          width: +r.width.toFixed(2),
          parentContent: +(contentRight(el) - el.getBoundingClientRect().left
            - parseFloat(getComputedStyle(el).paddingLeft)).toFixed(2),
          minWidth: cs.minWidth,
          flexShrink: cs.flexShrink,
          flexWrap: cs.flexWrap,
          whiteSpace: cs.whiteSpace,
          display: cs.display,
          scrollLeak: +(c.scrollWidth - c.clientWidth).toFixed(2),
          clippedBy: clippedBy(c),
          text: (c.textContent || '').trim().slice(0, 60),
        })
      }
      walk(c)
    }
  }
  walk(panel)

  // Rank by what actually leaks the page. The deepest node in a chain is
  // usually the driver, but the chain is reported so a caller can see the
  // ancestor that failed to constrain it, not only the leaf that grew.
  const leakers = out.filter(o => o.pastViewport > EPS).sort((a, b) => b.pastViewport - a.pastViewport)
  const contained = out.filter(o => o.pastViewport <= EPS).sort((a, b) => b.escape - a.escape)
  return {
    panel: desc(panel),
    docScrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
    bodyScrollLeak: +(document.documentElement.scrollWidth - window.innerWidth).toFixed(2),
    leakers: leakers.slice(0, 10),
    leakerCount: leakers.length,
    containedSample: contained.slice(0, 4),
    offenderCount: out.length,
  }
}, { EPS: eps, ROOT: process.env.ROOT || 'panel' })

const results = {}
for (const tab of TABS) {
  for (const scale of [1, 2]) {
    const label = `${tab} @${scale * 100}% / 320px`
    let ctx
    try {
      const opened = await openTab(tab, { width: 320, height: 720 }, scale)
      ctx = opened.ctx
      const r = await findOverflow(opened.p)
      results[label] = r
      console.log(`\n=== ${label} (${ENGINE}) ===`)
      console.log(`page leak: ${r.bodyScrollLeak}px   leakers: ${r.leakerCount} of ${r.offenderCount} overflowing`)
      for (const o of r.leakers) {
        console.log(`  past viewport +${o.pastViewport}px (escape +${o.escape}px)  ${o.path}`)
        console.log(`        w=${o.width} in ${o.parentContent}  min-width:${o.minWidth} shrink:${o.flexShrink} wrap:${o.flexWrap} ws:${o.whiteSpace}`)
        if (o.clippedBy) console.log(`        clipped by ${o.clippedBy}`)
        if (o.text) console.log(`        "${o.text}"`)
      }
    } catch (e) {
      results[label] = { error: e.message.split('\n')[0] }
      console.log(`\n=== ${label} (${ENGINE}) ===\n  FAILED: ${e.message.split('\n')[0]}`)
    } finally {
      if (ctx) await ctx.close()
    }
  }
}

await browser.close()
console.log('\n----- JSON -----')
console.log(JSON.stringify(results, null, 2))
