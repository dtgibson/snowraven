## What We Accomplished

Completed the v0.5.69 phone code-column narrowing on the **Breeding Codes
matrix** so it also takes effect in the **"↔ Unbounded" (wideMode)** view
(v0.5.70, frontend-only). Previously only the Normal view narrowed to ~30px
dot-width columns at the phone tier; Unbounded stayed full-width — the mode you
actually use for scanning codes. This run made the narrowing hold in both views
AND removed the ~1200px of trailing whitespace that sat beside the ~540px
Unbounded table. Phone-tier (≤640) only; desktop Unbounded is intentionally
unchanged, and Normal mode is unchanged in both tiers.

Two class contracts carry the fix: `.sr-bc-matrix` on the `<table>` (base
`width:100%; min-width:max-content`; `@≤640` `table-layout:fixed;
width:max-content; min-width:0`) makes the declared `.sr-bc-code-col` widths
*authoritative* in both modes, and `.sr-bc-card` on the wideMode card (base
`max-content`; `@≤640` `min-content`) hugs the fixed-width table so there is no
trailing whitespace. It settled over **3 Engineer rounds**, TWO of which caught
layout-only bugs the test suite can't see: `table-layout:fixed` with an inline
`width:100%` inside a `max-content` container ran the table away to the
browser's ~500,000px element-width cap, and a `max-content` card sized to the
columns' *intrinsic* width (huge whitespace) rather than the fixed table's
rendered width. Both were found only in live phone-width preview and are now
recorded as durable CSS lessons.

## What Has Been Saved

- **Shipped and live.** Desktop **v0.5.70** — GitHub release with the notarized
  universal macOS DMG, the signed Windows installer, the updater bundle, and
  `latest.json` (the in-app updater sees it). iOS **0.5.70 build 1** uploaded to
  TestFlight (altool accepted).
- Feature commit `daadb6a` (code + version bump 0.5.69→0.5.70 + CHANGELOG +
  HELP/website) already on `main` and tagged. This closeout adds the records
  commit (CLAUDE.md, DECISIONS.md, ROADMAP.md, design-system.md, the feature's
  pipeline artifacts) plus the iOS 0.5.70 build-1 Info.plist version stamp.
- **The three CSS lessons are recorded in DECISIONS.md and folded into
  CLAUDE.md's existing Breeding-Codes-matrix note** (extended, not duplicated):
  (1) `table-layout:auto` treats a cell width as a floor, not authoritative — a
  wide table grows past it; `table-layout:fixed` binds the declared widths;
  (2) fixed layout needs a *definite* width, never `width:100%` inside a
  `max-content`/shrink-to-fit container (the element-width-cap runaway);
  (3) a `max-content` card over a fixed table sizes to the columns' intrinsic
  width — use `min-content` to hug it. The reusable "Phone wide-table" pattern in
  `pipeline/design-system.md` gained the authoritative-width mechanism.

## Where We Are

Improvement complete and shipped. Pipeline is idle. `PRODUCT_CONTEXT.md` was
correctly left unchanged (the matrix already reads as "reads well on a phone
with dot-width columns" — this run refined *which view*, not what the product
IS). Multimedia's Unbounded columns were verified out of scope (no dot-width
grid to narrow).

The same standing on-device thread carries forward: **confirm native
pinch-to-zoom on the matrix on a real iPhone** — iOS 0.5.70 build 1 is on
TestFlight for exactly this, and now carries both the Normal and Unbounded
narrowing. If pinch disappoints, the Designer's reserved `−/Fit/+` fallback
control (iOS-only, one-line flip) is the escape hatch. That plus the earlier
deferred items (iOS offline maps; the Species Detail embed offline-fallback
backport; the v0.5.68 Calendar mobile layout on a real phone) are on the
roadmap.

## Resume Prompt

Run `/weft` to start the next thing.
