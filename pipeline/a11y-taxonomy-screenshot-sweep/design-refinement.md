# Design Refinement — 320px / 200% Scroll Leaks

## Visual Direction

Nothing about the look changes. This is the quiet-utility system holding its
shape at the one size it currently breaks: a 320px phone at 200% in-app text
scale. Every fix here releases a constraint that is already wrong rather than
introducing a new treatment, and the trade in all four visual cases is the same
one this app has taken before — **vertical height in exchange for staying on
screen**. No new token, no new component, no new pattern.

The measurements below were taken in Chromium against the built app serving the
synthetic demo dataset, at 320x720 with `--sr-text-scale: 2`. Every figure is an
element's border box against its parent's content box, plus its right edge
against the viewport; page `scrollWidth` is used only to confirm the totals,
never to locate a cause. Probe: `overflow-discovery-probe.mjs` in this folder.

---

## Screens / Views

### Checklists — the `.sr-only` live region (42px, and NOT a design change)

**This one has no visual component at all and is recorded here so it is not
mistaken for one.** The 42px is a screen-reader-only announcement being given a
visible layout box:

```html
<span class="sr-only" aria-live="polite">368 checklists</span>
```

`.sr-only` is correctly written (`position: absolute; width: 1px; clip: rect(0,0,0,0)`),
but the phone tier overrides it:

```css
@media (max-width: 480px) {
  .sr-field-row > * { width: 100%; }   /* globals.css:3304 */
}
```

A universal child selector reaches the live region, and because `.sr-only` is
absolutely positioned, `width: 100%` resolves against its containing block
rather than the row — a 320px box at x=42, right edge 362, which is the entire
leak. It is scale-independent because nothing about it is text.

**Design decision: none required.** Exclude `.sr-only` from the stacking rule
rather than restyling anything. The same universal-child shape sits at
`globals.css:2978` (`.sr-map-sidebar-overlay .sr-field-row > *`) and takes the
same exclusion, whether or not a live region is in one of those rows today.

Worth stating because the standing UI rule already names this failure mode and
it has now shipped three times by three routes (twice in v0.5.37 — TabNav's
`visibility: hidden` probe, and absolutely-positioned `.sr-only` spans in a
scrolled table). The two earlier fixes patched the elements; this one is a
selector reaching an element it was never meant to describe.

### Statistics — three sections, one shared cause (60px)

No single element accounts for the 60px; a DOM bisect confirms it (hiding any
one child never returns the page to 320). Three sections leak, and all three
are an **automatic minimum that was never released**:

| Section | Worst element | Past viewport | Why |
|---|---|---|---|
| `#frivolous-lists` | the trailing link `<a>` of a `BirdName` row | **+59.8px** | the name cluster is `min-width: 0; flex-shrink: 1` and duly crushes to 54px, but `BirdName`'s row is `white-space: nowrap` with an indivisible two-link group, so 157.8px of name hangs out of a 54px box |
| `#breeding-stats` | the "Possible" tier chip | **+50.6px** | chip is `min-width: auto` at 92.3px inside a 242px row |
| `#temporal-stats` | the "34 best" checklist link | **+39px** | span is 144px with an inline `flex-shrink: 0` |

**Design decision — let the name wrap inside its cluster.** For
`#frivolous-lists` this is the v0.5.86 Breeding Codes name-column repair applied
to a second surface: phone-tier, feature-scoped hooks release `min-width: auto`
on both nested flex items and allow the name to wrap, while preserving both
link icons, their 24px touch targets, and the accessible names. A Rainbow
Connection row grows to two lines at 200% on a 320px phone. That is the correct
trade and it matches what the tab already does elsewhere; truncating the name
would reverse the v0.5.56 decision that spelled these out as visible text.

**Design decision — the chip row wraps, the chip does not shrink.** For
`#breeding-stats`, release the automatic minimum on the chip and its label so
the row can break between chips. A tier chip is a fixed vocabulary of four short
words; shrinking one is worse than moving it to the next line.

