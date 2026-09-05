/// <reference types="node" />
// Guard for improve: ml-export-hardening.
//
// `detectFileType` lived inside LifeList.tsx and had one reader. It now has two
// that must agree — Settings refuses an upload whose header does not match the slot
// it was dropped into, and Multimedia refuses to parse a stored file that is not an
// ML export — so it moved to `lib/detectExportType.ts`. Two header sniffers would
// drift, and the drift would show up as a file the app refuses to accept and then
// reports as missing.
//
// Four claims:
//
//   1. THE CLASSIFICATION IS UNCHANGED for every input whose first line is within
//      `MAX_HEADER_CHARS`, which is every file either service emits. The shipped
//      spelling is kept here as an oracle and the two are compared over the tracked
//      demo exports, over hand-written probes, over an exhaustive sweep, and over
//      randomized headers, so the move cannot have altered what any usable file is
//      called. The ONE deliberate divergence is an over-bound first line, asserted
//      as its own case below rather than left to be discovered.
//   2. IT IS LOOSER THAN BOTH PARSERS. Anything either parser accepts is classified
//      as that parser's export, which is what makes a refusal in Settings safe: it
//      can never turn away a file the app could have used. Proved by running the
//      real parsers.
//   3. THE TWO EXPORTS ARE NOT CONFUSABLE, in either direction. Worth asserting
//      rather than eyeballing: the eBird header really does contain the substring
//      the ML branch tests first, because of its `ML Catalog Numbers` column.
//   4. IT DOES NOT SPLIT OR REGEX THE WHOLE FILE. It reads the header with
//      `firstLine`, whose two measured retention traps are recorded at its
//      definition. The old spelling built an array of every line in the export and
//      left the file in the regex engine's last-match state — cheap on a header,
//      not cheap on the 50 MB the upload guard has to classify before writing it.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { detectExportType } from './detectExportType'
import { MAX_HEADER_CHARS } from './firstLine'

/** The most characters `firstLine` may read. TWO past the bound, not one: the scan
 *  window has to reach the LF of a CRLF-terminated line of exactly
 *  `MAX_HEADER_CHARS` characters, which sits at `MAX_HEADER_CHARS + 1`. The bound
 *  itself is enforced on the resulting line's LENGTH, not on this window. */
const MAX_SCAN_READS = MAX_HEADER_CHARS + 2
import { parseMLExport } from './parseMLExport'
import { parseEbirdObservations } from './parseEbirdObservations'

const DEMO_ML = readFileSync(
  new URL('../../../website/demo/snowraven-demo-ml-export.csv', import.meta.url), 'utf8')
const DEMO_EBIRD = readFileSync(
  new URL('../../../website/demo/snowraven-demo-ebird-backup.csv', import.meta.url), 'utf8')

/** The spelling this replaces, verbatim from LifeList.tsx, kept as the oracle it
 *  must match. Only the returned words differ (`'ml-export'` became `'ml'`). */
function shippedDetectFileType(text: string): 'ml-export' | 'ebird' | 'unknown' {
  const firstLine = (text.split(/\r?\n/)[0] ?? '').toLowerCase()
  const hasCatalogNumber = firstLine.includes('catalog number')
  const hasFormat = firstLine.includes('format')
  if (hasCatalogNumber && hasFormat) return 'ml-export'
  if (firstLine.includes('submission id')) return 'ebird'
  return 'unknown'
}
const asOld = (t: 'ml' | 'ebird' | 'unknown') => (t === 'ml' ? 'ml-export' : t)

/** Comments stripped, so the module's own prose about the trap is not mistaken for
 *  the trap. Same reason entryChunk.test.ts and the retention guard strip them. */
