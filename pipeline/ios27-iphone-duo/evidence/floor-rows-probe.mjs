// Scratch probe (ios27-iphone-duo): filter-row counts on every tab with the
// iPhone-only 16px floor above 640px, against the same page with it deleted.
// Same build, same nodes, block present vs block deleted through the CSSOM.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
// Run from anywhere: node floor-rows-probe.mjs [distDir].
const WT = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '')
const OUT = process.env.SR_PROBE_OUT ?? new URL('.', import.meta.url).pathname
const require = createRequire(`${WT}/website/tools/package.json`)
const { webkit, chromium } = require('playwright')
const { serveDist } = await import(`${WT}/website/tools/verify/serveDist.mjs`)
const { dismissWelcome } = await import(`${WT}/website/tools/verify/dismissWelcome.mjs`)

const DIST = process.argv.slice(2).find(a => !a.startsWith('--')) ?? `${WT}/frontend/dist`
const CSV = [
  'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Latitude,Longitude,Date,Time,Protocol,Duration (Min),All Obs Reported,Distance Traveled (km),Area Covered (ha),Number of Observers,Breeding Code,Observation Details,Checklist Comments,ML Catalog Numbers',
  'S900000001,Ring-billed Gull,Larus delawarensis,1,2,US-NY,New York,L191106,Central Park,40.7813,-73.9665,2024-01-03,08:00 AM,eBird - Traveling Count,60,1,2.1,,1,,,,',
  'S900000002,Wild Turkey,Meleagris gallopavo,2,4,US-NJ,Passaic,L207514,Garret Mountain,40.9168,-74.1490,2024-02-11,09:10 AM,eBird - Stationary Count,30,1,,,1,,,,',
  'S900000003,Mallard,Anas platyrhynchos,3,2,US-NJ,Cape May,L137800,Cape May Point,38.9319,-74.9610,2025-01-05,07:45 AM,eBird - Traveling Count,90,1,3.4,,2,,,,',
].join('\n')

function stubBackend(p, _req, res) {
  if (p === '/settings/files') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T00:00:00Z' }, ml: null }))
    return true
  }
  if (p === '/settings/files/ebird') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(CSV); return true }
  if (p === '/settings/keys') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ebird: null, openweather: null })); return true
  }
  if (/^\/(settings|weather|tide|map|taxonomy|version|nominatim|stats|checklists|media)/.test(p)) {
    res.writeHead(404); res.end('not found'); return true
  }
  return false
}

const VIEWPORTS = [
  { name: 'duo-inner-portrait', width: 669, height: 951 },
  { name: 'duo-inner-landscape', width: 951, height: 669 },
  { name: 'iphone17pro-landscape', width: 874, height: 402 },
]

async function ensureIos(page) {
  await page.evaluate(() => document.documentElement.classList.add('sr-ios-app'))
  return page.evaluate(() => ({
    ios: document.documentElement.classList.contains('sr-ios-app'),
    legacy: matchMedia('(min-width: 641px) and (max-device-width: 700px), (min-width: 641px) and (max-device-height: 700px)').matches,
    range: matchMedia('(width>=641px) and (device-width<=700px),(width>=641px) and (device-height<=700px)').matches,
    screen: `${screen.width}x${screen.height}`,
  }))
}

async function openTab(page, name) {
  const handle = await page.evaluateHandle(n => [...document.querySelectorAll('nav button, nav a, nav [role=tab]')]
    .find(e => e.getClientRects().length && ((e.getAttribute('aria-label') || '').trim() === n || (e.textContent || '').trim() === n)), name)
  const el = handle.asElement()
  if (!el) throw new Error(`no nav control named ${name}`)
  await el.click()
}

const measureLabels = page => page.evaluate(() => {
  const out = []
  for (const el of document.querySelectorAll('.sr-chk-row-label')) {
    if (el.getClientRects().length === 0) continue
    const box = el.getBoundingClientRect()
    const r = document.createRange(); r.selectNodeContents(el)
    const rects = [...r.getClientRects()].filter(x => x.width > 0)
    const tops = new Set(rects.map(x => Math.round(x.top)))
    const inkRight = Math.max(...rects.map(x => x.right))
    out.push({ text: el.textContent, font: getComputedStyle(el).fontSize, boxW: +box.width.toFixed(2),
      lines: tops.size, inkPastBox: +(inkRight - box.right).toFixed(2), rowH: +el.parentElement.getBoundingClientRect().height.toFixed(2) })
  }
  return out
})

