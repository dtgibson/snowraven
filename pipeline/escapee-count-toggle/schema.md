# Data Layer Design — Escapee Count Toggle

**Feature:** escapee-count-toggle
**Date:** 2026-08-12
**Stage:** 3 — The Architect
**Source:** prd.md (approved), strategic-brief.md (approved)
**Path:** Incremental

---

## Architect assessment — Incremental

`pipeline.config.json` exists and is complete, so the config step is skipped.
SnowRaven has no SQL database and no ORM: its data layer is an eBird CSV export
parsed in the browser, a storage seam (`frontend/src/lib/storage.ts`) over the
Tauri filesystem or the web `/settings/{key}` store, a dual-transport network
seam, and a small family of persistent cache documents. So there is no
migration to write. What exists to extend is that cache family and the seam,
and this feature adds a new member to each.

This is **not** frontend-only. The feature persists a new class of
network-derived data (eBird exotic provenance) that the app has never held, and
it changes the response shape of `/checklists/{id}` on **both** transports.
Three concrete structural changes follow: a new persistent store document, a new
pure model module, and an additive field pair on the two unshared
`ChecklistSpecies` declarations.

---

## 1. What this design must hold, in one paragraph

Provenance is a per-observation eBird fact (`exoticCategory`), the question is
per-species, and the answer is a monotone OR. So the persisted artifact is not a
copy of eBird's data. It is two small ledgers: **which checklists we have asked
about**, and **which raw provenance tokens we have seen per species**. Every
classification in the app is derived from those two ledgers joined against the
currently-loaded export. Nothing is stored that the app can recompute, and
nothing is derived that the app would need a network call to re-derive.

---

## 2. Module map

Four new frontend modules, mirroring the county-completeness trio exactly so a
reader who knows one knows the other. The split is not tidiness: it is how
FR-17, FR-35 and QA-40 are **enforced by the import graph** rather than by
discipline.

| Module | Role | May import | Must NOT import |
|---|---|---|---|
| `frontend/src/lib/exoticProvenance.ts` | Pure model: types, cover algorithm, classification, lookup construction. No I/O at all. | `speciesUtils` | `storage`, `transport` |
| `frontend/src/lib/exoticProvenanceCache.ts` | The persistent store. Storage seam only; the fetcher is an **injected loader**. | `storage`, `offlineDetect`, the pure model | `transport`, any `tauri/*Service` |
| `frontend/src/lib/useProvenanceLookup.ts` | Passive read hook. Every surface reads through this. | the store + the pure model | `transport`, `useExoticProvenance` |
| `frontend/src/lib/useExoticProvenance.ts` | The resolution pass controller. **Statistics only.** | `transport`, the store, the pure model | — |

Parallel to `countyCompleteness.ts` / `countyCompletenessCache.ts` /
`useCountyCompleteness.ts`. The fourth module exists because the county feature
has exactly one consuming surface and this one has five, only one of which may
ever initiate a request.

Changed files (seam):

- `frontend/src/lib/tauri/checklistService.ts`
- `backend/services/ebird.py`
- `backend/routers/checklists.py`
- `frontend/src/lib/transport.ts` (route the provenance flag; **no new path**)

**Guard to write (QA-40 / FR-35):** a test that walks the static import graph
rooted at `useProvenanceLookup.ts` and asserts it never reaches `transport.ts`
or any `lib/tauri/*Service` module. `entryChunk.test.ts` is the existing pattern
for graph-walking; write this as its sibling rather than extending it, because
the question is different (reachability of a network module, not entry-chunk
membership).

---

## 3. The persisted document

One storage-seam document, one key.

```ts
/** Storage-seam document key. Bump the suffix AND `version` together on any
 *  shape change; a mismatch yields an empty store, never a migration. */
export const PROVENANCE_STORE_KEY = 'exotic-provenance-v1'

export interface ProvenanceStore {
  version: 1

  /** Consulted-checklist ledger. Key: eBird submission id. Value: the ms-epoch
   *  fetch time, and nothing else. See §4 for why nothing else. */
  checklists: Record<string, number>

  /** FIFO eviction order for `checklists`, oldest-fetched first. */
  order: string[]

  /** Per-species provenance record. Key: eBird speciesCode, already collapsed
   *  to the parent species by the seam's reportAs resolution. */
  species: Record<string, SpeciesProvenanceRecord>

  /** Insertion order for `species`. Present for determinism and for the
   *  admission check; never used to evict. See §4. */
  speciesOrder: string[]
}

export interface SpeciesProvenanceRecord {
  /** Distinct raw "<exoticCategory>|<userDoNotCount>" pairs observed for this
   *  species, in first-seen order. See §3.2. At most 8 members. */
  seen: string[]
  /** How many consulted checklists have contributed an observation of this
   *  species. AUDIT FIGURE ONLY (FR-09); never an input to classification. */
  n: number
  /** ms epoch of the most recent contribution. The TTL anchor. */
  at: number
}
```