function stripComments(code: string): string {
  let out = ''
  let i = 0
  while (i < code.length) {
    const c = code[i]
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && code[i + 1] === '*') {
      i += 2
      while (i < code.length && !(code[i] === '*' && code[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const quote = c
      out += c
      i += 1
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') { out += code[i]; i += 1 }
        if (i < code.length) { out += code[i]; i += 1 }
      }
      out += quote
      i += 1
      continue
    }
    out += c
    i += 1
  }
  return out
}

describe('the classification is the shipped one, moved', () => {
  const PROBES: string[] = [
    DEMO_ML,
    DEMO_EBIRD,
    '',
    '\n',
    '\r\n',
    'Catalog Number,Common Name,Format\n1,American Robin,Photo',
    'ML Catalog Number,Format,Common Name\n1,Photo,American Robin',
    'catalog number,format\n',
    'Submission ID,Common Name,Date\nS1,American Robin,2024-05-01',
    'submission id,common name\n',
    // The trap worth naming: an eBird backup carries `ML Catalog Numbers`, which
    // contains the substring the ML branch tests first.
    'Submission ID,Common Name,Date,ML Catalog Numbers\nS1,Robin,2024-05-01,ML123',
    // ...and an ML export carries a checklist id that is not a Submission ID.
    'ML Catalog Number,Format,Common Name,eBird Checklist ID\n1,Photo,Robin,S1',
    'name,value\n1,2',
    'nothing at all',
    '﻿Catalog Number,Format\n1,Photo',
    'Catalog Number,Format\r\n1,Photo',
    // A lone CR is an ordinary character to both spellings.
    'Catalog Number,Format\r1,Photo',
  ]

  it.each(PROBES.map((p, i) => [i, p] as const))(
    'agrees with the spelling it replaces on probe %i',
    (_i, probe) => {
      expect(asOld(detectExportType(probe))).toBe(shippedDetectFileType(probe))
    },
  )

  it('agrees on every string over the line-break and marker alphabet up to length 3', () => {
    // Small alphabet, exhaustive: the two line-break characters plus one character
    // of each marker, so the sweep exercises the branch boundaries rather than
    // random text.
    const alphabet = ['\r', '\n', 'c', 'f', 's', ',']
    let level = ['']
    let checked = 0
    for (let len = 1; len <= 3; len++) {
      const next: string[] = []
      for (const prefix of level) {
        for (const ch of alphabet) {
          const probe = prefix + ch
          next.push(probe)
          expect([probe, asOld(detectExportType(probe))]).toEqual([probe, shippedDetectFileType(probe)])
          checked += 1
        }
      }
      level = next
    }
    expect(checked).toBe(6 + 36 + 216)
  })

  it('agrees on randomized headers, re-running the oracle after the header bound', () => {
    // The bound changed how the header is READ, so the differential is re-run rather
    // than inherited from the move that introduced it. Randomized column names over
    // the alphabet real headers use, at realistic widths, with the two markers
    // planted often enough that every branch is exercised.
    const CHARS = 'abcdefghijklmnopqrstuvwxyz ,/()-'
    let seed = 0x5eed1234
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0x100000000)
    let mlSeen = 0, ebirdSeen = 0, unknownSeen = 0
    for (let n = 0; n < 20_000; n++) {
      const cols: string[] = []
      const width = 1 + Math.floor(rnd() * 12)
      for (let c = 0; c < width; c++) {
        // One draw, split into ranges. Three separate `rnd() < 0.18` tests would be
        // the same thing to a reader and a duplicate condition to eslint.
        const draw = rnd()
        if (draw < 0.18) cols.push('ML Catalog Number')
        else if (draw < 0.36) cols.push('Format')
        else if (draw < 0.54) cols.push('Submission ID')
        else {
          let name = ''
          const len = 1 + Math.floor(rnd() * 14)
          for (let k = 0; k < len; k++) name += CHARS[Math.floor(rnd() * CHARS.length)]
          cols.push(name)
        }
      }
      const probe = cols.join(',') + (rnd() < 0.5 ? '\r\n' : '\n') + 'row,row\n'
      const got = detectExportType(probe)
      if (got === 'ml') mlSeen += 1
      else if (got === 'ebird') ebirdSeen += 1
      else unknownSeen += 1
      expect([n, asOld(got)]).toEqual([n, shippedDetectFileType(probe)])
    }
    // Per-branch non-vacuity: 20,000 agreements mean nothing if they are all one verdict.
    expect(mlSeen).toBeGreaterThan(100)
    expect(ebirdSeen).toBeGreaterThan(100)
    expect(unknownSeen).toBeGreaterThan(100)
  })

  it('calls the tracked demo exports what they are', () => {
    expect(detectExportType(DEMO_ML)).toBe('ml')
    expect(detectExportType(DEMO_EBIRD)).toBe('ebird')
  })

  it('the ONLY divergence from the shipped spelling is the deliberate over-bound one', () => {
    // The differential re-run as a SET rather than as a pass/fail, because "no
    // divergences" is not the claim -- there is exactly one, it is deliberate, and
    // naming it is what lets a second one show up as a defect instead of as noise.
    // A CRLF-terminated line of exactly MAX_HEADER_CHARS characters was the second
    // one, found in review: the scan window reached one position short of its LF, so
    // the same line answered under LF and not under CRLF. It fails safe, so nothing
    // was ever misclassified -- which is exactly why only a differential finds it.
    //
    // Sweep both line endings across the bound, plus header shapes that exercise
    // each verdict, so a divergence anywhere in the neighbourhood is caught.
    const PREFIXES = [
      'ML Catalog Number,Format,Common Name',   // -> ml
      'Submission ID,Common Name,Date',         // -> ebird
      'Column A,Column B',                      // -> unknown
    ]
    const LENGTHS = [
      0, 1, 2,
      MAX_HEADER_CHARS - 2, MAX_HEADER_CHARS - 1, MAX_HEADER_CHARS,
      MAX_HEADER_CHARS + 1, MAX_HEADER_CHARS + 2, MAX_HEADER_CHARS + 3,
      MAX_HEADER_CHARS * 2,
    ]
    const divergences: { prefix: string; lineLen: number; ending: string; old: string; now: string }[] = []
    let compared = 0

    for (const prefix of PREFIXES) {
      for (const target of LENGTHS) {
        // Pad the prefix out to exactly `target` characters of first line, so the
        // header's own markers stay intact and only the LENGTH varies.
        if (target < prefix.length) continue
        const line = prefix + ','.repeat(target - prefix.length)
        for (const ending of ['\n', '\r\n', ''] as const) {
          const probe = line + ending + (ending === '' ? '' : 'row,row\n')
          const now = asOld(detectExportType(probe))
          const before = shippedDetectFileType(probe)
          compared += 1
          if (now !== before) {
            divergences.push({ prefix, lineLen: line.length, ending: ending === '\n' ? 'LF' : ending === '\r\n' ? 'CRLF' : 'none', old: before, now })
          }
        }
      }
    }

    expect(compared).toBeGreaterThan(60)   // non-vacuity: the sweep really ran

    // Every divergence is an over-bound first line, and every one answers 'unknown'
    // rather than a different classification: it fails to a refusal, never to a
    // wrong slot.
    for (const d of divergences) {
      expect([d, 'over-bound']).toEqual([d, d.lineLen > MAX_HEADER_CHARS ? 'over-bound' : 'WITHIN THE BOUND'])
      expect([d, d.now]).toEqual([d, 'unknown'])
    }
    // ...and the two line endings diverge on exactly the same inputs, which is the
    // property the review's finding broke.
    const lf = divergences.filter(d => d.ending === 'LF').map(d => `${d.prefix}@${d.lineLen}`)
    const crlf = divergences.filter(d => d.ending === 'CRLF').map(d => `${d.prefix}@${d.lineLen}`)
    expect(lf).toEqual(crlf)
    expect(lf.length).toBeGreaterThan(0)
  })

  it('the real headers sit far inside the bound, which is what makes the divergence unreachable', () => {
    // The number the bound was chosen against. If either service ever widens its
    // header past MAX_HEADER_CHARS this goes red, which is the loud failure the
    // constant's own note promises instead of a silent misclassification.
    const mlHeader = DEMO_ML.split('\n')[0]
    const ebirdHeader = DEMO_EBIRD.split('\n')[0]
    expect(mlHeader.length).toBe(583)
    expect(ebirdHeader.length).toBe(309)
    expect(mlHeader.length).toBeLessThan(MAX_HEADER_CHARS / 10)
    expect(ebirdHeader.length).toBeLessThan(MAX_HEADER_CHARS / 10)
  })
})

