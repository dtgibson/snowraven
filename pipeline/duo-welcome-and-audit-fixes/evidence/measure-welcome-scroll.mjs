// At 200% text the centred column overflows the Welcome root. Is its top reachable by
// scrolling? Reads the logo and last button at scrollTop 0 and at the maximum scroll.
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
const [distDir, markupFile, toolsDir] = process.argv.slice(2)
const req = createRequire(join(toolsDir, 'package.json'))
const pw = req('playwright')
const cssFile = readFileSync(join(distDir, 'index.html'), 'utf8').match(/href="\/?(assets\/index-[^"]+\.css)"/)[1]
const cssText = readFileSync(join(distDir, cssFile), 'utf8')
const markupNew = readFileSync(markupFile, 'utf8')
const markupOld = markupNew.replace('class="sr-welcome-panel" style="', 'style="position:fixed;inset:0;z-index:1200;padding:32px 24px;')
const sub = (css, i) => css.replace(/env\(safe-area-inset-(top|right|bottom|left)(\s*,\s*0(px)?)?\)/g, (_, side) => `${i[side]}px`)
const TYPES = { '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml' }
const page = (markup, css) => `<!doctype html><html class="sr-ios-app" data-theme="light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>${css}</style><style>html{font-size:200%}</style></head><body>${markup}</body></html>`
const SCEN = [
  { name: 'iPhone 17 Pro upright', w: 402, h: 874, i: { top: 62, right: 0, bottom: 34, left: 0 } },
  { name: 'iPhone Duo outer', w: 466, h: 678, i: { top: 0, right: 84, bottom: 34, left: 0 } },
]
for (const engine of ['webkit', 'chromium']) {
  const browser = await pw[engine].launch()
  try {
    for (const sc of SCEN) {
      for (const [label, markup] of [['1.0.59 inline', markupOld], ['1.0.60', markupNew]]) {
        const ctx = await browser.newContext({ viewport: { width: sc.w, height: sc.h } })
        const p = await ctx.newPage()
        await p.route('http://welcome.test/**', async route => {
          const path = new URL(route.request().url()).pathname
          if (path === '/m.html') return route.fulfill({ contentType: 'text/html', body: page(markup, sub(cssText, sc.i)) })
          const f = join(distDir, path)
          if (existsSync(f)) return route.fulfill({ contentType: TYPES[extname(f)] || 'application/octet-stream', body: readFileSync(f) })
          return route.fulfill({ status: 404, body: '' })
        })
        await p.goto('http://welcome.test/m.html')
        await p.evaluate(() => document.fonts.ready)
        const v = await p.evaluate(() => {
          const root = document.querySelector('[role="dialog"]')
          const col = root.firstElementChild
          const btns = root.querySelectorAll('button')
          const read = () => ({ st: root.scrollTop, logoTop: Math.round(col.querySelector('svg').getBoundingClientRect().top), colTop: Math.round(col.getBoundingClientRect().top), lastBottom: Math.round(btns[btns.length - 1].getBoundingClientRect().bottom) })
          root.scrollTop = 0; const a = read()
          root.scrollTop = 1e6; const b = read()
          root.scrollTop = -1e6; const c = read()
          return { a, b, c, sh: root.scrollHeight, ch: root.clientHeight }
        })
        console.log(`${engine.padEnd(8)} ${sc.name.padEnd(22)} ${label.padEnd(14)} scroll ${v.sh}/${v.ch} | at top: logo ${v.a.logoTop} col ${v.a.colTop} | at max (scrollTop ${v.b.st}): logo ${v.b.logoTop} last button bottom ${v.b.lastBottom} | scrollTop after -1e6: ${v.c.st}`)
        await ctx.close()
      }
    }
  } finally { await browser.close() }
}
