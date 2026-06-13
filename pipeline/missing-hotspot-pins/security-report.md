# Security Review — missing-hotspot-pins (0.5.30)

**Date:** 2026-06-11
**Feature:** missing-hotspot-pins (Fix lane — hotspot sprite registration + heatmap toggle crash)
**Stack:** python-fastapi backend / react-vite frontend (diff is frontend-only; backend untouched)
**Checklist:** `security-react-vite.md` (full) · `security-fastapi.md` (confirmed not applicable — zero backend files in the diff)
**Outcome:** PASSED

---

## Summary

Two map bug fixes were reviewed: unconditional sprite registration with a
`styleimagemissing` safety net in `HotspotMarkers.tsx` and `AtlasLayer.tsx`,
and keyed branch `<Source>`s in `SightingMarkers.tsx` that stop an
app-crashing in-place source-id mutation. The fixes add no network calls, no
new dependencies, no HTML-string rendering, and no new regexes; the new
event handlers act only on hardcoded sprite-id sets and are removed on
unmount. No security issues found — the fix closes its bugs without opening
new risk.

---

## Findings

No security issues found in this feature.

---

## Fix-Lane Focus — Does the Fix Introduce New Risk?

**1. The `styleimagemissing` listeners (event-driven, fed a MapLibre image-id string).**

- **Ownership is exact-match against hardcoded constants.**
  `hotspotKindForImage` (`HotspotMarkers.tsx`) iterates `HOTSPOT_KINDS` and
  compares `HOTSPOT_IMAGE_ID[kind] === id`; `hatchTierForImage`
  (`AtlasLayer.tsx`) does the same over `TIERS`/`HATCH_IMAGE_ID`. Both id
  tables are module-level string constants (`lib/mapPins.ts:96-104`,
  `lib/atlasTextures.ts:12-20`). The incoming `e.id` is **never** used as an
  object index (no prototype-pollution-shaped access) and never touches a
  regex — a foreign or hostile id costs at most 3–4 string comparisons and
  returns `null`. No attacker-influenceable id can trigger sprite baking or
  any other work.
- **Idempotent.** The handler early-returns on `map.hasImage(e.id)`, so a
  registered image is never re-added (avoiding MapLibre's duplicate-id
  throw), and MapLibre stops firing `styleimagemissing` for an id once it is
  added — no unbounded re-bake loop. Per-event work is one bounded canvas
  bake at most.
- **No listener leak.** Each component adds the listener once per instance
  in a `useEffect(..., [map])` and the cleanup runs
  `map.off('styleimagemissing', onMissing)` plus a `cancelled` guard.
  `HotspotMarkers` remounts per search (`key={hotspotPins.length}`): React
  runs the old instance's cleanup before the new effect, so listeners do not
  accumulate across remounts. The stale `map.off('load', addAll)` cleanup
  was correctly replaced.

**2. Canvas sprite baking on demand.**

`teardropImageData` and `hatchImageData` draw fixed geometry
(`TEARDROP` path constant, per-tier `TILE` sizes) with colors read from
`--sr-*` CSS tokens via `getComputedStyle`, falling back to hardcoded values
(`KIND_FALLBACK`, `'128,128,128'`). No user, CSV, or API data flows into
the canvas drawing or the image ids. All baking is local — zero network
activity.

**3. SightingMarkers keys are render-identity only.**

The diff adds `key="sr-heat"` / `key="sr-sight"` to the two branch
`<Source>`s plus comments — nothing else. No data-flow, filter, or
popup-content changes. `SightingMarkers`' popup builds no links at all
(no `href` in the file); the hotspot popup's eBird link
(`HotspotMarkers.tsx:148,152`) is pre-existing and unchanged — JSX-escaped
attribute, fixed `https://ebird.org/hotspot/` origin, API-sourced id —
consistent with prior audits. `SUBMISSION_ID_RE` and the other id gates are
untouched everywhere.

**4. No security control was bypassed or weakened.** The escaped-JSX popup
posture, the id-validation gates, the keyless-tile-provider seam, and the
transport/storage seams are all untouched by this diff.

---

## Standing Checks (CLAUDE.md — binding)

