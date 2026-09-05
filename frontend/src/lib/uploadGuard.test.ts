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
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  MAX_UPLOAD_BYTES,
  CSV_ONLY_MESSAGE,
  TOO_LARGE_MESSAGE,
  wrongExportMessage,
  exceedsUtf8ByteLimit,
  refuseByFilename,
  refuseByContent,
} from './uploadGuard'
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
})
