// Pure model for eBird exotic provenance (schema.md §3, §6, §7, §10).
//
// eBird stores provenance PER OBSERVATION (`exoticCategory`: 'X' escapee, 'N'
// naturalized, 'P' provisional, or absent). The question this feature asks is
// per SPECIES, and the answer is a monotone OR: a species counts toward a life
// list if at least one of its observations is not 'X'. One checklist call
// returns provenance for every species on that checklist at once, so resolving a
// whole export is a SET COVER over data the app already holds, not a sweep.
//
// Nothing in this module does I/O, and nothing in it reads the clock. It is safe
// inside a `useMemo` (react-hooks/purity is build-blocking here). The store owns
// persistence; the controller owns the network.
//
// THE FORBIDDEN SHORTCUT. Escapee status is NEVER inferred from the bundled
// taxonomy's `category` field, from a species name, or from any other offline
// heuristic, under any label (FR-06). The shortcut is wrong in BOTH directions:
// Red Junglefowl returns 'N' and Indian Peafowl 'P', and eBird counts both.
// `exoticProvenance.test.ts` carries a guard that fails if it returns.

import type { ObservationEntry } from '../types'
import { normalizeSpeciesName, isNonCountableForm } from './speciesUtils'

// ── The countability rule (FR-01, FR-02, FR-08) ───────────────────────────────

/** eBird's Exotic: Escapee token. The ONLY value that does not count. */
export const ESCAPEE_CATEGORY = 'X'

/** Pack the raw response pair into one bounded token: "<category>|<doNotCount>".
 *
 *  Both halves are stored RAW (FR-08, FR-09, QA-13). A presence flag could not
 *  answer OQ-01, which is a question about the PAIRING: does 'DNC' ever appear
 *  beside a category other than 'X'? Recording the pair keeps that answerable
 *  from the cached document with zero further requests. */
export function seenToken(exoticCategory: string, userDoNotCount: string): string {
  return `${exoticCategory}|${userDoNotCount}`
}

/** The category half of a `seen` token. Linear scan, no regex (regex hygiene). */
export function categoryOfToken(token: string): string {
  const bar = token.indexOf('|')
  return bar === -1 ? token : token.slice(0, bar)
}

/** FR-01: 'X' is Exotic: Escapee. EVERY other value, INCLUDING absent, counts.
 *
 *  Deliberately not a closed union. If eBird mints a fourth category it is
 *  recorded verbatim and counts, which is the safe direction and is what keeps
 *  the evidence FR-09 exists to preserve (schema.md §3.2).
 *
 *  The shipped gate is this explicit test and nothing else. `userDoNotCount` is
 *  recorded but never consulted (FR-08 / OQ-01): adopting a signal whose meaning
 *  is assumed is the exact failure this feature exists to avoid. */
export function tokenCounts(token: string): boolean {
  return categoryOfToken(token) !== ESCAPEE_CATEGORY
}

/** life-lists-tab FR-16: a category that is present. 'X|', 'N|', 'P|' and any
 *  future value qualify; '|' does not. */
export function isExoticToken(token: string): boolean {
  return categoryOfToken(token) !== ''
}

// ── The persisted shapes (schema.md §3) ───────────────────────────────────────

export interface SpeciesProvenanceRecord {
  /** Distinct raw "<category>|<doNotCount>" pairs, first-seen order, <= 8. */
  seen: string[]
  /** Consulted checklists that contributed an observation of this species.
   *  AUDIT FIGURE ONLY (FR-09) and the disclosure's evidence line. Never an
   *  input to classification. */
  n: number
  /** ms epoch of the most recent contribution. The TTL anchor. */
  at: number
}

/** A read-only view of the store, with no clock and no I/O attached. */
export interface ProvenanceSnapshot {
  /** Submission ids we have already asked eBird about. */
  readonly checklists: ReadonlySet<string>
  /** speciesCode -> the raw tokens seen for it. */
  readonly species: ReadonlyMap<string, SpeciesProvenanceRecord>
  /**
   * The escapee-only classification as last PUBLISHED by a Statistics pass, in
   * the export's own normalized common names.
   *
   * This is a cache of a derivation, never the source of truth: `species` holds
   * the raw tokens and Statistics always re-derives from them. It exists so a
   * passive reader that holds no name-to-code join can still apply the rule
   * offline. The Calendar is zero-network by guarantee (v0.5.63) and has no
   * `/taxonomy/codes` batch, so without this it could not participate at all.
   *
   * A passive reader must still confirm carrier completeness against
   * `checklists` (see `confirmExcludedNames`) rather than trusting the list, so
   * a newly added checklist re-opens a species offline too (FR-25).
   */
  readonly excludedNames: readonly string[]
  /**
   * The exotic-only classification as last published by a Statistics pass
   * (life-lists-tab FR-16, FR-17), same names, same bounds, same passive
   * confirmation as `excludedNames`. `null` means "never published on this
   * document" and `[]` means "published, and no species is exotic-only"; the
   * two mean different things and a reader must not conflate them.
   */
  readonly exoticNames: readonly string[] | null
}

