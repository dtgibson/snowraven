# PRD — Settings Tab
**Feature:** settings-tab
**Session:** 001
**Date:** 2026-05-15
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A Settings tab (rightmost in the tab bar) where users can upload and persistently store their eBird backup CSV and ML export file on the server's filesystem. Stored files are fetched and auto-loaded by the Breeding Codes and Media List tabs on mount, eliminating re-uploads between sessions.

---

## User Stories

**US-01** — As a SnowRaven user, I want to upload my eBird backup once on the Settings tab so that the Breeding Codes tab loads my data automatically on every visit.

**US-02** — As a SnowRaven user, I want to upload my ML export once on the Settings tab so that the Media List tab loads automatically with my data.

**US-03** — As a SnowRaven user, I want to see which files are stored and when they were uploaded so I know whether my defaults are current.

**US-04** — As a SnowRaven user, I want to clear a stored file so that the corresponding tab returns to its manual upload state on my next visit.

**US-05** — As a SnowRaven user, I want to upload a different file in the Breeding Codes or Media List tab without overwriting my stored default, so I can do a one-off comparison without losing my usual setup.

---

## Functional Requirements

### Settings Tab

**FR-01** — The app shall display a "Settings" tab as the rightmost tab in the tab bar, to the right of Life List Comparer.

**FR-02** — The Settings tab shall contain two file management sections: one labelled for the eBird backup and one for the ML export.

**FR-03** — Each section shall display either the stored filename and upload date (when a file is saved) or a "No file saved" state (when none is stored).

**FR-04** — Each section shall include an upload control (drop zone or button) for uploading a file to the server.

**FR-05** — Each section shall include a Clear button that deletes the stored file from the server. The Clear button shall be disabled when no file is stored.

**FR-06** — Uploading a file to a section that already has a stored file shall replace the existing file and update the displayed metadata.

**FR-07** — Uploaded files shall be validated on the server: only `.csv` files are accepted, maximum 50 MB. Violations shall return an appropriate HTTP error code and the UI shall display a clear error message.

### Auto-loading

**FR-08** — On mount, the Breeding Codes component shall call `GET /settings/files/ebird`. If the response is 200, it shall fetch the file content, parse it using existing parser logic, and reach the ready state automatically.

**FR-09** — On mount, the Media List component shall call `GET /settings/files/ml`. If the response is 200, it shall fetch the file content and parse it using existing ML export detection and parser logic.

**FR-10** — When a tab auto-loads from a stored file, it shall display a label showing the stored filename (e.g. "Loaded from saved file: MyEBirdData.csv").

**FR-11** — When a tab is in the auto-loaded ready state, its existing "Load new file" control shall remain functional, returning the tab to the idle/upload state without modifying the file stored on the server.

**FR-12** — A file uploaded directly through a tab's own upload UI shall load for the current session only. It shall not replace or modify the file stored on the server via Settings. Refreshing the page shall restore the stored default.

**FR-13** — If auto-loading fails (network error, parse error), the tab shall fall back silently to the idle/upload state. No error banner is shown for the auto-load failure itself.

### Backend

**FR-14** — The backend shall store uploaded files in a `data/` directory at the project root, using fixed filenames `ebird-backup.csv` and `ml-export.csv`.

**FR-15** — The backend shall maintain a `data/metadata.json` file containing the original filename and ISO 8601 upload timestamp for each stored file. It shall be updated on every upload and cleaned on every delete.

