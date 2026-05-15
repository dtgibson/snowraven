# PRD — Species Detail
**Feature:** species-detail
**Session:** 001
**Date:** 2026-05-15
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

The Species Detail tab lets users select any species from their eBird backup and see a complete per-species view: sighting history, media coverage, breeding code breakdown, and a searchable archive of all species-level comments — combining data from the eBird backup CSV and the Macaulay Library export.

---

## User Stories

**US-01** — As a birder, I want to select a species from a dropdown and immediately see my full history with that bird, so I can answer questions like "when did I first see it?" and "how many times have I recorded it?" without going back to eBird.

**US-02** — As a birder, I want to see at a glance whether I have photos, audio, and video of a species, so I know where my media gaps are.

**US-03** — As a birder, I want to see all my notes about a species in one place, so I can find observations where I recorded useful field notes.

**US-04** — As a birder, I want to see every breeding code I've reported for a species, so I can track my breeding evidence history.

**US-05** — As a birder, I want the tab to load from my stored files automatically, so I don't have to re-upload anything when I already have files saved in Settings.

**US-06** — As a birder, I want to search my species list by name, so I can get to any species quickly without scrolling through a long list.

---

## Functional Requirements

### Tab and Loading

**FR-01** — The Species Detail tab shall be placed between Life List Comparer and Settings in the tab bar.

**FR-02** — On mount, the tab shall attempt to auto-load stored files by fetching `GET /settings/files`. If an eBird backup is stored, it shall fetch `GET /settings/files/ebird` and parse it. If an ML export is stored, it shall fetch `GET /settings/files/ml` and parse it in parallel. The tab shall display a spinner during this phase (`loading-saved` state).

**FR-03** — If no eBird backup is available (not stored, not uploaded), the tab shall display an upload drop zone accepting `MyEBirdData.csv`, with a note that the ML export can be added in Settings for media data. An eBird backup is required; the ML export is optional.

**FR-04** — The tab shall accept a manually uploaded eBird backup via drag-and-drop or click-to-browse on the upload zone. A manually uploaded file is session-only and does not affect the stored file.

**FR-05** — The eBird backup shall be parsed into a flat list of `ObservationEntry` records — one record per species per checklist submission row — preserving: `submissionId`, `commonName`, `scientificName`, `date` (YYYY-MM-DD), `location` (location name), `count` (integer or null for "X"/presence-only), `breedingCode` (the code abbreviation, or null if absent), `speciesComments` (raw string, may be empty), and `catalogIds` (string array, from the `ML Catalog Numbers` column, `ML` prefix stripped).

**FR-06** — The ML export shall be parsed using the existing `parseMLExport` function, producing a `mediaMap` of catalogId → Format (Photo/Audio/Video).

**FR-07** — Parsing errors (not a valid eBird backup, missing required columns) shall display an inline error message. The upload zone shall remain visible so the user can try another file.

### Species Selector

**FR-08** — Once an eBird backup is loaded, the tab shall display a searchable species selector. The selector shall list all unique common names from the loaded eBird backup.

**FR-09** — Species in the selector shall be sorted taxonomically if taxon order data is available (fetched via `POST /taxonomy/codes` after the file loads), otherwise alphabetically. The taxonomy fetch is fire-and-forget — the selector is usable immediately in alphabetical order while the fetch is pending.

**FR-10** — The selector shall support type-to-filter: as the user types, the list narrows to species whose common name or scientific name contains the search string (case-insensitive). The full dropdown shall be visible without typing.

**FR-11** — On initial load, no species shall be selected. The main area shall display a prompt: "Select a species above to see your history with it."

**FR-12** — Selecting a species shall immediately display that species' detail view without any loading state (all data is already parsed client-side). Switching species shall replace the detail view instantly.

### Summary Card

**FR-13** — The summary card shall display the species' common name as a large heading and scientific name as an italic subtitle below it.

**FR-14** — The summary card shall display three media indicator buttons — Photo, Audio, Video — that are visually filled/highlighted if the species has ≥1 catalog item of that type in the ML export, and greyed out if not. If no ML export is loaded, all three indicators shall be shown in a neutral "unavailable" state with a tooltip or label: "Load ML export in Settings for media data."

**FR-15** — If the species has any breeding codes recorded, the summary card shall display a single pill showing the highest-tier code reported (tier 4 > 3 > 2 > 1; ties broken by canonical code order). The pill shall use the tier color from the existing `TIER_COLORS` token. If no breeding codes are recorded, no breeding code indicator is shown.

### Sightings Section

**FR-16** — The Sightings section shall display four statistics:
  - **Total sightings**: count of observation rows for the selected species
  - **First seen**: the earliest `date` value across all observations, formatted as a human-readable date (e.g. "12 March 2019")
  - **Last seen**: the most recent `date` value, same format
  - **Personal best**: the maximum numeric `count` value across all observations; rows with a null count ("X"/presence-only) are excluded from this calculation. If all counts are null, display "—"

### Media Statistics Section

**FR-17** — The Media Statistics section shall display three counts — total Photos, Audio recordings, and Videos — derived by intersecting the species' `catalogIds` across all observations with the `mediaMap` from the ML export.

**FR-18** — Each count shall be a clickable link to the Macaulay Library catalog filtered by that species and media type, following the same URL pattern as the Media List tab: `https://search.macaulaylibrary.org/catalog?mediaType={type}&taxonCode={code}` with `&userId={userId}` appended when a user ID is available from the ML export filename.

**FR-19** — If no ML export is loaded, the Media Statistics section shall display a message: "Load your ML export in Settings to see media statistics." The section shall still be visible (not hidden) so the user understands it exists.

