// Real-engine verification of the named-bird card on the Named Birds tab: the
// compact list of numbered Macaulay Library links above a named bird's gallery
// (feature ml-media-links, QA-25 and QA-26), and since
// code-search-and-a11y-polish the whole card around it.
//
// WHAT IT MEASURES, per configuration, in Chromium and WebKit against the built
// dist:
//
//   * REFLOW (QA-25). Every text node's INK inside the list, read through a
//     `Range`, stays inside the media section's content box, and so does every
//     link's box; the list and the page carry no horizontal scroll, and the list
//     adds none to the section (read with the list shown, then hidden). Ink, not
//     element boxes, because a box can read clean while an unbreakable run hangs
//     outside it (.claude/rules/testing.md, v0.5.85). The fixture's second bird
//     has a 120-character name with no spaces, the longest a `[name:...]` tag
//     admits, and the harness asserts its lead really wraps at 320px.
//   * NO STALE WRAP. Every link sits inside its own list and the list block, so
//     a grid row sized from a previous line count (the WebKit text-scale defect
//     in .claude/rules/ui.md, v1.0.38) reads as a failure. The text scale is
//     changed in place, up and down, on an already laid-out card, which is the
//     order that defect needs.
//   * TARGETS (QA-26). Above the 640px phone tier every link box is at least
//     24 x 24 CSS px; in the tier every box is at least 44 x 44, boxes beside
//     each other in a row abut with no gap, and each format label sits above its
//     numbers. Both grow with text size (rem), so the floors are checked at every
//     scale.
//   * FOCUS RING (design-spec.md, decisions.md D3). After a REAL Tab keypress,
//     in light and dark themes at a desktop and a phone width, the focused list
//     link shows the house ring (3px solid `--sr-accent`) 1px off its box, no
//     halo (`box-shadow: none`) and the `--sr-accent-bg` fill. A real Tab
//     because WebKit does not match `:focus-visible` after a scripted `focus()`
//     (testing.md, v1.0.47); the reading waits for the fill's transition to end.
//     It exists because the override first shipped beside its base rules, where
//     it TIED the global `[tabindex]:focus-visible` ring on specificity and lost
//     on source order: the focused number kept the 3px offset and the 6px halo.
//
// THE WHOLE CARD (code-search-and-a11y-polish, item 2). The first version of
// this harness checked only what the list ADDED to its section and printed the
// rest as an allowed residual, all of it clipped by the card's
// `overflow: hidden` so the page never scrolled: the "Media of {name}" header
// ran up to 1,595px past the card for the 120-character name, the tiles'
// nowrap links up to 49.5px past a 137px tile at 641px / 200%, each sighting
// row's checklist link 109px past the card at 320px / 200% with the place name
// squeezed to a 0px box, and the collapsed header's date range 28px past the
// card's LEFT edge. Those are now checked as passes, in light at every width
// and scale and in dark at 320, 390, 641 and 1024px at 100% and 200%:
//
//   * CARD. Every text node's visible INK, and every link, button, input and
//     icon box, sits inside the card's padding box, read CLIP-AWARE: ink that an
//     element inside the card clips on purpose (an ellipsized place, the
//     ellipsized name in the header, the map's own frame) counts only where it
//     shows, and the card's own clip is never honoured, since it is what hid
//     every defect above. The card does not scroll sideways, the media section
//     carries no sideways scroll even with the list hidden, and neither does
//     the page.
//   * TILE. Inside each gallery tile, ink and boxes stay inside the tile, and no
//     tile overlaps another (a grid row sized from a stale line count reads as
//     an overlap). Above the phone tier at 100% text the gallery keeps its three
//     columns, so desktop is unchanged.
//   * PLACE. Every sighting row shows at least 20px of its place name's ink,
//     and the date, the place and the checklist link never overlap. Where the
//     link has a line of its own, it is at least 44px tall in the phone tier and
//     32px above it.
//
// The card is found STRUCTURALLY (the disclosure button's parent, a sighting
// row by its 36px indent, its place by the `title` HotspotLink sets), never by a
// class this build added, so the same harness run against a pre-fix dist reads
// the same nodes and goes red there.
//
// THE CSV IS THE SCENARIO. Winky has 140 photos, 3 recordings and 2 videos, so
// the photo row runs to three-digit numbers over many wrapped lines; the long-
// named Mallard has 30 photos. The sightings carry coordinates and a region,
// so the card draws its map block ("Where {name} has been seen") and both
// HotspotLink branches: a long hotspot name, a short one and a personal
// location. Nothing here is real data.
//
// HERMETIC: the bot-check probe answers "gated", so no player is mounted, the
// region's hotspot list is answered by the stub, and every request to a host
// other than the loopback server is aborted, so the run never reaches Macaulay
// Library, eBird or any tile host (the card map draws no tiles).
//
//   node verify-named-bird-media-links.mjs <distDir>                  # expect all green
//   node verify-named-bird-media-links.mjs <distDir> --expect-broken  # expect red
//   node verify-named-bird-media-links.mjs <preFixDist>               # exits 1
//
// `--expect-broken` runs two mutated legs per engine on the fixed build, each
// of which must go red in its own kinds:
//
//   * LIST. Every list is forced onto one line, every link loses its size
//     floor, and the list's own focus rule is DELETED from the live stylesheet
//     through the CSSOM, so the global ring is what a focused number gets (the
//     shipped defect, without retyping its values). At 320px the one-line
//     photo row overflows by thousands of pixels and the boxes shrink to about
//     the width of their digits, far past anything a font difference can
//     produce, so the leg discriminates on any machine (testing.md, v1.0.30).
//     It must turn the reflow, target AND focus checks red.
//   * CARD. The card fix is reversed in place: the header text may not break,
//     the sighting line may not wrap and its link takes no line of its own,
//     the tile meta row is nowrap in three columns, and the date range is
//     nowrap. The 120-character name alone then runs over a thousand pixels
//     past the card whatever the font, and at 320px / 200% the place is
//     clipped to nothing. It must turn the card, tile AND place checks red.
//
// The real pre-fix build goes red too, in the default mode, in the card, tile
// and place kinds; pipeline/code-search-and-a11y-polish/pr-description.md has
// the readings.
//
// Exit code is 0 when the run matched the mode, 1 otherwise.

