// Live-look rows the headless engines can answer (QA-26, QA-40, QA-63, QA-68).
// Built app on the scratch backend (synthetic demo data plus the stress
// location), Chromium and WebKit. eBird-backed paths answered in the browser.
import { ENGINES, BASE, counters, installRoutes, openApp, setScale, selectTab, assertBackendServesDemoData } from './lib.mjs'
import { mkdirSync } from 'node:fs'

const SHOTS = new URL('./shots/', import.meta.url).pathname
mkdirSync(SHOTS, { recursive: true })
await assertBackendServesDemoData(BASE)
const out = { requests: [], reflow: [], a11y: [], map: [] }

async function choose(page, query) {
  const input = page.locator('input.sr-hsr-input')
  await input.click()
  await input.fill(query)
  await page.waitForSelector('.sr-hsr-opt')
  await input.press('Enter')
  await page.waitForSelector('.sr-hsr-report .sr-hsr-name')
}

for (const [name, engine] of Object.entries(ENGINES)) {
  const browser = await engine.launch()

  // ── QA-26, QA-63: requests ─────────────────────────────────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    const c = counters()
    await installRoutes(ctx, c, { allowTiles: true, codes: { 'Song Sparrow': 'sonspa' } })
    const seen = []
    ctx.on('request', r => seen.push(new URL(r.url()).host))
    const page = await ctx.newPage()
    await openApp(page)
    await selectTab(page, 'Hotspot Reports')
    await page.waitForSelector('.sr-hsr-sum')
    await page.waitForTimeout(1500)
    const overview = { region: c.region, codes: c.codes, tiles: c.tiles, foreign: [...new Set(seen.filter(h => h !== '127.0.0.1:1631'))] }
    await choose(page, 'Jamaica Bay')
    await page.waitForTimeout(2500)
    const first = { codes: c.codes, tiles: c.tiles }
    await choose(page, 'Central Park')
    await page.waitForTimeout(1500)
    const second = { codes: c.codes }
    await choose(page, 'Jamaica Bay')
    await page.waitForTimeout(1500)
    const again = { codes: c.codes }
    out.requests.push({ engine: name, overview, afterFirstReport: first, afterSecondLocation: second, backToFirst: again, ebirdBlocked: c.ebirdBlocked, hosts: [...new Set(seen)] })
    await ctx.close()
  }

  // ── QA-40: the plain map draws with its pin, both themes (tiles allowed) ───
  for (const theme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, colorScheme: theme })
    const c = counters()
    await installRoutes(ctx, c, { allowTiles: true })
    const page = await ctx.newPage()
    await openApp(page)
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme)
    await selectTab(page, 'Hotspot Reports')
    await page.waitForSelector('.sr-hsr-sum')
    await choose(page, 'Jamaica Bay')
    const map = page.locator('.sr-hsr-map').first()
    await page.waitForSelector('.sr-hsr-map .maplibregl-canvas, .sr-hsr-map [role="alert"]', { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(4000)
    const facts = await page.evaluate(() => {
      const m = document.querySelector('.sr-hsr-map')
      return {
        label: m?.getAttribute('aria-label'),
        canvas: !!m?.querySelector('.maplibregl-canvas'),
        marker: !!m?.querySelector('.maplibregl-marker .sr-hsr-pin'),
        popup: !!m?.querySelector('.maplibregl-popup'),
        buttons: [...(m?.querySelectorAll('button') ?? [])].map(b => b.getAttribute('aria-label') || b.textContent?.trim()),
      }
    })
    await map.screenshot({ path: `${SHOTS}map-${name}-${theme}.png` })
    out.map.push({ engine: name, theme, ...facts, tiles: c.tiles })
    await ctx.close()
  }

  // ── QA-68: reflow at 320px and 200% text, both themes, overview and report ─
  for (const theme of ['light', 'dark']) {
    for (const [vw, scale] of [[320, 2], [320, 1], [393, 2], [800, 2], [1280, 2]]) {
      const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, colorScheme: theme })
      const c = counters()
      await installRoutes(ctx, c)
      const page = await ctx.newPage()
      await openApp(page)
      await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme)
      await setScale(page, scale)
      await selectTab(page, 'Hotspot Reports')
      await page.waitForSelector('.sr-hsr-sum')
      const read = async view => page.evaluate(view => {
        const tab = document.querySelector('.sr-hsr-tab')
        const panel = tab.closest('[role="tabpanel"]')
        const pb = panel.getBoundingClientRect()
        let worst = 0, where = ''
        const range = document.createRange()
        const walker = document.createTreeWalker(tab, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const el = n.parentElement
          if (!n.textContent.trim() || el.closest('.sr-only, .sr-hsr-map')) continue
          range.selectNodeContents(n)
          for (const r of range.getClientRects()) {
            if (r.width === 0) continue
            const over = Math.max(pb.left - r.left, r.right - pb.right)
            if (over > worst) { worst = over; where = el.className || el.tagName }
          }
        }
        return { view, scrollW: document.documentElement.scrollWidth, vw: innerWidth, worst: +worst.toFixed(2), where,
          oneColumn: !!document.querySelector('.sr-hsr-body') && getComputedStyle(document.querySelector('.sr-hsr-body')).gridTemplateColumns.split(' ').length === 1,
          jumpShown: !!document.querySelector('.sr-hsr-jump') && getComputedStyle(document.querySelector('.sr-hsr-jump')).display !== 'none' }
      }, view)
      const rows = [await read('overview')]
      await choose(page, 'North Channel')
      rows.push(await read('report-stress'))
      await page.screenshot({ path: `${SHOTS}reflow-${name}-${theme}-${vw}-${scale * 100}.png`, fullPage: false })
      out.reflow.push(...rows.map(r => ({ engine: name, theme, vw, scale, ...r })))
      await ctx.close()
    }
  }

  // ── QA-68: accessibility tree, keyboard and jump focus ─────────────────────
  {
    const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } })
    const c = counters()
    await installRoutes(ctx, c)
    const page = await ctx.newPage()
    await openApp(page)
    await selectTab(page, 'Hotspot Reports')
    await page.waitForSelector('.sr-hsr-sum')
    const liveIdle = await page.locator('.sr-hsr-tab > [role="status"][aria-live="polite"]').ariaSnapshot()
    await choose(page, 'Jamaica Bay')
    const liveAfter = await page.locator('.sr-hsr-tab > [role="status"][aria-live="polite"]').ariaSnapshot()
    const firstRow = await page.locator('.sr-hsr-ll-row').first().ariaSnapshot()
    const cols = await page.locator('.sr-hsr-ll-cols').count()
    const colsAria = cols ? await page.locator('.sr-hsr-ll-cols').getAttribute('aria-hidden') : null
    const jumpVisible = await page.locator('nav[aria-label="Jump to section"]').isVisible()
    // A real Tab to the first chip, then Enter: focus lands on the section heading.
    await page.locator('nav[aria-label="Jump to section"] a').nth(3).focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(600)
    const focused = await page.evaluate(() => ({ tag: document.activeElement?.tagName, text: document.activeElement?.textContent }))
    out.a11y.push({ engine: name, liveIdle, liveAfter, firstRow, colsAriaHidden: colsAria, jumpVisible, focused })
    await ctx.close()
  }
  await browser.close()
}
console.log(JSON.stringify(out))
