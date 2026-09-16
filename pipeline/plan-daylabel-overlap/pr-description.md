## Planner day labels stay inside their own day column

### What this does

At the phone tier the Planner chart's bottom day labels printed on top of each
other whenever the plan's first day was short — a plan fetched after about
5:57 PM local. `dayLabelFor` returned the full date unconditionally for the
phone tier, so a first day worth one hour still got a 96.66px label in a 16px
column: **80.66px of overlap** (Chromium) / **80.65px** (WebKit), constant
across the whole phone band and at both in-app text scales.

Three changes, which together give the phone tier the behaviour the wide tier
has always had:

1. **The density ladder now runs on both tiers.** `dayLabelFor`'s
   `if (!wide) return full` short-circuit is gone, so the phone tier shortens
   (`Sat, Sep 12, 2026` → `Sat 12` → `Sat`) or drops a label its column cannot
   carry. The 84 / 44 / 22 thresholds are **unchanged** and
   `planChartGeometry.test.ts:105–110` is untouched.
2. **Each label is bounded to its own column.** `AxisLane` now gives each day
   div the explicit width `DayHeaderLane` has always given its own, and the
   label is placed at a 5px inset and capped at `dayW - 5`, so its right edge
   lands exactly on the next day's left edge.
3. **Truncation is plain clipping, never an ellipsis** — see the reviewer note
   below, because this is the part that changed after QA.

The bound is arithmetic on the document's own day boundaries, so it holds at any
date format, any system font, and on the 25-hour DST day. No measured label
width is hardcoded anywhere.

### How to test

The defect needs a plan whose first day is short, which in the real app means
fetching one after about 5:57 PM local. A committed preview server removes that
wait — it serves the built app and answers the plan request from the test
fixture with the first day set to any width:

```
npm run build --prefix frontend
node pipeline/plan-daylabel-overlap/preview-daylabels.mjs 1      # 1h first day, 16px column
node pipeline/plan-daylabel-overlap/preview-daylabels.mjs 5.25   # the 84px clipping band
```

Open the printed URL, make the window 640px or narrower (the phone tier), then
**Plan** → **Plan weather and tide for a place** → `36.603` / `-121.876` →
**See all upcoming weather and tide data**, and read the row of dates along the
bottom of the chart. `--port N` gives it a fixed port for a tailnet preview.

Measured first-label readings at 390px: nothing at a 16px column, `Sat` at
24–40px, `Sat 12` at 48–80px, the full `Sat, Sep 12, 2026` with its tail
trimmed at 84–92px, and complete from 102px up.

To measure rather than look:

```
npm run verify --prefix website/tools                                    # the whole gate
node website/tools/verify/verify-plan-daylabels.mjs frontend/dist        # just this one
node website/tools/verify/verify-plan-daylabels.mjs frontend/dist --expect-broken
```

The harness sweeps 14 first-day widths x 6 phone widths x 2 text scales, a
27-step band sweep across the ladder's own thresholds, and the wide tier, in
both engines against the built bundle: **168/168 phone, 108/108 band and 80/80
wide configurations measured per engine, `ALL CHECKS PASSED`**, worst adjacent
gap 5.00px of *clearance*, about 130 seconds. Against the pre-fix build it is
red, reproducing the brief's numbers to the hundredth.

Run through the gate as CI runs it rather than standalone (the runner and its
per-harness budget are part of the harness):
`verification gate: 7/7 harnesses green`, 290s end to end.

### Notes for reviewer

**The obvious one-line fix is wrong, and this is the thing worth reading.** The
ladder is asked about the column while the label is bounded to the column minus
the inset, so those disagree by 5px and the bottom of every band admits a form
the bound then shrinks. Feeding the ladder `dayW - inset` makes them agree — and
it was implemented, built, and measured to **correct one band and regress two**:

| Band | dayW | Before | Did it fit? | With `dayW - inset` |
|---|---|---|---|---|
| `[22,27)` | 24, 26 | `Sat` in 19/21px, needs 18.14 | **fits** | *(no label)* |
| `[44,49)` | 44–48 | `Sat 12` in 39–43px, needs 33.64 | **fits** | `Sat` |
| `[84,89)` | 84–88 | full date in 79–83px, needs 96.66 | chopped | `Sat 12` fits |

