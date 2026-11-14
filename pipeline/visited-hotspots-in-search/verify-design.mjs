// Reads the Stage 4 mockup (design.html) back out of real engines.
//
//   node pipeline/visited-hotspots-in-search/verify-design.mjs [--shots <dir>] [--file <other.html>]
//
// Headless Chromium and WebKit, the mockup file itself, loaded from disk. No
// server is started and no request leaves the machine (the run fails if the
// page asks for anything but itself). This measures the MOCKUP, not the built
// app: every figure it prints is re-measured in the built app by the Engineer
// and QA (CLAUDE.md, the v1.0.50 rule).
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
// Playwright is website/tools' dependency. A worktree with no install there can
// point PLAYWRIGHT_FROM at any folder holding the same pinned version.
const from = process.env.PLAYWRIGHT_FROM || join(here, '../../website/tools')
const require = createRequire(join(from, 'package.json'))
const { chromium, webkit } = require('playwright')

const shotsAt = process.argv.indexOf('--shots')
const shots = shotsAt > 0 ? process.argv[shotsAt + 1] : null
if (shots) mkdirSync(shots, { recursive: true })

// --file <path> points the same checks at another copy: the control leg, a
// deliberately broken mockup that the ink and hint probes must fail on.
const fileAt = process.argv.indexOf('--file')
const url = pathToFileURL(fileAt > 0 ? process.argv[fileAt + 1] : join(here, 'design.html')).href
const fails = []
let checks = 0
function check(name, ok, detail) {
  checks += 1
  if (!ok) fails.push(`${name}${detail ? ': ' + detail : ''}`)
}

// A screenshot of an entering overlay waits for the entrance to finish.
const settled = page => page.waitForFunction(() => {
  const p = document.querySelector('#pal-panel')
  return !p || (getComputedStyle(p).opacity === '1' && p.getAnimations().length === 0)
})
async function shot(page, sel, file) {
  if (!shots) return
  await settled(page)
  await page.locator(sel).screenshot({ path: join(shots, file) })
}
async function seg(page, key, v) { await page.click(`.mk-seg[data-key="${key}"] button[data-v="${v}"]`) }
async function type(page, q) {
  await page.click('#openbtn')
  await page.fill('#pal-input', q)
}
const counts = page => page.evaluate(() => {
  const groups = [...document.querySelectorAll('#pal-listbox > [role="group"]')]
  const by = {}
  for (const g of groups) by[g.getAttribute('aria-label')] = g.querySelectorAll('[role="option"]').length
  return {
    by,
    options: document.querySelectorAll('#pal-listbox [role="option"]').length,
    notes: [...document.querySelectorAll('#pal-listbox .sr-palette-note')].map(n => ({
      text: n.textContent,
      group: n.parentElement.getAttribute('aria-label'),
      last: n.parentElement.lastElementChild === n,
      describedBy: n.parentElement.getAttribute('aria-describedby') === n.id,
    })),
    status: document.querySelector('#pal-status').textContent,
    statusNodes: document.querySelectorAll('#pal-status .sr-palette-status-line').length,
    heading: [...document.querySelectorAll('#pal-listwrap > .sr-palette-group')].map(n => n.textContent),
    active: document.querySelector('#pal-input').getAttribute('aria-activedescendant'),
  }
})

// Text ink against the overlay panel: client rects over a Range per text node,
// each cut down to what its clipping ancestors let through. The shipped species
// row ellipsizes both of its spans, and a Range reports the clipped text too, so
// an unclipped reading flags text nobody can see (it did, on the first run).
const inkProbe = (page, rootSel) => page.evaluate(sel => {
  const out = []
  for (const panel of document.querySelectorAll(sel)) {
    const box = panel.getBoundingClientRect()
    let worst = 0, where = ''
    const walker = document.createTreeWalker(panel, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim()) continue
      const el = n.parentElement
      const cs = getComputedStyle(el)
      if (cs.display === 'none' || cs.visibility === 'hidden') continue
      if (el.closest('.sr-palette-hint') && getComputedStyle(el.closest('.sr-palette-hint')).display === 'none') continue
      const clips = []
      for (let a = el; a && a !== panel; a = a.parentElement) {
        const ox = getComputedStyle(a).overflowX
        if (ox !== 'visible') clips.push(a.getBoundingClientRect())
      }
      const r = document.createRange(); r.selectNodeContents(n)
      for (const rect of r.getClientRects()) {
        let left = rect.left, right = rect.right
        for (const cb of clips) { left = Math.max(left, cb.left); right = Math.min(right, cb.right) }
        if (right <= left) continue
        const over = Math.max(right - box.right, box.left - left)
        if (over > worst) { worst = over; where = n.textContent.slice(0, 40) }
      }
    }
    const sc = panel.querySelector('.sr-palette-results')
    out.push({ worst: Math.round(worst * 100) / 100, where, panelW: Math.round(box.width), sideScroll: sc.scrollWidth - sc.clientWidth })
  }
  return out
}, rootSel)

