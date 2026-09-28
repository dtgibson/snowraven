/// <reference types="node" />
// The eBird bar-chart parser (targets-tab, schema.md sections 2.1, 9.2, 10).
//
// Four kinds of evidence, kept apart:
//   1. REAL BYTES: Cornell's auk package sample (`barchart-sample.fixture.txt`,
//      public eBird data) parses to its declared 133 taxa and 48 sample sizes.
//      Its layout (ten leading blank lines, a trailing whitespace-only line) is
//      exactly what an index-keyed reader gets wrong, which the non-vacuity leg
//      proves by running one.
//   2. THE CURRENT DOWNLOAD'S NAME CELL (`<em class="sci">`), which the auk
//      sample predates, on the synthetic fixture and on hand-built rows.
//   3. EVERY BOUND at the bound and one over, under LF AND CRLF (testing.md
//      v1.0.20: a character bound is a matrix over the terminators).
//   4. LINEARITY over the five hostile shapes schema.md section 9.2 names plus
//      the two delimiter-ABSENT shapes the security review found quadratic
//      (M1), as a same-run doubling quotient at a small leg first and then a
//      large one, each timed parse preceded by a walk of the same loop under an
//      iteration cap so a regression that stops the cursor advancing THROWS
//      here instead of hanging the worker (a testTimeout cannot interrupt a
//      synchronous loop: testing.md v1.0.33). The name cell's entity decoder
//      has its own doubling row, because the raw name-cell bound shields it
//      from every file-level shape; that row times batched samples after an
//      untimed warm-up, because one call at its small leg is too short to be
//      a measurement (CI read it at 3.3 twice with nothing wrong).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  parseBarChart, splitNameCell, _parseBarChartWithIterationCapForTests,
  MAX_PREAMBLE_LINES, MAX_LINE_CHARS, PERIODS, MAX_NUMERIC_TOKEN, MAX_NAME_CELL, MAX_RAW_NAME_CELL,
  MAX_SAMPLE_SIZE, MAX_TAXA_ROWS,
  type BarChartFile,
} from './parseBarChart'
import { yearRoundPercent } from './barChartFrequency'

const SAMPLE = readFileSync(new URL('./barchart-sample.fixture.txt', import.meta.url), 'utf8')
const SYNTHETIC = readFileSync(new URL('./barchart-synthetic.fixture.txt', import.meta.url), 'utf8')

function ok(text: string): BarChartFile {
  const out = parseBarChart(text)
  if (!out.ok) throw new Error(`expected ok, got ${out.reason}`)
  return out.file
}

const zeros = (n: number) => Array.from({ length: n }, () => '0.0').join('\t')
const SAMPLE_ROW = `Sample Size:\t${Array.from({ length: PERIODS }, (_, i) => `${i + 1}.0`).join('\t')}\t`
const speciesRow = (name: string, cells = zeros(PERIODS)) => `${name}\t${cells}\t`
/** A minimal well-formed file, with a chosen line terminator. */
function minimal(eol: string, extra: string[] = []): string {
  return ['Frequency of observations in the selected location(s).:', 'Number of taxa: \t1', '', SAMPLE_ROW, '', speciesRow('Bushtit'), ...extra, ''].join(eol)
}

