// QA attempt 1 re-verify. The rail's identification now rests on THREE layers
// (design-refinement.md, corrected). Each is measured here, plus the active
// treatment that carries "where you are", plus the maps.md z-index/inert finding.
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')
const BASE = 'http://127.0.0.1:45817/'
const tipState = p => p.evaluate(() => {
  const t = document.querySelector('.sr-nav-tip')
  return t ? { shown: t.classList.contains('sr-nav-tip--on'), text: (t.textContent||'').trim(),
               ariaHidden: t.getAttribute('aria-hidden') } : { shown: false, text: null }
})
async function dismiss(p) {
  if (await p.$('[aria-label="Welcome to SnowRaven"]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }
}

for (const [eng, nm] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const b = await eng.launch()
  console.log(`\n================ ${nm} ================`)

  // ---------- layers 1-3 at rail density ----------
  {
    const p = await b.newPage({ viewport: { width: 834, height: 1000 }, hasTouch: true })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-nav-col--rail', { timeout: 15000 })
    await dismiss(p)

    // LAYER 1 - aria-label on every button
    const labels = await p.evaluate(() => [...document.querySelectorAll('.sr-nav-item')].map(i => i.getAttribute('aria-label')))
    console.log(`layer 1  aria-label on all ${labels.length}: ${labels.every(Boolean)}  (no nulls)`)

    // LAYER 2a - tooltip on HOVER
    await p.locator('.sr-nav-item[aria-label="Checklists"]').first().hover()
    await p.waitForTimeout(400)
    console.log('layer 2  hover           :', JSON.stringify(await tipState(p)))
    await p.mouse.move(600, 500); await p.waitForTimeout(300)

    // LAYER 2b - :focus-visible via KEYBOARD (the layer the spec now leans on)
    await p.evaluate(() => document.querySelector('.sr-nav-item[aria-selected="true"]').focus())
    await p.keyboard.press('ArrowDown'); await p.waitForTimeout(400)
    console.log('layer 2  keyboard focus  :', JSON.stringify(await tipState(p)))

    // and the discrimination: a MOUSE-focused button must NOT show it
    await p.mouse.move(600, 500); await p.waitForTimeout(250)
    const mouseFocus = await p.evaluate(async () => {
      const el = document.querySelector('.sr-nav-item[aria-label="Named Birds"]')
      el.focus()   // programmatic focus, not keyboard -> :focus-visible should be false
      return el.matches(':focus-visible')
    })
    await p.waitForTimeout(350)
    console.log(`layer 2  programmatic focus: matches(:focus-visible)=${mouseFocus}, tooltip=${JSON.stringify(await tipState(p))}`)

    // LAYER 3 - touch hold, 350ms
    await p.evaluate(() => { const t = document.querySelector('.sr-nav-tip'); if (t) t.classList.remove('sr-nav-tip--on') })
    await p.evaluate(() => {
      const el = document.querySelector('.sr-nav-item[aria-label="Breeding Codes"]')
      el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, cancelable: true, pointerId: 1 }))
    })
    await p.waitForTimeout(200)
    const midHold = await tipState(p)
    await p.waitForTimeout(300)
    const afterHold = await tipState(p)
    console.log(`layer 3  touch hold @200ms: ${JSON.stringify(midHold)}`)
    console.log(`layer 3  touch hold @500ms: ${JSON.stringify(afterHold)}`)
    await p.evaluate(() => {
      const el = document.querySelector('.sr-nav-item[aria-label="Breeding Codes"]')
      el.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true, pointerId: 1 }))
    })
    await p.waitForTimeout(300)
    console.log(`layer 3  after pointerup : ${JSON.stringify(await tipState(p))}`)

    // ACTIVE TREATMENT - "marked in green with a bar on its leading edge"
    const activeLook = await p.evaluate(() => {
      const a = document.querySelector('.sr-nav-item--active')
      if (!a) return null
      const cs = getComputedStyle(a), bar = getComputedStyle(a, '::before')
      return { bg: cs.backgroundColor, color: cs.color,
               barContent: bar.content, barW: bar.width, barBg: bar.backgroundColor }
    })
    console.log('active   :', JSON.stringify(activeLook))
    await p.close()
  }

  // ---------- maps.md: fixed z-1200 later in DOM paints over; inert does not stop it ----------
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } })
    await p.setContent(`<!doctype html><meta charset=utf-8><style>
      .panel{position:fixed;inset:0;z-index:1200;background:#0a0}
      .bar{position:fixed;left:0;right:0;bottom:0;height:56px;z-index:1200;background:#a00}
    </style><div class="panel"></div><div class="bar" id="bar"></div>`)
    const over = await p.evaluate(() => document.elementFromPoint(195, 820)?.className)
    await p.evaluate(() => document.getElementById('bar').setAttribute('inert', ''))
    const overInert = await p.evaluate(() => document.elementFromPoint(195, 820)?.className)
    console.log(`\nmaps.md  later fixed z1200 at same index paints on top: ${over === 'bar'} (hit: ${over})`)
    console.log(`maps.md  still paints on top when inert:                 ${overInert === 'bar'} (hit: ${overInert})`)
    await p.close()
  }

  // ---------- shipped behaviour: bar absent while the map is fullscreen ----------
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-navbar', { timeout: 15000 })
    await dismiss(p)
    const cell = p.locator('.sr-navbar-cell', { hasText: 'Map Explorer' })
    if (await cell.count()) await cell.first().click()
    else {
      await p.locator('.sr-navbar-cell', { hasText: 'More' }).first().click(); await p.waitForTimeout(350)
      await p.locator('.sr-nav-sheet .sr-nav-item', { hasText: 'Map Explorer' }).first().click()
    }
    await p.waitForTimeout(1200)
    const before = await p.evaluate(() => !!document.querySelector('.sr-navbar'))
    const fsBtn = p.locator('.sr-map-fullscreen-btn').first()
    let entered = false
    if (await fsBtn.count()) { await fsBtn.click(); await p.waitForTimeout(900); entered = true }
    const after = await p.evaluate(() => ({
      bar: !!document.querySelector('.sr-navbar'),
      panel: !!document.querySelector('.sr-map-fullscreen-panel'),
    }))
    console.log(`shipped  bar present before fullscreen: ${before}; entered fullscreen: ${entered}`)
    console.log(`shipped  during fullscreen -> panel ${after.panel}, bar ${after.bar} (spec: bar must be false)`)
    await p.close()
  }
  await b.close()
}