### 3.1 Why the ledger holds only a timestamp

The obvious design stores each consulted checklist's full species-to-category
map. It is rejected. The ledger answers exactly one question, FR-24's *"have we
already asked about this checklist?"*, and a per-checklist map is a second copy
of information the species record already holds in the form the PRD actually
requires (FR-09, QA-13 are both stated per species). Dropping it buys three
things at once:

1. **A structurally fixed-size entry.** Key ≤ 16 characters, value one finite
   number. So the ledger needs an entry cap and no payload budget, and its bound
   is stated structurally rather than as a byte product, per the v0.5.85 rule.
2. **No cross-source inference.** Categories come only from responses; the
   "which checklists carry this species" relation comes only from the CSV. The
   two never have to be reconciled.
3. **A ledger eviction that costs no answer.** See §4.

### 3.2 Why `seen` encodes a pair, and why the tokens are raw

FR-08 ships the explicit `exoticCategory === 'X'` gate and does **not** gate on
`userDoNotCount`. OQ-01 asks whether `userDoNotCount` means exactly "does not
count toward the life list", and its default resolution is to record the field
so the question stays answerable without re-fetching.

A presence flag cannot answer that question. The question is about the
**pairing**: does `DNC` ever appear beside a category other than `X`, and does
any token other than `DNC` ever appear? So one field records the distinct pairs:

```
""       category absent, no DNC          → counts
"|DNC"   category absent, DNC present     → counts under FR-08; evidence for OQ-01
"X|DNC"  the sampled escapee shape
"N|"     naturalized                       → counts
"P|"     provisional                       → counts
```

Countability is derived by splitting at the pipe and applying FR-01 to the left
half. `seen` holds the **raw** tokens, never a derived boolean (FR-08, FR-09,
QA-13): a future change to the rule re-derives from the same document with zero
requests.

Two facts that make this correct rather than clever, both of which the Engineer
must preserve:

- **A category token is not a closed union in the store.** It is a bounded token.
  If eBird mints a fourth category, it is recorded verbatim and, per FR-01's
  explicit wording, counts. Collapsing an unrecognized token to `''` would
  destroy exactly the evidence FR-09 exists to keep. The closed union appears
  only at the countability test.
- **Two observations on one checklist can collapse to the same species code.**
  `Mallard` and `Mallard (Domestic type)` both resolve through `reportAs` to
  `mallar3`. Both tokens land in `seen` and the OR settles it. This is the case
  that makes the `category === 'domestic'` shortcut wrong and is what QA-03 and
  QA-04 are checking; do not de-duplicate obs by species code before merging.

### 3.3 Versioning

`version` is checked on load. A value other than `1` yields the empty store, the
same as a corrupt document. Do not write a migration. If the shape must change,
bump both `version` and the `-v1` key suffix so an old document is orphaned
rather than half-read, and accept one re-resolution pass as the cost.

---

## 4. Retention: entry caps, admission versus eviction

CLAUDE.md is explicit that capacity+1 is a measurement rule and not a universal
eviction policy, and that admission control belongs to a hot memo whose miss is
cheap. Neither ledger here is a memo, and a miss costs a network call. So the
choice is made per record type on what an eviction actually destroys, and the
two answers differ.

### 4.1 Species index: admission control (fill to the limit, then stop admitting)

```ts
export let PROVENANCE_MAX_SPECIES = 16_384
```

**Justification, measured not guessed.** The bundled v2027 taxonomy snapshot
(`frontend/src/assets/ebird-taxonomy.json`) carries **11,167** species names in
`byCom` and 17,891 total codes including forms. Provenance is admitted only for
species codes present in the current cover index, so the index size is bounded
by the birder's life list, which is bounded by the world species list. The cap
sits 1.47x above the entire world taxonomy and **cannot bind on real data**.
That is a structural claim about the container, not a byte product.

**Why admission and not FIFO.** Evicting a species entry destroys a paid-for
network answer *and* the raw tokens FR-09 exists to keep, and at capacity+1 it
would do so on every pass forever, never converging. Admission control degrades
instead to the state the feature already defines as safe: an unadmitted species
has no entry, classifies as `unknown`, and counts (FR-04). The overflow
behaviour is the designed safe state rather than a wrong answer or a thrash
loop.

**Two mechanics that must be right:**

