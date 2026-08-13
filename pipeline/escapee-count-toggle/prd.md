# PRD — Escapee Count Toggle
**Feature:** escapee-count-toggle
**Date:** 2026-08-12
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A second toggle on the Statistics tab, beside "Count spuh, slash & hybrids" and
off by default, that makes the headline species total follow eBird's life-list
rule: Exotic: Provisional and Exotic: Naturalized count, Exotic: Escapee does
not. Behind it, SnowRaven resolves exotic provenance for the species in the
birder's own export by computing a minimal cover of their checklists offline,
fetching that cover through the existing eBird checklist seam, and caching the
result durably.

---

## Context The Architect And The Engineer Must Not Re-Derive

Six facts were measured live during Stage 1 and Stage 2 against the user's real
export and key. They are the ground this PRD stands on.

| Fact | Value |
|---|---|
| eBird CSV export columns | 23, none of them provenance |
| Where provenance lives | `GET product/checklist/view/{subId}` → `obs[]` → `exoticCategory` |
| Values | `X` escapee, `N` naturalized, `P` provisional, or absent |
| Greedy cover of this user's 267 species | **73 checklists**, fetched in 9.7 s at concurrency 4 |
| Follow-up calls required | **0** (a property of this dataset, not a guarantee) |
| Escapee-only species found | 3 — Graylag Goose, Swan Goose, Muscovy Duck. Total 267 → 264 |

Three things verified in source during Stage 2 that change the shape of the
work and were not visible at Stage 1:

1. **The checklist seam currently drops `exoticCategory`.** Both
   `frontend/src/lib/tauri/checklistService.ts` and
   `backend/services/ebird.py` reduce each `obs[]` entry to
   `{speciesCode, count, breedingCode, comments, media}`. The field is not
   retained anywhere. Extending the seam is work, not a given.
2. **The Statistics tab is already networked.** It calls `/taxonomy/codes`
   (no key) and `/map/hotspot-region` (eBird key required, degrades silently).
   What changes here is that a *displayed number* becomes network-derived for
   the first time, not that the tab starts talking to eBird.
3. **The existing include-spuh toggle governs the headline and milestones
   only.** Media documentation coverage and Frivolous Lists are fed the
   unfiltered observation set and always apply the canonical countable rule.
   This PRD mirrors that split exactly rather than inventing a new one.

---

## User Stories

> **US-01** — As a birder comparing SnowRaven to eBird, I want the Statistics
> species total to match the life-list number eBird shows me, so that I can
> trust every other number on the tab.

> **US-02** — As a birder whose total just dropped, I want to see exactly which
> species were left out and why, so that the change is accountable rather than
> mysterious.

> **US-03** — As a birder who preferred the old number, I want a toggle that
> puts the escapees back, so that I can still see the total I am used to.

> **US-04** — As a birder with no eBird key, no connection, or a failed lookup,
> I want the tab to say plainly which of those it is, so that I am not left
> guessing whether the number is simply wrong.

> **US-05** — As a birder using the Calendar in the field with no signal, I want
> it to open, count, and shade exactly as it does today, so that going offline
> never costs me a feature.

> **US-06** — As a birder loading a fresh eBird export, I want the app to check
> only the checklists it has not already checked, so that updating my data
> stays fast.

> **US-07** — As a birder whose escapee status cannot be fully determined, I
> want the total to say it is still working rather than quietly guess, so that
> I know when the number is final.

---

## Functional Requirements

### The countability rule

> **FR-01** — The app shall read exotic provenance from the `exoticCategory`
> field on each observation returned by eBird's checklist view. The value `X`
> marks Exotic: Escapee. Every other value, including the field being absent,
> marks that observation as counting toward the life list.

> **FR-02** — Species-level countability shall be a monotone OR: a species
> counts if at least one of its observations counts. The app shall stop seeking
> provenance for a species as soon as one counting observation is found.

