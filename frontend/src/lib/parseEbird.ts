import type { FileData } from '../types'
import { isNonCountableObservedName, truncateAtFirstParen } from './speciesUtils'

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

export function parseEbirdCSV(filename: string, content: string): FileData {
  const lines = content.split(/\r?\n/)
  const headerLine = lines[0]?.trim()

  if (!headerLine) {
    throw new Error('INVALID_EBIRD')
  }

  const headers = parseCSVLine(headerLine).map(h =>
    h.trim().toLowerCase().replace(/^"|"$/g, '')
  )

  const commonNameIdx = headers.findIndex(h => h === 'common name')
  if (commonNameIdx === -1) {
    throw new Error('INVALID_EBIRD')
  }

  const taxOrderIdx = headers.findIndex(h => h === 'taxonomic order')

  const species = new Set<string>()
  const taxOrder = new Map<string, number>()

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCSVLine(line)
    const name = cols[commonNameIdx]?.trim().replace(/^"|"$/g, '')
    if (!name || isNonCountableObservedName(name)) continue
    const normalized = truncateAtFirstParen(name)
    species.add(normalized)

    if (taxOrderIdx !== -1) {
      const orderNum = parseFloat(cols[taxOrderIdx]?.trim().replace(/^"|"$/g, '') ?? '')
      if (!isNaN(orderNum)) {
        const existing = taxOrder.get(normalized)
        taxOrder.set(normalized, existing === undefined ? orderNum : Math.min(existing, orderNum))
      }
    }
  }

  return { filename, species, taxOrder }
}