describe('the auk sample (real bytes)', () => {
  it('parses to its declared 133 taxa and 48 sample sizes', () => {
    const file = ok(SAMPLE)
    expect(file.sampleSizes).toHaveLength(48)
    expect(file.rows).toHaveLength(133)
    expect(file.declaredTaxa).toBe(133)
    expect(file.rows).toHaveLength(file.declaredTaxa!)
    expect(file.malformed).toBe(0)
    expect(file.rows[0].name).toBe('Bar-headed Goose')
    expect(file.rows[file.rows.length - 1].name).toBe('bird sp.')
    for (const r of file.rows) expect(r.freqs).toHaveLength(48)
  })

  it('reads the Sample Size row as numbers, `1095.0` included', () => {
    const file = ok(SAMPLE)
    expect(file.sampleSizes.slice(0, 5)).toEqual([0, 0, 2, 17, 12])
    expect(file.sampleSizes).toContain(1095)
  })

  it('reads scientific notation (`9.132E-4`) as the number it spells', () => {
    const snow = ok(SAMPLE).rows.find(r => r.name === 'Snow Goose')!
    expect(snow.freqs).toContain(9.132e-4)
  })

  it('every figure is a frequency in [0, 1] and every sample size is finite, >= 0 and within MAX_SAMPLE_SIZE', () => {
    const file = ok(SAMPLE)
    for (const n of file.sampleSizes) expect(Number.isFinite(n) && n >= 0 && n <= MAX_SAMPLE_SIZE).toBe(true)
    for (const r of file.rows) for (const f of r.freqs) expect(f >= 0 && f <= 1).toBe(true)
  })

  it('non-vacuity: an index-keyed reader (fixed line positions, ebird-histogramr style) misreads the same bytes', () => {
    // A plausible, WRONG implementation: take line 3 as the Sample Size row and
    // every later line as a species row. The auk sample opens with ten blank
    // lines, so this reader starts in the wrong place and gets a different
    // answer. If it agreed, the assertions above would not be evidence that the
    // real parser finds the layout rather than assuming it.
    const lines = SAMPLE.split('\n')
    const indexKeyedSample = lines[3]?.split('\t').slice(1, 49).map(Number) ?? []
    const indexKeyedRows = lines.slice(5).filter(l => l.includes('\t')).length
    const real = ok(SAMPLE)
    expect(indexKeyedSample).not.toEqual(real.sampleSizes)
    expect(indexKeyedRows).not.toBe(real.rows.length)
  })
})

describe('the current download\'s name cell', () => {
  it('splits `Name (<em class="sci">Sci</em>)` into name and scientific name', () => {
    expect(splitNameCell('Lincoln\'s Sparrow (<em class="sci">Melospiza lincolnii</em>)'))
      .toEqual({ name: 'Lincoln\'s Sparrow', sciName: 'Melospiza lincolnii' })
  })

  it('keeps a subspecies parenthetical that precedes the scientific name', () => {
    expect(splitNameCell('Dark-eyed Junco (Oregon) (<em class="sci">Junco hyemalis [oreganus Group]</em>)'))
      .toEqual({ name: 'Dark-eyed Junco (Oregon)', sciName: 'Junco hyemalis [oreganus Group]' })
  })

  it('the older shape is the whole cell, trimmed', () => {
    expect(splitNameCell('  Bar-headed Goose ')).toEqual({ name: 'Bar-headed Goose', sciName: null })
  })

  it('strips a tag eBird has not shown yet rather than keeping markup', () => {
    expect(splitNameCell('<b>Bushtit</b>')).toEqual({ name: 'Bushtit', sciName: null })
    expect(splitNameCell('Bushtit <span class="x">(<em class="sci">Psaltriparus minimus</em>)</span>').name).toBe('Bushtit')
  })

  it('decodes the entities an HTML-sourced cell can carry', () => {
    expect(splitNameCell('Lincoln&#39;s Sparrow').name).toBe('Lincoln\'s Sparrow')
    expect(splitNameCell('A &amp; B').name).toBe('A & B')
    expect(splitNameCell('&unknown; stays').name).toBe('&unknown; stays')
  })

  it('reads the synthetic fixture\'s `<em class="sci">` row', () => {
    const file = ok(SYNTHETIC)
    const lisp = file.rows.find(r => r.name === 'Lincoln\'s Sparrow')!
    expect(lisp.sciName).toBe('Melospiza lincolnii')
  })
})

