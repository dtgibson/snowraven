# Strategic Brief — Standardized Bird-Name Format (app-wide)

**Lane:** New Feature
**Date:** 2026-06-04

## The idea
Every time a bird's name appears in SnowRaven, render it in one consistent,
useful format via a shared component:

1. **Common name** → a clickable link that opens that species on the
   **Species Detail** tab.
2. Immediately followed by the **eBird** and **Birds of the World** favicons
   (the existing `SpeciesLinks`).
3. **Scientific name** shown where there's room (as Breeding Codes / Media do
   today), omitted where space is tight.
4. **"Move the link to the number" rule:** where the common name is *currently*
   a link to something else (e.g. Statistics → Most Photographed links the name
   to Macaulay Library), the name instead links to Species Detail, and the
   associated **count/number** takes over the original link.
5. **Headings stay:** where the name is its own heading with badges/buttons
   (the Species Detail entry header), leave it as-is.

## Why
Consistency + discoverability: a birder can jump from any mention of a species
to its full personal history in one click, and always reach eBird/BoW. Today
the behavior is inconsistent (some names are plain text, some link to ML, some
to checklists, some have favicons, some don't).

## What this introduces
- A shared **`<BirdName>`** component (common-name link + `SpeciesLinks`
  favicons + optional scientific name), used everywhere a name is shown.
- A new **click-any-bird → Species Detail** navigation capability (mirrors the
  existing `requestedFilter` single-use cross-tab pattern; `SpeciesDetail`
  gains a `requestedSpecies` prop and selects it once its data is ready,
  honoring the merge-subspecies/normalize logic).

## Scope (from the inventory)
**Convert to the format:**
- **Statistics** (the bulk): Most Photographed / Audio / Video (name→Species
  Detail, media count→ML link), Milestones, Nemesis/Target species,
  Single-Checklist Birds, One-and-Done Birds, Biggest single-species counts,
  First species.
- **Map Explorer:** species names in the target popups and the nearest-targets
  sidebar list.
- **Already compliant (audit + tidy only):** Media List, Breeding Codes,
  Species Detail (Reported With / Top Locations), Life List Comparer.

**Out of scope (form controls — can't carry links/favicons):**
- Map Explorer's species **filter dropdown** (`<select>`) and the manual
  target-species **checkboxes**. These are inputs, not name displays.

**Headings unchanged:** the Species Detail entry header.

## Key decisions (RESOLVED at Stage 1 gate)
- **D1 → Plain name + favicons.** Link the common name to Species Detail ONLY
  when a local entry exists (the species is in the user's backup). Otherwise the
  name is plain text but still shows the eBird/BoW favicons — never a dead link.
  (Whether an entry exists is determined by the species being present in the
  user's loaded observations.)
- **D2 → Move the pan.** On the Map nearest-targets list, the name links to
  Species Detail; the map-pan action moves to a distinct element (distance label
  or a small locate icon).

---

### D1 — Birds that aren't in your data (no Species Detail entry)
Species Detail is built from *your* eBird backup, so a bird you've never
recorded — e.g. a **nemesis** or a **map target** species — has no Species
Detail entry to link to. What should its common name do?
- **(Recommended) Plain name + favicons, no Species-Detail link.** Only link
  the name to Species Detail when you actually have an entry; otherwise it's
  plain text but still gets the eBird/BoW favicons (so it's never a dead link).
- (Alt) Link the name to its **eBird species page** instead when there's no
  local entry.
- (Alt) Always link to Species Detail, which shows a "not in your data" state.

### D2 — Names that currently trigger a useful action (not just a link)
On the Map's **nearest-targets** list, clicking a row pans the map to that
sighting. Under the new format the name should go to Species Detail, so the
**pan action moves to another element** (e.g. the distance label or a small
locate icon). Confirm that's acceptable (it's the same "move the link to the
number" spirit).

## Non-goals
- No backend changes (taxon codes already resolve via `/taxonomy/codes`).
- No change to the Species Detail header, or to filter inputs.
- Not changing which species each tab lists — only how each name renders.

## Risks / notes
- **Taxon-code availability:** favicons + the eBird fallback need the species'
  code. Most tabs already resolve them; a few spots (e.g. some Stats lists)
  will need their code maps extended. The Architect will map this per-site.
- **Performance:** `<BirdName>` is presentational; taxon-code resolution is
  already batched per tab. No new N+1 calls.
- **Subspecies matching:** clicking "Yellow-rumped Warbler (Myrtle)" must land
  on the right Species Detail entry given the merge-subspecies toggle —
  handled by `normalizeSpeciesName`.

## Definition of done
Every user-facing bird name (outside form controls and the Species Detail
header) renders through `<BirdName>`: common name → Species Detail when an
entry exists, eBird/BoW favicons always, scientific name where space allows,
and any pre-existing link moved to the associated number/element.
