// Real-engine verification of the nav rework's LAYOUT claims, which jsdom cannot
// see. Measures the phone bottom bar (label fit, container-query drop, cell and
// bar heights, page horizontal scroll) in Chromium AND WebKit, at 320/390/430px
// against in-app text scales 1x / 150% / 200%.
// Serves frontend/dist on loopback; no browser window, no tailscale.
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')

const BASE = process.env.NAV_BASE || 'http://127.0.0.1:45817/'

async function dismissWelcome(p) {
  const dlg = await p.$('[aria-label="Welcome to SnowRaven"]')
  if (dlg) { await p.keyboard.press('Escape'); await p.waitForTimeout(300) }
}
const WIDTHS = [320, 390, 430]
const SCALES = [1, 1.5, 2]

const probe = () => {
  const bar = document.querySelector('.sr-navbar')
  if (!bar) return { error: 'no bar' }
  const cells = [...document.querySelectorAll('.sr-navbar-cell')]
  const cs = getComputedStyle(document.documentElement)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  const cellData = cells.map(c => {
    const label = c.querySelector('.sr-navbar-label')
    const cr = c.getBoundingClientRect()
    let lab = null
    if (label) {
      const ls = getComputedStyle(label)
      const shown = ls.display !== 'none'
      let ink = null, box = null, lines = null, clippedX = null, clippedY = null
      if (shown) {
        box = label.clientWidth
        ctx.font = `${ls.fontStyle} ${ls.fontWeight} ${ls.fontSize} / ${ls.lineHeight} ${ls.fontFamily}`
        const words = (label.textContent || '').trim().split(/\s+/)
        ink = Math.max(...words.map(w => ctx.measureText(w).width))
        const lh = parseFloat(ls.lineHeight) || parseFloat(ls.fontSize) * 1.15
        lines = Math.round(label.getBoundingClientRect().height / lh)
        clippedX = label.scrollWidth > label.clientWidth + 0.5
        clippedY = label.scrollHeight > label.clientHeight + 0.5
      }
      lab = { text: label.textContent, shown, ink: ink === null ? null : +ink.toFixed(1),
              box, lines, clippedX, clippedY }
    }
    return { h: +cr.height.toFixed(1), w: +cr.width.toFixed(1), label: lab }
  })

  const de = document.documentElement
  return {
    rootFontPx: cs.fontSize,
    textScaleVar: cs.getPropertyValue('--sr-text-scale').trim(),
    barH: +bar.getBoundingClientRect().height.toFixed(1),
    barW: +bar.getBoundingClientRect().width.toFixed(1),
    navbarHVar: cs.getPropertyValue('--sr-navbar-h').trim(),
    labelsShown: cellData.every(c => c.label && c.label.shown),
    labelsHidden: cellData.every(c => c.label && !c.label.shown),
    minCellH: Math.min(...cellData.map(c => c.h)),
    pageScrollW: de.scrollWidth,
    pageClientW: de.clientWidth,
    hScroll: de.scrollWidth > de.clientWidth,
    cells: cellData,
  }
}

async function measure(engine, name) {
  const b = await engine.launch()
  const rows = []
  for (const width of WIDTHS) {
    for (const scale of SCALES) {
      const p = await b.newPage({ viewport: { width, height: 844 }, deviceScaleFactor: 2 })
      await p.addInitScript(s => {
        try { localStorage.setItem('sr-text-scale', String(s)) } catch {}
      }, scale)
      await p.goto(BASE, { waitUntil: 'domcontentloaded' })
      await p.waitForSelector('.sr-navbar', { timeout: 15000 })
      await dismissWelcome(p)
      await p.waitForTimeout(500)
      rows.push({ engine: name, width, scale, ...(await p.evaluate(probe)) })
      await p.close()
    }
  }
  await b.close()
  return rows
}

const all = []
for (const [eng, nm] of [[chromium, 'Chromium'], [webkit, 'WebKit']]) {
  all.push(...await measure(eng, nm))
}

console.log('\n== BOTTOM BAR: labels, heights, overflow ==')
console.log('engine    w   scale  root   labels   barH  minCellH  hScroll  worstInk/Box  clipX clipY')
for (const r of all) {
  const shown = r.labelsShown ? 'on ' : r.labelsHidden ? 'OFF' : 'MIXED'
  const lab = r.cells.filter(c => c.label && c.label.shown)
  const worst = lab.length
    ? lab.reduce((a, c) => (c.label.ink - c.label.box > a.label.ink - a.label.box ? c : a))
    : null
  const worstStr = worst ? `${worst.label.text} ${worst.label.ink}/${worst.label.box}` : '—'
  const clipX = lab.some(c => c.label.clippedX) ? 'YES' : 'no'
  const clipY = lab.some(c => c.label.clippedY) ? 'YES' : 'no'
  console.log(
    `${r.engine.padEnd(9)} ${String(r.width).padEnd(4)} ${String(r.scale).padEnd(6)} ${String(r.rootFontPx).padEnd(6)} ${shown.padEnd(8)} ${String(r.barH).padEnd(5)} ${String(r.minCellH).padEnd(9)} ${String(r.hScroll).padEnd(8)} ${worstStr.padEnd(22)} ${clipX.padEnd(5)} ${clipY}`,
  )
}

console.log('\n== PER-CELL INK vs BOX (labels-on rows only) ==')
for (const r of all.filter(x => x.labelsShown)) {
  console.log(`-- ${r.engine} ${r.width}px @ ${r.scale}x  (bar ${r.barH}px, --sr-navbar-h ${r.navbarHVar})`)
  for (const c of r.cells) {
    const l = c.label
    console.log(`     ${String(l.text).padEnd(16)} ink ${String(l.ink).padStart(6)}  box ${String(l.box).padStart(4)}  lines ${l.lines}  ${l.ink > l.box ? 'WRAPS/BREAKS' : 'fits'}${l.clippedX ? '  CLIPPED-X' : ''}${l.clippedY ? '  CLIPPED-Y' : ''}`)
  }
}

console.log('\n== VERDICTS ==')
const anyClipX = all.some(r => r.cells.some(c => c.label?.shown && c.label.clippedX))
const anyClipY = all.some(r => r.cells.some(c => c.label?.shown && c.label.clippedY))
const anyH = all.some(r => r.hScroll)
const minCell = Math.min(...all.map(r => r.minCellH))
console.log(`horizontal page scroll anywhere: ${anyH ? 'YES — DEFECT' : 'no'}`)
console.log(`label clipped horizontally:      ${anyClipX ? 'YES — DEFECT' : 'no'}`)
console.log(`label clipped vertically (>2ln): ${anyClipY ? 'YES — DEFECT' : 'no'}`)
console.log(`minimum cell height observed:    ${minCell}px  (spec floor 52px) ${minCell >= 52 ? 'OK' : 'BELOW FLOOR'}`)
