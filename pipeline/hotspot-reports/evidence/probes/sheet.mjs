// The phone More sheet with thirteen tabs (FR-05, QA-05; schema 10.3).
// 393x852, `.sr-ios-app`, a 34px bottom inset, text at 100%, default layout.
// Legs: (1) the natural height H of the sheet with the cap lifted; (2) the cap
// under test (argv[2], e.g. "min(73dvh, 616px)"): the list must not scroll and
// its last row must be inside the sheet; (3) today's cap restored, which must
// scroll (the probe can reject a revert); (4) 320x568, where the list may
// scroll and Settings must stay in the foot and in view.
import { ENGINES, BASE, counters, installRoutes, openApp, applyIos, assertBackendServesDemoData } from './lib.mjs'

const CAP = process.argv[2] ?? 'min(73dvh, 616px)'
await assertBackendServesDemoData(BASE)
const out = {}
for (const [name, engine] of Object.entries(ENGINES)) {
  const browser = await engine.launch()
  const leg = async (vp, cap) => {
    const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 3 })
    const c = counters()
    await installRoutes(ctx, c)
    const page = await ctx.newPage()
    await openApp(page)
    await applyIos(page)
    await page.locator('.sr-navbar button[aria-haspopup="dialog"]').click()
    await page.waitForSelector('[role="dialog"] .sr-nav-sheet-body .sr-nav-item')
    await page.waitForTimeout(500)
    await applyIos(page)
    const r = await page.evaluate(cap => {
      const sheet = document.querySelector('.sr-nav-sheet')
      if (cap !== null) sheet.style.maxHeight = cap
      const body = sheet.querySelector('.sr-nav-sheet-body')
      const foot = sheet.querySelector('.sr-nav-sheet-foot')
      const rows = [...body.querySelectorAll('.sr-nav-item')]
      const last = rows[rows.length - 1].getBoundingClientRect()
      const sb = sheet.getBoundingClientRect()
      const settings = foot.querySelector('.sr-nav-item').getBoundingClientRect()
      return {
        ios: document.documentElement.classList.contains('sr-ios-app'),
        padBottom: getComputedStyle(sheet).paddingBottom,
        rows: rows.length + 1,
        labels: rows.map(r => r.textContent.trim()),
        sheetH: +sb.height.toFixed(2),
        bodyScroll: body.scrollHeight, bodyClient: body.clientHeight,
        lastRowInside: last.bottom <= sb.bottom + 0.5 && last.bottom <= body.getBoundingClientRect().bottom + 0.5,
        settingsInView: settings.top >= 0 && settings.bottom <= innerHeight + 0.5 && settings.bottom <= sb.bottom + 0.5,
        footH: +foot.getBoundingClientRect().height.toFixed(2),
        bodyH: +body.getBoundingClientRect().height.toFixed(2),
        vh: innerHeight,
      }
    }, cap)
    r.blocked = c.ebirdBlocked.length; r.foreign = c.foreign.length; r.region = c.region
    await ctx.close()
    return r
  }
  out[name] = {
    natural: await leg({ width: 393, height: 852 }, 'none'),
    underTest: await leg({ width: 393, height: 852 }, CAP),
    today: await leg({ width: 393, height: 852 }, 'min(70dvh, 528px)'),
    shipped: await leg({ width: 393, height: 852 }, null),
    se: await leg({ width: 320, height: 568 }, null),
  }
  await browser.close()
}
console.log(JSON.stringify(out, null, 1))
