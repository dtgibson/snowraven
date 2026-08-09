## Mobile filter text size

### What this does

On phones (≤640px) the filter rows mixed two text sizes: `.sr-input-16` forced every
`<select>` and date input to a flat 16px for the iOS focus-zoom guard while the pills,
sort toggles and switches wrapping beside them in the same flex row stayed at their
inline `0.75rem`. It also inverted at large text scale, because the root font size is
`calc(100% * var(--sr-text-scale))` but the guard was a flat px value: at 200% the pills
reached 24px and the form controls stayed pinned at 16px, so the controls became the
small ones for exactly the user who enlarged their text.

Both halves are closed by one formula, written once in `globals.css`:

```css
@media (max-width: 640px) {
  .sr-input-16,
  .sr-ctl-row :is(button, select, input) { font-size: max(16px, 0.75rem) !important; }
}
```

`16px` is the iOS focus-zoom threshold, an absolute value, so it stays the floor.
`0.75rem` is the app's control size and tracks `--sr-text-scale`. `max()` of the two puts
both sides on 16px up to ~133% scale and on `0.75rem` above it. They are never different
from each other at any scale, which is the property the old flat `16px` could not have.

`.sr-ctl-row` is a container hook, added to the six filter blocks across the five
surfaces the brief named (LifeList, which serves both Life List and Multimedia;
Checklists; Breeding Codes; Species Detail; Calendar). It sizes interactive descendants
only. A container hook rather than a per-element class because filter-row membership is
conditional (the county select only mounts once counties resolve, the non-bird toggle
only with an eBird backbone), so there is no stable element list to enumerate, and
because the alternative meant threading a className prop through `ToggleSwitch`,
`SegControl` and `SpeciesCombobox`, which are shared with Settings and the map sidebar
and must not change there.

Desktop is untouched. The rule lives inside the ≤640 tier and both sides are already
12px above it.

### How to test

1. `cd frontend && npm run dev`, open `http://localhost:5173`.
2. Narrow the window to about 400px wide (or open the app on a phone), go to
   **Multimedia**, and read across the wrapped filter block. The "Has media" / "Is Target"
   pills, the A-Z / Taxonomic toggle, the three switches, the "Any sex" / "Any age" /
   "All Counties" dropdowns and both date inputs should now all read at the same size.
3. Settings → Text Size → 200%, then back to Multimedia at the same width. Everything in
   that block should still be one size, now larger. Before this change the dropdowns and
   dates stayed small while the pills grew.
4. Repeat on Checklists, Breeding Codes, Species Detail and Calendar.
5. Widen past 640px. Everything returns to the desktop 12px, unchanged.

### Verification, measured rather than estimated

Row counts and overflow were measured in Chromium against the **real built stylesheet**,
using a static reproduction of the Multimedia filter block with the inline styles
transcribed from `LifeList.tsx` inside the App panel wrapper. Before/after differ by
exactly the one shipped rule. This is browser geometry, not arithmetic, but it is a
reproduction rather than the running app: the exact control count depends on the user's
data (county list length, whether an ML export is loaded), so treat the deltas as
representative rather than as their precise numbers.

| viewport / text scale | rows before → after | block height before → after |
|---|---|---|
| 320px @100% | 13 → 13 (+0) | 439px → 439px (+0) |
| 320px @200% | 17 → 17 (+0) | 737px → **711px (−26)** |
| 402px @100% | 9 → 10 (**+1**) | 299px → 335px (**+36**) |
| 402px @200% | 12 → 13 (**+1**) | 505px → 567px (**+62**) |

**The cost is materially lower than the brief estimated.** The brief predicted the
Multimedia block going from about 10 rows to about 12 at 402px and perhaps +3 rows at
320px, and said plainly that was screenshot geometry. Measured, it is **+1 row at 402px**
at both text scales, **+0 rows at 320px** at both, and at 320px/200% the block is
actually **26px shorter** than before, because the wider date inputs repack the tail of
the block onto fewer lines. At 320px the block is already close to one control per row,
so there was little left to lose.

Measured font sizes confirm the fix in both directions: before, 12px pills against 16px
selects at 1x and 24px pills against 16px selects at 200%; after, 16px everywhere at 1x
and 24px everywhere at 200%.

**Pill clipping at 200%, checked as asked: nothing clips.** All 14 fixed-`height: 30`
controls have a line box 6px taller than their box at 200% text scale, identically before
and after (they were already 24px there, so this fix does not touch that axis), and all
of them compute `overflow: visible`, so the text renders in full rather than being cut.
Confirmed by measurement and by eye in the captured screenshots. This remains a
pre-existing tightness at 200%, neither introduced nor worsened here.

**Horizontal overflow:** nothing is introduced or worsened by this change, which is the
claim that matters. Independent Playwright measurement across both revisions found that
Checklists, Breeding Codes, and Calendar each leak at some phone combination, and every
one of those is identical before and after. Two cases move: the pre-existing Life List /
Multimedia leak stays at 3px, and Calendar's pre-existing 27px leak at 320px / 200% grows
to 29.5px, caused by the intended text growth rather than by a layout change. See the
known issue below.

### Notes for reviewer

**What this deliberately does not do.**

- **Map Explorer is untouched.** Its nine form controls have a real iOS focus-zoom
  defect and zero `.sr-input-16`, confirmed by The Evaluator, and adding the guard was
  only safe once this shared rule existed, which it now does. It is a different bug from
  the one reported, Map Explorer shows no size mismatch today because its sidebar is
  internally consistent at 0.75rem, and it is captured as its own queued item. The
  enabling rule is now in place for whoever picks it up.
