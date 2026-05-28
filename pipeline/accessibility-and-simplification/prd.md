# PRD — Accessibility
**Feature:** accessibility-and-simplification
**Session:** 001
**Date:** 2026-05-27
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

A best-efforts accessibility pass across the SnowRaven web app that makes it meaningfully usable for people relying on screen readers, keyboard-only navigation, and assistive technology. The work covers ARIA semantics, keyboard operability, live region announcements, color contrast, non-color meaning alternatives, and touch target sizing across all eight tabs.

---

## User Stories

**US-01** — As a screen reader user, I want the tab bar to be announced with proper roles and states, so that I know which tab is active and can navigate between tabs without confusion.

**US-02** — As a keyboard-only user, I want all filter pills, toggle switches, and sort controls to be reachable and operable via Tab and Enter/Space, so that I can use the app's full filtering and sorting capabilities without a mouse.

**US-03** — As a screen reader user, I want dynamic content updates — weather results, loading states, and status messages — to be announced automatically, so that I don't have to manually scan the page to discover what changed.

**US-04** — As a color-blind user, I want breeding code tier information and map recency indicators to be conveyed in text as well as color, so that I can read tier and recency information without relying on color perception.

**US-05** — As a keyboard user, I want overlays and dropdowns to trap focus while open and return focus when closed, so that I never lose my place in the page.

**US-06** — As a user with reduced motor precision, I want all interactive controls to have touch targets large enough to activate reliably, so that I don't frequently miss tap targets on mobile or touchscreen devices.

---

## Functional Requirements

### A — Tab Navigation

**FR-01** — The tab bar shall have `role="tablist"`; each tab button shall have `role="tab"`, `aria-selected="true/false"`, and `aria-controls` pointing to its panel's `id`.

**FR-02** — Each tab panel shall have `role="tabpanel"`, an `id` matching its tab's `aria-controls`, and `aria-labelledby` pointing to its tab button's `id`.

**FR-03** — The tab bar container shall have `aria-label="Main navigation"` or be wrapped in a `<nav>` element with that label.

### B — Landmark Regions

**FR-04** — The active tab panel content shall be wrapped in a `<main>` element (or have `role="main"`) so screen reader users can jump directly to content via landmark navigation.

**FR-05** — The app footer shall have `role="contentinfo"`.

### C — Interactive Controls

**FR-06** — Every icon-only button (copy result, clear input, close overlay, show/hide API key, file clear, sidebar close) shall have an `aria-label` that describes its action.

**FR-07** — All filter pills shall be `<button>` elements with `aria-pressed="true"` when active and `aria-pressed="false"` when inactive.

**FR-08** — All toggle switches (Show subspecies, Show sp./slash, Show non-bird, Unbounded/Normal, Pins/Heatmap) shall have `role="switch"` and `aria-checked="true/false"`.

**FR-09** — Sortable column headers shall have `aria-sort="ascending"` or `aria-sort="descending"` on the currently active sort column; all other sortable headers shall have `aria-sort="none"`.

**FR-10** — The species selector in Species Detail (a custom searchable dropdown) shall implement the ARIA combobox pattern: the text input has `role="combobox"`, `aria-expanded`, `aria-autocomplete="list"`, and `aria-activedescendant` pointing to the focused option; the option list has `role="listbox"`; each option has `role="option"` and `aria-selected`.

**FR-11** — The appearance theme selector (System / Light / Dark) shall use `role="radiogroup"` with each option as `role="radio"` and `aria-checked`.

**FR-12** — The segmented controls (Weekly/Monthly/Yearly, Per Period/Cumulative, A–Z/Taxonomic, My List/Upload, view mode tabs inside Map Explorer) shall use `role="group"` with each option as a `<button>` with `aria-pressed`.

### D — Live Regions

**FR-13** — The weather result container shall have `aria-live="polite"` and `aria-atomic="true"`, so that when a result or error appears it is announced without the user navigating to it.

**FR-14** — Tab panels that auto-load data on mount shall expose an `aria-busy="true"` attribute on their content container while loading, which clears to `aria-busy="false"` when loading completes (success or error).

**FR-15** — The species count label in Media List and Breeding Codes ("8 species" / "3 of 8 species") shall be in an `aria-live="polite"` region so that changes after filter activation are announced.