- Admission is gated on **the container's own size** (`speciesOrder.length >=
  PROVENANCE_MAX_SPECIES`), never on a separate counter. The v0.5.85 finding was
  a counter-enforced bound silently inflating until admission closed permanently
  and being invisible in both the entries and the answers.
- Admission gates **new keys only**. Merging new tokens into an existing record
  is not admission and is never blocked, so a full index still stays current.

### 4.2 Checklist ledger: FIFO

```ts
export let PROVENANCE_MAX_CHECKLISTS = 32_768
```

**Why FIFO here.** An evicted ledger entry costs exactly one redundant network
request on the next pass and **loses no answer**: the species records that
checklist contributed to are untouched. Retaining the newest consulted
checklists is also precisely what FR-24's incremental refresh wants. This is the
county-completeness and replay-store class, and CLAUDE.md records that those
stores deliberately remain FIFO for that reason.

**The consequence to state, not hide.** If a ledger entry for a checklist
carrying an escapee-only species is evicted, that species flips from
`escapee-only` back to `unresolved` (§6) and re-enters the total. That is the
safe direction (FR-04) and it self-heals on the next pass. It is also the second
reason the species index is not FIFO: there the equivalent flip would additionally
discard the raw tokens.

**Cap justification.** A pass is bounded at 500 requests (FR-16), so reaching
32,768 entries takes 66 full-budget passes. The reference export has 3,252
checklists in total, so its ledger cannot exceed 3,252 however many passes run.

### 4.3 No payload budget, and why that is a strengthening

Both entry shapes are structurally bounded by the load-path validation in §5:

| Record | Key | Value | Cap |
|---|---|---|---|
| ledger | `/^S[0-9]{1,15}$/` | one finite number | 32,768 entries |
| species | `/^[a-z0-9-]{2,16}$/` | ≤ 8 members of ≤ 12 chars, plus 2 finite numbers | 16,384 entries |

So there is no variable-length payload to budget, and the guarantee is stated as
entry count and key length rather than as a byte product. Any illustrative size
figure written into a comment must name its string representation
(`JSON.stringify(...).length`, UTF-16 code units) and must be marked
illustrative; do not turn one into an assertion. The county store's
`COMPLETENESS_MAX_BYTES` exists because a county's species array is genuinely
variable-length; nothing here is.

### 4.4 The capacity+1 discipline applied to this module

Per CLAUDE.md, any performance or "never much worse than not caching" claim
about either ledger must be measured at **capacity plus one**, not at capacity,
and asserted as **work done** (loader calls, order searches, evictions) rather
than elapsed time. Follow the `_getCountyCompletenessCacheWorkStatsForTests`
pattern: a recorder installed only by the test reset seam, so the production
path carries no benchmark clocks. And apply the rule to **both** ledgers in the
module, not only the one that prompted the test.

---

## 5. Load-path shape validation

Same contract as `countyCompletenessCache.sanitizeStore`: the persisted document
is on-device data that can arrive corrupt, and a malformed entry is silently
**dropped**, never thrown on. A corrupt document degrades to "not cached", which
degrades to today's numbers (FR-26), never to a render-time crash (FR-22).

```ts
// Measured against the bundled v2027 snapshot: 17,891 codes, length 2 to 8,
// charset [a-z0-9-]. Exactly one real code carries a hyphen ('bird-o1'), so the
// hyphen is REQUIRED in the class; omitting it silently drops that species.
// Upper bound 16 gives headroom for a future eBird code while keeping the key
// structurally bounded.
const SPECIES_CODE_KEY_RE = /^[a-z0-9-]{2,16}$/

// Deliberately STRICTER than the app-wide display guard SUBMISSION_ID_RE
// (/^S\d+$/, components/speciesDetail/ui.tsx), which is unbounded in length. A
// persisted KEY must be structurally bounded; a display guard need not be. Do
// not loosen, replace, or re-point the app-wide constant, and do not introduce a
// third copy of it.
const SUBMISSION_KEY_RE = /^S[0-9]{1,15}$/

