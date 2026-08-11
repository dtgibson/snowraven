# Freezable Label Rows

### What this does

Gives the **Multimedia** tab the same opt-in **Pin column labels** control the
Breeding Codes tab has, and repairs the header pin underneath it, which has very
likely never worked in the macOS app or on iOS.

Two parts:

1. **Multimedia gains the control, and the mechanism is repaired.** The header
   sticky shipped on the `<tr>` from v0.0.29. WKWebView honors `position: sticky`
   on cells only, and SnowRaven ships in WKWebView on macOS and iOS, so that pin
   was alive in Chromium (web, Windows WebView2) and dead everywhere else. It
   moves to a `<th>`-level rule in `globals.css` and gains the two guards an
   inline style could never carry: the `.sr-ios-app` safe-area inset and
   `scroll-margin-top` on the focus targets. On top of that it is now driven by an
   opt-in pill: default OFF, session-only, offered in Unbounded, with `pinned
   implies Unbounded` and the same pinned-state note.
2. **Breeding Codes pins the code header row only.** The two-axis reshape from the
   previous revision is reverted, the pill is named **Pin code labels** again, and
   the published prose is back to describing one freeze.

### Why it changed shape

Both parts reverse a decision made earlier in this build, after the user previewed
the bundle on a device. Their words:

> For the pin labels, I wanted to pin only the row with the breeding codes, not
> the bird labels. I also want the multimedia page to have the same pin labels
> option as the breeding codes.

The previous revision had (a) made the Breeding Codes pin freeze *both* label axes
and renamed the pill to "Pin labels" to match, and (b) repaired Multimedia's
mechanism but deliberately left it always-on in Unbounded with no pill. Both are
undone here. The reasoning behind them is preserved in `design-refinement.md`,
which now carries a header marking it superseded.

### The cost, named

**Chromium users lose an automatic behavior.** On web and Windows, Multimedia's
header band came on by itself whenever you pressed **↔ Unbounded**. It now waits
for a button press. That is a real regression for that group, and it is exactly
the objection the design pass raised when it declined the pill.

It is the trade the user chose, with eyes open: parity of the *control* across the
two tabs, rather than one tab having a pin button and the other pinning silently.
WKWebView users (the macOS app, iOS) gain a working pin they have never had, and
the button is one press from the old behavior.

### How to test

See `how-to-see.md` beside this file for the click-by-click walkthrough. In short:
Multimedia tab → note there are now **two** buttons beside the count → press
**↔ Unbounded** alone and confirm the headings *do* scroll away → press **Pin
column labels** and confirm they hold. Then Breeding Codes → press **Pin code
labels** → scroll down and sideways, and confirm the code headings hold while the
bird names travel with the matrix.

### Notes for reviewer

- **The Breeding Codes revert was done as a diff against `d8d4a56^`, not by
  rewriting.** `BreedingCodeTable.tsx` is byte-identical to the pre-build revision
  apart from one added comment recording why the pin is one-axis, so nobody
  re-derives the reshape. `leftFreeze` is gone; both freeze sites are back to
  their `wideMode ? {} : {…}` ternaries, and the corner's inline `zIndex: 4` (which
  existed only to out-layer the band it was sticky within) is gone with it.
- **The two surfaces share one state machine, not two copies.** `lib/pinnedLabels.ts`
  (`nextPinnedState` / `nextViewState`) is pure, is used by both tabs, and carries
  the `announce` flag so they cannot drift on when the live region speaks. This is
  the `nextShadingState` pattern the repo already uses for a two-surface coupled
  toggle: an explicit pure transition, never a `useEffect` mirror. The invariant
  (`pinned` is never true while `wideMode` is false) is proved there once, including
  over 400-step random walks, so neither component test has to re-prove it.
- **The pinned-note classes were renamed to `.sr-pinstatus` / `.sr-pinnote`.** They
  are rendered on both tabs now, and a `.sr-bc-*` (breeding codes) class on the
  Multimedia tab would be a name that lies. Purely cosmetic rules; no value changed.
- **Multimedia's `<tr>` keeps its inline fill and hairline in every UNPINNED path,
  including Unbounded.** Only the pinned path moves them onto the `<th>`, because a
  sticky cell travels while its `<tr>` stays in flow. The unpinned-Unbounded case is
  the one Chromium users now land in by default, so it is covered by its own test
  rather than folded into the Normal case.
- **Multimedia still gets no frozen name column**, and that part of the design
  stands: its name column is 238px at 1x and 423px at 200% on a 320px viewport
  (`minWidth: 200`, no viewport clamp), so freezing it would leave nothing for the
  data. Giving that column a viewport clamp remains a real follow-up idea and is out
  of scope.
