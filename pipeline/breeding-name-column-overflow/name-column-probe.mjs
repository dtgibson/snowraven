#!/usr/bin/env node
// Real-render regression probe for breeding-name-column-overflow.
//
// This drives the built app against synthetic demo data. It measures visible
// text ink, favicon boxes, and the full 24px link hit targets against each body
// name cell's content box; page scrollWidth is deliberately not used.
//
// Run:
//   cd frontend && npm run build
//   SR_DATA_DIR="$PWD/website/tools/demo-data" \
//     backend/.venv/bin/uvicorn main:app --port 1621
//   ENGINE=chromium node pipeline/breeding-name-column-overflow/name-column-probe.mjs
//   ENGINE=webkit   node pipeline/breeding-name-column-overflow/name-column-probe.mjs
//
// MUTATE=1 removes the repair at runtime. The mutation check passes only when
// it detects the historical 27.44px / 33.52px visible escape.
import { chromium, webkit } from '../../website/tools/node_modules/playwright/index.mjs'

const BASE = process.env.BASE || 'http://localhost:1621'
const ENGINE = process.env.ENGINE || 'chromium'
const MUTATE = process.env.MUTATE === '1'
const PHONE = { width: 320, height: 568 }
const DESKTOP = { width: 641, height: 800 }
const SCALES = [1, 1.25, 1.5, 2]
const THEMES = ['light', 'dark']
const STATES = ['normal', 'unbounded', 'pinned']
const EPSILON = 0.51

const browserType = ENGINE === 'webkit' ? webkit : chromium
if (!['chromium', 'webkit'].includes(ENGINE)) throw new Error(`unsupported ENGINE=${ENGINE}`)
const browser = await browserType.launch({ headless: true })

async function clickExact(page, label) {
  const buttons = await page.$$('button')
  for (const button of buttons) {
    if ((await button.textContent() || '').trim() === label) {
      await button.click()
      await page.waitForTimeout(120)
      return
    }
  }
  throw new Error(`button not found: ${label}`)
}

async function openMatrix({ viewport, scale, theme, state, mutate }) {
  const context = await browser.newContext({ viewport })
  await context.addInitScript(({ scale, theme }) => {
    localStorage.setItem('sr-theme', theme)
    localStorage.setItem('sr-text-scale', String(scale))
  }, { scale, theme })
  const page = await context.newPage()
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  const wideTab = page.locator('#tab-breeding-codes')
  if (await wideTab.count()) await wideTab.click()
  else {
    await page.locator('button[aria-haspopup="listbox"]').click()
    await page.locator('#tabopt-breeding-codes').click()
  }
  await page.waitForSelector('table.sr-bc-matrix')
  await page.evaluate(({ scale, theme, mutate }) => {
    document.documentElement.dataset.theme = theme
    document.documentElement.style.setProperty('--sr-text-scale', String(scale))
    if (mutate) {
      const style = document.createElement('style')
      style.dataset.probeMutation = 'true'
      style.textContent = '@media (max-width: 640px) { .sr-bc-name-col .sr-birdname { width: auto !important; max-width: none !important; } .sr-bc-name-col .sr-birdname-row { flex-wrap: nowrap !important; } }'
      document.head.appendChild(style)
    }
  }, { scale, theme, mutate })
  if (state === 'unbounded') await clickExact(page, '↔ Unbounded')
  if (state === 'pinned') await clickExact(page, 'Pin code labels')
  // Taxonomy codes arrive asynchronously and are what make SpeciesLinks mount.
  // Waiting on the actual link seam prevents a cold first configuration from
  // measuring the pre-taxonomy DOM while later warm-cache cases see favicons.
  await page.waitForSelector('tbody th.sr-bc-name-col a', { timeout: 30000 })
  await page.waitForTimeout(180)
  return { context, page }
}