**FR-16** — `GET /settings/files` shall return the metadata for both stored files (or null for each that doesn't exist). The frontend uses this to populate the Settings tab display.

**FR-17** — `POST /settings/files/ebird` and `POST /settings/files/ml` shall accept `multipart/form-data` file uploads, validate them, and write the file plus update `metadata.json`.

**FR-18** — `GET /settings/files/ebird` and `GET /settings/files/ml` shall return the stored file's CSV content as `text/plain; charset=utf-8`. If no file is stored, they shall return 404.

**FR-19** — `DELETE /settings/files/ebird` and `DELETE /settings/files/ml` shall remove the stored file from disk and update `metadata.json`. If no file is stored, they shall return 404.

**FR-20** — The `data/` directory shall be created automatically on first upload if it does not exist.

---

## Non-Functional Requirements

**NFR-01 — Security:** The backend shall validate file content type server-side, rejecting non-CSV uploads with 400. It shall not execute or interpret uploaded content. Filenames from the client are stored in metadata only — the server uses its own fixed filenames on disk.

**NFR-02 — Size:** The backend shall reject files exceeding 50 MB with 413.

**NFR-03 — Performance:** `GET /settings/files/ebird` and `/ml` shall stream file content rather than reading it entirely into memory before responding.

**NFR-04 — Gitignore:** The `data/` directory shall be added to `.gitignore` so stored files are never committed to the repository.

**NFR-05 — Proxy:** The `/settings` path shall be added to the Vite dev proxy config so local development routes correctly to port 1620.

---

## Out of Scope

- Any settings other than eBird backup and ML export file management (theme, preferences, API keys, etc.)
- Server-side CSV parsing — the frontend handles all parsing as it does today
- File syncing across devices or multiple SnowRaven instances
- Authentication or access control on the file endpoints
- Storing any files other than the two CSV types defined here
- Remembering per-session state after a page refresh (other than the stored defaults)

---

## Open Questions

**Q1 — Auto-load timing:** Should auto-loading trigger on component mount (all tabs at startup) or on first tab visibility?
*Default: on mount. All tab components are always mounted per the display-toggle pattern. Auto-load fires immediately on mount via `useEffect`. This is a single lightweight API check per tab.*

**Q2 — Loading indicator:** Should the Breeding Codes and Media List tabs show a loading spinner during the auto-load fetch?
*Default: yes — a brief spinner or "Loading saved file…" placeholder is shown between mount and the ready state to avoid the upload UI flashing before the auto-load completes.*

**Q3 — Settings tab state on load:** Should Settings poll for file status on every visit to the tab, or only on mount?
*Default: on app mount only. The Settings component fetches `GET /settings/files` once on mount. Upload and delete actions update local state directly rather than re-fetching.*

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Settings tab exists | Tab bar shows "Settings" as the rightmost tab |
| QA-02 | Empty state | Both sections show "No file saved" when no files are stored |
| QA-03 | eBird upload | After uploading a CSV on Settings, the eBird section shows the filename and upload date |
| QA-04 | ML upload | After uploading a CSV on Settings, the ML section shows the filename and upload date |
| QA-05 | eBird auto-load | With a stored eBird backup, the Breeding Codes tab enters the ready state automatically on page load |
| QA-06 | ML auto-load | With a stored ML export, the Media List tab enters the ready state automatically on page load |
| QA-07 | Auto-load indicator | An auto-loaded tab displays the stored filename in its toolbar |
| QA-08 | One-off upload is session-only | Uploading via a tab's own upload UI, then refreshing, restores the stored default |
| QA-09 | Clear eBird | Clearing the eBird backup removes the server file; Breeding Codes tab shows the upload state on next load |
| QA-10 | Clear ML | Clearing the ML export removes the server file; Media List tab shows the upload state on next load |
| QA-11 | Non-CSV rejected | Uploading a non-.csv file shows an error and nothing is stored |
| QA-12 | Oversized file rejected | Uploading a file over 50 MB shows an error and nothing is stored |
| QA-13 | Replace stored file | Uploading a new file to an occupied section replaces it; metadata shows the new name and date |
| QA-14 | Clear button disabled state | Clear button is disabled when no file is stored |
| QA-15 | GET /settings/files | Returns correct metadata for stored files and null for absent ones |
| QA-16 | GET /settings/files/ebird | Returns 200 + CSV content when stored; 404 when not |
| QA-17 | DELETE /settings/files/ebird | Returns 200; file no longer present on disk |
| QA-18 | data/ gitignored | `data/` appears in .gitignore |
| QA-19 | Auto-load failure fallback | If fetch fails, the tab shows the upload state with no error banner |