export const EMPTY_SNAPSHOT: ProvenanceSnapshot = {
  checklists: new Set<string>(),
  species: new Map<string, SpeciesProvenanceRecord>(),
  excludedNames: [],
  exoticNames: null,
}

// ── The cover input, derived from loaded observations (schema.md §7) ───────────

export interface CoverIndex {
  /** speciesCode -> the submission ids carrying it, per the CURRENT export. */
  readonly bySpecies: ReadonlyMap<string, readonly string[]>
  /** submissionId -> the species codes on it, per the CURRENT export. */
  readonly byChecklist: ReadonlyMap<string, readonly string[]>
  /** speciesCode -> the export's OWN normalized common name for it. */
  readonly nameForCode: ReadonlyMap<string, string>
  /** Observed names that resolved to no taxon code. Always counting, never
   *  covered: asking eBird would produce an answer with nothing to join it to. */
  readonly unresolvableNames: ReadonlySet<string>
}

export const EMPTY_COVER_INDEX: CoverIndex = {
  bySpecies: new Map(),
  byChecklist: new Map(),
  nameForCode: new Map(),
  unresolvableNames: new Set(),
}

/**
 * One pass over the loaded observations. NO NETWORK (FR-10, QA-15) — this is the
 * only place the CSV and the cache meet.
 *
 * Two conventions are load-bearing:
 *
 *  - The countable-form predicate takes the RAW exported name, so this uses
 *    `isNonCountableForm(o.commonName)`, matching `filterObservations` and
 *    `buildDayCells`. (schema.md §7 wrote `isNonCountableSpecies(norm)`; the
 *    repo's convention won over the artifact, and the countability build then
 *    made the raw name the ONLY input, so there is no longer a pair to choose
 *    between. It still keeps countable intergrades in the cover instead of
 *    silently dropping them.) The escapee rule COMPOSES with it, never replaces it:
 *    a spuh was already not a life-list species, and asking eBird about one
 *    would spend cover budget on an answer nobody reads.
 *
 *  - The name is mapped to a code ONCE, in ONE direction (FR-07). There is no
 *    code -> name -> code round trip anywhere in this feature; the reference
 *    probe produced 4 mismatches doing exactly that.
 */
export function buildCoverIndex(
  obs: readonly ObservationEntry[],
  codeForNormalizedName: (norm: string) => string | undefined,
): CoverIndex {
  const bySpecies = new Map<string, string[]>()
  const byChecklist = new Map<string, string[]>()
  const nameForCode = new Map<string, string>()
  const unresolvableNames = new Set<string>()
  // Per-checklist dedupe: two subspecies rows collapse to one normalized name,
  // and a submission id must appear once per species.
  const seenPair = new Set<string>()

  for (const o of obs) {
    if (isNonCountableForm(o.commonName)) continue
    const sub = o.submissionId
    if (!sub) continue
    const norm = normalizeSpeciesName(o.commonName)
    const code = codeForNormalizedName(norm)
    if (!code) { unresolvableNames.add(norm); continue }
    if (!nameForCode.has(code)) nameForCode.set(code, norm)
    const pair = `${sub}\u0000${code}`
    if (seenPair.has(pair)) continue
    seenPair.add(pair)
    let subs = bySpecies.get(code)
    if (!subs) { subs = []; bySpecies.set(code, subs) }
    subs.push(sub)
    let codes = byChecklist.get(sub)
    if (!codes) { codes = []; byChecklist.set(sub, codes) }
    codes.push(code)
  }

  return { bySpecies, byChecklist, nameForCode, unresolvableNames }
}

// ── Classification (schema.md §6) ──────────────────────────────────────────────

export type ProvenanceClass = 'counting' | 'escapee-only' | 'unresolved' | 'unknown'

