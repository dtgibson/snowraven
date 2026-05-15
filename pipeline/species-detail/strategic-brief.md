# Strategic Brief — Species Detail

## What We're Building

A new "Species Detail" tab that accepts the eBird backup CSV and ML export and provides a per-species drill-down: sighting history, media coverage, breeding code breakdown, and a searchable comments archive — all for a single species selected from a dropdown.

## Why Now

SnowRaven already holds two rich datasets in memory — the eBird backup and the ML export — but surfaces only aggregate views of them. A species-level drill-down is the natural next layer: it asks a different question ("tell me everything about my experience with this species") rather than requiring users to cross-reference the breeding codes tab, media list, and their own memory of field notes. The comments archive in particular surfaces data that currently has no home in the app at all.

## The User Problem

The eBird backup contains per-observation species comments, breeding codes, and counts that are invisible once uploaded — there's no way to answer questions like "when did I first see this bird?", "how many times have I recorded it?", or "what notes did I leave on past sightings?" without going back to eBird itself. Combining this with ML export data means the user can see the full picture — sighting history, media coverage, and field notes — in one view without leaving the app.

## Success Criteria

- A user can select any species from their loaded data and immediately see all key statistics without waiting for any network requests
- A user can find their earliest sighting, personal best count, and most recent observation at a glance
- A user can read through all their comments for a species chronologically — and filter or sort them to find specific notes
- A user can see at a glance whether they've captured photo, audio, and video of a species, and jump directly to their Macaulay Library assets
- The tab auto-loads from stored files (Settings), so no re-upload is required if files are already saved

## Scope

- Species selector: searchable dropdown listing all species present in the loaded eBird backup
- **Summary card**: common name, scientific name, media coverage indicators (Photo / Audio / Video — shaded if present), highest breeding code reported (with tier color)
- **Sightings**: total observation count, first seen, last seen, max individuals on a single checklist
- **Media statistics**: total photo / audio / video item counts with Macaulay Library filter links (same pattern as Media List tab); links use taxon code + userId when available
- **Breeding codes**: per-code breakdown (code label, tier color, count reported) — same visual language as the Breeding Codes tab but scoped to one species
- **Comments**: all species-level comments across checklists, sortable by date (asc/desc), filterable by keyword; includes date and location name per comment row; empty comments excluded
- Auto-loads from stored eBird backup and ML export (stored via Settings); falls back to an upload prompt if neither is present
- Taxon code fetched via existing `POST /taxonomy/codes` endpoint for ML links and sorted species list

## Out of Scope

- Checklist-level comments (only species-level comments from the eBird backup `Species Comments` column)
- Map view of sighting locations
- Comparison across users or files
- Any backend changes — all parsing is client-side from the already-loaded CSV data
- Pagination of the comments list (render all, let the browser scroll)
- Export or print of the species detail view

## Key Decisions

- **Data source**: eBird backup provides sightings, counts, breeding codes, and comments; ML export provides media format breakdown. Both are already handled by the Settings stored-file pattern — no new upload mechanism needed.
- **New parser required**: The existing `parseLifeList.ts` deduplicates to one entry per species. The Species Detail tab needs raw per-observation rows. A new `parseEbirdObservations.ts` will parse the eBird backup into `ObservationEntry[]` (one row per checklist submission per species), used only by this tab.
- **Species selector is a searchable dropdown**, not a full list — the number of species can be large (500+) and a dropdown with type-to-filter is the right fit.
- **Media data is optional**: if no ML export is loaded (or stored), the media section shows a "no ML export loaded" message rather than blocking the species selection.
- **No new backend endpoints**: all processing is client-side.
