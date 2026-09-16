# Decisions — plan-daylabel-overlap

Fix lane, Stage 2 (The Engineer). Every number here was measured on a built
bundle in Chromium and WebKit; nothing is inferred from the source. Figures are
identical in both engines unless stated.

---

## D1. The density ladder now runs on BOTH tiers, and its thresholds did NOT move

`dayLabelFor` short-circuited with `if (!wide) return full`, so the phone tier
never consulted `planDayLabel` at all. That short-circuit is the defect. It is
gone: both tiers compute the same `dayW` (the day's visible span, gutter-clamped
on the first day and axis-clamped on the last) and take the same ladder.

The 84 / 44 / 22 thresholds are unchanged and
`planChartGeometry.test.ts:105–110` is untouched. See D7 for the measured reason
that moving them, or moving what is measured against them, is wrong.

## D2. The per-column bound is DERIVED, and truncation is PLAIN CLIPPING

**This decision was rewritten after QA. Its first version called an ellipsised
label an "acceptable residual"; that reading was wrong and is retired.**

The label is placed at `PLAN_DAY_LABEL_INSET_PX` (5) from its column's left edge
and capped at `availW = dayW - inset`, so its right edge lands exactly on its own
column's right edge, which is the next day's left edge:

```
label right = max(x(start), gutter) + inset + (dayW - inset) = column right
```

96.66px appears nowhere in the fix. The bound is arithmetic on the document's own
day boundaries, so it holds at any date format, any font, and on the 25-hour DST
day.

**What happens when a form is wider than its bound: it is plain-clipped, never
ellipsised.** The ladder is one threshold per form while each form spans a
*range* of widths, so a form admitted at its threshold can be slightly wider
than its room. Measured, both engines:

| Form | narrowest | widest | threshold |
|---|---|---|---|
| weekday | 14.28 `Fri` | **24.08** `Wed` | 22 |
| short | 22.78 `Fri 1` | **41.69** `Wed 30` | 44 |
| full | 81.06 `Fri, Jul 1, 2026` | **105.89** `Wed, May 28, 2026` | 84 |

So only the *short* threshold actually bounds its form. A `Wed` at a 22px column
gets 17px and loses its last letter; the full label at an 84px column keeps
81.7% of its ink (worst clip measured 17.66px off `Sat, Sep 12, 2026`). Both are
exactly what the wide tier has shipped since 1.0.29, and matching it is the
point — see D3.

## D3. No ellipsis, deliberately — it is what made the phone tier worse

The first version of this fix added `text-overflow: ellipsis`, reasoning that an
ellipsis reads as a design and a hard chop reads as a fault. That is true of a
long date and **false of a three-character weekday**, which is the case that
matters: the ellipsis glyph costs most of the budget, so the same 17px that
plain-clips `Sat` to a legible `Sa` renders `S...`, and in Chromium the ellipsis
is itself clipped and paints two dots. QA screenshotted `Wed` → `W..` and
`Wed 28` → `Wed …` from the built bundle.

The geometry is identical either way. The ellipsis was the entire defect, so it
is gone and `.sr-plan-daylabel` plain-clips, exactly as
`.sr-plan-dayhdr-day { overflow: hidden }` has always done on the wide tier.
One truncation behaviour across both tiers, which is the whole point of putting
both tiers on one ladder.

The vertical clip is arithmetic, not a re-tuned line-height: `overflow: hidden`
clips at the *padding* box, so the rule is `bottom: 4px; padding: 3px 0` in place
of the shipped `bottom: 7px`. `4 + 3 = 7`, so the content box and every glyph sit
exactly where they always have, while the clip edge moves 3px clear of the text.
Horizontal padding stays 0, so `max-width` bounds the same edge under either
`box-sizing`. Worst vertical clip measured: 0.00px.

## D4. The UI-rule tension, resolved rather than sidestepped

`.claude/rules/ui.md` says responsive layout is lifted to classes, never inline
styles. This fix adds two inline values: a `width` on each `.sr-plan-axisday` and
a `max-width` on each `.sr-plan-daylabel`.

The rule governs **responsive** layout — decisions that follow from the
*viewport*, which belong in classes because a class is how a viewport-driven
decision is expressed. A day column's width follows from the plan **document**
and the tier's pixels per hour, not from the viewport: the original overlap
measured *identical* at 320, 360, 390, 414, 430 and 640px, because the chart is a
fixed-px track inside its own scroller. No breakpoint can reach "this column is
84px wide because the user fetched the plan at 6:45 PM".

The precedent in this component agrees: `DayHeaderLane` has always set inline
`left` and `width` from the geometry, and every child of the canvas is positioned
inline by the same `x(t)` the chart's numeric axis uses. `AxisLane` was the
outlier in *lacking* a width, which is why it had nothing to bound a label
against.

