import { isNonCountableForm, truncateAtFirstParen } from './speciesUtils'

export interface LifeListEntry {
  commonName: string
  scientificName: string
  taxonomicOrder: number
  catalogIds: string[]
  isNonBird?: boolean
  /**
   * True when eBird counts NONE of the raw observed names behind this entry.
   *
   * `commonName` here is a DISPLAY name, and under "Show subspecies" off it is the
   * normalized base, which destroys the form the countability rule judges:
   * "Brewster's Warbler (hybrid)" collapses to "Brewster's Warbler", which reads
   * exactly like a species. So the verdict has to be carried alongside the name
   * rather than recomputed from it.
   *
   * Monotone OR over the entry's raw names: countable if AT LEAST ONE counts.
   * That is the same shape as the escapee rule (a species counts if one of its
   * observations does), and it is what makes a merged entry behave sensibly: a
   * birder holding both "Redpoll (Common/Hoary)" and a plain "Redpoll" has a
   * countable Redpoll either way.
   *
   * Optional because the CSV parsers drop non-countable rows at parse time, so
   * entries they produce are countable by construction and leave it undefined.
   */
  nonCountable?: boolean
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
    if (!rawName || isNonCountableForm(rawName)) continue
    const commonName = truncateAtFirstParen(rawName)

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
