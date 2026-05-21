# PRD — Tab Filters

## Overview

Add county and date-range filter controls to the Breeding Codes, Media List, and Species Detail tabs, letting users narrow their data to a specific place and time window. A Total media count column (Photo + Audio + Video) is added to the Media List table.

---

## User Stories

| ID | Story |
|----|-------|
| US-01 | As a birder, I want to filter the Breeding Codes table by county so I can review evidence from a specific location. |
| US-02 | As a birder, I want to filter the Breeding Codes table by date range so I can focus on a breeding season or year. |
| US-03 | As a birder, I want to filter the Media List by county so I can assess my media coverage in a specific area. |
| US-04 | As a birder, I want to filter the Media List by date range so I can review what I captured in a given period. |
| US-05 | As a birder, I want to filter Species Detail by county and date range to narrow sightings and stats for a specific context. |
| US-06 | As a birder using an ML export, I want county data resolved automatically so I can filter even when my export lacks a county column. |
| US-07 | As a birder, I want to see a Total media count per species in the Media List so I can compare overall media coverage at a glance. |

---

## Functional Requirements

### County Filter — All Tabs

| ID | Requirement |
|----|-------------|
| FR-01 | Each tab (Breeding Codes, Media List, Species Detail) shows a county dropdown control in the toolbar area. |
| FR-02 | The dropdown is populated only with counties present in the loaded data — no hardcoded list. |
| FR-03 | The default selection is "All Counties" — no filtering applied until the user acts. |
| FR-04 | Selecting a county filters the visible data to rows/entries matching that county. |
| FR-05 | Selecting "All Counties" removes the county filter. |
| FR-06 | The county filter composes with the date range filter and all existing filter pills/toggles (AND logic). |

### County Resolution — ML Export

| ID | Requirement |
|----|-------------|
| FR-07 | The ML export parser reads a County column if present in the file header. |
| FR-08 | The ML export parser reads Location, Latitude, and Longitude columns to support fallback resolution. |
| FR-09 | If no County column exists in the ML export, the frontend cross-references each entry's Location value against the loaded eBird backup (if available) to resolve the county. |
| FR-10 | If cross-reference yields no county for an entry, the frontend calls `POST /nominatim/counties` with the entry's lat/lng to resolve via Nominatim reverse geocoding. |
| FR-11 | County resolution runs asynchronously after file load; entries without a resolved county are excluded from the county dropdown options but remain in the data (visible under "All Counties"). |
| FR-12 | The county dropdown on the Media List tab shows a loading indicator while async resolution is in progress; it becomes interactive when resolution is complete. |

### Date Range Filter — All Tabs

| ID | Requirement |
|----|-------------|
| FR-13 | Each tab shows a "From" and "To" date input in the toolbar area. |
| FR-14 | Date inputs use `<input type="date">` (YYYY-MM-DD format, native browser picker). |
| FR-15 | Both inputs default to empty — no date filtering applied until the user enters a value. |
| FR-16 | When only "From" is set, the filter shows all entries on or after that date. |
| FR-17 | When only "To" is set, the filter shows all entries on or before that date. |
| FR-18 | When both are set, the filter shows entries where date falls within [From, To] inclusive. |
| FR-19 | The date range filter composes with the county filter and all existing filter pills/toggles (AND logic). |

### Parser Updates

| ID | Requirement |
|----|-------------|
| FR-20 | `parseBreedingCodes` returns per-row data including County and Date for each observation. |
| FR-21 | `parseMLExport` returns per-entry data including Location, County (if present), Latitude, Longitude, and Date. |
| FR-22 | `parseEbirdObservations` returns County in addition to already-parsed fields (Date, Location, LocationId, Lat, Lng). |
| FR-23 | All filters derive from the parsed row data; aggregation (species-level rollup) happens after filtering. |

### Total Media Column — Media List

| ID | Requirement |
|----|-------------|
| FR-24 | A "Total" column appears in the Media List table to the right of the Video column. |
| FR-25 | The Total value for each species row is Photo + Audio + Video counts. |
| FR-26 | The Total column is sortable by clicking its header; sort direction toggles on successive clicks. |
| FR-27 | The Total column respects the active county and date range filters — it reflects filtered counts only. |

