# Change Brief — Escapee Count Toggle

## Verdict up front

**This is a New Feature, not an Improve task, and the reason is a data
finding rather than a judgement call: the eBird CSV export carries no
provenance column at all.** SnowRaven cannot tell an escapee from any other
bird with the data it has. Building the requested toggle means acquiring a
data dimension the app has never held, from the network, per checklist.

## What is changing (as asked)

Add a "show escapees" toggle beside the existing "Include spuh / slash
species" checkbox on the Statistics tab, default off, so the total species
figure matches eBird's life-list rule: **Exotic: Provisional and Exotic:
Naturalized count, Exotic: Escapee does not.**

## The load-bearing finding

Verified against three of the user's real exports (stored copy 2026-07-01,
`~/Downloads` 2026-07-29, `~/Documents` 2026-06-28). All three are the same
**23 columns**, and none is an exotic/provenance field:

> Submission ID, Common Name, Scientific Name, Taxonomic Order, Count,
> State/Province, County, Location ID, Location, Latitude, Longitude, Date,
> Time, Protocol, Duration (Min), All Obs Reported, Distance Traveled (km),
> Area Covered (ha), Number of Observers, Breeding Code, Observation Details,
> Checklist Comments, ML Catalog Numbers

This is stronger than "the parser drops it." `parseEbirdObservations.ts`
retains everything it could use; there is nothing to retain. Every statistic
in the app is computed from this export.

## Where the provenance actually lives

It exists, but only per checklist, over the network. Verified live against the
user's own key and data:

`GET product/checklist/view/{subId}` returns `obs[]` where each entry carries
**`exoticCategory`** with values `X` (escapee), `N` (naturalized), `P`
(provisional), or absent, plus a companion `userDoNotCount: "DNC"`.

Two properties make this expensive rather than merely new:

1. **It is per observation, not per species.** Mute Swan came back `P` on one
   of the user's checklists; the same species is `X` elsewhere in eBird. Rock
   Pigeon is `N`. Mallard (Domestic type) is `X`. So no species-level lookup
   can stand in for it.
2. **There is no bulk path.** eBird's API has no personal-life-list endpoint,
   which is exactly why SnowRaven is built on the CSV export. Reconstructing
   provenance across this user's history means **3,252 checklist calls**
   (21,369 observation rows), an eBird key requirement, a persistent cache,
   progress UI, and offline/no-key degradation.

## The offline shortcut, and why it is a trap

The eBird taxonomy has a `category` field (`domestic`, `species`, `issf`,
`slash`, `spuh`, `hybrid`, `form`) that could ride along offline. It has **no
provenance field** (full field list verified). `category === 'domestic'` is
not eBird's rule and is wrong in both directions on this user's own data:

| Species | category | exoticCategory | eBird counts it? |
|---|---|---|---|
| Graylag Goose (Domestic type) | domestic | `X` | no |
| Swan Goose (Domestic type) | domestic | `X` | no |
| Muscovy Duck (Domestic type) | domestic | `X` | no |
| Indian Peafowl (Domestic type) | domestic | `P` | **yes** |
| Red Junglefowl (Domestic type) | domestic | `N` | **yes** |
| Rock Pigeon (Feral Pigeon) | domestic | `N` | **yes** |
| Mute Swan | species | `P` | yes |

A control labelled "escapees" that runs a different rule than eBird's is worse
than no control, because it claims a parity it does not have. If a
category-based filter is ever built it must be labelled for what it does
("domestic-type forms"), not for what it is not.

## Size of the actual problem

The Statistics total is **267 species** today. Five species exist in the data
only as a Domestic-type form; three of those are `X` (Graylag Goose, Swan
Goose, Muscovy Duck) and two count (Indian Peafowl `P`, Red Junglefowl `N`).
Domestic-type forms of birds the user has also seen wild (Mallard) already
fold into the parent by `normalizeSpeciesName`, so they never inflated
anything.

**Honest delta: about 3 species out of 267, roughly 1%** — and pinning it
exactly still requires the full 3,252-call sweep, because provenance is
per observation.

