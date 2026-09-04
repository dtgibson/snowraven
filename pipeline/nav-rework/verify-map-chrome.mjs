// Does the fixed phone bar underlap the map panel or the footer? And does the map
// still size correctly at sidebar and rail density now the brand block has left
// the page header?
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')
const BASE = process.env.NAV_BASE || 'http://127.0.0.1:45817/'

async function dismissWelcome(p) {
  if (await p.$('[aria-label="Welcome to SnowRaven"]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }
}

const read = () => {
  const bar = document.querySelector('.sr-navbar')
  const panel = document.querySelector('.sr-map-explorer-panel')
  const footer = document.querySelector('.sr-app-footer')
  const main = document.querySelector('main')
  const de = document.documentElement
  const r = el => el ? el.getBoundingClientRect() : null
  const b = r(bar), pa = r(panel), f = r(footer), m = r(main)
  return {
    density: bar ? 'phone' : (document.querySelector('.sr-nav-col--rail') ? 'rail' : 'sidebar'),
    mapChrome: main ? getComputedStyle(main).getPropertyValue('--sr-map-chrome').trim() : null,
    panelFound: !!panel,
    panelH: pa ? +pa.height.toFixed(1) : null,
    panelBottom: pa ? +pa.bottom.toFixed(1) : null,
    footerBottom: f ? +f.bottom.toFixed(1) : null,
    footerTop: f ? +f.top.toFixed(1) : null,
    barTop: b ? +b.top.toFixed(1) : null,
    barH: b ? +b.height.toFixed(1) : null,
    mainBottom: m ? +m.bottom.toFixed(1) : null,
    viewportH: window.innerHeight,
    docScrollH: de.scrollHeight,
    hScroll: de.scrollWidth > de.clientWidth,
    // does anything the bar covers actually sit under it?
    panelUnderBar: (pa && b) ? +(pa.bottom - b.top).toFixed(1) : null,
    footerUnderBar: (f && b) ? +(f.bottom - b.top).toFixed(1) : null,
  }
}

async function openMap(p, phone) {
  if (!phone) {
    await p.locator('.sr-nav-item', { hasText: 'Map Explorer' }).first().click()
  } else {
    const cell = p.locator('.sr-navbar-cell', { hasText: 'Map Explorer' })
    if (await cell.count()) await cell.first().click()
    else {
      await p.locator('.sr-navbar-cell', { hasText: 'More' }).first().click()
      await p.waitForTimeout(350)
      await p.locator('.sr-nav-sheet .sr-nav-item', { hasText: 'Map Explorer' }).first().click()
    }
  }
  await p.waitForTimeout(1200)
}

for (const [eng, nm] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const b = await eng.launch()
  console.log(`\n===== ${nm} =====`)
  for (const [w, h, tag] of [[390, 844, 'phone'], [320, 700, 'phone-320'], [834, 1000, 'rail'], [1512, 900, 'sidebar']]) {
    const p = await b.newPage({ viewport: { width: w, height: h } })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-nav-col, .sr-navbar', { timeout: 15000 })
    await dismissWelcome(p)
    await openMap(p, w <= 640)
    const r = await p.evaluate(read)
    console.log(`\n-- ${tag} ${w}x${h} --`)
    console.log('  ' + JSON.stringify(r))
    if (r.panelFound && r.barTop !== null) {
      console.log(`  panel bottom ${r.panelBottom} vs bar top ${r.barTop}: ${r.panelUnderBar > 0.5 ? `UNDERLAP by ${r.panelUnderBar}px — DEFECT` : 'clear'}`)
    }
    if (r.footerBottom !== null && r.barTop !== null) {
      console.log(`  footer bottom ${r.footerBottom} vs bar top ${r.barTop}: ${r.footerUnderBar > 0.5 ? `UNDERLAP by ${r.footerUnderBar}px — DEFECT` : 'clear'}`)
    }
    if (r.panelFound && r.barTop === null) {
      console.log(`  panel ${r.panelH}px, footer bottom ${r.footerBottom}, viewport ${r.viewportH}: ${r.footerBottom <= r.viewportH + 0.5 ? 'footer visible without scroll' : 'footer below the fold'}`)
    }
    await p.close()
  }
  await b.close()
}
