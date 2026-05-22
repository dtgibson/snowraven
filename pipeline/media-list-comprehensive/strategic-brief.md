# Strategic Brief — Media List: Comprehensive Species View

## What's Being Built

Four connected improvements to the Media Life List tab:

1. **Comprehensive species backbone** — the tab currently shows only species present in the ML export. After this change, it shows every species from the eBird backup CSV, with media counts from the ML export where they exist and zeros (dashes) where they don't. The eBird backup becomes the species source of truth; the ML export provides media annotation.

2. **Subspecies merge/show toggle** — a `ToggleSwitch` ("Show subspecies") matching the one on Species Detail. Off by default: subspecies parentheticals normalized, data aggregated. On: each variant is its own row.

3. **Spuh/slash toggle** — a `ToggleSwitch` ("Show sp./slash") matching the one on Species Detail. Off by default.

4. **Non-bird entries toggle** — a `ToggleSwitch` ("Show non-bird"). Non-bird entries are defined as ML export rows whose (normalized) species name does NOT appear anywhere in the eBird backup species list. These are recordings of insects, soundscapes, habitat, and other non-bird subjects that Macaulay Library accepts but eBird's bird checklist does not. Off by default. When shown, non-bird entries always sort at the end in taxonomic order (no taxon order → Infinity, same as unranked species today, but reliably after all eBird species).

## Data Model

- **Bird species**: appears in eBird backup (normalized name in the backup's species set)
- **Non-bird**: appears in ML export only, not in the eBird backup species set
- **ML-only path** (no eBird backup loaded): all ML export species are shown; non-bird toggle is hidden since there's no eBird backup to compare against

## Why It Fits

The product brief defines SnowRaven as a personal birding data tool. The Media List currently has a significant blind spot: you can't see your full species list annotated with media status — only species where you've already uploaded something. The primary value of a life list is completeness: "which of my 400 life list species have I never photographed?"

The four toggles are consistent with existing patterns. Subspecies and spuh/slash already exist on Species Detail. The non-bird toggle addresses a real ML-export data quality issue — Macaulay Library accepts non-bird recordings which pollute a bird life list if not filtered.

## What Changes

- `LifeList.tsx` — species list derives from eBird backup merged with ML rows; new toggle state (mergeSubspecies, showSpuh, showNonBird); non-bird set computed from the difference of ML species and eBird species
- `LifeListTable.tsx` — subspecies merge + spuh/slash + non-bird filtering before existing sort/filter pipeline; non-bird rows sort after all ranked species in taxonomic mode
- Upload UI and Settings auto-load path — graceful degradation when only ML export is available

## What Doesn't Change

- ML media links, filter pills, sort controls, column structure, Settings storage
- ML-only path behavior when no eBird backup is loaded

## Out of Scope

- County/date filtering on the Media List
- Any backend changes
- Changing how media counts are computed

## Key Risk

The eBird backup species set must be built from normalized names (after subspecies merge) to correctly identify non-bird entries. The Architect will specify the exact construction of the non-bird detection set.
