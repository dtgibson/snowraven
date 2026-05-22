export function normalizeSpeciesName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').trim()
}

export function isSpuhOrSlash(name: string): boolean {
  return name.endsWith(' sp.') || name.includes('/')
}
