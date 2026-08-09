## count-cluster-scroll-leak

### What this does

At 320px with 200% in-app text scale, the right-hand count-and-view cluster on the
Multimedia tab and the Breeding Codes tab held its max-content width inside a 272px
row content box and pushed page horizontal scroll. Both clusters now wrap inside
their row instead, so the page stops scrolling sideways. Nothing changes at 640px
or above, on either tab, at any text scale.

Two components, two edits, no shared code:

- `frontend/src/components/LifeList.tsx` (Multimedia) — lifted the inline
  `display` / `alignItems` / `gap` onto `.sr-wrap-flex` and added a `maxWidth: '100%'`
  cap. It had no class at all before.
- `frontend/src/components/BreedingCodeList.tsx` (Breeding Codes) — already carried
  `.sr-wrap-flex` since v0.5.81; added the same `maxWidth: '100%'` cap.

`ROADMAP.md` is corrected in the same change (see below).

### Why the class alone was not the fix

`.sr-wrap-flex` is real, top-level, and unlayered in `globals.css`, and on Breeding
Codes it computed `flex-wrap: wrap` the whole time — while that cluster measured
475.13px inside a 296px box, the single largest unclipped overflower on any tab at
that size. `flexShrink: 0` pins the cluster at max-content even after the parent row
has wrapped it onto its own line, so nothing ever narrows it, and a flex container
that is never narrowed has no reason to break a line. The Evaluator measured a
class-only fix on Multimedia at 71px → 71px, cluster 366.59 → 366.59: literally zero
change. The width cap is what makes the class bind.

### Why `max-width: 100%` rather than dropping `flexShrink: 0`

The Evaluator measured the two variants as identical in effect (cluster 272px, leak
0, count on line 1 and the view button on line 2). I picked the cap because it is the
more conservative of the two: it preserves the cluster's do-not-get-squeezed intent
rather than discarding it, and `max-width: 100%` paired with a shrink constraint is
already the exact pairing `.sr-scroll-x` uses in `globals.css`, so it is a shape this
codebase already reasons about. It is also responsive by construction — no breakpoint
math — which is the sanctioned inline exception in the responsive-layout convention.

The test encodes the *invariant* (given an inline `flexShrink: 0`, a width cap must be
present) rather than pinning this specific variant, so a future switch to the other
measured-equivalent form stays green while a regression to neither does not.

### How to test

See `pipeline/count-cluster-scroll-leak/how-to-see.md` for the click-by-click walkthrough.

### Verification

**Build gate.** `npm run build` (`tsc -b && vite build`) passes. It earned its keep
here: it caught a type error in my own new test that `vitest` and `eslint` were both
green on (`requestedFilter={null}` against `'is-target' | undefined`) — the exact
class of miss the 0.5.35 post-mortem is about.

**Test suite.** Full frontend suite green: 143 files, 1885 tests. `eslint` clean on
all three touched files.

**Browser measurement.** Playwright from `website/tools/`, Chromium, against the
synthetic demo dataset via `SR_DATA_DIR=website/tools/demo-data` — the real export is
never touched, moved, or copied. Both revisions were built to separate `dist`
directories and served in turn from the same backend, and the cluster was resolved on
both by the same route (the `aria-live` count span's `parentElement`, which exists
identically in the pre-fix build that has no class to hang a selector on), then guarded
by tag and by the view button being inside the resolved node rather than trusting a
DOM path.

At 320px / 200% text scale:

| case | pre cluster | row box | pre page scrollWidth | post cluster | post page scrollWidth |
|---|---|---|---|---|---|
| Multimedia, unfiltered | 296.23 | 272 | 320 | 272 | 320 |
| Multimedia, "Has media" | 366.59 | 272 | **391** | 272 | **320** |
| Breeding Codes | 475.13 | 272 | **499** | 272 | **351** |

This reproduces the Evaluator's 391 and 499 exactly. Two things worth reading carefully:

- The unfiltered Multimedia row is why page `scrollWidth` alone is not a usable
  assertion: the cluster is 24.23px wider than its content box, yet the 0.23px that
  reaches past the panel padding rounds away and the integer `scrollWidth` reads a
  clean 320 on a broken build.
- Breeding Codes' post value is 351, not 320. The remaining 31px is the separate
  filter-pill leak the Evaluator measured and deliberately scoped out, and 31px is
  precisely the residual they predicted. This cluster contributes 0.

**Geometry matrix — where I diverge from the brief's blast-radius estimate.** I ran the
10-width × 4-scale matrix on *both* tabs (80 cells, comparing cluster rect and every
child rect):

- **No cell at 640px or above changed, on either tab.** Desktop is byte-identical, as
  constrained.
