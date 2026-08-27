# Change Brief — Custom Raven Glyph

## What is changing
The generic lucide `Bird` icon is replaced with the custom SnowRaven raven
glyph (the clean vector trace matching the v0.5.93 app icon's raven) at its
only two render sites: the app header mark (`frontend/src/App.tsx`, line 718,
sized 20/30 by `compactChrome()`) and the welcome screen mark
(`frontend/src/components/WelcomeScreen.tsx`, line 64, sized 34). The
`currentColor` SVG variant (`snowraven-bird-glyph-currentcolor.svg`,
viewBox 0 0 512 512, single path) becomes a committed inline React component
under `frontend/src/`, colored via `var(--sr-accent)` exactly as today. The
lucide `Bird` import is removed from both files; all other lucide icons stay.

## Why now
v0.5.93 unified the app icon, web favicon, and website mark on the SR raven,
but the in-app chrome still renders a generic lucide bird — the last surface
carrying a bird that is not the brand's raven. The approved glyph SVG now
exists (clean vector trace of the app-icon raven), closing that gap.

## User-facing impact
The header and welcome marks change from a thin stroke outline to a solid
raven silhouette — bolder at the same sizes, deliberately, to match the app
icon. Same accent color in both themes, same sizes, same decorative
semantics (aria-hidden; the wordmark carries the name). No behavior change,
no new surface. Website/README screenshots showing the old header glyph may
become slightly stale; not blocking.

## Design pass
Needed. Two existing surfaces are being visually refined: the app header
mark and the welcome screen mark. A solid silhouette has different optical
weight than a 1.75-stroke outline, so The Designer should judge sizing and
optical balance at 20/30/34px next to the wordmark and tab chrome, in both
themes. The user wants a live desktop preview against real data before the
deploy gate (standing preference).

## Decisions touched
- v0.5.93 "the app icon finally means something" — EXTENDED, not reversed:
  this completes the mark unification inside the app itself. Its convention
  binds here: commit the master SVG in-repo (the asset currently lives only
  in ~/Downloads; regeneration must never depend on a Downloads folder).
- Release rhythm (v0.5.78 / 1.0.0): user-facing change → patch bump to
  1.0.3 in BOTH `frontend/package.json` and `src-tauri/tauri.conf.json`,
  CHANGELOG entry, ships to all platforms. The v1.0.2 App Store "hold"
  precedent likely applies if a submission is still in Apple's queue.
- Standing UI rule (`.claude/rules/ui.md`): no hardcoded hex — use the
  currentColor variant, drop its baked `color="#2D8653"` default; never the
  fixed-color variant. Keep the component dependency-free (it rides the
  App.tsx entry chunk).

## What done looks like
Both sites render the raven silhouette in `var(--sr-accent)` at their
current sizes in light and dark themes, verified in a live desktop preview.
`grep` finds no lucide `Bird` import anywhere; the glyph SVG is committed
in `frontend/src/`; versions bumped to 1.0.3 in both files with a
CHANGELOG entry; `npm run build` passes.
