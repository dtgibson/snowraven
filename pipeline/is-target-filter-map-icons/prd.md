# PRD — Is Target Filter and Map Icons

**Feature:** is-target-filter-map-icons
**Session:** 001
**Date:** 2026-05-23
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Expands the "Is Target" concept from zero-ML-coverage to any missing media type (Photo, Audio, or Video), surfaces it as a filter pill in the Media List tab, adds per-species missing-type icons on Map Explorer target pins, and connects the two tabs via a cross-tab navigation link on the target species count.

---

## User Stories

**US-01** — As a birder reviewing my Media List, I want to filter to only species missing at least one media type, so that I can see my full target list without having to combine "No photo," "No audio," and "No video" pills manually.

**US-02** — As a birder in Map Explorer's Media Targets mode, I want to see which specific media types each target species needs, so that I know whether to focus on photography, audio recording, or video.

**US-03** — As a birder looking at the target count in the Map Explorer sidebar, I want to click it and land directly in the Media List with "Is Target" already applied, so that I can review the full target list without re-filtering manually.

**US-04** — As a birder with partial ML coverage, I want species I've photographed but haven't audio-recorded to appear as media targets, so that the app helps me close all coverage gaps, not just the zero-entry ones.

---

## Functional Requirements

### A. Media List — "Is Target" Filter Pill

**FR-01** — The Media List filter bar shall include an "Is Target" pill positioned immediately after "Has media" and before the existing separator.

**FR-02** — "Is Target" shall be active when at least one of the species' Photo, Audio, or Video counts is zero. A species with all three counts greater than zero is never "Is Target." A species with all three counts equal to zero (eBird backbone only) is always "Is Target."

**FR-03** — When "Is Target" is active and no other filter is active, the table shall show only rows where `photoCount === 0 || audioCount === 0 || videoCount === 0`.

**FR-04** — "Is Target" shall be independent of all other filter pills. It can be combined with "Has media" (showing partial-coverage species only), "No photo," "No audio," "No video," and the positive pills. When combined, both filters apply (AND logic).

**FR-05** — Clicking "All" shall deactivate "Is Target" along with all other filters.

**FR-06** — The species count label ("N of M species") shall update to reflect the "Is Target" filter the same as all other filters — `filteredCount` uses the existing post-filter count; the denominator reflects pre-media-filter `displayEntries.length`.

**FR-07** — "Is Target" shall be available in both ML-only mode and Comprehensive mode. In Comprehensive mode, eBird-backbone-only species (zero ML entries, all counts 0) satisfy the "Is Target" condition. In ML-only mode, only species present in the ML export appear, so only partial-coverage entries qualify.

**FR-08** — "Is Target" shall be activatable from the Map Explorer via a navigation callback (see FR-15). When activated from outside the component, the pill state is set on mount via a prop.

### B. Map Explorer — Expanded Targeting Model

**FR-09** — The `targetSpecies` useMemo shall be redefined: a species is a target if it is present in the eBird backbone AND is missing at least one of Photo, Audio, or Video. This replaces the current definition of "not in `mlSpecies` at all."

Specifically:
- Species not in `mlRows` at all → target (missing all three)
- Species in `mlRows` but `mediaTypes.get(name)` does not contain all three types → target
- Species in `mlRows` with `mediaTypes.get(name)` containing Photo, Audio, AND Video → not a target

**FR-10** — The sidebar label below the target count shall update from "from ML export · no media recorded" to "from ML export · missing ≥1 media type."

**FR-11** — Each `TargetPin` displayed on the map shall carry the missing media types for that species. Missing types are computed client-side by inspecting `mediaTypes.get(pin.comName)` when building `displayedTargetPins`. The `TargetPin` interface gains `missingTypes: ('Photo' | 'Audio' | 'Video')[]`.

**FR-12** — The `TargetMarkers` component shall render missing-type icons inside each pin label. Icons appear to the right of the species name, on the same line. Each icon is a small SVG (10px) indicating camera (Photo), microphone (Audio), or video camera (Video). Only icons for MISSING types are shown. If all three are missing (zero ML entries), all three icons appear.

**FR-13** — When `missingTypes` is empty (species has all three types — safety guard only), no icons are rendered.

**FR-14** — Icon rendering shall use inline SVG strings embedded in the Leaflet `divIcon` HTML string. Icons use `stroke="currentColor"` so they inherit the pin label's text color. Icons are separated from the species name by a 5px gap and from each other by a 3px gap.

### C. Cross-Tab Navigation

**FR-15** — The "N target species" text in the Map Explorer sidebar (when `targetSpecies.length > 0`) shall be rendered as a clickable element that invokes a navigation callback passed as a prop: `onNavigateToMediaList: () => void`. Clicking it navigates to the Media List tab with "Is Target" pre-applied.

