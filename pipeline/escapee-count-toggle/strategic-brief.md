# Strategic Brief — Escapee Count Toggle

## What We're Building

A second toggle beside the Statistics tab's existing "Count spuh, slash &
hybrids" switch, off by default, so the headline species total conforms to
eBird's life-list rule: **Exotic: Provisional and Exotic: Naturalized count,
Exotic: Escapee does not.** Behind it, a bounded, cached, offline-computed
resolution of exotic provenance for the species in the user's own export.

## Why Now

**This was scoped once and declined. It is re-opened on a measurement, not on
a change of mind.** The decline was correct on every data fact and wrong on one
number, and that number was the whole argument.

The prior analysis priced the work at ~3,252 checklist calls, reasoning that
provenance is stored per observation across 21,369 rows. Provenance *is* stored
per observation — but the question being asked is per **species**, and it is a
monotone OR: a species counts if at least one of its observations is not `X`.
One checklist call returns provenance for every species on that checklist at
once. That makes it a set-cover problem over data the app already holds, not a
sweep.

Measured today against this user's live data and key, not estimated:

| | |
|---|---|
| Greedy set cover to observe all 267 species at least once | **73 checklists** |
| Fetched for real, concurrency 4 | **73 calls, 9.7 seconds** |
| Follow-up calls needed | **0** |
| Escapee-only species found | **3** (Graylag Goose, Swan Goose, Muscovy Duck, all `X`) |
| Statistics total | **267 → 264** |

73 on-demand calls is smaller than a single county-completeness pan, well
inside the app's existing network etiquette, and the cover itself is computed
offline from the CSV. The cost that killed this is gone.

**Two further de-riskings, verified today rather than assumed.**
`GET product/checklist/view/{subId}` is *already* in use on both transports
(`weatherService.ts` / `checklistService.ts`, `backend/services/ebird.py`), so
this adds no provider, no new endpoint family, and no `PRIVACY_POLICY.md`
change — and there is an existing dual-transport seam to extend rather than
invent. And the Improve-sized hybrid inconsistency the prior brief listed has
since shipped: `filterObservations` now calls `isNonCountableObservedName` and
the toggle beside this one already reads "Count spuh, slash & hybrids"
(v0.5.86, verified in source). That item is done and is not in this scope.

## The User Problem

A birder opens Statistics and the headline species total disagrees with the
number eBird shows them. eBird's is the canonical figure — it is the one they
quote, compare, and care about.

The delta is about 3 species in 267, roughly 1%, and the smallness is not the
point. **The product's entire promise is exploring your own eBird data; a
headline total that disagrees with eBird by any amount undermines confidence in
every other number on the tab.** A birder cannot tell a 3-species disagreement
from a 30-species one without checking, and having checked once, they now
distrust the rest.

The 3 is also this user's sample, not the bound. A birder working urban Florida
or Southern California parks, or a world lister with many introduced
populations, carries a materially larger escapee set. The rule is what
generalizes; the delta is not.

## Success Criteria

- With the toggle off (the default), the Statistics species total matches the
  life-list number eBird shows the same birder. For this user: **264**.
- With the toggle on, the total is **exactly** today's number, 267 — the
  current behavior is preserved, not approximated.
- **Indian Peafowl and Red Junglefowl still count.** This is the falsifiable
  anti-shortcut test: both are Domestic-type forms that eBird counts (`P` and
  `N`), so if either disappears from the total, the offline `category ===
  'domestic'` shortcut was built instead of the real rule.
- Resolution completes in seconds on a 21k-row, 3.2k-checklist export, and does
  not re-fetch a checklist it has already resolved on a later export.
- A birder can find out **which** species were excluded and why. A headline
  number silently dropping by 3 with no account of itself is the failure mode
  this repo consistently rejects.
- The Calendar still opens, counts, and shades with no connection.
- With no eBird key or no connection, the tab says so plainly and shows today's
  number, distinguishing "offline", "no key", and "error" the way the rest of
  the app already does.
- Every surface headlining a life-list count agrees with every other one.

## Scope

- The toggle on Statistics, beside the existing one, off by default.
- Exotic-provenance resolution: greedy set cover computed offline from the
  loaded backup, `product/checklist/view` fetched through the existing
  dual-transport seam, bounded follow-up for species whose sampled observation
  came back `X`.
- A persistent cache on the `countyCompletenessCache.ts` pattern, refreshing
  incrementally — only checklists not already resolved when a newer export
  lands.
- Flowing the corrected count rule to the surfaces that **headline a life-list
  count**: Statistics totals and milestones, media documentation coverage
  (`mediaStats.ts`), county Completeness, Calendar species counts, Frivolous
  Lists.