const measureDates = page => page.evaluate(() => {
  const side = [...document.querySelectorAll('.sr-map-sidebar-overlay')].find(e => e.getClientRects().length)
  if (!side) return null
  const inputs = [...side.querySelectorAll('.sr-daterange-input')]
  const pair = side.querySelector('.sr-daterange')
  return { sidebarW: +side.getBoundingClientRect().width.toFixed(2),
    dir: pair ? getComputedStyle(pair).flexDirection : null,
    inputs: inputs.map(i => ({ font: getComputedStyle(i).fontSize, w: +i.getBoundingClientRect().width.toFixed(2),
      top: Math.round(i.getBoundingClientRect().top) })) }
})

const deleteBlock = page => page.evaluate(() => {
  let n = 0
  for (const sheet of document.styleSheets) {
    let rules; try { rules = sheet.cssRules } catch { continue }
    for (let i = rules.length - 1; i >= 0; i--) {
      const r = rules[i]
      if (r instanceof CSSMediaRule && /device-(width|height)/.test(r.conditionText)) { sheet.deleteRule(i); n++ }
    }
  }
  return n
})


const measureRows = page => page.evaluate(() => {
  const out = []
  for (const row of document.querySelectorAll('.sr-ctl-row')) {
    if (row.getClientRects().length === 0) continue
    const rb = row.getBoundingClientRect()
    const ctls = [...row.querySelectorAll('button, select, input')].filter(e => e.getClientRects().length && e.getBoundingClientRect().width > 0)
    if (!ctls.length) continue
    const tops = new Set(ctls.map(e => Math.round(e.getBoundingClientRect().top / 4)))
    const past = Math.max(0, ...ctls.map(e => e.getBoundingClientRect().right - rb.right))
    out.push({ rows: tops.size, n: ctls.length, past: +past.toFixed(2), font: getComputedStyle(ctls[0]).fontSize })
  }
  return out
})
const TABS = ['Multimedia', 'Breeding Codes', 'Species Detail', 'Calendar', 'Checklists', 'Map Explorer', 'Statistics', 'Named Birds', 'Targets', 'List Comparer']
const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
const lines = []
try {
  for (const [label, type] of [['webkit', webkit], ['chromium', chromium]]) {
    const browser = await type.launch()
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1 })
      const page = await ctx.newPage()
      page.setDefaultTimeout(20000)
      await page.goto(base)
      const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
      await page.waitForTimeout(300)
      if (await welcome.count()) await dismissWelcome(welcome)
      await ensureIos(page)
      const floor = {}
      for (const t of TABS) {
        try { await openTab(page, t) } catch { floor[t] = 'no nav'; continue }
        await page.waitForTimeout(400)
        floor[t] = await measureRows(page)
      }
      const deleted = await deleteBlock(page)
      const nofloor = {}
      for (const t of TABS) {
        try { await openTab(page, t) } catch { nofloor[t] = 'no nav'; continue }
        await page.waitForTimeout(400)
        nofloor[t] = await measureRows(page)
      }
      for (const t of TABS) {
        const a = floor[t], b = nofloor[t]
        if (!Array.isArray(a) || !a.length) { lines.push(`${label} ${vp.name} ${t}: no filter rows (${JSON.stringify(a)})`); continue }
        const fmt = r => r.map(x => `${x.rows}r/${x.n}c${x.past > 0 ? ' PAST ' + x.past : ''}@${x.font}`).join(' ')
        lines.push(`${label} ${vp.name} ${t}: floor[${fmt(a)}] nofloor[${fmt(b)}] deleted=${deleted}`)
      }
      await ctx.close()
    }
    await browser.close()
  }
} finally {
  await close()
}
console.log(lines.join('\n'))
