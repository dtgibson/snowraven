// Verifies the ENGINE PREMISE that v1.0.16 builds 1 and 2 rest on:
// that WebKit's default tab mode skips a plain <button>/<a href> and visits one
// carrying tabindex="0". Those builds' guard is a SOURCE test (the attribute is
// written); jsdom has no tab order, so the engine half has never been measured
// here -- it was carried from a prior roadmap measurement.
// Reports what it observes. A null result (WebKit tabbing to everything) is a
// real outcome and is reported as such, not as a pass.
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../website/tools/', import.meta.url))
const { webkit, chromium } = require('playwright')

const PAGE = `<!doctype html><meta charset=utf-8><title>t</title><body>
<input id="in-first" aria-label="first">
<button id="btn-plain">plain button</button>
<button id="btn-tab" tabindex="0">tabindex button</button>
<a id="a-plain" href="https://example.com">plain link</a>
<a id="a-tab" href="https://example.com" tabindex="0">tabindex link</a>
<details><summary id="sum">summary</summary>body</details>
<input id="in-last" aria-label="last">
</body>`

const IDS = ['in-first','btn-plain','btn-tab','a-plain','a-tab','sum','in-last']

async function run(engine, name) {
  const b = await engine.launch()
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
  await b.close()
  return { name, seen }
}

const results = []
for (const [eng, nm] of [[webkit,'WebKit'],[chromium,'Chromium']]) {
  results.push(await run(eng, nm))
}

for (const r of results) {
  console.log(`\n== ${r.name} ==`)
  for (const id of IDS) console.log(`  ${r.seen.has(id) ? 'REACHED ' : 'SKIPPED '} ${id}`)
}

const wk = results.find(r => r.name === 'WebKit').seen
const discriminates = !wk.has('btn-plain') && wk.has('btn-tab') && !wk.has('a-plain') && wk.has('a-tab')
const tabsEverything = wk.has('btn-plain') && wk.has('a-plain')

console.log('\n== VERDICT ==')
if (discriminates) console.log('PREMISE CONFIRMED: WebKit skips plain button/link, reaches tabindex=0 ones.')
else if (tabsEverything) console.log('NULL RESULT: this WebKit build tabs to plain controls too (full keyboard access on by default). Premise NOT measurable here; it is not refuted.')
else console.log('MIXED / UNEXPECTED: see the table above.')
