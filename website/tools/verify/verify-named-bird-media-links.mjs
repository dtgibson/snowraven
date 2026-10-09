// Real-engine verification of the named-bird item list (feature ml-media-links,
// QA-25 and QA-26): the compact list of numbered Macaulay Library links above a
// named bird's gallery on the Named Birds tab.
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
// THE SECTION'S OWN SCROLL IS NOT THIS LIST'S CLAIM. Measured with the list
// hidden, the section still scrolls by up to 730px for the 120-character name
// (its "Media of {name}" header does not wrap) and by 36px at 641px / 200% (the
// tiles' nowrap links), both shipped before this feature and outside it (FR-10).
// So the harness checks what the list ADDS, and prints the rest as allowed.
//
// THE CSV IS THE SCENARIO. Winky has 140 photos, 3 recordings and 2 videos, so
// the photo row runs to three-digit numbers over many wrapped lines; the long-
// named Mallard has 30 photos. Nothing here is real data.
//
// HERMETIC: the bot-check probe answers "gated", so no player is mounted, and
// every request to a host other than the loopback server is aborted, so the run
// never reaches Macaulay Library or any tile host.
//
//   node verify-named-bird-media-links.mjs <distDir>                  # expect all green
//   node verify-named-bird-media-links.mjs <distDir> --expect-broken  # expect red
//
// `--expect-broken` injects a mutation into the built page instead of needing a
// pre-fix dist (this is a new surface; there is none): every list is forced onto
// one line, every link loses its size floor, and the list's own focus rule is
// DELETED from the live stylesheet through the CSSOM, so the global ring is what
// a focused number gets (the shipped defect, without retyping its values). At
// 320px the one-line photo row overflows by thousands of pixels and the boxes
// shrink to about the width of their digits, far past anything a font
// difference can produce, so the leg discriminates on any machine (testing.md,
// v1.0.30). It passes only if the reflow, target AND focus checks all go red.
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

const LONG_NAME = 'Pondsidegreenheadwhocircleseveryautumnwiththesamescarredleftwingandneverleavesthenorthshoreoftheoldmillpondatdusk'
  .padEnd(120, 'x')
if (LONG_NAME.length !== 120 || /\s/.test(LONG_NAME)) throw new Error('fixture: the long name must be 120 characters with no spaces')

const BIRDS = [
  { name: 'Winky', species: "Anna's Hummingbird", sci: 'Calypte anna', photos: 140, audio: 3, video: 2 },
  { name: LONG_NAME, species: 'Mallard', sci: 'Anas platyrhynchos', photos: 30, audio: 0, video: 0 },
]

const EBIRD_CSV = [
  'Submission ID,Common Name,Scientific Name,Date,Location,Count,Breeding Code,Species Comments,ML Catalog Numbers,Location ID,Latitude,Longitude',
  "S910000001,Anna's Hummingbird,Calypte anna,2025-03-02,Back Garden,1,,[name:Winky] at the feeder,,L100001,,",
  "S910000002,Anna's Hummingbird,Calypte anna,2026-02-10,Back Garden,1,,[name:Winky] still here,,L100001,,",
  `S910000003,Mallard,Anas platyrhynchos,2025-10-18,Mill Pond,2,,[name:${LONG_NAME}] scarred wing,,L100002,,`,
  `S910000004,Mallard,Anas platyrhynchos,2026-01-05,Mill Pond,1,,[name:${LONG_NAME}] again,,L100002,,`,
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
  if (p.startsWith('/settings/') || p.startsWith('/weather') || p.startsWith('/tide') || p.startsWith('/media')
      || p.startsWith('/map') || p.startsWith('/taxonomy') || p.startsWith('/version') || p.startsWith('/nominatim')) {
    res.writeHead(404); res.end('not found'); return true
  }
  return false
}

const BROKEN_CSS = `
  .sr-mli-list { flex-wrap: nowrap !important; }
  .sr-mli-lead { overflow-wrap: normal !important; }
  .sr-mli-link { min-width: 0 !important; height: auto !important; padding: 0 !important; }
`

