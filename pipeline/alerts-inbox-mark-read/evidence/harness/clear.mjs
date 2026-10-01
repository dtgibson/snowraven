import { createRequire } from 'module'
const require = createRequire('/Users/developer/devwork/snowraven-alerts-inbox-mark-read/website/tools/package.json')
const { webkit } = require('playwright')
const EVID = '/Users/developer/devwork/snowraven-alerts-inbox-mark-read/pipeline/alerts-inbox-mark-read/evidence'
const DLG = '[role="dialog"]:has-text("Clear the inbox?")'

const browser = await webkit.launch()
const out = {}
for (const scheme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme })
  const page = await ctx.newPage()
  await page.goto('http://127.0.0.1:8847/?scenario=configured&bar=0')
  await page.waitForSelector('.sr-hdr-inbox')
  await page.click('.sr-hdr-inbox')
  await page.waitForSelector('.sr-inbox-root')
  await page.waitForTimeout(500)
  // Mark read first, then Clear: Clear must still ask, Cancel must change nothing.
  await page.click('.sr-inbox-actions button:has-text("Mark read")')
  await page.waitForTimeout(400)
  const viewedAfterMark = await page.evaluate(() => window.__preview.settings().alertsInboxViewedAt)
  await page.click('.sr-inbox-actions button:has-text("Clear")')
  await page.waitForSelector(DLG)
  await page.waitForTimeout(600)
  const vis = await page.evaluate(sel => {
    const d = document.querySelector('[role="dialog"]')
    const r = d.getBoundingClientRect()
    const cs = getComputedStyle(d)
    return { w: Math.round(r.width), h: Math.round(r.height), opacity: cs.opacity, visibility: cs.visibility, active: document.activeElement?.textContent }
  }, DLG)
  await page.screenshot({ path: `${EVID}/iphone-390-${scheme}-5-clear-confirm.png` })
  await page.locator(`${DLG} button`, { hasText: /^Cancel$/ }).click()
  await page.waitForTimeout(400)
  const afterCancel = await page.evaluate(() => ({ rows: document.querySelectorAll('.sr-alert').length, active: document.activeElement?.textContent, viewed: window.__preview.settings().alertsInboxViewedAt }))
  await page.click('.sr-inbox-actions button:has-text("Clear")')
  await page.waitForSelector(DLG)
  await page.waitForTimeout(500)
  await page.locator(`${DLG} button`, { hasText: /^Clear$/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('.sr-alert').length === 0)
  await page.waitForTimeout(400)
  const afterClear = await page.evaluate(() => ({
    rows: document.querySelectorAll('.sr-alert').length,
    viewed: window.__preview.settings().alertsInboxViewedAt,
    markDisabled: document.querySelectorAll('.sr-inbox-actions button')[0].disabled,
    clearDisabled: document.querySelectorAll('.sr-inbox-actions button')[1].disabled,
    active: document.activeElement?.getAttribute('aria-label'),
    empty: document.querySelector('.sr-inbox-empty')?.textContent,
  }))
  await page.screenshot({ path: `${EVID}/iphone-390-${scheme}-6-after-clear.png` })
  out[scheme] = { viewedAfterMark, dialog: vis, afterCancel, afterClear }
  await ctx.close()
}
await browser.close()
console.log(JSON.stringify(out, null, 2))
