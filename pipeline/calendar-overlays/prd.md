# PRD -- Calendar Overlays
**Feature:** calendar-overlays
**Date:** 2026-09-26
**Stage:** 2 -- The Planner
**Source:** strategic-brief.md (approved)

> **Amendment (post-design, 2026-09-26).** Amended by The Planner after the user approved the Stage 4 design (`design-spec.md`; `decisions.md` D4-09 and D4-10). The quiet presence marks became rich tiles: per-format media glyphs with counts, one row per specific breeding code with a category circle and a species count (capped at three rows plus "+N"), a condensed form chosen by the cell's own width, and Large view keeping the corner marks. A third persisted field and control, `codes: 'every' | 'category'` ("Every code" / "By category", default "Every code", dimmed with `aria-disabled` while Breeding is off), joins the two switches. Amended in place: Feature Overview, US-04, FR-01 to FR-06, FR-09, FR-10, FR-14, FR-15, FR-17, FR-20, FR-22, FR-24 to FR-26, FR-29, FR-30, FR-34, NFR-02, NFR-04, NFR-05, NFR-07, Out of Scope, Open Questions 1 to 6 (resolved), QA-01 to QA-04, QA-18, QA-19, QA-23, QA-27, QA-28, QA-30, QA-33, QA-34, QA-45. Added: US-08, FR-36 to FR-38, QA-47 to QA-49. Every existing ID keeps its number and its meaning; only text changed.

## Feature Overview

Two optional, independently switched overlays on the Calendar tab's day cells: a **Media** overlay that turns any day whose observations carry Macaulay Library catalog numbers into a tile of per-format glyphs and counts, and a **Breeding** overlay that lists the specific eBird breeding codes recorded that day, each with its category circle (Confirmed, Probable, Possible) and the number of species carrying it, shown either as every code or as one row per category by a third control. All three preferences default to off / "Every code", persist through the storage seam, and enrich the day popup, the legend and the day's accessible name only while an overlay is on.

## User Stories

> **US-01** -- As a birder scanning my year on the Calendar, I want days where I brought home photos or recordings marked on the grid, so that I can see when I got media without leaving for the Multimedia tab.

> **US-02** -- As a birder who records breeding evidence, I want days with a breeding code marked by category, so that a day I confirmed a nest reads differently from an ordinary summer outing.

> **US-03** -- As a birder using the species filter, I want the marks to narrow to that species, so that "when did I get media of this bird" and "when did I see breeding evidence for it" read straight off the grid.

> **US-04** -- As a birder who opens a day, I want the popup to say which checklists carried media (by format when my ML export is loaded) and every breeding code each recorded with how many species carried it, so that the tile leads to the exact fact.

> **US-05** -- As a birder who prefers the overlays on, I want the switches and the codes choice remembered across launches, so that I set them once.

> **US-06** -- As a birder who never turns the overlays on, I want the Calendar to look and behave exactly as it does today, so that the feature costs me nothing.

> **US-07** -- As a screen-reader or keyboard user, I want the switches reachable and the marked days announced with the same facts sighted users see, so that the overlays are not a visual-only feature.

> **US-08** -- As a birder who turns Breeding on, I want to choose between seeing every code I recorded that day and seeing one row per category, so that a busy atlas day can read either as the full list or as a summary. (Added post-design, D4-10.)

## Functional Requirements

### A. Overlay switches and persistence

> **FR-01** -- The app shall offer, in the Calendar controls under a visible group label ("Overlays"), two independent switches, one for the Media overlay and one for the Breeding overlay, each with `role="switch"`, an accessible name that contains its visible label, and `aria-checked` reflecting its state; and, after the Breeding switch inside the same group, a two-option codes control (`role="group"` named "Breeding rows", options "Every code" and "By category", the pressed option reflected by `aria-pressed`) that chooses how breeding rows are drawn on the cell. The codes control's gated behavior while Breeding is off is FR-36.

> **FR-02** -- Both switches shall default to off and the codes control to "Every code" on first use and on any device where no valid preference is stored.

> **FR-03** -- The app shall persist the two switch states and the codes choice as three fields (`media`, `breeding`, `codes`) under ONE settings key through the `storage` seam (`storage.getSetting` / `storage.setSetting`), never `localStorage`, writing the whole three-field value on every change of any of the three, and writing only when the user changes a control (hydration is a pure read and writes nothing back).

> **FR-04** -- On hydration the app shall validate the stored value: a value that is not a plain object reads as the default (both off, "Every code"); within an object, each boolean field is honored only when it is strictly a boolean and otherwise reads as off; the `codes` field is honored only when it is strictly the string `'every'` or `'category'` and otherwise reads as `'every'`; unknown fields are ignored. A read that rejects or throws reads as the default with no error surface.

