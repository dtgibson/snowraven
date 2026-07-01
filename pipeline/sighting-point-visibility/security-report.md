# Security Review — Sighting Point Visibility (Point Size control)

**Date:** 2026-07-01
**Feature:** sighting-point-visibility — Map Explorer "Point Size" control (Normal / Small / Off)
**Lane:** Improve (maintain)
**Stack:** react-vite-tailwind (frontend) / python-fastapi (backend)
**Checklist:** reference/checklists/security-react-vite.md — applied through the lens of this project's CLAUDE.md "Security — standing checks" and the map-popup/injection conventions in "Overlays and stacking"
**Outcome:** PASSED

---

## Summary

This is a frontend-only display refinement: a session-only `SegControl`
(Normal / Small / Off) that scales or hides the `sr-sight-circle` GL layer on
the Map Explorer's My Sightings map. It introduces no new attack surface and
crosses no trust boundary — no new user input, no new network call, no new
tile/map provider, no new persistence, and no backend files changed. Every
existing security control (escaped-JSX map popups, id shape-validation, GL
layer ownership, shade/heatmap layering) is untouched. Clean pass, no findings.

---

## Improve-lane focus (new attack surface / trust boundary)

**No new attack surface. No trust-boundary change.** The change is confined to
five source files plus tests and docs:

- `frontend/src/lib/mapExplorerTypes.ts` — adds the `PointSize` string-union type only.
- `frontend/src/lib/mapPins.ts` — refactors `pinRadiusExpr`/`pinFillRadiusExpr`
  to take an optional numeric `factor` (default `1`, so the Normal path is
  byte-identical to before) and adds a `POINT_SIZE_RADIUS_FACTOR` constant map.
  Pure numeric math on trusted internal geometry; no data flow from user/network input.
- `frontend/src/components/map/SightingMarkers.tsx` — adds a `pointSize` prop;
  gates click/hover wiring on `pointsShown` and returns `null` (renders no
  layer/source/popup) when `pointSize === 'off'`.
- `frontend/src/components/MapExplorer.tsx` — adds a `useState<PointSize>`
  (session-only, plain `useState`, not the storage seam) and a `SegControl` in
  the sidebar, threaded to `SightingMarkers`.

`git diff --name-only` confirms **no `backend/` or `.py` files changed**, so
the FastAPI trust boundary is not in scope and was not modified.

---

## Findings

No security issues found in this feature.

---

## Checks Performed

| Check | Result |
|---|---|
| No new `dangerouslySetInnerHTML` introduced | Pass — none added. The two pre-existing `dangerouslySetInnerHTML` sites in `MapExplorer.tsx` (`TEARDROP_HTML[row.kind]` line 1499, `MEDIA_ICONS[type]` line 1734) are static constants and are NOT within any hunk of this diff (verified — neither line appears in `git diff`). |
| Map popups stay escaped JSX | Pass — `SightingMarkers.tsx` `sightPopup` (lines 127–144) renders `locName`, count, `formatDate(lastDate)`, and species names as React children (auto-escaped). No HTML-string path added. |
| "Off" path removes popup without adding an injection surface | Pass — `pointSize === 'off'` returns `null` (line 175): no `<Source>`, no `<Layer>`, no `<Popup>`. It removes render output; it adds no HTML-string or `innerHTML` surface. |
| Atlas / county / sighting popup injection-safety untouched | Pass — no atlas/county popup code touched; the sighting popup remains escaped JSX. The standing "keep map popups as JSX, never `dangerouslySetInnerHTML`" convention holds. |
| No unvalidated id → href introduced | Pass — the diff introduces no anchors/hrefs at all. `SUBMISSION_ID_RE` / `LOCATION_ID_RE` guards are not present in and not weakened by this change (grep for `href=`/`SUBMISSION_ID_RE`/`LOCATION_ID_RE`/`encodeURI` in added lines: no matches). |
| `locId` from feature properties handled safely | Pass — the click handler (line 107–108) reads `locId` as `unknown` and only accepts it via `typeof locId === 'string' && locId !== ''`, else `null`. Used solely as a selection key (`onSelect`), never interpolated into a URL or HTML. Unchanged by this diff. |
| No new user input surface | Pass — the only new control is a 3-option `SegControl` bound to a typed `PointSize` union; the value can never be attacker-controlled free text. |
| No new network call / no new tile or map provider | Pass — no `fetch`, `transport.*`, `axios`, or provider changes in the diff. Tiles/basemap providers in `lib/mapStyle.ts` are untouched. |
| `PRIVACY_POLICY.md` needs no update | Pass — confirmed no new network egress, provider, analytics, telemetry, or account. `git diff --name-only` shows `PRIVACY_POLICY.md` is NOT changed, which is correct. |
| No secrets / API keys added to source | Pass — grep of added frontend lines for `api[_-]?key`/`secret`/`token`/`password`/`Bearer`/`EBIRD`/`OPENWEATHER`: no matches. |
| No new persistence / storage-seam bypass | Pass — `pointSize` is session-only `useState` (comment at `MapExplorer.tsx:180`), matching `displayMode`; no `localStorage`, no `storage` seam write, nothing persisted across relaunch. |
| Hidden ("Off") points are not still interactive — no dangling/stale listener | Pass — `pointsShown = displayMode === 'pins' && pointSize !== 'off'` (line 97) is the effect's early-return guard (line 103) AND an effect dependency (line 122). When Off, the effect's cleanup runs (`map.off('click'/'mouseenter'/'mouseleave')` + cursor reset, lines 116–121) and no new listeners are attached; with no `sr-sight-circle` layer rendered, `queryRenderedFeatures` has nothing to hit. No dangling handler, no leaked listener, no still-clickable hidden target. |
| No security control weakened by the `pinRadiusExpr` / `pinFillRadiusExpr` refactor | Pass — the refactor adds an optional numeric `factor` (default `1`) and `scaleRadius` (a `toFixed(4)` numeric tidy). Default path is byte-identical; the stroke width is deliberately left unscaled. Pure geometry math, no trust-relevant logic. |
| Shade / heatmap layering (existing security-adjacent invariant) preserved | Pass — `shadingFillId` beforeId ordering, `ATLAS_DIM_FACTOR` dim, and the keyed `<Source>` (`sr-sight` / `sr-heat`) remount guard against the "source id changed" crash are all unchanged; Point Size composes multiplicatively with the auto-dim. |
| Module-level `/g` regex hygiene | Pass — N/A; no regex added or touched in this change. |
| Test additions introduce no unsafe pattern | Pass — `SightingMarkers.test.tsx` and `mapPins.test.ts` additions contain no `eval`, `innerHTML`, `dangerouslySetInnerHTML`, network, or secret patterns. |

---

## Notes (informational, non-blocking)

- Accessibility is not the Auditor's gate, but nothing observed contradicts
  `ACCESSIBILITY.md`: the new `SegControl` carries `ariaLabel="Point size"` and
  the segmented-toggle `aria-pressed` contract (Stage 3 Tester already
  confirmed the label + `aria-pressed`). No new focusable hidden target is
  introduced — the "Off" path removes the layer rather than hiding a live one.

No convention flags — the change adheres to existing standing security checks;
nothing new needs codifying in CLAUDE.md.
