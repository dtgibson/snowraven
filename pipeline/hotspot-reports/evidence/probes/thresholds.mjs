// The report's column switch and the life list's stacked form (schema 13.4,
// decisions.md D-07). Built app, Chromium and WebKit, text at 100/150/200%.
//
// Leg A (fit): force the WIDER form and sweep its container width directly, so
// the reading is a function of the container and the content alone; the
// smallest width with no text ink and no control box past its card's content
// box is where the wider form stops fitting. Content at the bounds: the stress
// location's 200-character name, five-digit counts, the longest protocol label.
// Leg B (windows): real desktop window widths under a CLASSIC 15px scrollbar and
// an overlay one, reading the report's own width and which form it takes.
// Guard-the-guard: the fit leg's detector must report overflow when the wide
// list is forced into a container far below its fit (it is printed).
import { ENGINES, counters, installRoutes, openApp, setScale, selectTab } from './lib.mjs'

const STRESS = 'L999000001'
const SCALES = [1, 1.5, 2]
const results = { fit: [], windows: [], guard: [] }

const FORCE_TWO_COL = '.sr-hsr-body { grid-template-columns: minmax(0, 1fr) minmax(0, 24rem) !important; } .sr-hsr-jump { display: none !important; }'
const FORCE_ONE_COL = '.sr-hsr-body { grid-template-columns: minmax(0, 1fr) !important; }'
const FORCE_WIDE_LIST = `
.sr-hsr-ll-cols { display: grid !important; }
.sr-hsr-ll-row { grid-template-columns: 2.5rem minmax(0, 1fr) 5.6rem 1.5rem 5.25rem !important; grid-template-areas: "num name date link on" !important; column-gap: 14px !important; }
.sr-hsr-ll-meta { display: contents !important; }
.sr-hsr-ll-date { white-space: nowrap !important; padding-top: 2px !important; }
.sr-hsr-ll-on { display: flex !important; padding-top: 2px !important; }
.sr-hsr-ll-on-fig { white-space: nowrap !important; }
.sr-hsr-ll-words { display: none !important; }
.sr-hsr-ll-bar { display: block !important; }
.sr-hsr-ll-cl, .sr-hsr-ll-dash { width: 1.5rem !important; height: 1.5rem !important; }
.sr-hsr-ll-link { align-self: auto !important; }`

async function openStress(page) {
  await selectTab(page, 'Hotspot Reports')
  const input = page.locator('input.sr-hsr-input')
  await input.waitFor({ state: 'visible', timeout: 30000 })
  await input.click()
  await input.fill('North Channel')
  await page.waitForSelector('.sr-hsr-opt')
  await input.press('Enter')
  await page.waitForSelector('.sr-hsr-report .sr-hsr-name')
  await page.locator('.sr-hsr-ll-row').first().waitFor()
  await page.evaluate(() => (document.activeElement)?.blur())
}

async function style(page, css) {
  await page.evaluate(css => {
    let s = document.getElementById('probe-force')
    if (!s) { s = document.createElement('style'); s.id = 'probe-force'; document.head.appendChild(s) }
    s.textContent = css
  }, css)
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
}

/** The worst horizontal overhang of text ink or a control box past its CELL
 *  (a direct child of a grid row: the list row, a distribution row, a fact) or,
 *  outside a cell, past its card's content box. Text inside an element that
 *  clips with an ellipsis is clipped, not overflowing; it is counted apart. */
async function overhang(page) {
  return page.evaluate(() => {
    const root = document.querySelector('.sr-hsr-report')
    const ROWS = ['sr-hsr-ll-row', 'sr-hsr-ll-meta', 'sr-hsr-ll-cols', 'sr-wx-row', 'sr-hsr-fact', 'sr-hsr-rankrow']
    const cellOf = el => {
      for (let e = el; e && e !== root; e = e.parentElement) {
        const p = e.parentElement
        if (p && ROWS.some(c => p.classList.contains(c)) && getComputedStyle(e).display !== 'contents') return e
      }
      return null
    }
    let worst = 0, where = '', clipped = 0
    const range = document.createRange()
    const check = (el, r, isBox = false) => {
      for (let e = el; e && e !== root; e = e.parentElement) {
        const cs = getComputedStyle(e)
        if (cs.overflowX === 'hidden' && cs.textOverflow === 'ellipsis') { const b = e.getBoundingClientRect(); if (r.right > b.right + 0.5) clipped++; return }
      }
      const boxes = []
      const cell = cellOf(el)
      if (cell && !(isBox && cell === el)) boxes.push(cell)
      boxes.push(el.closest('.sr-hsr-card') ?? root)
      for (const box of boxes) {
        const cs = getComputedStyle(box), b = box.getBoundingClientRect()
        const left = b.left + parseFloat(cs.borderLeftWidth), right = b.right - parseFloat(cs.borderRightWidth)
        const over = Math.max(left - r.left, r.right - right)
        if (over > worst) { worst = over; where = (box === cell ? 'cell ' : 'card ') + (box.className || box.tagName) + ' <- ' + (el.className || el.tagName) }
      }
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement
      if (!n.textContent.trim() || el.closest('.sr-only, .sr-hsr-map')) continue
      range.selectNodeContents(n)
      for (const r of range.getClientRects()) if (r.width > 0) check(el, r)
    }
    for (const el of root.querySelectorAll('a, button, svg, .sr-wx-track, .sr-hsr-ll-bar')) {
      if (el.closest('.sr-only, .sr-hsr-map')) continue
      const r = el.getBoundingClientRect()
      if (r.width > 0) check(el, r, true)
    }
    return { worst: +worst.toFixed(2), where, clipped, pageOver: document.documentElement.scrollWidth - innerWidth }
  })
}

