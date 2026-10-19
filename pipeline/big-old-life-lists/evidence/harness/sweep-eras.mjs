// Drives every tab of the BUILT app over the cross-era export
// (gen-eras-export.mjs, 1850 to 2026) in Chromium and WebKit, with the clock's
// zone pinned to America/New_York (whose local mean time ran until 1883-11-18),
// and records per tab: page errors, console errors, and any "Invalid Date",
// "NaN" or "undefined" in the rendered text. Then reads back the dates the
// Statistics and Checklists tabs print for the boundary checklists.
// (decisions.md entry 9)
//
//   node sweep-eras.mjs <base url> <out.json>
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium, webkit } = require('../../../../website/tools/node_modules/playwright')

const [base, outFile] = process.argv.slice(2)
const TABS = ['Weather', 'Species Detail', 'Statistics', 'Calendar', 'Map Explorer', 'Multimedia', 'Breeding Codes', 'Named Birds', 'Checklists', 'List Comparer', 'Targets']
const BAD = /Invalid Date|\bNaN\b|\bundefined\b|Infinity/
const results = []

for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch(engine === 'chromium' ? { args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {})
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/New_York', locale: 'en-US' })
  const page = await ctx.newPage()
  page.setDefaultTimeout(60_000)
  const errors = []
  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`))
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|net::ERR|404|tile|maplibre|WebGL/i.test(m.text())) errors.push(`console: ${m.text().slice(0, 200)}`) })
  await page.goto(base)
  await page.waitForTimeout(1500)
  for (const tab of TABS) {
    const before = errors.length
    const ok = await page.evaluate((name) => {
      const el = [...document.querySelectorAll('[role="tab"], button')]
        .find(b => b.offsetParent !== null && (b.getAttribute('aria-label') || b.textContent.trim()) === name)
      if (el) el.click()
      return !!el
    }, tab)
    await page.waitForTimeout(tab === 'Statistics' || tab === 'Map Explorer' ? 6000 : 3000)
    const text = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText)
    const bad = text.split('\n').filter(l => BAD.test(l)).slice(0, 5)
    results.push({ engine, tab, reached: ok, newErrors: errors.slice(before), suspectLines: bad, chars: text.length })
  }
  // Read back the boundary years where a tab prints every year: Statistics'
  // "Checklists by year" rows, and the Calendar's year choices.
  const want = ['1850', '1855', '1871', '1883', '1899', '1900', '1912', '1935', '1969', '1970', '1999', '2000', '2024', '2026']
  for (const tab of ['Statistics', 'Calendar']) {
    await page.evaluate((name) => {
      const el = [...document.querySelectorAll('[role="tab"], button')].find(b => b.offsetParent !== null && (b.getAttribute('aria-label') || b.textContent.trim()) === name)
      el?.click()
    }, tab)
    await page.waitForTimeout(3000)
    const body = await page.evaluate(() => {
      const opts = [...document.querySelectorAll('select option')].map(o => o.textContent).join('\n')
      return document.body.innerText + '\n' + opts
    })
    results.push({ engine, tab: `${tab} (boundary years printed)`, found: Object.fromEntries(want.map(y => [y, body.includes(y)])) })
  }
  await browser.close()
}
writeFileSync(outFile, JSON.stringify(results, null, 2) + '\n')
for (const r of results) console.log(JSON.stringify(r))
