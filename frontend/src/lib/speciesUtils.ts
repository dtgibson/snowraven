// Memoized: this runs ~12× per observation across the stats passes (~240k calls on a
// 20k-row backup), but there are only a few hundred distinct names. The result is a
// pure function of the input, so caching is always correct; the map is bounded by the
// number of distinct raw names (small).
const _normCache = new Map<string, string>()

export function normalizeSpeciesName(name: string): string {
  const hit = _normCache.get(name)
  if (hit !== undefined) return hit
  const norm = name.replace(/\s*\([^)]*\)\s*$/, '').trim()
  _normCache.set(name, norm)
  return norm
}

export function isSpuhOrSlash(name: string): boolean {
  return name.endsWith(' sp.') || name.includes('/')
}