import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { serveDist } from './serveDist.mjs'
import { requirePlaywright } from './playwright.mjs'
import { dismissWelcome } from './dismissWelcome.mjs'

const { chromium, webkit } = requirePlaywright()

// The first argument that is not a flag, so `--expect-broken` alone is never read as the dist.
const DIST = resolve(process.argv.slice(2).find(a => !a.startsWith('--')) ?? process.env.SR_VERIFY_DIST
  ?? fileURLToPath(new URL('../../../frontend/dist/', import.meta.url)))
const MODE = process.argv.includes('--expect-broken') ? 'broken' : 'fixed'

/** A band from 320px up, both sides of the 640px tier edge, to wide desktop. */
const WIDTHS = [320, 360, 390, 430, 480, 560, 640, 641, 720, 820, 1024, 1280]
/** The focus-ring check: one desktop and one phone width. */
const FOCUS_WIDTHS = [1024, 390]
/** Changed in place on a laid-out card, up then down. */
const SCALES = [1, 2, 1.5, 1.25]
/** The card is also read in the dark theme at the brief's configurations. */
const DARK_WIDTHS = new Set([320, 390, 641, 1024])
const DARK_SCALES = new Set([1, 2])

const LONG_NAME = 'Pondsidegreenheadwhocircleseveryautumnwiththesamescarredleftwingandneverleavesthenorthshoreoftheoldmillpondatdusk'
  .padEnd(120, 'x')
if (LONG_NAME.length !== 120 || /\s/.test(LONG_NAME)) throw new Error('fixture: the long name must be 120 characters with no spaces')

const BIRDS = [
  { name: 'Winky', species: "Anna's Hummingbird", sci: 'Calypte anna', photos: 140, audio: 3, video: 2, sightings: 3 },
  { name: LONG_NAME, species: 'Mallard', sci: 'Anas platyrhynchos', photos: 30, audio: 0, video: 0, sightings: 2 },
]

/** Public hotspots in the fixture's region; L100001 (Back Garden) is a personal location. */
const HOTSPOTS = ['L100002', 'L100003', 'L100004']

const EBIRD_CSV = [
  'Submission ID,Common Name,Scientific Name,State/Province,Date,Location,Count,Breeding Code,Species Comments,ML Catalog Numbers,Location ID,Latitude,Longitude',
  "S910000001,Anna's Hummingbird,Calypte anna,US-CA,2025-03-02,Back Garden,1,,[name:Winky] at the feeder,,L100001,37.8044,-122.2712",
  "S910000002,Anna's Hummingbird,Calypte anna,US-CA,2026-02-10,Lake Merritt--Rotary Nature Center,1,,[name:Winky] still here,,L100004,37.8085,-122.2565",
  "S910000005,Anna's Hummingbird,Calypte anna,US-CA,2025-11-03,Arrowhead Marsh--Martin Luther King Jr. Regional Shoreline,1,,[name:Winky] by the marsh,,L100003,37.7489,-122.2108",
  `S910000003,Mallard,Anas platyrhynchos,US-CA,2025-10-18,Mill Pond,2,,[name:${LONG_NAME}] scarred wing,,L100002,37.9001,-122.3011`,
  `S910000004,Mallard,Anas platyrhynchos,US-CA,2026-01-05,Mill Pond,1,,[name:${LONG_NAME}] again,,L100002,37.9001,-122.3011`,
].join('\n')

function mlRows() {
  const rows = ['ML Catalog Number,Common Name,Scientific Name,Format,Date,Caption,eBird Checklist ID']
  let id = 500000
  BIRDS.forEach((b, bi) => {
    const add = (format, n) => {
      for (let i = 0; i < n; i++) {
        id += 1
        // Dates spread back from 2026 so the gallery's newest-first order is real.
        const day = String((i % 28) + 1).padStart(2, '0')
        const month = String(12 - (Math.floor(i / 28) % 12)).padStart(2, '0')
        const year = 2026 - Math.floor(i / 336)
        rows.push(`ML${id},${b.species},${b.sci},${format},${year}-${month}-${day},[name:${b.name}],S91000000${bi * 2 + 1}`)
      }
    }
    add('Photo', b.photos)
    add('Audio', b.audio)
    add('Video', b.video)
  })
  return rows.join('\n')
}
const ML_CSV = mlRows()