**FR-16** — The update check footer states (checking, up to date, update available, error) shall be in an `aria-live="polite"` region.

### E — Focus Management

**FR-17** — When any full-screen overlay (HelpDocs) opens, focus shall move to the first focusable element inside the overlay immediately on mount.

**FR-18** — When any overlay closes, focus shall return to the element that triggered it.

**FR-19** — All overlays and the Map Explorer mobile sidebar shall close on Escape key press.

**FR-20** — Focus shall not escape overlays while they are open (focus trap). HelpDocs already implements this — verify it is correct and apply the same pattern to the mobile Map Filters sidebar.

### F — Color Contrast

**FR-21** — All body text in both light and dark themes shall meet WCAG AA contrast (≥4.5:1 against its background for normal-weight text under 18pt, ≥3:1 for large/bold text). Any failing tokens shall be adjusted in `globals.css`.

**FR-22** — Interactive element focus outlines shall be visible and have ≥3:1 contrast against the adjacent background color in both themes. The default browser outline may be used if it meets this threshold; otherwise a custom `:focus-visible` style shall be applied.

**FR-23** — The tier-1 breeding code badge (`#C084FC` background with white text) fails AA contrast. The badge text color shall be changed to a dark color (e.g. `#3B0764`) for tier 1 so that the text meets ≥4.5:1 contrast against the badge background.

### G — Non-Color Alternatives

**FR-24** — Each breeding code tier badge shall include a visually-hidden `<span>` (CSS `sr-only`) announcing the tier category name (e.g. "Possible", "Probable", "Confirmed") so screen reader users receive tier information without relying on color.

**FR-25** — Map recency tier dots in the Media Targets nearest-10 sidebar list shall include a visually-hidden label alongside the dot (e.g. "Recent: ≤7 days") so color-blind users can determine recency from text.

**FR-26** — The warning card shown when API keys are missing shall include a warning icon (already present via amber styling) and the word "Warning:" or equivalent in the card title so the alert is communicated without color alone.

### H — Semantic HTML

**FR-27** — Any interactive element currently implemented as a `<div>` or `<span>` with an `onClick` handler shall be converted to a `<button>` element (or given `role="button"` + `tabindex="0"` + `onKeyDown` handler for Enter/Space) so it is reachable and operable via keyboard.

**FR-28** — All form text inputs (checklist ID input, API key inputs, lat/lng/radius inputs, address search input) shall have an associated `<label>` element — either a visible label or a visually-hidden one — rather than relying on placeholder text alone.

**FR-29** — The Breeding Codes matrix table and Media List table shall use `<table>`, `<thead>`, `<tbody>`, `<th scope="col">` for column headers, and `<th scope="row">` for the species name column. If the current implementation uses `<div>` grid layout, it shall remain as-is with `role="table"`, `role="rowgroup"`, `role="columnheader"`, and `role="row"` attributes applied.

**FR-30** — The heading hierarchy across all tabs shall not skip levels. Each tab panel's primary heading shall be `<h2>` or have `role="heading" aria-level="2"` (or omitted entirely if the tab label serves as the heading); section cards within a tab shall use `<h3>` or equivalent.

### I — Touch Targets

**FR-31** — All interactive controls (buttons, pills, toggle switches, icon buttons, tab buttons) shall have a minimum touch target area of 44×44px, achieved through padding if necessary, without changing the visible size of the element.

---

## Non-Functional Requirements

**NFR-01 — Browser compatibility:** Accessibility improvements shall work across Chromium, Firefox, and Safari — the same browsers SnowRaven already targets. No browser-specific ARIA workarounds are needed unless a specific attribute fails in a targeted browser.

**NFR-02 — Screen reader reference:** Changes shall be tested against VoiceOver on macOS (the natural reference for a Mac-first product). Screen reader behavior in other readers (NVDA, JAWS) is a stretch goal, not a requirement for this pass.

**NFR-03 — No visual regressions:** Accessibility changes shall not alter the visible appearance of any element unless required to meet contrast requirements (FR-21–FR-23). Padding increases for touch targets (FR-31) shall not break existing layouts.

**NFR-04 — No new dependencies:** All changes use native HTML semantics and ARIA attributes. No accessibility libraries (e.g. `react-aria`) shall be added.

