# Bug Brief — plan-daylabel-overlap

## What is broken

At the phone tier the Planner chart's bottom day labels print on top of each other when the plan's first day is short. `dayLabelFor` returns the full date unconditionally for `!wide`, so a first day worth 1 hour still gets a 96.66px label in a 16px column. Re-measured at HEAD of this branch against the built bundle in Chromium and WebKit: the first label runs 80.66px (Chromium) / 80.65px (WebKit) over the second. `.sr-plan-daylabel` and `.sr-plan-axisday` are byte-identical to the 1.0.29 commit `82128f4`, so this is pre-existing, not introduced by this bundle.

## Steps to reproduce

1. Serve `frontend/dist` with `/weather/plan` answered by the fixture's `reference` family, with `window.axisStartTs` moved to `days[1].startTs - 3600` (a plan fetched 11:00 PM local). This pins the trigger to the plan, not the wall clock — `composePlan` trusts `axisStartTs`.
2. Open the plan at a 390px viewport (Plan → Plan weather and tide for a place → 36.603 / -121.876 → See all upcoming weather and tide data).
3. Read the ink rects of the first two `.sr-plan-daylabel` spans, canvas-relative: "Sat, Sep 12, 2026" spans x 45 → 141.66; "Sun, Sep 13, 2026" begins at x 61.
4. Overlap is `label width − 16 × first-day hours`, linear and reproducible: 80.66px at 1h, 64.66 at 2h, 48.66 at 3h, 32.66 at 4h, 16.66 at 5h, 8.66 at 5.5h, 0.66 at 6h, 0.00 at 6.5h.

## Expected behavior

Each day label stays inside its own day column and never prints over its neighbour, at every phone width and both in-app text scales. Where a day is too narrow to carry a readable label, the label shortens or is dropped — the wide tier's existing behaviour — rather than being clipped to an unreadable stub. Hour ticks, the midnight hairlines and the wide tier's axis lane are unchanged. The day-by-day list below the chart continues to carry every date in full.

## Blast radius

- `.sr-plan-axisday` and `dayLabelFor` are shared by BOTH tiers — `AxisLane` renders the day div whether or not `wide`, so a stylesheet or component change there reaches the wide tier's axis lane too.
- The phone day div has **no width**: the component sets only `left`, every child is absolutely positioned, so it shrink-to-fits to 0px (measured 0 at 320/360/390/414/430/640). Any clip needs a width first.
- Label text comes from `formatDate(date, { withWeekday: true })`, so the day-first and ISO date preferences produce different widths; the fix must not hardcode 96.66px, which is a system-font-stack measurement this machine happens to produce.
- The 25-hour DST day (`dst-fall` fixture) must keep working — derive any column width from the document's own day boundaries, as `DayHeaderLane` already does.
- No `docs/HELP.md`, `README.md` or `website/` change: no user-facing copy or stated behaviour moves (grepped — none of them mentions day labels).

## What done looks like

Adjacent `.sr-plan-daylabel` ink rects have zero visible overlap across the phone band and at 100% and 200% text scale, in both engines, swept over first-day widths from 1h to a full day with the sweep declaring its denominator. No day label is reduced to an unreadable fragment, and the hour ticks stay unclipped (21/21 today). The wide tier's readings are unchanged. The claim lives in `website/tools/verify/`, not the unit suite, with a guard-the-guard leg that reproduces the overlap against the pre-fix build.

---

## The four questions this run was asked to settle

**When it appears, and when it stops.** Overlap begins as soon as the first day is narrower than the label — under 6.04 hours, i.e. a plan fetched after about **5:57 PM local**, not "late in the evening". It grows linearly to 80.66px at 11:00 PM and stops at 6.04h. It is **independent of viewport width** (identical 80.66px at 320, 360, 390, 414, 430 and 640px — the chart is a fixed-px track inside its own scroller) and **independent of text scale** (identical at 100% and 200%, because `.sr-plan-daylabel` is `font-size: 11px` and the root scale 16 → 32px does not reach it; chart text is px by design, D4-09). Both engines agree to 0.01px.