const FILES_STATUS = {
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T00:00:00Z' },
  ml: { filename: 'ML__2026-06-01_123456.csv', uploadedAt: '2026-06-01T00:00:00Z' },
}

function stubBackend(p, _req, res) {
  const json = (body) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)) }
  if (p === '/settings/files') { json(FILES_STATUS); return true }
  if (p === '/settings/files/ebird') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(EBIRD_CSV); return true }
  if (p === '/settings/files/ml') { res.writeHead(200, { 'content-type': 'text/csv' }); res.end(ML_CSV); return true }
  if (p === '/settings/keys') { json({ ebird: null, openweather: null }); return true }
  // The bot check "up": no player mounts, so nothing reaches for macaulaylibrary.org.
  if (p === '/media/embed-status') { json({ gated: true }); return true }
  // The fixture's one region: which of its locations are public hotspots.
  if (p === '/map/hotspot-region') { json(HOTSPOTS); return true }
  if (p.startsWith('/settings/') || p.startsWith('/weather') || p.startsWith('/tide') || p.startsWith('/media')
      || p.startsWith('/map') || p.startsWith('/taxonomy') || p.startsWith('/version') || p.startsWith('/nominatim')) {
    res.writeHead(404); res.end('not found'); return true
  }
  return false
}

const LIST_BROKEN_CSS = `
  .sr-mli-list { flex-wrap: nowrap !important; }
  .sr-mli-lead { overflow-wrap: normal !important; }
  .sr-mli-link { min-width: 0 !important; height: auto !important; padding: 0 !important; }
`
/** The card fix reversed in place: today's shapes, through the new hooks. */
const CARD_BROKEN_CSS = `
  .sr-nb-head-text { overflow-wrap: normal !important; }
  .sr-nbs-line { flex-wrap: nowrap !important; }
  .sr-nbs-place { flex: 0 1 auto !important; overflow: hidden !important; }
  .sr-nbs-sep--link { display: inline !important; }
  .sr-nbs-link { flex-basis: auto !important; min-height: 0 !important; }
  .sr-nbm-pair, .sr-nbm-ml { white-space: nowrap !important; }
  .sr-nb-media .sr-media-grid, .sr-nb-media .sr-media-disabled-list { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
  .sr-nbh-dates { white-space: nowrap !important; }
`
/** Which check kinds each mutated leg must turn red. */
const LEG_KINDS = { list: ['reflow', 'target', 'focus'], card: ['card', 'tile', 'place'] }

const failures = []
let failedKinds = new Set()
function check(name, ok, detail, kind) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) { failures.push(name); if (kind) failedKinds.add(kind) }
}

