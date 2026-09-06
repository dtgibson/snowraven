// Verifies the ENGINE PREMISE that v1.0.16 builds 1 and 2 rest on: that
// WebKit's default tab mode skips a plain <button>/<a href> and visits one
// carrying tabindex="0". Those builds' guard is a SOURCE test (the attribute is
// written); jsdom has no tab order, so the engine half has never been measured
// here -- it was carried from a prior roadmap measurement. Promoted from
// `pipeline/webkit-tab-order-app-wide/` by the playwright-gate build.
//
// A NULL RESULT IS A RESULT, AND IT IS NOT A FAILURE. If a WebKit build tabs to
// plain controls too (full keyboard access on by default), the premise is not
// measurable on this machine -- it is not refuted, and nothing about OUR code is
// wrong. Collapsing that to pass/fail would destroy the property DECISIONS.md
// credits this harness with, and would turn CI red on a vendor default.
//
// SO WHAT DOES THE EXIT CODE MEAN? It separates "the apparatus broke" from
// "the premise measured null":
//
//   0  the enumeration ran and a verdict was reached -- CONFIRMED, NULL, or
//      MIXED. All three are observations about WebKit, printed in full.
//   1  the apparatus is not trustworthy, so no reading from it is either.
//
// The apparatus checks are the repo's own guard-the-guard rule (`.claude/rules/
// testing.md`): sanity-check the probe against a configuration already known to
// be clean before trusting any flagged number. CHROMIUM IS THAT CONFIGURATION.
// It has full keyboard access on by default, so it must reach every one of the
// seven fixture controls; measured doing exactly that, 7/7, when this harness
// was promoted. If it does not, the fixture or the Tab walk is broken and the
// WebKit column is noise rather than evidence. Both engines must also reach the
// trailing <input>, because a text input is in the tab order in every mode of
// every engine -- so failing to reach it means the walk stalled, not that the
// engine skipped it.
//
//   node verify-webkit-tab-premise.mjs

import { requirePlaywright } from './playwright.mjs'

const { webkit, chromium } = requirePlaywright()

const PAGE = `<!doctype html><meta charset=utf-8><title>t</title><body>
<input id="in-first" aria-label="first">
<button id="btn-plain">plain button</button>
<button id="btn-tab" tabindex="0">tabindex button</button>
<a id="a-plain" href="https://example.com">plain link</a>
<a id="a-tab" href="https://example.com" tabindex="0">tabindex link</a>
<details><summary id="sum">summary</summary>body</details>
<input id="in-last" aria-label="last">
</body>`

const IDS = ['in-first', 'btn-plain', 'btn-tab', 'a-plain', 'a-tab', 'sum', 'in-last']

async function run(engine, name) {
  const b = await engine.launch()
  try {
    const p = await b.newPage()
    await p.setContent(PAGE)
    await p.evaluate(() => document.getElementById('in-first').focus())
    const seen = new Set(['in-first'])
    for (let i = 0; i < 24; i++) {
      await p.keyboard.press('Tab')
      const id = await p.evaluate(() => document.activeElement?.id || '<body>')
      if (id === 'in-first') break
      if (id !== '<body>') seen.add(id)
    }
    return { name, seen }
  } finally {
    await b.close()
  }
}

const results = []
try {
  for (const [eng, nm] of [[webkit, 'WebKit'], [chromium, 'Chromium']]) {
    results.push(await run(eng, nm))
  }
} catch (err) {
  console.log('\n== APPARATUS FAILURE ==')
  console.log(`the enumeration could not be run: ${err.message}`)
  process.exit(1)
}

for (const r of results) {
  console.log(`\n== ${r.name} ==`)
  for (const id of IDS) console.log(`  ${r.seen.has(id) ? 'REACHED ' : 'SKIPPED '} ${id}`)
}

const wk = results.find(r => r.name === 'WebKit').seen
const cr = results.find(r => r.name === 'Chromium').seen

// ── Apparatus, before any verdict is believed ────────────────────────────────
const apparatus = []
const crMissing = IDS.filter(id => !cr.has(id))
if (crMissing.length) {
  apparatus.push(`Chromium, the full-keyboard-access control, did not reach ${crMissing.join(', ')}`)
}
for (const r of results) {
  if (!r.seen.has('in-last')) apparatus.push(`${r.name} never reached the trailing <input>, so the Tab walk stalled`)
}

if (apparatus.length) {
  console.log('\n== APPARATUS FAILURE ==')
  for (const a of apparatus) console.log(`  ${a}`)
  console.log('No reading above is evidence about WebKit. Fix the fixture or the walk.')
  process.exit(1)
}

// ── The verdict. Every branch here is an observation, so every branch is 0. ──
const discriminates = !wk.has('btn-plain') && wk.has('btn-tab') && !wk.has('a-plain') && wk.has('a-tab')
const tabsEverything = wk.has('btn-plain') && wk.has('a-plain')

console.log('\n== VERDICT ==')
if (discriminates) {
  console.log('PREMISE CONFIRMED: WebKit skips plain button/link, reaches tabindex=0 ones.')
} else if (tabsEverything) {
  console.log('NULL RESULT: this WebKit build tabs to plain controls too (full keyboard access on by default).')
  console.log('Premise NOT measurable here; it is not refuted, and this is not a failure.')
} else {
  console.log('MIXED / UNEXPECTED: see the table above. Still an observation about WebKit,')
  console.log('not a defect in this repo -- read the table before changing anything.')
}
console.log('(apparatus OK: Chromium reached all 7 controls; both engines completed the walk)')
process.exit(0)