**FR-16** — `App.tsx` shall maintain a `mediaListFilter` state (type: `'is-target' | null`). When `onNavigateToMediaList` fires, App sets `activeTab` to `'life-list'` and sets `mediaListFilter` to `'is-target'`.

**FR-17** — `LifeList` shall accept a `requestedFilter?: 'is-target'` prop. On mount (or when the prop changes from null to `'is-target'`), the component activates the "Is Target" pill state. After applying, the filter is treated as internal state — re-navigating away and back does not re-apply it.

**FR-18** — After App.tsx delivers the filter to LifeList, it resets `mediaListFilter` to `null` so subsequent normal navigations to the Media List tab do not re-apply the filter.

---

## Non-Functional Requirements

**NFR-01 — Performance:** `targetSpecies` expansion (partial-coverage species added) may increase the target list size significantly. The useMemo must remain O(n) in `phase.observations` and `phase.mlRows`. No change to the API call or backend.

**NFR-02 — XSS safety:** SVG strings embedded in Leaflet `divIcon` HTML must not include any user-controlled data. Species names (used in the label text) must continue to pass through `escHtml()`. Icon SVG strings are hardcoded and contain no dynamic content.

**NFR-03 — Color token compliance:** All colors in icon rendering (fill, stroke) must use `var(--sr-*)` CSS custom properties or `currentColor`. No hardcoded hex in component files.

**NFR-04 — No routing library:** Cross-tab navigation is implemented via prop callbacks and state in App.tsx. No new dependency is introduced.

---

## Out of Scope

- Backend changes of any kind — all targeting and filter logic is client-side
- Filtering map target pins by specific missing media type (the map always shows all target species, not filtered by which type is missing)
- Sorting the Media List by "Is Target" status
- Audio or video playback in the app
- Changes to My Sightings or Hotspots map modes
- Storing "Is Target" filter state in localStorage or URL params
- Any changes to the Breeding Codes, Species Detail, or List Comparer tabs

---

## Open Questions

1. **Pin label width on mobile.** Adding icons to an already-constrained Leaflet divIcon label may produce labels that are too wide on mobile viewports. Default assumption: accept label widths up to ~180px; the `white-space: nowrap` on the existing label style will keep everything on one line, and the map is scrollable.

2. **"Is Target" pill visibility in ML-only mode.** In ML-only mode, every entry has at least one ML row, so "Is Target" only surfaces partial-coverage species. If the ML export only contains complete-coverage species, "Is Target" would show zero rows. This is correct behavior — no special empty-state handling needed beyond what the existing filter system already does (zero-row table with "0 of N species").

3. **`requestedFilter` prop timing.** App.tsx sets `activeTab` and `mediaListFilter` in the same render. LifeList's `useEffect` that watches `requestedFilter` must fire after the tab switch — since LifeList uses display toggling (not unmounting), it is always mounted, so the effect fires immediately on prop change. Default assumption: this works correctly with React's synchronous state batching in the same event handler.

None — all decisions are resolved above if defaults are accepted.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | "Is Target" pill position | Pill appears immediately after "Has media," before the first separator, in the Media List filter bar |
| QA-02 | "Is Target" filters correctly — zero ML | In Comprehensive mode, a species present in the eBird backbone with no ML entries appears when "Is Target" is active |
| QA-03 | "Is Target" filters correctly — partial coverage | A species with Photos but no Audio or Video appears when "Is Target" is active |
| QA-04 | "Is Target" excludes full coverage | A species with Photo + Audio + Video counts all > 0 does NOT appear when "Is Target" is active |
| QA-05 | "All" resets "Is Target" | Clicking "All" while "Is Target" is active deactivates it and restores the full unfiltered list |
| QA-06 | "Is Target" + "Has media" combination | When both pills are active, only partial-coverage species (has some media, missing at least one type) are shown; zero-ML species are excluded |
| QA-07 | `targetSpecies` expansion | A species present in the eBird backup that has Photos but no Audio appears in the Map Explorer target list after the change |
| QA-08 | Pin icons — partial coverage | A target pin for a species with Photos only shows Audio and Video missing-type icons; the camera icon does NOT appear |
| QA-09 | Pin icons — zero coverage | A target pin for a species with no ML entries shows all three missing-type icons |
| QA-10 | Pin icons — XSS | A species name containing `<script>` characters does not execute any JS when rendered in the map |
| QA-11 | Cross-tab navigation | Clicking "N target species" in the Map Explorer sidebar switches the active tab to Media List with "Is Target" pill already active |
| QA-12 | Filter not re-applied on return | After navigating to Media List via the link, switching to another tab and back does NOT re-apply "Is Target" |
| QA-13 | Sidebar label updated | The sub-label beneath the target count reads "from ML export · missing ≥1 media type" (not "no media recorded") |
