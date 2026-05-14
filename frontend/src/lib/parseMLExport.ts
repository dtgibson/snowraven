import type { LifeListEntry } from './parseLifeList'

export interface MLExportResult {
  entries: LifeListEntry[]
  mediaMap: Record<string, string>
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

function col(cols: string[], idx: number): string {
  return cols[idx]?.trim().replace(/^"|"$/g, '') ?? ''
}

function isExcluded(name: string): boolean {
  return name.endsWith(' sp.') || name.includes('/') || name.includes(' x ')
}

function normalizeSpeciesName(name: string): string {
  const parenIdx = name.indexOf('(')
  if (parenIdx === -1) return name
  return name.slice(0, parenIdx).trim()
}

const VALID_FORMATS = new Set(['Photo', 'Audio', 'Video'])

export function parseMLExport(text: string): MLExportResult {
  const lines = text.split(/\r?\n/)
  const headerLine = lines[0]?.trim()
  if (!headerLine) throw new Error('INVALID_ML_EXPORT')

  const headers = parseCSVLine(headerLine).map(h =>
    h.trim().replace(/^"|"$/g, '').toLowerCase()
  )

  const catalogIdx = headers.findIndex(
    h => h === 'catalog number' || h === 'ml catalog number'
  )
  const commonNameIdx = headers.findIndex(h => h === 'common name')
  const scientificNameIdx = headers.findIndex(h => h === 'scientific name')
  const formatIdx = headers.findIndex(h => h === 'format')

  if (catalogIdx === -1 || commonNameIdx === -1 || formatIdx === -1) {
    throw new Error('INVALID_ML_EXPORT')
  }

  const mediaMap: Record<string, string> = {}
  type Entry = { scientificName: string; catalogIds: Set<string> }
  const speciesMap = new Map<string, Entry>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCSVLine(line)

    const rawId = col(cols, catalogIdx).replace(/^ML/i, '').trim()
    if (!rawId || !/^\d+$/.test(rawId)) continue

    const rawName = col(cols, commonNameIdx)
    if (!rawName || isExcluded(rawName)) continue
    const commonName = normalizeSpeciesName(rawName)

    const format = col(cols, formatIdx)
    if (!VALID_FORMATS.has(format)) continue

    mediaMap[rawId] = format

    const existing = speciesMap.get(commonName)
    if (!existing) {
      speciesMap.set(commonName, {
        scientificName: scientificNameIdx >= 0 ? col(cols, scientificNameIdx) : '',
        catalogIds: new Set([rawId]),
      })
    } else {
      existing.catalogIds.add(rawId)
    }
  }

  const entries: LifeListEntry[] = Array.from(speciesMap.keys())
    .sort((a, b) => a.localeCompare(b))
    .map(commonName => {
      const data = speciesMap.get(commonName)!
      return {
        commonName,
        scientificName: data.scientificName,
        taxonomicOrder: Infinity,
        catalogIds: Array.from(data.catalogIds),
      }
    })

  return { entries, mediaMap }
}