/**
 * | class          | condition                                                        | counts? |
 * |----------------|------------------------------------------------------------------|---------|
 * | `counting`     | some seen token's category is not 'X'                            | yes     |
 * | `escapee-only` | all 'X', and every carrying submission id is in the ledger        | NO      |
 * | `unresolved`   | all 'X', and some carrying submission id is unconsulted           | yes     |
 * | `unknown`      | no record: no consulted checklist has reported this species       | yes     |
 *
 * `unknown` is a fourth state FR-03 does not name. It is needed: FR-03's three
 * states all presuppose at least one observation has been seen, so a
 * never-consulted species fits none of them literally, and it is what makes
 * FR-26 ("exotic status has not been checked yet") expressible without lying.
 */
export function classifySpecies(
  snapshot: ProvenanceSnapshot,
  index: CoverIndex,
  code: string,
): ProvenanceClass {
  const rec = snapshot.species.get(code)
  if (!rec) return 'unknown'
  for (const token of rec.seen) if (tokenCounts(token)) return 'counting'
  const carriers = index.bySpecies.get(code)
  if (carriers) {
    for (const sub of carriers) if (!snapshot.checklists.has(sub)) return 'unresolved'
  }
  return 'escapee-only'
}

/**
 * life-lists-tab FR-16: not an escapee, every seen token carries a category, and
 * every carrier in the current export has been consulted. A species with no
 * record, an unconsulted carrier, or one categoryless observation is native.
 *
 * A separate predicate, never a fifth `ProvenanceClass`, so every Statistics
 * count is provably untouched. An escapee-only species is never exotic (the
 * `counting` test refuses it), so the two published lists are disjoint.
 */
export function isExoticOnly(snapshot: ProvenanceSnapshot, index: CoverIndex, code: string): boolean {
  const rec = snapshot.species.get(code)
  if (!rec) return false
  if (classifySpecies(snapshot, index, code) !== 'counting') return false
  for (const t of rec.seen) if (!isExoticToken(t)) return false
  const carriers = index.bySpecies.get(code)
  if (carriers) for (const sub of carriers) if (!snapshot.checklists.has(sub)) return false
  return true
}

/** FR-04, stated once: a species is removed from a life-list total ONLY when it
 *  is `escapee-only`. Everything else counts, so the total converges DOWNWARD as
 *  resolution completes and never wrongly erases a lifer. */
export function classCounts(cls: ProvenanceClass): boolean {
  return cls !== 'escapee-only'
}

// ── The lookup the computation consumes (schema.md §10) ───────────────────────

export interface ExcludedSpecies {
  /** The export's own normalized common name, for display. */
  readonly name: string
  readonly speciesCode: string
  /** The raw tokens, so the reason shown is the evidence actually held. */
  readonly seen: readonly string[]
  /** Consulted checklists that reported this species (the evidence line). */
  readonly checklistsChecked: number
}

export interface ProvenanceLookup {
  /** Normalized common names classified escapee-only. The set every in-scope
   *  surface composes with its existing countable-name predicate. */
  readonly excludedNames: ReadonlySet<string>
  /** Normalized common names classified exotic-only (life-lists-tab FR-16).
   *  Published for the Life Lists tab; no Statistics count reads it. */
  readonly exoticNames: ReadonlySet<string>
  /** The disclosure payload (FR-32). Available whatever the toggle says. */
  readonly excluded: readonly ExcludedSpecies[]
  readonly counts: {
    /** counting + escapee-only. */
    readonly resolved: number
    /** All tokens 'X' with an unconsulted carrier still outstanding. */
    readonly unresolved: number
    /** Never consulted. */
    readonly unknown: number
  }
}

export const EMPTY_LOOKUP: ProvenanceLookup = {
  excludedNames: new Set<string>(),
  exoticNames: new Set<string>(),
  excluded: [],
  counts: { resolved: 0, unresolved: 0, unknown: 0 },
}

/**
 * Classify every species in the current export and package the result.
 *
 * Why the set holds NAMES, and why that is not the round trip FR-07 forbids:
 * every in-scope surface already compares `normalizeSpeciesName(o.commonName)`
 * against `isNonCountableForm`, so handing them a set of normalized names
 * makes the escapee rule a SECOND PREDICATE ON THE SAME VALUE, which is exactly
 * FR-05's "compose, never replace". The classification itself is performed
 * entirely by code; the names are the export's own strings, carried forward from
 * `buildCoverIndex`, one direction only. No code is ever recovered from a name.
 */
