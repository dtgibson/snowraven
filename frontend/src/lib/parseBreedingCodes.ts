import { BREEDING_CODE_MAP, BREEDING_CODES } from './breedingCodes'
import { isNonCountableForm, truncateAtFirstParen } from './speciesUtils'

export interface BreedingEntry {
  commonName: string
  scientificName: string
  codes: Record<string, number>
}

export interface BreedingCodeRow {
  commonName: string
  scientificName: string
  date: string           // YYYY-MM-DD
  county: string | null
  code: string           // breeding code abbreviation (e.g. "CN")
}

export interface BreedingData {
  entries: BreedingEntry[]
  codesPresent: string[]
  hasBreedingCodeColumn: boolean
  rows: BreedingCodeRow[]  // raw per-observation rows for filter re-aggregation
}

export function aggregateBreedingRows(
  rows: BreedingCodeRow[]
): Pick<BreedingData, 'entries' | 'codesPresent'> {
  const entryMap = new Map<string, BreedingEntry>()
  for (const row of rows) {
    if (!entryMap.has(row.commonName)) {
      entryMap.set(row.commonName, { commonName: row.commonName, scientificName: row.scientificName, codes: {} })
    }
    const entry = entryMap.get(row.commonName)!
    entry.codes[row.code] = (entry.codes[row.code] ?? 0) + 1
  }
  const entries = [...entryMap.values()].sort((a, b) => a.commonName.localeCompare(b.commonName))
  const codesPresent = BREEDING_CODES
    .map(d => d.code)
    .filter(code => entries.some(e => (e.codes[code] ?? 0) > 0))
  return { entries, codesPresent }
}

// Full CSV parser that correctly handles quoted fields containing embedded
// newlines — which occur in eBird's Observation Details and Checklist
// Comments columns. The previous line-split approach broke whenever a row
// preceding a breeding-code entry had multi-line notes.
function parseCSV(content: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  // Strip UTF-8 BOM if present
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

/** Minimal per-observation shape needed to derive breeding rows (a subset of
 * ObservationEntry, so the parsed observations can be reused without re-parsing). */
export interface BreedingObsInput {
  commonName: string
  scientificName: string
  date: string
  county: string | null
  breedingCode: string | null
}

/** Whether the CSV header has a "Breeding Code" column (cheap first-line check). */
export function hasBreedingCodeColumn(content: string): boolean {
  const nl = content.search(/\r?\n/)
  const header = nl === -1 ? content : content.slice(0, nl)
  return header
    .split(',')
    .some(h => h.trim().replace(/^"|"$/g, '').toLowerCase() === 'breeding code')
}

/**
 * Derive breeding-code rows from already-parsed observations, applying the SAME
 * filters as parseBreedingCodes (exclude spuh/slash/hybrid, normalize the name at the
 * first parenthesis, keep only recognized codes). Lets the Breeding Codes tab reuse
 * the shared observations parse instead of re-parsing the ~20k-row CSV. Equivalence
 * with parseBreedingCodes is locked by a test.
 */
export function deriveBreedingRows(observations: readonly BreedingObsInput[]): BreedingCodeRow[] {
  const rows: BreedingCodeRow[] = []
  for (const o of observations) {
    const rawName = o.commonName?.trim() ?? ''
    if (!rawName || isNonCountableForm(rawName)) continue
    const code = o.breedingCode ?? ''
    if (!code || !BREEDING_CODE_MAP.has(code)) continue
    rows.push({
      commonName: truncateAtFirstParen(rawName),
      scientificName: o.scientificName ?? '',
      date: o.date ?? '',
      county: o.county ?? null,
      code,
    })
  }
  return rows
}

/** Build BreedingData from already-parsed observations + the raw text (for the
 * column-presence flag) — the no-re-parse counterpart of parseBreedingCodes. */
export function deriveBreedingData(observations: readonly BreedingObsInput[], content: string): BreedingData {
  if (!hasBreedingCodeColumn(content)) {
    return { entries: [], codesPresent: [], hasBreedingCodeColumn: false, rows: [] }
  }
  const rows = deriveBreedingRows(observations)
  return { ...aggregateBreedingRows(rows), hasBreedingCodeColumn: true, rows }
}

export function parseBreedingCodes(content: string): BreedingData {
  const rows = parseCSV(content)
  if (rows.length === 0) throw new Error('INVALID_EBIRD')

  const headers = rows[0].map(h => h.trim().toLowerCase())

  const commonNameIdx = headers.findIndex(h => h === 'common name')
  if (commonNameIdx === -1) throw new Error('INVALID_EBIRD')

  const sciNameIdx      = headers.findIndex(h => h === 'scientific name')
  const breedingCodeIdx = headers.findIndex(h => h === 'breeding code')
  const dateIdx         = headers.findIndex(h => h === 'date')
  const countyIdx       = headers.findIndex(h => h === 'county')

  if (breedingCodeIdx === -1) {
    return { entries: [], codesPresent: [], hasBreedingCodeColumn: false, rows: [] }
  }

  const entryMap = new Map<string, BreedingEntry>()
  const codeRows: BreedingCodeRow[] = []

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    if (cols.length === 1 && cols[0].trim() === '') continue

    const rawName = cols[commonNameIdx]?.trim() ?? ''
    if (!rawName || isNonCountableForm(rawName)) continue

    const name = truncateAtFirstParen(rawName)
    const sciName = sciNameIdx !== -1 ? (cols[sciNameIdx]?.trim() ?? '') : ''
    const rawCode = cols[breedingCodeIdx]?.trim() ?? ''
    const code = rawCode.split(/\s+/)[0] ?? ''

    if (!code || !BREEDING_CODE_MAP.has(code)) continue

    if (!entryMap.has(name)) {
      entryMap.set(name, { commonName: name, scientificName: sciName, codes: {} })
    }
    const entry = entryMap.get(name)!
    entry.codes[code] = (entry.codes[code] ?? 0) + 1

    const date   = dateIdx   >= 0 ? (cols[dateIdx]?.trim()   ?? '') : ''
    const county = countyIdx >= 0 ? (cols[countyIdx]?.trim() || null) : null
    codeRows.push({ commonName: name, scientificName: sciName, date, county, code })
  }

  const entries = [...entryMap.values()].sort((a, b) =>
    a.commonName.localeCompare(b.commonName)
  )

  const codesPresent = BREEDING_CODES
    .map(d => d.code)
    .filter(code => entries.some(e => (e.codes[code] ?? 0) > 0))

  return { entries, codesPresent, hasBreedingCodeColumn: true, rows: codeRows }
}
