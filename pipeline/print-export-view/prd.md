# PRD — Print / Export View
**Feature:** print-export-view
**Session:** 001
**Date:** 2026-05-13
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

### Feature Overview

Adds a Print button and CSS `@media print` styles to the Media Life List and Life List Comparer tabs, producing a clean single-column document when the user prints or saves as PDF. The Weather tab is unchanged.

---

### User Stories

**US-01** — As a birder, I want a Print button on my life list, so I know printing is supported and can trigger it without discovering Cmd+P.

**US-02** — As a birder, I want a Print button on my list comparison, so I can produce a clean document to share or save.

**US-03** — As a birder, I want all species and entries to print automatically without having to expand the list first, so I get the complete content without extra steps.

**US-04** — As a birder, I want navigation, input controls, and filter chrome to disappear when I print, so the printed page contains only the content I care about.

---

### Functional Requirements

**Print Button**

**FR-01** — The Media Life List tab shall display a "Print" button in the controls row when a file has been loaded and results are displayed. The button shall not appear in the upload/idle or error states.

**FR-02** — The Life List Comparer tab shall display a "Print" button in the results area when a comparison has been produced. The button shall not appear before files are loaded.

**FR-03** — Clicking the Print button shall call `window.print()`.

**Auto-Expand on Print**

**FR-04** — When printing is triggered (via the Print button or Cmd+P), the Media Life List species table shall render all rows, regardless of whether the list is currently in its scrollable (non-expanded) state.

**FR-05** — When printing is triggered, all three comparison panels in the Life List Comparer (shared species, A only, B only) shall render all rows, regardless of their current scroll state.

**Hidden Elements on Print**

**FR-06** — The site header and tab bar shall be hidden from printed output.

**FR-07** — The following UI elements shall be hidden from printed output: drop zones, file input controls, filter pills, sort controls, batch progress indicator, "Load new file" button, "Compare new files" button.

**FR-08** — The "Show all / Collapse" toggle button shall be hidden from printed output.

**FR-09** — The Print button itself shall be hidden from printed output.

**Print Layout**

**FR-10** — The printed content shall be single-column with no sidebar or split-pane layout.

**FR-11** — The Media Life List species table shall print with its column headers (Seen, Photo, Audio, Video) visible and row spacing readable at standard paper sizes.

**FR-12** — The Life List Comparer shall print with a visible heading for each of the three panels (shared species count, A-only species count, B-only species count) above their respective entry lists.

**FR-13** — The Weather tab shall be unaffected by any print style changes — it shall continue to print exactly as it does today.

---

### Non-Functional Requirements

**NFR-01 — Compatibility:** Print styles shall produce correct output in Safari, Chrome, and Firefox on macOS.

**NFR-02 — No backend changes:** This feature is entirely frontend — no new routes, endpoints, or server-side logic.

**NFR-03 — No print-dialog delay:** Any state changes required for full-list rendering (auto-expand) shall complete before `window.print()` is called, so the print dialog opens with the full content already rendered.

---

### Out of Scope

- Print support for the Weather tab
- PDF generation via Puppeteer, wkhtmltopdf, or any server-side renderer
- Export to CSV, XLSX, or any non-print format
- Custom page margins, headers, or footers
- Page numbers
- Print-specific branding or logos

---

### Open Questions

None — all decisions are resolved in this document.

---

### Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Print button on Media Life List | Button is visible in the controls row after a file is loaded |
| QA-02 | Print button on Life List Comparer | Button is visible in the results area after a comparison is produced |
| QA-03 | Print button absent in upload state | No Print button visible on either tab before content is loaded |
| QA-04 | Print button hidden in output | Print button does not appear in the printed document |
| QA-05 | Header and tab bar hidden | Site header and tab bar do not appear in the printed document |
| QA-06 | Input chrome hidden | Filter pills, sort controls, drop zones, toggle, and reset buttons do not appear in the printed document |
| QA-07 | Full list prints — Media Life List | All species rows appear in the printed document even when the list was in scroll mode |
| QA-08 | Full list prints — Life List Comparer | All rows in all three panels appear in the printed document even when panels were in scroll mode |
| QA-09 | Weather tab unaffected | Weather tab appearance and print behavior are unchanged |
