# PRD — ML Export Upload
**Feature:** ml-export-upload
**Session:** 001
**Date:** 2026-05-12
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

The Media Life List tab gains a second, preferred input path: the user uploads a Macaulay Library export CSV, which is parsed entirely client-side to produce an instant media life list with no CDN requests. The existing eBird CSV + CDN lookup path remains as an alternative. Three new positive filter pills ("has photo", "has audio", "has video") are added alongside the three existing negative filters.

---

## User Stories

**US-01** — As a birder with a Macaulay Library account, I want to upload my ML export CSV so that I can see my full media life list in under a second without waiting for network lookups.

**US-02** — As a birder without an ML account or export, I want to still use my eBird backup CSV so that the CDN lookup path remains available.

**US-03** — As a birder reviewing my media life list, I want to filter to only species where I already have a photo, audio recording, or video, so that I can see what I've documented rather than only what I'm missing.

**US-04** — As a first-time user, I want to understand which upload method is preferred and how to get the ML export file, so that I can choose the right path without trial and error.

---

## Functional Requirements

### Upload interface

**FR-01** — The tab shall present two distinct upload options on the idle/drop screen: the ML export path and the eBird CSV path. The ML export option shall be visually prominent (presented first, labeled as the faster option). The eBird option shall be secondary.

**FR-02** — Each upload option shall accept files via drag-and-drop or click-to-browse. Both shall be independently functional drop targets.

**FR-03** — The ML export option shall include a brief instruction telling the user how to get the file: "Sign in to Macaulay Library → My Media → Save Spreadsheet."

**FR-04** — The system shall auto-detect which format was uploaded by inspecting the CSV header row. A file containing a `Format` column and a `Catalog Number` column (case-insensitive) shall be treated as an ML export. A file containing a `Submission ID` column shall be treated as an eBird CSV. If neither pattern matches, an error shall be shown: "This doesn't look like a Macaulay Library export or an eBird backup. Check you're uploading the right file."

**FR-05** — Either upload path shall lead to the same results table, filter pills, and sort controls. The user cannot tell which path generated the data from the results view alone (except that the ML path shows no batch progress indicator).

### ML export parsing

**FR-06** — The ML export parser shall read the following columns (case-insensitive header matching): `Catalog Number`, `Common Name`, `Scientific Name`, `Format`. Additional columns shall be ignored.

**FR-07** — The parser shall group rows by normalized Common Name (same normalization as the eBird parser: strip subspecies parentheticals, exclude spuh/slash/hybrid entries). For each unique species, it shall collect the union of all Format values present in the export.

**FR-08** — The parser shall produce a `mediaMap: Record<string, string>` keyed by Catalog Number (stripped of any non-digit prefix) and a `LifeListEntry[]` array — one entry per unique species — using the same `LifeListEntry` type as the eBird path.

**FR-09** — Because ML exports do not include taxonomic order, `taxOrder` for ML export entries shall default to the species' alphabetical rank (i.e. sort A-Z by default). The Taxonomic sort option shall be hidden when results were generated from an ML export; only the A-Z sort shall be shown.

**FR-10** — The ML export path shall not display the batch progress indicator. Parsing is synchronous and near-instant; the result shall appear directly without a loading state.

**FR-11** — If the `Format` column contains values other than Photo, Audio, or Video, they shall be silently ignored.

### Filters

**FR-12** — The filter pill row shall contain six pills in this order: All · No photo · No audio · No video · Has photo · Has audio · Has video.

**FR-13** — "Has photo" shall show only species where at least one entry in `mediaMap` for that species is `"Photo"`.

**FR-14** — "Has audio" shall show only species where at least one entry in `mediaMap` for that species is `"Audio"`.

**FR-15** — "Has video" shall show only species where at least one entry in `mediaMap` for that species is `"Video"`.

**FR-16** — Only one filter pill may be active at a time. Selecting any pill deactivates the previously active one.

**FR-17** — The species count label shall update to reflect the active filter: "47 of 312 species" when a filter is active, "312 species" when All is active.

### Reset

**FR-18** — "Load new file" shall return the tab to the two-option upload screen. Active filter, sort, and expanded state shall all reset.

---

## Non-Functional Requirements

**NFR-01 — Performance:** ML export parsing shall complete in under 500ms for an export containing up to 5,000 rows.

**NFR-02 — Clarity:** The UI shall make it clear which option is preferred without disabling or hiding the eBird option. Visual hierarchy (size, label, position) communicates preference — not a hard gate.

**NFR-03 — Error messaging:** File format errors shall name the expected format specifically so the user knows what to fix.

**NFR-04 — Accessibility:** Filter pills shall be keyboard-navigable and have sufficient color contrast. Active state shall not rely on color alone.

---

## Out of Scope

- Any changes to `backend/routers/ml.py` or the `POST /ml/media-types` endpoint
- Combining ML export data with eBird CSV data simultaneously
- Persisting either file between page loads
- Displaying taxonomy order for ML export results
- Changes to the Weather, Life List Comparer, or any other tab
- Validating that the ML export belongs to the same user as the eBird CSV

---

## Open Questions

**OQ-01 — ML export column name for catalog number:** The user described the column as `Catalog Number`. The actual Macaulay Library export may use a different header (e.g. `ML Catalog Number`). Default assumption: accept both `Catalog Number` and `ML Catalog Number` (case-insensitive, strip any non-digit prefix from the value).

**OQ-02 — Species normalization source for ML export:** The eBird path builds `LifeListEntry` from the eBird CSV, then looks up media types by catalog ID. The ML export path must build `LifeListEntry` from the ML CSV itself. Default assumption: Common Name from ML export is the species name; apply the same subspecies-stripping and exclusion rules as `parseLifeList.ts`.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | ML export upload — happy path | Upload a valid ML export CSV → results appear instantly with correct Photo/Audio/Video coverage per species |
| QA-02 | ML export — auto-detection | File with `Format` + `Catalog Number` columns is treated as ML export without user selecting a type |
| QA-03 | eBird CSV path unchanged | Upload MyEBirdData.csv → batch progress appears → results load as before |
| QA-04 | Auto-detection — wrong file | Upload an unrecognized CSV → error message shown, no crash |
| QA-05 | Has photo filter | Activate "Has photo" → only species with ≥1 Photo entry shown |
| QA-06 | Has audio filter | Activate "Has audio" → only species with ≥1 Audio entry shown |
| QA-07 | Has video filter | Activate "Has video" → only species with ≥1 Video entry shown |
| QA-08 | Existing negative filters | No photo / No audio / No video filters work correctly after this change |
| QA-09 | Filter count label | "47 of 312 species" shown when filter active; "312 species" when All active |
| QA-10 | Sort control — ML export | Only A-Z sort shown for ML export results; Taxonomic option absent |
| QA-11 | Sort control — eBird path | Both Taxonomic and A-Z sort options shown for eBird results |
| QA-12 | Reset | "Load new file" returns to two-option upload screen, all state cleared |
| QA-13 | ML export instructions | Drop screen shows "Sign in to Macaulay Library → My Media → Save Spreadsheet" |
