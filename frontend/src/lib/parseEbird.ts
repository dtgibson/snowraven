import type { FileData } from '../types'

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

  const species = new Set<string>()
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseCSVLine(line)
    const name = cols[commonNameIdx]?.trim().replace(/^"|"$/g, '')
    if (name && !isExcluded(name)) species.add(normalizeSpeciesName(name))
  }

  return { filename, species }
}