describe('the synthetic fixture', () => {
  it('counts its one malformed row and keeps every other species row', () => {
    const file = ok(SYNTHETIC)
    expect(file.malformed).toBe(1)
    expect(file.rows.map(r => r.name)).not.toContain('Broken Row')
    expect(file.rows.length + file.malformed).toBe(file.declaredTaxa)
  })

  it('an empty cell reads as 0', () => {
    const wren = ok(SYNTHETIC).rows.find(r => r.name === 'Wrentit')!
    expect(wren.freqs.slice(4, 8)).toEqual([0, 0, 0, 0])
  })
})

describe('refusals (the file is not a bar chart)', () => {
  it('no Sample Size row', () => {
    expect(parseBarChart('title\n\nBushtit\t' + zeros(48) + '\t\n')).toEqual({ ok: false, reason: 'no-sample-size' })
    expect(parseBarChart('')).toEqual({ ok: false, reason: 'no-sample-size' })
  })

  it('a Sample Size row with the wrong cell count, a negative or a non-number', () => {
    const bad = [
      `Sample Size:\t${zeros(47)}\t`,
      `Sample Size:\t${zeros(49)}\t`,
      `Sample Size:\t-1.0\t${zeros(47)}\t`,
      `Sample Size:\tx\t${zeros(47)}\t`,
      `Sample Size:\t0x10\t${zeros(47)}\t`,
      `Sample Size:\tInfinity\t${zeros(47)}\t`,
      `Sample Size:\t\t${zeros(47)}\t`,
    ]
    for (const row of bad) {
      expect(parseBarChart(`title\n${row}\n${speciesRow('Bushtit')}\n`).ok, row.slice(0, 40)).toBe(false)
    }
  })

  it('a second Sample Size row', () => {
    expect(parseBarChart(minimal('\n', [SAMPLE_ROW]))).toEqual({ ok: false, reason: 'bad-sample-size' })
  })

  it('no species row, or only malformed ones', () => {
    expect(parseBarChart(`t\n${SAMPLE_ROW}\n`)).toEqual({ ok: false, reason: 'no-species' })
    expect(parseBarChart(`t\n${SAMPLE_ROW}\nBushtit\t0.1\n`)).toEqual({ ok: false, reason: 'no-species' })
  })

  it('a CSV eBird backup is not a bar chart', () => {
    const csv = 'Submission ID,Common Name,Scientific Name,Taxonomic Order\nS1,American Robin,Turdus migratorius,100\n'
    expect(parseBarChart(csv).ok).toBe(false)
  })
})

describe('a malformed species row is counted and skipped, never a refusal', () => {
  const cases: [string, string][] = [
    ['too few cells', 'Bushtit\t0.1\t0.2\t'],
    ['a frequency above 1', speciesRow('Bushtit', ['1.5', zeros(47)].join('\t'))],
    ['a negative frequency', speciesRow('Bushtit', ['-0.1', zeros(47)].join('\t'))],
    ['a non-number', speciesRow('Bushtit', ['abc', zeros(47)].join('\t'))],
    ['an empty name', speciesRow('   ')],
    ['two trailing empty cells', `Bushtit\t${zeros(48)}\t\t`],
  ]
  it.each(cases)('%s', (_label, row) => {
    const file = ok(minimal('\n', ['', row]))
    expect(file.malformed).toBe(1)
    expect(file.rows).toHaveLength(1)
  })

  it('a row with no trailing tab is accepted (the drop is of ONE trailing empty cell, not a requirement)', () => {
    const file = ok(minimal('\n', ['', `Wrentit\t${zeros(48)}`]))
    expect(file.rows.map(r => r.name)).toEqual(['Bushtit', 'Wrentit'])
  })
})

describe('tolerances', () => {
  it('CRLF reads identically to LF', () => {
    expect(parseBarChart(SAMPLE.replace(/\n/g, '\r\n'))).toEqual(parseBarChart(SAMPLE))
    expect(parseBarChart(SYNTHETIC.replace(/\n/g, '\r\n'))).toEqual(parseBarChart(SYNTHETIC))
  })

  it('a leading BOM is not part of the title', () => {
    expect(parseBarChart('﻿' + SAMPLE)).toEqual(parseBarChart(SAMPLE))
  })

  it('whitespace-only lines are blank, including a final one with no line break', () => {
    const text = minimal('\n', ['   \t ', ' ', '']) + '    '
    const file = ok(text)
    expect(file.malformed).toBe(0)
    expect(file.rows).toHaveLength(1)
    // The auk sample ends in blank lines; they are not rows either.
    expect(SAMPLE.endsWith('\n\n')).toBe(true)
    expect(ok(SAMPLE).malformed).toBe(0)
  })
})

