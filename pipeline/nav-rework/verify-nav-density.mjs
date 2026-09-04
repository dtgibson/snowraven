// Real-engine verification of the DENSITY thresholds (the worked table in
// design-refinement.md), the hysteresis, and the map-panel chrome underlap.
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')
const BASE = process.env.NAV_BASE || 'http://127.0.0.1:45817/'

async function dismissWelcome(p) {
  const dlg = await p.$('[aria-label="Welcome to SnowRaven"]')
  if (dlg) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }
}

const density = () => {
  const col = document.querySelector('.sr-nav-col')
  const bar = document.querySelector('.sr-navbar')
  if (bar) return 'phone'
  if (!col) return 'none'
  return col.classList.contains('sr-nav-col--rail') ? 'rail' : 'sidebar'
}

const snapshot = () => {
  const col = document.querySelector('.sr-nav-col')
  const main = document.querySelector('main')
  const de = document.documentElement
  return {
    density: (() => {
      const bar = document.querySelector('.sr-navbar')
      if (bar) return 'phone'
      if (!col) return 'none'
      return col.classList.contains('sr-nav-col--rail') ? 'rail' : 'sidebar'
    })(),
    navW: col ? +col.getBoundingClientRect().width.toFixed(1) : 0,
    mainW: main ? +main.getBoundingClientRect().width.toFixed(1) : 0,
    rootFont: getComputedStyle(de).fontSize,
    hScroll: de.scrollWidth > de.clientWidth,
    scrollW: de.scrollWidth, clientW: de.clientWidth,
  }
}

async function goTab(p, label) {
  const sel = `.sr-nav-item[aria-label="${label}"], .sr-nav-item:has-text("${label}")`
  const btn = await p.$(`.sr-nav-item[aria-label="${label}"]`)
  if (btn) { await btn.click(); return true }
  const byText = p.locator('.sr-nav-item', { hasText: label }).first()
  if (await byText.count()) { await byText.click(); return true }
  return false
}

async function run(engine, name) {
  const b = await engine.launch()
  const out = { name, table: [], hysteresis: [], chrome: null }

  // --- the worked threshold table -----------------------------------------
  for (const [w, tab, expect] of [
    [1512, null, 'sidebar'], [1512, 'Map Explorer', 'sidebar'],
    [1024, null, 'sidebar'], [1024, 'Map Explorer', 'rail'],
    [ 834, null, 'rail'],    [ 720, null, 'rail'],
    [ 641, null, 'rail'],    [ 640, null, 'phone'],
    [ 856, null, 'sidebar'], [ 855, null, 'rail'],
  ]) {
    const p = await b.newPage({ viewport: { width: w, height: 900 } })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-nav-col, .sr-navbar', { timeout: 15000 })
      await dismissWelcome(p)
    await p.waitForTimeout(350)
    if (tab) { await goTab(p, tab); await p.waitForTimeout(500) }
    const s = await p.evaluate(snapshot)
    out.table.push({ w, tab: tab || '—', expect, got: s.density, navW: s.navW, mainW: s.mainW, hScroll: s.hScroll })
    await p.close()
  }

  // --- hysteresis: collapse at <640 content, restore only at >=688 --------
  {
    const p = await b.newPage({ viewport: { width: 1200, height: 900 } })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-nav-col', { timeout: 15000 })
      await dismissWelcome(p)
    await p.waitForTimeout(300)
    for (const w of [1200, 900, 860, 856, 855, 850, 880, 900, 903, 904, 905, 1200]) {
      await p.setViewportSize({ width: w, height: 900 })
      await p.waitForTimeout(220)
      out.hysteresis.push({ w, d: await p.evaluate(density) })
    }
    await p.close()
  }

  // --- phone: is the map panel / footer underlapped by the fixed bar? ------
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-navbar', { timeout: 15000 })
      await dismissWelcome(p)
    await p.waitForTimeout(400)
    // reach Map Explorer through the More sheet if it is not a favourite
    const cell = p.locator('.sr-navbar-cell', { hasText: 'Map Explorer' })
    if (await cell.count()) await cell.first().click()
    else {
      await p.locator('.sr-navbar-cell', { hasText: 'More' }).first().click()
      await p.waitForTimeout(350)
      await p.locator('.sr-nav-sheet .sr-nav-item', { hasText: 'Map Explorer' }).first().click()
    }
    await p.waitForTimeout(900)
    out.chrome = await p.evaluate(() => {
      const bar = document.querySelector('.sr-navbar')
      const footer = document.querySelector('footer')
      const main = document.querySelector('main')
      const panel = document.querySelector('.sr-map-panel, .sr-map-container, [class*="map-panel"]')
      const barTop = bar ? bar.getBoundingClientRect().top : null
      const de = document.documentElement
      return {
        barTop: barTop === null ? null : +barTop.toFixed(1),
        barH: bar ? +bar.getBoundingClientRect().height.toFixed(1) : null,
        navbarHVar: getComputedStyle(de).getPropertyValue('--sr-navbar-h').trim(),
        shellPadBottom: getComputedStyle(document.querySelector('.sr-shell')).paddingBottom,
        mapChromeVar: main ? getComputedStyle(main).getPropertyValue('--sr-map-chrome').trim() : null,
        footerBottom: footer ? +footer.getBoundingClientRect().bottom.toFixed(1) : null,
        mainBottom: main ? +main.getBoundingClientRect().bottom.toFixed(1) : null,
        panelClass: panel ? panel.className : null,
        panelBottom: panel ? +panel.getBoundingClientRect().bottom.toFixed(1) : null,
        docScrollH: de.scrollHeight, viewportH: window.innerHeight,
      }
    })
    await p.close()
  }

  await b.close()
  return out
}

for (const [eng, nm] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const r = await run(eng, nm)
  console.log(`\n===== ${r.name} =====`)
  console.log('-- worked threshold table --')
  console.log('  width  tab            expect   got      navW   mainW   hScroll')
  for (const t of r.table) {
    const ok = t.expect === t.got ? ' ' : '  <-- MISMATCH'
    console.log(`  ${String(t.w).padEnd(6)} ${t.tab.padEnd(14)} ${t.expect.padEnd(8)} ${t.got.padEnd(8)} ${String(t.navW).padEnd(6)} ${String(t.mainW).padEnd(7)} ${String(t.hScroll).padEnd(6)}${ok}`)
  }
  console.log('-- hysteresis sweep (expect: leave sidebar <856, return only >=904) --')
  console.log('  ' + r.hysteresis.map(h => `${h.w}:${h.d}`).join('  '))
  console.log('-- phone map chrome (underlap check) --')
  console.log('  ' + JSON.stringify(r.chrome, null, 1).replace(/\n/g, '\n  '))
}