> **FR-03** — The app shall classify every species in the loaded export into
> exactly one of three states:
> **Counting** (at least one observation known to count),
> **Escapee-only** (every checklist carrying that species has been consulted and
> every one of its observations returned `X`),
> **Unresolved** (at least one observation returned `X`, and at least one
> checklist carrying that species has not been consulted).

> **FR-04** — The app shall treat an Unresolved species as Counting. A species
> shall never be removed from a life-list total on incomplete evidence.

> **FR-05** — The escapee exclusion shall compose with, and never replace, the
> countable-name predicate each surface already uses. `isNonCountableSpecies`,
> `isNonCountableObservedName`, and `isSpuhOrSlash` shall be unchanged in
> behavior, and the raw-name versus normalized-name convention at each call site
> shall be preserved.

> **FR-06** — The app shall never infer escapee status from the bundled
> taxonomy's `category` field, from a species name, or from any other offline
> heuristic, under any label.

> **FR-07** — Provenance results shall be keyed on eBird `speciesCode`. A
> species name shall be resolved to a code once, through the app's existing
> taxonomy code lookup. The cache shall never use a common name as its join key,
> and the app shall never round-trip a code through a name and back to a code.

> **FR-08** — The shipped countability gate shall be the explicit
> `exoticCategory === 'X'` test in FR-01. The app shall not gate countability on
> the `userDoNotCount` companion field unless that field is first verified to
> mean exactly "eBird does not count this observation toward the birder's life
> list" and nothing else. See OQ-01.

> **FR-09** — The cache shall record, per species, the distinct
> `exoticCategory` values observed for it and the number of its checklists
> consulted, so that a future change to the countability rule can be applied
> without re-fetching.

### Acquiring provenance

> **FR-10** — The app shall compute a cover offline from the already-loaded
> export: repeatedly select the unconsulted checklist carrying the most
> currently-unresolved species, until every unresolved species is covered or no
> remaining checklist adds one. No network request shall be made during this
> computation.

> **FR-11** — The number of checklists a pass will consult shall be known before
> the first request is issued, and shall be shown to the birder as a definite
> figure rather than an indeterminate spinner.

> **FR-12** — Requests shall go through the existing `/checklists/{id}`
> dual-transport seam. No new endpoint family, no new provider, and no direct
> `fetch` outside the transport seam.

> **FR-13** — A resolution pass shall issue at most one outbound eBird request
> per checklist consulted. Per-checklist location-name and species-name
> resolution that the provenance result does not need shall not be performed.

> **FR-14** — Concurrent requests shall be capped at 4, matching
> `EAGER_FETCH_CONCURRENCY`.

> **FR-15** — A species whose sampled observations all returned `X`, and which
> appears on checklists not yet consulted, shall enter a follow-up queue
> processed within the same pass, subject to FR-16.

> **FR-16** — Follow-up shall be bounded by two named constants: a maximum
> number of follow-up checklists per species, and a maximum total number of
> requests per pass. Recommended starting values are 25 and 500 respectively;
> 500 is 6.8x the measured cover for this user's export. When either bound is
> reached the pass shall stop, the affected species shall remain Unresolved, and
> the app shall say so.

> **FR-17** — Resolution shall be initiated only from the Statistics tab. No
> other surface, and no shared hook mounted outside that tab, shall initiate a
> provenance request.

> **FR-18** — Resolution shall begin automatically when the Statistics tab is
> opened and all of the following hold: an eBird key is present, the app is
> online, and the cache does not already hold a fresh result covering every
> species in the loaded export.

> **FR-19** — The birder shall be able to stop a pass in progress. Results
> already obtained shall be kept and cached, and the tab shall report the
> partial state per FR-27.

> **FR-20** — A failed request shall not abort the pass and shall not be cached.
> Remaining requests shall continue. Species left unconsulted by the failures
> shall remain Unresolved, and the tab shall report how many requests failed.

### The cache

> **FR-21** — Provenance shall persist through the storage seam as a versioned
> document on the `countyCompletenessCache.ts` pattern: an in-memory mirror, a
> TTL, per-entry shape validation on load with malformed entries dropped rather
> than thrown on, in-flight request dedupe, errors never cached, and stale reads
> served when offline.

