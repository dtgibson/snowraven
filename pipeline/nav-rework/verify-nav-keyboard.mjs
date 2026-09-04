// The keyboard path in a REAL engine, WebKit especially: does Tab reach every nav
// control (the whole point of the repo's literal tabIndex={0}), does the vertical
// tablist rove on Up/Down, and does the More sheet trap focus, close on Escape and
// return focus to the More button?
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')
const BASE = process.env.NAV_BASE || 'http://127.0.0.1:45817/'

async function dismissWelcome(p) {
  if (await p.$('[aria-label="Welcome to SnowRaven"]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }
}
const active = p => p.evaluate(() => {
  const a = document.activeElement
  if (!a || a === document.body) return '<body>'
  const cls = (a.className || '').toString().split(/\s+/)[0]
  const txt = (a.textContent || '').trim().slice(0, 22)
  return `${a.tagName.toLowerCase()}${cls ? '.' + cls : ''}${a.id ? '#' + a.id : ''}[${a.getAttribute('aria-label') || txt}]`
})

async function tabWalk(p, n = 30) {
  const seen = []
  for (let i = 0; i < n; i++) {
    await p.keyboard.press('Tab')
    const a = await active(p)
    seen.push(a)
    if (seen.filter(x => x === a).length > 2) break
  }
  return seen
}

for (const [eng, nm] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const b = await eng.launch()
  console.log(`\n================ ${nm} ================`)

  // ---- sidebar density: tab stops in the nav column, and roving ----
  {
    const p = await b.newPage({ viewport: { width: 1512, height: 900 } })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-nav-col', { timeout: 15000 })
    await dismissWelcome(p)
    await p.evaluate(() => document.body.focus())
    const walk = await tabWalk(p, 14)
    console.log('\n-- sidebar: first Tab stops from document start --')
    walk.slice(0, 8).forEach((s, i) => console.log(`   ${i + 1}. ${s}`))
    const navStops = walk.filter(s => s.includes('sr-nav-item') || s.includes('sr-nav-collapse'))
    console.log(`   nav-column tab stops: ${navStops.length} -> ${JSON.stringify(navStops)}`)

    // roving: focus the active tab, Down/Up/Home/End
    await p.evaluate(() => document.querySelector('.sr-nav-item[aria-selected="true"]').focus())
    const rove = [await active(p)]
    for (const k of ['ArrowDown', 'ArrowDown', 'ArrowUp', 'End', 'Home']) {
      await p.keyboard.press(k); await p.waitForTimeout(120); rove.push(`${k}->${await active(p)}`)
    }
    console.log('   roving:', rove.join('  '))
    // Left/Right must NOT move in a vertical tablist
    await p.evaluate(() => document.querySelector('.sr-nav-item[aria-selected="true"]').focus())
    const before = await active(p)
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(120)
    const afterR = await active(p)
    console.log(`   ArrowRight moved: ${before !== afterR} (spec: vertical list, must be false)`)
    // count total nav items and confirm exactly one is in the tab order
    const roving = await p.evaluate(() => {
      const items = [...document.querySelectorAll('.sr-nav-item')]
      return { total: items.length, zero: items.filter(i => i.getAttribute('tabindex') === '0').length }
    })
    console.log(`   .sr-nav-item total ${roving.total}, tabindex=0 count ${roving.zero} (roving: must be 1)`)
    await p.close()
  }

  // ---- phone density: every bar cell its own stop; the More sheet ----
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-navbar', { timeout: 15000 })
    await dismissWelcome(p)
    const cellTab = await p.evaluate(() =>
      [...document.querySelectorAll('.sr-navbar-cell')].map(c => c.getAttribute('tabindex')))
    console.log('\n-- phone: bar cell tabindex attributes --')
    console.log('   ' + JSON.stringify(cellTab) + '  (spec: all "0", not roving)')

    await p.evaluate(() => document.body.focus())
    const walk = await tabWalk(p, 24)
    const cells = walk.filter(s => s.includes('sr-navbar-cell'))
    console.log(`   bar cells reached by Tab: ${cells.length}/5 -> ${JSON.stringify(cells)}`)

    // open the More sheet from the keyboard
    await p.evaluate(() => {
      const c = [...document.querySelectorAll('.sr-navbar-cell')].find(x => /More/.test(x.textContent))
      c.focus()
    })
    const moreBtn = await active(p)
    await p.keyboard.press('Enter')
    await p.waitForTimeout(450)
    const sheetOpen = await p.evaluate(() => !!document.querySelector('.sr-nav-sheet-root--open, .sr-nav-sheet-root'))
    const focusInSheet = await p.evaluate(() => {
      const sheet = document.querySelector('.sr-nav-sheet-root')
      return sheet ? sheet.contains(document.activeElement) : null
    })
    console.log(`\n-- More sheet --`)
    console.log(`   opened with Enter: ${sheetOpen}; focus moved into sheet: ${focusInSheet}`)
    const rowTab = await p.evaluate(() =>
      [...document.querySelectorAll('.sr-nav-sheet-root .sr-nav-item')].map(r => r.getAttribute('tabindex')))
    console.log(`   sheet row tabindex: ${JSON.stringify(rowTab)}  (spec: all "0", plain trapped buttons)`)

    // focus trap: tab many times, focus must never leave the sheet
    let escaped = false
    for (let i = 0; i < 24; i++) {
      await p.keyboard.press('Tab')
      const inside = await p.evaluate(() => {
        const sheet = document.querySelector('.sr-nav-sheet-root')
        return sheet ? sheet.contains(document.activeElement) : false
      })
      if (!inside) { escaped = true; break }
    }
    console.log(`   focus trap holds over 24 Tabs: ${!escaped}`)
    // shift-tab too
    let escapedBack = false
    for (let i = 0; i < 12; i++) {
      await p.keyboard.press('Shift+Tab')
      const inside = await p.evaluate(() => {
        const sheet = document.querySelector('.sr-nav-sheet-root')
        return sheet ? sheet.contains(document.activeElement) : false
      })
      if (!inside) { escapedBack = true; break }
    }
    console.log(`   trap holds over 12 Shift+Tabs: ${!escapedBack}`)

    await p.keyboard.press('Escape')
    await p.waitForTimeout(400)
    const closed = await p.evaluate(() => !document.querySelector('.sr-nav-sheet-root'))
    const returned = await active(p)
    console.log(`   Escape closed the sheet: ${closed}`)
    console.log(`   focus returned to: ${returned}`)
    console.log(`   returned to the More button: ${returned === moreBtn}`)
    await p.close()
  }

  // ---- rail density: is every destination still reachable/labelled? ----
  {
    const p = await b.newPage({ viewport: { width: 834, height: 1000 } })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-nav-col--rail', { timeout: 15000 })
    await dismissWelcome(p)
    const labels = await p.evaluate(() =>
      [...document.querySelectorAll('.sr-nav-item')].map(i => i.getAttribute('aria-label') || '(none)'))
    console.log('\n-- rail: aria-label on every rail button (no visible text) --')
    console.log('   ' + JSON.stringify(labels))
    console.log(`   all labelled: ${labels.every(l => l && l !== '(none)')}`)
    const collapse = await p.evaluate(() => !!document.querySelector('.sr-nav-collapse'))
    console.log(`   collapse control present in DERIVED rail: ${collapse} (spec: false)`)
    await p.close()
  }
  await b.close()
}