const measure = async page => page.evaluate(() => {
  const table = document.querySelector('table.sr-bc-matrix')
  if (!table) throw new Error('matrix missing')
  const cells = [...table.querySelectorAll('tbody th.sr-bc-name-col')]
  if (!cells.length) throw new Error('no body name cells')

  let worstVisible = -Infinity
  let worstHitbox = -Infinity
  let worstLeft = -Infinity
  let visibleOverCount = 0
  let hitboxOverCount = 0
  let links = 0
  let imgs = 0
  let minAnchorWidth = Infinity
  let minAnchorHeight = Infinity
  let minImgWidth = Infinity
  let minImgHeight = Infinity
  let worstLabel = ''

  const consider = (rect, left, right, kind, label) => {
    const over = rect.right - right
    const leftOver = left - rect.left
    if (kind === 'hitbox') {
      if (over > worstHitbox) worstHitbox = over
      if (over > 0.01) hitboxOverCount++
    } else {
      if (over > worstVisible) { worstVisible = over; worstLabel = label }
      if (over > 0.01) visibleOverCount++
    }
    worstLeft = Math.max(worstLeft, leftOver)
  }

  for (const cell of cells) {
    const box = cell.getBoundingClientRect()
    // NAME_COL_WIDTH clamps the cell's border box. Its 12px padding is usable:
    // the 24px link target deliberately carries a 5px halo around its 14px icon,
    // and after the fix that halo sits in the padding while the visible icon ends
    // at the content edge. Comparing the target to the content edge would call
    // that intentional padding use an overflow even though it stays inside the
    // clamped column and cannot cross the separator.
    const left = box.left
    const right = box.right
    const label = cell.querySelector('.sr-birdname-link, .sr-birdname-text')?.textContent?.trim() || ''

    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.trim()) continue
      const range = document.createRange()
      range.selectNodeContents(node)
      for (const raw of range.getClientRects()) {
        if (raw.width <= 0) continue
        // Range rects report the un-clipped ink of an ellipsized scientific name.
        // Intersect with every overflow-clipping ancestor so this remains a
        // VISIBLE-ink measurement rather than flagging text the browser hides.
        let rect = { left: raw.left, right: raw.right, top: raw.top, bottom: raw.bottom }
        for (let el = node.parentElement; el && el !== cell; el = el.parentElement) {
          const style = getComputedStyle(el)
          if (style.overflowX !== 'visible') {
            const clip = el.getBoundingClientRect()
            rect.left = Math.max(rect.left, clip.left)
            rect.right = Math.min(rect.right, clip.right)
          }
        }
        if (rect.right > rect.left) consider(rect, left, right, 'visible', label)
      }
      range.detach?.()
    }
    for (const img of cell.querySelectorAll('img.sr-favicon')) {
      const rect = img.getBoundingClientRect()
      imgs++
      minImgWidth = Math.min(minImgWidth, rect.width)
      minImgHeight = Math.min(minImgHeight, rect.height)
      consider(rect, left, right, 'visible', label)
    }
    for (const anchor of cell.querySelectorAll('a')) {
      const rect = anchor.getBoundingClientRect()
      links++
      minAnchorWidth = Math.min(minAnchorWidth, rect.width)
      minAnchorHeight = Math.min(minAnchorHeight, rect.height)
      consider(rect, left, right, 'hitbox', label)
      if (!anchor.getAttribute('aria-label')?.includes('opens in a new tab')) throw new Error('link accessible name regressed')
    }
  }

  const first = cells[0]
  const firstBox = first.getBoundingClientRect()
  return {
    rows: cells.length,
    links,
    imgs,
    worstVisible: +worstVisible.toFixed(2),
    worstHitbox: +worstHitbox.toFixed(2),
    worstLeft: +worstLeft.toFixed(2),
    visibleOverCount,
    hitboxOverCount,
    minAnchorWidth: +minAnchorWidth.toFixed(2),
    minAnchorHeight: +minAnchorHeight.toFixed(2),
    minImgWidth: +minImgWidth.toFixed(2),
    minImgHeight: +minImgHeight.toFixed(2),
    cellWidth: +firstBox.width.toFixed(2),
    tableWidth: +table.getBoundingClientRect().width.toFixed(2),
    sticky: getComputedStyle(first).position === 'sticky',
    pinned: table.classList.contains('sr-bc-matrix--pinned'),
    worstLabel,
  }
})

const failures = []
const rows = []
for (const theme of THEMES) for (const scale of SCALES) for (const state of STATES) {
  const { context, page } = await openMatrix({ viewport: PHONE, scale, theme, state, mutate: MUTATE })
  try {
    const result = await measure(page)
    rows.push({ theme, scale, state, ...result })
    const expectedSticky = state === 'normal'
    const expectedPinned = state === 'pinned'
    const bad = []
    if (result.links !== result.rows * 2 || result.imgs !== result.rows * 2) bad.push('missing links/images')
    if (result.minAnchorWidth < 23.99 || result.minAnchorHeight < 23.99) bad.push('target below 24px')
    if (result.minImgWidth !== 14 || result.minImgHeight !== 14) bad.push('favicon not 14px')
    if (result.worstVisible > EPSILON || result.worstHitbox > EPSILON || result.worstLeft > EPSILON) bad.push('content escapes cell')
    if (result.sticky !== expectedSticky || result.pinned !== expectedPinned) bad.push('state predicate changed')
    if (bad.length) failures.push(`${theme}/${scale}/${state}: ${bad.join(', ')} (${JSON.stringify(result)})`)
  } finally {
    await context.close()
  }
}

// The repair is phone-only. At 641px, removing it must change no measured
// geometry or sticky state because the media rule does not match.
for (const mutate of [false, true]) {
  const { context, page } = await openMatrix({ viewport: DESKTOP, scale: 2, theme: 'light', state: 'normal', mutate })
  try { rows.push({ desktop: true, mutate, ...(await measure(page)) }) } finally { await context.close() }
}
const [desktopAfter, desktopMutated] = rows.filter(row => row.desktop)
for (const key of ['cellWidth', 'tableWidth', 'sticky', 'pinned', 'worstVisible', 'worstHitbox']) {
  if (desktopAfter[key] !== desktopMutated[key]) failures.push(`641px moved for ${key}: ${desktopAfter[key]} != ${desktopMutated[key]}`)
}

await browser.close()
const worstVisual = Math.max(...rows.filter(row => !row.desktop).map(row => row.worstVisible))
const worstTarget = Math.max(...rows.filter(row => !row.desktop).map(row => row.worstHitbox))
console.log(`${ENGINE}${MUTATE ? ' MUTATED' : ''}: ${rows.filter(row => !row.desktop).length} phone configurations`)
console.log(`worst visible escape ${worstVisual.toFixed(2)}px; worst hitbox escape ${worstTarget.toFixed(2)}px`)
for (const scale of SCALES) {
  const row = rows.find(item => !item.desktop && item.theme === 'light' && item.scale === scale && item.state === 'normal')
  console.log(`  ${scale}x: visible ${row.worstVisible}px; hitbox ${row.worstHitbox}px; cell ${row.cellWidth}px; ${row.worstLabel}`)
}
if (MUTATE && failures.length === 0) failures.push('mutation unexpectedly passed')
if (!MUTATE && failures.length) console.error(failures.join('\n'))
if (MUTATE && failures.length) console.log(`expected mutation failures: ${failures.length}`)
const passed = MUTATE ? failures.length > 0 && worstVisual > 20 : failures.length === 0
console.log(passed ? 'PASS' : 'FAIL')
process.exit(passed ? 0 : 1)