// "<category>|<doNotCount>", both raw, both bounded ASCII uppercase.
const SEEN_TOKEN_RE = /^[A-Z]{0,4}\|[A-Z]{0,8}$/
```

Validation rules:

1. `version !== 1` → empty store.
2. `checklists` not a plain object, or `order` not an array → empty store.
3. Per ledger key: must match `SUBMISSION_KEY_RE`, must not repeat, value must be
   a finite number. Otherwise skip.
4. Per species key: must match `SPECIES_CODE_KEY_RE`, must not repeat; `seen`
   must be an array of ≤ 8 strings each matching `SEEN_TOKEN_RE`; `n` and `at`
   must be finite numbers. Otherwise skip.
5. Every read of a record by a key derived from a response or a document uses
   `Object.hasOwn`, never a bare index (NFR-08, and the v0.5.81 prototype-chain
   finding: a bare index on an object literal returns a truthy inherited member
   for at least twelve strings). The malformed-input test list must include
   `'constructor'` and `'__proto__'`, and any pollution probe must be built with
   `JSON.parse`, not an object literal.

---

## 6. Classification: the derived state machine

Pure, in `exoticProvenance.ts`. Takes a store snapshot and a cover index (§7),
returns a classification per species code. **Contains no `Date.now()`** and no
other impure call, so it is safe inside a memo (NFR-03).

```ts
export type ProvenanceClass = 'counting' | 'escapee-only' | 'unresolved' | 'unknown'
```

| Class | Condition | Counts toward the total? |
|---|---|---|
| `counting` | record exists and some member of `seen` has a category half that is not `X` | yes |
| `escapee-only` | record exists, every member's category half is `X`, and **every** submission id carrying this species in the current export is in the ledger | **no** |
| `unresolved` | record exists, every member's category half is `X`, and at least one carrying submission id is absent from the ledger | yes (FR-04) |
| `unknown` | no record: no consulted checklist has reported this species | yes |

`unknown` is a fourth state the PRD's FR-03 does not name, and it is needed:
FR-03's three states all presuppose at least one observation has been seen, so a
never-consulted species fits none of them literally. It is what makes FR-26
("exotic status has not been checked yet") and FR-31's "not yet checked" state
expressible without lying, and it is why the resolution status can distinguish
"nothing checked" from "checked, some still open".

Two derivations that must not drift:

- **Countable-for-total is `class !== 'escapee-only'`.** Everything else counts.
  That single expression is FR-04.
- A species whose name resolves to **no** taxon code can never be classified and
  is therefore always counting. It is excluded from the cover as well (asking
  would produce an answer with nothing to join it to). State this at the call
  site; it is the honest limit of FR-07's join-by-code rule.

---

## 7. The cover input, derived from loaded observations

Built by one pass over the already-filtered observation array. No network
(FR-10, QA-15). This is the only place the CSV and the cache meet.

```ts
export interface CoverIndex {
  /** speciesCode → the submission ids carrying it, per the CURRENT export. */
  bySpecies: Map<string, string[]>
  /** submissionId → the species codes on it, per the CURRENT export. */
  byChecklist: Map<string, string[]>
  /** Observed names that resolved to no taxon code. Always counting; never covered. */
  unresolvableNames: Set<string>
}

