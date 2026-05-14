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

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++ }
      else inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      result.push(field); field = ''
    } else {
      field += char
    }
  }
  result.push(field)
  return result
}

function isExcluded(name: string): boolean {
  return name.endsWith(' sp.') || name.includes('/') || name.includes(' x ')
}

function normalizeSpeciesName(name: string): string {
  const parenIdx = name.indexOf('(')
  return parenIdx === -1 ? name : name.slice(0, parenIdx).trim()
}

export function parseBreedingCodes(content: string): BreedingData {
  const lines = content.split(/\r?\n/)
  const headerLine = lines[0]?.trim()
  if (!headerLine) throw new Error('INVALID_EBIRD')

  const headers = parseCSVLine(headerLine).map(h =>
    h.trim().toLowerCase().replace(/^"|"$/g, '')
  )

  const commonNameIdx = headers.findIndex(h => h === 'common name')
  if (commonNameIdx === -1) throw new Error('INVALID_EBIRD')

  const sciNameIdx = headers.findIndex(h => h === 'scientific name')
  const breedingCodeIdx = headers.findIndex(h => h === 'breeding code')

  if (breedingCodeIdx === -1) {
    return { entries: [], codesPresent: [], hasBreedingCodeColumn: false }
  }

  const entryMap = new Map<string, BreedingEntry>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCSVLine(line)

    const rawName = cols[commonNameIdx]?.trim().replace(/^"|"$/g, '') ?? ''
    if (!rawName || isExcluded(rawName)) continue

    const name = normalizeSpeciesName(rawName)
    const sciName = sciNameIdx !== -1
      ? (cols[sciNameIdx]?.trim().replace(/^"|"$/g, '') ?? '')
      : ''
    const code = cols[breedingCodeIdx]?.trim().replace(/^"|"$/g, '') ?? ''

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
