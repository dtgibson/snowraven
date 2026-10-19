// Every tab's page text, the pre-change build against this build, over the SAME
// data folder (serve-dist-proxy.mjs in front of one backend), in Chromium and
// WebKit at 1440px. Writes only whether each tab's text is identical, with a
// hash and a line count, never the text itself: the data is the user's own
// export, which no evidence file may carry. (decisions.md entry 2)
//
//   node compare-builds.mjs <old origin> <new origin> <out.json>
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { writeFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium, webkit } = require('../../../../website/tools/node_modules/playwright')

const [oldBase, newBase, outFile] = process.argv.slice(2)
const TABS = ['Weather', 'Species Detail', 'Statistics', 'Calendar', 'Map Explorer', 'Multimedia', 'Breeding Codes', 'Named Birds', 'Checklists', 'List Comparer', 'Targets']

async function texts(type, base) {
  const browser = await type.launch()
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, timezoneId: 'America/Los_Angeles', locale: 'en-US' })
  // The clock is pinned so "N days ago" and today's date read the same in both runs.
  await ctx.addInitScript(() => {
    const fixed = Date.UTC(2026, 9, 18, 19, 0, 0)
    const RealDate = Date
    // eslint-disable-next-line no-global-assign
    Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [fixed])) } static now() { return fixed } }
  })
  const page = await ctx.newPage()
  page.setDefaultTimeout(60_000)
  await page.goto(base)
  await page.waitForTimeout(2000)
  const welcome = page.getByRole('dialog', { name: /welcome/i })
  if (await welcome.isVisible().catch(() => false)) {
    await page.waitForFunction(() => document.activeElement?.closest('[role="dialog"]') != null)
    await page.keyboard.press('Escape')
    await welcome.waitFor({ state: 'detached' })
  }
  const out = {}
  for (const tab of TABS) {
    await page.evaluate((name) => {
      const el = [...document.querySelectorAll('[role="tab"], button')]
        .find(b => b.offsetParent !== null && (b.getAttribute('aria-label') || b.textContent.trim()) === name)
      el?.click()
    }, tab)
    // Settle: wait until the tab's text stops changing for 1.5 s.
    let prev = ''
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(750)
      const t = await page.evaluate(() => (document.querySelector('main') ?? document.body).innerText)
      if (t === prev && t.length > 0) break
      prev = t
    }
    out[tab] = prev
  }
  await browser.close()
  return out
}

const results = []
for (const [engine, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const before = await texts(type, oldBase)
  const after = await texts(type, newBase)
  for (const tab of TABS) {
    const a = before[tab], b = after[tab]
    const h = (s) => createHash('sha256').update(s).digest('hex').slice(0, 16)
    const al = a.split('\n'), bl = b.split('\n')
    results.push({ engine, tab, identical: a === b, lines: al.length, hashBefore: h(a), hashAfter: h(b), differingLines: a === b ? 0 : al.filter((l, i) => l !== bl[i]).length + Math.abs(al.length - bl.length) })
  }
}
writeFileSync(outFile, JSON.stringify(results, null, 2) + '\n')
for (const r of results) console.log(JSON.stringify(r))
