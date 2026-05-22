export interface LifeListEntry {
  commonName: string
  scientificName: string
  taxonomicOrder: number
  catalogIds: string[]
  isNonBird?: boolean
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        field += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(field)
      field = ''
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
  if (parenIdx === -1) return name
  return name.slice(0, parenIdx).trim()
}

function parseCatalogIds(raw: string): string[] {
  if (!raw.trim()) return []
  return raw
    .split(/[\s,]+/)
    .map(s => s.replace(/^ML/i, '').trim())
    .filter(s => /^\d+$/.test(s))
}

function col(cols: string[], idx: number): string {
  return cols[idx]?.trim().replace(/^"|"$/g, '') ?? ''
}

export function parseLifeList(text: string): LifeListEntry[] {
  const lines = text.split(/\r?\n/)
  const headerLine = lines[0]?.trim()

  if (!headerLine) throw new Error('INVALID_EBIRD')

  const headers = parseCSVLine(headerLine).map(h =>
    h.trim().replace(/^"|"$/g, '').toLowerCase()
  )

  const commonNameIdx = headers.findIndex(h => h === 'common name')
  if (commonNameIdx === -1) throw new Error('INVALID_EBIRD')

  const scientificNameIdx = headers.findIndex(h => h === 'scientific name')
  const taxonomicOrderIdx = headers.findIndex(h => h === 'taxonomic order')
  const mlCatalogIdx = headers.findIndex(h => h === 'ml catalog numbers')

  type Entry = { scientificName: string; taxonomicOrder: number; catalogIds: Set<string> }
  const speciesMap = new Map<string, Entry>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCSVLine(line)

    const rawName = col(cols, commonNameIdx)
    if (!rawName || isExcluded(rawName)) continue
    const commonName = normalizeSpeciesName(rawName)

    const rawTaxOrder = col(cols, taxonomicOrderIdx)
    const taxOrder =
      rawTaxOrder && /^\d+(\.\d+)?$/.test(rawTaxOrder)
        ? parseFloat(rawTaxOrder)
        : Infinity

    const newIds = mlCatalogIdx >= 0 ? parseCatalogIds(col(cols, mlCatalogIdx)) : []

    const existing = speciesMap.get(commonName)
    if (!existing) {
      speciesMap.set(commonName, {
        scientificName: col(cols, scientificNameIdx),
        taxonomicOrder: taxOrder,
        catalogIds: new Set(newIds),
      })
    } else {
      if (taxOrder < existing.taxonomicOrder) existing.taxonomicOrder = taxOrder
      for (const id of newIds) existing.catalogIds.add(id)
    }
  }

  const entries: LifeListEntry[] = Array.from(speciesMap.entries()).map(
    ([commonName, data]) => ({
      commonName,
      scientificName: data.scientificName,
      taxonomicOrder: data.taxonomicOrder,
      catalogIds: Array.from(data.catalogIds),
    })
  )

  entries.sort((a, b) => {
    const aFin = isFinite(a.taxonomicOrder)
    const bFin = isFinite(b.taxonomicOrder)
    if (aFin && bFin) return a.taxonomicOrder - b.taxonomicOrder
    if (aFin) return -1
    if (bFin) return 1
    return a.commonName.localeCompare(b.commonName)
  })

  return entries
}