> **FR-05** -- If the user changes any of the three controls before hydration has resolved, the user's choice shall win; hydration shall never overwrite a value the user has set in this session.

> **FR-06** -- If the persist write fails when a control is changed, the control shall keep its new in-session state (the overlay stays on or off, the codes choice stays as chosen, for the rest of the session), the app shall show no error surface and throw nothing, and the next change shall attempt the write again.

> **FR-07** -- Both switches shall remain operable under every metric (Species, Checklists, Total count), every view (Compact, Large), All years, any species filter, and Use Textures on or off. The inert/dimmed treatment the "Count all forms" switch receives under the Checklists metric shall never reach the overlay switches or the codes control; the only gate on the codes control is the Breeding switch (FR-36).

> **FR-08** -- Changing any overlay control shall not rebuild the day derivation, re-parse the backup, close an open day popup, or change the selected metric, view, year or species filter.

> **FR-36** -- While the Breeding switch is off, the codes control shall be gated rather than hidden: its wrapper carries `aria-disabled="true"` and is visibly dimmed; each option carries `aria-disabled="true"` and an `aria-describedby` reference to a visually hidden reason ("Turn on Breeding to choose how codes show."); click, Enter and Space are ignored; both options remain focusable tab stops (no `tabIndex` override, no `pointer-events: none`). Turning Breeding on removes the wrapper attribute and the dim, and the control's stored value (which persisted regardless of the gate) applies at once. (Added post-design, D4-10.)

### B. Derivation

> **FR-09** -- The app shall derive per-day overlay facts inside the same single pass that already builds the day cells, with no second walk of the observations: for each populated day, (a) the distinct catalog ids across that day's rows (from which media presence and the distinct id count follow), (b) the number of that day's checklists with at least one catalog id, and (c) every distinct breeding code recorded that day, each with the number of distinct normalized species names carrying it, sorted strongest first by the table's rank (unknown codes last, first-seen order among equals); the day's strongest code and category are the first entry of that list, or none.

> **FR-10** -- The app shall derive the same facts per checklist within each day for the popup: the checklist's distinct catalog ids and every distinct breeding code it recorded, each with that checklist's species count for the code, in the same strongest-first order.

> **FR-11** -- Media presence shall come from the eBird backup's parsed catalog ids only (`ObservationEntry.catalogIds`, already filtered to numeric ids by the parser). An empty, blank or malformed `ML Catalog Numbers` cell yields no ids and therefore no media presence; the build shall add no new scan over raw file text.

> **FR-12** -- Breeding classification shall use the Breeding Codes tab's table (`BREEDING_CODE_MAP`, tiers 3-4 Confirmed, tier 2 Probable, tier 1 Possible). The backup's codes are display codes and shall be looked up directly, never passed through the API-to-display translation. A code not in the map shall be treated as tier 1 (Possible) with the raw code as its label, exactly as `resolveApiBreedingCode` treats an unknown code.

> **FR-13** -- "Strongest" shall be resolved by the existing strongest-first rank of the breeding table; unknown codes rank below every known code; ties keep the first-ranked code.

> **FR-14** -- Overlay facts shall follow the species filter (only rows whose normalized name matches the filter contribute, so every per-code species count becomes 1) and shall ignore both the "Count all forms" toggle and the escapee exclusion: a row for a non-countable form or an excluded species still contributes media presence and breeding evidence.

> **FR-15** -- In All years, a date shall be marked if any year had media or breeding evidence on it: the distinct catalog ids are the union across years, each code's species set is the union across years, the strongest category is the strongest across years, and the media checklist count counts checklists across years.

> **FR-16** -- Overlay facts shall exist for zero-count days as well as data days: a day whose active-metric count is 0 (for example a day with only non-countable forms under the default Species metric) that carries media or a code shall be marked exactly as a data day is.

### C. Cell marks

> **FR-17** -- With either overlay on, every Compact-view cell for a birded day shall become a tile: the count first, then one fact row per fact, drawn in the cell's own number color and hidden from assistive technology. With the Media overlay on, a day with media presence shows, when the ML export is loaded, one row per format present in the fixed order photo, audio, video (format glyph, count of distinct catalog ids in that format) plus one generic frame row for ids the export does not name, and, when the export is not loaded, a single frame row with the total distinct ids; days without media presence show no media row. With the Breeding overlay on, a day with breeding evidence shows breeding rows per FR-37, each carrying its category (Confirmed, Probable, Possible) by the fill of a circle (solid, half, open), never by color; days without evidence show no breeding row. A day with both facts shows both sets of rows.