So: **the mechanism lives in the class, only the measure is inline.**
`position`, `overflow`, the font and the inset geometry are in `globals.css`;
the two numbers that vary per day are inline. Nothing was weakened —
`planCss.test.ts`'s "no `.sr-plan-*` rule carries a positive `min-width`" is
untouched (this adds `max-width`), and no new phone-tier rule went into a 640px
block because `.sr-plan-daylabel` is phone-only by construction.

## D5. The wide tier is unchanged, on its own measurement

`dayLabelFor`, `planDayLabel` and `.sr-plan-axisday` are all shared, so this is
not an assertion carried over from the first round — it is two independent
measurements against the pre-fix build, both in both engines:

1. **A/B fingerprint:** `WIDE TIER UNCHANGED across 64 readings` (day-header
   labels and their ink rects, header columns, hour ticks, canvas width) — 4
   first-day widths x 4 widths (700/900/1200/1440) x 2 text scales x 2 engines.
2. **Band probe:** at all nine columns sampled inside the three bands where a
   change was even possible, the `before` and `after` renderings are character
   for character and pixel for pixel identical.

The single wide-tier difference is deliberate and is reported rather than
hidden: `.sr-plan-axisday` goes from width 0 to its real width (76/96px at
900px). It is inert there — no clip, no background, no border, every child still
absolutely positioned, and that lane renders no label on the wide tier.

## D6. `planChartGeometry.ts` stays a two-file, zero-external closure

`entryChunk.test.ts:638–652` requires it. Only an exported `const` was added; no
import. Verified green.

## D7. Option A — feeding the ladder `dayW - inset` — was MEASURED AND REJECTED

**This is the most useful thing this round produced, because it is the obvious
one-line fix and it is wrong.**

The ladder is asked about the *column*; the label is bounded to the *column
minus the inset*. Those disagree by exactly the inset, so the bottom 5px of every
band admits a form the bound then shrinks. The natural repair is to feed the
ladder `dayW - inset` so the two agree. It was implemented, built and measured.
It corrects one band and regresses two.

Wide tier, 700px box at the 4px/h floor, identical in both engines:

| Band | dayW | Before | Did it fit? | Option A |
|---|---|---|---|---|
| `[22,27)` | 22 | `Sat` in 17.00px, needs 18.14 | chopped | *(no label)* |
| `[22,27)` | 24 | `Sat` in 19.00px, needs 18.14 | **fits** | *(no label)* |
| `[22,27)` | 26 | `Sat` in 21.00px, needs 18.14 | **fits** | *(no label)* |
| `[44,49)` | 44 | `Sat 12` in 39.00px, needs 33.64 | **fits** | `Sat` |
| `[44,49)` | 46 | `Sat 12` in 41.00px, needs 33.64 | **fits** | `Sat` |
| `[44,49)` | 48 | `Sat 12` in 43.00px, needs 33.64 | **fits** | `Sat` |
| `[84,89)` | 84 | full date in 79.00px, needs 96.66 | chopped | `Sat 12` fits |
| `[84,89)` | 86 | full date in 81.00px, needs 96.66 | chopped | `Sat 12` fits |
| `[84,89)` | 88 | full date in 83.00px, needs 96.66 | chopped | `Sat 12` fits |

Only `[84,89)` is a correction. In the other two bands Option A **drops or
demotes labels that measurably fit** — at a 44px column `Sat 12` needs 33.64px
and has 39px, and losing the day number there buys nothing.

**The root cause is why no threshold shift can win.** Each form spans a width
range (weekday 14.28 to 24.08, a 1.7x spread), so a single threshold is either
too low and chops the wide instances, or too high and drops the narrow ones.
Option A trades the first failure for the second. The only exact fix is to
choose the form from the *actual string's* measured width, which was considered
and rejected: it needs `measureText` or a DOM probe, both of which return 0 in
jsdom, so `planPhoneRender.golden.html` would pin a fallback path and the shipped
path would have no unit coverage at all.

So the ladder keeps the column, the disagreement stays, and it is bounded by
plain clipping that matches the wide tier. **The cost, stated:** in the bottom
5px of each band a form is clipped by up to the inset — worst measured 17.66px
off a full date, retaining 81.7% of its ink.

## D8. The legibility assertion: what it can and cannot claim

QA established that the sweep structurally could not see this defect class —
`formOf` classifies by shape, so an ellipsised `W..` is still spelled `Sat` in
the DOM and counted as a valid weekday form, and `PHONE_HOURS` stepped `dayW`
16 → 32 straight over the whole `[22, 29.08)` band.

Both halves are closed. A 27-step **band sweep** now walks each threshold from
*below* it (18, 20, 21, 22, …), and `judge` carries a legibility check.

