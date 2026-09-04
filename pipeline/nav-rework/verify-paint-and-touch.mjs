// Two claims the first pass measured with the wrong instrument.
//  1. maps.md: a fixed z-1200 element LATER in the DOM than .sr-map-fullscreen-panel
//     PAINTS over it, and `inert` does not stop that. `inert` DOES suppress hit
//     testing, so elementFromPoint answers a different question -- this samples
//     the rendered PIXEL instead.
//  2. The rail's layer-3 touch hold, on a page whose DOM has not been hand-poked.
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')
const sharp = require('sharp')
const BASE = 'http://127.0.0.1:45817/'

const PANEL = '#00aa00', BAR = '#aa0000'
const px = async (p, x, y) => {
  const buf = await p.screenshot({ clip: { x, y, width: 1, height: 1 } })
  const { data } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  return `rgb(${data[0]},${data[1]},${data[2]})`
}
const tip = p => p.evaluate(() => {
  const t = document.querySelector('.sr-nav-tip')
  return t ? { on: t.classList.contains('sr-nav-tip--on'), text: (t.textContent||'').trim() } : null
})

for (const [eng, nm] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  const b = await eng.launch()
  console.log(`\n================ ${nm} ================`)

  // ---- 1. PAINT, sampled as pixels ----
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } })
    await p.setContent(`<!doctype html><meta charset=utf-8><style>
      html,body{margin:0}
      .panel{position:fixed;inset:0;z-index:1200;background:${PANEL}}
      .bar{position:fixed;left:0;right:0;bottom:0;height:56px;z-index:1200;background:${BAR}}
    </style><div class="panel"></div><div class="bar" id="bar"></div>`)
    await p.waitForTimeout(200)
    const plain = await px(p, 195, 820)
    await p.evaluate(() => document.getElementById('bar').setAttribute('inert', ''))
    await p.waitForTimeout(200)
    const inert = await px(p, 195, 820)
    const hitInert = await p.evaluate(() => document.elementFromPoint(195, 820)?.className)
    console.log(`paint  bar area, bar NOT inert : ${plain}  -> ${plain === 'rgb(170,0,0)' ? 'BAR paints over panel' : 'panel wins'}`)
    console.log(`paint  bar area, bar IS  inert : ${inert}  -> ${inert === 'rgb(170,0,0)' ? 'BAR STILL PAINTS (inert does not stop paint)' : 'panel wins'}`)
    console.log(`hit    elementFromPoint w/ inert: ${hitInert}  (inert DOES suppress hit testing -- a different question)`)
    await p.close()
  }

  // ---- 2. TOUCH HOLD on an untouched page ----
  {
    const p = await b.newPage({ viewport: { width: 834, height: 1000 }, hasTouch: true })
    await p.goto(BASE, { waitUntil: 'domcontentloaded' })
    await p.waitForSelector('.sr-nav-col--rail', { timeout: 15000 })
    if (await p.$('[aria-label="Welcome to SnowRaven"]')) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }
    console.log(`\ntouch  before pointerdown        : ${JSON.stringify(await tip(p))}`)
    await p.evaluate(() => document.querySelector('.sr-nav-item[aria-label="Breeding Codes"]')
      .dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, cancelable: true, pointerId: 1 })))
    await p.waitForTimeout(200)
    console.log(`touch  @200ms (before 350 timer) : ${JSON.stringify(await tip(p))}`)
    await p.waitForTimeout(350)
    console.log(`touch  @550ms (after 350 timer)  : ${JSON.stringify(await tip(p))}`)
    await p.evaluate(() => document.querySelector('.sr-nav-item[aria-label="Breeding Codes"]')
      .dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true, pointerId: 1 })))
    await p.waitForTimeout(250)
    console.log(`touch  after pointerup           : ${JSON.stringify(await tip(p))}`)

    // a hold that MOVES must not show it
    await p.evaluate(() => {
      const el = document.querySelector('.sr-nav-item[aria-label="Checklists"]')
      el.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true, cancelable: true, pointerId: 2 }))
      el.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'touch', bubbles: true, pointerId: 2 }))
    })
    await p.waitForTimeout(550)
    console.log(`touch  hold that MOVED           : ${JSON.stringify(await tip(p))}  (must stay null/off)`)

    // ---- 3. mouse-click focus must not leave a tooltip behind ----
    await p.evaluate(() => document.querySelector('.sr-nav-item[aria-label="Checklists"]')
      .dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch', bubbles: true, pointerId: 2 })))
    await p.waitForTimeout(250)
    await p.locator('.sr-nav-item[aria-label="Named Birds"]').first().click()
    await p.waitForTimeout(300)
    await p.mouse.move(700, 500)      // leave the rail so hover cannot be the cause
    await p.waitForTimeout(400)
    const afterClick = await tip(p)
    const fv = await p.evaluate(() => {
      const el = document.querySelector('.sr-nav-item[aria-label="Named Birds"]')
      return { focused: document.activeElement === el, focusVisible: el.matches(':focus-visible') }
    })
    console.log(`mouse  after click + pointer away: tooltip ${JSON.stringify(afterClick)}, ${JSON.stringify(fv)}`)
    await p.close()
  }
  await b.close()
}
