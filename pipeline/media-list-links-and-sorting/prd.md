# PRD — Media List Links and Sorting
**Feature:** media-list-links-and-sorting
**Session:** 001
**Date:** 2026-05-13
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Four improvements to the Media Life List table: media counts become clickable links to Macaulay Library; the redundant "Media" checkmark column is removed; the standalone sort button is removed; column headers become clickable sort controls.

---

## User Stories

**US-01** — As a birder reviewing my media coverage, I want to click a photo or audio count and land directly on Macaulay Library showing those recordings, so I can review or share them without searching manually.

**US-02** — As a birder looking at my media list, I want the table free of redundant columns, so I can focus on the data that actually varies.

**US-03** — As a birder, I want to sort the media list by any column — name, photo count, audio count, or video count — so I can find my most-documented species or spot gaps.

---

## Functional Requirements

**FR-01 — Remove the "Media" column**
The column currently showing a checkmark (✓) for every row shall be removed. Its header (the Eye icon / "Media" label) and all per-row cells shall be removed from the table. No other column is affected.

**FR-02 — Remove the standalone sort control**
The button group (`Taxonomic` / `A–Z`) in the controls row shall be removed entirely. Both variants (eBird path showing two buttons; ML export path showing only A–Z) are removed. Taxonomic sort does not survive in any form.

**FR-03 — Column headers are clickable sort triggers**
The four column headers — "Entries", "Photo", "Audio", "Video" — shall each be a clickable sort trigger. Clicking a header sorts the table by that column. Clicking the same header again reverses direction.

**FR-04 — Default sort: Entries ascending**
The default sort on load (both ML export and eBird paths) shall be "Entries" ascending (A–Z by common name). This matches the current A–Z default for ML export and replaces the taxonomic default for eBird.

**FR-05 — Sort direction defaults per column**
- "Entries": first click = ascending (A–Z); toggle = descending (Z–A)
- "Photo", "Audio", "Video": first click = descending (highest count first); toggle = ascending

**FR-06 — Active sort indicator**
The currently-sorted column header shall display a visual indicator of the active direction: `↑` for ascending, `↓` for descending. Inactive headers show no indicator.

**FR-07 — Non-zero counts are clickable links**
When a Photo, Audio, or Video count is greater than zero, the count shall render as an `<a>` element that opens the Macaulay Library catalog search for that species and media type in a new tab.

The link URL format shall be:
```
https://search.macaulaylibrary.org/catalog?taxaName={encodedName}&mediaType={type}
```
where `{encodedName}` is the entry's common name URL-encoded, and `{type}` is `Photo`, `Audio`, or `Video`.

The link opens in a new tab (`target="_blank"`, `rel="noreferrer"`). When count is zero, the dash (Minus icon) renders as before — no link.

**FR-08 — Link visual style**
Count links shall retain the existing count style (13px / font-weight 600 / #2D8653) and show a cursor pointer. No underline at rest; underline on hover. This makes them recognisably interactive without changing the table's visual weight.

---

## Non-Functional Requirements

**NFR-01 — No new network requests**
Links open in a new tab on ML. No prefetching, no requests initiated from SnowRaven.

**NFR-02 — Type system**
`SortOrder` in `types.ts` shall be replaced with a new `SortState` type: `{ column: 'name' | 'photo' | 'audio' | 'video'; dir: 'asc' | 'desc' }`. The existing `SortOrder` type (`'taxonomic' | 'alpha'`) shall be removed.

**NFR-03 — eBird path parity**
Both ML export and eBird paths produce the same table with the same sort and link behavior. No per-source special-casing in the table component.

---

## Out of Scope

- Filter pill changes
- Persisting sort state across sessions or file loads
- Linking zero-count cells
- Surfacing ML userId or deep-linking to the user's personal uploads filter
- Any parser changes

---

## Open Questions

**OQ-01 — ML catalog search URL:** `https://search.macaulaylibrary.org/catalog?taxaName=...&mediaType=Photo` is the expected format based on known ML URL conventions. The Engineer shall verify this opens a filtered results page for the correct species and type before shipping.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | "Media" column removed | Table renders with 4 columns: Entries, Photo, Audio, Video |
| QA-02 | Sort button removed | Controls row contains no sort button group |
| QA-03 | Column click sorts | Clicking "Photo" header sorts rows descending by photo count |
| QA-04 | Sort toggle | Clicking the active column header reverses direction |
| QA-05 | Sort indicator | Active column header shows ↑ or ↓; inactive headers show neither |
| QA-06 | Count link present | A species with 3 photos renders "3" as an `<a>` element |
| QA-07 | Count link URL | Photo link for "American Robin" opens `…?taxaName=American+Robin&mediaType=Photo` |
| QA-08 | Zero remains dash | A species with 0 videos shows dash, not a link |
| QA-09 | Default sort | On ML export load, table is sorted Entries A–Z by default |
| QA-10 | New tab | Clicking a count link opens ML in a new tab, not in the current window |