// ── Bounds, each at the bound and one over, under both terminators ───────────
describe.each([['LF', '\n'], ['CRLF', '\r\n']])('bounds under %s', (_label, eol) => {
  it(`MAX_PREAMBLE_LINES (${MAX_PREAMBLE_LINES}): at the bound parses, one over refuses`, () => {
    const pre = (k: number) => Array.from({ length: k }, (_, i) => `preamble ${i}`)
    const at = [...pre(MAX_PREAMBLE_LINES), SAMPLE_ROW, speciesRow('Bushtit'), ''].join(eol)
    const over = [...pre(MAX_PREAMBLE_LINES + 1), SAMPLE_ROW, speciesRow('Bushtit'), ''].join(eol)
    expect(parseBarChart(at).ok).toBe(true)
    expect(parseBarChart(over)).toEqual({ ok: false, reason: 'preamble-too-long' })
  })

  it(`MAX_LINE_CHARS (${MAX_LINE_CHARS}): a species row at the bound is read, one over is malformed`, () => {
    // Pad the FIRST NUMERIC cell's whitespace (trimmed by the number reader)
    // so the row stays well-formed. Not the name cell: a raw name cell that
    // long is over MAX_RAW_NAME_CELL and would be malformed on THAT bound,
    // which would leave this row testing the wrong one.
    const base = speciesRow('Wrentit')
    const pad = (target: number) => base.replace('Wrentit\t0.0', 'Wrentit\t0.0' + ' '.repeat(target - base.length))
    const at = pad(MAX_LINE_CHARS)
    const over = pad(MAX_LINE_CHARS + 1)
    expect(at.length).toBe(MAX_LINE_CHARS)
    expect(over.length).toBe(MAX_LINE_CHARS + 1)
    const a = ok(minimal(eol, [at]))
    expect(a.rows.map(r => r.name)).toEqual(['Bushtit', 'Wrentit'])
    const b = ok(minimal(eol, [over]))
    expect(b.rows.map(r => r.name)).toEqual(['Bushtit'])
    expect(b.malformed).toBe(1)
  })

  it('MAX_LINE_CHARS: a Sample Size row one over the bound refuses the file', () => {
    const over = SAMPLE_ROW + ' '.repeat(MAX_LINE_CHARS + 1 - SAMPLE_ROW.length)
    expect(over.length).toBe(MAX_LINE_CHARS + 1)
    expect(parseBarChart(['t', over, speciesRow('Bushtit'), ''].join(eol))).toEqual({ ok: false, reason: 'bad-sample-size' })
    const at = over.slice(0, MAX_LINE_CHARS)
    expect(parseBarChart(['t', at, speciesRow('Bushtit'), ''].join(eol)).ok).toBe(true)
  })

  it(`MAX_NUMERIC_TOKEN (${MAX_NUMERIC_TOKEN}): a token at the bound reads, one over is malformed`, () => {
    const at = '0.' + '0'.repeat(MAX_NUMERIC_TOKEN - 3) + '1'
    const over = '0.' + '0'.repeat(MAX_NUMERIC_TOKEN - 2) + '1'
    expect(at.length).toBe(MAX_NUMERIC_TOKEN)
    expect(over.length).toBe(MAX_NUMERIC_TOKEN + 1)
    const a = ok(minimal(eol, ['', speciesRow('Wrentit', [at, zeros(47)].join('\t'))]))
    expect(a.rows).toHaveLength(2)
    const b = ok(minimal(eol, ['', speciesRow('Wrentit', [over, zeros(47)].join('\t'))]))
    expect(b.rows).toHaveLength(1)
    expect(b.malformed).toBe(1)
  })

  it(`MAX_NAME_CELL (${MAX_NAME_CELL}): a name at the bound is kept, one over is malformed`, () => {
    const at = 'N'.repeat(MAX_NAME_CELL)
    const over = 'N'.repeat(MAX_NAME_CELL + 1)
    const a = ok(minimal(eol, ['', speciesRow(at)]))
    expect(a.rows.map(r => r.name.length)).toEqual([7, MAX_NAME_CELL])
    const b = ok(minimal(eol, ['', speciesRow(over)]))
    expect(b.rows).toHaveLength(1)
    expect(b.malformed).toBe(1)
  })

  it(`MAX_RAW_NAME_CELL (${MAX_RAW_NAME_CELL}): a raw name cell at the bound is read, one over is malformed`, () => {
    // Both cells strip to `Wrentit`: the padding is one tag the stripper
    // removes, so only the RAW length differs and the row one over is refused
    // on this bound, not on MAX_NAME_CELL.
    const cell = (len: number) => `Wrentit<${'x'.repeat(len - 'Wrentit<>'.length)}>`
    expect(cell(MAX_RAW_NAME_CELL).length).toBe(MAX_RAW_NAME_CELL)
    expect(splitNameCell(cell(MAX_RAW_NAME_CELL + 1)).name).toBe('Wrentit')
    const a = ok(minimal(eol, ['', speciesRow(cell(MAX_RAW_NAME_CELL))]))
    expect(a.rows.map(r => r.name)).toEqual(['Bushtit', 'Wrentit'])
    const b = ok(minimal(eol, ['', speciesRow(cell(MAX_RAW_NAME_CELL + 1))]))
    expect(b.rows.map(r => r.name)).toEqual(['Bushtit'])
    expect(b.malformed).toBe(1)
    // The value, pinned to its safe range rather than to a timing ceiling
    // (security.md): room for any name that can be kept, and a small constant
    // against the line bound, which is what makes the per-row name work O(1).
    expect(MAX_RAW_NAME_CELL).toBeGreaterThan(MAX_NAME_CELL)
    expect(MAX_RAW_NAME_CELL).toBeLessThanOrEqual(MAX_LINE_CHARS / 16)
  })

  it(`MAX_SAMPLE_SIZE (${MAX_SAMPLE_SIZE}): at the bound every percent stays finite, one over refuses (Auditor I2)`, () => {
    const sizes = (v: string) => `Sample Size:\t${Array.from({ length: PERIODS }, () => v).join('\t')}\t`
    const everywhere = speciesRow('Wrentit', Array.from({ length: PERIODS }, () => '1.0').join('\t'))
    const at = ok(['t', sizes(String(MAX_SAMPLE_SIZE)), everywhere, ''].join(eol))
    expect(yearRoundPercent(at.rows[0], at.sampleSizes)).toBe(100)
    expect(parseBarChart(['t', sizes(String(MAX_SAMPLE_SIZE + 1)), everywhere, ''].join(eol)))
      .toEqual({ ok: false, reason: 'bad-sample-size' })
    // The review's shape: 48 cells of ~9e307, whose weighted sums overflowed
    // to Infinity and rendered "NaN%".
    expect(parseBarChart(['t', sizes('9e307'), everywhere, ''].join(eol)))
      .toEqual({ ok: false, reason: 'bad-sample-size' })
  })

  it(`MAX_TAXA_ROWS (${MAX_TAXA_ROWS}): at the bound parses, one over refuses`, () => {
    const rows = (k: number) => Array.from({ length: k }, () => speciesRow('Bushtit'))
    const at = ['t', SAMPLE_ROW, ...rows(MAX_TAXA_ROWS), ''].join(eol)
    const over = ['t', SAMPLE_ROW, ...rows(MAX_TAXA_ROWS + 1), ''].join(eol)
    expect(ok(at).rows).toHaveLength(MAX_TAXA_ROWS)
    expect(parseBarChart(over)).toEqual({ ok: false, reason: 'too-many-rows' })
  }, 30_000)
})

