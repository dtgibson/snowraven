# Security Review — Map Explorer Shading Polish

**Date:** 2026-06-28
**Feature:** map-explorer-shading-polish (Improve lane)
**Stack:** frontend-only change (React + Vite + TS); backend `python-fastapi` untouched
**Checklist:** react-vite frontend posture (XSS / injection / secrets / network / regex / deps)
**Outcome:** PASSED

---

## Summary

Three UI refinements to the existing Map Explorer shading. The change adds no new
network calls, no new user-input handling, no new external surface, and no new
dependencies — it reorders existing JSX, adds pure client-side state logic, and
recolors basemap layers via MapLibre paint properties using hardcoded constants.
No security issues found.

---

## Findings

No security issues found in this change.

---

## Checks Performed

| Check | Result |
|---|---|
| New network calls / third-party requests | Pass — none. Desaturation reuses the already-loaded tiles; privacy posture unchanged (no `PRIVACY_POLICY.md` impact). |
| Untrusted input into new code | Pass — caption/tooltip text is static literals; no user/API data flows into the new code paths. |
| XSS / `dangerouslySetInnerHTML` | Pass — none added. Existing static-SVG `dangerouslySetInnerHTML` uses were moved verbatim (imp-1), not introduced or fed new data. Map popups stay escaped JSX. |
| Injection into map paint / layer ids | Pass — `setPaintProperty` is called only with hardcoded layer ids (`TINTED_LAND_LAYERS`, `RASTER_BASE_LAYER_IDS`) and hardcoded color/saturation values; no interpolation of external data. |
| Regex hygiene (ReDoS, CLAUDE.md convention) | Pass — `desaturateHsl`'s regex is linear by construction (sequential quantifiers over disjoint classes separated by literal delimiters; no nested/overlapping quantifiers) and runs only on trusted `TINT_*` constants, never untrusted text. Not global, so no `lastIndex` state. |
| Secrets / keys in source | Pass — none added. |
| Auth / trust-boundary changes | Pass — none. No routes, no permissions, no storage-seam changes (shading state stays in-memory, not persisted). |
| Dependency changes | Pass — no new packages; no `package.json` dependency edits. |
| Bird-name / link / hotspot escaping conventions | Pass — not touched; the CountyLayer popup's `BirdName`/`ChecklistLink`/`HotspotLink` usage is unchanged. |
| Backend (FastAPI) checklist items | N/A — no backend code changed in this run. |

## Convention Flags
None.
