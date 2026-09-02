/// <reference types="node" />
// Guard for the streaming rewrite in improve: large-file-and-memory-handling.
//
// `parseEbirdObservations` used to call a `parseCSV` that returned every cell of the
// export as one `string[][]`, and held that grid alive for the whole entry-building
// loop. On the reference 6.6 MB / 21,369-row export the grid peaked around 19x the
// file size, dominated by the cons-string rope nodes `field += ch` builds, and it is
// what runs a large export out of worker heap. It now streams a row at a time.
//
// Two separate things are proved here, and neither is an elapsed time or a byte
// figure (`.claude/rules/testing.md`):
//
//   1. OUTPUT IS UNCHANGED. CLAUDE.md / DECISIONS.md (v0.5.85): when a refactor
//      relocates code, prove it against the pre-change revision rather than reasoning
//      about it. The whole pre-change parser is reproduced verbatim below as a
//      differential oracle — only its two top-level names are prefixed `old` so both
//      can live in one file — and swept over the tracked demo export, the real export
//      when one is present, hand-written malformed probes, and every string over the
//      CSV control alphabet up to length 5.
//
//   2. AT MOST ONE ROW ARRAY IS LIVE. Asserted STRUCTURALLY, by array identity: the
//      row stream hands out one array, cleared and refilled. The same measurement run
//      against the pre-change parser returns one array PER ROW, so the assertion is
//      non-vacuous by construction rather than by a mutation someone has to remember
//      to re-run.
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import type { ObservationEntry } from '../types'
import { parseEbirdObservations, streamCsvRows } from './parseEbirdObservations'

// ---------------------------------------------------------------------------
// the pre-change parser, verbatim
// ---------------------------------------------------------------------------

// Full CSV parser handling quoted fields with embedded newlines.
// Follows the same character-level approach required by all eBird CSV parsers
// in this project — line-splitting breaks on multi-line quoted fields.
function oldParseCSV(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = content.charCodeAt(0) === 0xFEFF ? 1 : 0

  while (i < content.length) {
    const ch = content[i]

    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        field += '"'
        i += 2
      } else {
        inQuotes = !inQuotes
        i++
      }
      continue
    }

    if (ch === ',' && !inQuotes) {
      row.push(field)
      field = ''
      i++
      continue
    }

    if ((ch === '\r' || ch === '\n') && !inQuotes) {
      if (ch === '\r' && content[i + 1] === '\n') i++
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i++
      continue
    }

    field += ch
    i++
  }

  if (field || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  return rows
}

