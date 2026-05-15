# Strategic Brief — Taxonomic Sort

## What We're Building

Sort buttons on the Media List and Breeding Codes tabs that let the user switch between A–Z (alphabetical by common name) and Taxonomic order (eBird's official species sequence), matching the sort control that already exists on the Life List Comparer.

## Why Now

The Life List Comparer already has this sort toggle, so the pattern is proven and the user expects consistency across all three list tabs. Alphabetical order is useful for looking up a specific species, but taxonomic order is the natural sequence for birders reviewing their coverage — it's how eBird organises checklists, field guides, and life lists. The Breeding Codes and Media List tabs currently offer no way to view results in that sequence.

## The User Problem

A birder reviewing their Media List or Breeding Codes tab to find gaps in their coverage naturally thinks in taxonomic terms — waterfowl first, raptors together, passerines last. The current alphabetical-only ordering on both tabs breaks that mental model and makes gap analysis harder than it needs to be.

## Success Criteria

- Clicking "Taxonomic" on the Media List sorts entries by eBird taxonomic order regardless of whether the source is an ML export or an eBird backup CSV
- Clicking "Taxonomic" on the Breeding Codes tab does the same
- Clicking "A–Z" on either tab returns to alphabetical sort by common name
- The active sort button is visually distinct from the inactive one
- The drop zone "no network lookups" claim is removed or corrected — a lightweight taxonomy fetch already fires for species links

## Scope

- Sort toggle (A–Z / Taxonomic) on the Media List tab — both ML export and eBird CSV sources
- Sort toggle (A–Z / Taxonomic) on the Breeding Codes tab
- Taxonomic order returned by the existing `POST /taxonomy/codes` backend endpoint, extended to include `orders: { commonName: taxonOrder }` alongside the existing `codes` map — no new endpoint, no new network call
- For Media List eBird CSV: `taxonomicOrder` is already on `LifeListEntry` and can be used directly; the taxonomy fetch provides a fallback for any species the parsed order missed
- Fix the drop zone UI copy that claims "no network lookups" — a taxonomy fetch already fires after load

## Out of Scope

- Taxonomic sort on the Life List Comparer (already exists)
- Any new sort dimensions beyond A–Z and Taxonomic
- Saving or persisting the user's sort preference across sessions

## Key Decisions

- Extend `POST /taxonomy/codes` to return `orders: { commonName: taxonOrder }` — reuses the already-cached eBird taxonomy fetch, fires as a single call after file load on both tabs
- The Taxonomic button is available on all Media List sources — ML export taxonomic order comes from the taxonomy fetch, eBird CSV order comes from the parsed CSV (with the fetch as backup)
- For Breeding Codes, taxonomic sort orders the species name column; column-header count sorts remain available and work independently