// ── Linearity (security.md: time the real exported entry point at doubling
//    sizes and require roughly 2x; a quadratic reads 4x) ─────────────────────
describe('linear in the input over the hostile shapes (schema.md 9.2 and 10)', () => {
  /** Every '\n' is one outer iteration, plus one for the tail and one to exit. */
  function capFor(text: string): number {
    let lines = 1
    for (let i = text.indexOf('\n'); i !== -1; i = text.indexOf('\n', i + 1)) lines++
    return lines + 2
  }

  /**
   * The minimum of `runs` timed samples of `run` on each input, returned PER
   * CALL. A sample is `batch` back-to-back calls: 1 for every row but the
   * entity decoder's (see `sampleMs` below). The two inputs are timed
   * INTERLEAVED, small then large in every round, so a burst of load from
   * elsewhere on the machine lands on both legs of the quotient rather than on
   * whichever one happened to be running (measured: timed back to back at
   * min-of-3, a full-suite run beside another session's browser probes read
   * 5.88 on the `<em` shape, while isolated runs read 1.6 to 2.0 at every
   * doubling from 2 MB to 16 MB).
   */
  function timedPair(
    small: string, large: string, run: (text: string) => unknown, batch: number, runs = 7,
  ): [number, number] {
    let bestSmall = Infinity
    let bestLarge = Infinity
    for (let r = 0; r < runs; r++) {
      let t0 = performance.now()
      for (let k = 0; k < batch; k++) run(small)
      bestSmall = Math.min(bestSmall, performance.now() - t0)
      t0 = performance.now()
      for (let k = 0; k < batch; k++) run(large)
      bestLarge = Math.min(bestLarge, performance.now() - t0)
    }
    return [bestSmall / batch, bestLarge / batch]
  }

  /**
   * The doubling legs, SMALLEST FIRST, each asserted before the next is built.
   * A quadratic reads ~4x at the first leg, where its whole run costs a second
   * or two, rather than grinding through the large leg toward CI's job timeout
   * (the M1 shapes, reverted, took 16 s and more at the large leg). The large
   * leg stays because it is where one call of a linear parse is itself well
   * above timer noise. `floor` is the smallest per-call small-side time the
   * quotient is divided by: under it, both sides are noise, and the next leg
   * decides.
   *
   * `sampleMs` (the entity decoder's row only) runs the large input once
   * UNTIMED, then sizes the batch from the best of three untimed small calls so
   * that one sample of a linear decode lasts at least `sampleMs`. That row's
   * small leg is one call of about 2 ms with no walk before it, and CI read it
   * as 2.00 ms -> 6.61 ms (3.31, run 36373007076) and 1.96 ms -> 6.53 ms (3.32,
   * run 36376776547) with the decoder unchanged. Two matching readings are a
   * systematic excess, not noise: it sits in the large leg in all seven rounds,
   * fresh Node processes on the dev Mac reproduce it (3.23 to 3.69, ten of
   * ten), and the untimed large call removes what batching alone leaves (a
   * batch without that call still read 2.18 to 2.41 in twelve). With both,
   * twelve fresh processes read 1.65 to 1.79 at 64,000 -> 128,000 and 1.68 to
   * 2.03 at 512,000 -> 1,024,000, and 1.73 to 1.76 and 1.98 to 2.03 with V8's
   * collector held to one thread. The batch is sized from the SMALL call, so a
   * quadratic, whose one small call is already past `sampleMs`, gets a batch
   * of 1 and costs what it did before: the decoder with its bounded lookahead
   * reverted reads about 4.0 at the first leg and is red in under two seconds.
   * 64 only bounds a timer that reads 0.
   *
   * The file-level rows do not take it. Their walk already runs each input once
   * before timing, CI has not failed them, and batching measurably HURTS the
   * shape whose parse keeps the most: the 512/513 names shape, batched this
   * way, read 2.64 to 3.03 at its first leg with the collector on one thread
   * (six fresh processes) against 2.33 to 2.57 timed call by call, and up to
   * 3.78 at its large leg beside a looping full-suite run against 2.50 call by
   * call (twenty runs each).
   */
  function assertLinear(
    make: (n: number) => string, legs: readonly [number, number][], run: (text: string) => unknown, floor: number,
    { walk, sampleMs }: { walk?: (text: string) => void; sampleMs?: number } = {},
  ): void {
    for (const [s, l] of legs) {
      const small = make(s)
      const large = make(l)
      // The large input really is about twice the small one, or the quotient
      // below would not mean anything.
      expect(large.length / small.length, `${s} -> ${l}`).toBeGreaterThan(1.6)
      walk?.(small)
      walk?.(large)
      let batch = 1
      if (sampleMs !== undefined) {
        run(large)
        let one = Infinity
        for (let c = 0; c < 3; c++) {
          const t0 = performance.now()
          run(small)
          one = Math.min(one, performance.now() - t0)
        }
        batch = Math.max(1, Math.min(64, Math.ceil(sampleMs / one)))
      }
      const [small0, tLarge] = timedPair(small, large, run, batch)
      // Same-run quotient: the machine cancels. Linear is ~2; quadratic is ~4.
      expect(
        tLarge / Math.max(small0, floor),
        `${s} -> ${l} (x${batch}): ${small0.toFixed(2)} ms -> ${tLarge.toFixed(2)} ms per call`,
      ).toBeLessThan(3.2)
    }
  }

  const FILE_LEGS: readonly [number, number][] = [[256_000, 512_000], [2_000_000, 4_000_000]]
  /** Proves each loop ENDS before it is timed: a regression that stops the line
   *  cursor advancing throws here rather than hanging the worker. */
  const walkCapped = (text: string) => { _parseBarChartWithIterationCapForTests(text, capFor(text)) }

  /** Rows per file in the `&` name-cell shape: fixed WITHIN a leg, so doubling
   *  the input doubles the CELL, which is where the entity quadratic lived, and
   *  chosen per leg so the cell never passes MAX_LINE_CHARS: 16 rows of 15,800
   *  to 31,800 at the small leg, 64 rows of 31,050 to 62,300 at the large. */
  const ampRows = (n: number) => (n < 1_000_000 ? 16 : 64)

  const SHAPES: [string, (n: number) => string][] = [
    ['a line with no line break at all', n => 'x'.repeat(n)],
    ['all tabs, after a real Sample Size row', n => `t\n${SAMPLE_ROW}\n` + ('\t'.repeat(999) + '\n').repeat(Math.ceil(n / 1000))],
    // Kept under MAX_RAW_NAME_CELL so every row still reaches the name
    // splitter this shape was written for (a longer cell is malformed before it).
    ['`<em` repeated inside name cells', n => `t\n${SAMPLE_ROW}\n` + (speciesRow('<em'.repeat(Math.floor(MAX_RAW_NAME_CELL / 3))) + '\n').repeat(Math.ceil(n / 2_240))],
    ['names at 512 and 513 characters, alternating', n => `t\n${SAMPLE_ROW}\n` + (speciesRow('N'.repeat(512)) + '\n' + speciesRow('N'.repeat(513)) + '\n').repeat(Math.ceil(n / 1400))],
    ['blank-separated species rows up to the row bound', n => `t\n${SAMPLE_ROW}\n` + (speciesRow('Bushtit') + '\n\n').repeat(Math.min(MAX_TAXA_ROWS, Math.ceil(n / 205)))],
    // M1 shape A (delimiter ABSENT): tab-free lines, then a long tab-free tail,
    // then one valid row. Both the line count and the tail grow with n, so a
    // tab search that runs past its line to the next tab in the file is ~4x.
    ['tab-free lines before a long tab-free tail (M1 A)', n => {
      const k = Math.min(MAX_TAXA_ROWS - 2, Math.floor(n / 200))
      return `t\n${SAMPLE_ROW}\n` + 'x\n'.repeat(k) + ' '.repeat(n - 2 * k) + '\n' + speciesRow('Bushtit') + '\n'
    }],
    // M1 shape B (delimiter ABSENT): 48-cell rows whose name cell is `&` with no
    // `;`, the cell doubling with n (up to 62,300, inside MAX_LINE_CHARS). Once
    // fixed these cells are over MAX_RAW_NAME_CELL and never reach the decoder,
    // so this row proves the whole PATH linear and would stay green with the
    // decoder's own bound reverted: the decoder's own test below pins that.
    ['`&` with no `;` filling 48-cell rows\' name cells (M1 B)', n => {
      const rows = ampRows(n)
      const cell = Math.floor(n / rows) - 200
      return `t\n${SAMPLE_ROW}\n` + (speciesRow('&'.repeat(cell)) + '\n').repeat(rows) + speciesRow('Bushtit') + '\n'
    }],
  ]

  it('the capped walk throws on a loop that does not advance (the guard can fail)', () => {
    // Guard-the-guard: a cap below what the text needs is exceeded, so a cursor
    // regression surfaces as this throw rather than as a hung worker.
    const text = minimal('\n')
    expect(() => _parseBarChartWithIterationCapForTests(text, 2)).toThrow(/iteration cap/)
    expect(_parseBarChartWithIterationCapForTests(text, capFor(text)).ok).toBe(true)
  })

  it('the M1 shapes reach the code they are about (non-vacuity)', () => {
    // Shape B's cells are delimiter-free, over the raw bound and inside the line
    // bound at every size, and shape A's tail really is one tab-free run longer
    // than the line bound.
    for (const n of FILE_LEGS.flat()) {
      const b = SHAPES.find(s => s[0].includes('M1 B'))![1](n)
      const bCell = b.split('\n')[2].split('\t')[0]
      expect(bCell, `${n}`).toMatch(/^&+$/)
      expect(bCell.length, `${n}`).toBeGreaterThan(MAX_RAW_NAME_CELL)
      expect(b.split('\n').every(l => l.length <= MAX_LINE_CHARS), `${n}`).toBe(true)
    }
    const a = SHAPES.find(s => s[0].includes('M1 A'))![1](FILE_LEGS[0][0])
    const tail = a.split('\n').find(l => l.length > MAX_LINE_CHARS)!
    expect(tail).toMatch(/^ +$/)
    expect(parseBarChart(a).ok).toBe(true)
  })

  it.each(SHAPES)('%s: doubling the input roughly doubles the time', (_label, make) => {
    assertLinear(make, FILE_LEGS, parseBarChart, 0.5, { walk: walkCapped })
  }, 60_000)

  it('the name cell\'s entity decoder: `&` with no `;`, doubling the CELL (M1 B, below the raw bound\'s shield)', () => {
    // splitNameCell is the exported entry to the name-cell work and the one the
    // parser calls. Timed directly because MAX_RAW_NAME_CELL keeps every
    // file-level shape's cells too short for the entity quadratic to show, so
    // without this row the decoder's six-character window could be reverted
    // with the suite green. Not a hang guard: the decoder's cursor advances on
    // every branch; this guards growth. One call at the small leg is about
    // 2 ms, so this row warms up and times batched samples of at least 20 ms
    // (assertLinear's `sampleMs`, which says why and what it measured).
    assertLinear(n => '&'.repeat(n), [[64_000, 128_000], [512_000, 1_024_000]], splitNameCell, 0.5, { sampleMs: 20 })
  }, 60_000)

  it('the no-line-break shape at 40 MB is one scan and a refusal, not a hang', () => {
    const huge = 'x'.repeat(40_000_000)
    expect(_parseBarChartWithIterationCapForTests(huge, 3)).toEqual({ ok: false, reason: 'no-sample-size' })
  }, 60_000)
})
