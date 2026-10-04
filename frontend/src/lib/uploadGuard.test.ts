/// <reference types="node" />
// Guard for improve: ml-export-hardening.
//
// Until this build `Settings.importFileContent` checked one thing about a file it
// was about to store: that its NAME ended in `.csv`. So an eBird backup dropped
// into the ML Export slot was written to disk on every platform and failed later on
// the Multimedia tab, where nothing could say which file was wrong; and a file of
// any size was written to disk on desktop and iOS, which have no cap at all. Web
// and Pi were the only platforms whose backend enforced a 50 MB cap, and
// `WebStorage.writeFile` discarded the response, so its 413 read as a completed
// upload (that half is `storage.settings.test.ts`).
//
// Five claims here:
//
//   1. THE CAP MATCHES THE BACKEND'S, read out of the Python rather than retyped.
//      Two literals that must be equal is exactly the pair that drifts.
//   2. THE BYTE COUNT IS THE UTF-8 BYTE COUNT, proved against TextEncoder over
//      probes including a lone surrogate at each end. `text.length` counts UTF-16
//      code units, a LOWER bound, so a check written that way lets a file of
//      accented place names past.
//   3. IT STOPS AT THE LIMIT rather than encoding the file, so the check on a 50 MB
//      upload allocates nothing. Asserted as work done, not as elapsed time.
//   4. EACH REFUSAL FIRES ON ITS OWN CASE, and a real export in its own slot is
//      accepted. Both slots, because `importFileContent` is one code path for both
//      and code symmetry is not evidence symmetry.
//   5. THE COPY IS COPY: no em dash, and it names what the slot takes rather than
//      what the offered file appeared to be.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  MAX_UPLOAD_BYTES,
  CSV_ONLY_MESSAGE,
  TOO_LARGE_MESSAGE,
  wrongExportMessage,
  exceedsUtf8ByteLimit,
  refuseByFilename,
  refuseByContent,
  refuseBarChartByContent,
  parseBarChartFilename,
  barChartRegionMismatchMessage,
  BARCHART_EXTENSION_MESSAGE,
  BARCHART_LAYOUT_MESSAGE,
  BARCHART_UNREADABLE_CODE_MESSAGE,
  BARCHART_FILENAME_MAX,
  BARCHART_NAME_TOO_LONG_MESSAGE,
  csvInputAccept,
  unreadableFileMessage,
  fileNotSavedMessage,
  PICKER_FAILED_MESSAGE,
} from './uploadGuard'
import { parseBarChart, type BarChartParseOutcome } from './barChart/parseBarChart'
import { detectExportType } from './detectExportType'
import { MAX_HEADER_CHARS } from './firstLine'

/** The most characters `firstLine` may read. TWO past the bound, not one: the scan
 *  window has to reach the LF of a CRLF-terminated line of exactly
 *  `MAX_HEADER_CHARS` characters, which sits at `MAX_HEADER_CHARS + 1`. The bound
 *  itself is enforced on the resulting line's LENGTH, not on this window. */
const MAX_SCAN_READS = MAX_HEADER_CHARS + 2

const DEMO_ML = readFileSync(
  new URL('../../../website/demo/snowraven-demo-ml-export.csv', import.meta.url), 'utf8')
const DEMO_EBIRD = readFileSync(
  new URL('../../../website/demo/snowraven-demo-ebird-backup.csv', import.meta.url), 'utf8')

describe('the cap is the backend cap', () => {
  it('equals MAX_BYTES in backend/routers/settings.py', () => {
    // Read from the Python, not retyped: the frontend now refuses over-cap files on
    // every platform, and the backend still answers 413 on the one platform that
    // reaches it. If the two ever disagree, web/Pi gets a refusal message quoting a
    // limit that is not the one being enforced.
    const py = readFileSync(new URL('../../../backend/routers/settings.py', import.meta.url), 'utf8')
    const m = py.match(/^MAX_BYTES\s*=\s*(\d+)\s*\*\s*(\d+)\s*\*\s*(\d+)\s*$/m)
    expect(m).not.toBeNull()
    const backendBytes = Number(m![1]) * Number(m![2]) * Number(m![3])
    expect(backendBytes).toBe(52_428_800)          // pins the read, so a bad regex cannot pass
    expect(MAX_UPLOAD_BYTES).toBe(backendBytes)
  })

  it('the message quotes the limit the code enforces', () => {
    expect(TOO_LARGE_MESSAGE).toContain(`${MAX_UPLOAD_BYTES / (1024 * 1024)} MB`)
  })
})