/** Read the list in one configuration, in the page. */
const READ = () => {
  const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize)
  const lists = [...document.querySelectorAll('.sr-ml-items')].filter(el => el.getClientRects().length > 0)
  const base = { rootPx, lists: lists.length, innerWidth: window.innerWidth }
  if (lists.length !== 1) return base
  const root = lists[0]
  const section = root.parentElement
  const cs = getComputedStyle(section)
  const sr = section.getBoundingClientRect()
  const left = sr.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft)
  const right = sr.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight)
  const over = r => Math.max(left - r.left, r.right - right)

  let inkOver = -Infinity
  let inkText = ''
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !node.nodeValue.trim()) continue
    const range = document.createRange()
    range.selectNodeContents(node)
    for (const r of range.getClientRects()) {
      if (r.width === 0 && r.height === 0) continue
      const o = over(r)
      if (o > inkOver) { inkOver = o; inkText = node.nodeValue.trim().slice(0, 24) }
    }
  }

  const links = [...root.querySelectorAll('a')]
  let boxOver = -Infinity
  let minW = Infinity
  let minH = Infinity
  let maxGap = 0
  let fragments = 0
  let stale = 0
  let labelAbove = true
  const rootBottom = root.getBoundingClientRect().bottom
  for (const ul of root.querySelectorAll('ul')) {
    const ulRect = ul.getBoundingClientRect()
    const rects = [...ul.querySelectorAll('a')].map(a => {
      const rs = a.getClientRects()
      fragments += rs.length
      return rs[0]
    })
    rects.forEach((r, i) => {
      boxOver = Math.max(boxOver, over(r))
      minW = Math.min(minW, r.width)
      minH = Math.min(minH, r.height)
      if (r.bottom > ulRect.bottom + 0.5 || r.bottom > rootBottom + 0.5) stale += 1
      const next = rects[i + 1]
      if (next && Math.abs(next.top - r.top) < 0.5) maxGap = Math.max(maxGap, Math.abs(next.left - r.right))
    })
    const label = document.getElementById(ul.getAttribute('aria-labelledby') || '')
    if (!label || label.getBoundingClientRect().bottom > rects[0].top + 0.5) labelAbove = false
  }

  const nameNode = root.querySelector('.sr-mli-name')
  const nameRange = document.createRange()
  nameRange.selectNodeContents(nameNode)
  const nameLines = new Set([...nameRange.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size

  return {
    ...base,
    phone: window.matchMedia('(max-width: 640px)').matches,
    links: links.length,
    fragments,
    inkOver: +inkOver.toFixed(2),
    inkText,
    boxOver: +boxOver.toFixed(2),
    minW: +minW.toFixed(2),
    minH: +minH.toFixed(2),
    maxGap: +maxGap.toFixed(2),
    stale,
    labelAbove,
    nameLines,
    pageScroll: document.documentElement.scrollWidth - window.innerWidth,
    listScroll: root.scrollWidth - root.clientWidth,
    ...(() => {
      // What the LIST adds to the section's horizontal scroll: the section with
      // the list, then without it. Taken last, after every other reading, so the
      // relayout cannot hide a stale wrap from the checks above. The section's
      // scroll WITHOUT the list is the card's own content and is a check of its
      // own since code-search-and-a11y-polish (it was printed as allowed).
      const withList = section.scrollWidth - section.clientWidth
      root.style.display = 'none'
      const withoutList = section.scrollWidth - section.clientWidth
      root.style.display = ''
      return { sectionScroll: withList, sectionScrollWithout: withoutList }
    })(),
  }
}

/**
 * Read the open card in one configuration, in the page (code-search-and-a11y-polish).
 *
 * Everything is located structurally so a pre-fix build is read the same way.
 * "Visible" means clip-aware: a rect is intersected with the padding box of
 * every clipping ancestor BELOW the boundary it is measured against (the card,
 * or a tile), never with the boundary's own clip.
 */
const READ_CARD = () => {
  const lists = [...document.querySelectorAll('.sr-ml-items')].filter(el => el.getClientRects().length > 0)
  if (lists.length !== 1) return { ok: false, why: `${lists.length} visible lists` }
  let card = lists[0]
  while (card && !(card.firstElementChild && card.firstElementChild.matches('button[aria-expanded]'))) card = card.parentElement
  if (!card) return { ok: false, why: 'no card around the list' }
  const section = lists[0].parentElement

  const paddingBox = el => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return {
      left: r.left + parseFloat(s.borderLeftWidth), right: r.right - parseFloat(s.borderRightWidth),
      top: r.top + parseFloat(s.borderTopWidth), bottom: r.bottom - parseFloat(s.borderBottomWidth),
    }
  }
  const contentWidthEm = el => {
    const s = getComputedStyle(el)
    return (el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight)) / parseFloat(s.fontSize)
  }
  /** `r` as the user sees it inside `stop`: intersected with every clipping ancestor of `el` below `stop`. */
  const visible = (r, el, stop) => {
    let x1 = r.left, x2 = r.right, y1 = r.top, y2 = r.bottom
    for (let a = el; a && a !== stop; a = a.parentElement) {
      const s = getComputedStyle(a)
      if (s.overflowX === 'visible' && s.overflowY === 'visible') continue
      const b = paddingBox(a)
      if (s.overflowX !== 'visible') { x1 = Math.max(x1, b.left); x2 = Math.min(x2, b.right) }
      if (s.overflowY !== 'visible') { y1 = Math.max(y1, b.top); y2 = Math.min(y2, b.bottom) }
    }
    return x2 - x1 > 0.5 && y2 - y1 > 0.5 ? { left: x1, right: x2, top: y1, bottom: y2 } : null
  }
  const hidden = el => !!el.closest('.sr-only') || getComputedStyle(el).visibility === 'hidden'
  const inkRects = (node, stop) => {
    const range = document.createRange()
    range.selectNodeContents(node)
    return [...range.getClientRects()].filter(r => r.width > 0 || r.height > 0)
      .map(r => visible(r, node.parentElement, stop)).filter(Boolean)
  }

  const cardBox = paddingBox(card)
  const tiles = [...section.querySelectorAll('.sr-media-item')].filter(t => t.getClientRects().length > 0)
  const tileOf = el => tiles.find(t => t.contains(el)) ?? null

  let cardOver = -Infinity, cardWhat = ''
  let tileOver = -Infinity, tileWhat = ''
  const note = (o, what, which) => {
    if (which === 'card' && o > cardOver) { cardOver = o; cardWhat = what }
    if (which === 'tile' && o > tileOver) { tileOver = o; tileWhat = what }
  }
  const overX = (v, box) => Math.max(box.left - v.left, v.right - box.right)

  const walker = document.createTreeWalker(card, NodeFilter.SHOW_TEXT)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.nodeValue || !node.nodeValue.trim() || hidden(node.parentElement)) continue
    const what = `"${node.nodeValue.trim().slice(0, 28)}"`
    for (const v of inkRects(node, card)) note(overX(v, cardBox), what, 'card')
    const tile = tileOf(node.parentElement)
    if (tile) {
      const tb = paddingBox(tile)
      for (const v of inkRects(node, tile)) note(overX(v, tb), what, 'tile')
    }
  }
  for (const el of card.querySelectorAll('a, button, input, select, svg')) {
    if (el.getClientRects().length === 0 || hidden(el)) continue
    const what = `<${el.tagName.toLowerCase()}> ${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28)}`
    const r = el.getBoundingClientRect()
    if (r.width === 0 && r.height === 0) continue
    const v = visible(r, el.parentElement, card)
    if (v) note(overX(v, cardBox), what, 'card')
    const tile = tileOf(el)
    if (tile) {
      const vt = visible(r, el.parentElement, tile)
      if (vt) note(overX(vt, paddingBox(tile)), what, 'tile')
    }
  }

  // Tiles: none overlaps another; the gallery's column count.
  let tileOverlap = 0
  const rects = tiles.map(t => t.getBoundingClientRect())
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j]
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
      const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (w > 0.5 && h > 0.5) tileOverlap = Math.max(tileOverlap, Math.min(w, h))
    }
  }
  const grid = section.querySelector('.sr-media-grid, .sr-media-disabled-list')
  const columns = grid ? getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length : 0

  // Sighting rows: indented 36px, the place carries a title.
  const phone = window.matchMedia('(max-width: 640px)').matches
  const rows = [...card.querySelectorAll('div')].filter(d => d.style.paddingLeft === '36px')
  let placeMin = Infinity, placeWhat = '', rowOverlap = 0, stackedMinH = Infinity, stacked = 0
  const inkIn = el => {
    const out = []
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT)
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.nodeValue || !n.nodeValue.trim()) continue
      for (const v of inkRects(n, card)) {
        const x1 = Math.max(v.left, cardBox.left), x2 = Math.min(v.right, cardBox.right)
        if (x2 - x1 > 0.5) out.push({ ...v, left: x1, right: x2 })
      }
    }
    return out
  }
  for (const row of rows) {
    const line = row.firstElementChild
    const date = line && line.firstElementChild
    const place = line && line.querySelector('[title]')
    const link = line && line.querySelector('a[href^="https://ebird.org/checklist/"]')
    if (!date || !place || !link) { placeMin = 0; placeWhat = 'a row without date, place or link'; continue }
    const parts = [inkIn(date), inkIn(place), inkIn(link)]
    const placeInk = parts[1].reduce((s, r) => s + (r.right - r.left), 0)
    if (placeInk < placeMin) { placeMin = placeInk; placeWhat = place.getAttribute('title').slice(0, 28) }
    for (let i = 0; i < 3; i++) {
      for (let j = i + 1; j < 3; j++) {
        for (const a of parts[i]) {
          for (const b of parts[j]) {
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
            if (w > 0.5 && h > 1) rowOverlap = Math.max(rowOverlap, w)
          }
        }
      }
    }
    const dr = date.getBoundingClientRect()
    const lr = link.getBoundingClientRect()
    if (lr.top >= dr.bottom - 1) { stacked += 1; stackedMinH = Math.min(stackedMinH, lr.height) }
  }

  return {
    ok: true,
    // Both name-bearing section headers are on screen, so the 120-character
    // name is measured in each (the map block draws only with coordinates).
    heads: card.textContent.includes('Media of') && card.textContent.includes('has been seen'),
    phone,
    cardOver: +cardOver.toFixed(2), cardWhat,
    tileOver: tiles.length ? +tileOver.toFixed(2) : 0, tileWhat,
    tiles: tiles.length, tileOverlap: +tileOverlap.toFixed(2), columns,
    rows: rows.length, placeMin: +placeMin.toFixed(2), placeWhat, rowOverlap: +rowOverlap.toFixed(2),
    stacked, stackedMinH: +stackedMinH.toFixed(2),
    cardScroll: card.scrollWidth - card.clientWidth,
    pageScroll: document.documentElement.scrollWidth - window.innerWidth,
    sectionEm: +contentWidthEm(section).toFixed(2),
    rowEm: rows.length ? +Math.min(...rows.map(contentWidthEm)).toFixed(2) : 0,
  }
}

