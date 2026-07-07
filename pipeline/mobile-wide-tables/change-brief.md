# Change Brief — Mobile Wide-Table Zoom/Interaction (Multimedia + Breeding Codes)

## ⚠️ Feature-check flag (read first) — this is NEW-FEATURE / DESIGN territory, AND it was already tried-and-reverted

The user's request — "a way to allow the user to interact with their table and a
zoom level comfortable for them, while maximizing the mobile screen" — describes a
**new interactive zoom/pan affordance on a phone**. Under the branch rules that is
New-Feature territory on two counts: (1) a genuinely-new interaction the user can't
do today (pinch/−-Fit-+ zoom on a table), and (2) a from-scratch UX/design call.

**More important:** this exact feature was **already designed at a Designer-stage
review, built, and iterated through ~7 on-device rounds — then REVERTED at the
user's own explicit direction** during the `mobile-app` run (all still tagged
0.5.64). See `pipeline/mobile-app/decisions.md`. It is not an untried idea; it is a
known dead end with the current technique.

**What was built (and deleted):** `ZoomableWideSurface` (component + `lib/zoomableSurface.ts`
+ tests + a `wide-table-design.html` mockup) — a contained framed panel with soft
edge-fades, a keyboard/AA-reachable −/Fit/+ zoom control, and a custom two-pointer
JS pinch gesture, active at the ≤640 phone tier, wrapping BreedingCodeTable,
LifeListTable (the "Multimedia" tab), and SpeciesDetail's co-occurrence table.
Exactly the "comfortable zoom that maximizes the screen" the user is now re-asking for.

**Why it was reverted — the load-bearing WKWebView constraint:** the design went
through collapse fixes, a `transform:scale`→CSS-`zoom` switch, dead-one-finger-scroll
(`touch-action`) fixes, an unreachable-control fix, unfreezing the name column, and
lifting the Fit clamp floor — but on real iOS **CSS `zoom` would not reliably scale
the content in WKWebView** (the zoom % updated but the matrix didn't visibly shrink,
so the code columns stayed off-screen/unreadable). The documented lesson:
*"CSS `zoom` is not a dependable scaling primitive in WKWebView; a wide-table 'see it
all' zoom on phone needs a different technique (deferred; not attempted again this
run)."* The user preferred the original "↔ Unbounded / Normal" toggle and directed a
full revert. That revert is confirmed clean in HEAD (no `ZoomableWideSurface` /
`zoomableSurface` / `phoneSurface` refs remain in `frontend/src`).

**So the honest verdict:** this is not a maintain-lane refinement of existing
responsive behavior — the existing behavior (contained horizontal scroll + a wideMode
page-scroll toggle) is intact and was the user's chosen resting state. Re-attempting
the zoom means (a) a design call and (b) picking a *different scaling technique* than
CSS `zoom` — genuine New-Feature + Designer work, not a tune. **Recommend routing to
the New Feature lane** (which has the Designer stage = the user's participate stage),
OR consciously re-scoping to a smaller Improve-lane refinement that does NOT re-open
the zoom (see options below). Surfacing the choice per the run's flag directive.

## What is changing
Nothing is decided yet — this brief exists to route the decision. The two surfaces in
scope, as they render **today** (verified against HEAD):

- **"Multimedia" tab** = internally the `life-list` panel → `LifeList.tsx` →
  `LifeListTable.tsx`. It is NOT very wide: a left name/Entries column (`minWidth:200`)
  + four narrow fixed columns (Photo/Audio/Video 80px, Total 70px). On a phone it uses
  a plain `overflowX:auto` frame (default) and has the `wideMode` "↔ Unbounded/Normal"
  toggle (page scrolls sideways when Unbounded). Fits a 320px phone with modest scroll.
- **Breeding Codes tab** = `BreedingCodeList.tsx` → `BreedingCodeTable.tsx`. This is
  the genuinely-wide one: a sticky name column (`clamp(7.5rem,40vw,220px)`) + **one
  44px column per breeding code present** (can be ~16 columns → ~1600px on a real
  dataset). Today it uses `overflowX:auto` with a **sticky frozen first column** in the
  default path; `wideMode` switches to `width:max-content` full-page sideways scroll.
  This is the surface the "can't see all the codes on a phone" pain is really about.

Both already honor the standing conventions: `.sr-input-16` on filter inputs, sticky
header, `.sr-only` spans scoped under `position:relative` so they don't leak page
scroll, rem-based sizing for 200% text scale.

## Why now
The user is asking again, on the phone-experience axis, after the iOS TestFlight
builds — the same trigger that opened the reverted attempt. The `mobile-app` work is
live (iOS 0.5.68 on TestFlight); the wide tables are the most-cited phone rough edge.
The prior revert deferred a *technique*, not the goal — so revisiting is legitimate,
but must start from "what technique, if not CSS `zoom`," which is a design/spec question.

## User-facing impact
Potentially significant and phone-visible (a new zoom control + gesture on ≤640), which
is precisely why this leans New-Feature. If instead re-scoped to Improve, impact must
stay to *strengthening the existing scroll/legibility* with no new interaction. Any
change here ships to desktop/web too (only ≤640 rendering would change) and rides into
the next iOS build — desktop-width behavior must stay byte-unchanged (the prior run's
discipline).

### If New Feature — what a fresh attempt would need
- A **different scaling technique than CSS `zoom`** (the proven WKWebView failure).
  Candidates a Designer/Engineer would weigh: SVG `viewBox` scaling of a rendered
  matrix; a canvas/`<img>` fit-to-width overview + tap-to-1:1 (the old "Option B",
  never the primary); a genuine layout reflow (fewer/denser columns on phone rather
  than scaling pixels); or an accordion/per-species drill-down that sidesteps the
  matrix entirely on phone. On-device WKWebView verification is mandatory and is the
  user's step (jsdom can't exercise pinch/scroll/scale).
