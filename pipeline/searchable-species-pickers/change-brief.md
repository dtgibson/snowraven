# Change Brief — Searchable Species Pickers

## What is changing
The app already has a shared type-to-find species picker (`SpeciesCombobox`,
extracted at v1.0.4 with the standing rule that future species pickers consume
it rather than re-inlining one). A sweep of every species-selection surface
found exactly ONE remaining scroll-only species dropdown: the Map Explorer's
My Sightings filter panel renders its Species filter as a native `<select>`
over `allSpecies` — every distinct species in the loaded eBird backup, easily
hundreds of options. That select becomes the shared `SpeciesCombobox` (typing
narrows by common or scientific name; the "All species" clearing row keeps the
filter clearable). All other species pickers are already searchable.

## Why now
Saved user idea: "where there is a dropdown to select a species, make it a
combo dropdown and search box so the user does not have to scroll a long list
of birds unless they want to." The two main pickers gained this at v1.0.4;
the Map Explorer filter is the leftover the idea still applies to.

## User-facing impact
One visible change: the Map Explorer Species filter becomes the same
type-to-find picker used on Species Detail and the Calendar (search icon,
text input, filtered listbox) instead of a scroll-only dropdown. What it
filters and how results render do not change. `docs/HELP.md` (My Sightings
filters, ~line 386), README, and website wording ride along in the same
change per the docs rule.

## Design pass
Needed. Surface refined: the Map Explorer filter panel (desktop sidebar and
phone fullscreen sheet), Species control only. What should feel better:
finding a bird by typing instead of scrolling. Open design questions the
Designer settles: fit in the compact sidebar register (panel controls run
~34px via `SELECT_STYLE`; the combobox ships 30px `sm` / 40px `md`), and the
absolutely-positioned listbox inside the panel's `overflow: hidden`
grid-collapse wrapper — it must not clip or be unreachable, at 320px width
and 200% text scale (WCAG 2.1 AA holds).

## Decisions touched
- v1.0.4 `SpeciesCombobox` extraction (DECISIONS.md "Calendar refinements"
  entry): APPLIED, not reversed — "future tabs needing a species picker
  consume `SpeciesCombobox` rather than re-inlining one."
- `.sr-input-16` iOS no-zoom guard: upheld — the combobox `className` prop
  puts the class on the input, as the existing select already carries it.
- Bird-names rule form-control exclusion: upheld — listbox rows render
  escaped plain text, the ratified pattern from the extraction (no
  `<BirdName>` inside form controls).

## What done looks like
On Map Explorer's My Sightings filters, typing in the Species control narrows
the list and Enter/click selects, with keyboard and screen-reader behavior
identical to Species Detail's picker; Species Detail and Calendar are
regression-free; vitest, typecheck, and build green with no entry-chunk
growth (both files are lazy chunks); docs updated in the same change.

## Affected surfaces (inventory)
- CHANGES: `frontend/src/components/MapExplorer.tsx:1880` — Species filter,
  native `<select>` over `allSpecies` (long bird list). The one target.
- Already searchable, no change: `SpeciesDetail.tsx:634` and
  `Calendar.tsx:990` (both `SpeciesCombobox`); `MapExplorer.tsx:2340`
  target-species picker (has its own "Search species…" input).
- Out of scope (not species, or short fixed lists): County selects
  (`SpeciesDetail.tsx:666`, `MapExplorer.tsx:1899`,
  `BreedingCodeList.tsx:434`, `Checklists.tsx:691`, `LifeList.tsx:790`),
  Protocol (`Checklists.tsx:675`), Media (`MapExplorer.tsx:1923`),
  Sex/Age (`LifeList.tsx:707`/`721`). Backend, data model: untouched.
  `SpeciesCombobox.tsx` changes only if the Designer needs a size variant.
