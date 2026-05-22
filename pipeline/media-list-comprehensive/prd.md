# PRD — Media List: Comprehensive Species View

**Feature:** media-list-comprehensive
**Session:** 001
**Date:** 2026-05-21
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

The Media Life List tab is upgraded from an ML-export-only view to a comprehensive life list driven by the eBird backup as the species backbone. Every species from the eBird backup appears in the list; ML catalog counts are overlaid where they exist. Three new toggle controls are added: subspecies merge/show, spuh/slash hide/show, and non-bird hide/show. Graceful degradation preserves existing behavior when only the ML export is available.

---

## User Stories

**US-01** — As a birder, I want to see every species from my eBird backup in the Media List with their ML media counts shown (even if zero), so I can identify which life list species I've never photographed, recorded, or filmed.

**US-02** — As a birder, I want to toggle between treating subspecies as one entry or showing them separately, so I can see my media coverage at whatever resolution makes sense to me.

**US-03** — As a birder, I want to hide spuh and slash entries by default, so my list focuses on identified species and I can opt in to the ambiguous entries when I want.

**US-04** — As a birder who records insects, soundscapes, and other non-bird subjects in Macaulay Library, I want to hide those entries by default so my Media List shows only birds, and I can reveal the non-bird entries when I'm curious about them.

**US-05** — As a birder who hasn't stored an eBird backup in Settings, I want the Media List to work exactly as it does today (ML-only), so the upgrade doesn't break my existing workflow.

---

## Functional Requirements

### Comprehensive Species List

**FR-01** — When both an eBird backup and an ML export are available (either from Settings auto-load or a combination), the displayed species list shall use the eBird backup as the species backbone. Every distinct species in the eBird backup shall appear as a row, with ML catalog counts overlaid where available.

**FR-02** — When only the ML export is available (no eBird backup in Settings), behavior shall be identical to the current implementation. The three new toggles (FR-08, FR-10, FR-12) shall not be visible in this mode.

**FR-03** — Species present in the ML export but not in the eBird backup shall be classified as **non-bird entries** (soundscapes, insects, habitats, etc.). They shall be stored separately and subject to the non-bird toggle (FR-12).

**FR-04** — Auto-load shall attempt to load both stored files in parallel. If only the ML file is stored, ML-only mode applies. If only the eBird file is stored (no ML export), the list shall show all eBird species with zero media counts for all three columns (no ML catalog links).

**FR-05** — The `LifeListEntry` type shall be extended (or a new `ComprehensiveEntry` type created) to include an `isNonBird: boolean` flag used by the filter and sort pipeline.

### Entry Construction

**FR-06** — In **merge-subspecies mode** (default): eBird species names are normalized (subspecies parentheticals stripped). All eBird observations with the same normalized name are treated as one entry. ML catalog IDs from all subspecies variants that normalize to the same name are merged into a single entry's `catalogIds`.

**FR-07** — In **show-subspecies mode**: eBird species names are used as-is (no normalization). ML catalog IDs are matched by exact name. Subspecies that appear in the eBird backup but not the ML export show zero counts.

### Subspecies Toggle

**FR-08** — A `ToggleSwitch` labelled "Show subspecies" shall appear in the controls row, matching the visual style of the equivalent toggle on Species Detail. Default: OFF (merge mode).

**FR-09** — Toggling subspecies merge/show shall rebuild the displayed entry list immediately. The species count label shall update to reflect the new list length.

### Spuh/Slash Toggle

**FR-10** — A `ToggleSwitch` labelled "Show sp./slash" shall appear in the controls row. Default: OFF (hidden). Entries ending in ` sp.` or containing `/` in their common name are classified as spuh/slash.

**FR-11** — When OFF, spuh/slash entries are excluded from the displayed list regardless of other filters. When ON, they appear and respond to all other filters normally.

### Non-Bird Toggle

**FR-12** — A `ToggleSwitch` labelled "Show non-bird" shall appear in the controls row, visible only when an eBird backup is loaded (comprehensive mode). Default: OFF (hidden).

**FR-13** — When ON, non-bird entries appear in the list. In taxonomic sort, non-bird entries shall always be placed after all bird species (sort position: after `Infinity`-ranked eBird species). In A–Z sort, they appear in alphabetical order with all other entries.