/** The focused element's ring, fill and the tokens they must resolve to, in the page. */
const FOCUS_READ = () => {
  const el = document.activeElement
  const probe = document.createElement('span')
  document.body.appendChild(probe)
  probe.style.color = 'var(--sr-accent)'
  const accent = getComputedStyle(probe).color
  probe.style.color = 'var(--sr-accent-bg)'
  const accentBg = getComputedStyle(probe).color
  probe.remove()
  const cs = getComputedStyle(el)
  return {
    inList: !!el.closest?.('.sr-ml-items'),
    text: el.textContent,
    visible: el.matches(':focus-visible'),
    outlineOffset: cs.outlineOffset,
    outlineWidth: cs.outlineWidth,
    outlineStyle: cs.outlineStyle,
    outlineColor: cs.outlineColor,
    boxShadow: cs.boxShadow,
    background: cs.backgroundColor,
    accent,
    accentBg,
  }
}

const settle = page => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))))
const setTheme = (page, t) => page.evaluate(theme => { document.documentElement.dataset.theme = theme }, t)

/** Container widths in em, the smallest seen at 100% text above the phone tier (the thresholds' evidence). */
const containerEm = { section: Infinity, row: Infinity }

async function run(browserType, label, base, leg) {
  const browser = await browserType.launch()
  const ctx = await browser.newContext({ viewport: { width: WIDTHS[0], height: 900 }, deviceScaleFactor: 1 })
  // Hermetic: anything not served by the loopback server is aborted.
  const origin = new URL(base).origin
  await ctx.route('**/*', route => (route.request().url().startsWith(origin) ? route.continue() : route.abort()))
  const page = await ctx.newPage()
  page.setDefaultTimeout(20000)
  await page.goto(base)

  const welcome = page.getByRole('dialog', { name: 'Welcome to SnowRaven' })
  if (await welcome.count()) await dismissWelcome(welcome)

  // At 320px the nav is the bottom bar and Named Birds sits behind More, whose
  // accessible name is "More destinations" (verify-named-birds-header.mjs).
  const direct = page.getByRole('button', { name: 'Named Birds', exact: true })
  if (await direct.count()) {
    await direct.first().click()
  } else {
    await page.getByRole('button', { name: /^More\b/ }).first().click()
    await page.getByRole('button', { name: 'Named Birds', exact: true }).first().click()
  }
  if (leg === 'list') {
    await page.addStyleTag({ content: LIST_BROKEN_CSS })
    const removed = await page.evaluate(() => {
      let n = 0
      for (const sheet of document.styleSheets) {
        let rules
        try { rules = sheet.cssRules } catch { continue }
        for (let i = rules.length - 1; i >= 0; i--) {
          if (rules[i].selectorText === '.sr-mli-link:focus-visible') { sheet.deleteRule(i); n += 1 }
        }
      }
      return n
    })
    // A mutation that removed nothing would leave the focus checks green for
    // the wrong reason, so it is a harness error, not a reading.
    if (removed === 0) throw new Error('list leg: no .sr-mli-link:focus-visible rule found to remove')
  }
  if (leg === 'card') await page.addStyleTag({ content: CARD_BROKEN_CSS })

  const expected = { measured: 0, cards: 0 }
  for (const bird of BIRDS) {
    const total = bird.photos + bird.audio + bird.video
    const short = bird.name.length > 20 ? `${bird.name.slice(0, 12)}...(${bird.name.length})` : bird.name
    // The card header is the visible disclosure button carrying the bird's name.
    const header = page.locator('button[aria-expanded]:visible', { hasText: bird.name.slice(0, 40) }).first()
    await header.waitFor()
    if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click()
    // Wait for the list itself with every link, not for the section (CLAUDE.md,
    // v1.0.25), and for the hotspot links the region answer turns the place
    // names into, so no reading is taken over the plain-text interim.
    await page.waitForFunction(n => {
      const l = [...document.querySelectorAll('.sr-ml-items')].find(el => el.getClientRects().length > 0)
      return !!l && l.querySelectorAll('a').length === n
    }, total)
    await page.waitForFunction(rows => {
      const l = [...document.querySelectorAll('.sr-ml-items')].find(el => el.getClientRects().length > 0)
      let card = l
      while (card && !(card.firstElementChild && card.firstElementChild.matches('button[aria-expanded]'))) card = card.parentElement
      if (!card) return false
      const indented = [...card.querySelectorAll('div')].filter(d => d.style.paddingLeft === '36px')
      return indented.length === rows.n
        && indented.filter(d => d.querySelector('a[href^="https://ebird.org/hotspot/"]')).length === rows.hot
    }, { n: bird.sightings, hot: 2 })   // Winky: two hotspots and Back Garden; Mallard: Mill Pond twice

    const agg = { configs: 0, inkWorst: -Infinity, boxWorst: -Infinity, minDesk: Infinity, minPhone: Infinity, maxGap: 0 }
    const cagg = { configs: 0, cardWorst: -Infinity, tileWorst: -Infinity, placeMin: Infinity, stacked: 0 }
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 })
      for (const scale of SCALES) {
        await page.evaluate(s => document.documentElement.style.setProperty('--sr-text-scale', String(s)), scale)
        await settle(page)
        const r = await page.evaluate(READ)
        const at = `${label} [${short}] ${width}px ${Math.round(scale * 100)}%`
        expected.measured += 1

        if (Math.abs(r.rootPx - 16 * scale) >= 0.6) check(`${at}: the text scale applied`, false, `root=${r.rootPx}px`)
        if (r.lists !== 1 || r.links !== total || r.fragments !== total) {
          check(`${at}: exactly one visible list with every link, one box each`, false,
            `lists=${r.lists} links=${r.links} boxes=${r.fragments} expected=${total}`)
          continue
        }
        agg.configs += 1
        agg.inkWorst = Math.max(agg.inkWorst, r.inkOver)
        agg.boxWorst = Math.max(agg.boxWorst, r.boxOver)
        if (r.inkOver > 0.5) check(`${at}: no text ink outside the section`, false, `${r.inkOver}px past it ("${r.inkText}")`, 'reflow')
        if (r.boxOver > 0.5) check(`${at}: no link box outside the section`, false, `${r.boxOver}px past it`, 'reflow')
        if (r.pageScroll > 0) check(`${at}: no page horizontal scroll`, false, `${r.pageScroll}px`, 'reflow')
        if (r.listScroll > 0) check(`${at}: no horizontal scroll in the list`, false, `${r.listScroll}px`, 'reflow')
        if (r.sectionScroll > r.sectionScrollWithout) {
          check(`${at}: the list adds no horizontal scroll to the section`, false,
            `${r.sectionScroll}px with it, ${r.sectionScrollWithout}px without`, 'reflow')
        }
        if (r.sectionScrollWithout > 0) {
          check(`${at}: the media section carries no horizontal scroll of its own`, false, `${r.sectionScrollWithout}px`, 'card')
        }
        if (r.stale > 0) check(`${at}: every link sits inside its list (no stale wrap)`, false, `${r.stale} outside`, 'reflow')
        if (width === 320 && scale === 1 && bird.name === LONG_NAME && r.nameLines < 2) {
          check(`${at}: the 120-character name wraps in the lead`, false, `${r.nameLines} line(s)`, 'reflow')
        }

        const tierOk = r.phone === (width <= 640)
        if (!tierOk) check(`${at}: the phone tier matches the width`, false, `phone=${r.phone}`)
        if (r.phone) {
          agg.minPhone = Math.min(agg.minPhone, r.minW, r.minH)
          agg.maxGap = Math.max(agg.maxGap, r.maxGap)
          if (r.minW < 44 - 0.01 || r.minH < 44 - 0.01) check(`${at}: every target is at least 44 x 44`, false, `smallest ${r.minW} x ${r.minH}`, 'target')
          if (r.maxGap > 0.5) check(`${at}: targets in a row abut`, false, `largest gap ${r.maxGap}px`, 'target')
          if (!r.labelAbove) check(`${at}: each format label sits above its numbers`, false, '', 'target')
        } else {
          agg.minDesk = Math.min(agg.minDesk, r.minW, r.minH)
          if (r.minW < 24 - 0.01 || r.minH < 24 - 0.01) check(`${at}: every target is at least 24 x 24`, false, `smallest ${r.minW} x ${r.minH}`, 'target')
        }

        // ── The whole card, in light, then in dark at the brief's configurations.
        const themes = DARK_WIDTHS.has(width) && DARK_SCALES.has(scale) ? ['light', 'dark'] : ['light']
        for (const theme of themes) {
          if (theme === 'dark') { await setTheme(page, 'dark'); await settle(page) }
          const c = await page.evaluate(READ_CARD)
          if (theme === 'dark') { await setTheme(page, 'light'); await settle(page) }
          const cat = `${at} ${theme}`
          expected.cards += 1
          if (!c.ok) { check(`${cat}: the open card was found`, false, c.why); continue }
          if (c.rows !== bird.sightings || c.tiles === 0 || !c.heads) {
            check(`${cat}: every sighting row, the gallery and both section headers were found`, false,
              `rows=${c.rows} tiles=${c.tiles} headers=${c.heads}`)
            continue
          }
          cagg.configs += 1
          cagg.cardWorst = Math.max(cagg.cardWorst, c.cardOver)
          cagg.tileWorst = Math.max(cagg.tileWorst, c.tileOver)
          cagg.placeMin = Math.min(cagg.placeMin, c.placeMin)
          cagg.stacked += c.stacked
          if (scale === 1 && width > 640) {
            containerEm.section = Math.min(containerEm.section, c.sectionEm)
            containerEm.row = Math.min(containerEm.row, c.rowEm)
          }
          if (c.cardOver > 0.5) check(`${cat}: nothing shows outside the card`, false, `${c.cardOver}px past it (${c.cardWhat})`, 'card')
          if (c.cardScroll > 0) check(`${cat}: the card does not scroll sideways`, false, `${c.cardScroll}px`, 'card')
          if (c.pageScroll > 0) check(`${cat}: no page horizontal scroll`, false, `${c.pageScroll}px`, 'card')
          if (c.tileOver > 0.5) check(`${cat}: nothing shows outside its tile`, false, `${c.tileOver}px past it (${c.tileWhat})`, 'tile')
          if (c.tileOverlap > 0.5) check(`${cat}: no tile overlaps another (no stale row)`, false, `${c.tileOverlap}px`, 'tile')
          if (scale === 1 && width > 640 && c.columns !== 3) {
            check(`${cat}: desktop at 100% text keeps three gallery columns`, false, `${c.columns} columns`, 'layout')
          }
          if (c.placeMin < 20) check(`${cat}: every sighting row shows its place name`, false, `${c.placeMin}px of "${c.placeWhat}"`, 'place')
          if (c.rowOverlap > 0.5) check(`${cat}: date, place and link never overlap`, false, `${c.rowOverlap}px`, 'place')
          const floor = c.phone ? 44 : 32
          if (c.stacked > 0 && c.stackedMinH < floor - 0.01) {
            check(`${cat}: a checklist link on its own line is at least ${floor}px tall`, false, `${c.stackedMinH}px`, 'target')
          }
        }
      }
    }
    // Printed on every run, so a green run still reports its numbers.
    check(`${label} [${short}]: ${agg.configs} of ${WIDTHS.length * SCALES.length} configurations measured with every link`,
      agg.configs === WIDTHS.length * SCALES.length,
      `worst ink ${agg.inkWorst}px, worst box ${agg.boxWorst}px (<= 0 is inside), smallest target ${agg.minDesk}px desktop / ${agg.minPhone}px phone, largest phone gap ${agg.maxGap}px`)
    const cardConfigs = WIDTHS.length * SCALES.length + [...DARK_WIDTHS].length * [...DARK_SCALES].length
    check(`${label} [${short}]: ${cagg.configs} of ${cardConfigs} card readings taken`,
      cagg.configs === cardConfigs,
      `worst card ${cagg.cardWorst}px, worst tile ${cagg.tileWorst}px (<= 0 is inside), least place ink ${cagg.placeMin}px, ${cagg.stacked} stacked row readings`)
    // Non-vacuity: some configuration must actually stack a row, or the
    // stacked-link checks above never ran.
    if (leg !== 'card') check(`${label} [${short}]: some configuration stacks a sighting row`, cagg.stacked > 0, `${cagg.stacked}`)
  }
  check(`${label}: the configuration count is what the sweep declares`,
    expected.measured === BIRDS.length * WIDTHS.length * SCALES.length, `measured=${expected.measured}`)

  // ── The focus ring, after a real Tab, in both themes at a desktop and a phone width.
  await page.evaluate(() => document.documentElement.style.setProperty('--sr-text-scale', '1'))
  let focusMeasured = 0
  for (const width of FOCUS_WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      await setTheme(page, theme)
      await settle(page)
      // Number 1 by script, then Tab to number 2: the keypress is what makes
      // `:focus-visible` match in WebKit.
      await page.evaluate(() => {
        const l = [...document.querySelectorAll('.sr-ml-items')].find(el => el.getClientRects().length > 0)
        l.querySelector('a').focus()
      })
      await page.keyboard.press('Tab')
      await page.waitForFunction(() => document.activeElement.getAnimations().every(a => a.playState !== 'running'))
      const f = await page.evaluate(FOCUS_READ)
      const at = `${label} focus ${width}px ${theme}`
      if (!f.inList || f.text !== '2' || !f.visible) {
        check(`${at}: Tab moved keyboard focus to list number 2`, false, `inList=${f.inList} text=${f.text} focus-visible=${f.visible}`)
        continue
      }
      focusMeasured += 1
      check(`${at}: the ring is 1px off the box with no halo`,
        f.outlineOffset === '1px' && f.boxShadow === 'none',
        `outline-offset ${f.outlineOffset}, box-shadow ${f.boxShadow}`, 'focus')
      check(`${at}: the ring is the house 3px solid accent and the box takes the accent fill`,
        f.outlineWidth === '3px' && f.outlineStyle === 'solid' && f.outlineColor === f.accent && f.background === f.accentBg,
        `outline ${f.outlineWidth} ${f.outlineStyle} ${f.outlineColor} (accent ${f.accent}), fill ${f.background} (accent-bg ${f.accentBg})`, 'focus')
    }
  }
  check(`${label}: every focus configuration was measured`, focusMeasured === FOCUS_WIDTHS.length * 2, `measured=${focusMeasured}`)

  await browser.close()
}

