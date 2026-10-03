// Minimal reproduction of why no CSS property can make the Targets table show a
// whole focused control (targets-focus-scroll-room, decisions.md).
//
// One 400px sideways scroller, one button placed so that `visible` px of it
// show at the scroller's right edge, focus moved onto it by a real Tab press.
// It records whether the engine scrolled, and how far the button's focus ring
// (3px outline at a 3px offset, the app's global ring) still sits past the edge.
// Each case runs bare, with `scroll-padding-inline-end` on the scroller (19px,
// the brief's derived value, and 60px), and with `scroll-margin-inline-end:
// 19px` on the button.
//
// RUN:  node pipeline/targets-focus-scroll-room/reveal-threshold-repro.mjs
// (resolves Playwright from website/tools; `npm ci --prefix website/tools` and
// `npx playwright install chromium webkit` there first if it is missing)
//
// WHAT IT SHOWED (2026-10-03, the Playwright builds in website/tools):
//   Chromium: a button with ANY part inside the scroller's snapport (its visible
//     box less scroll-padding) is not scrolled at all, even 10px of a 100px one
//     (ring 96px past the edge). Only a fully hidden button is scrolled, to the
//     centre. scroll-margin changes nothing for a partly visible button.
//   WebKit: a button with 32px or more inside the snapport is not scrolled at
//     all (33px of 100px: ring 73px past the edge). Under 32px it scrolls the
//     button's end flush with the edge, leaving the ring 6px past it;
//     scroll-margin or scroll-padding moves that alignment inward.
//   scroll-padding only moves where the snapport ends, so it reaches a button
//   whose visible part is under the padding (Chromium) or under 32px plus the
//   padding (WebKit). A wider visible part is left exactly where it was.

import { requirePlaywright } from '../../website/tools/verify/playwright.mjs'

const { chromium, webkit } = requirePlaywright()

const html = (css, visible, w) => `<!doctype html><html><head><style>
body{margin:0;font:16px system-ui}
#s{width:400px;overflow-x:auto;white-space:nowrap}
#s .row{width:2000px;position:relative;height:60px}
#s button{position:absolute;top:10px;height:30px;width:${w}px;padding:0;border:0;background:#ddd}
button:focus-visible{outline:3px solid green;outline-offset:3px}
${css}
</style></head><body><button id="pre">pre</button><div id="s"><div class="row"><button id="t" tabindex="0" style="left:${400 - visible}px">target</button></div></div></body></html>`

const VARIANTS = [
  ['none', ''],
  ['scroll-padding-inline-end: 19px', '#s{scroll-padding-inline-end:19px}'],
  ['scroll-padding-inline-end: 60px', '#s{scroll-padding-inline-end:60px}'],
  ['scroll-margin-inline-end: 19px', '#t{scroll-margin-inline-end:19px}'],
]

for (const [name, type] of [['chromium', chromium], ['webkit', webkit]]) {
  const browser = await type.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 800, height: 300 } })
    for (const w of [100, 30]) {
      for (const visible of [0, 10, 20, 31, 33, 40, 70, 95]) {
        if (visible > w) continue
        for (const [label, css] of VARIANTS) {
          await page.setContent(html(css, visible, w))
          await page.focus('#pre')
          await page.keyboard.press('Tab')
          const r = await page.evaluate(() => {
            const s = document.getElementById('s')
            const t = document.getElementById('t')
            const sr = s.getBoundingClientRect()
            const tr = t.getBoundingClientRect()
            return { focused: document.activeElement === t, scrollLeft: s.scrollLeft, ringPastEnd: +(tr.right + 6 - (sr.left + s.clientWidth)).toFixed(1) }
          })
          if (!r.focused) throw new Error('Tab did not reach the target')
          console.log(`${name.padEnd(8)} button ${String(w).padStart(3)}px, ${String(visible).padStart(3)}px showing, ${label.padEnd(32)} scrolled ${String(r.scrollLeft).padStart(4)}px, ring past edge ${r.ringPastEnd}px`)
        }
      }
    }
  } finally {
    await browser.close()
  }
}