## Why now

User-reported: the Statistics total does not match the number eBird shows
them, and eBird's method is the canonical one.

## User-facing impact

Under the full build: the headline Statistics species total drops (about 3
for this user), a new toggle appears, and a tab that is currently pure offline
computation from the loaded backup gains a network dependency and a key
requirement. That last part is the real cost, and it is why this is not a
small change.

## Design pass

**Not needed for the toggle itself** — it is a second checkbox in an existing
control row, mirroring the one beside it. If the work proceeds as a Feature,
the acquisition flow (fetch progress across thousands of checklists, offline
and no-key states, staleness, how a partially-known total is presented
honestly) does need design, but that is a Feature-lane concern, not a visual
refinement of an existing surface.

## Feature check — which branch rules fire

- **New data is being modeled and persisted.** Exotic provenance is a data
  dimension the app has never held, requiring a new fetch and a new persistent
  cache on the `countyCompletenessCache` pattern. This alone is decisive.
- **A new user-visible flow.** Acquiring 3,252 checklists needs a progress and
  degradation flow that does not exist today.
- **It needs PRD discipline.** Acquisition strategy, cache design, correctness
  contract, and how the total reads while provenance is incomplete are all
  real design questions.

The toggle on its own would have been comfortable Improve territory, in the
same family as the v0.5.81 "Pin code labels" toggle. It is what sits behind
the toggle that promotes this.

## If re-scoped to stay on the Improve track

Two things are genuinely Improve-sized, and neither delivers what was asked:

1. **Close the hybrid inconsistency.** `filterObservations` (`birdingStats.ts`)
   filters on `isSpuhOrSlash`, which deliberately omits hybrids, so the
   Statistics life-list total counts `" x "` hybrids as species. That
   contradicts the canonical `isNonCountableSpecies` predicate this repo
   settled on in v0.5.38 and promoted to CLAUDE.md. Zero new data, zero
   network. Delta for this user is 0 (their export has no hybrids), so it is
   correctness hygiene rather than a visible fix.
2. **Say so on the tab.** A short honest caption that the total includes
   exotics because the export carries no provenance. Copy only.

## Decisions touched

- **Statistics media-card behavior links + a countable-life-list coverage fix
  (2026-06-16, v0.5.38)** — establishes `isNonCountableSpecies` as *the*
  countable-life-list predicate and records that a parallel audit "confirmed
  no other stat had the same overcount." Escapees are a fourth exclusion class
  that decision did not contemplate, and the hybrid gap above is a partial
  counter-example to its audit claim. Either change extends or qualifies it.
- **Frivolous Lists (v0.5.36)** — "the lists reflect the ALL-TIME life list,
  independent of the Statistics tab's include-spuh toggle." Any new exclusion
  has to answer the same question, and the answer should match.
- **County Completeness (v0.5.54, D-402)** — the popup's "Countable species:
  spuhs, slashes & hybrids don't count" caption becomes inaccurate the moment
  a fourth exclusion exists.
- **Calendar offline guarantee (v0.5.63)** — the Calendar is explicitly
  zero-network and computes only from the loaded backup. Its species counts
  use `isNonCountableSpecies`, so a network-sourced exclusion cannot reach it
  without breaking that promise. This is a hard boundary on any design.

## Other surfaces reading the same predicate

In scope if the count rule changes: Statistics life-list totals and
milestones, media documentation coverage (`mediaStats.ts`), county
completeness (`countyCompleteness.ts`), Calendar species counts
(`calendar.ts`), Frivolous Lists.

Explicitly **not** in scope: the Life List / Multimedia table, Species Detail,
Breeding Codes, and List Comparer, which list species rather than headline a
life-list count, and the Map Explorer, which filters observations for display.

## What done looks like

Not defined yet, because the lane is not settled. The decision this brief asks
for is whether to take the full acquisition build into the Feature lane, or
re-scope to the two Improve-sized items above and accept that SnowRaven's
total cannot match eBird's until the export changes.
