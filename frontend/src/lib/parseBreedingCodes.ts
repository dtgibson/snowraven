import { BREEDING_CODE_MAP, BREEDING_CODES } from './breedingCodes'

export interface BreedingEntry {
  commonName: string
  scientificName: string
  codes: Record<string, number>
}

export interface BreedingData {
  entries: BreedingEntry[]
  codesPresent: string[]
  hasBreedingCodeColumn: boolean
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

function isExcluded(name: string): boolean {
  return name.endsWith(' sp.') || name.includes('/') || name.includes(' x ')
}

function normalizeSpeciesName(name: string): string {
  const parenIdx = name.indexOf('(')
  return parenIdx === -1 ? name : name.slice(0, parenIdx).trim()
}

export function parseBreedingCodes(content: string): BreedingData {
  const rows = parseCSV(content)
  if (rows.length === 0) throw new Error('INVALID_EBIRD')

  const headers = rows[0].map(h => h.trim().toLowerCase())

  const commonNameIdx = headers.findIndex(h => h === 'common name')
  if (commonNameIdx === -1) throw new Error('INVALID_EBIRD')

  const sciNameIdx = headers.findIndex(h => h === 'scientific name')
  const breedingCodeIdx = headers.findIndex(h => h === 'breeding code')

  if (breedingCodeIdx === -1) {
    return { entries: [], codesPresent: [], hasBreedingCodeColumn: false }
  }

  const entryMap = new Map<string, BreedingEntry>()

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i]
    if (cols.length === 1 && cols[0].trim() === '') continue

    const rawName = cols[commonNameIdx]?.trim() ?? ''
    if (!rawName || isExcluded(rawName)) continue

    const name = normalizeSpeciesName(rawName)
    const sciName = sciNameIdx !== -1 ? (cols[sciNameIdx]?.trim() ?? '') : ''
    const rawCode = cols[breedingCodeIdx]?.trim() ?? ''
    const code = rawCode.split(/\s+/)[0] ?? ''

    if (!code || !BREEDING_CODE_MAP.has(code)) continue

    if (!entryMap.has(name)) {
      entryMap.set(name, { commonName: name, scientificName: sciName, codes: {} })
    }
    const entry = entryMap.get(name)!
    entry.codes[code] = (entry.codes[code] ?? 0) + 1
  }

  const entries = [...entryMap.values()].sort((a, b) =>
    a.commonName.localeCompare(b.commonName)
  )

  const codesPresent = BREEDING_CODES
    .map(d => d.code)
    .filter(code => entries.some(e => (e.codes[code] ?? 0) > 0))

  return { entries, codesPresent, hasBreedingCodeColumn: true }
}