export function buildCoverIndex(
  obs: ObservationEntry[],
  codeForNormalizedName: (norm: string) => string | undefined,
): CoverIndex
```

Construction, per observation row:

1. `norm = normalizeSpeciesName(o.commonName)`.
2. Skip if `isNonCountableSpecies(norm)`. The escapee rule **composes with** the
   countable-name predicate and never replaces it (FR-05); a spuh was already
   not a life-list species and asking eBird about it is wasted budget.
3. `code = codeForNormalizedName(norm)`; if undefined, record in
   `unresolvableNames` and skip.
4. Add `(code, o.submissionId)` to both maps.

`codeForNormalizedName` is the app's existing `/taxonomy/codes` batch, already
fetched by the Statistics tab for favicons and taxonomic sort. The name is
mapped to a code **once, in one direction** (FR-07). There is no code → name →
code round trip anywhere in this design; the reference probe produced 4
mismatches doing exactly that.

### 7.1 The greedy cover

FR-10's algorithm, over `remaining` = the species codes that are not yet
`counting`, and over candidate checklists **not already in the ledger** (FR-24).

Use a **bucket queue**, not a repeated linear scan:

- Buckets are an array indexed by current gain (`|species(c) ∩ remaining|`);
  gains are integers bounded by the largest checklist's species count.
- A monotone descending `maxGain` pointer walks down as buckets empty.
- On popping a candidate, revalidate its gain; if it has dropped, re-bucket it
  and continue (lazy greedy). If it is still correct, select it, remove its
  species from `remaining`, and decrement the gain of every other checklist
  carrying those species through the inverted index.
- **Tie-break by submission id ascending**, so the cover is deterministic and a
  test can assert an exact selection.
- Terminate when `remaining` is empty or `maxGain` reaches 0 (FR-10's second
  clause).

Total work is O(number of (checklist, species) incidences), which is the
observation row count: **21,369** on the reference export. NFR-01's ceiling is
500 ms on a 21,369-row, 3,252-checklist fixture with a required 10x margin. This
shape should land two orders of magnitude under it. The Engineer must measure
the isolated baseline and report the ratio, and per CLAUDE.md the guard must use
a distinct input per timed run so it does not measure a memo hit, and must have
real margin rather than the 2x that is not margin.

QA-16 requires the cover to be 73 checklists or fewer on the reference export.
Greedy set cover is not guaranteed optimal, so the fixture assertion should be
`<= 73`, matching the PRD's wording, not `=== 73`.

---

## 8. The resolution pass

Owned by `useExoticProvenance.ts`. Statistics only (FR-17).

### 8.1 Constants

```ts
/** FR-14: matches EAGER_FETCH_CONCURRENCY in useCountyCompleteness. */
export const PROVENANCE_CONCURRENCY = 4
/** FR-16: a single species may drive at most this many follow-up requests. */
export const MAX_FOLLOWUP_PER_SPECIES = 25
/** FR-16: total outbound requests in one pass. 6.8x the measured reference cover. */
export const MAX_REQUESTS_PER_PASS = 500
/** OQ-04: 30 days, matching COMPLETENESS_TTL_MS. */
export const PROVENANCE_TTL_MS = 30 * 24 * 60 * 60 * 1000
```

### 8.2 Shape of a pass

1. **Plan.** Build the cover index, classify, compute the first-wave cover. Its
   size is known before request one and is displayed as a definite figure
   (FR-11, QA-17).
2. **Dispatch** through a pool of 4. Every request goes through `transport`
   (FR-12, QA-14).
3. **Merge each response** as it lands (§8.4), which may reclassify species and
   shrink the remaining work.
4. **Follow-up (FR-15) is another greedy round, not a precomputed list.** When
   the wave drains, recompute `remaining` as the species still `unresolved`
   (every token seen is `X`, unconsulted carrying checklists exist) and run the
   same bucket-queue greedy over the remaining unconsulted checklists. This
   makes FR-02's "stop seeking as soon as one counting observation is found"
   structural: a species that flips to `counting` simply leaves `remaining` and
   its queued follow-ups evaporate.
5. **Bounds.** Per species, a counter of follow-up requests attributable to it,
   capped at `MAX_FOLLOWUP_PER_SPECIES`; a species at its cap leaves `remaining`
   and stays `unresolved`. Per pass, a request counter capped at
   `MAX_REQUESTS_PER_PASS`; on reaching it the pass stops and reports the partial
   state (FR-16, QA-20, QA-21).
6. **Report.** `planned` (the first-wave figure, never retroactively falsified),
   `additional` (follow-up requests issued), `done`, `failed`.

### 8.3 Cancellation and failure

- **Cancel (FR-19, QA-24):** a flag checked before dispatching each request.
  In-flight requests are allowed to complete and their results merge, so nothing
  paid for is thrown away. Status becomes `partial`.
- **Failure (FR-20, QA-25, QA-26):** per-request catch. Increment `failed`, write
  **no** ledger entry, continue the pass. An error is never cached, so a retry
  issues a fresh request. A species left unconsulted by failures stays
  `unresolved`, which counts.

### 8.4 Merge

For a response for checklist `C`:

1. For each species entry, normalize the category to a bounded token and the
   `userDoNotCount` value likewise (§9). Build the pair string.
2. Look up the record by collapsed species code via `Object.hasOwn`. If absent
   and the code is in the cover index and admission is open, create it. If
   admission is closed, skip (§4.1) and let the species stay `unknown`.
3. Union the pair into `seen` (first-seen order, ≤ 8 members), increment `n`,
   set `at = Date.now()`.
4. Write the ledger entry `checklists[C] = Date.now()` and push `C` onto `order`,
   evicting oldest-first while over the entry cap.
5. Schedule the debounced whole-document write (250 ms, best effort, mirror stays
   the live source). Copy `scheduleWrite` from `countyCompletenessCache`.

### 8.5 In-flight dedupe

Keyed by submission id, a `Map<string, Promise<...>>` cleared in a `finally`,
exactly as `countyCompletenessCache._inflight` does. Two effects racing at tab
mount, or a retry overlapping a running pass, share one eBird call (FR-21,
QA-27). The dedupe lives in the **store**, not the controller, so it holds
across controller remounts.

### 8.6 Auto-start (FR-18, OQ-02 default)

Start on Statistics open when **all** of: an eBird key is present, the app is
online (`useOnline`), and the cache does not already hold a fresh result
covering every species in the loaded export. All three reads happen in an
effect, never in a render body or memo (NFR-03), and the `Date.now()` freshness
comparison is one of them.

---

## 9. TTL and staleness

`PROVENANCE_TTL_MS` = 30 days (OQ-04 default, matching `COMPLETENESS_TTL_MS`).
Provenance changes when eBird reclassifies a taxon: rare but real.

The TTL governs **re-consultation, not display**:

- A ledger entry older than the TTL makes that checklist eligible for the cover
  again on the next pass.
- A species record older than the TTL does **not** stop counting or excluding.
  Stale reads are served for display (FR-21) and offline (NFR-05). A total that
  blanks itself because a timer expired would be a worse answer than a slightly
  old one.
- Freshness enters the auto-start decision only (§8.6): the cache "holds a fresh
  result covering every species" when every species in the cover index is
  `counting` or `escapee-only` **and** every contributing ledger entry is within
  the TTL.

This keeps every time read inside an effect and leaves the object the render
consumes entirely time-free, which is what makes NFR-03 hold by construction
rather than by review.

---

## 10. The lookup the computation consumes

One object, pure, time-free, built once per (snapshot, cover index) pair.

```ts
export interface ProvenanceLookup {
  /** Normalized common names classified escapee-only. See §10.1. */
  readonly excludedNames: ReadonlySet<string>
  /** The disclosure payload (FR-32). Available whatever the toggle says. */
  readonly excluded: readonly ExcludedSpecies[]
  readonly counts: {
    readonly resolved: number      // counting + escapee-only
    readonly unresolved: number    // X-only with an unconsulted carrier
    readonly unknown: number       // never consulted
  }
}