- Correcting the county-completeness caption, which reads "spuhs, slashes &
  hybrids don't count" in two places (`CountyCompletenessPopup.tsx`) and becomes
  inaccurate the moment a fourth exclusion class exists.
- Correcting the declined entry in `DECISIONS.md`.
- Honest degradation for offline, no-key, and partially-resolved states.

## Out of Scope

- The surfaces that **list** species rather than headline a count: Life List /
  Multimedia table, Species Detail, Breeding Codes, List Comparer, Map Explorer
  display filtering. This boundary is inherited from the prior scoping and is
  unchanged.
- A per-observation escapee badge or marker anywhere in the app.
- Any offline heuristic standing in for provenance, under any label.
- The two open roadmap questions about what counts as a species (the Life List
  tab's own label, and a slash inside a trailing parenthetical). Adjacent, not
  this.
- Retroactively changing what "countable" means for spuh, slash, or hybrids.

## Key Decisions

- **The 3,252 figure in `DECISIONS.md` is wrong and must be corrected, not
  merely superseded.** It is recorded there as settled fact, and it is precisely
  the number that would stop the next person re-examining this. The correction
  lands at the Chronicler stage; it is recorded here so it cannot be lost. The
  entry's *other* conclusions — no provenance column, per-observation storage,
  the offline shortcut being a trap — were all re-verified today and stand.
- **The offline shortcut remains forbidden, and the rule that forbids it
  generalizes.** `category === 'domestic'` is wrong in both directions:
  confirmed live today that Red Junglefowl returns `N` and Indian Peafowl `P`,
  both of which eBird counts. **A control labelled "escapees" that runs a
  different rule than eBird's is worse than no control, because it claims a
  parity it does not have.** This applies equally to the `userDoNotCount: "DNC"`
  companion field found alongside every `X`: it is worth evaluating as a direct
  countability signal rather than reimplementing N/P/X ourselves, but only if it
  means *exactly* "eBird does not count this toward your life list." If it also
  fires for anything else, adopting it repeats the declined build's central
  error in a new costume — the label must match the rule, whichever signal is
  chosen.
- **Join on `speciesCode`, never a common-name round-trip.** Today's probe
  round-tripped eBird codes through the bundled taxonomy's names and produced 4
  mismatches. The app already batches `/taxonomy/codes` for favicons, so codes
  are available on the surfaces that need them.
- **The zero-follow-up result is a property of this dataset, not a guarantee,
  and the design must not assume it.** Follow-up is needed only for a species
  whose sampled observation came back `X`; for this user each such species
  appears on exactly one checklist, so zero were required. A species seen as an
  escapee on many checklists costs one call per checklist until a non-`X` turns
  up. **Bound the follow-up and present a partially-resolved total honestly** —
  this is the one place the measurement does not cover the design.
- **The Calendar's zero-network guarantee (v0.5.63) is preserved, and this is a
  degradation-design question rather than a wall.** Once resolved, the artifact
  is a small set of species — 3 strings for this user — and reading it from the
  storage seam is as offline as reading the backup. Position: **resolution is
  acquired on the Statistics tab only; every other surface reads the cached
  result passively and, when it is absent, behaves exactly as today.** No
  Calendar code path may initiate a fetch. The corollary needs care: a count
  that changes on a tab the user is not looking at, because they visited
  Statistics, must be legible rather than spooky.
- **One count rule app-wide.** The v0.5.38 → v0.5.83 → v0.5.86 lineage has
  repeatedly converged the app on a single countable predicate. A fourth
  exclusion class that applies on one tab and not another would reverse that
  direction. Where it cannot apply, that must be a stated, visible limit.
- Cache on the established `countyCompletenessCache.ts` pattern: storage-seam
  document, in-memory mirror, per-entry shape validation on load, in-flight
  dedupe, errors never cached, stale-reads served offline. The path stays **out
  of `CACHED_GET_PATHS`** — one caching layer per call.
- **Alignment with the founding brief: clean, and in the strongest direction.**
  SnowRaven "works alongside eBird, never replacing it"; this makes it *agree*
  with eBird on the one number birders quote. Network calls stay device-to-
  provider with the user's own key, on demand; no account, no server, no
  telemetry, no new provider, and no `PRIVACY_POLICY.md` change. Nothing in
  Founding Decisions or Out of Scope is touched.
- **This remains a Feature, but a small one.** The prior promotion was on "new
  data being modeled and persisted," which is still true — provenance is a
  dimension the app has never held, with a new persistent cache. What changed is
  that it is no longer an acquisition build; it is 73 cached calls behind a
  checkbox.