**FR-20** — If an ML export is loaded but the species has no catalog items, all counts shall display as 0 with non-linked dashes in place of count links.

### Breeding Codes Section

**FR-21** — The Breeding Codes section shall display a row for each unique breeding code recorded for the selected species, sorted by tier descending (tier 4 first) then by canonical code order within each tier.

**FR-22** — Each row shall show: a tier-colored dot (matching the Breeding Codes tab style), the code abbreviation, the full code label (from `BREEDING_CODE_MAP`), and a count of how many observations used that code.

**FR-23** — If no breeding codes are recorded for the selected species, the section shall display: "No breeding codes recorded."

### Comments Section

**FR-24** — The Comments section shall list all non-empty `speciesComments` values across all observations for the selected species. Rows with an empty or whitespace-only comment shall be excluded.

**FR-25** — Each comment row shall display: the observation date (formatted as "12 March 2019"), the location name, and the comment text. Rows shall be separated by a visible divider.

**FR-26** — Comments shall be sortable by date: ascending (oldest first) or descending (newest first, the default). A sort toggle control shall be displayed above the comments list.

**FR-27** — Comments shall be filterable by a keyword text input. The filter shall match case-insensitively against comment text only (not date or location). The input shall appear above the comments list alongside the sort control. Filtering to zero results shall display: "No comments match this filter."

**FR-28** — If the selected species has no comments at all (after excluding empty rows), the section shall display: "No species comments found."

---

## Non-Functional Requirements

**NFR-01 — Performance:** The initial parse of the eBird backup (which may contain 100,000+ rows for active birders) shall complete without blocking the UI. Species switching shall be instantaneous — no re-parsing on selection change.

**NFR-02 — Accessibility:** The species selector shall be keyboard-navigable. Section headings shall use semantic heading elements or appropriate ARIA roles.

**NFR-03 — Theming:** All colors shall use `var(--sr-*)` CSS custom properties. No hardcoded hex values.

**NFR-04 — Backend unchanged:** No new backend endpoints. All data processing is client-side.

**NFR-05 — Subspecies handling:** Subspecies entries (e.g. "Yellow-rumped Warbler (Myrtle)") appear as separate entries in the species selector. They are not merged with the parent species.

---

## Out of Scope

- Checklist-level comments (only `Species Comments` column, not `Checklist Comments`)
- Map view of sighting locations
- Comparison across species or users
- Pagination of the comments list (all comments rendered, browser scrolls)
- Export or print of the species detail view
- Sorting or filtering by location, protocol, or observer count

---

## Open Questions

**OQ-01 — ML userId source:** The tab derives userId from the stored ML export filename via `GET /settings/files` metadata, falling back to no userId if the filename doesn't match the expected pattern `^ML__.*_([A-Za-z0-9]+)\.csv$`.

**OQ-02 — Count display for "X" records:** Personal Best shows the numeric maximum, excluding "X" rows. Display "—" only when every observation is "X".

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Auto-load from stored files | Tab mounts in `loading-saved` state, transitions to `ready` with species selector populated when eBird backup is stored |
| QA-02 | Upload fallback | When no stored eBird backup exists, upload drop zone appears; dropping a valid CSV populates the species selector |
| QA-03 | Invalid file rejected | Dropping a non-eBird CSV shows an inline error and keeps the upload zone visible |
| QA-04 | Species selector filters correctly | Typing "warbler" shows only species whose common or scientific name contains "warbler" (case-insensitive) |
| QA-05 | No species selected = prompt | Before selecting any species, the main area shows the "Select a species" prompt |
| QA-06 | Summary card — names | Selecting a species shows the correct common name and scientific name |
| QA-07 | Summary card — media indicators | Photo/Audio/Video indicators are filled for types present in ML export; grey when absent; "unavailable" state shown when no ML export loaded |
| QA-08 | Summary card — breeding code pill | Shows the highest-tier code in the correct tier color; absent when no breeding codes recorded |
| QA-09 | Sightings — total | Total count matches number of observation rows for the species in the eBird backup |
| QA-10 | Sightings — first/last seen | First seen = earliest date; last seen = most recent date across all observations |
| QA-11 | Sightings — personal best | Shows numeric maximum count; shows "—" when all counts are "X" |
| QA-12 | Media stats — counts | Photo/Audio/Video counts match catalogIds × mediaMap intersection for the species |
| QA-13 | Media stats — ML links | Clicking a count opens ML catalog with correct taxonCode and mediaType; userId appended when available |
| QA-14 | Media stats — no ML export | "Load ML export in Settings" message shown; section is visible |
| QA-15 | Breeding codes — listed correctly | Each unique code shown with correct label, tier dot, and count |
| QA-16 | Breeding codes — sort order | Codes sorted tier 4 → 1; within same tier by canonical order |
| QA-17 | Breeding codes — empty state | "No breeding codes recorded" shown when species has none |
| QA-18 | Comments — excluded empty | Rows with empty or whitespace-only speciesComments do not appear |
| QA-19 | Comments — sort toggle | Toggling date sort reverses the comment order |
| QA-20 | Comments — keyword filter | Typing a keyword narrows comments to those containing it; clearing restores all |
| QA-21 | Comments — zero results | "No comments match this filter" shown when keyword filter produces empty result |
| QA-22 | Comments — empty state | "No species comments found" when species has no non-empty comments |
| QA-23 | No backend changes | `git diff HEAD backend/` is empty |
| QA-24 | All colors tokenized | No hardcoded hex values in any new component file |