It drops or demotes labels that measurably fit. The cause is that each form
spans a width *range* — the weekday abbreviations run 14.28 (`Fri`) to 24.08
(`Wed`), a 1.7x spread — so a single threshold either chops the wide instances
or drops the narrow ones. Choosing from the actual string's measured width would
be exact but needs `measureText` or a DOM probe, both of which return 0 in
jsdom, which would leave `planPhoneRender.golden.html` pinning a fallback path
and the shipped path with no unit coverage. Full reasoning and the measurement
in `decisions.md` D7.

**QA's `W..` was never the geometry — it was the ellipsis.** The first version of
this fix added `text-overflow: ellipsis`, which reads well on a long date and is
a fault on a three-character weekday: the glyph costs most of the budget, so the
same 17px that plain-clips `Sat` to a legible `Sa` renders `S...`, and Chromium
clips the ellipsis itself into two dots. Removing it makes the phone tier behave
exactly as `.sr-plan-dayhdr-day { overflow: hidden }` always has. Worst clip
measured: 17.66px off a full date, retaining 81.7% of its ink.

**The wide tier is unchanged, measured two independent ways** — `dayLabelFor`,
`planDayLabel` and `.sr-plan-axisday` are all shared, so this is not an
assertion. An A/B fingerprint against the pre-fix build reports `WIDE TIER
UNCHANGED across 64 readings` (labels and their ink rects, header columns, hour
ticks, canvas width), and a separate probe of the three narrow bands finds the
before and after renderings identical at all nine sampled columns, in both
engines. The one wide-tier difference is deliberate and inert:
`.sr-plan-axisday` gains a width in a lane that renders no label on that tier.

**The legibility assertion, and what it can honestly claim.** QA established the
sweep structurally could not see this defect class: `formOf` classifies by shape,
so an ellipsised `W..` is still spelled `Sat` in the DOM, and `PHONE_HOURS`
stepped `dayW` 16 → 32 straight over the `[22, 29.08)` band. Both halves are
closed — a 27-step band sweep now walks each threshold from *below*, and `judge`
asserts the bound is never tighter than the ladder's promise (a form admitted at
a T px column is left at least `T - inset`). "The chosen form always fits" is
deliberately **not** asserted, because it is false by design. Three separate
mutations were each proven red before being trusted: the original coherence
defect (9 failing legs, exit 1, both engines), forcing the ellipsis back, and
starving the bound past the ladder's promise.

**Two harness defects were caught before any green reading was trusted**, both
in `decisions.md`: the sweep passed 168/168 over a build whose
`.sr-plan-daylabel` rule had been swallowed by a malformed CSS comment (wrapped
labels do not overlap either, and all 82 unit tests passed too), and the ladder
check originally derived column widths from the very div this fix gives a width
to, producing a confident false failure against the *correct* shipped wide tier.

**Gate budget.** The harness measures 130s and is given **600s (4.6x)** in
`run.mjs`, not a bound sized just above the observation — that is what killed
`verify-plan-readout.mjs` at exactly 180s on the 1.0.30 tag commit when its 113s
was only 1.6x inside the default.

**Golden regenerated once.** `planPhoneRender.golden.html`'s diff is exactly the
inline `width` and `max-width` attributes on all eight days; no label text
changed. It did not need regenerating again after the QA rework, and the golden
test passing unchanged is the evidence.

---

### For the bundle's version bump — changelog wording

This build does not touch `CHANGELOG.md`, `frontend/package.json`,
`src-tauri/tauri.conf.json` or `website/index.html`. The bundle's single bump
should carry:

> **Fixed:** In the Weather/tide Planner on a phone, a plan fetched in the
> evening printed its first two day labels on top of each other. Each day label
> now shortens, or steps aside, to stay inside its own day column, matching the
> wide layout's long-standing behaviour.
>
> Pipeline record: `frontend/src/lib/planPhoneRender.golden.html` was
> regenerated for `plan-daylabel-overlap` (each `.sr-plan-axisday` gains an
> inline `width` and each `.sr-plan-daylabel` an inline `max-width`; no label
> text changed). A real-engine guard,
> `website/tools/verify/verify-plan-daylabels.mjs`, joins the verification gate
> with a 600s budget in `run.mjs`.
