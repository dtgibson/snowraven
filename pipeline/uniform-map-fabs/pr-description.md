# Uniform Map FABs

### What this does

The Map Explorer's bottom-right cluster now reads as one row of map furniture on
all four views. Three things changed:

1. **A centre-share FAB on Hotspots, Nearby Lifers and Media Targets.** Those
   three views showed a two-button row where My Sightings showed three, because
   `SharePin` only mounts on My Sightings. The new button carries a lucide
   `MapPin` (the teardrop the search-centre pin draws) and opens the **existing**
   search-centre pin's `SharePopup`. It creates no pin and adds no copy
   capability: it is a second route to a popup that already existed, per v0.5.80
   sub-decision 3, extended rather than reversed.
2. **The fullscreen button joins the family.** It was 36px at every width while
   its neighbours reached 44px on a phone. It is now `2.25rem` / `2.75rem` phone
   like the rest, and its glyph moved from 16px/2.5 to the family's 17px/2.2.
3. **One shared circular-FAB base class.** `.sr-map-fullscreen-btn`,
   `.sr-share-drop-btn` and `.sr-map-locate-btn` each carried a hand-written copy
   of the same twelve declarations. `.sr-map-locate-btn`'s own comment named this
   change as its successor ("a FIFTH map FAB should force the extraction of a
   shared base class, in a change whose scope permits touching the two shipped
   rules"). The three copies are now `.sr-map-fab` plus `--std` / `--compact`,
   and the semantic classes survive as state hooks only.

Also in this change: the glyph is sized in **rem** so it tracks its box (the
"unit rule" below); the Filters pill gains `.sr-touch-target`; and the three
published documents that describe this corner are corrected.

### The unit rule, and the consequence to know about

lucide's `size={17}` prop renders a **px** `width`/`height` attribute. A phone FAB
grew from 44px to 88px at 200% in-app text scale while its glyph stayed 17px, so
the disc got emptier exactly at the condition this row is judged at.
`.sr-map-fab svg { width: var(--sr-fab-glyph) }` fixes it, with the custom
property declared on the size modifiers. **A glyph's unit must match its box's
unit, or the ratio breaks at scale.** Measured: the glyph/box ratio is 0.3864 at
both 1x and 200% on a phone, and 0.4722 at both on desktop.

**Flagged consequence, not a side effect: desktop FABs now grow with text
scale.** The base was a fixed `36px` at every scale; `2.25rem` is 36px at 1x and
72px at 200% (measured). That is what this repo's conventions ask for, and the
phone tier already behaved that way. Keeping 36px fixed on desktop was rejected
by the design because it forces a px glyph, which re-opens the ratio bug on the
desktop side and leaves two sizing idioms inside one family.

### The cascade regression this could have introduced, and what stops it

`.sr-map-fab:hover` and `.sr-share-drop-btn[aria-pressed="true"]` are **both
(0,2,0)** and both set `background`. Only source order decides which wins on a
hovered, pinned share button. Grouping the state rules above the base block, the
natural tidy-up, silently drops the green tint. No value diff catches it.

Confirmed in a real browser, both directions, against the built app:

| build | `aria-pressed` | cursor off | cursor **on** |
|---|---|---|---|
| shipped order | `true` | `rgb(232,245,238)` | **`rgb(232,245,238)`** |
| state rule lifted above the base | `true` | `rgb(232,245,238)` | **`rgb(244,244,245)`** |

(The measurement asserts `el.matches(':hover')` before sampling, and asserts that
an *unpinned* hover changes the surface at all, so the "tint survives" verdict
cannot pass vacuously. The first attempt did exactly that: hovering the instant
the cluster appeared landed on a node `SharePin`'s portal was about to replace,
which read as "hover applied, surface unchanged".)

The guard is `lib/mapFabClusterCss.test.ts`, written against
`parseTopLevelRules`' insertion order rather than a substring search, because
`.sr-map-fab` is a prefix of `.sr-map-fab-cluster` and `.sr-map-fab-slot`.

### Horizontal fit at 320px and 200% text scale, measured

Measured against the built app serving the synthetic demo dataset (`SR_DATA_DIR`,
never real eBird data), element box against the container's **content box**, never
`document.scrollWidth`.

| | 320px @ 1x | 320px @ 200% |
|---|---|---|
| Disc row (3 discs + 2 x 10px gap) | 152.00px | **284.00px** |
| Cluster cap `calc(100% - 32px)` | 288.00px | 288.00px |
| **Slack** | 136.00px | **4.00px** |
| Row left edge vs container content left | 50.44 vs 0.00 | **20.00 vs 0.00** |
| Discs on one row | 3 | **3 (no wrap)** |
| Filters pill | on the same row | wraps to its own row |

The design predicted 284.00px against a ~286px cap in its own specimen (which
carries a 1px border); the app's map container declares no border, so the cap is
the full 288.00px and the slack is 4.00px. **The pre-approved escape hatch (drop
the column gap to 8px in the ≤640 tier) was not needed and has not been used.**

`document.scrollWidth` read exactly `320` in every configuration, broken or not,
which is why it is recorded here and is not the test.

### The centre-share FAB's three states, measured on a real render

| State | Emitted | Paint (light) | Paint (dark) |
|---|---|---|---|
| Ready | `aria-expanded="false"`, name `Copy the search center location` | 36x36, `1px solid`, `#FFFFFF` | `#18181B` |
| Open | `aria-expanded="true"`, name `Close the location popup` | `rgb(232,245,238)` on `rgb(39,116,72)`, border `rgba(39,116,72,0.7)` | `rgb(5,46,22)` on `rgb(52,211,153)` |
| No centre | `aria-disabled="true"`, no native `disabled`, no `aria-expanded`, name `Set a search center to copy its location` | 36x36, `1px dashed`, `cursor: default`, hover suppressed | dashed, glyph `rgb(82,82,91)` |

Geometry is **identical** between ready and no-centre (36x36 either way), so the
row does not shift when a centre is set.

**Why `aria-expanded` and not `aria-pressed`.** The neighbouring share button's
`aria-pressed` means "this map is holding a pin", a property of the map. This one
holds nothing; it discloses a popup. The green is deliberately the same green
(one app, one active convention) on a different carrier with a different meaning,
and the two buttons can never be on screen together, so nobody ever sees one
green disc meaning two things.

Also measured with the popup open: **1 maplibre popup, 1 centre pin, 0 share
pins.** No second pin is created.

### Pan to an off-screen centre

Pressing the FAB when the search centre has drifted off screen would otherwise
open the popup where the user cannot see it. The shipped `panTarget` →
`MapEffects` `flyTo` path is reused, so there stays one answer to "how does this
map travel". Measured: the centre pin moved from `x = -15` (off the left edge) to
`x = 935` (in the viewport), the latitude field read `40.73` before and after
(**camera-only**, no re-search, no pin move), and the popup was on screen after.

The bounds check needed care. `BoundsTracker` reports the viewport grown 15% a
side, and testing that box directly answers the question wrong **in the worse
direction**: a point in the pad ring is off screen, would read as in view, and the
popup would open where it cannot be seen. `lib/markersInView.ts` gains
`unpadBounds` (which exactly inverts `padBounds`, proved against the real
function) and `pointNeedsPan`. `BoundsTracker`'s `0.15` literal became the shared
`VIEWPORT_PAD_FRAC` so the two cannot drift with nothing failing.

### The cascade-competitor scan (`lib/mapFabCascade.test.ts`)

New guard, per CLAUDE.md's v0.5.81 convention. **It answers a narrower question
than that convention was written for, and says so in its own header:** the
convention covers an *inline-to-class* move where specificity DROPS from (1,0,0)
to (0,1,0). This is a **class-to-class** move, specificity unchanged at (0,1,0)
throughout, so the scan proves the new shared rule cannot be outranked rather
than repairing a specificity drop. The source-order half of the risk is invisible
to it and belongs to `mapFabClusterCss.test.ts`.

It walks **every emitted stylesheet** (`index-*.css` and the lazy
`vendor-maplibre-*.css`, plus the sources so it still runs without a build),
tests the **rightmost compound** of every selector to decide whether a rule can
match, and records the **`@layer`** mechanically from the enclosing at-rule
stack. It does not report "no competitors"; it **resolves each one by name**.
Instrumented, it finds **18 outranking rules in the disc profile and 1 in the
glyph profile** (the same `.sr-field-row` selector, which appears in both),
identically in the source set and the built bundle. They fall into two groups:

- **Ancestor-scoped** (`.sr-map-layers-seg button`, `.maplibregl-ctrl-group
  button`, `.sr-field-row > *`, ...): a descendant combinator needs every part
  satisfied, so one ancestor a FAB can never have rules the whole selector out.
  Each such class is listed with its reason.
- **Intended to win**: the app-wide `button:focus-visible` ring (and its five
  sibling arms, including `[tabindex]:focus-visible` — the fullscreen FAB really
  does ship `tabIndex={0}`). It replaces the FAB drop shadow while keyboard
  focused, which is unchanged by this extraction: the three rules replaced here
  were (0,1,0) too, so the ring already won on all of them.

`.sr-map-fab` ships **unlayered** (verified from the at-rule stack in the built
CSS, not by eye), which is the stronger of its two grounds against Tailwind
preflight's `*{padding:0}` and `button` reset in `@layer base`. The scan asserts
it saw layered candidates, so the "unlayered beats layered" reasoning is not
applied to an empty set, and asserts every recorded resolution is still needed.

**Repaired after security review: the glyph half of this scan shipped
structurally inert.** `isOurs` tested only the rightmost compound, but our glyph
rule is `.sr-map-fab svg`, whose rightmost compound is a bare `svg` carrying no
FAB class. Our own rule was therefore classified as an outsider, `glyph.ours` was
permanently empty, and with nothing of ours to defend the scan resolved every
glyph outsider to `undefined` and skipped it, so both glyph assertions passed on
any stylesheet whatsoever. `isOurs` now reads the ancestor part as well, and
**each profile carries its own non-vacuity assertion** rather than one for the
scan as a whole, in both the source and the built describes. Mutation-checked in
both directions: the auditor's exact case (`.sr-panel svg { width: 99px }`) now
goes red where it was green, an outside glyph competitor with an unsatisfiable
ancestor stays green, the disc profile still goes red on three independent
forms, and reverting `isOurs` to the compound-only form goes red. Stated in the
test and worth repeating: because three of our rules land in the glyph profile,
deleting the glyph rule alone leaves that profile live and this scan green;
`mapFabClusterCss.test.ts` owns that case and does go red on it.

### Verification

- `npm run test` — 153 files, 2056 tests, green. `npm run lint` clean.
  `npm run build` (`tsc -b && vite build`) green, which is the real pre-push gate.
- **33 mutations run against every new guard** (25 in the build, 8 more against
  the repaired cascade scan), each red on the defect and green on
  equivalent-but-different correct forms. Rule blocks were sliced before
  mutating, and two harness misses were themselves caught that way (an anchor
  that matched the rule's name inside a comment rather than the rule).
  Two mutations exposed guards that did **not** discriminate, and both were
  fixed rather than accepted:
  - `aria-expanded={hasValidCenter ? centerShareOpen : …}` left the suite green,
    because inside that gate the two flags are equal in every state the button
    can observe. The load-bearing part is the **gate**, not the flag; the test
    now says so and rejects dropping the gate.
  - Removing the handler's `if (!hasValidCenter) return` left the suite green,
    because the test ran with null bounds so nothing armed a pan either way. With
    a viewport in hand the dropped guard reaches `pointNeedsPan(NaN, NaN, …)` and
    asks the map to fly to NaN; the test now sets bounds, and adds a second
    observable (the press must not latch the open flag).
- `weft-design-lint check frontend/src` — 0 `warn`. The `note`s on touched files
  are the 600ms `flyTo`, which the design's Motion Spec exempts explicitly as a
  **map camera** move (spatial navigation, not UI chrome) and which is the exact
  shipped behaviour of the locate button.
- **The always-rendered live region survives**: `ariaSnapshot` of the cluster
  shows `- status` while idle, and its computed `display` is `flex` in every
  configuration measured. `.sr-map-fab-slot` keeps `display: contents`, no CSS
  `order` exists anywhere in the cluster, and the safe-area rule stays gated on
  `.sr-ios-app`.
- **`ACCESSIBILITY.md` was checked against emitted DOM, not against the spec.**
  Tab order inside the cluster reads share, locate, fullscreen, Filters; the
  attributes and all six names are as documented; pressing the button to close
  leaves focus on that button. The sentence about the silent sidebar copy was
  re-verified: `CenterPointControl` renders in exactly the three centre sidebars.

### Notes for reviewer

- **Scope call taken, flagged rather than assumed:** the design marked the
  Filters pill's `.sr-touch-target` as "Recommended; safe to defer". It is
  included. One existing class, no new CSS, and the pill measured 44px at 1x
  phone and 88px at 200% afterwards, which is the "one family" goal the change
  brief states. Revert by deleting one class name if you disagree.
- `mapFabClusterCss.test.ts`'s old "the duplicate stays a duplicate" block is
  gone, replaced rather than deleted: that guard existed only because
  map-location-buttons' FR-04 forbade touching the two shipped FAB rules, and it
  named this extraction as its successor. The `width: 36px` pins it carried now
  live on `.sr-map-fab--std` as `2.25rem`.
- `.sr-map-fullscreen-btn` and `.sr-share-drop-btn--compact` now have **no CSS
  rule at all**. Both stay on their elements as hooks (a future state rule, and
  the handles the cluster-order tests read).
- `MapControls.tsx` gets a two-line change (a literal became a shared constant).
  `BoundsTracker`'s behaviour is byte-identical at 0.15.
- Not done, deliberately: no version bump, no `CHANGELOG.md` entry, no commit.
  This is one build in a bundled Spool release.