export function buildProvenanceLookup(
  snapshot: ProvenanceSnapshot,
  index: CoverIndex,
): ProvenanceLookup {
  const excludedNames = new Set<string>()
  const exoticNames = new Set<string>()
  const excluded: ExcludedSpecies[] = []
  let resolved = 0, unresolved = 0, unknown = 0

  for (const [code, name] of index.nameForCode) {
    const cls = classifySpecies(snapshot, index, code)
    if (cls === 'unknown') { unknown += 1; continue }
    if (cls === 'unresolved') { unresolved += 1; continue }
    resolved += 1
    if (isExoticOnly(snapshot, index, code)) exoticNames.add(name)
    if (cls === 'escapee-only') {
      const rec = snapshot.species.get(code)
      excludedNames.add(name)
      excluded.push({
        name,
        speciesCode: code,
        seen: rec ? [...rec.seen] : [],
        checklistsChecked: rec ? rec.n : 0,
      })
    }
  }

  excluded.sort((a, b) => a.name.localeCompare(b.name))
  return { excludedNames, exoticNames, excluded, counts: { resolved, unresolved, unknown } }
}

/**
 * The PASSIVE reader's half of the rule (FR-35). Confirms the published
 * escapee-only names against the persisted ledger, using only the reader's own
 * observations, with no taxonomy join and no network.
 *
 * A published name is honoured only when EVERY checklist in the current export
 * that carries it has already been consulted. So a newly loaded export that adds
 * a checklist for a previously excluded species re-opens that species on the
 * Calendar exactly as it does on Statistics (FR-25), rather than waiting for the
 * next Statistics visit to correct itself.
 *
 * The direction of any residual error is the safe one: a name whose carriers
 * cannot all be confirmed simply counts (FR-04).
 */
export function confirmExcludedNames(
  snapshot: ProvenanceSnapshot,
  obs: readonly ObservationEntry[],
): ReadonlySet<string> {
  return confirmPublishedNames(snapshot.excludedNames, snapshot, obs)
}

/**
 * The body of `confirmExcludedNames` with the published list as a parameter, so
 * the Life Lists tab confirms the exotic list by the SAME mechanism as the
 * escapee list and the two switches cannot drift apart. One `Set.has` per row.
 */
export function confirmPublishedNames(
  published: readonly string[],
  snapshot: ProvenanceSnapshot,
  obs: readonly ObservationEntry[],
): ReadonlySet<string> {
  if (published.length === 0) return EMPTY_LOOKUP.excludedNames
  const candidates = new Set(published)
  const open = new Set<string>()
  for (const o of obs) {
    if (isNonCountableForm(o.commonName)) continue
    const norm = normalizeSpeciesName(o.commonName)
    if (!candidates.has(norm) || open.has(norm)) continue
    if (!snapshot.checklists.has(o.submissionId)) open.add(norm)
  }
  if (open.size === 0) return candidates
  const confirmed = new Set<string>()
  for (const n of candidates) if (!open.has(n)) confirmed.add(n)
  return confirmed
}

// ── The greedy cover (schema.md §7.1, FR-10) ──────────────────────────────────

/**
 * Repeatedly select the unconsulted checklist carrying the most currently
 * unresolved species, until every unresolved species is covered or no remaining
 * checklist adds one (FR-10). NO NETWORK REQUEST IS MADE HERE (QA-15).
 *
 * Implementation is a lazy-deletion binary heap over (gain desc, submissionId
 * asc), with EAGER gain decrements through the inverted index. Each decrement
 * pushes exactly one heap entry, so pushes and pops are both bounded by the
 * number of (checklist, species) incidences, i.e. by the observation row count:
 * total work is O(incidences log n). NFR-01's ceiling is 500 ms on a
 * 21,369-row, 3,252-checklist fixture with a required 10x margin; this shape
 * lands orders of magnitude under it, and `exoticProvenance.test.ts` measures
 * the baseline with a DISTINCT INPUT PER TIMED RUN so the guard cannot be
 * measuring a memo hit.
 *
 * Determinism: the heap's ordering is total (gain desc, then id asc), and the
 * entry for a checklist that is currently the argmax always carries its live
 * gain, because every gain change pushes a fresh entry. So the selection is the
 * true argmax with an id tie-break, and a test can assert an exact cover.
 *
 * Greedy set cover is not guaranteed optimal, so a fixture assertion about cover
 * size is written `<= N`, never `=== N`.
 */
