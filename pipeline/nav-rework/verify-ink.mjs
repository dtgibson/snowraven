// The design table's own metric: FULL-TEXT label ink vs the label's box, at the
// two cells it names by number (Statistics 48/48 at 320/1x, Species Detail 72/72
// at 390/1x).
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')
const BASE = 'http://127.0.0.1:45817/'
const probe = () => [...document.querySelectorAll('.sr-navbar-cell')].map(c => {
  const l = c.querySelector('.sr-navbar-label')
  if (!l || getComputedStyle(l).display === 'none') return null
  const r = document.createRange(); r.selectNodeContents(l)
  const full = r.getBoundingClientRect().width   // full rendered text ink
  const span = document.createElement('span')
  const ls = getComputedStyle(l)
  span.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${ls.fontStyle} ${ls.fontWeight} ${ls.fontSize}/${ls.lineHeight} ${ls.fontFamily};letter-spacing:${ls.letterSpacing}`
  span.textContent = l.textContent
  document.body.appendChild(span)
  const unwrapped = span.getBoundingClientRect().width
  span.remove()
  return { text: l.textContent, box: l.clientWidth, inkWrapped: +full.toFixed(1),
           inkUnwrapped: +unwrapped.toFixed(1), fits: unwrapped <= l.clientWidth + 0.5 }
}).filter(Boolean)

for (const [eng, nm] of [[chromium,'Chromium'],[webkit,'WebKit']]) {
  const b = await eng.launch()
  for (const w of [320, 390, 430]) {
    const p = await b.newPage({ viewport: { width: w, height: 844 } })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-navbar', { timeout: 15000 })
    if (await p.$('[aria-label="Welcome to SnowRaven"]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }
    await p.waitForTimeout(300)
    const rows = await p.evaluate(probe)
    console.log(`\n-- ${nm} ${w}px @1x --`)
    for (const r of rows) {
      console.log(`   ${r.text.padEnd(16)} unwrapped ink ${String(r.inkUnwrapped).padStart(6)}  box ${String(r.box).padStart(4)}  ${r.fits ? 'fits on one line' : 'wraps to 2 lines (no clip)'}`)
    }
    await p.close()
  }
  await b.close()
}
