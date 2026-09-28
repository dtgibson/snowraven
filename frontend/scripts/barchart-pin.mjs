#!/usr/bin/env node
// The Alameda pin (targets-tab, schema.md section 2.6): run the SHIPPED parser
// and frequency derivation over a real eBird bar-chart file and print what the
// Targets tab would show for Lincoln's Sparrow under both methods.
//
//   node scripts/barchart-pin.mjs <path/to/ebird_US-CA-001__..._barchart.txt> [--fixture <out.json>]
//
// With --fixture, and only when the pin holds, it also writes the section 2.6
// fixture (public eBird figures, nothing of the user's): the 48 sample sizes,
// the count of zero-sample periods, Lincoln's Sparrow, the most frequent
// species and the rarest one with a figure, each with its year-round and
// September figure as printed under BOTH methods, plus the winning method's
// name. Figures are printed from the code, never re-typed.
//
// The two TypeScript modules are bundled on the fly with rolldown (the bundler
// Vite 8 already installs; esbuild is not a dependency of this toolchain) into
// a temp ESM file and imported, so this script can never drift from the code it
// pins. Exit 0 only when one method prints 3.29; otherwise exit 1 with the
// reason, and the derivation becomes a user conversation, never a guess.
import { rolldown } from 'rolldown'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const file = process.argv[2]
const fxAt = process.argv.indexOf('--fixture')
const fixtureOut = fxAt > 0 ? process.argv[fxAt + 1] : null
if (!file || (fxAt > 0 && !fixtureOut)) { console.error('usage: node scripts/barchart-pin.mjs <barchart file> [--fixture <out.json>]'); process.exit(2) }

const lib = fileURLToPath(new URL('../src/lib/barChart/', import.meta.url))
const tmp = mkdtempSync(join(tmpdir(), 'barchart-pin-'))
// Every failure path returns an exit code rather than calling process.exit, so
// the finally below always removes the temp bundle.
const code = await (async () => {
  const entry = join(tmp, 'entry.ts')
  writeFileSync(entry, `export * from ${JSON.stringify(resolve(lib, 'parseBarChart.ts'))}\nexport * from ${JSON.stringify(resolve(lib, 'barChartFrequency.ts'))}\n`)
  const bundle = await rolldown({ input: entry, platform: 'node', logLevel: 'silent' })
  const { output } = await bundle.generate({ format: 'esm' })
  const out = join(tmp, 'pin.mjs')
  writeFileSync(out, output[0].code)
  const m = await import(pathToFileURL(out).href)

  const parsed = m.parseBarChart(readFileSync(file, 'utf8'))
  if (!parsed.ok) { console.error(`not a bar-chart file: ${parsed.reason}`); return 1 }
  const { sampleSizes, rows } = parsed.file
  const range = m.barChartRange(parsed.file, basename(file))
  const pct = (freqs, periods, method) => { const v = m.frequencyPercent(freqs, sampleSizes, periods, method); return v === null ? 'none' : v.toFixed(2) }
  console.log(`file: ${basename(file)}`)
  console.log(`range: years ${range.years ? range.years.join('-') : 'not in the name'}, full year ${range.fullYear}`)
  console.log(`rows: ${rows.length}, malformed ${parsed.file.malformed}, zero-sample periods ${sampleSizes.filter(n => n === 0).length}`)
  const lisp = rows.find(r => r.name === "Lincoln's Sparrow")
  if (!lisp) { console.error("PIN: no Lincoln's Sparrow row in this file (stop and flag)"); return 1 }
  const w = pct(lisp.freqs, m.ALL_PERIODS, 'sample-weighted')
  const p = pct(lisp.freqs, m.ALL_PERIODS, 'period-mean')
  console.log(`Lincoln's Sparrow year-round: sample-weighted ${w}%, period-mean ${p}%`)
  console.log(`Lincoln's Sparrow September:  sample-weighted ${pct(lisp.freqs, m.monthPeriods(9), 'sample-weighted')}%, period-mean ${pct(lisp.freqs, m.monthPeriods(9), 'period-mean')}%`)
  console.log(`FREQUENCY_METHOD in the code: ${m.FREQUENCY_METHOD}`)
  const method = w === '3.29' ? 'sample-weighted' : p === '3.29' ? 'period-mean' : null
  if (!method) { console.log('PIN: NEITHER prints 3.29 (stop and flag)'); return 1 }
  console.log(`PIN: ${method}`)
  if (fixtureOut) {
    const year = r => m.frequencyPercent(r.freqs, sampleSizes, m.ALL_PERIODS, method)
    const withFigure = rows.filter(r => year(r) !== null && year(r) > 0)
    const common = withFigure.reduce((a, b) => (year(b) > year(a) ? b : a))
    const rare = withFigure.reduce((a, b) => (year(b) < year(a) ? b : a))
    const picked = [[lisp, 'pin'], [common, 'most-frequent'], [rare, 'least-frequent']]
      .filter(([r], i, all) => all.findIndex(([o]) => o === r) === i)
    // Both methods' figures, as printed, so the test can assert that the pin
    // DISCRIMINATES them from the fixture alone (never a re-typed number).
    const figures = r => Object.fromEntries(['sample-weighted', 'period-mean'].map(k =>
      [k, { yearRound: pct(r.freqs, m.ALL_PERIODS, k), september: pct(r.freqs, m.monthPeriods(9), k) }]))
    writeFileSync(fixtureOut, JSON.stringify({
      source: 'eBird bar-chart download (public figures), pinned by frontend/scripts/barchart-pin.mjs',
      filename: basename(file), method,
      zeroSamplePeriods: sampleSizes.filter(n => n === 0).length,
      sampleSizes,
      rows: picked.map(([r, role]) => ({ name: r.name, role, freqs: r.freqs, figures: figures(r) })),
    }, null, 2) + '\n')
    console.log(`fixture written: ${fixtureOut} (${picked.length} rows)`)
  }
  return 0
})().finally(() => rmSync(tmp, { recursive: true, force: true }))
process.exit(code)