function oldParseEbirdObservations(content: string): ObservationEntry[] {
  const rows = oldParseCSV(content)
  if (rows.length === 0) throw new Error('INVALID_EBIRD')

  const headers = rows[0].map(h => h.trim().toLowerCase())

  const submissionIdIdx       = headers.findIndex(h => h === 'submission id')
  const commonNameIdx         = headers.findIndex(h => h === 'common name')
  const sciNameIdx            = headers.findIndex(h => h === 'scientific name')
  const dateIdx               = headers.findIndex(h => h === 'date')
  const locationIdx           = headers.findIndex(h => h === 'location')
  const locationIdIdx         = headers.findIndex(h => h === 'location id')
  const latitudeIdx           = headers.findIndex(h => h === 'latitude')
  const longitudeIdx          = headers.findIndex(h => h === 'longitude')
  const countyIdx             = headers.findIndex(h => h === 'county')
  const countIdx              = headers.findIndex(h => h === 'count')
  const breedingCodeIdx       = headers.findIndex(h => h === 'breeding code')
  const speciesCommentsIdx    = headers.findIndex(h => h === 'species comments' || h === 'observation details')
  const catalogNumbersIdx     = headers.findIndex(h => h === 'ml catalog numbers')
  const timeIdx               = headers.findIndex(h => h === 'time')
  const durationIdx           = headers.findIndex(h => h === 'duration min' || h === 'duration (min)')
  const distanceIdx           = headers.findIndex(h => h === 'distance traveled (km)')
  const areaIdx               = headers.findIndex(h => h === 'area covered (ha)')
  const protocolIdx           = headers.findIndex(h => h === 'protocol')
  const numObserversIdx       = headers.findIndex(h => h === 'number of observers')
  const allObsReportedIdx     = headers.findIndex(h => h === 'all obs reported')
  const checklistCommentsIdx  = headers.findIndex(h => h === 'checklist comments')
  const stateProvinceIdx      = headers.findIndex(h =>
    h === 'state/province code' || h === 'state province code' || h === 'state/province'
  )

  if (submissionIdIdx === -1 || commonNameIdx === -1 || dateIdx === -1) {
    throw new Error('INVALID_EBIRD')
  }

  const entries: ObservationEntry[] = []

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    if (cols.length === 1 && cols[0].trim() === '') continue

    const commonName = cols[commonNameIdx]?.trim() ?? ''
    if (!commonName) continue

    const submissionId    = cols[submissionIdIdx]?.trim() ?? ''
    const scientificName  = sciNameIdx >= 0    ? (cols[sciNameIdx]?.trim() ?? '')          : ''
    const date            = cols[dateIdx]?.trim() ?? ''
    const location        = locationIdx >= 0   ? (cols[locationIdx]?.trim() ?? '')         : ''
    const locationId      = locationIdIdx >= 0 ? (cols[locationIdIdx]?.trim() ?? '')       : ''

    const rawLat  = latitudeIdx >= 0  ? (cols[latitudeIdx]?.trim() ?? '')  : ''
    const rawLng  = longitudeIdx >= 0 ? (cols[longitudeIdx]?.trim() ?? '') : ''
    const latNum  = parseFloat(rawLat)
    const lngNum  = parseFloat(rawLng)
    const latitude  = rawLat  && !Number.isNaN(latNum)  ? latNum  : null
    const longitude = rawLng  && !Number.isNaN(lngNum)  ? lngNum  : null

    const rawCount   = countIdx >= 0 ? (cols[countIdx]?.trim() ?? '') : ''
    const countInt   = parseInt(rawCount, 10)
    const count      = Number.isNaN(countInt) ? null : countInt

    const rawCode     = breedingCodeIdx >= 0 ? (cols[breedingCodeIdx]?.trim() ?? '') : ''
    const firstToken  = rawCode.split(/\s+/)[0] ?? ''
    const breedingCode = firstToken || null

    const speciesComments = speciesCommentsIdx >= 0 ? (cols[speciesCommentsIdx]?.trim() ?? '') : ''

    const rawCatalog = catalogNumbersIdx >= 0 ? (cols[catalogNumbersIdx]?.trim() ?? '') : ''
    const catalogIds = rawCatalog
      ? rawCatalog.split(/[\s,]+/).map(id => id.replace(/^ML/i, '').trim()).filter(id => /^\d+$/.test(id))
      : []

    const county = countyIdx >= 0 ? (cols[countyIdx]?.trim() || null) : null

    // Optional checklist-level fields — only included when the column exists in the CSV.
    // Absent column → property omitted (undefined); blank value → null.
    const optFields: {
      time?: string | null
      duration?: number | null
      distance?: number | null
      area?: number | null
      protocol?: string | null
      numObservers?: number | null
      allObsReported?: boolean | null
      checklistComments?: string
      stateProvince?: string | null
    } = {}

    if (timeIdx >= 0) {
      optFields.time = cols[timeIdx]?.trim() || null
    }
    if (durationIdx >= 0) {
      const raw = cols[durationIdx]?.trim() ?? ''
      const parsed = parseInt(raw, 10)
      optFields.duration = raw && !Number.isNaN(parsed) ? parsed : null
    }
    if (distanceIdx >= 0) {
      const raw = cols[distanceIdx]?.trim() ?? ''
      const parsed = parseFloat(raw)
      optFields.distance = raw && !Number.isNaN(parsed) ? parsed : null
    }
    if (areaIdx >= 0) {
      const raw = cols[areaIdx]?.trim() ?? ''
      const parsed = parseFloat(raw)
      optFields.area = raw && !Number.isNaN(parsed) ? parsed : null
    }
    if (protocolIdx >= 0) {
      optFields.protocol = cols[protocolIdx]?.trim() || null
    }
    if (numObserversIdx >= 0) {
      const raw = cols[numObserversIdx]?.trim() ?? ''
      const parsed = parseInt(raw, 10)
      optFields.numObservers = raw && !Number.isNaN(parsed) ? parsed : null
    }
    if (allObsReportedIdx >= 0) {
      const raw = cols[allObsReportedIdx]?.trim() ?? ''
      optFields.allObsReported = raw === '1' ? true : raw === '0' ? false : null
    }
    if (checklistCommentsIdx >= 0) {
      optFields.checklistComments = cols[checklistCommentsIdx]?.trim() ?? ''
    }
    if (stateProvinceIdx >= 0) {
      optFields.stateProvince = cols[stateProvinceIdx]?.trim() || null
    }

    entries.push({
      submissionId, commonName, scientificName, date, location, locationId,
      latitude, longitude, county, count, breedingCode, speciesComments, catalogIds,
      ...optFields,
    })
  }

  return entries
}