export interface ExcludedSpecies {
  /** The export's own normalized common name, for display. */
  readonly name: string
  readonly speciesCode: string
  /** The raw tokens, so the reason shown is the evidence held. */
  readonly seen: readonly string[]
}

export function buildProvenanceLookup(
  snapshot: ProvenanceSnapshot,
  index: CoverIndex,
  nameForCode: ReadonlyMap<string, string>,
): ProvenanceLookup
```

### 10.1 Why the set holds names, and why that is not a round trip

Every in-scope surface already compares `normalizeSpeciesName(o.commonName)`
against `isNonCountableSpecies`. Handing them a set of normalized names makes
the escapee rule a second predicate on the same value, which is exactly FR-05's
"compose, never replace":

```ts
if (isNonCountableSpecies(norm) || excludedNames.has(norm)) continue
```

FR-07 forbids round-tripping a code through a name and back to a code. This is
not that. The classification is performed **entirely by code**. The names in the
set are the **export's own normalized strings**, carried forward from
`buildCoverIndex` (which is why `nameForCode` is built there, from CSV names,
and not from the taxonomy's rendering of a code). So the strings a surface
compares are byte-identical to the strings it holds, one direction only, one
mapping only. QA-11's fixture, where a name round trip would mismatch, passes
because no round trip exists.

### 10.2 Toggle scope, and precomputing both numbers

FR-30 and FR-34 are not in tension once the toggle is understood as a **read-time
selector on Statistics** rather than an input to the model:

- The lookup is global and unconditional. Media coverage, county Completeness,
  Calendar counts and Frivolous Lists apply it always (FR-34, FR-36), exactly as
  they already ignore the include-spuh toggle.
- Statistics computes the headline total and milestone series **both ways in one
  memo pass** and selects at read (NFR-02, QA-52). The Calendar's
  precompute-both, select-at-read shape is the model; the include-spuh toggle's
  recompute-everything shape is not. Toggling must not invalidate a memo input.

### 10.3 Resolution status

```ts
export type ProvenanceStatus =
  | { kind: 'not-checked' }
  | { kind: 'in-progress'; done: number; planned: number; additional: number }
  | { kind: 'complete'; resolved: number }
  | { kind: 'partial'; resolved: number; unresolved: number; failed: number; reason: PartialReason }
  | { kind: 'no-key' }
  | { kind: 'offline' }
  | { kind: 'error'; retry: () => void }

export type PartialReason = 'cancelled' | 'pass-budget' | 'species-budget' | 'failures'
```

Seven states, one message each, and **only `error` carries a retry** (FR-31,
QA-36). `partial` carries its reason so the message can be specific about which
of the four bounds stopped it rather than saying "some species could not be
checked" four different ways.

---

## 11. The seam extension

Additive on both transports, in lockstep (FR-39, QA-44).

### 11.1 Desktop — `frontend/src/lib/tauri/checklistService.ts`

```ts
export interface ChecklistSpecies {
  speciesCode: string
  commonName: string
  count: string
  breedingCode: string
  comments: string
  media: { photo: number; audio: number; video: number }
  /** Raw eBird exotic provenance: 'X' | 'N' | 'P', or '' when absent. */
  exoticCategory: string
  /** Raw companion flag ('DNC' in sampled data), or '' when absent. */
  userDoNotCount: string
}
```

The response parse type gains `exoticCategory?: string` and
`userDoNotCount?: string` on `obs[]`. Both are normalized before they leave the
seam:

```ts
const EXOTIC_RE = /^[A-Z]{1,4}$/         // explicit ASCII class, not \w or \d
const DNC_RE = /^[A-Z]{1,8}$/
const norm = (v: unknown, re: RegExp) =>
  typeof v === 'string' && re.test(v) ? v : ''
