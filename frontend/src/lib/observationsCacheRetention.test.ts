/// <reference types="node" />
// Guard for change 2 of improve: large-file-and-memory-handling.
//
// `observationsCache` cached `{ text, observations }` at module scope for the whole
// session. `text` had exactly ONE consumer — BreedingCodeList handed it to
// `deriveBreedingData`, which uses it only for `hasBreedingCodeColumn`, which reads
// the FIRST LINE. So the entire export was retained to answer a boolean: 13.2 MB on
// the reference 6.6 MB / 21,369-row file, and ~116 MB at 500k rows.
//
// Three things are proved, none of them a byte product (`.claude/rules/testing.md`):
//
//   1. THE CACHE RETAINS A LINE, NOT A FILE — as a character count and a key set,
//      not as a heap figure.
//   2. THE BREEDING CODES TAB SEES WHAT IT SAW BEFORE — `deriveBreedingData` given
//      the header line returns exactly what it returns given the whole text, swept
//      over the tracked demo export and over probes. This is the differential
//      oracle for the change, the same standard change 1 is held to.
//   3. `firstLine` EQUALS THE SLICE IT REPLACES, and the module does not go back to
//      either spelling that would silently undo the whole change. TWO were measured
//      during this build, and the second was live in the first draft of the fix:
//      a `.slice()` result REFERENCES its parent (a 309-character header keeps a
//      148 MB export alive), and a regex METHOD leaves its subject in the engine's
//      last-match state, so `content.search(/\r?\n/)` retains the file however the
//      answer is used. `indexOf` plus a character copy is the only form measured
//      clean. The equivalence tests cannot see this — the slice form IS the oracle
//      they check against — so the drift guard is the part that catches it.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { deriveBreedingData } from './parseBreedingCodes'
import { parseEbirdObservations } from './parseEbirdObservations'

const mocks = vi.hoisted(() => ({ readFile: vi.fn() }))
vi.mock('./storage', () => ({
  storage: { readFile: (name: string) => mocks.readFile(name) },
}))

import {
  clearEbirdObservationsCache,
  firstLine,
  loadEbirdObservations,
} from './observationsCache'

const DEMO = readFileSync(
  new URL('../../../website/demo/snowraven-demo-ebird-backup.csv', import.meta.url),
  'utf8',
)

/** The spelling `firstLine` replaces, kept here as the oracle it must match. */
function sliceFirstLine(content: string): string {
  const nl = content.search(/\r?\n/)
  return nl === -1 ? content : content.slice(0, nl)
}

/** Comments stripped, so the module's own explanation of the trap is not mistaken
 *  for the trap. Same reason entryChunk.test.ts strips them. */
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

beforeEach(() => {
  clearEbirdObservationsCache()
  mocks.readFile.mockReset()
})

describe('the observations cache retains a header line, not the file', () => {
  it('returns exactly { headerLine, observations } — no whole-text field', async () => {
    mocks.readFile.mockResolvedValue(DEMO)
    const loaded = await loadEbirdObservations()
    expect(loaded).not.toBeNull()

    expect(Object.keys(loaded!).sort()).toEqual(['headerLine', 'observations'])
    expect('text' in loaded!).toBe(false)
    expect(loaded!.headerLine).toBe(sliceFirstLine(DEMO))
    expect(loaded!.observations.length).toBeGreaterThan(5_000)
  })

  it('holds a first line whose length is a header, on a file three orders larger', async () => {
    // Stated as CHARACTER COUNTS, which no engine's string representation can move.
    const header = DEMO.slice(0, DEMO.indexOf('\n'))
    const big = DEMO + DEMO.slice(DEMO.indexOf('\n') + 1).repeat(20)
    expect(big.length).toBeGreaterThan(20_000_000)

    mocks.readFile.mockResolvedValue(big)
    const loaded = await loadEbirdObservations()

    expect(loaded!.headerLine.length).toBe(header.length)
    expect(loaded!.headerLine.length).toBeLessThan(1_000)
    expect(big.length / loaded!.headerLine.length).toBeGreaterThan(50_000)
  })

  it('hides no file-length string anywhere in what it hands back', async () => {
    mocks.readFile.mockResolvedValue(DEMO)
    const loaded = await loadEbirdObservations()

    // Every string reachable from the result — the header line, and every field of
    // every entry — must be short. A retained export would show up as one long one.
    let longest = 0
    const consider = (v: unknown) => { if (typeof v === 'string' && v.length > longest) longest = v.length }
    consider(loaded!.headerLine)
    for (const entry of loaded!.observations) {
      for (const value of Object.values(entry)) {
        if (Array.isArray(value)) value.forEach(consider)
        else consider(value)
      }
    }
    expect(longest).toBeLessThan(2_000)
    expect(DEMO.length).toBeGreaterThan(1_000_000) // the corpus really is large
  })

  it('still memoizes: a second load re-reads nothing, and a clear re-reads', async () => {
    mocks.readFile.mockResolvedValue(DEMO)
    const a = await loadEbirdObservations()
    const b = await loadEbirdObservations()
    expect(b).toBe(a)
    expect(mocks.readFile).toHaveBeenCalledTimes(1)

    clearEbirdObservationsCache()
    const c = await loadEbirdObservations()
    expect(c).not.toBe(a)
    expect(mocks.readFile).toHaveBeenCalledTimes(2)
  })

  it('returns null when no eBird file is stored', async () => {
    mocks.readFile.mockResolvedValue(null)
    expect(await loadEbirdObservations()).toBeNull()
  })
})