const failures = []
const failedKinds = new Set()
function check(name, ok, detail, kind) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`)
  if (!ok) { failures.push(name); if (kind) failedKinds.add(kind) }
}

/** Read one configuration, in the page. */
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
      // relayout cannot hide a stale wrap from the checks above.
      const withList = section.scrollWidth - section.clientWidth
      root.style.display = 'none'
      const withoutList = section.scrollWidth - section.clientWidth
      root.style.display = ''
      return { sectionScroll: withList, sectionScrollWithout: withoutList }
    })(),
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

async function run(browserType, label, base) {
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
  if (MODE === 'broken') {
    await page.addStyleTag({ content: BROKEN_CSS })
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
    if (removed === 0) throw new Error('broken leg: no .sr-mli-link:focus-visible rule found to remove')
  }

  const expected = { measured: 0 }
  for (const bird of BIRDS) {
    const total = bird.photos + bird.audio + bird.video
    const short = bird.name.length > 20 ? `${bird.name.slice(0, 12)}...(${bird.name.length})` : bird.name
    // The card header is the visible disclosure button carrying the bird's name.
    const header = page.locator('button[aria-expanded]:visible', { hasText: bird.name.slice(0, 40) }).first()
    await header.waitFor()
    if ((await header.getAttribute('aria-expanded')) !== 'true') await header.click()
    // Wait for the list itself with every link, not for the section (CLAUDE.md, v1.0.25).
    await page.waitForFunction(n => {
      const l = [...document.querySelectorAll('.sr-ml-items')].find(el => el.getClientRects().length > 0)
      return !!l && l.querySelectorAll('a').length === n
    }, total)

    const agg = { configs: 0, inkWorst: -Infinity, boxWorst: -Infinity, minDesk: Infinity, minPhone: Infinity, maxGap: 0, chrome: 0 }
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
        agg.chrome = Math.max(agg.chrome, r.sectionScrollWithout)
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
      }
    }
    // The section's OTHER content is shipped chrome this feature does not touch
    // (FR-10): the "Media of {name}" header does not wrap a long spaceless name,
    // and the tiles' nowrap links can pass a narrow three-column tile at 200%.
    // Its scroll is printed, never filtered away, and the check above holds the
    // list to adding none of it.
    if (agg.chrome > 0) {
      console.log(`      allowed: up to ${agg.chrome}px of section scroll from the header and tiles, identical with the list hidden [${short}]`)
    }
    // Printed on every run, so a green run still reports its numbers.
    check(`${label} [${short}]: ${agg.configs} of ${WIDTHS.length * SCALES.length} configurations measured with every link`,
      agg.configs === WIDTHS.length * SCALES.length,
      `worst ink ${agg.inkWorst}px, worst box ${agg.boxWorst}px (<= 0 is inside), smallest target ${agg.minDesk}px desktop / ${agg.minPhone}px phone, largest phone gap ${agg.maxGap}px`)
  }
  check(`${label}: the configuration count is what the sweep declares`,
    expected.measured === BIRDS.length * WIDTHS.length * SCALES.length, `measured=${expected.measured}`)

  // ── The focus ring, after a real Tab, in both themes at a desktop and a phone width.
  await page.evaluate(() => document.documentElement.style.setProperty('--sr-text-scale', '1'))
  let focusMeasured = 0
  for (const width of FOCUS_WIDTHS) {
    await page.setViewportSize({ width, height: 900 })
    for (const theme of ['light', 'dark']) {
      await page.evaluate(t => { document.documentElement.dataset.theme = t }, theme)
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

try {
  await run(chromium, 'chromium', base)
  console.log('')
  await run(webkit, 'webkit', base)
} finally {
  await close()
}

console.log('')
if (MODE === 'fixed') {
  console.log(failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILURES (${failures.length}): ${failures.slice(0, 20).join(' | ')}`)
  process.exit(failures.length === 0 ? 0 : 1)
} else {
  const all = ['reflow', 'target', 'focus'].every(k => failedKinds.has(k))
  console.log(all
    ? `HARNESS DISCRIMINATES: ${failures.length} check(s) failed on the mutated page, reflow, targets and focus ring all`
    : `HARNESS IS VACUOUS: failed kinds were [${[...failedKinds].join(', ')}], expected reflow, target and focus`)
  process.exit(all ? 0 : 1)
}
