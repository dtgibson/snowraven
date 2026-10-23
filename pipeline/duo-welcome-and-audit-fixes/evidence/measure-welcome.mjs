// Measure the Welcome screen in WebKit (Playwright) with the built stylesheet, the
// insets substituted for env() (desktop WebKit reports 0 for every inset), against
// the 1.0.59 inline-style replica. Evidence for the top-inset decision only.
import { createRequire } from 'node:module'
import { readFileSync, existsSync } from 'node:fs'
import { join, extname } from 'node:path'
const [distDir, markupFile, toolsDir] = process.argv.slice(2)
const req = createRequire(join(toolsDir, 'package.json'))
const { webkit } = req('playwright')
const cssFile = readFileSync(join(distDir, 'index.html'), 'utf8').match(/href="\/?(assets\/index-[^"]+\.css)"/)[1]
const cssText = readFileSync(join(distDir, cssFile), 'utf8')
const markupNew = readFileSync(markupFile, 'utf8')
const markupOld = markupNew.replace('class="sr-welcome-panel" style="', 'style="position:fixed;inset:0;z-index:1200;padding:32px 24px;')
if (markupOld === markupNew) throw new Error('old replica not produced')
const welcomeRule = /\.sr-ios-app \.sr-welcome-panel\{[^}]*\}/
if (!welcomeRule.test(cssText)) throw new Error('gated welcome rule not found in the built CSS')
const sub = (css, i) => css.replace(/env\(safe-area-inset-(top|right|bottom|left)(\s*,\s*0(px)?)?\)/g, (_, side) => `${i[side]}px`)
const noTop = (css) => css.replace(welcomeRule, m => m.replace(/padding-top:[^;}]*;?/, ''))
const TYPES = { '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png' }
const page = (markup, css, scale) => `<!doctype html><html class="sr-ios-app" data-theme="light"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><style>${css}</style>
${scale !== 100 ? `<style>html{font-size:${scale}%}</style>` : ''}</head><body>${markup}</body></html>`
const SCEN = [
  { name: 'iPhone 17 Pro upright', w: 402, h: 874, i: { top: 62, right: 0, bottom: 34, left: 0 } },
  { name: 'iPhone Duo outer', w: 466, h: 678, i: { top: 0, right: 84, bottom: 34, left: 0 } },
  { name: 'all insets zero, phone', w: 402, h: 874, i: { top: 0, right: 0, bottom: 0, left: 0 } },
  { name: 'all insets zero, desktop', w: 1280, h: 800, i: { top: 0, right: 0, bottom: 0, left: 0 } },
]
const browser = await webkit.launch()
try {
  for (const sc of SCEN) {
    for (const scale of [100, 200]) {
      const rows = {}
      for (const [label, markup, css] of [
        ['1.0.59 inline', markupOld, sub(cssText, sc.i)],
        ['1.0.60 (top padded)', markupNew, sub(cssText, sc.i)],
        ['1.0.60 without top', markupNew, sub(noTop(cssText), sc.i)],
      ]) {
        const ctx = await browser.newContext({ viewport: { width: sc.w, height: sc.h }, deviceScaleFactor: 1 })
        const p = await ctx.newPage()
        await p.route('http://welcome.test/**', async route => {
          const path = new URL(route.request().url()).pathname
          if (path === '/m.html') return route.fulfill({ contentType: 'text/html', body: page(markup, css, scale) })
          const f = join(distDir, path)
          if (existsSync(f)) return route.fulfill({ contentType: TYPES[extname(f)] || 'application/octet-stream', body: readFileSync(f) })
          return route.fulfill({ status: 404, body: '' })
        })
        await p.goto('http://welcome.test/m.html')
        await p.evaluate(() => document.fonts.ready)
        rows[label] = await p.evaluate(() => {
          const root = document.querySelector('[role="dialog"]')
          root.scrollTop = 0
          const cs = getComputedStyle(root)
          const r = el => { const b = el.getBoundingClientRect(); return [b.left, b.top, b.right, b.bottom].map(v => Math.round(v * 10) / 10) }
          const col = root.firstElementChild
          const card = col.children[3]
          const btns = root.querySelectorAll('button')
          return {
            pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '),
            column: r(col), card: r(card), logo: r(col.querySelector('svg')),
            lastButton: r(btns[btns.length - 1]),
            scroll: `${root.scrollHeight}/${root.clientHeight}`,
          }
        })
        await ctx.close()
      }
      console.log(`\n## ${sc.name} ${sc.w}x${sc.h}, insets t/r/b/l ${sc.i.top}/${sc.i.right}/${sc.i.bottom}/${sc.i.left}, text ${scale}%`)
      for (const [k, v] of Object.entries(rows)) console.log(`${k.padEnd(22)} pad ${v.pad} | column x ${v.column[0]}..${v.column[2]} y ${v.column[1]}..${v.column[3]} | card x ${v.card[0]}..${v.card[2]} | logo top ${v.logo[1]} | last button bottom ${v.lastButton[3]} | scroll ${v.scroll}`)
    }
  }
} finally { await browser.close() }