describe('exceedsUtf8ByteLimit counts UTF-8 bytes', () => {
  const PROBES: [string, string][] = [
    ['empty', ''],
    ['ascii', 'Submission ID,Common Name\n'],
    ['two-byte', 'Ñandú, Île, Ölüdeniz'],
    ['three-byte', '日本語のロケーション名'],
    ['astral pair', 'a\u{1F426}b'],           // 4 bytes for the bird
    ['lone high surrogate at the end', 'ab\uD83D'],
    ['lone low surrogate at the start', '\uDC26ab'],
    ['lone high surrogate mid-string', 'a\uD83Db'],
    ['high then high', '\uD83D\uD83D'],
    ['demo ML export', DEMO_ML],
    ['demo eBird backup', DEMO_EBIRD],
  ]

  it.each(PROBES)('agrees with TextEncoder on %s', (_name, text) => {
    const actual = new TextEncoder().encode(text).byteLength
    // Sweep the boundary from both sides: at the exact length it is not over, one
    // byte below it is.
    expect(exceedsUtf8ByteLimit(text, actual)).toBe(false)
    if (actual > 0) expect(exceedsUtf8ByteLimit(text, actual - 1)).toBe(true)
  })

  it('is not text.length, which would let a multi-byte file past', () => {
    const text = '日'.repeat(10)          // 10 code units, 30 bytes
    expect(text.length).toBe(10)
    expect(new TextEncoder().encode(text).byteLength).toBe(30)
    expect(exceedsUtf8ByteLimit(text, 10)).toBe(true)
    expect(exceedsUtf8ByteLimit(text, 29)).toBe(true)
    expect(exceedsUtf8ByteLimit(text, 30)).toBe(false)
  })

  it('stops at the limit instead of encoding the file (work done, not time taken)', () => {
    // A string long enough that reading all of it would be obvious, with the answer
    // decidable in the first few characters. The proxy for "it stopped" is a getter
    // on a Proxy-like accessor: charCodeAt is called at most limit + 1 times.
    const big = 'x'.repeat(5_000_000)
    let reads = 0
    const counted = {
      length: big.length,
      charCodeAt(i: number) { reads += 1; return big.charCodeAt(i) },
    } as unknown as string
    expect(exceedsUtf8ByteLimit(counted, 100)).toBe(true)
    expect(reads).toBeLessThanOrEqual(101)
    // Guard the guard: over a limit it does NOT pass, every character is read.
    reads = 0
    expect(exceedsUtf8ByteLimit(counted, big.length)).toBe(false)
    expect(reads).toBe(big.length)
  })
})

describe('refuseByFilename', () => {
  it('accepts a .csv name, in any case', () => {
    expect(refuseByFilename('MyEBirdData.csv')).toBeNull()
    expect(refuseByFilename('ML__2024_123.CSV')).toBeNull()
  })

  it('refuses anything else with the message the row has always shown', () => {
    expect(refuseByFilename('MyEBirdData.zip')).toBe(CSV_ONLY_MESSAGE)
    expect(refuseByFilename('MyEBirdData.csv.txt')).toBe(CSV_ONLY_MESSAGE)
    expect(refuseByFilename('csv')).toBe(CSV_ONLY_MESSAGE)
    expect(CSV_ONLY_MESSAGE).toBe('Only .csv files are accepted.')
  })
})