---

## Out of Scope

- Full keyboard navigation of Leaflet map interactions (pan, zoom, pin activation via keyboard) — basic `aria-label` on the map container is in scope; keyboard map control is not
- Keyboard-based alternative for drag-to-reorder tab layout — this will be documented as a known limitation in the Settings tab
- WCAG AAA requirements (e.g. contrast ≥7:1)
- Automated accessibility CI (axe-core or similar integration into the test suite)
- WCAG formal audit report or certification
- Accessibility of chart content (Recharts SVGs in Statistics and Species Detail) — charts remain as-is; surrounding text context provides the data

---

## Open Questions

**Q1:** The species selector in Species Detail appears to be a custom implementation. If it is already built on a component (e.g. a `<select>`, or a shadcn/ui Combobox) that provides ARIA natively, FR-10 may already be partially satisfied. **Default assumption:** The Engineer will audit the current implementation and apply FR-10 requirements to whatever pattern is in place, rather than rewriting the component.

**Q2:** The Breeding Codes matrix uses a large sticky-column table. Whether it uses real `<table>` semantics or CSS grid with ARIA roles needs to be confirmed during build. **Default assumption:** The Engineer will apply whichever pattern (real table or ARIA grid) is most consistent with the existing implementation, per FR-29.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Tab bar ARIA roles (FR-01, FR-02) | VoiceOver announces tab count, active tab name, and panel when navigating with Tab and arrow keys |
| QA-02 | Tab bar keyboard navigation (FR-01) | Arrow keys cycle between tab buttons; Enter/Space activates a tab |
| QA-03 | Main landmark (FR-04) | VoiceOver landmark rotor includes "main" and jumps to active tab content |
| QA-04 | Icon-only buttons labeled (FR-06) | VoiceOver announces a meaningful action name (not "button") for copy, clear, close, and show/hide controls |
| QA-05 | Filter pills keyboard operable (FR-07) | Tab reaches every filter pill; Enter/Space toggles its active state; VoiceOver announces pressed state |
| QA-06 | Toggle switches announced (FR-08) | VoiceOver announces "on/off" state change when a toggle is activated via keyboard |
| QA-07 | Sort columns announced (FR-09) | VoiceOver announces "ascending" or "descending" on the active sort column header |
| QA-08 | Species selector combobox (FR-10) | Tab reaches the species input; typing narrows options; arrow keys navigate the list; Enter selects; VoiceOver announces the active option |
| QA-09 | Weather result announced (FR-13) | VoiceOver announces the weather result (or error) when it appears without the user navigating to the result area |
| QA-10 | Loading state announced (FR-14) | VoiceOver announces a loading or ready state when a data tab finishes loading |
| QA-11 | Overlay focus trap (FR-17, FR-18, FR-20) | Opening HelpDocs moves focus inside; Tab cycles within the overlay; Escape closes and returns focus to the trigger |
| QA-12 | Map sidebar Escape (FR-19) | Opening the mobile Map Filters sidebar and pressing Escape closes it |
| QA-13 | Tier-1 badge contrast (FR-23) | Tier-1 breeding code badge text has ≥4.5:1 contrast against the badge background in both themes |
| QA-14 | Breeding tier screen reader label (FR-24) | VoiceOver reads the tier category name ("Confirmed", "Probable", etc.) for a breeding code badge |
| QA-15 | Map recency label (FR-25) | VoiceOver reads a text recency label alongside the tier dot in the nearest-10 list |
| QA-16 | Form inputs labeled (FR-28) | VoiceOver reads a descriptive label (not just placeholder) for checklist ID input, API key inputs, and coordinate inputs |
| QA-17 | Breeding table semantics (FR-29) | VoiceOver reads column header names when navigating cells of the Breeding Codes matrix |
| QA-18 | Touch targets (FR-31) | All buttons, pills, and tab controls have a bounding box of at least 44×44px when measured in browser DevTools |
| QA-19 | Focus indicators visible (FR-22) | Tab-focusing any interactive control shows a visible focus ring in both light and dark mode |
| QA-20 | No visual regressions (NFR-03) | All existing tab layouts, table layouts, and card styles are visually unchanged from before the accessibility pass |