**FR-14** — Non-bird entries shall render identically to bird entries in the table (same columns, same count display, same ML media links). No visual badge or indicator distinguishing them is required.

### Filter Interaction

**FR-15** — The existing media filter pills (Has photo / No photo / etc.) shall apply to the comprehensive entry list. Species with zero media satisfy all "No X" filters and fail all "Has X" filters.

**FR-16** — County and date-range filters shall apply to both the eBird observation data (to determine which species appear in the filtered set) and the ML rows (to determine media counts within that filtered set). A species that appears in the eBird backup for a given county/date range shall appear in the filtered list even if it has no ML records.

**FR-17** — When a county or date filter is active in comprehensive mode, the species count label shall show "N of M species" where M is the unfiltered comprehensive count and N is the filtered count.

### Count Label and Reset

**FR-18** — The species count label ("N species" or "N of M species") shall count only the entries currently visible after all active toggles and filters are applied.

**FR-19** — When the user resets ("Load different file" / "Load new file"), all three new toggle states shall reset to their defaults (OFF).

---

## Non-Functional Requirements

**NFR-01 — Performance:** Building the comprehensive entry list shall use Map-based lookups, not nested array scans. A life list of 500 species and 5,000 ML rows must complete synchronously without perceptible lag.

**NFR-02 — Correctness of non-bird detection:** The eBird species set used for non-bird detection shall always be built from normalized names (subspecies parentheticals stripped), regardless of the current mergeSubspecies toggle state.

**NFR-03 — Hooks rules:** All new `useMemo` hooks must be declared before any early return. The white-page-crash pattern must not be re-introduced.

**NFR-04 — Theming:** No hardcoded hex colors. All new elements use `var(--sr-*)` tokens.

---

## Open Questions

**OQ-01 — Shared utilities:** `normalizeSpeciesName` and `isSpuhOrSlash` exist in `SpeciesDetail.tsx`. The Architect shall decide whether to extract them to a shared library or duplicate them in `LifeList.tsx`.

**OQ-02 — County/date filter with comprehensive entries:** The county/date filter currently re-aggregates ML rows only. In comprehensive mode, filtering must also re-derive which eBird species appear in the filtered set. The Architect shall specify how `filteredRows` (ML) and filtered eBird observations interact to produce the filtered comprehensive entry list.

**OQ-03 — eBird-only mode (no ML stored):** FR-04 specifies showing zero counts when only eBird is loaded. ML catalog links should not appear for zero-count entries. The Architect shall confirm the `mediaMap` is empty `{}` in this case.

---

## Success Metrics

| ID | What's Verified | Pass Condition |
|---|---|---|
| QA-01 | Comprehensive list when both files loaded | Every eBird species appears; ML counts correct; zero-count species show `—` |
| QA-02 | ML-only mode unchanged | Without eBird backup in Settings, behavior identical to v0.0.37 |
| QA-03 | Subspecies merge (default) | Subspecies collapsed to parent name; combined catalog IDs |
| QA-04 | Show subspecies | Toggle ON shows each subspecies as its own row |
| QA-05 | Spuh/slash hidden by default | Entries ending ` sp.` or containing `/` absent from default view |
| QA-06 | Spuh/slash shown when toggled | Toggle ON reveals them; filter pills apply normally |
| QA-07 | Non-bird hidden by default | ML-only species absent from default view |
| QA-08 | Non-bird at end in taxonomic sort | Toggle ON: non-bird entries appear after all ranked bird species |
| QA-09 | Non-bird toggle absent in ML-only mode | Toggle not rendered when no eBird backup is loaded |
| QA-10 | County/date filter with comprehensive mode | Filtering by county shows only eBird species seen in that county, with per-county ML counts |
| QA-11 | Filter pills with zero-count species | "No photo" includes zero-count species; "Has photo" excludes them |
| QA-12 | Species count label accuracy | Label correctly reflects post-toggle, post-filter count |
| QA-13 | Reset clears toggles | Reset sets mergeSubspecies, showSpuh, showNonBird to OFF |
| QA-14 | Hooks rule compliance | No white-page crash when auto-load transitions to ready state |