```

The eBird response is untrusted input (NFR-08). Anything not matching becomes
`''`, which under FR-01 counts. Note that `exoticCategory` rides on the
observation and is therefore attached to the **collapsed parent species code**
after `resolveSpecies` runs, which is precisely the join key this design wants.

### 11.2 Skipping the location-name resolution (FR-13, QA-18)

The current seam makes a **second** outbound eBird call per checklist:
`checklist/view` carries no `locName`, so both transports resolve one from
`ref/region/info/{locId}`. A provenance pass must not do that, and FR-13 makes
it a requirement rather than an optimization.

No new endpoint (FR-12). The existing path takes a query parameter:

```ts
transport.get<ChecklistResult>(`/checklists/${id}`, { fields: 'provenance' })
```

- `WebTransport.get` already appends `params` as a query string, so the backend
  sees `GET /checklists/S123?fields=provenance`.
- `TauriTransport.get`'s existing `/checklists/` branch slices the id off the
  **path**, so the query string never contaminates the id. Read
  `params?.fields === 'provenance'` and pass
  `getChecklist(checklistId, { skipLocName: true })`.
- The response **shape is unchanged**; with the flag, `locName` falls back to
  the `locId` exactly as it already does when resolution fails. One path, one
  shape, one fewer request.

`/checklists/` stays out of `CACHED_GET_PATHS` (FR-23, QA-29). This store is the
single caching layer for the path, matching the note already sitting beside
`/map/county-species` and `/media/embed-status` in `transport.ts`.

The id is shape-guarded with `SUBMISSION_ID_RE` and `encodeURIComponent`-wrapped
before it reaches a URL (NFR-08, QA-55). The store's own stricter key guard
(§5) does not replace that check.

### 11.3 Backend — `services/ebird.py` and `routers/checklists.py`

`fetch_checklist_species(checklist_id, skip_loc_name: bool = False)`; the
species dict gains `"exoticCategory"` and `"userDoNotCount"`, normalized with
**explicit ASCII classes** (`[A-Z]`, never `\w`) so the two transports validate
identically. This is the same trap as the v0.5.54 pydantic `\d` finding, where a
rust-regex `\d` admitted `٠١٢` while its JS twin did not; write the classes out
on both sides and include a non-ASCII case in the malformed-input test.

`GET /checklists/{checklist_id}` gains `fields: str | None = Query(None)`; when
it equals `"provenance"`, pass `skip_loc_name=True`. The species projection
carries both new fields through with `s.get(..., "")`.

### 11.4 Parity test (NFR-11, QA-44)

One shared fixture, both transports, asserting an identical `ChecklistSpecies`
including both new fields and identical normalization of a hostile value (a
lowercase token, a long token, a non-ASCII digit, a non-string). The existing
twin-parity tests are the pattern. The addition is purely additive and the List
Comparer ignores both fields (FR-39, QA-45).

---

## 12. Degradation states

| Condition | What the model does | What the number does | What the tab says |
|---|---|---|---|
| No eBird key | No pass starts. Cached snapshot still read and applied. | Today's number, or the cached exclusion if one was resolved earlier | `no-key` |
| Offline | No pass starts. Snapshot read from the storage seam. | Cached exclusion applies; stale is served | `offline` |
| Never populated | Empty store, `excludedNames` empty, every species `unknown` | Byte-identical to pre-feature on every surface (FR-26, QA-32) | `not-checked` |
| Partially resolved | `unresolved` species count (FR-04) | Converges downward only, never erases a lifer | `partial` + reason |
| Corrupt document | `sanitizeStore` yields the empty store | Same as never populated | `not-checked` |
| Request failures | Failed checklists leave no ledger entry | Pass completes, affected species stay `unresolved` | `partial`, reason `failures` |
| eBird error at plan time | No merge occurs | Unchanged | `error` + retry |
| Calendar, any of the above | Reads through `useProvenanceLookup` only | Renders, counts and shades with zero requests (QA-40) | not applicable |

Two invariants that hold across every row:

- **A number never moves on incomplete evidence in the erasing direction.** The
  total converges downward as resolution completes and never below the truth.
- **A surface never blanks.** Absent provenance is today's behaviour, which was
  correct before this feature existed.

---

## 13. What the Engineer must not do

1. Do not infer escapee status from the taxonomy's `category` field, a species
   name, or any offline heuristic, under any label (FR-06). Red Junglefowl
   returns `N` and Indian Peafowl `P`, and both count. NFR-11 requires a guard
   test that fails if the shortcut returns.
2. Do not store a derived countability boolean in place of the raw tokens
   (FR-08, FR-09, QA-13).
3. Do not key anything on a common name, and do not round-trip a code through a
   name (FR-07). Names are an output label only.
4. Do not add `/checklists/` to `CACHED_GET_PATHS` (FR-23).
5. Do not import `transport` from `useProvenanceLookup.ts`, the store, or the
   pure model. The Calendar's zero-network guarantee is enforced by that graph.
6. Do not make `exoticCategory` a closed union in the store; do not collapse an
   unrecognized token.
7. Do not de-duplicate a response's observations by species code before merging;
   two forms collapsing to one species is the case the OR exists for.
8. Do not invalidate this store when the eBird file is saved or cleared. Retaining
   consulted checklists across exports is FR-24, and it is the opposite of the
   `invalidateHotspotSet` precedent for a good reason: there the cached artifact
   was derived from the file, here it is derived from eBird.
9. Do not evict from the species index, and do not switch the ledger to admission
   control. The two policies are chosen for opposite reasons (§4).
10. Do not read `Date.now()` in a render body or memo (NFR-03,
    `react-hooks/purity` is build-blocking).

---

## 14. Requirement traceability

| Requirement | Where it lives in this design |
|---|---|
| FR-01, FR-02 | §6 classification table; the OR is the `seen.some(cat !== 'X')` test |
| FR-03 | §6, plus the fourth `unknown` state and why it is needed |
| FR-04 | §6 "countable-for-total is `class !== 'escapee-only'`" |
| FR-05 | §7 step 2, §10.1 composition expression |
| FR-06 | §13.1 |
| FR-07 | §7 `codeForNormalizedName`, §10.1 |
| FR-08, FR-09 | §3.2 pair encoding, raw tokens |
| FR-10 | §7.1 bucket-queue greedy, offline by construction |
| FR-11 | §8.2 step 1, `planned` never retroactively falsified |
| FR-12, FR-13 | §11.2 query parameter on the existing path |
| FR-14 | §8.1 `PROVENANCE_CONCURRENCY` |
| FR-15, FR-16 | §8.2 steps 4 and 5 |
| FR-17 | §2 module table, §8 controller ownership |
| FR-18 | §8.6 |
| FR-19, FR-20 | §8.3 |
| FR-21, FR-22 | §5 validation, §8.4 write, §8.5 dedupe, §9 stale reads |
| FR-23 | §11.2 |
| FR-24 | §3 ledger, §7.1 candidate filter, §13.8 |
| FR-25 | §6 `escapee-only` requires every carrier consulted; a new checklist is not in the ledger, so the species returns to `unresolved` automatically |
| FR-26 | §12 never-populated row |
| FR-27 to FR-29, FR-31 to FR-33 | §10.3 status union; the control itself is The Designer's |
| FR-30, FR-34, FR-36 | §10.2 |
| FR-35 | §2 import-graph guard |
| FR-37 | §10.1 predicate composes into `countyCompleteness.ts` line 185; the denominator is untouched, and the asymmetry is documented at that call site |
| FR-38 | Nothing in this design reaches a listing surface |
| FR-39 | §11.1, §11.3, §11.4 |
| FR-40 to FR-44 | Copy and records; no data-layer surface |
| NFR-01 | §7.1 complexity and the measurement instruction |
| NFR-02 | §10.2 precompute both, select at read |
| NFR-03 | §9 every time read in an effect; §6 and §10 are time-free |
| NFR-04 | §8.1 concurrency 4, on demand, no polling |
| NFR-05 | §9 stale reads, §12 |
| NFR-08 | §5 validation and `Object.hasOwn`, §11.1 and §11.3 normalization, §11.2 id guard |
| NFR-09 | §2; all four modules are reached only from lazy tabs |
| NFR-10 | §3 storage seam, one document, no `localStorage` |
| NFR-11 | §4.4 work-stats guard, §11.4 parity test, §13.1 shortcut guard |

---

## 15. Open questions this design resolves, and the one it does not

- **OQ-01** is left open by design and made **answerable without re-fetching**:
  §3.2's pair encoding records whether `DNC` ever appears beside a non-`X`
  category. The shipped gate is `exoticCategory === 'X'` per FR-08.
- **OQ-02** takes the automatic default (§8.6) with the definite figure up front
  and a stop control.
- **OQ-03** takes the numerator-only default; the denominator is eBird's region
  list and is untouched. Documented at the `countyCompleteness.ts` call site.
- **OQ-04** takes 30 days, and §9 narrows what the TTL governs, which the PRD
  left unstated.
- **OQ-05** is The Designer's; §10 supplies `excluded[]` with the raw evidence so
  any of the three placements can render a reason rather than an assertion.

**Not resolved, and flagged for the Engineer.** FR-39 names only
`exoticCategory` as the field to carry through the seam, but OQ-01's default
resolution requires `userDoNotCount` to be recorded in the cache, which it
cannot be unless the seam carries it. This design carries **both**, which is a
superset of FR-39. The parity test (§11.4) must therefore cover both fields, not
just the one FR-39 names.
