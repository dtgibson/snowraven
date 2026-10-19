// The milestone grid's re-measure for the five-digit label (decisions.md entry
// 8; the v1.0.50 reversal condition, DECISIONS.md ~181): the BUILT app, served
// by the backend over the 10,050-species fixture (gen-milestone-export.mjs), at
// 320px, at 100% and 200% in-app text, in Chromium and WebKit. Records every
// badge's width, the grid's column count, and whether any one-line item
// (the threshold, the date) overflows or wraps; screenshots the grid.
//
//   node measure-milestone-grid.mjs <base url> <out dir>
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const require = createRequire(import.meta.url)
const { chromium, webkit } = require('../../../../website/tools/node_modules/playwright')

const [base, outDir] = process.argv.slice(2)
mkdirSync(outDir, { recursive: true })
const results = []

for (const [engineName, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch()
  for (const scale of [1, 2]) {
    const ctx = await browser.newContext({ viewport: { width: 320, height: 900 }, deviceScaleFactor: 2 })
    await ctx.addInitScript((s) => { try { localStorage.setItem('sr-text-scale', String(s)); localStorage.setItem('sr-theme', 'light') } catch { /* private mode */ } }, scale)
    const page = await ctx.newPage()
    page.setDefaultTimeout(120_000)
    await page.goto(base)
    // A first launch with no keys may show Welcome; dismiss it once its
    // listener is armed (website/tools/verify/dismissWelcome.mjs's signal).
    const welcome = page.getByRole('dialog', { name: /welcome/i })
    if (await welcome.isVisible().catch(() => false)) {
      await page.waitForFunction(() => document.activeElement?.closest('[role="dialog"]') != null)
      await page.keyboard.press('Escape')
      await welcome.waitFor({ state: 'detached' })
    }
    // The visible Statistics control, by its name, clicked in the page: at 200%
    // text it can sit in the bar or in the More sheet.
    const clickStats = () => page.evaluate(() => {
      const el = [...document.querySelectorAll('button, [role="tab"]')]
        .find(b => b.offsetParent !== null && (b.getAttribute('aria-label') || b.textContent.trim()) === 'Statistics')
      if (el) el.click()
      return !!el
    })
    if (!(await clickStats())) {
      await page.getByRole('button', { name: /^More/ }).filter({ visible: true }).first().click()
      if (!(await clickStats())) throw new Error(`${engineName} ${scale}: no Statistics control`)
    }
    const list = page.getByRole('list', { name: 'Life list milestones' })
    await list.waitFor()
    await page.waitForFunction(() => document.querySelectorAll('.sr-ms-grid > li').length >= 56)
    const m = await page.evaluate(() => {
      const grid = document.querySelector('.sr-ms-grid')
      const items = [...grid.querySelectorAll(':scope > li')]
      const lefts = new Set(items.map(li => Math.round(li.getBoundingClientRect().left)))
      const rows = items.map(li => {
        const num = li.querySelector('.sr-ms-num')
        const date = li.querySelector('.sr-ms-date')
        const lh = parseFloat(getComputedStyle(num).lineHeight) || parseFloat(getComputedStyle(num).fontSize) * 1.2
        const dateText = date.querySelector('a') ?? date
        const dlh = parseFloat(getComputedStyle(dateText).lineHeight) || parseFloat(getComputedStyle(dateText).fontSize) * 1.2
        return {
          label: num.textContent,
          badgeWidth: +li.getBoundingClientRect().width.toFixed(2),
          numOverflowX: num.scrollWidth - num.clientWidth,
          numWrapped: num.getBoundingClientRect().height > lh * 1.5,
          numSlack: +(li.clientWidth - parseFloat(getComputedStyle(li).paddingLeft) - parseFloat(getComputedStyle(li).paddingRight) - num.scrollWidth).toFixed(2),
          dateOverflowX: date.scrollWidth - date.clientWidth,
          dateWrapped: dateText.getBoundingClientRect().height > dlh * 1.5,
          badgeOverflowX: li.scrollWidth - li.clientWidth,
        }
      })
      return {
        rootFontPx: parseFloat(getComputedStyle(document.documentElement).fontSize),
        gridWidth: +grid.getBoundingClientRect().width.toFixed(2),
        columns: lefts.size,
        badges: items.length,
        pageOverflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        widest: rows.filter(r => /,\d{3}$/.test(r.label)).map(r => r.label).slice(-1)[0],
        ten000: rows.find(r => r.label === '10,000') ?? null,
        anyNumOverflow: rows.some(r => r.numOverflowX > 0 || r.numWrapped),
        anyDateOverflow: rows.some(r => r.dateOverflowX > 0 || r.dateWrapped),
        anyBadgeOverflow: rows.some(r => r.badgeOverflowX > 0),
        minNumSlack: Math.min(...rows.map(r => r.numSlack)),
      }
    })
    const shot = join(outDir, `milestone-grid-320-${engineName}-${scale * 100}pct-tail.png`)
    // The tail of the grid, where the five-digit labels are: the last eight
    // badges, clipped in page coordinates.
    const clip = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.sr-ms-grid > li')].slice(-8)
      const grid = document.querySelector('.sr-ms-grid').getBoundingClientRect()
      const top = Math.min(...items.map(li => li.getBoundingClientRect().top)) + window.scrollY - 8
      const bottom = Math.max(...items.map(li => li.getBoundingClientRect().bottom)) + window.scrollY + 8
      return { x: Math.max(0, grid.left - 8), y: top, width: Math.min(320, grid.width + 16), height: bottom - top }
    })
    await page.screenshot({ path: shot, clip, fullPage: true })
    results.push({ engine: engineName, textScale: `${scale * 100}%`, viewport: 320, ...m, screenshot: shot.split('/').pop() })
    await ctx.close()
  }
  await browser.close()
}
writeFileSync(join(outDir, 'milestone-grid-320.json'), JSON.stringify(results, null, 2) + '\n')
console.log(JSON.stringify(results.map(({ engine, textScale, columns, badges, gridWidth, ten000, anyNumOverflow, anyDateOverflow, anyBadgeOverflow, pageOverflowX, minNumSlack }) => ({ engine, textScale, columns, badges, gridWidth, ten000, anyNumOverflow, anyDateOverflow, anyBadgeOverflow, pageOverflowX, minNumSlack })), null, 1))