> **FR-37** -- Breeding rows on the tile shall follow the codes control. Under "Every code": one row per distinct code recorded that day, strongest first, each with its category circle, the code text and the number of species carrying that code; past three codes the tile shows three rows and then a single "+N" row, N being the number of further codes. Under "By category" (amended per D4-11, the user's live look: the earlier rule drew the strongest CODE per category, which read exactly like an Every-code row): one row per category present, in the order Confirmed, Probable, Possible, each with the category circle, the category's short name (**Conf**, **Prob**, **Poss**, `BREEDING_CATEGORY_SHORT`, set lighter than a code) and the number of distinct species with evidence at that category; no code appears on the tile, and at most three rows means no "+N". The rows shall be produced by one pure derivation shared by the cell and its tests. (Added post-design, D4-09 and D4-10.)

> **FR-38** -- Each tile shall render two fact blocks, a rich one and a condensed one, and the stylesheet shall show exactly one by the cell's own width (a size container query on the cell; nothing measures or re-renders on resize): the rich rows of FR-17 and FR-37 where the cell is wide enough, otherwise a condensed block of at most one media row (frame glyph, total distinct ids), then under "Every code" one breeding row (strongest code with its circle, no count) and a "+N" when further distinct codes exist (N = distinct codes minus one), or under "By category" (amended per D4-11) one row per category present as its circle and its species count, with no text and no "+N". On a cell too narrow for a glyph and its text to share a line, the row wraps and the tile grows taller rather than overflowing. (Added post-design, D4-09.)

> **FR-18** -- Fact rows and marks shall render only on cells that represent a birded day (data and zero cells), never on no-data or padding cells.

> **FR-19** -- With both overlays off, the rendered markup of every cell, of the legend and of the day popup shall be identical to the pre-feature rendering, except for the metric noun added to accessible names (FR-28).

> **FR-20** -- The on-cell count shall stay first in the tile, in its existing register and fully readable, at every width from 320px up and at 200% in-app text scale with both overlays on; fact rows sit beneath it and never overlap its glyphs. The tile may grow in height to hold its rows (cells in a week share the tallest cell's height, so a week with no facts stays near-square), and there shall be no horizontal page scroll introduced at 320px / 200% (NFR-04).

> **FR-21** -- Fact rows and marks shall stay legible over all five shade tiers in both themes, and over the crosshatch when Use Textures is on, in both themes.

> **FR-22** -- In Large view the geometry is unchanged and the codes control has no effect; with an overlay on, each birded day's thumbnail shows up to two corner presence marks (a media frame bottom-left, the strongest category's circle bottom-right) that follow the same legibility rule as the day-of-month number: shown where the thumbnail cell is at or above the existing container-query floor, hidden below it, with no second threshold. The day's accessible name and the popup carry the facts at every size.

> **FR-23** -- Fact rows and marks shall be decorative in the accessibility tree (hidden from assistive technology); the day's accessible name carries the facts (FR-28), so nothing is announced twice.

### D. Day popup

> **FR-24** -- While the Media overlay is on, the popup header shall show a day-level media summary: "media on N checklists" (N the day's media checklist count) followed by the day's per-format totals each with its glyph when the ML export is loaded ("4 photos", "1 audio"), or the day's plain total ("5 media") when it is not; and each checklist row shall show a media line giving that checklist's distinct catalog id count ("N media") followed by its per-format phrases when they resolve. A checklist with no ids shows no media line.

> **FR-25** -- When the ML export is loaded and at least one catalog id resolves to a format through the existing `observationMediaFormats` join, the per-format breakdown (photo, audio, video, in that order, with no count of one taking a plural noun) shall be computed by one join at render from the distinct ids and the export map, for the tile rows, the popup header and the popup rows alike; ids that resolve to no format are counted in every total, shown on the tile as the generic frame row, and omitted from the popup's format phrases.

> **FR-26** -- While the Breeding overlay is on, the popup header shall show a day-level breeding summary: "breeding evidence: Confirmed" (or Probable / Possible) followed by every distinct code recorded that day, each with its category circle, the code and its species count; and each checklist row that recorded a code shall show one chip per distinct code on that checklist (code, label, category, and "N species" when more than one), tinted with the Breeding Codes tab's tier register. The popup always lists every code regardless of the codes control. A row with no code shows no breeding line.

> **FR-27** -- The popup shall read the overlay state live on every render, never from a snapshot taken when the day was opened, so a state change while it is open is reflected without reopening.

### E. Accessible names and legend

> **FR-28** -- Every birded day's accessible name shall name the metric its number belongs to, in the noun the zero-day name already uses: "checklists", "individuals", or "countable species" (and "species" when the with-forms Species count is the value shown). Format: `{date}: {N} {noun}. Open day details`. Zero days keep their existing name in every reachable state.

> **FR-29** -- While an overlay is on, a marked day's accessible name shall append the facts before the trailing instruction: `, media: 3 photos, 1 audio` (per-format counts in the order photo, audio, video when the export is loaded; `, media: 5` with the plain total when it is not) and/or `, breeding: NY 1 (Confirmed), S 2 (Possible)` (every distinct code with its species count and category, strongest first, regardless of the codes control). Unmarked days and days whose overlay is off append nothing.

> **FR-30** -- While an overlay is on, the legend shall append one key block per active overlay, drawn from the same mark specification the cells use so the two cannot drift: a Media block whose entries are photos, audio, videos and media when the ML export is loaded, or media alone when it is not, with a caption stating what the count means; and a Breeding block with entries for Confirmed, Probable and Possible (strongest to weakest) and a caption that states the row rule under the current codes setting ("every code recorded that day, count: species carrying it" or, amended per D4-11, "one row per category that day, count: species with evidence at that category"); under "By category" each Breeding entry keys the tile's short form to its word ("Conf · Confirmed", "Prob · Probable", "Poss · Possible"). With both overlays off, the legend is unchanged.

### F. ML export handling

> **FR-31** -- The app shall read the ML export only while the Media overlay is on (on switch-on or on hydrating to on), through the existing cached `loadMLExport()`; the default path reads no new file. The feature makes no third-party request, no new endpoint or host, and no request moved between components; on web/Pi the Calendar's preference read and write and the ML export read go to the user's own backend over existing routes (`GET`/`POST /settings/calendarOverlays`, the stored-file read), and on desktop and iOS they are local file reads. (Corrected after the security review, Finding 3: the earlier "makes no network call" was true on desktop and iOS and not on web/Pi, where every storage-seam call is a request to the user's own server.)

> **FR-32** -- A missing, unreadable, unparseable or non-matching ML export shall produce a plain media count with no breakdown and no error state anywhere on the tab; while the export is still loading, the tile, legend and popup show the plain-count forms and gain the breakdown when the load lands.

> **FR-33** -- When the stored files change (the files epoch the tab already observes), the app shall re-read the ML export if the Media overlay is on, so a newly saved or removed export is reflected without a relaunch.

### G. Documentation

> **FR-34** -- `docs/HELP.md`'s Calendar section shall be updated in the same change to describe the two switches, the codes control and its two renderings, what each on-cell count means, the condensed form on narrow cells, the Large-view marks, the popup detail, and that the three preferences persist.

> **FR-35** -- README and website changes shall be limited to at most ONE proposed sentence for the Calendar's section, shown to the user before it lands and written only on an explicit yes; the App Store listing is untouched unless the user chooses otherwise.

## Non-Functional Requirements

> **NFR-01 -- Performance:** Changing an overlay control re-renders without rebuilding day cells (the derivation memo's inputs are unchanged by the change); the single-pass derivation adds no second traversal of observations and no new allocation proportional to anything but the number of populated days, checklists and distinct codes.

> **NFR-02 -- Accessibility:** WCAG 2.1 AA holds at 320px width and 200% in-app text scale with both overlays on: tile text meets 4.5:1 and non-text shapes meet 3:1 against their immediate background on every tier in both themes with textures on and off; the breeding category is never conveyed by color alone; both switches and both codes options are reachable by Tab through the `Button` primitive default (the codes options remain tab stops while gated) and operable by Enter and Space; enriched accessible names are asserted with `getByRole(..., { name })`.

> **NFR-03 -- Theming:** Every color the tiles, marks, legend entries and popup lines use is a `var(--sr-*)` token defined in both themes; no hex or RGB literals in components; any new token is added to both `:root` and `[data-theme="dark"]` and guarded by a parse-the-tokens contrast test.

> **NFR-04 -- Layout:** No new horizontal page scroll at 320px / 200% in either view; the existing 29px Calendar leak is not widened. Tiles may grow in height (vertical growth is the designed response to narrow cells) but never in width past the cell. Responsive behavior is lifted to classes, never inline styles; the rich / condensed choice is a stylesheet container query on the cell; fact rows are sized in rem, and Large-view marks follow the existing sanctioned px container-query floor.

> **NFR-05 -- Security and privacy:** No third-party request, no new endpoint or host, and no request moved between components (on web/Pi the preference and the ML export go to the user's own backend over existing routes; see FR-31); no new file read on the default path; no new scan over raw file text (the derivation consumes already-parsed `catalogIds` and `breedingCode`); user-file content rendered on the tile or in the popup (an unknown breeding code) renders as escaped text; `PRIVACY_POLICY.md` is unchanged (two boolean preferences and one two-value string join the device-local settings document; iCloud syncs the two data files only).

> **NFR-06 -- Compatibility:** Identical behavior on web/Pi, macOS, Windows and iOS through the storage seam; WebKit tab order is satisfied by the primitives.

> **NFR-07 -- Tests:** Red-first unit coverage of the derivation (distinct ids, per-code species counts and ordering including unknown codes, species filter, All years, zero-count days, empty/malformed catalog cells) and of the shared tile-row derivation (per-format rows with the unknown bucket, the three-row cap with "+N", the by-category grouping, the condensed rows); a both-themes contrast guard for tile ink over all five tiers and the hatch; the persistence round trip of all three fields and every invalid stored shape through the seam; the codes control's gated state; the missing/loading/non-matching ML export paths; and the "overlays off is byte-identical" property asserted against a pre-change capture of cell, legend and popup markup (modulo the metric noun).

## Out of Scope

- A first-of-year / lifer layer (roadmap: the natural third layer once the frame exists).
- Any layer needing network or a file the user has not loaded (eBird API data, atlas blocks, weather).
- Listing the day's species names in the popup, or per-species shading parity with the map.
- The textures-mode tint underlay defect (`calHatchCss` key order); tiles must be legible over the hatch as it renders today.
- The Calendar's 29px horizontal-scroll leak and the scientific-name species filter gap.
- Persisting the Calendar's existing session-only controls (metric, view, textures, Count all forms, species filter).
- Any change to the Breeding Codes or Multimedia tabs, to `PRIVACY_POLICY.md`, or to the App Store listing.
- Syncing the overlay preference between devices (settings are device-local by design).
- The codes control reaching the popup, the accessible name or Large view: all three always carry every code (post-design; the control governs the tile rows and the legend caption only).
- Per-format rows or specific codes on Large-view thumbnails (they keep presence marks; the popup carries the detail).
- Any change to the day popup's entrance motion (FR-19 requires its off-state markup byte-identical).

(Removed post-design, now in scope: "per-format media glyphs on the cell" and "a count of media per format on the cell, or a per-day format summary in the popup header". See the amendment note and D4-09.)

## Open Questions

1. **Breeding mark form.** **Resolved (D4-01, D4-09):** a circle whose fill carries the category (open Possible, half Probable, solid Confirmed), beside the code text on the tile and alone as the Large-view corner mark.

2. **Switch labels.** **Resolved (D4-05, D4-10):** group label "Overlays", switches "Media" and "Breeding", codes options "Every code" and "By category", codes group name "Breeding rows", gated reason "Turn on Breeding to choose how codes show."

3. **Legend content for Breeding.** **Resolved (D4-06, design-spec Legend):** all three categories whenever Breeding is on, plus a caption stating the row rule under the current codes setting; the Media block's entries depend on whether the ML export is loaded.

4. **Tolerant versus strict hydration.** **Resolved as written and extended to the third field (D4-10):** each field validated independently; an invalid `codes` reads `'every'`.

5. **Persist-failure behavior.** **Resolved as written:** the in-session change stays, no toast, no revert; applies to the codes control too.

6. **Unknown breeding code label length.** **Resolved as written (design-spec Content Notes):** plain escaped text, visually truncated with an ellipsis past 8 characters in the popup; in the accessible name bounded by `codeText` at 8 code points plus an ellipsis (schema decision 15); on the tile bounded by `tileCodeText` (an unknown code longer than 2 code points shows its first code point plus an ellipsis, E5-09); category always "Possible". (Corrected after QA, see decisions.md O-02.)

7. **README/website sentence.** **Default:** the build proposes one sentence for the Calendar section; nothing on those surfaces changes until the user approves it.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01 controls present | Two `role="switch"` controls under a visible "Overlays" group label in Calendar controls, accessible names contain "Media" and "Breeding", `aria-checked` toggles on activation; after the Breeding switch, a `role="group"` named "Breeding rows" holds two options "Every code" and "By category" whose `aria-pressed` reflects the choice. |
| QA-02 | FR-02 defaults | Fresh state (no stored key): both switches read `aria-checked="false"`, "Every code" is pressed, no fact rows, no legend overlay blocks. |
| QA-03 | FR-03 persistence round trip | Flip Media on: exactly one `setSetting` call on one key with all three fields (`media: true, breeding: false, codes: 'every'`); relaunch/re-mount reads it back and Media renders on with no write during hydration. |
| QA-04 | FR-04 invalid stored shapes | Each of `null`, `"yes"`, `42`, `[]`, `{ media: "true" }`, `{ media: 1, breeding: true }`, `{ breeding: true, codes: 'both' }`, `{ codes: 1 }`, a rejecting `getSetting` hydrates as: non-object or non-boolean field -> that field off; non-string or unrecognized `codes` -> `'every'`; `{ media: 1, breeding: true }` -> Media off, Breeding on; `{ breeding: true, codes: 'category' }` -> Breeding on, "By category" pressed; unknown keys ignored. No error surface in any case. |
| QA-05 | FR-05 flip before hydration | With a `getSetting` that resolves `{ media: false, breeding: false, codes: 'every' }` after the user flips Media on, the final state is Media on. |
| QA-06 | FR-06 write failure | With `setSetting` rejecting, flipping Breeding on leaves `aria-checked="true"`, fact rows render, no alert or error text appears, nothing throws; the next change calls `setSetting` again. |
| QA-07 | FR-07 operable under every state | Under the Checklists metric (Count all forms dimmed), in Large view, in All years, with a species filter and with textures on, both overlay switches have no `aria-disabled`, sit in a container with no `pointer-events: none` or reduced opacity, and flip on click and on Enter/Space; with Breeding on, the codes control is likewise undimmed and operable in every one of those states. |
| QA-08 | FR-08 flip side effects | Changing any overlay control leaves metric, view, year, species filter and an open popup unchanged, and the day-cell derivation memo is not recomputed (spy on `buildDayCells` call count). |
| QA-09 | FR-09/FR-10/FR-11 media presence and counts, day and checklist | A day with rows carrying `catalogIds` `["1","2"]` and `["2"]` on two checklists derives distinct ids `["1","2"]`, media checklists=2, and each checklist's own distinct ids (`["1","2"]`, `["2"]`); a day whose rows all have `[]` derives none at either level. |
| QA-10 | FR-11 malformed/empty catalog cell | Fixture rows with `ML Catalog Numbers` of `""`, `"  "`, `"ML"`, `"abc, ML12x"` derive no media presence; `"ML123, 456"` derives 2 ids. No new call over raw text is introduced (source review). |
| QA-11 | FR-12 classification | Rows coded `NY` -> Confirmed, `NB` -> Confirmed, `A` -> Probable, `S` -> Possible; a row coded `FY` classifies as Feeding Young (tier 4), NOT Carrying Food (proves no API translation). |
| QA-12 | FR-12 unknown code | A row coded `ZZ` derives tier 1 / Possible with label `ZZ`; the popup renders `ZZ` as text with the category "Possible". |
| QA-13 | FR-13 strongest with ties and unknowns | A day with rows `S`, `ZZ`, `A` derives the code list `A`, `S`, `ZZ` (Probable first); with `S` and `ZZ` only, the list is `S`, `ZZ` (known outranks unknown); the day's strongest is the first entry. |
| QA-14 | FR-14 ignores forms and escapees | A day whose only media row is "Gull sp." and whose only coded row is a hybrid derives both facts; with an escapee-excluded species as the sole carrier, facts still derive. |
| QA-15 | FR-14 species filter | Filtered to species X: a day where only species Y had media/codes derives neither; a day where X had media derives Media only; every per-code species count on a filtered day is 1. |
| QA-16 | FR-15 All years | In combined view, MM-DD with media in 2019 only and `NY` in 2023 only derives media present, Confirmed; the same code carried by species X in 2019 and species Y in 2023 derives species count 2; the popup rows carry their year tags. |
| QA-17 | FR-14+FR-15 filter and All years combined | Combined view filtered to species X: MM-DD marked only from X's rows across all years; Y's media in any year does not mark it. |
| QA-18 | FR-16 zero-count day with media | Default Species metric, a day with one "Gull sp." row carrying a catalog id renders a zero cell ("0") WITH a media row and accessible name `...: birded, 0 countable species, media: 1. Open day details`. |
| QA-19 | FR-17 tile rows on/off | Media on with a resolving export: exactly the media-present days carry fact rows, one per format present in the order photo, audio, video with the right distinct-id counts, plus a frame row only when unnamed ids exist; without the export, one frame row with the total. Breeding on: exactly the coded days carry breeding rows, each with a circle whose fill differs per category and a species count; a day with both facts carries both sets; uncoded and media-free days carry no rows. |
| QA-20 | FR-17 category not by color alone | With all color removed (grayscale screenshot or CSS color stripped), Confirmed, Probable and Possible circles remain distinguishable. |
| QA-21 | FR-18 no rows on empty cells | No-data and pad cells contain no fact row or mark element with either overlay on. |
| QA-22 | FR-19 off is byte-identical | Both off: `outerHTML` of every rendered cell, the legend and an open popup equals the pre-change capture after substituting the metric noun into accessible names. |
| QA-23 | FR-20 count first, tile grows, no page scroll | Browser measurement at 320px / 200% text scale, Compact view, both overlays on, on a day with three media formats, four codes and a 3-digit count: the count is the tile's first child, its computed font size and weight equal the overlays-off cell's, its ink rect intersects no fact row's rect, the tile's width equals the same cell's width with overlays off, its height is allowed to exceed it, and `document.scrollWidth - innerWidth` does not exceed the pre-change reading. |
| QA-24 | FR-21 contrast on tiers and hatch | Token-parsing test: tile ink clears 4.5:1 (text) / 3:1 (shape) against every `--sr-cal-1..5` fill in both themes; textures mode measured in browser over tiers 1 and 5 in both themes with rows readable over their backing. |
| QA-25 | FR-22 Large view floor and marks | Large view at a card width >= 152px shows the frame mark bottom-left on media days and the category circle bottom-right on coded days, with no specific codes or counts and no change when the codes control is switched; below the floor the marks are hidden (computed `display: none`) while the accessible name still carries the facts. |
| QA-26 | FR-23 rows decorative | Every fact block and mark element is `aria-hidden` and contributes nothing to the cell's accessible name (name equals FR-28/FR-29 format exactly). |
| QA-27 | FR-24 popup media lines | Media on with the export loaded: header shows `media on 2 checklists` followed by `4 photos`, `1 audio` for a day whose two media checklists of three carry those totals; without the export the header shows `5 media`; each media checklist row shows `2 media` / `1 media` style counts followed by its format phrases; the non-media row shows no media line. Media off: none of these appear. |
| QA-28 | FR-25 format breakdown | With an ML export whose map resolves ids 1->Photo, 2->Photo, 3->Audio and a checklist carrying `[1,2,3,9]`: the popup row shows a total of 4 with a breakdown reading `2 photos`, `1 audio`, id 9 in neither phrase nor as an error; the same day's tile shows rows `2` photo, `1` audio and `1` frame (the unknown bucket) from the same join. |
| QA-29 | FR-25 plural agreement | Breakdown strings for counts 1 and 2 of each format never pair a count of one with a plural noun (`1 photo`, `2 photos`, `1 video`, `2 videos`, `1 audio`, `2 audio`). |
| QA-30 | FR-26 popup breeding lines | Breeding on, a day with `NY` on one species and `S` on two: header shows `breeding evidence: Confirmed` followed by `NY 1` and `S 2` each with its circle; the `NY` row shows a chip `NY`, `Nest with Young`, `Confirmed`; a row with `S` on two species shows a chip ending `2 species`; an uncoded row shows no breeding line; switching the codes control to "By category" changes none of this. Breeding off: none appear. |
| QA-31 | FR-27 popup reads live state | With the popup open, programmatically flipping Media on adds the media lines to the open popup without reopening; flipping off removes them. |
| QA-32 | FR-28 metric noun | Data day names read `{date}: 12 countable species. Open day details` (Species, forms off), `...: 12 species. ...` (forms on), `...: 3 checklists. ...`, `...: 140 individuals. ...`; zero-day names are unchanged from pre-feature. |
| QA-33 | FR-29 enriched names | Both on with the export loaded, a day with 3 photos, 1 audio, `NB` on one species and `S` on two: name is `{date}: {N} {noun}, media: 3 photos, 1 audio, breeding: NB 1 (Confirmed), S 2 (Possible). Open day details`; the same day without the export: `..., media: 4, breeding: ...`; media only: `..., media: 4. ...`; breeding only: `..., breeding: S 2 (Possible). ...`; unmarked day: no suffix; "By category" leaves every name unchanged. |
| QA-34 | FR-30 legend | Media on with the export: one block with entries photos, audio, videos, media and a caption naming the count's meaning; without the export: media alone; Breeding on: one block with Confirmed, Probable, Possible and the "every code" caption, which changes under "By category" (amended per D4-11) to the "one row per category that day" caption with entries reading "Conf · Confirmed", "Prob · Probable", "Poss · Possible"; both off: legend markup equals pre-feature; the entries render from the same spec table as the cell rows (source assertion). |
| QA-35 | FR-31 ML read only when on | With Media off through mount, metric changes and a popup open, `loadMLExport` is never called; flipping Media on calls it once; hydrating to on calls it once. No network module is imported by the Calendar (existing guard stays green). |
| QA-36 | FR-32 ML export missing / bad / non-matching | `loadMLExport` resolving `null`, rejecting-shaped (settled null), or resolving a map with no matching ids: every media line and tile row is a plain-count form, no error region has text, no phase change on the tab. |
| QA-37 | FR-32 loading then landing | With `loadMLExport` pending, an open popup and the tiles show plain counts; when it resolves with matches, the same popup and tiles show the breakdown. |
| QA-38 | FR-33 files epoch | Media on, bump the files epoch: `loadMLExport` is called again; Media off, bump: it is not. |
| QA-39 | FR-34 help | `docs/HELP.md` Calendar section describes both overlays, the codes control and its two renderings, the count meanings, the condensed form, the Large-view marks, the popup detail and persistence; no em dash; American spelling. |
| QA-40 | FR-35 published copy gate | The diff touches `README.md` / `website/` only with the one approved sentence (or not at all); `appstore/LISTING.md` unchanged. |
| QA-41 | NFR-04 no new scroll leak | Browser measurement at 320px / 200%, both overlays on, Compact and Large: `document.scrollWidth - innerWidth` is not greater than the pre-change reading (29px). |
| QA-42 | NFR-02 keyboard reach | Tab from the species filter reaches both overlay switches and both codes options in reading order (WebKit-safe via primitives); Enter and Space each flip a switch and press an option; focus ring visible. |
| QA-43 | NFR-05 no new scan / privacy | Source review: the derivation reads `catalogIds` and `breedingCode` only; no regex or split over raw CSV text is added; `PRIVACY_POLICY.md` diff is empty. |
| QA-44 | NFR-07 red-first evidence | Each new derivation, tile-row and persistence test is shown failing against the pre-change code (or its assertion mutated) before passing. |
| QA-45 | Textures mode, both themes | Browser look with Use Textures on in light and dark: fact rows and the count pill legible over tiers 1, 3 and 5 hatches, each fact block wearing the same backing the count pill does. |
| QA-46 | Live look before deploy | The user has seen the built desktop app against real data: both themes, textures on and off, a species filter applied, both overlays on, both codes settings; findings route back to the Designer. |
| QA-47 | FR-36 codes control gated state and persistence | Breeding off: the codes wrapper has `aria-disabled="true"` and reduced opacity with no `pointer-events: none`; each option has `aria-disabled="true"` and `aria-describedby` resolving to the text "Turn on Breeding to choose how codes show."; both options are reached by Tab; click, Enter and Space on "By category" leave "Every code" pressed and call `setSetting` zero times. Breeding on: the wrapper attribute and dim are gone; pressing "By category" calls `setSetting` once with `{ media, breeding: true, codes: 'category' }`, re-mount reads it back pressed with no write during hydration; a stored `codes: 'category'` with `breeding: false` hydrates to "By category" pressed under the gate and takes effect the moment Breeding is turned on. |
| QA-48 | FR-37 breeding rows by setting (amended per D4-11) | A day with `NY` (1 species), `A` (2), `S` (3), `H` (1), `P` (1): under "Every code" the tile shows exactly three rows `NY 1`, `A 2`, `P 1` (strongest first; `P` Pair in Suitable Habitat is Probable per `BREEDING_CODE_MAP`) then `+2`; under "By category" it shows the CATEGORIES, `Conf 1`, `Prob 3` (A and P species counted distinctly) and `Poss 4` (S and H species counted distinctly), and no code; the June 21 specimen (FY, CF, NB, S, H) shows `Conf 3` and `Poss 2` and none of its codes; condensed under "By category" shows each category's circle and count, with no text and no "+N"; with three or fewer codes no "+N" row exists; the rows come from the shared pure derivation (unit-tested directly and rendered from it, source assertion). |
| QA-49 | FR-38 condensed form by cell width | Both fact blocks exist in the DOM with `aria-hidden`; in a browser at desktop width one cell shows only the rich block (computed `display` of the condensed block is `none`); at 320px / 100% the same cell shows only the condensed block, whose rows are one frame row with the total ids, one strongest-code row with its circle and no count, and `+N` equal to distinct codes minus one; at 320px / 200% the glyph and text wrap to two lines within the cell with zero overflow; resizing triggers no re-render (render spy). |
