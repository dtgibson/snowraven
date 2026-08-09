// Focus-obscured probe for the pinned Breeding Codes header (WCAG 2.2 SC 2.4.11).
//
// WHY THIS IS A STANDALONE SCRIPT AND NOT PART OF THE VITEST SUITE
// The claim being checked is geometric: "no focused control comes to rest under the
// pinned band." jsdom has no layout engine, so the repo's test suite is structurally
// incapable of evaluating it — a jsdom test can assert which selector carries the
// property, never where a focused button lands. Playwright IS present in this repo,
// but only under website/tools (the screenshot tooling), not as a frontend dev
// dependency; promoting it to one would mean a new dev dependency plus browser
// installs in CI, which is a toolchain change well outside this feature's brief.
// So: the vitest guard in frontend/src/lib/breedingCodePinnedCss.test.ts rejects the
// exact mistake that was made (a rule that reaches only the cells), and this script
// carries the geometric proof, run by hand and recorded in the PR description.
//
// RUN:  node pipeline/breeding-code-pinned-labels/focus-obscured-probe.mjs
// (resolves Playwright from website/tools; run `npm ci` there first if missing)
//
// WHAT IT DOES
// Reproduces the Unbounded + pinned shape — page as scrollport, sticky <th>,
// border-collapse: separate, and BirdName's real focusable markup (a
// <button class="sr-birdname-link"> plus the SpeciesLinks anchors inside each row
// header) — then reverse-tabs the species list. Shift+Tab is the case that aligns a
// target to the TOP of the scrollport, which is exactly where the band sits.
//
// RESULT (Chromium, 900x700):
//   A  cell-only scroll-margin      3 obscured @100%, 9 @200%   <- the shipped defect
//   B  root scroll-padding-top      0 obscured at both scales
//   C  descendant scroll-margin     0 obscured at both scales   <- what shipped
// C was chosen over B because B has to live on the root, and deferred tabs stay
// mounted when hidden, so it would leak a document-wide scroll-padding onto every
// other tab. See the PR description.
import pw from '../../website/tools/node_modules/playwright/index.js'
const { chromium } = pw

const BASE = `
  *{ box-sizing: border-box; }
  body { margin:0; font-family: system-ui; }
  table { border-collapse: separate; border-spacing: 0; width: max-content; }
  thead th { background:#fff; position: sticky; top: 0; z-index: 3;
             box-shadow: inset 0 -1px 0 #C4C4CE, 0 3px 6px -2px rgba(15,17,23,.12);
             font-size:.6875rem; padding:10px 12px; text-align:left; }
  tbody th { padding:9px 12px; text-align:left; font-weight:400; border-top:1px solid #eee; background:#fff; }
  tbody td { padding:6px 0; text-align:center; border-top:1px solid #eee; background:#fff; width:44px; }
  .sr-birdname-link { font: inherit; background:none; border:none; padding:0; cursor:pointer; color:#0a7; }
  .sr-birdname-sci { display:block; font-size:.71875rem; color:#777; }
`

const CELLS = '.sr-bc-matrix--pinned tbody th, .sr-bc-matrix--pinned tbody td'
const VARIANT = {
  'A cell-only scroll-margin (the defect)': `${CELLS} { scroll-margin-top: 3rem; }`,
  'B root scroll-padding-top':             `${CELLS} { scroll-margin-top: 3rem; } html { scroll-padding-top: 3rem; }`,
  'C descendant scroll-margin (shipped)':  `${CELLS},
      .sr-bc-matrix--pinned tbody th *, .sr-bc-matrix--pinned tbody td * { scroll-margin-top: 3rem; }`,
}

function page(css, scale) {
  const rows = Array.from({ length: 45 }, (_, i) => `
    <tr><th scope="row"><span class="sr-birdname"><span class="sr-birdname-row"
      ><button type="button" class="sr-birdname-link" tabindex="0">Species Number ${i + 1}</button
      ><a href="https://ebird.org/species/x${i}">e</a><a href="https://birdsoftheworld.org/x${i}">b</a
      ></span><span class="sr-birdname-sci">Genus species ${i + 1}</span></span></th>
    <td>1</td><td>2</td><td>3</td></tr>`).join('')
  return `<!doctype html><html><head><style>
    html { font-size: ${scale}%; }   /* stands in for --sr-text-scale */
    ${BASE}
    ${css}
  </style></head><body><div style="padding:40px 24px 24px;">
    <button id="top">before</button>
    <table class="sr-bc-matrix sr-bc-matrix--pinned">
      <thead><tr><th scope="col">Species</th><th scope="col">NB</th><th scope="col">FL</th><th scope="col">CF</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <button id="end">after</button>
  </div></body></html>`
}

const browser = await chromium.launch()
const rows = []
for (const [label, css] of Object.entries(VARIANT)) {
  for (const scale of [100, 200]) {
    const p = await browser.newPage({ viewport: { width: 900, height: 700 } })
    await p.setContent(page(css, scale))
    await p.locator('#end').focus()
    let obscured = 0, checked = 0, worst = null
    for (let i = 0; i < 60; i++) {
      await p.keyboard.press('Shift+Tab')
      const r = await p.evaluate(() => {
        const el = document.activeElement
        if (!el || !el.closest('tbody')) return null
        const f = el.getBoundingClientRect()
        const band = document.querySelector('thead th').getBoundingClientRect()
        const hit = document.elementFromPoint(
          Math.max(1, Math.min(innerWidth - 1, f.left + f.width / 2)),
          Math.max(1, Math.min(innerHeight - 1, f.top + f.height / 2)))
        return {
          top: Math.round(f.top), bottom: Math.round(f.bottom), bandBottom: Math.round(band.bottom),
          marginOnFocus: getComputedStyle(el).scrollMarginTop,
          coveredByHeader: !!(hit && hit.tagName === 'TH' && hit.closest('thead')),
        }
      })
      if (!r) continue
      checked++
      if (r.top < r.bandBottom) { obscured++; if (!worst || r.top < worst.top) worst = r }
    }
    rows.push({ label, scale, checked, obscured, worst })
    await p.close()
  }
}
await browser.close()

console.log('\nvariant                                 scale  stops  obscured  margin on focused el  worst case')
console.log('-'.repeat(118))
for (const r of rows) {
  const m = r.worst ? r.worst.marginOnFocus : '-'
  const w = r.worst
    ? `top=${r.worst.top} bottom=${r.worst.bottom} bandBottom=${r.worst.bandBottom} coveredByHeader=${r.worst.coveredByHeader}`
    : '(none obscured)'
  console.log(`${r.label.padEnd(38)} ${String(r.scale).padStart(4)}%  ${String(r.checked).padStart(4)}  ${String(r.obscured).padStart(8)}  ${String(m).padEnd(20)}  ${w}`)
}
const shippedBad = rows.filter(r => r.label.startsWith('C') && r.obscured > 0)
console.log(shippedBad.length ? '\nFAIL: the shipped variant left focus obscured.' : '\nOK: the shipped variant (C) obscured no focus stop at either scale.')
process.exit(shippedBad.length ? 1 : 0)