> **FR-22** — The cache shall be bounded by a documented entry cap with FIFO
> eviction, consistent with the county completeness store. A corrupt or
> unreadable document shall degrade to "not cached", never to a render-time
> crash.

> **FR-23** — The `/checklists/` path shall stay out of `CACHED_GET_PATHS`. One
> caching layer per call.

> **FR-24** — On a newly loaded export the app shall retain every result for a
> checklist it has already consulted, recompute the cover over unresolved
> species only, and skip consulted checklists.

> **FR-25** — A species previously classified Escapee-only that appears on a
> checklist newly present in the export shall return to Unresolved and re-enter
> the cover.

> **FR-26** — When the cache has never been populated, every in-scope surface
> shall produce exactly the numbers it produces today, and the Statistics tab
> shall state that exotic status has not been checked yet.

### The control and its account of itself

> **FR-27** — The Statistics tab shall render a toggle beside the existing
> "Count spuh, slash & hybrids" control, matching its visual and interaction
> treatment. It shall default to off, meaning escapees are excluded.

> **FR-28** — With the toggle on, the Statistics species total and milestones
> shall equal today's values exactly.

> **FR-29** — The toggle's label shall name the rule it actually runs. It shall
> not claim parity with eBird beyond what FR-01 implements.

> **FR-30** — The toggle shall govern the Statistics headline species total and
> the milestone series only, mirroring the scope of the existing include-spuh
> toggle. It shall not govern media documentation coverage, Frivolous Lists,
> county Completeness, or the Calendar.

> **FR-31** — The tab shall show the resolution state at all times, using the
> app's existing four-state vocabulary plus two states this feature adds:
> not yet checked, in progress with a definite count, complete, partially
> resolved, no eBird key, offline, and eBird error. An error state shall offer a
> retry; the others shall not.

> **FR-32** — The birder shall be able to see which species were excluded, each
> named and given its reason. This disclosure shall remain available when the
> toggle is on, as information rather than as an active exclusion.

> **FR-33** — Where a count on any in-scope surface reflects the escapee
> exclusion, that surface shall make the rule legible, so that a number which
> changed because the birder visited Statistics is accountable rather than
> unexplained.

### Flowing the rule to the other surfaces

> **FR-34** — The exclusion shall apply, once resolved, to every surface that
> headlines a life-list count: Statistics totals and milestones, media
> documentation coverage in `mediaStats.ts`, county Completeness, Calendar
> species counts, and Frivolous Lists.

> **FR-35** — Every surface other than Statistics shall read the cached result
> passively. No Calendar code path shall initiate a fetch, import a network
> module, or gain a key dependency, and the Calendar shall remain fully
> functional with no connection.

> **FR-36** — Frivolous Lists shall apply the exclusion unconditionally,
> independent of the toggle, matching their existing independence from the
> include-spuh toggle.

> **FR-37** — The county Completeness numerator shall apply the exclusion. The
> eBird region species list that forms the denominator shall be left unchanged,
> and the resulting asymmetry shall be documented at the call site. See OQ-03.

> **FR-38** — Surfaces that list species rather than headline a count shall be
> unchanged: the Life List and Multimedia tables, Species Detail, Breeding
> Codes, List Comparer, and Map Explorer display filtering.

### Seam, copy, and records

> **FR-39** — `exoticCategory` shall be carried through both transports in
> lockstep: the desktop `checklistService.ts` shape and the backend
> `services/ebird.py` plus `routers/checklists.py` shape. Both unshared
> `ChecklistSpecies` declarations shall gain the field. The addition shall be
> purely additive, leaving the List Comparer's behavior unchanged.

> **FR-40** — The county completeness caption shall be corrected in both places
> it appears in `CountyCompletenessPopup.tsx` (currently lines 88 and 121), and
> the assertion in `CountyCompletenessUI.test.tsx` (currently line 59) shall be
> updated with them. The new wording shall stay accurate with four exclusion
> classes in force and shall not enumerate them in a way that breaks on a fifth.

