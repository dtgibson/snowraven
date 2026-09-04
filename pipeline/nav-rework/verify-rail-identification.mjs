// The icon rail's identification argument (design-refinement.md, layer 1) and the
// claim published in docs/HELP.md + README.md: "the heading at the top of each
// page names the tab you are on". Measured, per destination, at RAIL density.
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium } = require('playwright')
const BASE = 'http://127.0.0.1:45817/'
const DESTS = ['Weather','Statistics','Calendar','Species Detail','Map Explorer','Multimedia',
               'Breeding Codes','Checklists','List Comparer','Named Birds','Settings']

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 834, height: 1000 } })
await p.goto(BASE, { waitUntil: 'domcontentloaded' })
await p.waitForSelector('.sr-nav-col--rail', { timeout: 15000 })
if (await p.$('[aria-label="Welcome to SnowRaven"]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }

console.log('rail density 834px — does a visible heading name the destination?\n')
console.log('destination      headings visible in <main>                       names it?')
for (const d of DESTS) {
  await p.locator(`.sr-nav-item[aria-label="${d}"]`).first().click()
  await p.waitForTimeout(900)
  const r = await p.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return { hs: [], first: null }
    const hs = [...main.querySelectorAll('h1,h2,h3,h4,h5,h6')]
      .filter(h => {
        const s = getComputedStyle(h)
        const rect = h.getBoundingClientRect()
        return s.display !== 'none' && s.visibility !== 'hidden' && rect.height > 0 &&
               !h.className.toString().includes('sr-only')
      })
      .map(h => `${h.tagName.toLowerCase()}:"${(h.textContent||'').trim().slice(0, 34)}"`)
    return { hs }
  })
  const names = r.hs.some(h => h.toLowerCase().includes(d.toLowerCase()))
  console.log(`${d.padEnd(16)} ${(r.hs.length ? r.hs.join(' | ') : '(none)').padEnd(52)} ${names ? 'YES' : 'NO'}`)
}
await b.close()