**The wide tier's clip does NOT transfer as-is, and the clip is not what solves the short first day there.** Two different mechanisms are doing two different jobs, and only measurement separates them:
- The short first day is handled by the **density rule**. `dayLabelFor(..., wide=true)` calls `planDayLabel`, which returns `''` below 22px; at a 1h first day the wide tier renders **7 labels for 8 days** — the first is never emitted. The phone branch short-circuits (`if (!wide) return full`) and never consults it.
- The **clip** (`.sr-plan-dayhdr-day { overflow: hidden }`) is load-bearing for a different case: full days at 4px/h. At 700px and 900px the full label sits in a 96px column with 6.70px of raw overlap, and clipping takes visible overlap to 0. At 1200/1440px the columns are 111.89/132.34px and there is nothing to clip.
- Copying `overflow: hidden` onto `.sr-plan-axisday` alone **erases the lane**: with the phone day div at 0px wide, the measured result is **0 of 8 labels with any visible ink**, in both engines. Its missing half is the explicit per-day `width` that `DayHeaderLane` sets and `AxisLane` does not.
- With width and clip both added, overlap does reach 0 — but the first label becomes **11.00px of 96.66px readable** in a 56px column, at 100% and at 200% alike. Roughly one character.
- And the density rule alone is not sufficient either: `planDayLabel`'s full-label threshold is 84px while the measured label is 96.66px, so in that band the full label still overflows its own column — 12.66px at an 84px column, 8.66 at 88, 4.66 at 92, 0.66 at 96, 0 at 100. **The fix needs the density rule applied to the phone tier AND a per-column bound**, which is what the wide tier actually has.

**Clipping at 200% text scale.** Clipping is not an accessibility regression here, and the reason is measured rather than assumed: `.sr-plan-canvas` carries `aria-hidden="true"` and `inert` (so no assistive tech reads these labels at all), the chart label is 11px at both scales, and every date is repeated in the day-list `<h4>` at rem sizes — 11px at 1x and **22px at 2x**, the one that actually tracks the user's setting. So a shortened or absent chart label costs nothing that is not already present, larger and scale-tracking, below the chart. **But clipping to an 11px stub is still the wrong answer** — it reads as a rendering fault rather than a design, and it is the one outcome that is worse than no label. Prefer the wide tier's order: shorten by density first, keep a per-column bound only as the boundary backstop for the 84–96.66px band. Hour ticks survive a clip untouched (none of 21 clipped on the phone, none of 7 on the wide tier).

**Which existing tests touch this, and which would change.**
- `frontend/src/lib/planPhoneRender.golden.html` + `frontend/src/components/planPhoneRender.test.tsx` — the golden holds all eight `<span class="sr-plan-daylabel">` and eight `<div class="sr-plan-axisday" style="left: …px;">`. Its own plan has a 9h first day (144px column), so the label **text** is unchanged under a density rule, but adding an inline `width` to the day div changes the markup and forces a regeneration. **Note for the Orchestrator:** that file's header requires a regeneration to be named in the changelog's pipeline record, and this build is under instruction not to touch `CHANGELOG.md` — the bundle's single version bump at the end is where that record belongs.
- `frontend/src/lib/planChartGeometry.test.ts:105–110` — the `planDayLabel` boundary sweep (84 / 44 / 22). Unchanged if the phone tier merely starts calling the function; it changes if a threshold moves, and it is where a new phone-tier row belongs.
- `frontend/src/lib/planCss.test.ts` — no `.sr-plan-daylabel` row today, but two guards constrain any new CSS: no `.sr-plan-*` rule may carry a positive `min-width`, and phone-tier rules must sit inside the FIRST `@media (max-width: 640px)` block.
- `frontend/src/lib/entryChunk.test.ts:638–652` — `lib/planChartGeometry.ts` must stay on the entry chunk with a closure of exactly two files and zero externals; a new import there turns it red.
- `website/tools/verify/verify-plan-readout.mjs` — reads `.sr-plan-chartbox` height only; unaffected unless lane heights change.

## Where the fix belongs, and where its guard belongs

The label **form** is a density decision and belongs in `lib/planChartGeometry.ts`, where `planDayLabel` already lives and is swept at its boundaries; the phone tier's short-circuit in `dayLabelFor` (`PlanChart.tsx`) is what bypasses it. The per-column **bound** needs a component change too — `AxisLane` must compute each day's width the way `DayHeaderLane` already does — so this is not a stylesheet-only fix, and `.sr-plan-axisday` is shared by both tiers.

The guard belongs in `website/tools/verify/`, which is the live ROADMAP promotion item, not a hypothetical. Nothing in the unit suite can reach a geometric claim: jsdom lays nothing out, `planCss.test.ts` is declaration-only and says so in its own header, and the golden pins markup rather than geometry. One trap the harness must avoid, found the hard way in this run: **`Range.getClientRects()` is blind to an ancestor's overflow clip.** A first pass using raw ink reported the clip as doing nothing (80.66px overlap with the clip live) and would have certified the shipped wide tier as overlapping by 6.70px when it visibly does not. Intersect every ink rect with each clipping ancestor's content box, or the probe measures text that is not on screen. Run the harness through `npm run verify --prefix website/tools`, never standalone — the runner's per-harness budget is part of it (v1.0.30).
