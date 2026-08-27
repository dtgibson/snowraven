# Named Birds Top Locations

### What this does

Adds a ranked "Top locations" block to each expanded card on the Named Birds tab,
between the sighting reports and the map. It ranks the places that individual has
been recorded, counted only from the checklists carrying its `[name:…]` tag, so it
answers "where does this bird turn up" rather than "where does this species turn
up". Five rows show by default with the app's existing expander beyond that; a
one-location bird gets a sentence instead of a ranking of one, and a bird with no
location names in its export gets no block at all.

### Files changed

- `frontend/src/lib/namedBirds.ts` — new pure helper `computeNamedBirdLocations`
  (+ the `NamedBirdLocation` type): groups a single individual's sightings by
  location name, keeps the first id seen for that name, skips unlocated sightings,
  ranks by count then name. Same grouping rule as Species Detail's
  `computeLocationsSorted`, so the two surfaces agree on what one place is.
- `frontend/src/components/NamedBirdLocations.tsx` — new presentational component.
- `frontend/src/components/NamedBirdRow.tsx` — renders it above the map, behind the
  same `showMap` gate as the map and media sections.
- `frontend/src/lib/namedBirds.test.ts` — 8 new cases for the helper.
- `frontend/src/components/NamedBirdLocations.test.tsx` — 10 new component cases.
- `docs/HELP.md`, `README.md`, `website/index.html` — behaviour documented; the
  Species Detail cross-references now state what that tab's reuse does NOT include.
- `CHANGELOG.md`, `frontend/package.json`, `src-tauri/tauri.conf.json` — v1.0.3.

### How to test

1. Start the desktop app (`npm run desktop:dev`) so a real eBird backup is loaded.
2. Open the **Named Birds** tab and expand any named bird.
3. Between the reports and the map you should see **TOP LOCATIONS** with that bird's
   places ranked by sighting count, most first.
4. Check the arithmetic: the counts should sum to the card header's sighting count,
   minus any sighting whose report row shows no location.
5. Expand a bird with more than five places and use **Show all N locations**.
6. Expand a bird you have only ever seen in one place: it should read
   "Every sighting at {place}." with no numbering.

### Notes for reviewer

- The ranking never touches species-wide observations. Its only input is
  `bird.sightings`, which `computeNamedBirds` has already scoped to name-tagged
  checklists, and a test drives an unnamed pile of the same species at a rival
  location to prove the ranking ignores it.
- Counts are per checklist, not per row: `computeNamedBirds` already collapses a
  parent + subspecies pair from one checklist, so the totals reconcile with the
  card header. A test locks that.
- Species Detail's `NamedBirdsTable` reuse is untouched (the `showMap` gate), so
  its Named Individuals section renders exactly as before.
- `useHotspotSet()` is still called once in `NamedBirdsTable`; `isHotspot` is passed
  down. No new hook per row.
- No new design token, no new dependency, no new network call, no persisted setting.

### Verification

`npm run typecheck` clean, `npm run lint` clean, `npm run build` clean,
vitest 208 files / 3063 passed (+18 new), `weft-design-lint` clean on the new
component. The entry-chunk guard stays green (the new files pull no maplibre).

## Convention Flags

- A per-individual list on a Named Birds card is gated by the same `showMap` prop
  that gates the map and media, not by a new prop: that one flag now means
  "this is the Named Birds tab, not Species Detail's reuse".
- Where a ranked list can degenerate to one item, render a sentence rather than a
  ranking of one, and render nothing at all when there is no data to rank, matching
  how the card already omits the map for a bird with no coordinates.
