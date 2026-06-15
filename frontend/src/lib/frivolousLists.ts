// Frivolous Lists — three playful, self-completing collections for the bottom of
// the Statistics page, computed entirely from the loaded eBird backup:
//   • Avian American    — the 22 "American …" species, checked off as recorded
//   • California Dreamer — the 7 "California …" species
//   • Rainbow Warrior    — the earliest-first-seen bird whose name contains each
//                          rainbow color (red → violet)
// Pure logic, no I/O, no `Date.now()` (backup dates are immutable). Names fold to
// the parent via normalizeSpeciesName, so a subspecies entry still ticks its list.

import type { ObservationEntry } from '../types'
import { normalizeSpeciesName, isSpuhOrSlash } from './speciesUtils'

// Current eBird canonical common names (2024–25 taxonomy). A pre-split export
// (e.g. "Northern Goshawk" before the American Goshawk split) won't tick — a
// re-download resolves it; we intentionally keep no legacy-name alias map.
export const AVIAN_AMERICAN: readonly string[] = [
  'American Avocet', 'American Barn Owl', 'American Bittern', 'American Black Duck',
  'American Coot', 'American Crow', 'American Dipper', 'American Flamingo',
  'American Golden-Plover', 'American Goldfinch', 'American Goshawk', 'American Herring Gull',
  'American Kestrel', 'American Oystercatcher', 'American Pipit', 'American Redstart',
  'American Robin', 'American Three-toed Woodpecker', 'American Tree Sparrow', 'American White Pelican',
  'American Wigeon', 'American Woodcock',
]

export const CALIFORNIA_DREAMER: readonly string[] = [
  'California Condor', 'California Gnatcatcher', 'California Gull', 'California Quail',
  'California Scrub-Jay', 'California Thrasher', 'California Towhee',
]

export const RAINBOW_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'] as const
export type RainbowColor = typeof RAINBOW_COLORS[number]

// Whole-word, case-insensitive color matchers. Module-level constants with NO `/g`
// flag — `.test()` on a non-global regex is stateless, so there is no shared
// `lastIndex` hazard (CLAUDE.md). The `\b` boundaries mean "Red-tailed Hawk" fills
// red while "Reddish Egret", "Black Redstart", and "American Redstart" do not.
const COLOR_RE: Record<RainbowColor, RegExp> = {
  red: /\bred\b/i, orange: /\borange\b/i, yellow: /\byellow\b/i, green: /\bgreen\b/i,
  blue: /\bblue\b/i, indigo: /\bindigo\b/i, violet: /\bviolet\b/i,
}

export interface SpeciesTick {
  commonName: string
  recorded: boolean
}

export interface FirstSeen {
  commonName: string        // normalized
  scientificName: string
  date: string              // YYYY-MM-DD
  location: string
  submissionId: string
}

export interface RainbowEntry {
  color: RainbowColor
  bird: FirstSeen | null
}

export interface NameListResult {
  items: SpeciesTick[]
  recorded: number
  total: number
  complete: boolean
}

export interface FrivolousListsData {
  avianAmerican: NameListResult
  californiaDreamer: NameListResult
  rainbowWarrior: { rows: RainbowEntry[]; filled: number; total: number; complete: boolean }
}

/** Names we never count: spuh ("… sp."), slash ("A/B"), or " x " hybrids. */
function isExcludedName(name: string): boolean {
  return isSpuhOrSlash(name) || name.includes(' x ')
}

/** True if `a` is an earlier first-sighting than `b`. Earliest date wins; ties
 *  break on the lower submission id, so the result is deterministic regardless of
 *  input order. */
function isEarlier(a: FirstSeen, b: { date: string; submissionId: string }): boolean {
  if (a.date !== b.date) return a.date < b.date
  return a.submissionId < b.submissionId
}