### Backend — Nominatim Endpoint

| ID | Requirement |
|----|-------------|
| FR-28 | `POST /nominatim/counties` accepts a JSON body: `{ "locations": [{ "lat": float, "lng": float }] }`. |
| FR-29 | The endpoint returns `{ "results": [{ "lat": float, "lng": float, "county": string \| null }] }`. |
| FR-30 | The endpoint enforces ≤1 Nominatim request per second and de-duplicates identical coordinates within a request. |
| FR-31 | Resolved lat/lng → county pairs are cached in process memory for the server's lifetime; the cache is consulted before any network call. |

### Reset

| ID | Requirement |
|----|-------------|
| FR-32 | All filter state (county selection, date range) resets when a new file is loaded on any tab. |

---

## Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-01 | County dropdown population and filter application must feel instantaneous for datasets up to 10,000 rows. |
| NFR-02 | Nominatim resolution must not block the UI; all geocoding is async and shown with a progress indicator. |
| NFR-03 | The Nominatim endpoint must comply with OSM usage policy: ≤1 req/sec, User-Agent header set. |
| NFR-04 | All new UI controls must respect the existing dark/light theme via `var(--sr-*)` tokens. |
| NFR-05 | The Total column must match the existing column styling (sortable header, hover state, responsive width). |

---

## Open Questions

| ID | Question | Impact |
|----|----------|--------|
| OQ-01 | Does the ML export include a "County" column? | Determines whether path 1 of the resolution chain ever fires |
| OQ-02 | Does the ML export include "Latitude" / "Longitude" columns, or are they under a different name? | Affects parser column mapping |
| OQ-03 | Does the ML export include a "Date" column, and what is its format? | Affects date filter accuracy for ML-only users |

---

## Success Metrics (QA Acceptance)

| ID | Scenario | Expected |
|----|----------|----------|
| QA-01 | Load eBird CSV, select a county | Table shows only species observed in that county |
| QA-02 | Load eBird CSV, set From date | Table shows only species with observations on or after that date |
| QA-03 | Load eBird CSV, set To date | Table shows only species with observations on or before that date |
| QA-04 | Load eBird CSV, set From and To | Table shows species with observations in the window only |
| QA-05 | Load eBird CSV, select county + set date range | Table shows species matching BOTH filters |
| QA-06 | Load eBird CSV, county + date + code pill active | All three filters compose correctly |
| QA-07 | Select a county, then "All Counties" | Full unfiltered table restored |
| QA-08 | Clear date inputs | Full unfiltered table restored |
| QA-09 | Load a new file | County dropdown resets to "All Counties", date inputs clear |
| QA-10 | Load ML export with County column | County dropdown populated from that column |
| QA-11 | Load ML export without County column, eBird backup loaded | Counties resolved via location name cross-reference |
| QA-12 | Load ML export without County column, no eBird backup | Counties resolved via Nominatim; loading indicator shown |
| QA-13 | Nominatim resolves county for a lat/lng | Entry appears under resolved county in dropdown |
| QA-14 | Entry has no county resolvable by any method | Entry included in "All Counties" view, excluded from specific county options |
| QA-15 | Media List Total column | Total = Photo + Audio + Video per species row |
| QA-16 | Sort Media List by Total column | Rows sort by total count descending (then ascending on second click) |
| QA-17 | Filter Media List by county, check Total | Total column reflects filtered counts |
| QA-18 | Filter Media List by date range, check Total | Total column reflects filtered counts |
| QA-19 | County filter on Species Detail | Sightings, stats, breeding codes, locations, map all narrow to that county |
| QA-20 | Date filter on Species Detail | All sections narrow to the date window |
| QA-21 | County + date on Species Detail | Sections narrow to both constraints |
| QA-22 | Dark mode | All new controls render correctly in dark theme |
| QA-23 | `POST /nominatim/counties` — repeated coordinate | Second call returns cached result; no second network request |
