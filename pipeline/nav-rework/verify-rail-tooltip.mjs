import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')
const BASE = 'http://127.0.0.1:45817/'
const tip = p => p.evaluate(() => {
  const t = document.querySelector('.sr-nav-tip')
  if (!t) return { present: false }
  const s = getComputedStyle(t)
  return { present: true, text: (t.textContent||'').trim(), opacity: s.opacity,
           on: t.classList.contains('sr-nav-tip--on'), ariaHidden: t.getAttribute('aria-hidden') }
})
for (const [eng, nm] of [[chromium,'Chromium'],[webkit,'WebKit']]) {
  const b = await eng.launch()
  const p = await b.newPage({ viewport: { width: 834, height: 1000 } })
  await p.goto(BASE, { waitUntil: 'domcontentloaded' })
  await p.waitForSelector('.sr-nav-col--rail', { timeout: 15000 })
  if (await p.$('[aria-label="Welcome to SnowRaven"]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }
  console.log(`\n== ${nm} rail tooltip ==`)
  console.log('  idle          :', JSON.stringify(await tip(p)))
  await p.locator('.sr-nav-item[aria-label="Breeding Codes"]').first().hover()
  await p.waitForTimeout(450)
  console.log('  after hover   :', JSON.stringify(await tip(p)))
  await p.mouse.move(600, 500); await p.waitForTimeout(350)
  console.log('  after unhover :', JSON.stringify(await tip(p)))
  // keyboard focus-visible
  await p.evaluate(() => document.querySelector('.sr-nav-item[aria-selected="true"]').focus())
  await p.keyboard.press('ArrowDown'); await p.waitForTimeout(450)
  console.log('  after ArrowDn :', JSON.stringify(await tip(p)))
  await b.close()
}