const { base, close } = await serveDist(DIST, { routes: stubBackend, fallback: 'index' })
console.log(`serving ${DIST} at ${base} (mode: expect-${MODE})`)
console.log(`${WIDTHS.length} widths x ${SCALES.length} in-app text scales x ${BIRDS.length} birds, per engine\n`)

const legOutcomes = []
try {
  for (const leg of MODE === 'fixed' ? ['fixed'] : ['list', 'card']) {
    failedKinds = new Set()
    if (MODE === 'broken') console.log(`── leg: ${leg} mutation\n`)
    await run(chromium, 'chromium', base, leg)
    console.log('')
    await run(webkit, 'webkit', base, leg)
    console.log('')
    if (leg !== 'fixed') legOutcomes.push({ leg, kinds: [...failedKinds] })
  }
} finally {
  await close()
}

if (Number.isFinite(containerEm.section)) {
  console.log(`containers at 100% text above 640px: media section >= ${containerEm.section}em (three columns down to 30em), sighting row >= ${containerEm.row}em (one line down to 22em)`)
}
if (MODE === 'fixed') {
  console.log(failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILURES (${failures.length}): ${failures.slice(0, 20).join(' | ')}`)
  process.exit(failures.length === 0 ? 0 : 1)
} else {
  let all = true
  for (const { leg, kinds } of legOutcomes) {
    const want = LEG_KINDS[leg]
    const ok = want.every(k => kinds.includes(k))
    all = all && ok
    console.log(ok
      ? `HARNESS DISCRIMINATES (${leg} leg): ${want.join(', ')} all went red`
      : `HARNESS IS VACUOUS (${leg} leg): failed kinds were [${kinds.join(', ')}], expected ${want.join(', ')}`)
  }
  process.exit(all ? 0 : 1)
}