- **The right-hand count and view cluster is outside `.sr-ctl-row`** on Life List /
  Multimedia and on Breeding Codes. The species count is static text, not a control, and
  the "↔ Unbounded" / "Pin code labels" buttons are view controls rather than filters, so
  they keep their deliberately smaller ghost styling. The consequence is visible and
  worth naming: on a phone that ghost button reads at 11px below filter controls at 16px.
  It reads that way on desktop too (11px against 12px), so it is not the phone-only
  mismatch that was reported.
- **The row is not literally single-size, by design.** The uppercase section labels
  (`rowLabelStyle` on Checklists, `ctrlLabelStyle` on Calendar) are spans and stay
  smaller on purpose. This fix makes the *controls* one size. The container rule cannot
  reach those labels, which is why it targets `button, select, input` rather than every
  descendant.

**One non-obvious change.** Calendar's local `Switch` declared its font size on the label
`<span>` rather than on the `<button>`. A size on a descendant beats any class on an
ancestor, so the container rule could not reach it and the strip's two switch labels
would have stayed small beside everything else in the same strip. The declaration moved
up to the button; the span inherits it, so desktop rendering is byte-identical. This is
invisible in review because both forms look the same outside `.sr-ctl-row`, so there is a
test pinning it.

**The `.sr-input-16` value change reaches four sites outside any filter row** (App's
checklist lookup, three WeatherForecastPanel inputs, the Checklists search box, the
SpeciesCombobox input). They were pinned at 16px and now reach 24px at 200%, which is
closer to their natural size and the same direction of fix. All are `width: 100%` or
`flex: 1` with `min-width: 0`, so none widens; all were measured at 320px/200% for
vertical clipping in their fixed-height boxes (40px, 44px and the tightest at 32px) and
none clips.

**Known issue found while measuring, pre-existing and not fixed here.** At 320px with
200% text scale, Life List / Multimedia leaks 3px of page horizontal scroll
(`documentElement.scrollWidth` 323 against a 320 viewport). The source is the right-hand
cluster: `flexShrink: 0` with a `whiteSpace: nowrap` "↔ Unbounded" button, about 299px
wide in a 272px content box. It measures identically before and after this change, since
that cluster is deliberately outside `.sr-ctl-row`. Breeding Codes' equivalent cluster
does not have it because that one carries `.sr-wrap-flex`. Fixing it means changing the
cluster this fix deliberately leaves alone, so it is reported rather than folded in.

**Tests.** `frontend/src/lib/filterControlSizeCss.test.ts` parses the real `globals.css`,
the same posture as `milestoneContrast` / `countyContrast` / `calendarContrast` /
`breedingCodePinnedCss`. The fix is entirely CSS and every property that matters is
invisible to a jsdom component test: no layout engine, no media queries, no computed
font size, no cascade against React's inline styles.

Each assertion was verified **by mutating the source and observing the failure**, not by
reading it. Eleven mutations, every one caught, no assertion inert.

One correction to how the second row was originally described. Leaving `.sr-input-16`
flat would NOT show in the five filter rows: `.sr-ctl-row :is(...)` is specificity (0,1,1)
and outranks `.sr-input-16` at (0,1,0), so it wins there regardless. That variant was
built and rendered, and it is identical to the shipped fix on all five surfaces. Its real
residue is three guarded inputs that sit outside a filter row, where nothing raises them.
The assertion still earns its place, since that is a genuine defect it catches. It is just
not the visible one it was first described as.

| mutation | caught by |
|---|---|
| pre-fix stylesheet (flat `16px`, no neighbour rule) | sizes both sides / 16px floor / tracks scale / reaches all three tags |
| neighbours raised but `.sr-input-16` left flat (see the note below) | identical value / floor / tracks scale |
| shrink the selects to `0.75rem` instead | 16px floor |
| flat `16px` on both sides | floor / tracks scale |
| `!important` dropped | carries !important |
| rule hoisted out of the ≤640 tier | scopes to the phone tier |
| container itself sized (`.sr-ctl-row { }`) | sizes descendants not the container |
| descendant rule narrowed to `button` | reaches button, select and input |
| a call site missing the class | LifeList wraps its filter controls |
| Calendar `Switch` size back on the label span | declares it on the button |
| root font size no longer scaled | the premise the formula rests on |

**Gates.** `npm run typecheck`, `npm run build`, `npx vitest run` (141 files, 1863 tests,
all passing, up from 1848 by the 15 added here), `npx eslint` on every changed file, and
`weft-design-lint check src` with zero warns or errors (27 advisory notes, all
pre-existing and none on a changed line; this change adds no motion and no colors).

No version bump, changelog entry, or commit: this is build 5 of a bundled Spool release.

### Convention Flags

- A phone-tier size that must satisfy an absolute px floor *and* stay consistent with a
  scale-tracking neighbour is written `max(<px floor>, <rem>)` once, as a single
  declaration covering both sides, never as two rules holding two literals that agree
  today.
- `.sr-ctl-row` joins the shared responsive layout vocabulary in `globals.css`: put it on
  a filter block to give every interactive control inside it one phone-tier text size. It
  sizes descendants only, never the container.
- Put a control's font size on the control element, not on a label span nested inside it,
  or a shared container rule cannot reach it. A size on a descendant beats any class on
  an ancestor, and the two forms are indistinguishable until the container rule exists.