describe('refuseByContent, on both slots', () => {
  const SLOTS = [
    { slot: 'ml' as const, own: DEMO_ML, other: DEMO_EBIRD },
    { slot: 'ebird' as const, own: DEMO_EBIRD, other: DEMO_ML },
  ]

  it.each(SLOTS.map(r => [r.slot, r] as const))('%s: the real export is accepted', (_s, row) => {
    expect(refuseByContent(row.slot, row.own)).toBeNull()
  })

  it.each(SLOTS.map(r => [r.slot, r] as const))(
    '%s: the OTHER slot\'s export is refused, naming what this slot takes',
    (_s, row) => {
      expect(refuseByContent(row.slot, row.other)).toBe(wrongExportMessage(row.slot))
    },
  )

  it.each(SLOTS.map(r => [r.slot, r] as const))('%s: a CSV that is neither is refused', (_s, row) => {
    expect(refuseByContent(row.slot, 'name,value\n1,2\n')).toBe(wrongExportMessage(row.slot))
  })

  it.each(SLOTS.map(r => [r.slot, r] as const))('%s: an empty file is refused', (_s, row) => {
    expect(refuseByContent(row.slot, '')).toBe(wrongExportMessage(row.slot))
  })

  it.each(SLOTS.map(r => [r.slot, r] as const))(
    '%s: size is checked BEFORE type, so an over-cap file is reported as over-cap',
    (_s, row) => {
      // The right export for the slot, past the cap. Reporting it as the wrong file
      // would send the user looking for a different download.
      const over = row.own + 'x'.repeat(MAX_UPLOAD_BYTES)
      expect(refuseByContent(row.slot, over)).toBe(TOO_LARGE_MESSAGE)
    },
  )

  it('a file exactly at the cap is accepted, one byte over is refused', () => {
    const filler = MAX_UPLOAD_BYTES - new TextEncoder().encode(DEMO_ML).byteLength
    const atCap = DEMO_ML + 'x'.repeat(filler)
    expect(new TextEncoder().encode(atCap).byteLength).toBe(MAX_UPLOAD_BYTES)
    expect(refuseByContent('ml', atCap)).toBeNull()
    expect(refuseByContent('ml', atCap + 'x')).toBe(TOO_LARGE_MESSAGE)
  })
})

describe('a hostile single-line file is refused at the chokepoint', () => {
  // Security review finding 1, at the layer where it was reachable. A file whose one
  // enormous line BEGINS with a real ML header was classified `ml`, accepted, and
  // stored, after which every Multimedia and Statistics load paid ~1,740 ms of
  // main-thread work re-reading that line. It is under the size cap, so the cap does
  // not catch it; the header bound does.
  const HOSTILE_ML = 'Catalog Number,Common Name,Format,' + 'x'.repeat(MAX_HEADER_CHARS) + '\n1,American Robin,Photo\n'

  it('is refused, and as a wrong-slot file rather than an over-cap one', () => {
    // Non-vacuity in the direction that matters: it really is under the cap, so this
    // row is the header bound doing the work and not the size check.
    expect(exceedsUtf8ByteLimit(HOSTILE_ML, MAX_UPLOAD_BYTES)).toBe(false)
    expect(refuseByContent('ml', HOSTILE_ML)).toBe(wrongExportMessage('ml'))
  })

  it('reads at most MAX_SCAN_READS characters of it (work done, not time taken)', () => {
    const big = 'Catalog Number,Common Name,Format,' + 'x'.repeat(5_000_000) + '\n1,American Robin,Photo\n'
    let headerReads = 0
    const counted = new Proxy(
      { length: big.length, charCodeAt: (i: number) => { headerReads += 1; return big.charCodeAt(i) } },
      {
        get(target, prop, receiver) {
          if (typeof prop === 'string' && /^[0-9]+$/.test(prop)) { headerReads += 1; return big[Number(prop)] }
          return Reflect.get(target, prop, receiver)
        },
      },
    ) as unknown as string

    // The size check runs first and reads up to the cap; the header read after it is
    // what this bounds, so measure `detectExportType` on its own through the proxy.
    expect(detectExportType(counted)).toBe('unknown')
    expect(headerReads).toBeLessThanOrEqual(MAX_SCAN_READS)
    expect(headerReads).toBeGreaterThan(MAX_HEADER_CHARS / 2)
  })
})