**Design decision — cap the width, keep the intent.** `#temporal-stats` is the
exact shape v0.5.82 recorded: an inline `flex-shrink: 0` makes any wrapping
class inert, because a container that is never narrowed never breaks a line.
Pair it with `max-width: 100%` rather than deleting `flex-shrink: 0` — measured
identical in effect, and it keeps the do-not-get-squeezed intent rather than
discarding it. This is the recorded remedy, reused rather than re-derived.

### Calendar — the Year group and the day cells (29px)

Two contributors, one cause family, and both must land: the Year group is
+29.4px and the day cells sit at +18.4px behind it, so fixing only the first
leaves a 18.4px leak.

**The Year group.** `Year / ‹ / 2026 / › / All years` measures 308.4px inside
238px. The outer group is a flex item at `min-width: auto`; the inner nav group
is an `inline-flex` with no wrap, holding a 74px year readout and three
buttons that all grow with text scale. Its parent carries `.sr-wrap-flex`, so
the row *around* it wraps while the group itself cannot.

**Design decision — the group wraps internally, "All years" takes its own
line.** Release the automatic minimum on the outer group and allow the inner
nav cluster to wrap, phone tier only, through Calendar-scoped hooks. At 200% on
a 320px phone the year stepper keeps its line and the "All years" pill drops
below it — the reading order is unchanged, the pill keeps its 30px height and
pressed styling, and the control row grows by one line. At 100% nothing moves.

**Design decision — day cells shrink to their track.** The month grid resolves
seven columns of 32.6px, and each day button is 88px because a grid item's
`min-width: auto` floors it at min-content. Release it so the cell shrinks to
its track, exactly as the grid already intends. The day number stays legible
(this is the same `--sr-cal-*` ramp with white on-fill text, untouched); what
goes is the button's refusal to be narrower than its own label padding.

Do **not** put any of these declarations on shared `.sr-ctl-row` or
`.sr-field-row` — the standing rule from v0.5.86 is that this family of repair
stays inside the feature's own subtree, because other filter surfaces sit in
the full-width main panel and have no problem.

---

## Component Usage

No component changes. `BirdName`, `ChecklistLink`, `SegControl`, and the
Calendar's own stepper buttons all render exactly as they do today; only the
constraints around them move. The Rainbow Connection rows keep both link icons
and both accessible names, which is the property the v0.5.86 repair was built
to preserve and the one most at risk from a careless truncation.

## Design Tokens Applied

None added, none changed. Every surface in this refinement already draws from
`--sr-surface`, `--sr-border`, `--sr-text`, `--sr-text-muted`, `--sr-accent`,
the `--sr-tier-*` family (breeding chips) and `--sr-cal-*` (day cells). The
mockup uses the shipped `globals.css` values for both themes so a reviewer is
looking at real colors, not approximations.

## Interaction Notes

Nothing gains or loses an interaction. Three points the Engineer must hold:

- Touch targets stay at the ~44px phone posture. Releasing a minimum width must
  not drop a control below `.sr-touch-target`'s floor; the Calendar day cell
  shrinks horizontally to its track and keeps its height.
- Both `BirdName` links stay present and separately reachable when the name
  wraps. A wrapped name must not orphan the icon group onto a line of its own
  without its name.
- The Checklists change must not alter the live region's announcement behavior:
  it stays rendered at all times, keeps its sequence-keyed child, and is never
  given `display: none`.

## Motion Spec

No motion is added or changed by this refinement. The affected surfaces carry
no entrance, hover, or state transition of their own, and nothing here animates
a reflow. The existing `prefers-reduced-motion` handling elsewhere in the app is
untouched.

## Content Notes

No copy changes. Two published claims become true again once these land and
must be corrected in the same change:

- `ACCESSIBILITY.md:77` — "hold at 200% text scale without leaking horizontal
  page-scroll" goes back to being accurate for these three tabs.
- `docs/HELP.md:588` — "A few dense spots can still scroll sideways a little at
  the narrowest screen width combined with the largest text size" is the
  softened sentence written for exactly these leaks and can return to the
  unqualified claim.

Both are published statements, so neither may be corrected before the fixes are
measured green.
