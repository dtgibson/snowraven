# PRD — Settings-First File Model
**Feature:** settings-primary-files
**Session:** 001
**Date:** 2026-05-22
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Removes per-tab file upload UI from Breeding Codes, Media List, and Species Detail, making Settings the sole source of data for those tabs. Adds a "My List" option to Life List Comparison that uses the stored eBird backup as List A. Adds proactive guidance across all affected tabs when required files or API keys are missing.

---

## User Stories

**US-01** — As a user who has uploaded files to Settings, I want every data tab to load automatically without any additional action, so I never repeat the upload across tabs.

**US-02** — As a new user who hasn't configured Settings yet, I want each tab to tell me exactly which file to upload and where, so I'm not left guessing why the tab isn't working.

**US-03** — As a user whose ML export was renamed before uploading, I want to know upfront that my media links won't be personalised and how to fix it, so I don't discover the problem when clicking a link.

**US-04** — As a user comparing life lists, I want to use my stored eBird backup as "My List" without re-uploading it, so I only need to provide the list I'm comparing against.

**US-05** — As a user setting up SnowRaven for the first time, I want the Weather tab to tell me if my API keys aren't configured before I try a lookup, so I understand why it isn't working.

---

## Functional Requirements

### Breeding Codes Tab

**FR-01** — The Breeding Codes tab shall not display a file upload drop zone in any state.

**FR-02** — When no eBird backup file is stored in Settings, the Breeding Codes tab shall display a setup required state (not the current idle/upload state) with the following content: the file needed (`MyEBirdData.csv`), how to obtain it (export from ebird.org → My eBird → Download My Data), the path in Settings (Settings → Default Files → eBird Backup), and a statement that the tab loads automatically once the file is saved.

**FR-03** — The setup required state shall include a button labelled "Go to Settings" that switches the active tab to the Settings tab.

**FR-04** — The "Load different file" and "Load new file" buttons shall be removed from the Breeding Codes tab in all states.

### Media Life List Tab

**FR-05** — The Media Life List tab shall not display a file upload drop zone in any state.

**FR-06** — When no ML export file is stored in Settings, the Media Life List tab shall display a setup required state with the following content: the file needed (Macaulay Library export), how to obtain it (macaulaylibrary.org → My Media → Save Spreadsheet), the path in Settings (Settings → Default Files → ML Export), and a statement that the tab loads automatically once the file is saved.

**FR-07** — The setup required state shall include a "Go to Settings" button that switches the active tab to the Settings tab.

**FR-08** — When an ML export is stored and loaded successfully but the stored filename does not match the pattern `^ML__.*_([A-Za-z0-9]+)\.csv$`, the tab shall display a proactive notice (in addition to showing the loaded data) explaining that personal media links cannot be generated and instructing the user to re-download the export from Macaulay Library without renaming the file.

**FR-09** — The "Load different file" and "Load new file" buttons shall be removed from the Media Life List tab in all states.

### Species Detail Tab

**FR-10** — The Species Detail tab shall not display a file upload drop zone in any state.

**FR-11** — When no eBird backup file is stored in Settings, the Species Detail tab shall display a setup required state with: the file needed (`MyEBirdData.csv`), the Settings path (Settings → Default Files → eBird Backup), and a "Go to Settings" button.

**FR-12** — The "Load different file" button shall be removed from the Species Detail tab in all states.

### Life List Comparison Tab

**FR-13** — List A shall be labelled "My List" throughout the comparison UI, including the selection area label, the results panel header, and the summary bar.

**FR-14** — List B shall be labelled "Other List" throughout the comparison UI.

**FR-15** — When an eBird backup file is stored in Settings, List A shall display two options: "Use my list" and "Upload a file". "Use my list" shall be selected by default.

**FR-16** — When "Use my list" is selected, activating the comparison shall fetch the stored eBird backup from Settings and parse it using the same logic as an uploaded file.

**FR-17** — When "Upload a file" is selected for List A, the existing DropZone component shall be shown for List A (current behaviour).

**FR-18** — When no eBird backup file is stored in Settings, List A shall display only the DropZone (no "Use my list" option); List A shall still be labelled "My List".

**FR-19** — List B shall always display the DropZone regardless of Settings state. List B shall be labelled "Other List".

