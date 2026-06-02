# Security Review — Atlas Shade by Breeding Code

**Date:** 2026-06-01
**Stack:** react-vite-tailwind frontend (no backend changes)
**Checklist:** security-react-vite.md
**Outcome:** PASSED (one informational note carried forward)

## Summary
Frontend-only: a client-side spatial join over the already-loaded eBird backup, plus SVG pattern/flat fills and three toggles. No backend routes, no new runtime dependencies, no secrets, no new network calls or data collection. The block popup interpolates trusted static data (already flagged); no user-controlled value enters markup.

## Findings

### F-1 — Popup HTML still built from a template string (Informational, carried forward)
**Where:** `AtlasBlockLayer.tsx` `bindPopup`
**Description:** The popup now also includes the breeding label/code/count. The breeding `label`/`code` come from `BREEDING_CODES` (static app constant); `count` is a computed number; the block name/code come from the bundled gazetteer. All trusted/static — no user input flows into the HTML. This is the standing check recorded in CLAUDE.md; re-confirmed it still holds with the new fields.
**Status:** Accepted (trusted/static data; numeric count)

## Checks Performed
| Check | Result |
|---|---|
| No secrets in source | Pass |
| No new runtime dependencies | Pass — uses existing BREEDING_CODES, atlas gazetteer, leaflet |
| No new backend / network surface | Pass — join is pure client-side over already-loaded observations |
| Data collection / privacy | Pass — uses the user's local backup; nothing transmitted; consistent with PRIVACY_POLICY.md |
| Injection (popup/markup) | Pass — interpolated values are static constants + a numeric count (F-1) |
| Input handling | Pass — toggles are booleans; no free-text input |
| Coordinates handling | Pass — lat/lng from the parsed backup; used only in arithmetic (point→block) |
| Theming/build output | Pass — token-driven; build unchanged |

## Convention Flags
- (Already in CLAUDE.md) Re-check the atlas popup's HTML-string construction whenever its data could become non-static. Still static here.