| Standing check | Result |
|---|---|
| Atlas/marker popups stay escaped JSX — no `dangerouslySetInnerHTML` changes | Pass — zero `dangerouslySetInnerHTML` in the diff; popup code untouched |
| eBird id shape-validation (`SUBMISSION_ID_RE`, `/^L\d+$/`, etc.) before links | Pass — no link-building code changed; gates untouched |
| `CommentText.tsx` / comment encoding contract | Pass — empty diff |
| Module-level `/g` regex hygiene | Pass — the diff adds no regexes at all; lookups are array iteration + `===` |
| `commentBlocks.ts` / weather-tide formatters | Pass — empty diffs |
| Map tile providers ↔ `PRIVACY_POLICY.md` | Pass — `mapStyle.ts` and `PRIVACY_POLICY.md` untouched; the fixes add zero network calls (local GL image registration and React keys only) |

---

## Checks Performed

### React + Vite checklist (scoped to the diff)

| Check | Result |
|---|---|
| No API keys, tokens, or secrets in any changed source file | Pass — diff contains only GL sprite logic, React keys, version strings, changelog prose |
| Only `VITE_`-prefixed env vars client-side / no sensitive `VITE_` values | Pass — no env-var usage added or changed |
| `.env` in `.gitignore`; no credentials in committed config | Pass — `tauri.conf.json` diff is the version field only; no config credentials |
| API calls go through the configured transport seam | Pass — no new API calls; the safety net is a local map event |
| API base URLs not hardcoded | Pass — no URLs added (eBird popup link pre-existing, unchanged, fixed https origin) |
| Error responses handled gracefully | Pass — no error-path changes; the fix removes a crash path (error boundary no longer tripped by the heatmap toggle) |
| Auth state handling | N/A — app has no auth; nothing changed |
| No `dangerouslySetInnerHTML` with unsanitized input | Pass — none in the diff |
| External-data URLs validated before `href`/`src` | Pass — no new `href`/`src`; existing gates untouched |
| Form input validation | N/A — no form changes |
| No new dependencies / no vulnerable packages introduced | Pass — `package.json` diff is version-only; `package-lock.json`, `Cargo.toml` untouched |
| Build output (source maps, debug code, sensitive logs) | Pass — no build-config changes; new exports are production code consumed by the handlers, not test-only dead code |

### Backend checklist

| Check | Result |
|---|---|
| `security-fastapi.md` (all sections) | N/A — zero backend files in the diff (verified via `git status`/`git diff`) |

### New test files

| Check | Result |
|---|---|
| `HotspotMarkers.test.tsx` / `AtlasLayer.test.tsx` — no GL/network mocking masking runtime behavior | Pass — pure-function tests against the real `HOTSPOT_IMAGE_ID`/`HATCH_IMAGE_ID` constants; no map mock at all |
| `SightingMarkers.test.tsx` — mock scope | Pass — `vi.mock` of `react-map-gl/maplibre` is test-file-local; QA proved the test fails on pre-fix code (worktree check), so the stub does not mask the contract |
| Nothing test-only leaks into production imports | Pass — `hotspotKindForImage`/`hatchTierForImage` are pure lookups used by the production handlers themselves |

### Release hygiene

| Check | Result |
|---|---|
| `frontend/package.json` and `src-tauri/tauri.conf.json` both 0.5.30 | Pass |
| CHANGELOG [0.5.30] — two Fixed entries matching the lane scope | Pass |
| `website/index.html` version pill + footer at 0.5.30, no other content change | Pass |
| Diff confined to the allowed file set (3 components, 3 new tests, version files, changelog, website, pipeline bookkeeping) | Pass |

---

## Convention Flags

- A `styleimagemissing` handler (or any map-level event handler fed external
  ids) must act only on an exact-match set of hardcoded ids the component
  owns, guard with `hasImage` before `addImage`, never use the incoming id
  as an object key or regex input, and be removed on unmount. The two
  handlers added in 0.5.30 (`HotspotMarkers.tsx`, `AtlasLayer.tsx`) are the
  reference implementation; future sprite-registering map components should
  follow the same contract.
