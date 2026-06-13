# PRD — Checklists Tab
**Feature:** checklists-tab
**Date:** 2026-06-10
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
A new top-level **Checklists** tab with three sections: a searchable box of checklist-level comments, a searchable box of species-level comments across all species, and a filterable, expandable list of every checklist — with pasted weather/tide blocks hidden (and unsearched) by default behind a toggle.

## User Stories

> **US-01** — As a birder who wrote a note on a checklist months ago, I want to search all my checklist comments in one box, so that I can re-find it without remembering the date.

> **US-02** — As a birder who wrote an observation note on *some* species, I want to search every species comment across all species at once, so that I'm not guessing species-by-species on Species Detail.

> **US-03** — As a birder re-finding an outing, I want to filter all my checklists by what they contain (comments, media, breeding codes, protocol, completeness, place, date), so that I can answer questions like "complete checklists with breeding codes but no media."

> **US-04** — As a SnowRaven user who pastes weather/tide blocks into checklist comments, I want those blocks hidden and excluded from search by default, so that my actual notes aren't drowned out — with one toggle to bring them back.

> **US-05** — As a user who found a result, I want every checklist to link out to eBird and every species name to open Species Detail, so that finding something leads somewhere.

## Functional Requirements

### The tab

> **FR-01** — The app shall provide a new top-level "Checklists" tab, present in the tab bar, the responsive tab dropdown, and the tab-order settings.

> **FR-02** — Users with a previously saved tab layout shall see the new tab appended visibly to their layout — never hidden.

> **FR-03** — The tab shall load from the app's existing parsed-once data caches and shall show the standard setup-required state (with steps and a Settings link) when no eBird backup is configured. The ML export shall be optional (see FR-22).

### Weather/tide toggle

> **FR-04** — The tab shall have a single toggle controlling weather/tide block visibility, applying to all three sections. Default: blocks hidden.

> **FR-05** — While hidden, weather and tide blocks shall be removed from every comment rendered on this tab (both search boxes and the checklist list).

> **FR-06** — While hidden, text search in both comment boxes shall match against the stripped text only — block content shall not produce matches ("search matches what you see").

> **FR-07** — A comment that is empty after stripping shall be treated as absent while blocks are hidden: it shall not appear in the comment boxes, and the has/no-comment filters shall treat that checklist/observation as having no comment.

> **FR-08** — Turning the toggle on shall immediately restore blocks to display and search. The "has weather block" / "has tide block" *filters* (FR-20) shall work identically regardless of the toggle.

### Section 1 — Checklist comment search

> **FR-09** — The box shall list checklist-level comments, exactly one entry per checklist, sorted newest-first by default with a Newest/Oldest toggle.

> **FR-10** — It shall show 10 entries initially with a "Show all N comments" expander.

> **FR-11** — It shall offer case-insensitive substring search with a live match count and distinct empty states for "no comments at all" vs "none match this filter."

> **FR-12** — Each entry shall show the date (linked to the eBird checklist when the ID is valid) and location, then the comment text with line breaks preserved and embedded http(s) URLs rendered as safe clickable links.

### Section 2 — Species comment search

> **FR-13** — The box shall list species-level comments across all species, one entry per commented observation, same sort/expand/search/count/empty-state behavior as FR-09–11.

> **FR-14** — Each entry shall additionally show the species, rendered through the app's standard bird-name component (name opens Species Detail, with favicons), alongside the date link and location.

### Section 3 — All-checklists list

> **FR-15** — The list shall include every checklist, showing 10 initially with a "Show all N checklists" expander, sorted newest-first by default with a Newest/Oldest toggle.

> **FR-16** — Each row shall show: date (eBird-linked when valid), time when present, location, county/state, protocol display name, effort fields when present (duration, distance, observers), species count, and individual count.

> **FR-17** — A row whose checklist has a comment shall display it in the app's quoted-comment style, subject to FR-05/FR-07.

> **FR-18** — Each row shall carry at-a-glance indicators for: has species comments, has media (with per-type detail when the ML export is loaded), and has breeding codes.

> **FR-19** — All filters shall compose with AND semantics.

