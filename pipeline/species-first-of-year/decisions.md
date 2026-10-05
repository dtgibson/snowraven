# Decisions - First of Year on Species Detail

**Feature:** species-first-of-year
**Stage:** 5 - The Engineer
**Date:** 2026-10-03

Decisions the Engineer made beyond the approved artifacts (strategic-brief.md, prd.md, schema.md, design-spec.md, design.html), each with its reason and what would reverse it. Nothing here changes an approved behavior; most are mechanics the artifacts left open, and two correct a slip in them.

## E1. The chart measures its own width instead of using `ResponsiveContainer`

**What:** `FirstOfYearChart.tsx` takes its box width through a callback ref (the first reading in the commit, before paint) and a `ResizeObserver` (afterwards), and renders `<LineChart width height>` with explicit numbers. This is PlanChart's shape. Schema section 4 and design-spec "The chart" named `ResponsiveContainer`.

**Why:** design-spec.md states a deterministic year-label thinning rule ("stated so the test can pin it") that depends on the pixels per year, so the width must be known in the same render that draws the labels. `ResponsiveContainer` measures in an effect and reports the width to a caller only through `onResize`, from its ResizeObserver callback, a render after the chart has already drawn. That would draw one frame of labels chosen for no width. Measuring in the commit phase draws the first frame at the real width.

**Unchanged by it:** the box's height is still `firstOfYearChartHeight(wide)` and its max width `firstOfYearChartMaxWidth(yearCount)`, read by the chart and the Suspense fallback alike, so FR-24 holds exactly as specified. Until the box has a width (jsdom, or a box with no room) the chart draws nothing inside its reserved box.

**Reverse if:** the thinning rule is dropped in favor of Recharts' own `interval="preserveStartEnd"` (which measures text and cannot be pinned by a unit test).

## E2. Year labels: one tick per year, thinned by a pure function

**What:** the X axis gets `ticks={yearTicks}` (every year, QA-20) with `interval={0}`, and a tick renderer that draws a label only for the years `yearLabelYears(yearTicks, pitch)` returns. `yearLabelYears` is the design's rule written as a pure function in `lib/firstOfYearChartGeometry.ts`: every `ceil(28 / pitch)`th year from the first, always the last, and the previous label yields when it would sit within 28px of the last. `firstOfYearYearPitch(width, yearCount)` is the pitch. The geometry test sweeps 2 to 60 years across widths 200 to 1,400px and asserts no two labels closer than 28px, first and last always shown; the chart test reads the thinned labels off a real render at 240px (2017, 2019, 2021, 2023, 2026, the design's phone reading).

## E3. Highlight state: hover takes precedence over focus

**What:** the section keeps two states, `hoverYear` (row `onMouseEnter` / `onMouseLeave`) and `focusYear` (row `onFocus` / `onBlur`), and passes `hoverYear ?? focusYear` to the chart. The design spec described one `activeYear` set by all four handlers.

**Why:** with one state, moving the pointer off any row clears the year the keyboard is on. With two, hover wins while it lasts and the focused row's point comes back when the pointer leaves. The CSS row tint already treats `:hover` and `:focus-within` independently. Pinned by `FirstOfYearSection.test.tsx` ("hover wins while it lasts, and focus returns after").

## E4. Phone tier: the chart box stops flexing

**What:** inside the established 640px tier block, `.sr-foy-chart { flex: none; }` beside the design's column rules.

**Why:** the wide-tier `flex: 1 1 0` puts a zero basis on the main axis. In the phone tier's column the main axis is the height, and an EMPTY flex item (the Suspense fallback) has a content-based minimum of zero, so the reserved 182px box would collapse to nothing and the page would move when the chart arrived, which FR-24 forbids. `flex: none` makes the inline height the box's height in the column. The wide tier is unaffected (there the height is the cross axis).

## E5. The list keeps list semantics in WebKit

**What:** `<ul role="list" className="sr-foy-list">`.

**Why:** WebKit drops the list role from a `list-style: none` list, and VoiceOver then reads the rows without the list's count. The explicit role is the house precedent (`AtlasLayer.tsx`, `FrivolousListsSections.tsx`, `MapExplorer.tsx`).