> **FR-41** — `docs/HELP.md`, `README.md`, and `website/index.html` shall be
> updated in the same change, per the repo's single-source-of-truth rule. Any
> statement about how long the toggle's setting lasts shall use the settled
> phrasing "per-session, resetting on relaunch", and shall be checked against
> the fact that a tab stays mounted once opened.

> **FR-42** — The declined entry in `DECISIONS.md` shall be corrected, not
> merely superseded: the 3,252-call figure shall be replaced with the measured
> cover result, and the entry's still-valid conclusions shall be preserved.

> **FR-43** — `PRIVACY_POLICY.md` shall be reviewed against the shipped
> behavior and updated if the Statistics tab initiates any request it did not
> initiate before. The tab already calls eBird for hotspot classification, so
> the destination and purpose are disclosed; the check is required regardless
> because this change alters which surface initiates a request.

> **FR-44** — New user-facing copy shall contain no em dashes, per the standing
> sweep.

---

## Non-Functional Requirements

> **NFR-01 — Cover performance:** computing the cover over a 21,369-row,
> 3,252-checklist export shall complete in under 500 ms. The Engineer shall
> measure the isolated baseline and report the ratio to that ceiling; if the
> margin is under 10x, the fixture size or the approach changes rather than the
> ceiling. Per the repo's performance-guard rule, a single measurement within 2x
> of a ceiling is not a guard.

> **NFR-02 — Responsiveness:** toggling shall not re-run the full statistics
> memo cascade, and a resolution pass completing shall not block input or
> visibly stall the tab. The Calendar's precompute-both-numbers, select-at-read
> shape is the model; the include-spuh toggle's recompute-everything shape is
> not.

> **NFR-03 — Render purity:** no `Date.now()` or other impure call in a render
> body or memo. TTL and freshness reads belong in handlers and effects, or in a
> module-level session constant, per `react-hooks/purity`, which is
> build-blocking here.

> **NFR-04 — Network etiquette:** requests go device-to-eBird with the birder's
> own key, on demand, capped at concurrency 4, with no background or scheduled
> polling.

> **NFR-05 — Offline:** the app shall remain fully usable with no connection.
> The Calendar shall stay zero-network. No in-scope surface shall show a broken
> or blank state when provenance is unavailable.

> **NFR-06 — Accessibility:** the toggle shall match its neighbour's semantics
> and announce its state. Progress and status shall be announced from a live
> region that is present in the accessibility tree from first render, never
> hidden with `display: none` while idle, and shall use a sequence-keyed child
> so a repeated identical message still announces. Any new control shall meet
> the touch-target and 16px phone-font conventions. `ACCESSIBILITY.md` shall be
> updated only with claims the code actually emits.

> **NFR-07 — Color:** all new color through `var(--sr-*)` tokens, both themes,
> meeting AA for text on its own surface.

> **NFR-08 — Security:** a checklist id shall be shape-guarded with
> `SUBMISSION_ID_RE` and `encodeURIComponent`-wrapped before it reaches a URL.
> The eBird response shall be treated as untrusted input: `exoticCategory` shall
> be validated against the known value set, and any lookup keyed on a value from
> the response shall be read through `Object.hasOwn` rather than a bare index.

> **NFR-09 — Bundle:** no growth to the entry chunk, and
> `frontend/src/lib/entryChunk.test.ts` shall still pass.

> **NFR-10 — Persistence:** all persistence through the storage seam, never
> `localStorage` directly.

> **NFR-11 — Tests:** vitest coverage for the cover algorithm, the three-state
> classification, the cache lifecycle, and a dual-transport parity test locking
> the desktop and backend `exoticCategory` shapes together. A guard test shall
> fail if the offline `category === 'domestic'` shortcut is reintroduced.

> **NFR-12 — Release:** patch version bump in both `frontend/package.json` and
> `src-tauri/tauri.conf.json`, plus a `CHANGELOG.md` entry.

