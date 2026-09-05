// Real-engine verification of the command-palette MOCKUP's layout and contrast
// claims, which no static read can make. Opens pipeline/command-palette/design.html
// in Chromium and WebKit, drives the mockup's own controls, and measures:
//   * horizontal overflow inside the stage at 320px against 100% / 200% text scale
//   * the query field and at least one result row visible in the same viewport
//   * WCAG contrast of every text pair inside the palette, in BOTH themes
//   * the tab-stop population inside the open overlay
// Writes screenshots beside this file for eyeball review.
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { chromium, webkit } = require('playwright')

const HERE = path.dirname(fileURLToPath(import.meta.url))
const URL_ = 'file://' + path.join(HERE, 'design.html')

let failures = 0
const fail = (m) => { failures++; console.log('  FAIL  ' + m) }
const pass = (m) => console.log('  ok    ' + m)

async function setControl(page, attr, value) {
  await page.click(`[${attr}="${value}"]`)
  await page.waitForTimeout(60)
}

const CONTRAST = `(() => {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const parse = s => { const m = s.match(/[\\d.]+/g); return m ? m.slice(0, 3).map(Number) : null }
  const alpha = s => { const m = s.match(/[\\d.]+/g); return m && m.length > 3 ? Number(m[3]) : 1 }
  function bgOf(el) {
    let n = el
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n)
      if (alpha(s.backgroundColor) > 0.95) return parse(s.backgroundColor)
      n = n.parentElement
    }
    return [255, 255, 255]
  }
  const out = []
  const root = document.querySelector('#stage .sr-palette-panel')
  if (!root) return out
  const sel = '.sr-palette-input, .sr-palette-group, .sr-palette-row-name, .sr-palette-row-sci,' +
              '.sr-palette-note, .sr-palette-status-line, .sr-palette-foot, .sr-palette-kbd'
  root.querySelectorAll(sel).forEach(el => {
    const text = (el.textContent || '').trim()
    if (!text) return
    const s = getComputedStyle(el)
    const fg = parse(s.color), bg = bgOf(el)
    if (!fg) return
    const L1 = lum(fg), L2 = lum(bg)
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)
    const px = parseFloat(s.fontSize)
    const bold = parseInt(s.fontWeight, 10) >= 700
    const large = px >= 24 || (bold && px >= 18.66)
    out.push({
      cls: el.className.split(' ')[0],
      sample: text.slice(0, 34),
      ratio: Math.round(ratio * 100) / 100,
      need: large ? 3 : 4.5,
      px: Math.round(px * 10) / 10
    })
  })
  return out
})()`