describe('a first line past the bound is refused, not silently classified from a prefix', () => {
  // The security finding this bound closes: the shipped unbounded read cost
  // 2,006.6 ms on a 50 MB single line, and a 40 MB single line BEGINNING with a real
  // ML header was classified `ml`, accepted by the upload guard, and stored -- after
  // which every Multimedia and Statistics load paid that cost again, in front of the
  // parse this build moved off the main thread.
  const ML_PREFIX = 'ML Catalog Number,Format,Common Name,'
  const EBIRD_PREFIX = 'Submission ID,Common Name,Date,'

  it('a single line beginning with a real ML header is no longer called an ML export', () => {
    const hostile = ML_PREFIX + 'x'.repeat(MAX_HEADER_CHARS) + '\n1,Photo,Robin\n'
    // The shipped spelling read the whole line and called it one; this does not.
    expect(shippedDetectFileType(hostile)).toBe('ml-export')
    expect(detectExportType(hostile)).toBe('unknown')
  })

  it('the same holds for the eBird slot', () => {
    const hostile = EBIRD_PREFIX + 'x'.repeat(MAX_HEADER_CHARS) + '\nS1,Robin,2024-05-01\n'
    expect(shippedDetectFileType(hostile)).toBe('ebird')
    expect(detectExportType(hostile)).toBe('unknown')
  })

  it('and for a file with no line break at all, which the old read lowercased whole', () => {
    // `firstLine` never copied this shape, so it looked free -- but detectExportType
    // then called .toLowerCase() on the entire file (10.2 ms and a 50 MB allocation
    // at 50 MB), and observationsCache parked the whole string in its module-scope
    // cache as `headerLine` for the session.
    expect(detectExportType(ML_PREFIX + 'x'.repeat(MAX_HEADER_CHARS))).toBe('unknown')
    expect(detectExportType(ML_PREFIX + 'x'.repeat(MAX_HEADER_CHARS - ML_PREFIX.length))).toBe('ml')
  })

  it('reads at most MAX_SCAN_READS characters of a hostile file (work done)', () => {
    const hostile = ML_PREFIX + 'x'.repeat(5_000_000) + '\n1,Photo,Robin\n'
    let reads = 0
    const counted = new Proxy(
      { length: hostile.length, charCodeAt: (i: number) => { reads += 1; return hostile.charCodeAt(i) } },
      {
        get(target, prop, receiver) {
          if (typeof prop === 'string' && /^[0-9]+$/.test(prop)) { reads += 1; return hostile[Number(prop)] }
          return Reflect.get(target, prop, receiver)
        },
      },
    ) as unknown as string

    expect(detectExportType(counted)).toBe('unknown')
    expect(reads).toBeLessThanOrEqual(MAX_SCAN_READS)
    // Guard the guard: the counter is wired, so the bound above is not vacuous.
    expect(reads).toBeGreaterThan(MAX_HEADER_CHARS / 2)
  })
})