- **Multimedia: 39 of 40 cells identical**, the only change being 320px @ 200%. That
  matches the Evaluator's matrix cell for cell — theirs was measured on this cluster.
- **Breeding Codes: 30 of 40 identical, 10 changed** — 320px @ all four scales, 360px @
  1.25/1.5/2, 402px @ 1.5/2, and 480px @ 2. The brief's "39 of 40" did not cover this
  tab, and Breeding Codes' cluster is far wider (475px vs 296px at 200%), so it was
  over its row's content box at many more phone and small-tablet cells.
- **Every one of those 10 cells was already defective** by the brief's own definition of
  done — pre-fix overflow past the row content box ranged from 21.09px to 203.13px — and
  9 of the 10 were leaking page horizontal scroll (`scrollWidth` 364 / 409 / 499 against
  a 320–480 viewport). All 9 now report `scrollWidth == viewport`.
- The tenth, Breeding Codes at 320px @ 1x, is the one genuine judgement call: it was
  21.09px past its content box but the panel's 24px padding absorbed it, so no page
  scroll was visible. It now wraps to two lines (cluster height 44 → 70). I let it
  change rather than gate the cap behind a breakpoint: the brief's expected behavior is
  "the cluster's width is less than or equal to its row's content box", the 0.23px
  Multimedia case is the same shape and is explicitly called a defect there, and a
  media-gated cap would be breakpoint math the responsive convention says to avoid.
  Flagging it because it is a visible layout change on a small phone that the brief did
  not predict, not because I think it is wrong.
- **After the fix, zero of the 80 cells has a cluster wider than its row content box.**

**Cascade-competitor scan.** The Multimedia edit lifts declarations from an inline style
(specificity 1,0,0, unbeatable) onto a class (0,1,0), so per the v0.5.81 sharpening the
value diff is not sufficient on its own. I scanned *both* stylesheets the bundle emits —
`index-*.css` and the lazy `vendor-maplibre-*.css`, which stays in the document once any
map tab has mounted — testing the **rightmost compound** of every selector for whether it
could match a bare `<div class="sr-wrap-flex">` and set `display`, `align-items`, or
`gap`. The only matches are `.sr-wrap-flex` itself. Recorded on the second, independent
ground as well: `.sr-wrap-flex` sits at brace depth 0 in the built CSS, i.e. unlayered,
so it beats Tailwind preflight's `@layer base` regardless of specificity. The lifted
values are identical to the inline ones (`display:flex`, `align-items:center`,
`gap: var(--sr-wrap-gap, 8px)` with `--sr-wrap-gap: 8px` supplied inline); `flex-wrap: wrap`
is the intended addition.

### Notes for reviewer

**What the new test proves and what it does not.**
`frontend/src/components/CountClusterWrap.test.tsx` is a jsdom render test that asserts
three things together on the cluster element that actually renders: the class is on it,
no inline `display`/`flex-wrap` out-ranks it, and given an inline `flexShrink: 0` a width
cap is present. It **fails on the pre-fix build**, verified by stashing both component
edits and running it: Multimedia fails on the missing class, Breeding Codes fails on
exactly the pinned-without-a-cap condition. That third assertion is the one that makes it
worth having — a stylesheet test would have passed on Breeding Codes all along, which is
how the class shipped inert.

It **cannot** prove the cluster fits. jsdom has no layout engine, no media queries, no
font metrics, and does not resolve the cascade against React inline styles. Cluster width
versus content box, page `scrollWidth`, and the 80-cell matrix are browser-only, and are
the measurements above.

**`ROADMAP.md` correction.** The "On the Horizon" entry was wrong on three counts, all
disproven by the Evaluator's browser measurements, and is corrected in this change per
the published-prose-must-match-the-code rule: it described two tabs when `LifeList.tsx`
renders only Multimedia (the panel id `life-list` is legacy); it called the leak a
constant 3px when it tracks the count label's text (`428 species` reproduces 3px,
`1247 species` gives 12px, `88 species` gives none, and the demo dataset's `149 species`
lands just under the integer threshold); and it asserted that Breeding Codes avoided the
leak *because* it carries `.sr-wrap-flex`, when that tab was in fact the worst instance
and the class was the thing sitting inert. The entry now tracks only the genuinely
separate leaks that remain.

**Deliberately not fixed.** The other pre-existing 320/200% leaks the Evaluator measured
and scoped out are untouched: Statistics 60px (a `.sr-favicon` image), Checklists 42px,
Calendar 29px, and Breeding Codes' own residual 31px from its filter pills. None share
this cause.

**Not bumped.** No version bump and no `CHANGELOG.md` entry — this is one build in a
bundled Spool release and the bump happens once, at the bundle.