// ---------------------------------------------------------------------------
// corpora
// ---------------------------------------------------------------------------

// The synthetic demo export, which IS tracked (website/tools/demo-data and data/ are
// both gitignored, and a guard test may not read a gitignored file unconditionally).
const DEMO = readFileSync(
  new URL('../../../website/demo/snowraven-demo-ebird-backup.csv', import.meta.url),
  'utf8',
)

// The developer machine's real export, when there is one. Gitignored, so absent on a
// fresh clone and in CI: those runs get the demo sweep and the probes, which is why
// the probes carry the discriminating power rather than the real data.
const REAL_URL = new URL('../../../data/ebird-backup.csv', import.meta.url)
const REAL = existsSync(REAL_URL) ? readFileSync(REAL_URL, 'utf8') : null

const HEADER =
  'Submission ID,Common Name,Scientific Name,Date,Location,Location ID,Latitude,Longitude,' +
  'County,Count,Breeding Code,Species Comments,ML Catalog Numbers,Time,Duration Min,' +
  'Distance Traveled (km),Area Covered (ha),Protocol,Number of Observers,All Obs Reported,' +
  'Checklist Comments,State/Province Code'

/** Hand-written malformed and edge probes — every shape the character-level walk has
 *  a branch for. Each is a whole file, header included where one is meant to parse. */