describe('the refusal copy', () => {
  const ALL = [CSV_ONLY_MESSAGE, TOO_LARGE_MESSAGE, wrongExportMessage('ml'), wrongExportMessage('ebird')]

  it('carries no em dash', () => {
    for (const s of ALL) expect(s).not.toContain('—')
  })

  it('names what each slot takes, using the labels the rows render', () => {
    expect(wrongExportMessage('ml')).toContain('ML Export slot')
    expect(wrongExportMessage('ml')).toContain('macaulaylibrary.org')
    expect(wrongExportMessage('ml')).toContain('MyEBirdData.csv goes in the eBird Backup slot')
    expect(wrongExportMessage('ebird')).toContain('eBird Backup slot')
    expect(wrongExportMessage('ebird')).toContain('MyEBirdData.csv')
    expect(wrongExportMessage('ebird')).toContain('goes in the ML Export slot')
  })

  it('says the file was not saved, on both refusals, because it was not', () => {
    expect(TOO_LARGE_MESSAGE).toContain('it was not saved')
    expect(wrongExportMessage('ml')).toContain('it was not saved')
    expect(wrongExportMessage('ebird')).toContain('it was not saved')
  })

  // android-release FR-29, QA-16, QA-29: the CONTENT of the failure lines, as
  // literals (Settings.upload.test.tsx proves their delivery). Each names the
  // file and none says "Upload", which the phone's Import row would contradict.
  it('the read and save failure lines name the file, say nothing of uploading, and the picker line names none', () => {
    expect(unreadableFileMessage('MyEBirdData.csv'))
      .toBe('Could not read MyEBirdData.csv, so it was not saved. Try choosing it again.')
    expect(fileNotSavedMessage('MyEBirdData.csv')).toBe('Could not save MyEBirdData.csv. Try choosing it again.')
    expect(PICKER_FAILED_MESSAGE).toBe('The file picker did not open. Try again.')
    for (const s of [unreadableFileMessage('a.csv'), fileNotSavedMessage('a.csv'), PICKER_FAILED_MESSAGE]) {
      expect(s).not.toMatch(/upload/i)
      expect(s).not.toContain('—')
    }
  })
})

// android-release QA-26: measured on the API 36 emulator, `.csv` alone becomes
// GET_CONTENT for text/csv and DocumentsUI greys out every local CSV (typed
// text/comma-separated-values); the Android list enabled them. The filter is a
// convenience: whatever extra it enables is refused by name above.
describe('the CSV inputs\' accept value', () => {
  it('Android spells out the CSV MIME types beside the extension; every other platform keeps the extension', () => {
    expect(csvInputAccept(false)).toBe('.csv')
    expect(csvInputAccept(true)).toBe(
      '.csv,text/csv,text/comma-separated-values,application/csv,application/vnd.ms-excel,text/plain')
  })

  it('anything else the Android list lets the picker enable is refused by name, before it is read', () => {
    expect(refuseByFilename('field-notes.txt')).toBe(CSV_ONLY_MESSAGE)
    expect(refuseByFilename('Export.xls')).toBe(CSV_ONLY_MESSAGE)
  })
})

// ── The bar-chart kind (targets-tab, schema.md section 2.3) ──────────────────
// The same registry, extended rather than forked: the Targets import gets every
// refusal the CSV imports get or visibly none. Each branch of section 2.3 has its
// own row, in the ORDER the function applies them, and the csv default keeps the
// two rows above green unchanged.

const BARCHART_SAMPLE = readFileSync(new URL('./barChart/barchart-sample.fixture.txt', import.meta.url), 'utf8')
const ALAMEDA_NAME = 'ebird_US-CA-001__1900_2026_1_12_barchart.txt'
const ALAMEDA_CTX = { filename: ALAMEDA_NAME, regionCode: 'US-CA-001', countyLabel: 'Alameda, CA' }

