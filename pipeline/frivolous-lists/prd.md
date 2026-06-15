# PRD — Frivolous Lists
**Feature:** frivolous-lists
**Date:** 2026-06-14
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
A new **Frivolous Lists** section at the bottom of the Statistics page holding three playful, self-completing collections — **Avian American**, **California Dreamer**, and **Rainbow Warrior** — that fill in with checkmarks, first-sighting details, and completion badges as the user's own life list covers them. Entirely derived from the already-loaded eBird backup; no backend, no new data.

## User Stories
> **US-01** — As a birder, I want a fun set of themed checklists at the bottom of my Statistics page, so that exploring my life list feels playful, not just analytical.
> **US-02** — As a birder, I want to see which "American" and "California" birds I've recorded with a checkmark, so that I can chase the ones I'm missing.
> **US-03** — As a birder, I want a badge when I complete a list, so that finishing the set feels rewarding.
> **US-04** — As a birder, I want to see the first bird of each rainbow color I ever logged, with when and where, so that I can relive those first sightings.
> **US-05** — As a birder, I want to click straight from a Rainbow Warrior entry to that checklist on eBird or to the species page, so that I can dig into the record.

## Functional Requirements

**Section & placement**
> **FR-01** — The app shall render a **Frivolous Lists** section as the final section of the Statistics page, after every existing section (including the optional Media section), in the standard `SectionCard`.
> **FR-02** — The app shall add **Frivolous Lists** to the Statistics jump-navigation list (always present, since it needs only eBird data).
> **FR-03** — The section shall contain three labelled sub-lists in this order: Avian American, California Dreamer, Rainbow Warrior.

**Avian American & California Dreamer**
> **FR-04** — Avian American shall list all 22 specified "American" species (in the given order), each rendered through `<BirdName>`; California Dreamer shall do the same for the 7 specified "California" species.
> **FR-05** — A species the user has recorded shall show a checkmark; a species not recorded shall show no checkmark and render its name without a Species Detail link. Recorded-or-not is decided by matching the hardcoded name (normalized) against the user's recorded backbone (`normalizeSpeciesName`).
> **FR-06** — Each of these two lists shall show a progress indicator of recorded-of-total (e.g. "14 / 22").
> **FR-07** — When every species in one of these lists is recorded, that list shall display a completion badge.

**Rainbow Warrior**
> **FR-08** — Rainbow Warrior shall show seven rows in spectrum order: red, orange, yellow, green, blue, indigo, violet — each with a color swatch and the color's name.
> **FR-09** — For each color, the represented bird shall be the **earliest-first-seen** species in the user's data whose common name contains that color **as a whole word**, matched case-insensitively (word-boundary match, so "Red-tailed Hawk" matches red but "Reddish Egret" and "Black Redstart" do not). One bird may satisfy more than one color.
> **FR-10** — A filled color row shall display the bird's name (`<BirdName>`, linking to Species Detail), the first-seen date, the first-seen location, and a clickable eBird checklist link to that first sighting.
> **FR-11** — A color with no matching recorded bird shall display the color name with a blank placeholder and no link.
> **FR-12** — When all seven colors are filled, Rainbow Warrior shall display a completion badge.

**Shared**
> **FR-13** — All bird names shall render through `<BirdName>` with resolved taxon codes; all checklist links through `<ChecklistLink>` (guarded by `SUBMISSION_ID_RE`, so a malformed id renders as plain text, never a link).
> **FR-14** — The entire section shall be computed from the already-parsed eBird backup in scope on the Statistics page (`filteredObs`), with no new network call, backend route, data source, or persisted state.

## Non-Functional Requirements
> **NFR-01 — Performance:** Computation shall be a linear pass over the loaded observations, memoized, with no perceptible effect on Statistics render; it reuses the existing parse, not a re-fetch or re-parse.
> **NFR-02 — Purity:** No `Date.now()` / `new Date()` in render or `useMemo` (the react-hooks/purity rule). "Earliest-seen" reads immutable backup dates and needs no "now" reference.
> **NFR-03 — Theming:** All colors via `var(--sr-*)`. Seven new `--sr-rainbow-*` swatch tokens shall be added to **both** `:root` and `[data-theme="dark"]`; checkmarks and completion badges reuse the existing milestone tokens.
> **NFR-04 — Accessibility (WCAG 2.1 AA):** Checkmarks, completion badges, and Rainbow rows carry descriptive `aria-label`s; the color swatch is decorative (the color name is the text); contrast verified in both themes.
> **NFR-05 — Testing:** The derivation logic lives in a pure `lib/frivolousLists.ts` with a co-located vitest (node) test; a component test, if added, uses the jsdom docblock. No recharts here, so the `afterAll(120ms)` caveat does not apply.
> **NFR-06 — Privacy:** No telemetry, no new provider; `PRIVACY_POLICY.md` is unchanged.

## Out of Scope
- User-created or customizable lists; sharing or exporting them.
- Any backend, new data source, or persisted progress state.
- More than these three lists (the code should make adding more easy, but only three ship).
- A legacy-name alias map for pre-split eBird names (see Open Questions).

## Open Questions
- **OQ-01 — Legacy eBird names.** A pre-split export (e.g. "Northern Goshawk" instead of "American Goshawk") won't tick. *Default if unanswered:* match current canonical names only; no alias map in v1 — re-downloading the export resolves it.
- **OQ-02 — Swatch hues & progress styling.** Exact rainbow swatch colors and the look of the "14 / 22" progress + badges. *Default:* The Designer sets a clear seven-color spectrum (tokenized, legible in both themes) and styles progress/badges to match the existing milestone look.

## Success Metrics
| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Section placement | "Frivolous Lists" renders as the last section on Statistics, below Media, in a standard SectionCard |
| QA-02 | Jump nav | "Frivolous Lists" appears in the Statistics section jump-nav and scrolls to the section |
| QA-03 | Avian American contents | All 22 "American" species render via `<BirdName>` in the given order |
| QA-04 | California Dreamer contents | All 7 "California" species render via `<BirdName>` in the given order |
| QA-05 | Checkmarks | A recorded species shows a checkmark; an unrecorded one does not and has no Species Detail link |
| QA-06 | Normalized matching | A species recorded only as a subspecies (e.g. parenthetical form) still ticks |
| QA-07 | Progress count | Each name-list shows the correct recorded-of-total count |
| QA-08 | List completion badge | When all species in a list are recorded, the badge appears; otherwise it does not |
| QA-09 | Rainbow order & rows | Seven rows render in red→violet order, each with swatch + color name |
| QA-10 | Whole-word color match | "Red-tailed Hawk" fills red; "Reddish Egret"/"Black Redstart" do not fill red |
| QA-11 | Earliest-first-seen | The bird shown for a color is the earliest-logged matching species, with that sighting's date and location |
| QA-12 | Multi-color bird | A name with two colors (e.g. Violet-green Swallow) can fill both, when it's the earliest for each |
| QA-13 | Rainbow links | A filled row links the name to Species Detail and the date/location to the correct eBird checklist |
| QA-14 | Empty color | A color with no matching bird shows a blank, no link |
| QA-15 | Rainbow completion badge | When all seven colors are filled, the Rainbow badge appears |
| QA-16 | No new network | Loading Statistics makes no new backend/provider call for this section |
| QA-17 | Purity/lint/build | eslint (incl. react-hooks/purity), typecheck, and build pass |