// What the field shows while empty, and whether it fits.
const fieldProbe = page => page.evaluate(() => {
  const input = document.querySelector('#pal-input')
  const hint = input.nextElementSibling
  const cs = getComputedStyle(input)
  const room = input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
  const ctx = document.createElement('canvas').getContext('2d')
  ctx.font = `400 ${cs.fontSize} ${cs.fontFamily}`
  const full = ctx.measureText(input.placeholder).width
  const short = ctx.measureText(hint.textContent).width
  const hintShown = getComputedStyle(hint).display !== 'none'
  const field = input.parentElement.getBoundingClientRect().width
  return {
    field: Math.round(field * 10) / 10, room: Math.round(room * 10) / 10, fontPx: parseFloat(cs.fontSize),
    full: Math.round(full * 10) / 10, short: Math.round(short * 10) / 10, hintShown,
    shippedWording: Math.round(ctx.measureText('Search destinations and species').width * 10) / 10,
  }
})

async function run(engine, name) {
  const browser = await engine.launch()
  const page = await browser.newPage({ viewport: { width: 1480, height: 1000 } })
  const foreign = []
  page.on('request', r => { if (r.url() !== url) foreign.push(r.url()) })
  const errors = []
  page.on('pageerror', e => errors.push(String(e)))
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(url)
  await page.waitForSelector('#pal-input')

  // ---- the default view: one query, all three kinds --------------------
  let c = await counts(page)
  check(`${name} default: three groups in order`, Object.keys(c.by).join() === 'Destinations,Species,Locations', JSON.stringify(c.by))
  console.log(name, 'cal ->', JSON.stringify(c.by))

  // ---- empty query: destinations only ----------------------------------
  await type(page, '')
  c = await counts(page)
  check(`${name} empty: destinations only`, c.options === 14 && Object.keys(c.by).join() === 'Destinations' && c.status === '', JSON.stringify(c))
  await page.fill('#pal-input', '   ')
  c = await counts(page)
  check(`${name} spaces: destinations only`, c.options === 14 && Object.keys(c.by).join() === 'Destinations', JSON.stringify(c.by))

  // ---- arrows cross the groups and stop at the ends ---------------------
  await page.fill('#pal-input', 'cal')
  c = await counts(page)
  const firstLoc = c.by.Destinations + c.by.Species
  for (let i = 0; i <= firstLoc; i++) await page.keyboard.press('ArrowDown')
  let a = await page.evaluate(() => {
    const id = document.querySelector('#pal-input').getAttribute('aria-activedescendant')
    const el = document.getElementById(id)
    return { id, loc: el.classList.contains('sr-palette-row--loc'), selected: el.getAttribute('aria-selected'), focus: document.activeElement.id }
  })
  check(`${name} ArrowDown from the last species lands on the first location`, a.id === `pal-option-${firstLoc}` && a.loc && a.selected === 'true' && a.focus === 'pal-input', JSON.stringify(a))
  for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowDown')
  c = await counts(page)
  check(`${name} ArrowDown stops on the last row`, c.active === `pal-option-${c.options - 1}`, c.active)
  await shot(page, '#frame', `${name}-desk-cal-active.png`)
  const tabStops = await page.evaluate(() => [...document.querySelectorAll('#pal-panel *')].filter(e => e.tabIndex >= 0).map(e => e.id))
  check(`${name} two tab stops`, tabStops.join() === 'pal-input,pal-close', tabStops.join())
  const nested = await page.evaluate(() => document.querySelectorAll('#pal-listbox a, #pal-listbox button, #pal-listbox [tabindex]').length)
  check(`${name} nothing interactive inside the listbox`, nested === 0, String(nested))
  const ids = await page.evaluate(() => [...document.querySelectorAll('#pal-listbox [id]')].map(e => e.id).filter(id => !/^pal-(listbox|option-\d+|cap-(species|locations))$/.test(id)))
  check(`${name} ids carry no file text`, ids.length === 0, ids.join())

  // ---- contrast of the location row's two lines, resting and highlighted --
  for (const theme of ['light', 'dark']) {
    await seg(page, 'theme', theme)
    await page.fill('#pal-input', 'cal')
    for (let i = 0; i <= firstLoc; i++) await page.keyboard.press('ArrowDown')
    const pairs = await page.evaluate(() => {
      const rgb = v => v.match(/[\d.]+/g).slice(0, 3).map(Number)
      const lum = c => { const [r, g, b] = c.map(x => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }); return 0.2126 * r + 0.7152 * g + 0.0722 * b }
      const ratio = (f, b) => { const x = lum(rgb(f)), y = lum(rgb(b)); return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100 }
      const panelBg = getComputedStyle(document.querySelector('#pal-panel')).backgroundColor
      const out = {}
      const rows = [...document.querySelectorAll('#pal-listbox .sr-palette-row--loc')]
      const active = rows.find(r => r.classList.contains('sr-palette-row--active'))
      const rest = rows.find(r => !r.classList.contains('sr-palette-row--active'))
      const read = (row, bg, key) => {
        out[key + ' name'] = ratio(getComputedStyle(row.querySelector('.sr-palette-loc-name')).color, bg)
        out[key + ' place'] = ratio(getComputedStyle(row.querySelector('.sr-palette-loc-meta')).color, bg)
      }
      read(active, getComputedStyle(active).backgroundColor, 'highlighted')
      read(rest, panelBg, 'resting')
      out['cap line'] = ratio(getComputedStyle(document.querySelector('.mk-spec .sr-palette-note')).color, panelBg)
      return out
    })
    console.log(name, theme, 'contrast', JSON.stringify(pairs))
    check(`${name} ${theme}: every location-row text pair clears 4.5:1`, Object.values(pairs).every(v => v >= 4.5), JSON.stringify(pairs))
  }
  await seg(page, 'theme', 'light')
  await page.fill('#pal-input', 'cal')
  for (let i = 0; i <= firstLoc; i++) await page.keyboard.press('ArrowDown')

  // ---- Enter opens the report -------------------------------------------
  await page.keyboard.press('Enter')
  const landed = await page.evaluate(() => ({
    open: !!document.querySelector('#pal-root'),
    title: document.querySelector('.sr-page-title').textContent,
    name: document.querySelector('.sr-hsr-name') && document.querySelector('.sr-hsr-name').textContent,
  }))
  check(`${name} Enter opens Hotspot Reports on the place`, !landed.open && landed.title === 'Hotspot Reports' && !!landed.name, JSON.stringify(landed))
  await shot(page, '#frame', `${name}-desk-landed.png`)

  // ---- namesakes ---------------------------------------------------------
  await type(page, 'central')
  let rows = await page.$$eval('#pal-listbox .sr-palette-row--loc', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()))
  check(`${name} namesakes by place carry no ID`, rows.length === 3 && rows.every(t => !/L\d{4}/.test(t)) && new Set(rows).size === 3, rows.join(' | '))
  await page.fill('#pal-input', 'backyard')
  rows = await page.$$eval('#pal-listbox .sr-palette-row--loc', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()))
  check(`${name} namesakes on a full tie carry the ID`, rows.filter(t => /L\d{4}/.test(t)).length === 2 && rows.length === 3, rows.join(' | '))
  console.log(name, 'backyard ->', rows.join(' | '))
  const snap = await page.locator('#pal-listbox').ariaSnapshot()
  console.log(name, 'aria snapshot (backyard):\n' + snap)
  check(`${name} accessible name is name, place, ID`, /option "Backyard Santa Clara, CA L19034127"/.test(snap), snap)

  // ---- both cap lines ----------------------------------------------------
  await page.fill('#pal-input', 'a')
  c = await counts(page)
  check(`${name} both groups capped at 50`, c.by.Species === 50 && c.by.Locations === 50, JSON.stringify(c.by))
  check(`${name} two cap lines, each the last child of its own group and its description`,
    c.notes.length === 2 && c.notes[0].group === 'Species' && c.notes[1].group === 'Locations' && c.notes.every(n => n.last && n.describedBy), JSON.stringify(c.notes))
  check(`${name} species line wording unchanged`, c.notes[0] && c.notes[0].text === 'Showing the first 50 matches. Keep typing to narrow them.', c.notes[0] && c.notes[0].text)
  if (shots) {
    await page.evaluate(() => {
      const sc = document.querySelector('#pal-results'), n = document.querySelector('#pal-cap-species')
      sc.scrollTop += n.getBoundingClientRect().top - sc.getBoundingClientRect().top - 200
    })
    await seg(page, 'theme', 'dark')
    await page.fill('#pal-input', 'a')
    await page.evaluate(() => {
      const sc = document.querySelector('#pal-results'), n = document.querySelector('#pal-cap-species')
      sc.scrollTop += n.getBoundingClientRect().top - sc.getBoundingClientRect().top - 200
    })
    await shot(page, '#frame', `${name}-desk-dark-caps.png`)
    await seg(page, 'theme', 'light')
  }

  // ---- the sentences: exactly one or none --------------------------------
  const want = {
    pending: ['Reading your eBird backup.', 'Species and locations'],
    none: ['Searching species and locations needs your eBird backup. Upload MyEBirdData.csv in Settings \u2192 Default Files \u2192 eBird Backup.', 'Species and locations'],
    unloadable: ["Couldn't load your eBird backup. Re-upload MyEBirdData.csv in Settings \u2192 Default Files \u2192 eBird Backup.", 'Species and locations'],
    locfailed: ["Couldn't load your eBird backup. Re-upload MyEBirdData.csv in Settings \u2192 Default Files \u2192 eBird Backup.", 'Locations'],
  }
  await type(page, 'li')
  for (const [state, [sentence, heading]] of Object.entries(want)) {
    await seg(page, 'backup', state)
    c = await counts(page)
    check(`${name} ${state}: one sentence under its heading, destinations still listed`,
      c.status === sentence && c.statusNodes === 1 && c.heading.join() === heading && c.by.Destinations === 3 && !c.by.Locations, JSON.stringify(c))
  }
  await seg(page, 'backup', 'arriving')
  await page.fill('#pal-input', 'pinos')
  c = await counts(page)
  check(`${name} arriving, nothing else matches: reading, never "nothing matches"`, c.status === 'Reading your eBird backup.' && c.heading.join() === 'Locations', JSON.stringify(c))
  await seg(page, 'backup', 'ready')
  await page.fill('#pal-input', 'zzz')
  c = await counts(page)
  check(`${name} nothing matches: the sentence with no heading`, c.status === 'Nothing matches that search.' && c.heading.length === 0 && c.options === 0, JSON.stringify(c))

  // ---- location rows joining move nothing --------------------------------
  await seg(page, 'backup', 'arriving')
  await page.fill('#pal-input', 'cal')
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown')
  const before = await page.evaluate(() => {
    const id = document.querySelector('#pal-input').getAttribute('aria-activedescendant')
    const base = document.querySelector('#pal-panel').getBoundingClientRect().top
    const tops = [...document.querySelectorAll('#pal-listbox [role="option"]')].map(e => Math.round((e.getBoundingClientRect().top - base) * 100) / 100)
    return { id, text: document.getElementById(id).textContent, tops, locs: document.querySelectorAll('#pal-listbox .sr-palette-row--loc').length }
  })
  await page.click('#arrive')
  const after = await page.evaluate(() => {
    const id = document.querySelector('#pal-input').getAttribute('aria-activedescendant')
    const base = document.querySelector('#pal-panel').getBoundingClientRect().top
    const tops = [...document.querySelectorAll('#pal-listbox [role="option"]')].map(e => Math.round((e.getBoundingClientRect().top - base) * 100) / 100)
    return { id, text: document.getElementById(id).textContent, tops, locs: document.querySelectorAll('#pal-listbox .sr-palette-row--loc').length }
  })
  check(`${name} join: highlight keeps its row, no existing row moves`,
    before.locs === 0 && after.locs > 0 && before.id === after.id && before.text === after.text &&
    before.tops.every((t, i) => t === after.tops[i]), JSON.stringify({ before, after }))

  // ---- the field's hint, and ink, across windows and text sizes ----------
  for (const win of ['desk', 'p393', 'p320']) {
    await seg(page, 'win', win)
    for (const scale of ['1', '1.5', '2']) {
      await seg(page, 'scale', scale)
      await type(page, '')
      const f = await fieldProbe(page)
      const shownW = f.hintShown ? f.short : f.full
      console.log(name, win, `${scale}x`, JSON.stringify(f))
      check(`${name} ${win} ${scale}x: the hint the field shows is not clipped`, shownW <= f.room, JSON.stringify(f))
      check(`${name} ${win} ${scale}x: the full wording is used wherever it fits with room to spare`, f.hintShown === (f.full > f.room) || (f.hintShown && f.full > f.room * 0.8), JSON.stringify(f))
      for (const q of ['cal', 'backyard', 'a', 'stevens', 'unnamed']) {
        await page.fill('#pal-input', q)
        const ink = await inkProbe(page, '#pal-panel')
        check(`${name} ${win} ${scale}x "${q}": no ink outside the panel, no sideways scroll`, ink[0].worst <= 0.5 && ink[0].sideScroll <= 0, JSON.stringify(ink[0]))
      }
      for (const state of ['none', 'unloadable', 'locfailed']) {
        await seg(page, 'backup', state)
        const ink = await inkProbe(page, '#pal-panel')
        check(`${name} ${win} ${scale}x ${state}: sentence wraps inside the panel`, ink[0].worst <= 0.5 && ink[0].sideScroll <= 0, JSON.stringify(ink[0]))
      }
      await seg(page, 'backup', 'ready')
      const held = await inkProbe(page, '.mk-spec .sr-palette-panel')
      const bad = held.filter(h => h.worst > 0.5 || h.sideScroll > 0)
      check(`${name} ${win} ${scale}x: held frames (${held.length}) clean, the 200-character unbroken name included`, held.length >= 15 && bad.length === 0, JSON.stringify(bad))
      if (shots && win === 'p320') {
        await page.fill('#pal-input', 'back')
        await shot(page, '#frame', `${name}-p320-${scale}x-back.png`)
        await page.fill('#pal-input', '')
        await shot(page, '#frame', `${name}-p320-${scale}x-empty.png`)
      }
    }
    await seg(page, 'scale', '1')
  }
  await seg(page, 'win', 'desk')

  // ---- the hint across the band no breakpoint covers ---------------------
  let swept = 0, sweptShort = 0, sweptFull = 0
  for (const scale of ['1', '1.5', '2']) {
    await seg(page, 'scale', scale)
    for (let w = 330; w <= 1400; w += 30) {
      await page.evaluate(px => window.mkSetWindow(px, 700), w)
      await page.click('#openbtn')
      const f = await fieldProbe(page)
      const shownW = f.hintShown ? f.short : f.full
      swept += 1
      if (f.hintShown) sweptShort += 1; else sweptFull += 1
      check(`${name} sweep ${w}px ${scale}x: the hint shown fits, with at least 8px to spare`, shownW + 8 <= f.room, JSON.stringify(f))
    }
  }
  check(`${name} sweep measured every configuration and saw both hints`, swept === 108 && sweptShort > 0 && sweptFull > 0, JSON.stringify({ swept, sweptShort, sweptFull }))
  console.log(name, 'hint sweep', JSON.stringify({ swept, sweptShort, sweptFull }))
  await seg(page, 'scale', '1')
  await seg(page, 'win', 'desk')
  if (shots) {
    await shot(page, '#specs-results', `${name}-specs-results.png`)
    await shot(page, '#specs-status', `${name}-specs-status.png`)
    await shot(page, '#specs-phone', `${name}-specs-phone.png`)
    await seg(page, 'theme', 'dark')
    await shot(page, '#specs-phone', `${name}-specs-phone-dark.png`)
    await shot(page, '#specs-results', `${name}-specs-results-dark.png`)
  }

  if (shots) {
    await seg(page, 'theme', 'light')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.click('.mk-chip:nth-of-type(2)')
    await settled(page)
    await page.screenshot({ path: join(shots, `${name}-page-top.png`) })
    await seg(page, 'win', 'p393')
    await page.click('.mk-chip:nth-of-type(4)')
    await shot(page, '#frame', `${name}-p393-back.png`)
    await seg(page, 'win', 'desk')
  }
  check(`${name} no request but the file itself`, foreign.length === 0, foreign.join())
  check(`${name} no page error`, errors.length === 0, errors.join(' | '))
  await browser.close()
}

await run(chromium, 'chromium')
await run(webkit, 'webkit')

console.log(`\n${checks} checks, ${fails.length} failed`)
for (const f of fails) console.log('FAIL', f)
process.exit(fails.length ? 1 : 0)
