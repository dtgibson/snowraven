// Breeding Codes card-width probe (feature: pin-labels-column-width).
//
// WHY THIS EXISTS. The defect and the fix are both geometric: which element's
// intrinsic width the Unbounded card is sized FROM. vitest/jsdom has no layout
// engine, and a stylesheet assertion can only prove a declaration exists, never
// that it wins or what it measures — so the house rule is that a CSS-only fix is
// verified against a REAL RENDER. This drives the actual app (built frontend +
// FastAPI backend) with Playwright and measures the shipped DOM nodes.
//
// Page scrollWidth is deliberately NOT used as the signal: this repo has measured
// it certify a broken build twice (an overflow:hidden ancestor swallows it, and a
// left overflow never extends it). Every claim below measures an ELEMENT against
// its CONTAINER'S CONTENT BOX.
//
// The nodes are resolved by structural DOM path from the <table>, and each one is
// guarded (tag, class, child shape) so a silent re-resolution to the wrong node
// cannot pass as a measurement.
//
// Run against a SnowRaven instance serving SYNTHETIC demo data (never a real
// export — website/tools/demo-data, pointed at with SR_DATA_DIR):
//
//   cd frontend && npm run build
//   cd backend  && SR_DATA_DIR=$PWD/../website/tools/demo-data \
//                  ./.venv/bin/uvicorn main:app --port 1621
//   node pipeline/pin-labels-column-width/card-width-probe.mjs
//
//   BASE  app origin (default http://localhost:1621)
// ENGINE=chromium (default) | webkit. The app ships in WKWebView on macOS and
// iOS, and the fix turns on an intrinsic-sizing detail (a percentage min-width is
// indefinite while the container is sized intrinsically), so it is measured in
// BOTH engines rather than reasoned about from one.
import { chromium, webkit } from '../../website/tools/node_modules/playwright/index.mjs'

const BASE = process.env.BASE || 'http://localhost:1621'
const ENGINE = process.env.ENGINE || 'chromium'

const browser = ENGINE === 'webkit'
  ? await webkit.launch({ headless: true })
  : await chromium.launch({ headless: true, args: ['--hide-scrollbars'] })