describe('refuseByFilename, bar-chart kind', () => {
  it('accepts .txt and .tsv in any case', () => {
    for (const n of ['x.txt', 'X.TXT', 'x.tsv', ALAMEDA_NAME, 'ebird_US-CA-001__1900_2026_1_12_barchart (1).txt']) {
      expect(refuseByFilename(n, 'barchart'), n).toBeNull()
    }
  })

  it('refuses everything else with its own message, before any read', () => {
    for (const n of ['MyEBirdData.csv', 'x.zip', 'x.txt.gz', 'txt', 'x.tx']) {
      expect(refuseByFilename(n, 'barchart'), n).toBe(BARCHART_EXTENSION_MESSAGE)
    }
    expect(BARCHART_EXTENSION_MESSAGE).toBe('Only .txt or .tsv bar-chart files are accepted.')
  })

  it('the default kind is still the csv rule, and the two kinds do not bleed', () => {
    expect(refuseByFilename('x.txt')).toBe(CSV_ONLY_MESSAGE)
    expect(refuseByFilename('x.csv', 'csv')).toBeNull()
    expect(refuseByFilename('x.csv', 'barchart')).toBe(BARCHART_EXTENSION_MESSAGE)
  })

  it(`a name the manifest cannot hold is refused before any read: at ${BARCHART_FILENAME_MAX} UTF-16 code units accepted, one over refused (security review L2)`, () => {
    const named = (units: number) => `${'n'.repeat(units - '.txt'.length)}.txt`
    expect(named(BARCHART_FILENAME_MAX)).toHaveLength(BARCHART_FILENAME_MAX)
    expect(refuseByFilename(named(BARCHART_FILENAME_MAX), 'barchart')).toBeNull()
    expect(refuseByFilename(named(BARCHART_FILENAME_MAX + 1), 'barchart')).toBe(BARCHART_NAME_TOO_LONG_MESSAGE)
    // Counted in the unit the manifest reader counts (`.length`): an astral
    // character is two, so 126 birds and `.txt` is one over at 130 characters.
    const astral = `${'\u{1F426}'.repeat(126)}.txt`
    expect(astral.length).toBe(BARCHART_FILENAME_MAX + 1)
    expect(refuseByFilename(astral, 'barchart')).toBe(BARCHART_NAME_TOO_LONG_MESSAGE)
    // The extension rule still speaks first, and the csv kind has no such rule.
    expect(refuseByFilename(`${'n'.repeat(BARCHART_FILENAME_MAX)}.zip`, 'barchart')).toBe(BARCHART_EXTENSION_MESSAGE)
    expect(refuseByFilename(`${'n'.repeat(BARCHART_FILENAME_MAX)}.csv`)).toBeNull()
  })

  it('the bound is the web/Pi route\'s too: equals _FILENAME_MAX in backend/routers/barcharts.py', () => {
    // Two declarations compared to each other, never a restated literal
    // (testing.md v1.0.33, rule 5). The route's own enforcement is pinned by
    // test_barcharts_router.py, so deleting either side's check goes red there.
    const py = readFileSync(new URL('../../../backend/routers/barcharts.py', import.meta.url), 'utf8')
    const m = py.match(/^_FILENAME_MAX\s*=\s*(\d+)\s*$/m)
    expect(m, 'the Python constant is there to be read').not.toBeNull()
    expect(Number(m![1])).toBe(BARCHART_FILENAME_MAX)
  })
})

