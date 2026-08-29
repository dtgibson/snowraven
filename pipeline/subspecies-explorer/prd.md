# PRD - Subspecies Explorer

**Feature:** subspecies-explorer
**Date:** 2026-08-29
**Stage:** 2 - The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

A Subspecies Explorer on the Species Detail page: a control below the species selector opens a list of every species in the loaded eBird backup that carries at least one countable subspecies or form entry, and a new breakdown section on the selected species shows how the user's reports divide between each reported form and plain species-level reports, as counts and percentages that sum to 100%. Everything is computed offline from the already-loaded backup, with no network calls and no API key.

## User Stories

> **US-01** - As a birder who records subspecies, I want a list of every species in my data that carries subspecies or form detail, so that I can see the full extent of that effort in one place.

> **US-02** - As a birder browsing that list, I want picking a species to select it on Species Detail, so that I can move from the overview to the full record without retyping the name.

> **US-03** - As a birder viewing one species, I want each reported form's count and share of my reports alongside a row for reports with no form noted, so that I know how often I record the form versus the plain species.

> **US-04** - As a birder whose selected species has no form-level records, I want a plain statement of that fact, so that an empty section reads as a truth about my data rather than as an error.

> **US-05** - As a birder using the county or date filter, I want the breakdown to follow the same filter as the rest of the page, so that its numbers agree with the sections around it.

> **US-06** - As a birder offline in the field, I want the whole explorer to work with no network and no API key, so that it is available anywhere my data is.

## Functional Requirements

### Classification and qualification

> **FR-01** - The app shall classify an observation row as a subspecies/form entry when its reported name folds to a different parent species name and the name is countable under the app's shared countability rule (eBird's rule, via the existing shared predicate). ISSF subspecies groups, intraspecific intergrades, and domestic types qualify; hybrids, spuhs, slashes, and undescribed forms never qualify.

> **FR-02** - Non-countable rows shall never appear as breakdown rows and shall never count toward the species total used as the percentage denominator, regardless of any toggle state. This includes a non-countable name whose trailing parenthetical folds to the selected species (for example an undescribed form of that species).

> **FR-03** - A species shall qualify for the explorer list when the full loaded backup holds at least one subspecies/form entry that folds to it, independent of any active county or date filter. A species with zero such entries shall be omitted from the list.

### Explorer list

> **FR-04** - The app shall show a clearly labeled control directly below the species selector on Species Detail, visible only when the page is in its ready state with data loaded and the "Show subspecies" toggle is off (merged mode). The control's label and the list's descriptive copy shall describe the included set as "subspecies and forms", never as "subspecies" alone, so the broader countable set (including intergrades and domestic types) is named honestly.

> **FR-05** - Opening the control shall reveal a list of every qualifying species. Each list entry shall show the species name and, for each qualifying form reported for that species, the form's name and its percentage share of that species' reports. Species shall be ordered as the species selector orders them (taxonomic once taxonomy order is available, alphabetical otherwise); forms within an entry shall be ordered by share descending, ties broken alphabetically.

> **FR-06** - Choosing a species from the list shall select it exactly as choosing the same species in the species selector would (every section of the page updates to that species), close the list, and bring the breakdown section into view. The control shall remain available to reopen the list, which is collapsed by default on every visit; its open state is not persisted.

> **FR-07** - When no species in the loaded data qualifies, the control shall remain visible, and opening it shall show an honest empty message stating that the loaded data contains no subspecies or form entries.

> **FR-08** - The list's membership and its percentages shall always be computed from the full loaded backup: the active county/date filter and the "Show all forms" toggle shall have no effect on the list. Under an active filter the list's percentages and the filtered breakdown's percentages may legitimately differ; the list reflects the whole data set.

### Breakdown section