describe('Breeding Codes sees exactly what it saw before', () => {
  it('deriveBreedingData on the header line equals deriveBreedingData on the whole file', () => {
    const observations = parseEbirdObservations(DEMO)
    const before = deriveBreedingData(observations, DEMO)
    const after = deriveBreedingData(observations, firstLine(DEMO))

    expect(after).toEqual(before)
    // Non-vacuity: the demo export HAS the column, so this is not two empty results.
    expect(before.hasBreedingCodeColumn).toBe(true)
    expect(before.rows.length).toBeGreaterThan(0)
  })

  it('agrees on a file WITHOUT a Breeding Code column too', () => {
    const csv = 'Submission ID,Common Name,Scientific Name,Date\nS1,Sora,Porzana carolina,2024-04-09\n'
    const observations = parseEbirdObservations(csv)
    const before = deriveBreedingData(observations, csv)

    expect(before.hasBreedingCodeColumn).toBe(false)
    expect(deriveBreedingData(observations, firstLine(csv))).toEqual(before)
  })
})

describe('firstLine is the slice it replaces, without the slice', () => {
  const PROBES: string[] = [
    '',
    'a',
    'a,b,c',
    'a,b,c\n',
    'a,b,c\nd,e,f',
    'a,b,c\r\nd,e,f',
    '\n',
    '\r\n',
    '\r',                       // a lone CR is NOT a line break for /\r?\n/
    'a\rb\nc',                  // …so it stays inside the first line
    'a\r\r\nb',
    '﻿a,b,c\nd',           // BOM is kept: hasBreedingCodeColumn sees raw text
    'Breeding Code',
    '"Submission ID","Breeding Code"\nrow',
  ]

  it('matches content.slice(0, search(/\\r?\\n/)) on every probe', () => {
    for (const probe of PROBES) {
      expect([probe, firstLine(probe)]).toEqual([probe, sliceFirstLine(probe)])
    }
    expect(PROBES.length).toBe(14)
  })

  it('matches it on every string over the line-break alphabet up to length 4', () => {
    const alphabet = ['a', '\r', '\n', '﻿']
    let level = ['']
    let checked = 0
    for (let len = 1; len <= 4; len++) {
      const next: string[] = []
      for (const prefix of level) for (const ch of alphabet) next.push(prefix + ch)
      for (const probe of next) {
        expect([probe, firstLine(probe)]).toEqual([probe, sliceFirstLine(probe)])
        checked += 1
      }
      level = next
    }
    expect(checked).toBe(340)
  })

  it('matches it on the real demo export', () => {
    expect(firstLine(DEMO)).toBe(sliceFirstLine(DEMO))
  })

  it('the module neither slices the file nor runs a regex over it (drift guard)', () => {
    // TWO ways to retain the whole export while looking correct, both measured:
    // a `.slice()` result REFERENCES its parent, and a regex method leaves its
    // SUBJECT in the engine's last-match state. Either one silently undoes the
    // change, and neither is visible in a diff. See the note on firstLine.
    const src = stripComments(
      readFileSync(new URL('./observationsCache.ts', import.meta.url), 'utf8'),
    )
    for (const banned of [/\.slice\(/, /\.substring\(/, /\.search\(/, /\.match\(/, /\.replace\(/]) {
      expect(src).not.toMatch(banned)
    }

    // The guard can fail, and does not fire on the module's own prose about it.
    expect(stripComments('const h = text.slice(0, nl)')).toMatch(/\.slice\(/)
    expect(stripComments('const n = text.search(/x/)')).toMatch(/\.search\(/)
    expect(stripComments('// never text.slice(0, nl) nor text.search(/x/)')).not.toMatch(/\.slice\(|\.search\(/)
  })
})