export function greedyCover(
  index: CoverIndex,
  remaining: Iterable<string>,
  consulted: ReadonlySet<string>,
  maxSelections: number,
): string[] {
  const need = new Set<string>()
  for (const code of remaining) {
    if (index.bySpecies.has(code)) need.add(code)
  }
  if (need.size === 0 || maxSelections <= 0) return []

  // Initial gain per unconsulted candidate checklist.
  const gain = new Map<string, number>()
  for (const [sub, codes] of index.byChecklist) {
    if (consulted.has(sub)) continue
    let g = 0
    for (const code of codes) if (need.has(code)) g += 1
    if (g > 0) gain.set(sub, g)
  }
  if (gain.size === 0) return []

  const heap: Array<{ g: number; id: string }> = []
  const less = (a: { g: number; id: string }, b: { g: number; id: string }): boolean =>
    a.g !== b.g ? a.g > b.g : a.id < b.id            // max-gain first, then lowest id

  function push(entry: { g: number; id: string }): void {
    heap.push(entry)
    let i = heap.length - 1
    while (i > 0) {
      const parent = (i - 1) >> 1
      if (!less(heap[i], heap[parent])) break
      const tmp = heap[parent]; heap[parent] = heap[i]; heap[i] = tmp
      i = parent
    }
  }

  function pop(): { g: number; id: string } | undefined {
    if (heap.length === 0) return undefined
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length > 0) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1, r = l + 1
        let best = i
        if (l < heap.length && less(heap[l], heap[best])) best = l
        if (r < heap.length && less(heap[r], heap[best])) best = r
        if (best === i) break
        const tmp = heap[best]; heap[best] = heap[i]; heap[i] = tmp
        i = best
      }
    }
    return top
  }

  for (const [id, g] of gain) push({ g, id })

  const selected: string[] = []
  while (selected.length < maxSelections && need.size > 0) {
    let chosen: string | null = null
    for (;;) {
      const top = pop()
      if (!top) break
      const live = gain.get(top.id)
      if (live === undefined || live !== top.g) continue   // stale entry
      if (live <= 0) continue
      chosen = top.id
      break
    }
    if (chosen === null) break                             // FR-10's second clause

    selected.push(chosen)
    gain.delete(chosen)
    for (const code of index.byChecklist.get(chosen) ?? []) {
      if (!need.has(code)) continue
      need.delete(code)
      for (const other of index.bySpecies.get(code) ?? []) {
        const g = gain.get(other)
        if (g === undefined) continue
        const next = g - 1
        if (next <= 0) { gain.delete(other); continue }
        gain.set(other, next)
        push({ g: next, id: other })
      }
    }
  }
  return selected
}

/** The species that a pass still needs an answer for: everything not already
 *  `counting` or `escapee-only`, minus those parked at their follow-up bound.
 *  A species that flips to `counting` simply leaves this set and its queued
 *  follow-ups evaporate, which is how FR-02's "stop seeking as soon as one
 *  counting observation is found" becomes structural rather than a check. */
export function remainingSpecies(
  snapshot: ProvenanceSnapshot,
  index: CoverIndex,
  parked: ReadonlySet<string>,
): string[] {
  const out: string[] = []
  for (const code of index.bySpecies.keys()) {
    if (parked.has(code)) continue
    const cls = classifySpecies(snapshot, index, code)
    if (cls === 'unknown' || cls === 'unresolved') out.push(code)
  }
  return out
}

/** Ledger entries that must be RE-consulted even though they are fresh: the
 *  carriers of a cover species that has NO species record at all.
 *
 *  A checklist can be in the ledger while a species it carries has no record
 *  only when the checklist was consulted under an EARLIER cover that failed to
 *  admit the species — the shipped case being a bird recorded only as a
 *  "(Domestic type)" form, whose raw name missed the species-only taxonomy
 *  batch until v1.0.1, so its parent code never entered the cover and its
 *  provenance rows were discarded at the merge gate. The ledger then says
 *  "fetched" while the species index says "never answered"; the index is the
 *  evidence a classification actually needs, so its absence wins and those
 *  checklists become fetchable again.
 *
 *  Bounded and self-healing: only the carriers of RECORDLESS cover species
 *  qualify (an `unresolved` species has a record and keeps the normal
 *  fresh-ledger behavior), and one refetch heals the store permanently, because
 *  the merge records every admissible row it sees. On a store with no such
 *  desync this returns the empty set and nothing about a pass changes. */
export function carriersNeedingRefetch(
  snapshot: ProvenanceSnapshot,
  index: CoverIndex,
  remaining: Iterable<string>,
): Set<string> {
  const stale = new Set<string>()
  for (const code of remaining) {
    if (snapshot.species.has(code)) continue
    for (const sub of index.bySpecies.get(code) ?? []) {
      if (snapshot.checklists.has(sub)) stale.add(sub)
    }
  }
  return stale
}
