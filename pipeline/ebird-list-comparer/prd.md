# PRD — eBird List Comparer
**Feature:** ebird-list-comparer
**Session:** 001
**Date:** 2026-05-07
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A second tool integrated into SnowRaven that accepts two eBird backup CSV files and produces three sorted species lists: birds seen in both, birds seen only in the first file, and birds seen only in the second. All logic runs client-side with no API calls. A tab bar allows the user to switch between the existing Weather tool and this new List Comparer tool.

---

## User Stories

**US-01** — As a birder, I want to switch between the Weather tool and the List Comparer from the same page, so I don't have to manage two separate apps.

**US-02** — As a birder, I want to upload two eBird backup CSV files by drag-and-drop or file picker, so I can compare my species list against someone else's.

**US-03** — As a birder, I want to see a summary of how many species I share with another list and how many are unique to each, so I can quickly understand the overlap.

**US-04** — As a birder, I want to see which specific species are unique to each list in a scrollable panel, so I can browse the differences at my own pace.

**US-05** — As a birder, I want to reset and load a new pair of files without refreshing the page, so my workflow stays fluid.

**US-06** — As a birder, I want a clear error message if I upload a file that isn't a valid eBird backup, so I know what's wrong and what to fix.

---

## Functional Requirements

### Navigation

**FR-01** — The app shall display a persistent tab bar with two tabs: "Weather" and "List Comparer." The tab bar shall appear at the top of the page, above both tools.

**FR-02** — Clicking a tab shall switch the active tool without a page reload and without resetting the state of the inactive tool.

**FR-03** — The active tab shall be visually distinguished from the inactive tab.

**FR-04** — The app shall default to the Weather tab on initial load.

### File Input

**FR-05** — The list comparer shall display two drop zones side by side, labeled "File A" and "File B."

**FR-06** — Each drop zone shall accept files via drag-and-drop.

**FR-07** — Each drop zone shall accept files via a click-to-open file picker. Clicking anywhere on the drop zone shall open the picker.

**FR-08** — Each drop zone shall accept only `.csv` files. Dropping or selecting a file with any other extension shall display an inline error: "Please upload a CSV file. eBird backups are downloaded as .csv."

**FR-09** — Once a valid file is loaded, the drop zone shall display the filename and a visual confirmation that the file is ready.

### CSV Parsing

**FR-10** — The app shall parse the uploaded CSV using the "Common Name" column. If no such column exists, the file shall be rejected with the error: "This doesn't look like an eBird backup. Make sure you're using the 'Download My Data' export from eBird."

**FR-11** — Spuh entries (names ending in " sp."), slash species (names containing "/"), and hybrid entries (names containing " x ") shall be excluded from the species set.

**FR-12** — Subspecies parentheticals shall be stripped from species names before comparison. "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)" shall both normalize to "Yellow-rumped Warbler."

### Comparison

**FR-13** — The "Compare Lists" button shall be disabled until both File A and File B are successfully parsed.

**FR-14** — On click, the app shall compute three sets: species present in both files, species present only in File A, species present only in File B.

**FR-15** — All three result sets shall be sorted alphabetically.

### Results Display

**FR-16** — The results view shall display a summary bar with five statistics: total species in File A, total species in File B, count in both, count unique to File A, count unique to File B.

**FR-17** — The results view shall display three scrollable panels labeled "In Both," "[File A filename] only," and "[File B filename] only." Panel labels shall use the actual filename, not a generic label.

**FR-18** — Each panel shall display the species count in its header.

### Reset

**FR-19** — The results view shall include a "Compare new files" button that returns to the upload state and clears all loaded file data and results.

---

## Non-Functional Requirements

**NFR-01 — Performance:** All CSV parsing and comparison logic shall execute client-side. No network requests shall be made during or after file upload.

**NFR-02 — Visual Consistency:** All components shall use SnowRaven's existing design tokens: primary green `#2D8653`, foreground `#0F1117`, background `#F9FAFB`, border `#E4E4E7`. The list comparer shall not look like a separate app embedded in the page.

**NFR-03 — Accessibility:** Drop zones shall be keyboard-focusable and include ARIA labels. The file picker shall be triggerable via keyboard.

**NFR-04 — File Size:** The app shall handle eBird backup files of typical size (up to ~10MB, ~10,000 rows) without noticeable lag.

---

## Out of Scope

- Exporting or saving comparison results
- Comparing more than two lists at once
- Modifying the comparison or parsing algorithm
- Any backend or API changes
- Alphabetical sorting alternatives (e.g. taxonomic order)
- Persistent tab preference across page reloads

---

## Open Questions

**Q1 — Tab state on reload:** Should switching tabs preserve the state of the other tool (e.g., a loaded weather result)?
Default assumption: Yes — React state is not reset on tab switch, only on full page reload.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Tab navigation renders | Both "Weather" and "List Comparer" tabs appear; clicking each switches the visible tool |
| QA-02 | Tab state preservation | Loading a weather result, switching to List Comparer, and switching back shows the result still rendered |
| QA-03 | Valid CSV accepted | Uploading a real eBird backup CSV loads successfully and shows filename in the drop zone |
| QA-04 | Non-CSV rejected | Uploading a .txt or .json file shows the inline error message |
| QA-05 | Invalid CSV rejected | Uploading a valid CSV without a "Common Name" column shows the eBird-specific error message |
| QA-06 | Compare button disabled | Button is disabled (visually and functionally) until both files are loaded |
| QA-07 | Spuh/slash/hybrid exclusion | A CSV with "Empidonax sp.", "Greater/Lesser Scaup", and "Mallard x Gadwall" entries produces a species set that excludes all three |
| QA-08 | Subspecies normalization | "Yellow-rumped Warbler (Myrtle)" and "Yellow-rumped Warbler (Audubon's)" are treated as the same species |
| QA-09 | Results: three panels | After comparing, three panels appear with correct titles using actual filenames |
| QA-10 | Results: summary bar | Summary bar shows correct counts for all five statistics |
| QA-11 | Results: alphabetical sort | Species in each panel are in A–Z order |
| QA-12 | Results: scrollable panels | Each panel scrolls independently when the list is long enough to overflow |
| QA-13 | Reset | Clicking "Compare new files" returns to the upload state with both drop zones cleared |
| QA-14 | No network requests | Browser network tab shows zero requests during file upload, parsing, and comparison |
