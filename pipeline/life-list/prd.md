# PRD — Life List
**Feature:** life-list
**Date:** 2026-05-12
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A Life List tab that accepts the user's eBird backup CSV, derives one entry per species (the life list), looks up media types for all submitted Macaulay Library assets via a backend proxy, and renders a filterable table showing which species have been seen, photographed, audio-recorded, and video-recorded.

---

## User Stories

**US-01** — As a birder, I want to upload my eBird backup CSV and see my complete life list, so I have a single view of every species I've observed.

**US-02** — As a birder, I want to see which of my life list species I've photographed, recorded audio of, and recorded video of, so I know my media coverage at a glance.

**US-03** — As a birder, I want to filter my life list to species missing a photo (or audio, or video), so I can identify target species for my next outing.

**US-04** — As a birder with a large list, I want to see a progress indicator while media types are being looked up, so I know the app is working and roughly how long it will take.

**US-05** — As a birder, I want to sort my life list by taxonomic order or alphabetically, so I can navigate it the way I prefer.

---

## Functional Requirements

### CSV Parsing

**FR-01** — The Life List tab shall accept the eBird backup CSV (`MyEBirdData.csv`) via drag-and-drop or click-to-browse file input, using the same drop zone pattern as the List Comparer.

**FR-02** — The parser shall read the following columns: `Common Name`, `Scientific Name`, `Taxonomic Order`, `ML Catalog Numbers`. If `Common Name` is absent, the file shall be rejected with a clear error message.

**FR-03** — The life list shall contain one entry per unique `Common Name`. For each species, the entry shall record:
- The lowest `Taxonomic Order` value seen across all rows for that species (for sorting)
- The union of all `ML Catalog Numbers` values across all rows for that species

**FR-04** — `ML Catalog Numbers` values shall be parsed as space- or comma-separated lists of numeric strings. Empty cells shall be treated as no media. Catalog numbers shall be deduplicated across all observations of a species.

**FR-05** — The same CSV exclusion rules as the List Comparer shall apply: spuh entries (ending in ` sp.`), slash species (containing `/`), and hybrids (containing ` x `) shall be excluded from the life list.

**FR-06** — If `Taxonomic Order` is absent or non-numeric for a species, that species shall sort to the end of the taxonomic list and sort alphabetically among other species with missing order values.

### Backend — ML Media Type Lookup

**FR-07** — The backend shall expose `POST /ml/media-types` accepting a JSON body `{"catalog_ids": ["123456", "789012", ...]}` and returning `{"media_types": {"123456": "Photo", "789012": "Audio", ...}}`.

**FR-08** — The endpoint shall query the Macaulay Library search API (`https://search.macaulaylibrary.org/api/v1/search`) using the `q` parameter with each catalog ID, requesting `mediaType=all`. It shall extract the `mediaType` field from the first result whose `catalogId` matches the queried ID.

**FR-09** — Catalog IDs shall be processed in batches of 25 to avoid overloading the ML API. Sequential batch requests are acceptable; parallel batching is a stretch goal.

**FR-10** — If a catalog ID returns no matching result from the ML API, it shall be omitted from the response (not treated as an error). The frontend shall interpret an absent ID as unknown media type.

**FR-11** — If the ML API is unreachable or returns a non-200 response for a batch, the endpoint shall return a 503 with a human-readable `detail` field. The frontend shall handle this gracefully and display an error state without crashing.

**FR-12** — The endpoint shall use a 10-second timeout per batch request.

### Frontend — Life List UI

**FR-13** — After the CSV is parsed, the frontend shall POST all collected catalog IDs to `/ml/media-types` and display a progress indicator while waiting. The progress indicator shall show approximate progress (e.g. "Looking up media… batch 3 of 12").

**FR-14** — Once media types are returned, each species row shall display four status indicators: **Seen** (always ✓), **Photo** (✓ if any catalog ID for that species has `mediaType: "Photo"`, otherwise —), **Audio** (✓ if `"Audio"`), **Video** (✓ if `"Video"`).

**FR-15** — A filter bar shall appear above the list with buttons: **All** · **No photo** · **No audio** · **No video**. Selecting a filter shows only species where that media type is absent. Multiple filters shall not be combinable in this version — only one active filter at a time.

**FR-16** — A sort toggle shall allow switching between **Taxonomic order** (default) and **A–Z**. The active sort shall be visually indicated.

**FR-17** — A species count shall be displayed (e.g. "312 species" or "47 species — No photo filter active").

**FR-18** — A **Show all / Collapse** toggle shall switch the species table between viewport-constrained scrolling (default) and full-height expansion where all rows are visible without scrolling. This facilitates printing. When expanded, the page itself scrolls rather than the table. The toggle button shall reflect the current state ("Show all" / "Collapse").

**FR-19** — A **Load new file** button shall reset the component to the upload state, clearing all parsed data and cached media types.

**FR-20** — The Vite dev proxy shall forward `/ml` to `http://localhost:1620` so the frontend can reach the backend in development.

### Error States

**FR-21** — If the CSV is missing the `Common Name` column, display: "This doesn't look like an eBird backup file. Make sure you're uploading MyEBirdData.csv."

**FR-22** — If the ML API lookup fails, display an error banner above the (partially rendered) list with: "Couldn't reach the Macaulay Library. Media coverage may be incomplete." The species list shall still render with whatever data is available; unknown media types shall display as — (dash).

---

## Non-Functional Requirements

**NFR-01 — Performance:** The UI shall remain responsive during ML lookups. Batch progress shall be reflected in the indicator after each batch completes, not only at the end.

**NFR-02 — Visual consistency:** The Life List tab shall use the same drop zone, color tokens, and typography as the List Comparer. The status indicators (✓ / —) shall use `#2D8653` for ✓ and `#D1D5DB` for —.

**NFR-03 — Privacy:** The backend proxy sends only numeric catalog IDs to the ML API — no user identity, no eBird credentials.

**NFR-04 — No API key:** The ML search API is public. No new environment variable or key is required.

---

## Out of Scope

- First-seen date or location per species
- Combined filters (e.g. "no photo AND no audio")
- Export of the filtered list
- Offline mode (ML lookup requires network)

---

## Success Metrics / QA Checklist

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | CSV accepted and parsed | Uploading `MyEBirdData.csv` populates the life list |
| QA-02 | Life list is deduplicated | Each species appears exactly once |
| QA-03 | Taxonomic order sort | List order matches eBird taxonomic sequence |
| QA-04 | Alphabetical sort toggle | A–Z button sorts list alphabetically; toggling back restores taxonomic order |
| QA-05 | ML catalog numbers extracted | Species with known ML submissions show ✓ in the correct media columns |
| QA-06 | Batch progress shown | Progress indicator updates as each batch completes |
| QA-07 | Photo filter works | "No photo" filter shows only species with no Photo media type |
| QA-08 | Audio filter works | "No audio" filter shows only species with no Audio media type |
| QA-09 | Video filter works | "No video" filter shows only species with no Video media type |
| QA-10 | ML error handled gracefully | With ML API mocked to fail, error banner appears and list still renders |
| QA-11 | Invalid file rejected | Uploading a non-eBird CSV shows the appropriate error message |
| QA-12 | Load new file resets state | Clicking "Load new file" returns to the upload state |
| QA-13 | No backend changes to weather/version routes | Existing tests still pass |