async function openTab(vp, textScale) {
  const ctx = await browser.newContext({ viewport: vp })
  const p = await ctx.newPage()
  p.setDefaultTimeout(30000)
  await p.goto(BASE, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('[role="tab"], button[aria-haspopup="listbox"]')
  const strip = await p.$$('[role="tab"]')
  let clicked = false
  for (const h of strip) {
    if ((await h.textContent() || '').trim() === 'Breeding Codes') { await h.click(); clicked = true; break }
  }
  if (!clicked) {
    const trigger = await p.$('button[aria-haspopup="listbox"]')
    if (!trigger) throw new Error('no tab strip and no nav dropdown')
    await trigger.click()
    await p.waitForTimeout(300)
    for (const o of await p.$$('[role="option"], [role="listbox"] button, [role="listbox"] li')) {
      if ((await o.textContent() || '').trim() === 'Breeding Codes') { await o.click(); clicked = true; break }
    }
  }
  if (!clicked) throw new Error('Breeding Codes tab not found')
  if (textScale && textScale !== 1) {
    await p.evaluate((s) => document.documentElement.style.setProperty('--sr-text-scale', String(s)), textScale)
  }
  await p.waitForSelector('table.sr-bc-matrix', { timeout: 30000 })
  await p.waitForTimeout(1200)
  return { ctx, p }
}

/** Press a control by its exact trimmed text. Throws on a miss (a silent no-op
 *  would measure the previous state and look like a passing result). */
async function press(p, text) {
  for (const b of await p.$$('button')) {
    if ((await b.textContent() || '').trim() === text) { await b.click(); await p.waitForTimeout(500); return }
  }
  throw new Error(`control not found: ${text}`)
}

const measure = async (p) => p.evaluate(() => {
  const table = document.querySelector('table.sr-bc-matrix')
  if (!table) throw new Error('matrix table not found')
  const wrapper = table.parentElement
  const card = wrapper.parentElement
  const container = card.parentElement                 // BreedingCodeList root (flex column)
  const legend = card.lastElementChild
  // Guard every resolved node: the path is structural, so a component reshape
  // must fail here rather than quietly measure a different element.
  if (card.children.length !== 2) throw new Error(`card child count ${card.children.length}, expected 2`)
  if (legend === wrapper) throw new Error('legend resolved to the table wrapper')
  if (!/Confirmed|Probable|Possible/.test(legend.textContent || '')) throw new Error('legend node has no tier labels')

  const box = (el) => el.getBoundingClientRect().width
  const contentBox = (el) => {
    const cs = getComputedStyle(el)
    return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  }
  // Intrinsic contribution of a subtree, measured the way the card sizes itself:
  // clone it into a detached intrinsically-sized box and read the used width. The
  // clone keeps its classes, so .sr-bc-legend's own constraint travels with it —
  // which is exactly what has to be measured (its CONTRIBUTION, not its content).
  // `hostClass` matters: .sr-bc-legend's constraint is scoped under .sr-bc-card, so
  // a bare host measures the legend's raw CONTENT width (the driver figure) while a
  // .sr-bc-card host measures what it actually CONTRIBUTES to the card.
  const intrinsicOf = (el, mode, hostClass = '') => {
    const host = document.createElement('div')
    host.className = hostClass
    host.style.cssText = `position:absolute;left:-99999px;top:0;width:${mode};visibility:hidden;display:flex;flex-direction:column`
    host.appendChild(el.cloneNode(true))
    document.body.appendChild(host)
    const w = host.firstElementChild.getBoundingClientRect().width
    host.remove()
    return w
  }
  const maxContentOf = (el) => intrinsicOf(el, 'max-content')
  const minContentOf = (el) => intrinsicOf(el, 'min-content')

  const codeCols = [...table.querySelectorAll('thead th.sr-bc-code-col')]
  const nameCol = table.querySelector('thead th.sr-bc-name-col')
  const cRect = card.getBoundingClientRect()
  const contRect = container.getBoundingClientRect()
  const contCs = getComputedStyle(container)
  const contentRight = contRect.left + parseFloat(contCs.paddingLeft) + contentBox(container)

  return {
    viewport: window.innerWidth,
    cardClasses: card.className,
    legendClasses: legend.className,
    container: +contentBox(container).toFixed(2),
    card: +box(card).toFixed(2),
    table: +box(table).toFixed(2),
    legend: +box(legend).toFixed(2),
    nameCol: +box(nameCol).toFixed(2),
    codeCol: +box(codeCols[0]).toFixed(2),
    codeColCount: codeCols.length,
    tableMaxContent: +maxContentOf(table).toFixed(2),
    tableMinContent: +minContentOf(table).toFixed(2),
    // The legend's raw content width — what used to size the card.
    legendMaxContent: +maxContentOf(legend).toFixed(2),
    legendMinContent: +minContentOf(legend).toFixed(2),
    // What the legend CONTRIBUTES to a max-content card (measured inside a
    // .sr-bc-card host, so the scoped rule applies). After the fix this must equal
    // legendMinContent, not legendMaxContent.
    legendContribToCard: +intrinsicOf(legend, 'max-content', 'sr-bc-card').toFixed(2),
    // A chip escaping the card's rounded border — the failure mode a
    // zero-contribution fix (width:0 / contain:inline-size) would have allowed.
    legendChipOverflow: +(legend.scrollWidth - legend.clientWidth).toFixed(2),
    // The element measured against its container's content box — the only
    // overflow signal this repo trusts.
    cardOverflowsContainerBy: +(cRect.right - contentRight).toFixed(2),
    // Trailing empty card to the right of the table (the v0.5.70 phone symptom).
    cardMinusTable: +(box(card) - box(table)).toFixed(2),
  }
})

/** Strip the fix from the live page. The whole DOM-side change is one class on the
 *  legend, so removing it leaves the shipped-before-this-fix computed styles on the
 *  SAME nodes — a like-for-like A/B rather than a comparison across two builds. */
const unfix = async (p) => p.evaluate(() => {
  const legend = document.querySelector('table.sr-bc-matrix').parentElement.parentElement.lastElementChild
  if (!legend.classList.contains('sr-bc-legend')) throw new Error('legend is not carrying .sr-bc-legend — nothing to remove')
  legend.classList.remove('sr-bc-legend')
  return legend.getBoundingClientRect().width   // forces layout
})

const results = []
async function run(label, { vp, textScale = 1, steps = [] }) {
  const { ctx, p } = await openTab(vp, textScale)
  try {
    for (const s of steps) await press(p, s)
    const after = await measure(p)
    await unfix(p)
    const before = await measure(p)
    results.push({ label, after, before })
    console.log(label)
    console.log('   before:', JSON.stringify(before))
    console.log('   after: ', JSON.stringify(after))
  } finally {
    await ctx.close()
  }
}

const DESKTOP = { width: 1440, height: 900 }
const WIDE = { width: 1728, height: 1000 }
const PHONE = { width: 320, height: 720 }

await run('desktop-1440 normal', { vp: DESKTOP })
await run('desktop-1440 unbounded', { vp: DESKTOP, steps: ['↔ Unbounded'] })
await run('desktop-1440 pinned', { vp: DESKTOP, steps: ['Pin code labels'] })
await run('desktop-1728 unbounded', { vp: WIDE, steps: ['↔ Unbounded'] })
await run('phone-320 normal', { vp: PHONE })
await run('phone-320 unbounded', { vp: PHONE, steps: ['↔ Unbounded'] })
await run('phone-320 pinned', { vp: PHONE, steps: ['Pin code labels'] })
await run('phone-320 unbounded @200% text', { vp: PHONE, textScale: 2, steps: ['↔ Unbounded'] })
await run('desktop-1440 unbounded @200% text', { vp: DESKTOP, textScale: 2, steps: ['↔ Unbounded'] })

await browser.close()
console.log('\n' + JSON.stringify(results, null, 2))
