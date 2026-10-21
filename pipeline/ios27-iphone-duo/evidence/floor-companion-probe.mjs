// Scratch probe (ios27-iphone-duo): what the iPhone-only 16px floor above
// 640px does to the two phone-tier companions it does not copy, the Checklists
// row-label column and the Map Explorer sidebar's Date Range pair.
// Same build, same nodes, block present vs block deleted through the CSSOM.
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
// Run from anywhere: node floor-companion-probe.mjs [distDir]; renders go to $SR_PROBE_OUT (default: this folder).
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

const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
const results = []
try {
  for (const [label, type] of [['webkit', webkit], ['chromium', chromium]]) {
    const browser = await type.launch()
    for (const vp of VIEWPORTS) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2 })
      const page = await ctx.newPage()
      page.setDefaultTimeout(20000)
      await page.goto(base)
      const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
      await page.waitForTimeout(300)
      if (await welcome.count()) await dismissWelcome(welcome)
      const gate = await ensureIos(page)
      await openTab(page, 'Checklists')
      await page.locator('.sr-chk-row-label').first().waitFor({ state: 'visible' })
      const withLabels = await measureLabels(page)
      const chkBox = page.locator('.sr-chk-row-label').first().locator('xpath=ancestor::*[contains(@class,"sr-ctl-row")][1]')
      if (await chkBox.count()) await chkBox.first().screenshot({ path: `${OUT}/${label}-${vp.name}-checklists-floor.png` }).catch(() => {})
      await openTab(page, 'Map Explorer')
      await page.locator('.sr-map-sidebar-overlay .sr-daterange-input').first().waitFor({ state: 'visible' }).catch(() => {})
      await ensureIos(page)
      const withDates = await measureDates(page)
      const pair = page.locator('.sr-map-sidebar-overlay .sr-daterange')
      if (await pair.count()) await pair.first().screenshot({ path: `${OUT}/${label}-${vp.name}-dates-floor.png` }).catch(() => {})
      const deleted = await deleteBlock(page)
      const withoutDates = await measureDates(page)
      if (await pair.count()) await pair.first().screenshot({ path: `${OUT}/${label}-${vp.name}-dates-nofloor.png` }).catch(() => {})
      await openTab(page, 'Checklists')
      const withoutLabels = await measureLabels(page)
      if (await chkBox.count()) await chkBox.first().screenshot({ path: `${OUT}/${label}-${vp.name}-checklists-nofloor.png` }).catch(() => {})
      results.push({ engine: label, vp: vp.name, gate, deleted, withLabels, withoutLabels, withDates, withoutDates })
      await ctx.close()
    }
    await browser.close()
  }
} finally {
  await close()
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2))
for (const r of results) {
  console.log(`\n== ${r.engine} ${r.vp} gate=${JSON.stringify(r.gate)} deleted=${r.deleted}`)
  for (const [k, v] of [['labels floor', r.withLabels], ['labels nofloor', r.withoutLabels]]) {
    console.log(`  ${k}: ` + v.map(l => `${l.text}(${l.font}, w${l.boxW}, ${l.lines}L, ink+${l.inkPastBox}, row${l.rowH})`).join(' | '))
  }
  console.log(`  dates floor: ${JSON.stringify(r.withDates)}`)
  console.log(`  dates nofloor: ${JSON.stringify(r.withoutDates)}`)
}
