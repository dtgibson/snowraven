# Change Brief — Uniform Map FABs

## What is changing

The idea's premise is half out of date. The **GPS button is already uniform**: v0.5.83 (shipped today) put `.sr-map-locate-btn` in the FAB cluster on all four Map Explorer views, gated only on "is there a map" and never on `viewMode` (`MapExplorer.tsx:2278`, locked by QA-01). The real gap is the **flag button**: `SharePin`'s drop button is portaled into the cluster only under `viewMode === 'sightings' && !isSetupRequired` (`MapExplorer.tsx:2396`), so Hotspots, Nearby Lifers and Media Targets show a two-button row where My Sightings shows three. The copy *capability* is not missing there — v0.5.80 deliberately gave the existing search-centre pin the copy action instead of a second pin, and it opens the same `SharePopup`. So this change adds a flag FAB to the three centre views as a **second route to the existing centre-pin popup**, and fixes the row's two remaining non-uniformities: the fullscreen button still at 36px on a phone while its neighbours reach 44px/88px, and the three hand-duplicated copies of the same circular-FAB declarations.

## Why now

The user's saved idea, plus two ROADMAP items sitting directly in this change's path (`ROADMAP.md:167`), which the roadmap itself pairs as "the natural moment to do both": the fullscreen button is "now the odd one out in a row of three", and `.sr-map-locate-btn` is "the *third* hand-duplicated copy of the same circular-FAB declarations". v0.5.83 could not touch either, because its FR-04 forbade altering the two shipped FAB rules. This change's scope does permit it.

## User-facing impact

Not none. A flag button appears on three map views that did not have one, and the FAB row's tab order and child order change on those views. The fullscreen button grows to the ~44px phone posture, so the bottom-right cluster is visibly taller on a phone. No copy capability is added or removed on any view: the popup, its coordinates and the Settings sharing preference are untouched.

## Design pass

**Needed.** Surfaces: the Map Explorer FAB cluster on Hotspots, Nearby Lifers and Media Targets (adding the flag FAB), and the same cluster on all four views (fullscreen sizing). Three things must feel right rather than merely work: (1) the new button must not read as the same promise as My Sightings' flag, which *drops* a pin, when here it *opens* the existing centre pin's popup — glyph, label and the `aria-pressed` green "holding a pin" tint all need a deliberate answer, and all three labels in the row must stay pairwise distinct (v0.5.83 FR-07); (2) the state where no centre is set yet (`hasValidCenter` false, so there is no pin and nothing to copy) needs a designed answer — absent, or `aria-disabled` per the locate button's focus-preserving precedent; (3) the row should read as one family at 320px and 200% text scale once all three circles are the same size.

## Decisions touched

- **v0.5.80, sub-decision 3 (`DECISIONS.md:227`) — "The gesture collision is resolved by extension, not competition."** Touched, not reversed, *as scoped here*: the centre pin stays the only pin and the FAB is a second route to its popup. Building the naive reading instead (a FAB that drops an independent share pin on the centre views) would reverse it and is explicitly out of scope — see flags.
- **v0.5.80's "the keyboard route ... is the *primary* route, not a hidden fallback" (`DECISIONS.md:230`).** Extended, not changed: that principle produced a visible corner tool on the five share-pin surfaces and was never applied to the three centre views. This change applies it there.
- **v0.5.83 (`DECISIONS.md:23`) — the `LocateFixed`/`FlagTriangleRight` glyph pairing and "shape carries the distinction".** The new button must extend that pairing to a third meaning, not blur it.
- **v0.5.83 FR-04** (a scope constraint, not a durable decision): it held the new FAB to the better of the two shipped precedents rather than editing them. This change lifts that constraint deliberately.

## What done looks like

All four Map Explorer views show the same three round FABs, same sizes, at 320px and 200% text scale, and every one is reachable by keyboard in DOM order with no CSS `order`. Pressing the flag on a centre view opens the same `SharePopup` the centre pin opens, with the same coordinates, and no second pin ever exists on those views. `MapExplorerLocateFab.test.tsx`'s cluster-order test and `mapFabClusterCss.test.ts` are updated rather than deleted, the `.sr-map-geo-error` live region keeps its always-rendered contract, and `docs/HELP.md`, `README.md` and `website/index.html` are corrected in the same change.