## E6. Chart marks

- The dot and halo are plain `<circle>`s drawn by Recharts' custom `dot` function, with classes (`sr-foy-dot`, `is-lone`, `is-active`, `sr-foy-halo`). Their size, fill and stroke come from `globals.css`, so the point grows with a CSS transition the app's reduced-motion block collapses. The CSS `r` values carry `px` (`r: 4px`), since a unitless length is not valid in a stylesheet; at the chart's 1:1 viewBox that is the design's 4, 5, 6 and 10.
- Each circle also carries an `r` attribute (the fallback geometry the CSS overrides), and the halo carries `fill="none"`, so a missing stylesheet draws nothing worse than a plain dot.
- Recharts' own animation is off (`isAnimationActive={false}`): it is JS-driven and blind to the reduced-motion block, and the design has no entrance.
- `.sr-foy-chart .recharts-surface { overflow: visible; }` (the mockup's `.sr-foy-chart svg`), written on Recharts' own class rather than a bare `svg` compound, which `.claude/rules/ui.md` reserves (the map FAB glyph cascade).

## E7. The row hairline hides with `opacity: 0`

The mockup hid it with `border-top-color: transparent`. `opacity: 0` does the same without a color keyword in the feature's rules, so the stylesheet guard can hold every `.sr-foy-` color to a `--sr-*` token with no exception.

## E8. The visible year is the date's four characters

The row's year is `r.date.slice(0, 4)` and the chart's year label is the number padded to four digits. For every real year this is identical to the number; for a year below 1000 (a well-formed `0999-...` date) it keeps FR-12's "four-digit year" true.

## E9. A named threshold for the Help guard

`FOY_CHART_MIN_ROWS = 2` in the geometry module, read by the section's chart gate. `firstOfYearHelpClaims.test.ts` builds the word "two" in its "from two years on" matcher from that constant, the house rule for a number in published prose (`.claude/rules/docs-and-website.md`). Changing the constant without the Help text goes red (mutation-verified).

## E10. A design-spec arithmetic slip

design-spec.md gives `firstOfYearChartMaxWidth` as `max(260, 34 + 14 + 2 * 10 + max(1, years - 1) * 120)` and then says "ten years give 1,160px". The formula gives 1,148 (its two-year and four-year figures, 260 and 428, are right). The build follows the formula; the comment and the test say 1,148. No visible effect: 1,148px is wider than the card at every shipped width.

## E11. One more test file than the schema listed

`frontend/src/components/SpeciesDetailFirstOfYear.test.tsx` mounts the real tab (the harness of `SpeciesDetailChecklistFrequency.test.tsx`) for the rows that need it: placement and card register (QA-18), filter parity read synchronously after each change (QA-10), the out-of-scope rows at the tab level (QA-01), First seen equality on screen (FR-08), Show all forms and Show escapees leaving the rows alone (QA-09), and the all-malformed species (QA-11).

## E12. Pre-existing defect found, not fixed (outside this feature)

`buildGraphData` in `frontend/src/lib/sightingsGraph.ts` (the Sightings Over Time data, which Species Detail computes on every species change at the default Monthly interval) never returns when a species' rows produce two or more distinct month keys and one of them comes from a malformed date. A blank Date cell gives the key `''`, `''.split('-')` yields an undefined month, `cm++` makes it NaN, and the monthly gap-fill loop never advances the year. The tab's main thread hangs on selecting that species.

Found because the first QA-11 fixture (a species whose dates were `''` and `2024-13-01`) hung the test worker. It predates this build and is reachable without First of Year; real eBird exports always carry a date, so it mainly affects hand-edited files. Not fixed here: it is outside the feature's scope (the PRD keeps the Sightings card and graphs unchanged). The QA-11 test now uses two malformed dates that share one month key, with a comment naming the defect. Saved as a fix idea in the project's idea inbox.

## E13. What the chart's laziness buys, stated as schema section 8 asks

`speciesDetail/SightingsGraph.tsx` is a static import of Species Detail and carries Recharts, so the chart library is already loaded whenever the tab is mounted. Making `FirstOfYearChart` lazy keeps the section's own static graph free of Recharts (its rows, heading and note render without the chart chunk; `entryChunk.test.ts` pins both halves) and keeps PlanChart's house shape. It does not make Recharts load later on this tab. The header comment of `FirstOfYearChart.tsx` and the `entryChunk.test.ts` rows say the same.

## Verification record

- Every new guard was mutation-checked against its own subject with a snapshot-and-hash harness (the restore verified by hash each time): the derivation (8 mutations: tie rule, month range, century leap rule, length check, a full sort, a Date-based day of year, a third field read, unsorted rows), the chart (10, including `connectNulls`, a monotone curve, the accessibility layer, `inert`, `role="img"`, the highlight, the lone point, label thinning, a hex color, the tier), the section (10, including order, the chart threshold, the zero-row state, the note, hover and focus, the fallback box, the link label, a hand-written anchor without its own dispatch), the tab wiring (4), the entry-chunk rows (2) and the Help guard (7). Every mutation turned at least one test red.
- The built stylesheet was diffed rule by rule against a build of HEAD made from `git archive` in scratch with the same toolchain: 23 rules added, all `.sr-foy-*` (19 top-level, 4 in the 640px tier), none removed or changed, and the Tailwind utilities layer identical, so no word in the new source or test files emitted a utility. The phone declarations sit after `.sr-compare-panels` in the tier block so the minifier keeps merging that rule with `.sr-two-col` as before. `FirstOfYearChart` builds as its own 2.7 kB chunk, and `dist/index.html` preloads neither it nor `vendor-recharts`.
- No `Date` object, clock read, network call, storage call, setting, document, cache, epoch or CSP change is added. The one new read over user-file text is the declared ten-character date scan (schema.md 7.1); `firstOfYear.test.ts` holds it to at most ten character reads whatever the cell holds.

## E14. The Auditor's three Informational notes, applied

The security review passed with three Informational notes, and all three are applied.

- **The rule's gate now reaches the new modules.** `.claude/rules/security.md` gains `frontend/src/lib/firstOfYear*.ts` in its `paths`, because CLAUDE.md requires a build that adds a file a rule governs to extend that rule's gate in the same change; without it the rule stays correct and never loads while those files are edited. The header comments of `firstOfYear.ts` (the declared well-formed-date scan) and `firstOfYearChartGeometry.ts` (the clamped year-span loop) now each say the file is governed by that rule. No guard reads the rule's `paths` list, so nothing in the suite checks this.
- **A year-0000 date keeps its link label.** `formatDate` refuses year 0 and returns `''` in every date format, while `isWellFormedDate` accepts `0000` (schema.md 7.1), so the row's checklist link drew with no visible text. The label is now `formatDate(r.date) || r.date`, so the raw date string fills it, and one row in `FirstOfYearSection.test.tsx` renders a `0000-01-15` row in all three formats and asserts the link text and accessible name. `firstOfYearHelpClaims.test.ts` pins the `ChecklistLink` call site's exact text, so its pattern now includes the fallback.
- **The span clamp's cost is on record.** schema.md 7.2 now records the Auditor's measurement of the worst case (about 0.55 s for the first chart draw in jsdom, about 0.7 s per re-draw on row hover, focus or a width change) and that no code change is recommended, so the figure is a stated decision rather than something to rediscover.

## D1. Shipped as 1.0.52, behind the spin's 1.0.51 (Deployer, 2026-10-04)

The user confirmed the production deploy at the gate, then chose to wait for a Weft spin that was about to release; it shipped as 1.0.51 (`9e3736c`, iOS stamp `209fd30`), so this build was rebased onto it and shipped as 1.0.52 behind it, with the spin's 1.0.51 changelog entry kept verbatim below this one. The steps and their evidence are in `deployment-record.md`.

## D2. Screenshots, What's New and the App Store route (user approvals, 2026-10-04)

- **Species for the screenshots: Wood Thrush.** The committed capture tools photograph Northern Cardinal, whose first dates all fall in early January, so its First of Year chart is a flat line at the bottom. At the user's request the shots were retaken with a species whose first dates fall mid-year: Wood Thrush, first dates May 9, 2024, May 22, 2025 and May 25, 2026, chosen from the 43 demo species whose first date falls between April and June in every year, with media so the header and Media card are filled. The capture tools were extended only in scratch; the committed tools still select Northern Cardinal, so a later full regeneration with them would put the cardinal back (recorded as a follow-up, not changed here).
- **iPad 13 store shot `appstore/screenshots/ipad-13/05-species-detail.png`: approved and committed**, replaced with the Wood Thrush capture (2064x2752, the set's size). The iPhone 6.9 shot ends inside the Sightings card and is unchanged. Not uploaded: it goes to App Store Connect with the record that carries 1.0.52, the whole iPad set replaced in order.
- **Website `website/assets/shots/species.webp`: the ALT FRAME was approved** (the page scrolled so the whole First of Year card and its chart are in view; 1600x900), over the website's current fixed crop, which cuts the card below its October label. **Held, not yet committed:** its `<img>` in `website/index.html` carries the alt text "The Species Detail tab for Northern Cardinal, showing sightings, media counts, and breeding category.", which would name the wrong bird over the new image, and changing that sentence is a website copy change that needs the user's yes on the exact words. The image goes in together with the approved alt text.
- **What's New: approved**, recorded verbatim in `whats-new.md`, with two notes there: it is not the wording this stage drafted, and its last clause ends "in two or more." with no noun.
- **App Store route: 1.0.52 is DEFERRED** behind record `99e3f9ff` (1.0.50), which the user's decision described as waiting for review; nothing was created, retargeted, withdrawn or submitted, and the spin's 1.0.51 store leg stays with its own session. A read-only query at 2026-10-05T02:44:46Z found `99e3f9ff` already `READY_FOR_SALE` (submission `7118f6a7` COMPLETE), so the record this deferral waits on is no longer in review; 1.0.51.1 and 1.0.52.1 are `VALID` with no record of their own. The next App Store step for 1.0.52 is the user's to decide, together with the spin's 1.0.51, and is written into CLAUDE.md's App Store list in the same ship whatever it is.

## D3. Website alt text, What's New unamended, and the deferral behind 1.0.51 (user decisions, 2026-10-04)

- **Website image and alt text: approved and shipped.** The user approved the alt sentence "The Species Detail tab for Wood Thrush, showing sightings, media counts, breeding category and the First of Year card with its chart.", so the held alt-frame image went in with it as one change (`8f5c137`), the only website change. Live on the site after Pages run `37261707004`; the served image is byte-identical to the committed one.
- **What's New stays exactly as recorded in `whats-new.md`, WITHOUT a "years" amendment:** the user prefers it short, so the closing "in two or more." is deliberate, not a slip.
- **1.0.52 is DEFERRED behind the spin's 1.0.51 by the user's decision on 2026-10-04** (this replaces D2's deferral behind 1.0.50, whose record is now `READY_FOR_SALE`). 1.0.52 holds VALID build 1.0.52.1 (delivery `b3410c78`) and no version record of its own **by deferral, not by skip**. The user's own device check of 1.0.52.1 passed (deployment-record.md, section 10). 1.0.52 gets its OWN record on build 1.0.52.1 once 1.0.51's record `c98d6dc5` is `READY_FOR_SALE`: its What's New is the text in `whats-new.md` unamended, the iPad set is replaced whole and in order (05 recaptured at `eca0be1`, the other five unchanged unless that ship finds them stale), the iPhone set is unchanged (its 05 ends above the card), and every listing field is read back on the new record, promotional text included. Live states at the read-only query of 2026-10-05T04:01:44Z: 1.0.51 on record `c98d6dc5-274f-412c-851f-15359fd06f43`, `WAITING_FOR_REVIEW` on build 1.0.51.1 as submission `ba562487-985f-4aaf-8cbe-b455101692ba`; 1.0.50 `99e3f9ff` and the earlier records listed `READY_FOR_SALE`; TestFlight 1.0.52.1 `VALID`.