const EDGE_PROBES: Array<[string, string]> = [
  ['empty file', ''],
  ['bare BOM', '﻿'],
  ['header only, no newline', HEADER],
  ['header only, trailing newline', HEADER + '\n'],
  ['header only, trailing CRLF', HEADER + '\r\n'],
  ['BOM then header then one row', '﻿' + HEADER + '\n' + 'S1,Sora,Porzana carolina,2024-04-09' + ',,,,,,,,,,,,,,,,,,'],
  ['no trailing newline on the last row', HEADER + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,,'],
  ['CRLF line endings throughout', HEADER.replace(/\n/g, '') + '\r\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,,\r\n'],
  ['lone CR inside a field is NOT a line break', HEADER + '\nS1,So\rra,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,,\n'],
  ['quoted field containing commas', HEADER + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,"a, b, c",\n'],
  ['quoted field containing a newline', HEADER + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,"line one\nline two",\n'],
  ['quoted field containing a CRLF', HEADER + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,"line one\r\nline two",\n'],
  ['escaped double quotes', HEADER + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,"she said ""hi""",\n'],
  ['unterminated quote runs to EOF', HEADER + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,"never closed\n'],
  ['ragged row, too few fields', HEADER + '\nS1,Sora,Porzana carolina\n'],
  ['ragged row, too many fields', HEADER + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,,,extra,more\n'],
  ['blank line between rows', HEADER + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,,\n\nS2,Veery,Catharus fuscescens,2024-05-01,X,L1,1,2,C,3,,,,,,,,,,,,\n'],
  ['blank common name skips the row', HEADER + '\nS1,,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,,,,,,,,\n'],
  ['whitespace-only file', '   \n\t\n'],
  ['header missing every required column', 'A,B,C\n1,2,3\n'],
  ['header missing only Date', 'Submission ID,Common Name\nS1,Sora\n'],
  ['quoted header cells', '"Submission ID","Common Name","Scientific Name","Date"\nS1,Sora,Porzana carolina,2024-04-09\n'],
  ['Observation Details alias for Species Comments', HEADER.replace('Species Comments', 'Observation Details') + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,note,,,,,,,,,,\n'],
  ['Duration (Min) alias', HEADER.replace('Duration Min', 'Duration (Min)') + '\nS1,Sora,Porzana carolina,2024-04-09,X,L1,1,2,C,3,,,,,17,,,,,,,\n'],
]

// Every string over the CSV control alphabet up to length 5 — 3,905 probes. The
// alphabet is exactly the characters the walk branches on, plus one ordinary
// character, so the enumeration covers each branch and every transition between them.
const CSV_ALPHABET = ['a', ',', '"', '\r', '\n']
const PROBE_MAX_LEN = 5

function enumerateProbes(alphabet: string[], maxLen: number): string[] {
  let level = ['']
  const out: string[] = []
  for (let len = 1; len <= maxLen; len++) {
    const next: string[] = []
    for (const prefix of level) for (const ch of alphabet) next.push(prefix + ch)
    out.push(...next)
    level = next
  }
  return out
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/** Copy each streamed row out, because the stream reuses one array — which is the
 *  contract the second describe block proves. */
function collectRows(content: string): string[][] {
  const out: string[][] = []
  for (const row of streamCsvRows(content)) out.push(row.slice())
  return out
}

/** Line and block comments removed, tracking string and template state so a `//`
 *  inside a literal is never mistaken for a comment. Same helper idea as
 *  entryChunk.test.ts, which is not exported. */
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

/** The whole-file grid this rewrite removed, as a type annotation. */
const GRID_TYPE = /string\[\]\[\]/

type Outcome = { threw: string } | { entries: ObservationEntry[] }

function outcome(run: () => ObservationEntry[]): Outcome {
  try {
    return { entries: run() }
  } catch (err) {
    return { threw: err instanceof Error ? err.message : String(err) }
  }
}

/** Every way the two parsers disagree on one input, as readable strings. */
function divergences(label: string, content: string): string[] {
  const found: string[] = []

  const streamed = collectRows(content)
  const gridded = oldParseCSV(content)
  if (JSON.stringify(streamed) !== JSON.stringify(gridded)) {
    found.push(`${label}: rows differ — streamed ${JSON.stringify(streamed)} vs grid ${JSON.stringify(gridded)}`)
  }

  const now = outcome(() => parseEbirdObservations(content))
  const before = outcome(() => oldParseEbirdObservations(content))
  if (JSON.stringify(now) !== JSON.stringify(before)) {
    found.push(`${label}: entries differ — new ${JSON.stringify(now)} vs old ${JSON.stringify(before)}`)
  }
  return found
}

// ---------------------------------------------------------------------------
// 1. output is unchanged
// ---------------------------------------------------------------------------

describe('the streaming parser is output-identical to the pre-change parser', () => {
  it('over the tracked demo export', () => {
    // Non-vacuity first: a corpus that parsed to nothing, or that had no quoted
    // field, would let a broken parser through with a clean sweep.
    const entries = parseEbirdObservations(DEMO)
    expect(entries.length).toBeGreaterThan(5_000)
    expect(DEMO).toContain('"')
    expect(entries.some(e => (e.checklistComments ?? '').includes(','))).toBe(true)

    expect(divergences('demo export', DEMO)).toEqual([])
  })

  const itReal = REAL === null ? it.skip : it
  itReal('over the real export on this machine (skipped where none is stored)', () => {
    const text = REAL as string
    expect(parseEbirdObservations(text).length).toBeGreaterThan(0)
    expect(divergences('real export', text)).toEqual([])
  })

  it('over the hand-written malformed and edge probes', () => {
    expect(EDGE_PROBES.length).toBe(24)
    const found = EDGE_PROBES.flatMap(([label, content]) => divergences(label, content))
    expect(found).toEqual([])
  })

  it('over every CSV control-alphabet string up to length 5, as a file body', () => {
    const probes = enumerateProbes(CSV_ALPHABET, PROBE_MAX_LEN)
    expect(probes.length).toBe(3_905)

    const found: string[] = []
    for (const probe of probes) {
      // as a whole file, and as a body under a valid header
      found.push(...divergences(`bare ${JSON.stringify(probe)}`, probe))
      found.push(...divergences(`body ${JSON.stringify(probe)}`, `${HEADER}\n${probe}`))
      if (found.length > 0) break // one report is enough; the label locates it
    }
    expect(found).toEqual([])
  })

  it('rejects the same inputs the pre-change parser rejected', () => {
    for (const bad of ['', '﻿', 'A,B,C\n1,2,3\n', 'Submission ID,Common Name\nS1,Sora\n']) {
      expect(() => parseEbirdObservations(bad)).toThrow('INVALID_EBIRD')
      expect(() => oldParseEbirdObservations(bad)).toThrow('INVALID_EBIRD')
    }
  })
})

// ---------------------------------------------------------------------------
// 2. at most one row array is live
// ---------------------------------------------------------------------------

describe('the row stream never materializes a grid', () => {
  it('hands out ONE array for the whole file, where the pre-change parser held one per row', () => {
    const seen = new Set<string[]>()
    let rows = 0
    for (const row of streamCsvRows(DEMO)) {
      seen.add(row)
      rows++
    }

    expect(rows).toBeGreaterThan(5_000)
    expect(seen.size).toBe(1) // at most one row array live, for any file size

    // The same measurement on the pre-change parser, so the assertion above is
    // known to be capable of failing: it held a distinct array for every row.
    const gridded = oldParseCSV(DEMO)
    expect(gridded.length).toBe(rows)
    expect(new Set(gridded).size).toBe(rows)
  })

  it('the reused array holds exactly the current row at each step', () => {
    const csv = 'a,b\nc,d\ne,f'
    const snapshots: string[][] = []
    let identity: string[] | null = null
    for (const row of streamCsvRows(csv)) {
      if (identity === null) identity = row
      expect(row).toBe(identity)     // same object every time
      snapshots.push(row.slice())    // …carrying this row's cells right now
    }
    expect(snapshots).toEqual([['a', 'b'], ['c', 'd'], ['e', 'f']])
  })

  it('is cleared between rows, so a shorter row never inherits the previous one', () => {
    expect(collectRows('a,b,c\nd\ne,f')).toEqual([['a', 'b', 'c'], ['d'], ['e', 'f']])
  })

  it('does not reintroduce a whole-file grid type in CODE (drift guard)', () => {
    // Comments are stripped first, for the reason entryChunk.test.ts strips them:
    // this module's own prose explains the grid it replaced, and a raw text scan
    // would match that explanation and fail on a correct file. Same trap, opposite
    // direction — there it invented an import edge, here it invents a regression.
    const src = stripComments(
      readFileSync(new URL('./parseEbirdObservations.ts', import.meta.url), 'utf8'),
    )
    expect(src).not.toMatch(GRID_TYPE)
    expect(src).not.toMatch(/Array<\s*Array<\s*string/)

    // The guard can fail: it matches the type in code, and does not match it in a
    // comment. Without both halves this is a scan whose silence proves nothing.
    expect(stripComments('const rows: string[][] = []')).toMatch(GRID_TYPE)
    expect(stripComments('// once returned a string[][] of every cell')).not.toMatch(GRID_TYPE)
    expect(stripComments('/* a string[][] grid */ const n = 1')).not.toMatch(GRID_TYPE)

    // STATED LIMIT, measured rather than assumed. Three ways to put the grid back
    // were tried against this file's suites. An annotated accumulator is caught
    // here. A naive `[...streamCsvRows(text)]` is caught 47 times over, because the
    // stream reuses its array, so collecting it produces one row repeated — an
    // accidental grid cannot be silently correct. What is NOT caught is a
    // DELIBERATE re-materialization that copies every row and lets TypeScript infer
    // the type: it is correct, only wasteful, and no deterministic assertion in a
    // unit test can see the difference. Code review and the heap measurement in
    // PR.md are the defense there; this guard does not claim it.
  })
})