describe('refuseBarChartByContent, branch by branch, in order', () => {
  const parse = vi.fn((t: string): BarChartParseOutcome => parseBarChart(t))
  beforeEach(() => { parse.mockClear() })

  it('5. a real bar-chart file for the selected county is accepted', () => {
    expect(refuseBarChartByContent(BARCHART_SAMPLE, ALAMEDA_CTX, parse)).toBeNull()
    expect(refuseBarChartByContent(BARCHART_SAMPLE, { ...ALAMEDA_CTX, filename: 'barchart.txt' }, parse)).toBeNull()
  })

  it('1. over the cap is TOO_LARGE, checked first, without parsing', () => {
    const over = BARCHART_SAMPLE + 'x'.repeat(MAX_UPLOAD_BYTES)
    expect(refuseBarChartByContent(over, { ...ALAMEDA_CTX, filename: 'ebird_CA-ON__x.txt' }, parse)).toBe(TOO_LARGE_MESSAGE)
    expect(parse).not.toHaveBeenCalled()
  })

  it('2. an unreadable eBird-shaped name refuses before the mismatch and the parse', () => {
    expect(refuseBarChartByContent(BARCHART_SAMPLE, { ...ALAMEDA_CTX, filename: 'ebird_CA-ON__1900_2026_1_12_barchart.txt' }, parse))
      .toBe(BARCHART_UNREADABLE_CODE_MESSAGE)
    expect(parse).not.toHaveBeenCalled()
  })

  it('3. another county\'s code refuses naming both, before the parse (QA-31)', () => {
    const ctx = { filename: ALAMEDA_NAME, regionCode: 'US-CA-013', countyLabel: 'Contra Costa, CA' }
    expect(refuseBarChartByContent(BARCHART_SAMPLE, ctx, parse))
      .toBe('This file is for US-CA-001, not Contra Costa, CA. Open Contra Costa, CA and add it there, or download Contra Costa, CA\'s file.')
    expect(barChartRegionMismatchMessage('US-CA-001', 'Contra Costa, CA')).toContain('US-CA-001')
    expect(parse).not.toHaveBeenCalled()
  })

  it('4. a file that is not the layout refuses with FR-28\'s words', () => {
    expect(refuseBarChartByContent(DEMO_EBIRD, { ...ALAMEDA_CTX, filename: 'MyEBirdData.txt' }, parse)).toBe(BARCHART_LAYOUT_MESSAGE)
    expect(refuseBarChartByContent('', ALAMEDA_CTX, parse)).toBe(BARCHART_LAYOUT_MESSAGE)
    expect(parse).toHaveBeenCalledTimes(2)
    expect(BARCHART_LAYOUT_MESSAGE).toBe("This is not an eBird bar-chart file. Download it from the county's bar chart page on ebird.org (Download Histogram Data).")
  })

  it('the refusal never echoes the filename (QA-70)', () => {
    const hostile = 'ebird_<script>__1900_2026_1_12_barchart.txt'
    expect(parseBarChartFilename(hostile).malformedCode).toBe(true)
    expect(refuseBarChartByContent(BARCHART_SAMPLE, { ...ALAMEDA_CTX, filename: hostile }, parse)).not.toContain('<script>')
  })
})

describe('the bar-chart copy', () => {
  it('carries no em dash', () => {
    for (const s of [BARCHART_EXTENSION_MESSAGE, BARCHART_LAYOUT_MESSAGE, BARCHART_UNREADABLE_CODE_MESSAGE, BARCHART_NAME_TOO_LONG_MESSAGE, barChartRegionMismatchMessage('US-CA-001', 'Alameda, CA')]) {
      expect(s).not.toContain('\u2014')
    }
  })
})

describe('the registry stays entry-safe', () => {
  it('uploadGuard.ts has no VALUE import of lib/barChart (comments stripped)', () => {
    // Settings.tsx puts this module on App.tsx's static graph, and the parser
    // must stay off the entry chunk: the parse arrives as a parameter and its
    // type through `import type`, which is erased at build. Comments are
    // stripped first, both forms, so an explanation that NAMES the directory
    // cannot fail a correct file and a commented-out import cannot pass one.
    const src = readFileSync(new URL('./uploadGuard.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    const imports = [...src.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)'/gm)]
    const barChart = imports.filter(m => m[2].includes('barChart/'))
    expect(barChart.length, 'the type import is there to be checked').toBeGreaterThan(0)
    for (const m of barChart) expect(m[1], `${m[2]} must be a type-only import`).toBe('type ')
  })
})