---

## Out of Scope

- Surfaces that list species rather than headline a count: the Life List and
  Multimedia tables, Species Detail, Breeding Codes, List Comparer, and Map
  Explorer display filtering.
- A per-observation escapee badge or marker anywhere in the app.
- Any offline heuristic standing in for provenance, under any label.
- Changing what "countable" means for spuh, slash, or hybrid names.
- The two open roadmap questions about what counts as a species: the Life List
  tab's own count label, and whether a slash inside a trailing parenthetical
  should count.
- A full 3,252-checklist sweep. The cover is the mechanism; an exhaustive sweep
  is explicitly not.
- Persisting the toggle across relaunches. It matches its neighbour, which is
  session-only.
- Backfilling provenance for species no longer present in the loaded export.

---

## Open Questions

**OQ-01 — Does `userDoNotCount` mean exactly "does not count toward the life
list"?**
It accompanies every `X` in the sampled data, but its full semantics are
unverified, and adopting a signal whose meaning is assumed is the exact failure
this feature exists to avoid.
*Default if unanswered:* ship the explicit `exoticCategory === 'X'` rule per
FR-08 and ignore `userDoNotCount`. Record the field in the cache per FR-09 so
the question stays answerable later without re-fetching.

**OQ-02 — Should the first resolution pass start automatically, or wait for an
explicit press?**
Automatic matches county completeness, which fetches on pan without asking.
Explicit is more conservative about 73 unprompted calls.
*Default if unanswered:* automatic per FR-18, with the definite count shown up
front per FR-11 and a stop control per FR-19.

**OQ-03 — Should the county Completeness denominator exclude escapees too?**
Excluding them from the numerator only introduces a small asymmetry against
eBird's region species list, which we do not filter.
*Default if unanswered:* numerator only per FR-37, with the asymmetry documented
at the call site. It is the same approximation the metric already carries for
spuh and slash names.

**OQ-04 — What TTL should provenance carry?**
Provenance changes when eBird reclassifies a taxon, which is rare but real.
*Default if unanswered:* 30 days, matching `COMPLETENESS_TTL_MS`.