**FR-20** — The comparison results view shall use "My List" and "Other List" as the panel headers, replacing the unlabelled or generic labels currently used.

### Weather Tab

**FR-21** — On mount, the Weather tab shall fetch `/settings/keys` to determine whether the eBird and OpenWeather API keys are configured.

**FR-22** — If the eBird API key is not configured, the Weather tab shall display a notice above the checklist input stating which key is missing, naming the Settings path (Settings → API Keys → eBird API Key), and linking to the eBird developer page for obtaining a key.

**FR-23** — If the OpenWeather API key is not configured, the Weather tab shall display a notice naming the Settings path (Settings → API Keys → OpenWeather API Key) and linking to openweathermap.org for obtaining a key, with a note that the "One Call by Call" subscription is required.

**FR-24** — Both API key notices may be shown simultaneously if both keys are missing.

**FR-25** — The checklist ID input and lookup button shall remain visible and usable even when API key notices are shown.

---

## Non-Functional Requirements

**NFR-01 — Consistency:** All setup required states across Breeding Codes, Media List, and Species Detail shall use the same visual component — same icon, same card style, same "Go to Settings" button style — so the pattern is immediately recognisable.

**NFR-02 — Performance:** The Weather tab API key fetch is a single additional `GET /settings/keys` request on mount; the endpoint already exists and is fast. No polling.

**NFR-03 — No regression on Life List Comparison:** The DropZone component and FileData type are unchanged. The "Upload a file" path in List A is identical to the current flow.

---

## Out of Scope

- Changing what Settings stores (still eBird backup + ML export only)
- Changing the Settings tab's file management or API key management UI
- Per-tab API key warnings for Breeding Codes, Media List, or Species Detail (those tabs make no API calls that require keys)
- Auto-saving a user-uploaded file from a tab into Settings
- Removing the ability to load a different file via Settings itself

---

## Open Questions

**Q-01:** If the user selects "Use my list" for List A and then switches to "Upload a file," clears, and switches back — does "Use my list" re-fetch the stored file or retain the previously loaded data?
Default assumption: re-fetches the stored file fresh each time "Use my list" is activated (not retained from a prior load).

**Q-02:** Should the Weather tab API key notices include a direct "Go to Settings" button in addition to the instructional text?
Default assumption: yes — include a "Go to Settings" button, consistent with the setup required states on other tabs.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Breeding Codes — no stored file | Setup required state shown; no drop zone visible |
| QA-02 | Breeding Codes — stored file present | Tab auto-loads; no upload UI visible anywhere |
| QA-03 | Breeding Codes ready state | No "Load different file" / "Load new file" button |
| QA-04 | Media List — no stored ML file | Setup required state shown with Macaulay Library instructions |
| QA-05 | Media List — stored ML, wrong filename | Tab loads data; proactive filename warning shown |
| QA-06 | Media List — stored ML, correct filename | Tab loads data; no warning shown |
| QA-07 | Media List ready state | No "Load different file" / "Load new file" button |
| QA-08 | Species Detail — no stored file | Setup required state shown; no drop zone |
| QA-09 | Species Detail ready state | No "Load different file" button |
| QA-10 | Life List Comparison — stored file available | List A shows "Use my list" selected by default |
| QA-11 | Life List Comparison — "Use my list" activated | Comparison runs using stored file; "My List" panel shown in results |
| QA-12 | Life List Comparison — "Upload a file" for List A | Drop zone shown; comparison runs using uploaded file |
| QA-13 | Life List Comparison — no stored file | List A shows drop zone only; still labelled "My List" |
| QA-14 | Life List Comparison results | Panels labelled "My List" and "Other List" |
| QA-15 | Weather tab — both keys configured | No key notices shown |
| QA-16 | Weather tab — eBird key missing | eBird key notice shown; checklist input still visible |
| QA-17 | Weather tab — OpenWeather key missing | OpenWeather key notice shown; checklist input still visible |
| QA-18 | Weather tab — both keys missing | Both notices shown; checklist input still visible |
| QA-19 | All setup required states | "Go to Settings" button present and switches to Settings tab |
| QA-20 | All setup required states | Visual design is consistent across all three tabs |