**"The chosen form always fits its bound" is NOT the invariant and asserting it
would be false** — D2's table shows a form admitted at its threshold can be
wider than its room by design. What must hold is that **the bound is never
tighter than the ladder's own promise**: a form admitted at a T px column is left
at least `T - inset`. That is structural, font-independent, and therefore safe on
CI's Linux font stack — a percentage-of-ink floor would have passed here and
failed there, which is the v1.0.30 rule.

Three things had to be proven red, and were:

- **The original coherence defect** (ladder on `dayW`, bound on `dayW - inset`):
  9 failing legs, exit 1, both engines, in all three sweeps — e.g.
  `"Sat" is the weekday form, ... but its column leaves it only 17.00px`, and on
  the wide tier `... only 18.88px`.
- **The ellipsis regression**, which is not an overlap signal at all and needs
  its own leg: forcing `text-overflow: ellipsis` yields
  `"Sat" has text-overflow ellipsis -- the phone tier must plain-clip`.
- **The legibility invariant itself.** Its current structural form would *pass*
  on the original build, so it needed its own mutation: starving the bound to
  12px yields `"Sat 12" is the short form, admitted at a 44px column, but it was
  left only 12.00px -- below the 39px that column guarantees after the inset`.

## D9. The harness's gate budget

Measured **130s** on the dev Mac (51 cold app loads per engine). The budget in
`run.mjs` is **600s, 4.6x** — deliberately not a number sized just above the
observation, which is what killed `verify-plan-readout.mjs` at exactly 180s on
the 1.0.30 tag commit when its 113s was only 1.6x inside the default. That
harness now carries 5.3x; a shared CI runner is materially slower than this
machine, so a sibling of comparable weight takes the same 600s.

---

## Method findings worth recording

**A geometric sweep that does not assert its stylesheet is live can pass over a
destroyed stylesheet.** A malformed CSS comment in this build swallowed the whole
`.sr-plan-daylabel` rule. The label lost `position: absolute` and
`white-space: nowrap`, wrapped inside its own column — and **all 168
configurations stayed green**, because wrapped text does not overlap its
neighbour either. All 82 scoped unit tests passed over it too. Only the
`--expect-broken` leg caught it. The sweep now reads the declarations it depends
on off each element and counts line boxes.

**A harness's reference point must not be derived from DOM the fix introduces.**
The ladder check first derived column widths from `.sr-plan-axisday` — the div
this fix gives a width to. Against the pre-fix build every column read 0 and the
probe reported the *shipped, correct* wide tier as broken: a confident false
failure against correct code. Column geometry now comes from the **midnight
hairlines**, present unchanged on both tiers and both builds.

**A non-vacuity assertion must be satisfiable by the sweep that carries it.** The
band sweep asserted that some configuration drops a label while sampling only at
and above the thresholds, so `0 dropped` was reported as a failure against a
perfectly good build. Fixed by sampling below the weekday threshold, which also
buys coverage of the drop boundary.

**The `Range.getClientRects()` trap is guarded from both sides.** Ink rects are
intersected with each clipping ancestor's content box; the walk starts at the
element itself and **stops at the scrollport**, because counting
`.sr-plan-scroller` as a clip would silently answer "is this on screen" instead
of "do these overlap". The `--expect-broken` legs pin it both ways: the wide
tier's shipped clip must read clean on hostile text, and the same text with the
clip removed must read as overlapping.

**Mutations are font-independent**, per the v1.0.30 rule: each replaces every
label with a 40-character run first, so the signal is 312–361px under any font
stack rather than the ~17px a particular system stack gives.

---

## Deferred to the bundle, deliberately — NOT an omission

`planPhoneRender.golden.html` **was regenerated** (its diff is exactly the inline
`width` and `max-width` attributes on all eight days; no label text changed,
because that plan's first day is 9 hours and 144px still takes the full label).
It did **not** need regenerating again after the QA rework, and the golden test
passing unchanged is the evidence.

That file's header requires a regeneration to be **named in the changelog's
pipeline record**, and this build is under instruction not to touch
`CHANGELOG.md`, `frontend/package.json`, `src-tauri/tauri.conf.json` or
`website/index.html`. **The changelog wording is in `pr-description.md`** for the
bundle's single bump to pick up. This paragraph exists so the missing record
entry is read as deferred rather than forgotten.

No `docs/HELP.md`, `README.md` or `website/` change is owed: the brief grepped
all three and none mentions day labels.

## The walkthrough's durable half is the preview script, not `how-to-see.md`

`pipeline/.gitignore` carries `*/how-to-see.md`, so this run's walkthrough never
reaches the repo while `decisions.md` and `pr-description.md` do. A tracked file
pointing at an untracked one is a dangling reference — the same family as the
v1.0.12 rule that a guard test never reads a gitignored per-run file. So
`pipeline/plan-daylabel-overlap/preview-daylabels.mjs` is committed and
reproduces the short-first-day case at any hour on a fixed port, and
`pr-description.md` carries its invocation and the measured label table inline
rather than by reference.