**OQ-05 — Where does the excluded-species disclosure live?**
A line under the total, a small expandable list, or a row in an existing
Statistics section. This is The Designer's call.
*Default if unanswered:* an expandable list directly beneath the Life List
Totals figure, listing each excluded species with its reason.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Headline total with toggle off | On the reference export, the Statistics "Species" figure reads **264** after resolution completes |
| QA-02 | Headline total with toggle on | The same figure reads **267**, byte-identical to the pre-feature value |
| QA-03 | Anti-shortcut, Provisional | Indian Peafowl (`P`) is present in the counted set with the toggle off |
| QA-04 | Anti-shortcut, Naturalized | Red Junglefowl (`N`) is present in the counted set with the toggle off |
| QA-05 | Correct exclusions | Exactly Graylag Goose, Swan Goose, and Muscovy Duck are excluded on the reference export |
| QA-06 | Monotone OR | A species with one `X` observation and one non-`X` observation counts, and no further request is made for it once the non-`X` is seen |
| QA-07 | Escapee-only on a single observation | A species appearing on exactly one checklist, returning `X`, is classified Escapee-only and excluded |
| QA-08 | Unresolved counts | A species with an `X` observation and at least one unconsulted checklist is included in the total, and reported as unresolved |
| QA-09 | Existing predicates unchanged | `isNonCountableSpecies`, `isNonCountableObservedName`, and `isSpuhOrSlash` return identical results for all existing test inputs |
| QA-10 | Shortcut guard | A test fails if countability is derived from the taxonomy `category` field |
| QA-11 | Join key | The cache contains no common-name keys; a fixture where a name round-trip would mismatch still resolves correctly by code |
| QA-12 | userDoNotCount not gating | Removing `userDoNotCount` from every fixture response changes no classification |
| QA-13 | Raw values retained | After a pass, the cache holds the distinct `exoticCategory` values seen per species, so re-deriving countability under a different rule requires no request |
| QA-14 | Seam only | Every provenance request goes through `transport`; no direct `fetch` and no new endpoint path are introduced |
| QA-15 | Cover is offline | Zero network requests are issued during cover computation |
| QA-16 | Cover size | On the reference export the cover is 73 checklists or fewer |
| QA-17 | Count known up front | The planned checklist count is displayed before the first request is issued |
| QA-18 | One request per checklist | A pass over N checklists issues exactly N outbound eBird requests, with no per-checklist location or species name lookups |
| QA-19 | Concurrency | No more than 4 requests are in flight at any moment |
| QA-20 | Follow-up bound | With a fixture where a species is `X` on 40 checklists, the pass stops at the per-species bound and marks that species unresolved |
| QA-21 | Pass bound | With a fixture whose cover exceeds the per-pass request cap, the pass stops at the cap and reports the partial state |
| QA-22 | Statistics-only initiation | Mounting Calendar, Map Explorer, Multimedia, or Species Detail without visiting Statistics issues zero provenance requests |
| QA-23 | Auto-start conditions | Resolution starts on Statistics open with a key, online, and a stale cache; it does not start when any one of those is false |
| QA-24 | Cancel | Stopping mid-pass retains already-fetched results in the cache and leaves the tab in the partial state |
| QA-25 | Mid-sweep failure | With 10 of 73 requests failing, the pass completes the other 63, caches none of the 10, reports 10 failures, and the total still renders |
| QA-26 | Errors never cached | After a failed request, a retry issues a fresh outbound request |
| QA-27 | Cache pattern | The store validates entries on load, drops malformed ones without throwing, dedupes in-flight requests, and serves stale reads offline |
| QA-28 | Cache bounds | Exceeding the entry cap evicts oldest-first; a corrupt document yields an empty store and no crash |
| QA-29 | Not double-cached | `/checklists/` is absent from `CACHED_GET_PATHS` |
| QA-30 | Incremental refresh | Loading an export with 200 added checklists re-fetches only checklists not already consulted |
| QA-31 | Re-opened classification | An Escapee-only species appearing on a newly added checklist returns to Unresolved and is re-covered |
| QA-32 | Never-populated cache | With an empty cache, every in-scope surface produces its pre-feature numbers and the tab says exotic status has not been checked |
| QA-33 | Toggle placement and default | The toggle renders beside "Count spuh, slash & hybrids", matches its treatment, and is off on mount |
| QA-34 | Label matches rule | The label names the rule implemented in FR-01 and claims no broader parity |
| QA-35 | Toggle scope | Toggling changes the headline total and milestones only; media coverage, Frivolous Lists, county Completeness, and Calendar figures are unchanged by it |
| QA-36 | Seven states | Each of not-checked, in-progress, complete, partial, no-key, offline, and error renders its own distinct message; only error offers retry |
| QA-37 | Disclosure | Each excluded species is listed by name with its reason, and the list remains available with the toggle on |
| QA-38 | Legibility | Every surface whose count reflects the exclusion carries an account of the rule |
| QA-39 | Media coverage | `coverage.lifeListTotal` excludes escapee-only species once resolved |
| QA-40 | Calendar zero-network | Calendar renders, counts, and shades with the network disabled, issues zero requests, and imports no network module |
| QA-41 | Frivolous Lists | The exclusion applies regardless of toggle position |
| QA-42 | County Completeness numerator | The countable count excludes escapee-only species; the eBird denominator is unchanged |
| QA-43 | Listing surfaces untouched | Life List, Multimedia, Species Detail, Breeding Codes, List Comparer, and Map Explorer render identically to pre-feature |
| QA-44 | Transport parity | A parity test fails if the desktop and backend `exoticCategory` shapes diverge |
| QA-45 | Comparer unaffected | The List Comparer renders identically with the field added |
| QA-46 | Caption corrected | Neither caption in `CountyCompletenessPopup.tsx` claims only three exclusion classes, and the updated test asserts the new wording in both branches |
| QA-47 | Docs in sync | `docs/HELP.md`, `README.md`, and `website/index.html` describe the shipped toggle, and any duration claim reads "per-session, resetting on relaunch" |
| QA-48 | Decision corrected | The `DECISIONS.md` entry no longer states 3,252 calls as the cost, and its other conclusions survive |
| QA-49 | Privacy reviewed | `PRIVACY_POLICY.md` is confirmed accurate against the shipped request behavior, and updated if it is not |
| QA-50 | No em dashes | `grep -n '—'` over new user-facing copy returns nothing |
| QA-51 | Cover performance | Cover computation on a 21,369-row, 3,252-checklist fixture completes under 500 ms, with the measured baseline at least 10x under it |
| QA-52 | Responsiveness | Toggling does not re-run the full statistics cascade, measured by recompute count rather than wall clock |
| QA-53 | Render purity | `npm run build` passes with `react-hooks/purity` enforced |
| QA-54 | Live region | The status region is in the accessibility tree while idle, is never `display: none`, and announces the same message twice when it repeats |
| QA-55 | Security | A malformed checklist id never reaches a URL; an unexpected `exoticCategory` value is rejected; no bare index on a response-derived key |
| QA-56 | Color | New color comes from `var(--sr-*)` tokens in both themes and meets AA on its own surface |
| QA-57 | Entry chunk | `entryChunk.test.ts` passes and the entry chunk gains no new modules |
| QA-58 | Storage seam | No direct `localStorage` access is introduced |
| QA-59 | Release hygiene | Both version files are bumped to the same value and `CHANGELOG.md` has an entry |