- The Designer stage is the user's participate beat — appropriate given they made the
  last design call and reversed it.

### If re-scoped to stay Improve (no new interaction)
Smaller, lower-risk refinements that do NOT re-open zoom, e.g.: make the Breeding Codes
default the contained `.sr-scroll-x` frame on phone (kill the page-lurch wideMode as
the phone default) with clearer edge-fade affordance; tighten the sticky-column width
math; or improve the code legend/scroll cue. These are legitimate maintain-lane work —
but they will NOT deliver the "comfortable zoom to see it all," so this path must be an
explicit narrowing the user accepts.

## Decisions touched
- No entries in the root `DECISIONS.md` are reversed. **However**, this directly
  re-opens a documented user decision recorded in `pipeline/mobile-app/decisions.md`
  (2026-07-05, "Wide-table phone zoom: ATTEMPTED then REVERTED (user preference)").
  Re-attempting must be a conscious reversal of that revert, and the technique
  constraint ("CSS `zoom` is not dependable in WKWebView") must carry forward.
- Standing responsive conventions in `CLAUDE.md` apply and are non-negotiable: no JS
  `window`/`resize` (reuse the existing `lib/useIsPhone.ts` `matchMedia` store — already
  present), 640 phone boundary, hold at 320px + 200% text scale, `.sr-input-16` for
  inputs, ~44px touch targets, `.sr-scroll-x` for wide tables, no maplibre on the entry
  chunk (irrelevant here but a standing build guard).

## What done looks like
Because the substance is a routing decision, "done" for Stage 1 = the user picks a lane:
**(a)** New Feature lane — accept a fresh design pass that avoids CSS `zoom` and includes
a Designer stage + mandatory on-device WKWebView verification; or **(b)** re-scope to an
Improve-lane refinement of the existing scroll/legibility with NO new zoom interaction;
or **(c)** re-affirm the prior revert and leave the wide tables as-is. Whichever lane,
the WKWebView-`zoom` constraint and the desktop-byte-unchanged discipline are inherited.

## Key files (verified)
- `frontend/src/components/LifeListTable.tsx` — the "Multimedia" table (name + P/A/V/Total).
- `frontend/src/components/LifeList.tsx` — its container + `wideMode` toggle wiring.
- `frontend/src/components/BreedingCodeTable.tsx` — the wide species × breeding-code matrix.
- `frontend/src/components/BreedingCodeList.tsx` — its container + filters + `wideMode` toggle.
- `frontend/src/App.tsx` (~1106–1146) — the "Multimedia" tabpanel is `life-list`; "Breeding Codes" is `breeding-codes`.
- `frontend/src/lib/useIsPhone.ts` — the sanctioned ≤640 matchMedia store to reuse.
- `pipeline/mobile-app/decisions.md` (lines ~163–642) — the full design→build→revert history and the WKWebView-`zoom` constraint.
