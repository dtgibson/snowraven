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

// A countable life-list species excludes spuh ("Gull sp."), slash ("Greater/Lesser
// Scaup"), AND hybrids ("Mallard x American Black Duck") — the same rule the eBird/ML
// parsers and Frivolous Lists apply. `isSpuhOrSlash` deliberately omits the hybrid
// case (it's the minimal display-filter primitive behind the "Show sp./slash" display
// toggles in LifeList/SpeciesDetail), so anything that needs a true "life list" count
// must use this instead.
//
// IMPORTANT: this tests the string it is GIVEN, and gives the wrong answer for
// intergrades when that string is a raw exported name — so every life-list COUNT path
// must pass an already-normalized name, or better, call `isNonCountableObservedName`
// below, which owns the raw-name case. The one deliberate raw-name caller is
// `frivolousLists.ts`, which classifies raw names on purpose (see the note there);
// that is not a pattern to copy.
export function isNonCountableSpecies(name: string): boolean {
  return isSpuhOrSlash(name) || name.includes(' x ')
}

// The countable-life-list predicate for a RAW observed name, i.e. `commonName` straight
// off an eBird export, before `normalizeSpeciesName` has stripped its trailing
// parenthetical. Count paths must use THIS, not `isNonCountableSpecies` on a raw name.
//
// Why the distinction is load-bearing: the hybrid marker is a " x " in the BASE name,
// but a trailing parenthetical can contain its own " x " for an intraspecific
// intergrade, which is a perfectly countable bird:
//
//   "Mallard x American Black Duck (hybrid)"    → base "Mallard x American Black Duck"
//                                                 → a true inter-species hybrid, NOT countable
//   "Yellow-rumped Warbler (Myrtle x Audubon's)" → base "Yellow-rumped Warbler"
//                                                 → a countable Yellow-rumped Warbler
//
// Testing the raw name conflates the two and silently drops 36 such intergrades in the
// current eBird taxonomy (Northern Flicker (Yellow-shafted x Red-shafted), Dark-eyed
// Junco (Oregon x Pink-sided), Green-winged Teal (Eurasian x American), Redpoll
// (Common x Hoary), …), which erases the species outright when the intergrade is a
// birder's only record of it.
//
// The two halves deliberately test DIFFERENT strings, and that asymmetry is the point:
//   - the " x " hybrid check runs on the NORMALIZED name, so a parenthetical intergrade
//     is judged on its base species;
//   - the spuh/slash check runs on the RAW name, preserving today's behavior for
//     subspecies-group slashes ("Canada Goose (moffitti/maxima)"), which stay excluded.
// Normalizing the slash check too would newly ADMIT 88 such names and raise people's
// life-list totals — a product decision, not a mechanical fix, so it is not done here.
export function isNonCountableObservedName(rawName: string): boolean {
  return isSpuhOrSlash(rawName) || normalizeSpeciesName(rawName).includes(' x ')
}