> **FR-09** - For a selected species in merged mode, the app shall render a titled breakdown section showing one row per countable form reported for that species, each with its report count and its percentage of the species' total reports. The percentage basis is observation rows in the backup: one CSV row is one report. A checklist carrying both a species-level row and a form-level row for the same species contributes each row once. Neither individual bird counts nor checklist counts are the basis.

> **FR-10** - Reports made at plain species level shall render as one explicit row labeled to mean "no form noted", with its count and percentage, pinned as the last row. This row shall appear only when the current view contains at least one species-level report; when every report carries a form, the row is omitted and the form rows alone sum to 100%.

> **FR-11** - The section shall display the species' total report count for the current view, defined as qualifying form-level rows plus plain species-level rows. The counts of all displayed rows shall sum exactly to this total.

> **FR-12** - Percentages shall be displayed to one decimal place, computed from exact counts, with the displayed values summing to exactly 100.0% (any rounding residue is absorbed by the largest row). A row with at least one report shall never display 0.0%; it shall display at least 0.1%. A section with a single row displays 100%.

> **FR-13** - In default merged mode and under the same filter state, the breakdown's total shall equal the number of observation rows the page's existing merged view aggregates for the same species (the Sightings section's Checklists figure). If a disagreement is found that traces to non-countable variant rows inside the existing merged aggregate, the build shall surface that conflict at its next gate rather than silently changing either number; FR-02's countable-only definition governs the breakdown itself.

> **FR-14** - The breakdown shall apply the page's active county and date filters exactly as the other Species Detail sections do, recomputing counts and percentages from the filtered rows. A filter state leaving only species-level rows shall show the single "no form noted" row at 100%. A filter state leaving zero rows for the species shall show an honest zero state consistent with how the page's other sections read when filtered to nothing.

> **FR-15** - Selecting a species with no subspecies/form entries anywhere in the loaded data shall render the breakdown section as a single-line honest empty state saying that no subspecies or form detail is recorded for this species. The section shall never be silently absent for a selected species in merged mode.

> **FR-16** - A species whose reports are all form-level (zero plain species-level rows) shall show its form rows only, summing to 100%, with no "no form noted" row. Such a species still qualifies for the list and still selects normally even if its plain species name never appears as an exact row in the backup.

> **FR-17** - Every species and form name in the list and the breakdown shall render as the full reported name (for example "Dark-eyed Junco (Oregon)") through the app's standard bird-name rendering, following the app-wide convention including its existing exception for names that function purely as form controls.

> **FR-18** - The breakdown shall render as its own titled section within the selected species' detail view, positioned immediately after the Sightings section by default. The design stage may adjust its position within the merged-mode view; it shall never interleave with or alter an existing section.

### Modes and regression safety

> **FR-19** - When the "Show subspecies" toggle is on (exact-name mode), neither the explorer control nor the breakdown section shall render; the exact-name view already lists forms individually. Turning the toggle back off shall restore both without loss of function.

> **FR-20** - Switching the "Show all forms" toggle in either direction shall produce no change in the explorer list or the breakdown content.

> **FR-21** - The feature shall change nothing else: both existing toggles, life-list counts, every other Species Detail section, and every other tab shall behave exactly as before. With the explorer never opened, the page shall be functionally identical to the prior release apart from the presence of the new control and section.

### Data lifecycle

> **FR-22** - When the loaded backup changes (a new upload or a changed stored file), the list and breakdown shall recompute entirely from the new data; no derived value from the prior load shall survive. A selected species that no longer qualifies under the new data shall show the FR-15 empty state.

> **FR-23** - The explorer shall exist only in the page's ready state and shall inherit the page's existing loading and setup-required behavior; with no backup stored, the page's existing setup flow appears and no explorer control renders.

### Documentation

> **FR-24** - The same change that ships this feature shall update the Species Detail coverage in docs/HELP.md, README.md, and the website, and shall carry the standard changelog entry and version bump per project conventions.

## Non-Functional Requirements

> **NFR-01 - Offline and privacy:** The entire feature shall make zero network calls and require no API key; every value derives from the already-parsed backup in memory. No new provider, endpoint, stored cache document, or privacy-policy change. The absence of network activity shall be verifiable at the transport seam.

> **NFR-02 - Performance:** Qualification, list membership, and per-species tallies shall derive at most once per loaded export, and the filtered breakdown at most once per species/filter change, never on unrelated re-renders, with no work proportional to the size of the loaded data on every render. The feature shall remain responsive with exports of tens of thousands of rows. Performance verification shall assert work done (derivation invocations), not elapsed time.

> **NFR-03 - Accessibility:** WCAG 2.1 AA shall hold at 320px viewport width and 200% in-app text scale, in both themes. The control, list, and breakdown shall be fully keyboard operable, the control's expanded/collapsed state shall be conveyed to assistive technology, and each row's name, count, and percentage shall be readable as text, not conveyed by layout or color alone.

> **NFR-04 - Theming and layout:** Every color shall come from the var(--sr-*) token set and render correctly in both themes, with no hardcoded color values in components. Responsive behavior shall be achieved by lifting to classes, never inline styles. No horizontal page overflow at any supported width.

> **NFR-05 - Copy standards:** No em dash (U+2014) in any user-facing copy or in the published documentation prose this feature touches. Copy follows the app's display-copy conventions.

> **NFR-06 - One rule, one renderer:** Countability shall be decided only by the existing shared predicate (isNonCountableForm) and parent folding only by the existing shared name-folding utility; introducing a new or duplicated classification rule is prohibited. Every user-facing bird name shall render through the shared BirdName component per the app-wide convention.

## Out of Scope

- Hybrids, spuhs, slashes, and undescribed forms: non-countable names are not subspecies of a parent and appear nowhere in the explorer, in rows or in denominators.
- Any eBird API use: no fetching the full subspecies taxonomy, no regional or expected-form data; only forms present in the user's own export appear.
- Changes to countability rules, life-list totals, or the behavior of the existing "Show subspecies" and "Show all forms" toggles.
- Subspecies views on other tabs (Statistics, Life List, Multimedia); this is a Species Detail feature for v1.
- Breaking the page's other sections (media, map, breeding codes) out by subspecies; the breakdown covers report share only.
- An exact-name-mode variant of the explorer; the feature is defined for merged mode only.
- Alternative percentage bases (individual bird counts, checklist counts); the basis is observation rows, per the approved brief.
- Persisting the explorer's open state, or any new stored setting or cache document.
- Copy, export, or share actions on the breakdown.
- Changes to the species selector's search or filtering behavior.

## Open Questions

None - all decisions are resolved in this document.

Two notes for downstream builders: the brief's flagged labeling decision (broad "subspecies and forms" set versus a narrower pure-subspecies definition) is resolved by FR-01 and FR-04, keeping the broad countable set with honest labeling; and the possibility that the existing merged aggregate includes non-countable variant rows is governed by FR-13's surface-the-conflict rule with FR-02 defining the breakdown.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Classification rule (FR-01) | On a fixture containing an ISSF group, an intergrade, a domestic type, a hybrid, a spuh, a slash, and an undescribed form, exactly the first three classes are treated as subspecies/form entries |
| QA-02 | Non-countables excluded everywhere (FR-02) | A non-countable row folding to the selected species appears in no breakdown row and adds nothing to the displayed total |
| QA-03 | List membership (FR-03) | The list contains exactly the fixture species that have at least one qualifying entry; a species with only plain rows or only non-countable rows is absent |
| QA-04 | Control placement and labeling (FR-04) | In ready state with merged mode on, a control renders directly below the species selector and its user-facing labeling contains "subspecies and forms" |
| QA-05 | List content and ordering (FR-05) | Each list entry shows the species name plus each qualifying form with a percentage; species follow selector order and forms are sorted by share descending, ties alphabetical |
| QA-06 | Pick-to-select (FR-06) | Choosing a list entry selects that species (all sections show the new species), the list closes, and the breakdown section is in view |
| QA-07 | No qualifying species (FR-07) | With a fixture containing no form-level rows, the control still renders and opening it shows the honest empty message |
| QA-08 | List ignores filters (FR-08) | With an active county filter that excludes all of a species' form rows, that species remains in the list with unchanged percentages |
| QA-09 | Row counts and basis (FR-09) | Each form row's count equals a hand count of that form's CSV rows; a checklist with both a species-level and a form-level row contributes exactly one report to each |
| QA-10 | No-form-noted row (FR-10) | For a species with both kinds of rows, a "no form noted" row renders last with the exact species-level row count; for a form-only species it is absent |
| QA-11 | Exact count identity (FR-11) | For every species in the fixture, displayed row counts sum exactly to the displayed species total |
| QA-12 | Percentage display (FR-12) | Displayed percentages sum to exactly 100.0% on a fixture engineered to round unevenly, and a 1-row-in-2000 form displays 0.1%, not 0.0% |
| QA-13 | Parity with merged view (FR-13) | With no filter and with a filter active, breakdown total plus the non-countable ledger equals the Sightings section's Checklists figure for the same species in default merged mode, and the two displayed figures are equal exactly when that ledger is zero (the Architect verified the merged aggregate includes non-countable variant rows, so raw equality is unsatisfiable on fixtures containing one; schema.md restates the pass condition as this identity) |
| QA-14 | Filtered states (FR-14) | A filter leaving only species-level rows yields a single "no form noted" row at 100%; a filter leaving zero rows yields the honest zero state |
| QA-15 | Non-qualifying species empty state (FR-15) | Selecting a species with no form entries renders the one-line empty state, and the section is present, not missing |
| QA-16 | Form-only species (FR-16) | A species recorded only as forms shows form rows summing to 100% with no "no form noted" row, and is selectable from the list |
| QA-17 | Name rendering (FR-17) | Every species and form name in the list and breakdown is the full reported name rendered through the shared bird-name component (verified by test against the convention) |
| QA-18 | Section placement (FR-18) | The breakdown renders as its own titled section after the Sightings section, with all existing sections intact around it |
| QA-19 | Exact-name mode (FR-19) | With "Show subspecies" on, neither control nor section renders; turning it off restores both |
| QA-20 | Show all forms inert (FR-20) | Toggling "Show all forms" both ways produces byte-identical explorer list and breakdown content |
| QA-21 | No regression (FR-21) | With the explorer unopened, existing behaviors (both toggles, life-list counts, all other sections and tabs) match the prior release in the regression suite |
| QA-22 | Export reload (FR-22) | Replacing export A with export B recomputes list and breakdown from B only; a species that lost its forms in B shows the empty state |
| QA-23 | Page phases (FR-23) | With no stored backup the setup flow shows and no explorer control renders; the control appears only in ready state |
| QA-24 | Documentation (FR-24) | The change includes updates to docs/HELP.md, README.md, and website/ describing the explorer, plus changelog and version bump |
| QA-25 | Zero network, no key (NFR-01) | A full explorer session (open list, pick species, read breakdown, filter) records zero outbound requests at the transport seam and works with no eBird key configured |
| QA-26 | Memoized derivation (NFR-02) | An instrumented run shows tallies derived once per load and once per species/filter change, with no derivation on unrelated re-renders of a large fixture |
| QA-27 | Accessibility (NFR-03) | At 320px and 200% text scale in both themes: no horizontal overflow, full keyboard operation of control/list/breakdown, expanded state announced, AA contrast on all explorer text |
| QA-28 | Theming and copy (NFR-04, NFR-05) | No hardcoded colors or inline layout styles in the new UI; no U+2014 anywhere in its user-facing copy or touched documentation prose |
