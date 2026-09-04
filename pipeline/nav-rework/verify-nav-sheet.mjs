import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')
const BASE = 'http://127.0.0.1:45817/'
const SHEET = '.sr-nav-sheet-root'
const act = p => p.evaluate(sel => {
  const a = document.activeElement
  const sheet = document.querySelector(sel)
  return {
    el: a ? `${a.tagName.toLowerCase()}.${(a.className||'').toString().split(/\s+/)[0]}[${a.getAttribute('aria-label')||(a.textContent||'').trim().slice(0,18)}]` : null,
    sheetPresent: !!sheet,
    inSheet: sheet ? sheet.contains(a) : null,
    rows: sheet ? sheet.querySelectorAll('button.sr-nav-item').length : 0,
  }
}, SHEET)

for (const [eng, nm] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const b = await eng.launch()
  const p = await b.newPage({ viewport: { width: 390, height: 844 } })
  await p.goto(BASE, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.sr-navbar', { timeout: 15000 })
  if (await p.$('[aria-label="Welcome to SnowRaven"]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }
  console.log(`\n===== ${nm} =====`)
  await p.evaluate(() => [...document.querySelectorAll('.sr-navbar-cell')].find(x => /More/.test(x.textContent)).focus())
  const before = (await act(p)).el
  await p.keyboard.press('Enter'); await p.waitForTimeout(600)
  const opened = await act(p)
  console.log(`opened: sheetPresent=${opened.sheetPresent} rows=${opened.rows} focusInSheet=${opened.inSheet} -> ${opened.el}`)

  console.log('-- forward Tab walk --')
  let leftAt = null
  for (let i = 1; i <= 14; i++) {
    await p.keyboard.press('Tab')
    const a = await act(p)
    console.log(`  Tab ${String(i).padStart(2)}: inSheet=${String(a.inSheet).padEnd(5)} ${a.el}`)
    if (!a.inSheet && leftAt === null) { leftAt = i }
    if (leftAt !== null && i >= leftAt + 3) break
  }
  console.log(`  => focus left the sheet at Tab #${leftAt ?? 'never'} (trap ${leftAt === null ? 'HOLDS' : 'DOES NOT HOLD'})`)

  // reopen clean and check Escape + focus return
  await p.keyboard.press('Escape'); await p.waitForTimeout(400)
  await p.evaluate(() => [...document.querySelectorAll('.sr-navbar-cell')].find(x => /More/.test(x.textContent)).focus())
  await p.keyboard.press('Enter'); await p.waitForTimeout(600)
  const o2 = await act(p)
  await p.keyboard.press('Escape'); await p.waitForTimeout(500)
  const c2 = await act(p)
  console.log(`Escape: sheet gone=${!c2.sheetPresent}; focus returned to ${c2.el}; matches More button=${c2.el === before}`)

  // backdrop click closes?
  await p.keyboard.press('Enter'); await p.waitForTimeout(500)
  const beforeBd = await act(p)
  if (beforeBd.sheetPresent) {
    await p.mouse.click(195, 60)  // top of screen, on the scrim
    await p.waitForTimeout(500)
    const afterBd = await act(p)
    console.log(`backdrop click closes: ${!afterBd.sheetPresent}`)
  }
  await b.close()
}