- **`design-refinement.md` is now partly superseded** and says so at the top. Its
  "do not add a pin pill to Multimedia" and the two-axis reshape are both reversed;
  everything else in it (the measurements, the Half A decline, the CSS block, the
  `.sr-touch-target` parity item) still describes what ships. It is left otherwise
  intact as the record of what was decided and why, the same treatment dated
  retrospectives get in `DECISIONS.md`.
- Docs updated in the same change per the standing rule: `docs/HELP.md`,
  `README.md`, `website/index.html`. The Breeding Codes prose is byte-identical to
  the pre-build text on all three **except** the "in the normal view" scoping fix,
  which corrects a claim that was false before this build ever started (the page
  said the species-name column stays frozen on a phone in *both* views;
  `leftFreeze = !wideMode` says Normal only, and no CSS supplies it either). Both
  tabs' pin prose uses the settled house phrasing "per-session, resetting on
  relaunch".
- **`CLAUDE.md` was reverted to its pre-build text and then extended**, rather than
  edited in place, so no sentence still describes the reshape. The new material is
  two bullets: the pinned-label pattern as one shared thing across two tables (the
  state machine, the `<th>`-level sticky, the stylesheet-not-inline rule, the
  four-selector focus guard), and both reversals recorded so they are not
  re-derived. `ROADMAP.md` and `PRODUCT_CONTEXT.md` were deliberately left alone:
  they are dated release retrospectives and "Pin code labels" is what v0.5.81
  actually shipped.
- No version bump, changelog entry, or tag: this is one build of a bundled Spool
  release, versioned once at the end.

### Verification run

- `npx vitest run` — 151 files, 2006 tests, all passing.
- `npm run build` (`tsc -b && vite build`) — clean.
- `npx eslint src --max-warnings=0` — clean.
- `grep -rn '—'` over `docs/HELP.md`, `README.md`, `website/index.html`,
  `PRIVACY_POLICY.md`, `ACCESSIBILITY.md` — clean (the only hits anywhere are code
  comments, which are out of scope).
- Every new guard was proved to **fail** against the implementation it rejects:
  the two-axis reshape restored (4 failures), Multimedia's always-on pin restored
  (2 failures), and three separate mutations of the shared state machine (2, 1 and
  1 failures).

**Browser measurement** (Chromium 151 via Playwright, the synthetic demo dataset
under `SR_DATA_DIR`, never a real export; 320x568, light and dark, 1x and 200%
in-app text scale). Element measured against its container, never page
`scrollWidth` alone:

- **The control cluster fits: 0px overflow in all 16 measured states.** Before/after
  on the same nodes: adding the third control took the cluster from 173.55px to
  272px inside a 272px content box at 1x, and **page `scrollWidth` is unchanged**
  (320 / 623 / 948 on both revisions). The pill measures 132.7px at 1x and 208.9px
  at 200%; at 200% the two buttons wrap onto separate lines. The cost is vertical
  (cluster height 44 → 70px at 1x, 132 → 226px at 200%), absorbed by the wrapping
  row. Screenshots confirm no clipping at either scale.
- The design pass had predicted this fit at 276.38px in a 288px box. **Re-measured
  rather than trusted**, with the control as actually built: the container is 272px
  rather than 288px and the cluster wraps instead of fitting on one line, so the
  numbers differ while the verdict holds.
- **`.sr-wrap-flex` is not inert here** (v0.5.82): squeezing the cluster's row to
  200px takes the cluster from 272px to 200px, so it genuinely responds. The new
  inner `role="group"` carries no `flexShrink: 0`, so it needs no width cap of its
  own; the outer cluster keeps the v0.5.82 `maxWidth: '100%'` pairing, and
  `CountClusterWrap.test.tsx` still passes unchanged.
- **Pinned, the band holds at y=0** after scrolling 400px past the header's static
  position, in all four theme/scale combinations, with an opaque fill
  (`rgb(249,250,251)` light, `rgb(9,9,11)` dark) and `elementFromPoint` inside the
  band returning a header cell, not a body row.
- **Unpinned in Unbounded, the band does not hold**: the header sits at exactly its
  static position (−400px), which is the reversal working rather than a broken pin.
- **Focus guard read off the focusable, not the cell** (the v0.5.81 rule):
  `scroll-margin-top` computes 48px at 1x and 96px at 200% on the `<button>` inside
  the row header.
- One methodology note worth keeping: the first probe scrolled a fixed 600px and
  reported the band as broken. It was not. At that scroll the header was still
  240px down the page, so sticky had nothing to do. Scrolling relative to the
  element's own document position is what makes the measurement mean anything.

### Known limitation, not covered by any test

The band clearing the Dynamic Island is gated on `.sr-ios-app`, which desktop and
web never carry, so it is unobservable outside an iOS build. It needs a look on
device. jsdom has no layout engine and no cascade against inline styles, so no unit
test can settle it, and none pretends to.
