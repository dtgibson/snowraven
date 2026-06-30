# Security Review — Colorblind-Accessible County Shading ("Use Textures")

**Date:** 2026-06-29
**Feature:** colorblind-county-shading (Feature lane, Stage 7)
**Version:** 0.5.51
**Stack:** react-vite-tailwind frontend + python-fastapi backend (change is frontend-only)
**Checklist:** security-react-vite (client-side) — scoped proportionally to what changed
**Outcome:** PASSED — clean pass (no findings)

---

## Summary

The "Use Textures" feature adds a client-side, colorblind-accessible rendering option to the
existing county-shading overlay: shaded counties can be painted as per-tier canvas crosshatch
sprites instead of flat color. The change is pure runtime geometry — no network calls, no user or
external input, no new dependencies, no data-handling or popup changes, and no new
`dangerouslySetInnerHTML`/`eval`/`innerHTML` sinks. There is no security surface to exploit; this is
a clean pass with zero findings.

---

## Verdict

**CLEAN PASS.** No Critical, High, Medium, Low, or Informational findings. Deployment is not blocked.

---

## Findings

No security issues found in this feature.

---

## Threat-model checks (scoped to the diff)

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Injection / XSS — new `dangerouslySetInnerHTML` / `innerHTML` / `eval` / template-injected text | **Pass** | Grep of all four changed code files found ZERO new dangerous sinks. The new SVG swatch (`CountyDensitySwatch`) is escaped JSX interpolating only numeric coordinates and app-controlled `--sr-county-N-rgb` token names — no user/external text, no `<pattern>` id injection. The canvas sprite (`countyTextures.ts`) draws geometry only, renders no text. The two pre-existing `dangerouslySetInnerHTML` in `MapExplorer.tsx` (L1477/L1712) are untouched by this diff and bind static SVG constants (`TEARDROP_HTML`/`MEDIA_ICONS`) keyed by app-controlled values — out of scope. |
| 2 | Untrusted input into sprite ids / `fill-pattern` / `map.addImage` | **Pass** | Sprite ids are hardcoded constants (`COUNTY_HATCH_IMAGE_ID`, `sr-county-hatch-1..10`). Tier is `1..10` from the trusted `computeCountyTiers` quantile computation, read via `['get','tier']` against literal `match` arms (fallback = a valid hidden tier-1 image). The `styleimagemissing` handler scopes to OUR ids only via `countyHatchTierForImage`, which returns `null` for any foreign id — so a foreign id can never drive `addImage`. No CSV/user/network value reaches any of these paths. |
| 3 | Network / privacy / providers — new fetch, tile/data provider, bundled remote asset, telemetry, analytics | **Pass** | `countyTextures.ts` has NO imports and NO network calls — sprites are generated at runtime from `<canvas>`. No new `fetch`/`transport`/provider in any changed file. **NFR-02 / QA-21 confirmed:** `PRIVACY_POLICY.md` is UNCHANGED and needs no change (no new browser→third-party request). The popup, the eBird region link (still `encodeURIComponent`-wrapped + shape-guarded), and all data handling are untouched. |
| 4 | Resource / DoS — sprite generation bounded | **Pass** | `addAll()` loops a FIXED 10 tiers, invoked only on mount, on `data-theme` change (MutationObserver), and on-demand for our own ids via `styleimagemissing`. NOT per-frame and NOT on `moveend`. Idempotent via `hasImage → updateImage : addImage`. Bounded. |
| 5 | Supply chain — new dependency | **Pass** | `frontend/package.json` diff is the version bump (0.5.50→0.5.51) ONLY; no dependency added/changed. Lockfiles (`package-lock.json` et al.) UNCHANGED. |
| 6 | Secrets / data exposure — new logging or exposure of keys/tokens/paths/user data | **Pass** | No `console`/logging added; no key, token, path, or user data flows through the new code. The toggle is session-scoped `useState(false)`, deliberately NOT persisted through the storage seam (NFR-06 / QA-24) — no new data at rest. |
| 7 | Website — third-party request introduced | **Pass** | `website/index.html` diff is copy (one feature sentence) + version pill/footer (0.5.50→0.5.51) ONLY. No new outbound URL, `src=`, CDN, font, or analytics on any added line — the site's no-third-party-request promise holds. |

---

## NFR / QA confirmations

- **NFR-02 / QA-21 (no network/provider/asset/telemetry):** confirmed — runtime canvas sprites only,
  no fetch, no new provider, no bundled remote asset, no analytics.
- **PRIVACY_POLICY.md:** unchanged and correctly so — this change exposes nothing browser→provider.
- **No new dependencies:** confirmed — `package.json` is a version bump only; lockfiles untouched.

---

## Checks Performed

| Check | Result |
|---|---|
| New file `lib/countyTextures.ts` — sinks / network / input review | Pass |
| `CountyLayer.tsx` — `addImage`/`fill-pattern`/`styleimagemissing` id scoping | Pass |
| `CountyLayer.tsx` — popup + eBird region link unchanged (shape-guarded, `encodeURIComponent`) | Pass |
| `MapSidebarUI.tsx` — `CountyDensitySwatch` SVG (numeric coords + token names only) | Pass |
| `MapExplorer.tsx` — toggle (`role="switch"`, session `useState`, no persistence) | Pass |
| No new `dangerouslySetInnerHTML` / `innerHTML` / `eval` | Pass |
| No new fetch / tile or data provider / bundled remote asset / telemetry | Pass |
| No new dependency (`package.json` / lockfiles) | Pass |
| No secrets / user data logged or exposed | Pass |
| `PRIVACY_POLICY.md` unchanged (correctly) | Pass |
| Website change is copy + version only — no third-party request | Pass |
| Resource bounds — 10 fixed tiers, mount/theme only, not per-frame | Pass |