### Requirement coverage map

Written out per requirement rather than as ranges, so a gap is visible rather
than implied.

| Requirement | Checks |
|---|---|
| FR-01 | QA-01, QA-02, QA-05 |
| FR-02 | QA-06 |
| FR-03 | QA-07, QA-08 |
| FR-04 | QA-08 |
| FR-05 | QA-09 |
| FR-06 | QA-03, QA-04, QA-10 |
| FR-07 | QA-11 |
| FR-08 | QA-12 |
| FR-09 | QA-13 |
| FR-10 | QA-15, QA-16 |
| FR-11 | QA-17 |
| FR-12 | QA-14 |
| FR-13 | QA-18 |
| FR-14 | QA-19 |
| FR-15 | QA-20 |
| FR-16 | QA-20, QA-21 |
| FR-17 | QA-22 |
| FR-18 | QA-23 |
| FR-19 | QA-24 |
| FR-20 | QA-25, QA-26 |
| FR-21 | QA-27 |
| FR-22 | QA-28 |
| FR-23 | QA-29 |
| FR-24 | QA-30 |
| FR-25 | QA-31 |
| FR-26 | QA-32 |
| FR-27 | QA-33 |
| FR-28 | QA-02 |
| FR-29 | QA-34 |
| FR-30 | QA-35 |
| FR-31 | QA-36 |
| FR-32 | QA-37 |
| FR-33 | QA-38 |
| FR-34 | QA-01, QA-39, QA-42 |
| FR-35 | QA-40 |
| FR-36 | QA-41 |
| FR-37 | QA-42 |
| FR-38 | QA-43 |
| FR-39 | QA-44, QA-45 |
| FR-40 | QA-46 |
| FR-41 | QA-47 |
| FR-42 | QA-48 |
| FR-43 | QA-49 |
| FR-44 | QA-50 |
| NFR-01 | QA-51 |
| NFR-02 | QA-52 |
| NFR-03 | QA-53 |
| NFR-04 | QA-19 |
| NFR-05 | QA-40 |
| NFR-06 | QA-54 |
| NFR-07 | QA-56 |
| NFR-08 | QA-55 |
| NFR-09 | QA-57 |
| NFR-10 | QA-58 |
| NFR-11 | QA-10, QA-44 |
| NFR-12 | QA-59 |