describe('the sniffer is looser than the parsers, so a refusal never turns away a usable file', () => {
  // Files the real parsers accept. If the sniffer called any of these 'unknown',
  // Settings would refuse an upload the app could have used.
  const ML_ACCEPTED = [
    DEMO_ML,
    'Catalog Number,Common Name,Format\n1,American Robin,Photo\n',
    'ML Catalog Number,Format,Common Name\n1,Photo,American Robin\n',
    'CATALOG NUMBER,COMMON NAME,FORMAT\n1,American Robin,Photo\n',
  ]
  const EBIRD_ACCEPTED = [
    DEMO_EBIRD,
    'Submission ID,Common Name,Date\nS1,American Robin,2024-05-01\n',
    'submission id,common name,date\nS1,American Robin,2024-05-01\n',
  ]

  it.each(ML_ACCEPTED.map((c, i) => [i, c] as const))(
    'parseMLExport accepts ML sample %i, and the sniffer calls it ml',
    (_i, csv) => {
      expect(() => parseMLExport(csv)).not.toThrow()   // non-vacuity: the parser really takes it
      expect(detectExportType(csv)).toBe('ml')
    },
  )

  it.each(EBIRD_ACCEPTED.map((c, i) => [i, c] as const))(
    'parseEbirdObservations accepts eBird sample %i, and the sniffer calls it ebird',
    (_i, csv) => {
      expect(() => parseEbirdObservations(csv)).not.toThrow()
      expect(detectExportType(csv)).toBe('ebird')
    },
  )

  it('is strictly looser: a header the sniffer accepts can still fail the parser', () => {
    // The sniffer does not check `Common Name`, so this is 'ml' here and throws in
    // the parser. That direction is fine and is why Multimedia keeps both gates.
    const partial = 'Catalog Number,Format\n1,Photo'
    expect(detectExportType(partial)).toBe('ml')
    expect(() => parseMLExport(partial)).toThrow(/INVALID_ML_EXPORT/)
  })
})

describe('the two exports are not confusable', () => {
  it('an eBird backup is never called an ML export, despite its ML Catalog Numbers column', () => {
    const header = DEMO_EBIRD.split('\n')[0].toLowerCase()
    // The premise, asserted rather than assumed: the substring really is there.
    expect(header).toContain('catalog number')
    expect(header).not.toContain('format')
    expect(detectExportType(DEMO_EBIRD)).toBe('ebird')
  })

  it('an ML export is never called an eBird backup, despite its eBird Checklist ID column', () => {
    const header = DEMO_ML.split('\n')[0].toLowerCase()
    expect(header).toContain('ebird checklist id')
    expect(header).not.toContain('submission id')
    expect(detectExportType(DEMO_ML)).toBe('ml')
  })
})

describe('it does not split or regex the whole file (drift guard)', () => {
  it('reads the header through firstLine and nothing else', () => {
    const src = stripComments(
      readFileSync(new URL('./detectExportType.ts', import.meta.url), 'utf8'),
    )
    // The two ways the old spelling touched the whole export: `split` over every
    // line of it, and a regex whose subject stays in the engine's last-match state.
    for (const banned of [/\.split\(/, /\.slice\(/, /\.substring\(/, /\.search\(/, /\.match\(/, /\.replace\(/]) {
      expect([banned.source, src.match(banned)?.[0] ?? null]).toEqual([banned.source, null])
    }
    // Non-vacuity: the file was really read, and it really goes through firstLine.
    expect(src.length).toBeGreaterThan(200)
    expect(src).toContain('firstLine(text)')
    // The guard can fail, and does not fire on the module's own prose about it.
    expect(stripComments('const h = text.split(/\\r?\\n/)[0]')).toMatch(/\.split\(/)
    expect(stripComments('// never text.split(/\\r?\\n/)[0]')).not.toMatch(/\.split\(/)
  })
})