async function run(name, browserType) {
  console.log('\\n=== ' + name + ' ===')
  const browser = await browserType.launch()
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
  await page.goto(URL_)
  await page.waitForTimeout(250)

  // ---- contrast, both themes, with all four species states exercised --------
  for (const theme of ['light', 'dark']) {
    await setControl(page, 'data-theme', theme)
    for (const st of ['loaded', 'loading', 'nofile', 'unloadable']) {
      await setControl(page, 'data-sp', st)
      await page.fill('#pal-input', st === 'loaded' ? 'cal' : 'cal').catch(() => {})
      await page.waitForTimeout(60)
      const rows = await page.evaluate(CONTRAST)
      const bad = rows.filter(r => r.ratio < r.need)
      if (bad.length) {
        bad.forEach(b => fail(`${theme}/${st} contrast ${b.ratio}:1 < ${b.need} on .${b.cls} (${b.px}px) "${b.sample}"`))
      } else {
        pass(`${theme}/${st} contrast: ${rows.length} text pairs all >= their AA floor (min ${Math.min(...rows.map(r => r.ratio))}:1)`)
      }
    }
  }

  // ---- 320px against 100% and 200% text scale, both themes -----------------
  await setControl(page, 'data-sp', 'loaded')
  for (const theme of ['light', 'dark']) {
    await setControl(page, 'data-theme', theme)
    for (const scale of ['16', '32']) {
      await setControl(page, 'data-w', '320')
      await setControl(page, 'data-scale', scale)
      await page.fill('#pal-input', 'cal')
      await page.waitForTimeout(120)
      const m = await page.evaluate(() => {
        const stage = document.querySelector('#stage .sr-stage')
        const panel = document.querySelector('#stage .sr-palette-panel')
        const input = document.querySelector('#pal-input')
        const row = document.querySelector('#stage .sr-palette-row')
        const sr = stage.getBoundingClientRect()
        const inR = input.getBoundingClientRect()
        const rowR = row ? row.getBoundingClientRect() : null
        return {
          overflow: stage.scrollWidth - stage.clientWidth,
          panelW: Math.round(panel.getBoundingClientRect().width),
          stageW: Math.round(sr.width),
          fullHeight: Math.abs(panel.getBoundingClientRect().height - sr.height) < 2,
          inputVisible: inR.top >= sr.top - 1 && inR.bottom <= sr.bottom + 1,
          firstRowVisible: !!rowR && rowR.top >= sr.top - 1 && rowR.bottom <= sr.bottom + 1,
          rowH: rowR ? Math.round(rowR.height) : 0
        }
      })
      const tag = `${theme} 320px @ ${scale === '32' ? '200%' : '100%'}`
      if (m.overflow > 0) fail(`${tag}: ${m.overflow}px horizontal overflow inside the stage`)
      else pass(`${tag}: no horizontal overflow`)
      if (!m.fullHeight) fail(`${tag}: panel is not a full-height sheet (panel vs stage height differ)`)
      else pass(`${tag}: full-height sheet, panel ${m.panelW}px of ${m.stageW}px`)
      if (!m.inputVisible) fail(`${tag}: query field not fully visible`)
      if (!m.firstRowVisible) fail(`${tag}: no result row visible beneath the field`)
      if (m.inputVisible && m.firstRowVisible) pass(`${tag}: field + first row visible, row height ${m.rowH}px`)
    }
  }

  // ---- tab-stop population inside the open overlay -------------------------
  await setControl(page, 'data-scale', '16')
  await setControl(page, 'data-w', '1440')
  await setControl(page, 'data-theme', 'light')
  await page.waitForTimeout(100)
  const stops = await page.evaluate(() => {
    const panel = document.querySelector('#stage .sr-palette-panel')
    const all = panel.querySelectorAll('a[href], button, input, select, textarea, [tabindex]')
    return Array.from(all)
      .filter(el => !el.disabled && el.getAttribute('tabindex') !== '-1')
      .map(el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') +
                 ' tabindex=' + (el.getAttribute('tabindex') ?? '(none)'))
  })
  if (stops.length === 2 && stops.every(s => s.includes('tabindex=0'))) {
    pass('exactly two tab stops inside the overlay, both explicit: ' + stops.join(' , '))
  } else {
    fail('tab-stop population is ' + JSON.stringify(stops))
  }
  const optionsFocusable = await page.evaluate(() =>
    document.querySelectorAll('#stage .sr-palette-row[tabindex]').length)
  if (optionsFocusable === 0) pass('no role="option" row carries a tabindex')
  else fail(optionsFocusable + ' option rows carry a tabindex')

  const nested = await page.evaluate(() => {
    const lb = document.querySelector('#stage #pal-listbox')
    return { anchors: lb.querySelectorAll('a[href]').length, buttons: lb.querySelectorAll('button').length }
  })
  if (nested.anchors === 0 && nested.buttons === 0) pass('listbox contains no anchor and no nested button')
  else fail('listbox contains ' + JSON.stringify(nested))

  // ---- keyboard: arrows clamp, Enter takes row one -------------------------
  await page.fill('#pal-input', 'cal')
  await page.waitForTimeout(80)
  await page.focus('#pal-input')
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(80)
  let active = await page.evaluate(() => document.querySelector('#pal-input').getAttribute('aria-activedescendant'))
  if (active === null) pass('ArrowUp at the top clamps: no active option')
  else fail('ArrowUp wrapped to ' + active)
  const total = await page.evaluate(() => document.querySelectorAll('#stage [role="option"]').length)
  for (let i = 0; i < total + 3; i++) { await page.keyboard.press('ArrowDown') }
  await page.waitForTimeout(120)
  active = await page.evaluate(() => document.querySelector('#pal-input').getAttribute('aria-activedescendant'))
  if (active === 'pal-option-' + (total - 1)) pass(`ArrowDown past the end clamps at the last of ${total} options`)
  else fail(`ArrowDown past the end landed on ${active} of ${total}`)

  // ---- screenshots ---------------------------------------------------------
  const shot = async (label, setup) => {
    await setup()
    await page.waitForTimeout(160)
    await page.locator('#frame').screenshot({ path: path.join(HERE, `shot-${name}-${label}.png`) })
  }
  await shot('desktop-light', async () => {
    await setControl(page, 'data-w', '1440'); await setControl(page, 'data-theme', 'light')
    await setControl(page, 'data-scale', '16'); await page.fill('#pal-input', 'cal')
  })
  await shot('desktop-dark', async () => {
    await setControl(page, 'data-theme', 'dark'); await page.fill('#pal-input', 'war')
  })
  await shot('phone-dark', async () => { await setControl(page, 'data-w', '390') })
  await shot('phone-light-200', async () => {
    await setControl(page, 'data-theme', 'light'); await setControl(page, 'data-w', '320')
    await setControl(page, 'data-scale', '32'); await page.fill('#pal-input', 'cal')
  })
  await shot('rail-light', async () => {
    await setControl(page, 'data-scale', '16'); await setControl(page, 'data-w', '834')
    await setControl(page, 'data-sp', 'nofile')
  })

  await browser.close()
}

await run('chromium', chromium)
await run('webkit', webkit)
console.log('\\n' + (failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'))
process.exit(failures === 0 ? 0 : 1)