export function computeFrivolousLists(observations: ObservationEntry[]): FrivolousListsData {
  // First-seen record per normalized species (earliest date, deterministic tie-break),
  // plus the set of recorded species.
  const firstSeen = new Map<string, FirstSeen>()
  const recorded = new Set<string>()
  for (const o of observations) {
    if (isExcludedName(o.commonName)) continue
    const norm = normalizeSpeciesName(o.commonName)
    recorded.add(norm)
    const cand: FirstSeen = {
      commonName: norm,
      scientificName: o.scientificName,
      date: o.date,
      location: o.location,
      submissionId: o.submissionId,
    }
    const prev = firstSeen.get(norm)
    if (!prev || isEarlier(cand, prev)) firstSeen.set(norm, cand)
  }

  const nameList = (names: readonly string[]): NameListResult => {
    const items = names.map(n => ({ commonName: n, recorded: recorded.has(normalizeSpeciesName(n)) }))
    const n = items.reduce((acc, i) => acc + (i.recorded ? 1 : 0), 0)
    return { items, recorded: n, total: names.length, complete: n === names.length && names.length > 0 }
  }

  // Rainbow: assign each color a bird whose name contains it as a whole word,
  // maximizing DISTINCT birds (avoid doubles) and — among the assignments that hit
  // that maximum — giving the higher-priority color (spectrum order) its earliest-
  // first-seen bird. A bird fills two colors only when a color has no alternative
  // ("absolutely necessary"). Implemented as a lexicographically-greedy maximum
  // bipartite matching: candidates are ordered earliest-first by (date, submission
  // id, then name) — a TOTAL order, so the result is independent of input row order —
  // and each color in spectrum order locks the earliest candidate that still lets the
  // remaining colors reach the global maximum number of distinct birds.
  const allFirst = [...firstSeen.values()]
  const candidates = {} as Record<RainbowColor, FirstSeen[]>
  for (const color of RAINBOW_COLORS) {
    candidates[color] = allFirst
      .filter(fs => COLOR_RE[color].test(fs.commonName))
      .sort((a, b) =>
        a.date !== b.date ? a.date.localeCompare(b.date)
          : a.submissionId !== b.submissionId ? a.submissionId.localeCompare(b.submissionId)
            : a.commonName.localeCompare(b.commonName))
  }

  // Maximum number of `cols` that can be given DISTINCT species, none drawn from
  // `taken` (Kuhn's augmenting paths). Used only for its size, so its internal
  // iteration order never affects the final assignment.
  function maxDistinct(cols: RainbowColor[], taken: Set<string>): number {
    const owner = new Map<string, RainbowColor>()
    function aug(color: RainbowColor, seen: Set<string>): boolean {
      for (const fs of candidates[color]) {
        const sp = fs.commonName
        if (taken.has(sp) || seen.has(sp)) continue
        seen.add(sp)
        const o = owner.get(sp)
        if (o === undefined || aug(o, seen)) { owner.set(sp, color); return true }
      }
      return false
    }
    let n = 0
    for (const c of cols) if (candidates[c].length > 0 && aug(c, new Set())) n++
    return n
  }

  const fillable = RAINBOW_COLORS.filter(color => candidates[color].length > 0)
  const target = maxDistinct(fillable, new Set())   // most colors that can show a distinct bird

  // Lexicographic greedy: each color (spectrum order) takes its earliest candidate
  // that keeps the remaining colors able to reach `target` distinct birds; a color
  // that can hold no distinct species becomes a forced duplicate (its earliest
  // candidate, necessarily shared with another color).
  const used = new Set<string>()
  const pick = new Map<RainbowColor, string>()
  let locked = 0
  for (let i = 0; i < fillable.length; i++) {
    const color = fillable[i]
    const rest = fillable.slice(i + 1)
    for (const fs of candidates[color]) {
      const sp = fs.commonName
      if (used.has(sp)) {
        // Already shown for an earlier color. Take this (lower-index, earliest) shared
        // bird when this color need not supply a distinct one — i.e. the remaining
        // colors can still reach `target` without it. A double is shown only when
        // unavoidable, but then it's the color's EARLIEST bird, not a later "distinct"
        // pick that would merely move the double elsewhere.
        if (locked + maxDistinct(rest, used) >= target) { pick.set(color, sp); break }
      } else {
        // A new distinct bird: take it if the remaining colors can still reach `target`.
        used.add(sp)
        if (locked + 1 + maxDistinct(rest, used) >= target) { pick.set(color, sp); locked++; break }
        used.delete(sp)
      }
    }
  }

  const rows: RainbowEntry[] = RAINBOW_COLORS.map(color => {
    const list = candidates[color]
    if (list.length === 0) return { color, bird: null }
    // A distinct species if the matching gave this color one; otherwise the earliest
    // candidate (a bird already shown for another color — only when forced).
    const sp = pick.get(color)
    const bird = (sp && firstSeen.get(sp)) || list[0]
    return { color, bird }
  })
  const filled = rows.reduce((acc, r) => acc + (r.bird ? 1 : 0), 0)

  return {
    avianAmerican: nameList(AVIAN_AMERICAN),
    californiaDreamer: nameList(CALIFORNIA_DREAMER),
    rainbowWarrior: { rows, filled, total: RAINBOW_COLORS.length, complete: filled === RAINBOW_COLORS.length },
  }
}
