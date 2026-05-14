# PRD — Media Life List Improvements
**Feature:** media-life-list-improvements
**Session:** 001
**Date:** 2026-05-13
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview
Three corrections to the Media Life List tab: the "Seen" column is renamed to "Media", per-species Photo/Audio/Video columns show a count of individual media items rather than a checkmark, and soundscape entries from Macaulay Library exports are no longer excluded from the list.

---

## User Stories

**US-01** — As a birder reviewing my media coverage, I want Photo, Audio, and Video columns to show how many recordings I have per species, so I can see at a glance whether I have one photo or twenty.

**US-02** — As a birder who records audio, I want the column that marks my coverage to be labelled "Media" rather than "Seen", so the label is accurate for species I've heard but never seen.

**US-03** — As a birder who records soundscapes on Macaulay Library, I want those entries to appear in my media list, so the list reflects my complete export rather than a silently filtered subset.

---

## Functional Requirements

**FR-01** — The column header currently labelled "Seen" shall be renamed to "Media". Its icon and always-present checkmark per row shall remain unchanged.

**FR-02** — The Photo column shall display the count of catalog IDs in that species entry whose media type is "Photo". If the count is zero, a dash (—) shall be displayed instead of a number. If the count is one or more, the integer shall be displayed.

**FR-03** — The Audio column shall display the count of catalog IDs in that species entry whose media type is "Audio", following the same zero/non-zero display rule as FR-02.

**FR-04** — The Video column shall display the count of catalog IDs in that species entry whose media type is "Video", following the same zero/non-zero display rule as FR-02.

**FR-05** — The ML export parser shall no longer exclude entries whose common name is "Soundscape" (case-insensitive). Soundscape entries shall be parsed, grouped, and returned in the same manner as any other species entry.

**FR-06** — All existing filter pills (No photo, No audio, No video, Has photo, Has audio, Has video) shall evaluate correctly for soundscape entries. No changes to filter logic are required — FR-05 ensures soundscape entries are present in the data the filters already operate on.

**FR-07** — The parser unit test that currently asserts soundscape entries are excluded shall be updated to assert they are included, with correct common name and media type in the result.

---

## Non-Functional Requirements

**NFR-01 — Performance:** Count calculation shall happen at render time from the existing `entry.catalogIds` array and `mediaMap` object — no additional parsing, network requests, or data transformation passes are required.

**NFR-02 — Compatibility:** The eBird backup CSV path (which does not go through `parseMLExport`) shall be unaffected by these changes. The count display in FR-02–04 uses the same `mediaMap` structure populated by both paths, so counts shall work correctly for eBird results as well.

---

## Out of Scope

- Changes to filter pill labels, colours, or logic
- New columns or changes to column width/layout
- Any changes to the eBird backup CSV parser (`parseLifeList.ts`)
- Display changes for the eBird backup CSV path beyond what NFR-02 already provides
- Handling of any Macaulay Library entry types other than Photo, Audio, and Video

---

## Open Questions

None — all decisions are resolved in this document.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Column header rename | The table header reads "Media", not "Seen" |
| QA-02 | Photo count — species with photos | A species with 3 photo catalog IDs shows "3" in the Photo column |
| QA-03 | Audio count — species with audio | A species with 1 audio catalog ID shows "1" in the Audio column |
| QA-04 | Video count — species with video | A species with 2 video catalog IDs shows "2" in the Video column |
| QA-05 | Dash for zero | A species with no photos shows "—" (dash icon) in the Photo column, not "0" |
| QA-06 | Soundscape entries parsed | An ML export containing a Soundscape row produces a "Soundscape" entry in the rendered list |
| QA-07 | Soundscape filter behaviour | With "Has audio" active, a Soundscape entry with audio appears; with "No audio" active, it does not |
| QA-08 | eBird path unaffected | Loading an eBird backup CSV produces counts in the Photo/Audio/Video columns using the existing mediaMap data |
| QA-09 | Parser test passes | The updated unit test for `parseMLExport` passes with the soundscape inclusion assertion |
