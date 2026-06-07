# QA Report — perf-loading-and-indicators

**Date:** 2026-06-07
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

## Test Suite Results

- Frontend: **428 tests passing**, 0 failing (30 files) — up from 392 at the
  start of this session (+36: progressive-render component tests, GL pin
  parity tests, atlas padBounds tests, network-cache and transport-cache
  tests, favicon-slot test, cursor-arbiter tests).
- Backend: **93 tests passing**, 0 failing — the sweep touched no Python,
  so this is a pure regression check.
- Production build: clean. Repo lint: clean (was red before this session).

## Acceptance Criteria Verification (change-brief.md)

| Criterion | Result | Notes |
|---|---|---|
| E — Statistics paints shell before heavy stats | ✓ Pass | Component test asserts header + jump-nav + computing indicator render with no section cards on first paint; sections appear after the double-rAF; verified live by Dave |
| E — filter/granularity toggles stay responsive | ✓ Pass | useDeferredValue on both; chart branch + formatters read the deferred value (no branch/data mismatch) |
| E — geographic map deferred below charts | ✓ Pass | Component test asserts the map stub mounts only after the idle callback; identical-size placeholder (no layout shift) |
| G — sighting pins render as GL circle layer | ✓ Pass | Parity locked by mapPins.test.ts: radius/opacity step expressions ≡ the old functions, incl. border-box → stroke radius equivalence and the 0.25 atlas fade |
| G — hotspot teardrops as GL symbol sprites | ✓ Pass | Canvas sprites from --sr-map-* tokens, theme-refreshed; legend hide/show via layer filter; selection keyed by locId (fixes a pre-existing index bug) |
| G — atlas viewport cap | ✓ Pass | blocksInBounds wired with padBounds(0.15), cap 9000, "Zoom in" hint chip; cap semantics were already unit-tested |
| G — no visual regression | ✓ Pass (human) | Dave verified the running 0.5.16 build; the 28-agent adversarial review confirmed parity claims and the one real regression it found (cursor arbiter) was fixed and unit-tested |
| H — short-TTL network cache | ✓ Pass | 90 s TTL, in-flight coalescing, generation guard, errors never cached — 11 unit tests + 6 transport-seam tests (incl. code-order key normalization, error eviction) |
| H — region-info memo behavior-identical | ✓ Pass | Best-effort semantics preserved (bounds-centre only with all four keys, name fallback, '' / fall-through on failure) |
| H — loading indicators | ✓ Pass | Map search chip (role=status, map chrome z-index), updater spinner + aria-live, fixed favicon slots (slot test in BirdName.test.tsx) |
| No new user-facing features (Improve-lane boundary) | ✓ Pass | Indicators and the zoom-in hint are loading/feedback polish on existing behavior |

## Edge Cases Tested

- Cache: concurrent identical requests share one fetch; a clear during an
  in-flight load cannot repopulate (generation guard); rejected loads evict.
- Map: hidden-kind selection closes the popup instead of showing the wrong
  pin; atlas clicks ignore points where a marker is hit; cursor correct when
  crossing pin → shaded block (arbiter re-queries all interactive layers).
- Resize/theming: pins, atlas fills, and hatch sprites all re-resolve tokens
  on a data-theme change.

## Known Limitations

- Map markers remain pointer-only (not keyboard-focusable) — pre-existing,
  unchanged by the GL rewrite, already on the backlog and disclosed in
  ACCESSIBILITY.md.
- Atlas blocks regenerate on `moveend`, so during a long continuous pan,
  blocks at the new edge appear when the gesture settles (padded bounds
  hide this for small pans).
- The 90 s cache means a brand-new eBird sighting can take up to 90 s to
  appear when re-running an identical search — deliberate trade-off.

## Convention Flags

- GL layers can't use CSS variables: token colors must be read at runtime
  and refreshed on `data-theme` change, and the canvas cursor must go
  through the shared arbiter — both now recorded in CLAUDE.md's map section.