> **FR-20** — The list shall offer: tri-state (has / doesn't have / off) filters for **checklist comments**, **species comments**, **media (any)**, **breeding codes**, **weather block**, **tide block**; a **complete/incomplete** tri-state; **photo/audio/video** tri-state filters (ML export loaded only); a **protocol** filter (display names, options derived from the data); a **county** dropdown (options from the data); and a **from/to date range**.

> **FR-21** — The list shall show the house count label ("N checklists" / "M of N checklists", live-announced), an "All" reset for the pill filters, and the accent filter strip with a Clear control when county/date filters are active.

> **FR-22** — Without an ML export, the photo/audio/video filters and per-type indicators shall be hidden; "has media" shall still work from the backup's ML catalog numbers.

### Cross-cutting

> **FR-23** — A submission/location ID that fails shape validation shall render as plain text, never as a link. External links open in a new tab, as elsewhere.

## Non-Functional Requirements

> **NFR-01 — Performance:** The tab shall open with no re-parse of either CSV (shared caches only) and shall remain responsive — including per-keystroke search and the fully expanded list — with several thousand checklists.

> **NFR-02 — Accessibility:** All controls keyboard-operable (explicit tabIndex on buttons, per the WKWebView convention), the toggle exposed as a switch, count labels politely live-announced, and visible focus states.

> **NFR-03 — Security:** Checklist links gated on the `/^S\d+$/` shape check; comment text rendered as escaped JSX segments with only validated http(s) links; no `dangerouslySetInnerHTML`.

> **NFR-04 — Privacy:** No new network calls or providers. Only the existing batched taxonomy-code resolution used by every tab that renders bird names.

> **NFR-05 — Theming & consistency:** All colors via `var(--sr-*)` tokens (light + dark); dates per the user's date-format preference; comment boxes visually match the existing comment-search format.

## Out of Scope
- Checklist statistics or aggregates (Statistics tab owns those).
- An in-app per-checklist detail view — rows link out to eBird.
- Filter-state persistence across relaunch (house style: filters are session-local; only the tab layout persists).
- A free-text search over the checklist *list* (county + date + filters cover it; the comment boxes own text search).
- Editing or uploading anything to eBird; any new network providers.

## Open Questions
1. **Default tab position** for new installs (existing users get it appended to their saved layout regardless). *Default: after Named Birds, before List Comparer.*
2. **Tab label.** *Default: "Checklists."*

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Tab registration (FR-01, FR-02) | Tab appears in bar, dropdown, and tab-order settings; a saved pre-existing layout shows it appended and visible |
| QA-02 | Setup gate (FR-03) | With no eBird file: setup-required state with Settings link; with file: tab renders with no CSV re-parse |
| QA-03 | Toggle default (FR-04) | Fresh visit: blocks hidden in all three sections |
| QA-04 | Block stripping (FR-05) | A comment containing a weather and/or tide block renders only its non-block text everywhere on the tab |
| QA-05 | Search coupling (FR-06) | Hidden: searching a block-only term (e.g. "Humidity") yields 0 matches; shown: same search yields matches |
| QA-06 | Empty-after-strip (FR-07) | A weather-block-only comment: absent from boxes and "has comment" filters while hidden; present when shown |
| QA-07 | Checklist comment box (FR-09–12) | One entry per checklist; 10 shown, expander reveals all; substring search filters with live count; valid IDs link to ebird.org/checklist, invalid render plain |
| QA-08 | Species comment box (FR-13–14) | Entries across multiple species; species name opens Species Detail; same search/expand behavior |
| QA-09 | List basics (FR-15–17) | 10 rows, expander shows all; rows show date/location/protocol/effort/counts; comments render in quoted style |
| QA-10 | Filter composition (FR-19–20) | "Has breeding codes" + "no media" + "complete" shows exactly the matching checklists (verified against fixture data) |
| QA-11 | ML degradation (FR-22) | Without ML export: no photo/audio/video pills, "has media" still filters correctly |
| QA-12 | Count/strip/reset (FR-21) | Count label switches to "M of N checklists" when filtered; All resets pills; Clear resets county/date |
| QA-13 | Accessibility (NFR-02) | Every control reachable and operable by keyboard in WKWebView conventions; toggle announces as switch |
| QA-14 | Security (NFR-03, FR-23) | Junk submission ID in fixture renders unlinked; URL in comment becomes a link only for http(s) |
| QA-15 | Performance (NFR-01) | With a several-thousand-checklist fixture: expand-all and per-keystroke filtering stay responsive |