async function sweepFit(page, form, scale) {
  // Width in px of the CONTAINER under test; the reading is reported in em of
  // the container's own font size, which is what the query reads.
  const em = 16 * scale
  let firstFit = null
  const trail = []
  const [from, to, step] = form === 'report' ? [30, 80, 0.25] : [14, 45, 0.25]
  for (let wEm = to; wEm >= from; wEm -= step) {
    const px = wEm * em
    const css = form === 'report'
      ? `${FORCE_TWO_COL} .sr-hsr-report { width: ${px}px !important; max-width: none !important; }`
      : `${FORCE_ONE_COL} ${FORCE_WIDE_LIST} .sr-hsr-report { width: ${px + 2}px !important; max-width: none !important; }`
    await style(page, css)
    const measured = await page.evaluate(form => {
      const el = document.querySelector(form === 'report' ? '.sr-hsr-report' : '.sr-hsr-ll')
      return el.getBoundingClientRect().width
    }, form)
    const o = await overhang(page)
    trail.push([wEm, +(measured / em).toFixed(3), o.worst])
    if (o.worst <= 0.5) firstFit = { wEm, containerEm: +(measured / em).toFixed(3), clipped: o.clipped }
    else { trail.push(['broke', o.where]); break }
  }
  return { firstFit, last: trail[trail.length - 1] }
}

for (const [name, engine] of Object.entries(ENGINES)) {
  const browser = await engine.launch(name === 'chromium' ? { ignoreDefaultArgs: ['--hide-scrollbars'] } : {})
  // ── Leg A: fit, per scale ──────────────────────────────────────────────────
  for (const scale of (process.env.WINDOWS_ONLY === '1' ? [] : SCALES)) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
    const c = counters()
    await installRoutes(ctx, c)
    const page = await ctx.newPage()
    await openApp(page)
    await setScale(page, scale)
    await openStress(page)
    const fitName = await page.locator('.sr-hsr-name').textContent()
    const report = await sweepFit(page, 'report', scale)
    const list = await sweepFit(page, 'list', scale)
    // Guard-the-guard: the wide list forced far below its fit must read as overflow.
    await style(page, `${FORCE_ONE_COL} ${FORCE_WIDE_LIST} .sr-hsr-report { width: ${12 * 16 * scale}px !important; max-width: none !important; }`)
    const guard = await overhang(page)
    results.fit.push({ engine: name, scale, report, list, nameLength: fitName.length, blocked: c.ebirdBlocked.length, foreign: c.foreign.length })
    results.guard.push({ engine: name, scale, worst: guard.worst, where: guard.where })
    await ctx.close()
  }
  // ── Leg B: real windows, classic and overlay scrollbars ───────────────────
  for (const bar of (process.env.FIT_ONLY === '1' ? [] : ['classic', 'overlay'])) {
    for (const scale of [1, 1.5, 2]) {
      const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
      const c = counters()
      await installRoutes(ctx, c)
      const page = await ctx.newPage()
      await openApp(page)
      await page.addStyleTag({ content: bar === 'classic'
        ? '::-webkit-scrollbar { width: 15px; height: 15px; } ::-webkit-scrollbar-thumb { background: #888; }'
        : '::-webkit-scrollbar { width: 0; height: 0; }' })
      await setScale(page, scale)
      await openStress(page)
      for (let w = 641; w <= 1500; w += 10) {
        await page.setViewportSize({ width: w, height: 900 })
        await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
        const r = await page.evaluate(() => {
          const rep = document.querySelector('.sr-hsr-report'), ll = document.querySelector('.sr-hsr-ll')
          const em = parseFloat(getComputedStyle(rep).fontSize)
          return {
            reportEm: +(rep.getBoundingClientRect().width / em).toFixed(2),
            listEm: +(ll.getBoundingClientRect().width / em).toFixed(2),
            twoCol: getComputedStyle(document.querySelector('.sr-hsr-body')).gridTemplateColumns.split(' ').length === 2,
            stacked: getComputedStyle(document.querySelector('.sr-hsr-ll-cols')).display === 'none',
            gutter: innerWidth - document.documentElement.clientWidth,
          }
        })
        const o = await overhang(page)
        results.windows.push({ engine: name, bar, scale, w, ...r, worst: o.worst, pageOver: o.pageOver })
      }
      await ctx.close()
    }
  }
  await browser.close()
}
console.log(JSON.stringify(results))
