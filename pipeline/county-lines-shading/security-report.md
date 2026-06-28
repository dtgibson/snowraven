# Security Review — County Lines & Shading

**Date:** 2026-06-28
**Feature:** county-lines-shading
**Stack:** python-fastapi (configured backend) — **but this change is frontend-only**; `backend/` is clean (confirmed via `git status`). Frontend is `react-vite-tailwind`.
**Checklist:** No `reference/checklists/security-*.md` ships in this repo. Applied the React/Vite web-security lens + SnowRaven's documented security conventions (CLAUDE.md "Security — standing checks" + the map/overlay security rules): escaped-JSX map popups, eBird id shape-guards + `encodeURIComponent`, `/g` regex hygiene / linear-by-construction over untrusted text, no secrets in source, and the privacy posture (bundled data + device-to-provider only).
**Outcome:** PASSED WITH NOTES

---

## Summary

County Lines & Shading is a clean, privacy-respecting frontend overlay built as the structural twin of the shipped Atlas overlay, and it follows SnowRaven's documented security conventions closely. Every piece of dynamic text in the county popup and the in-view list is rendered as escaped JSX (county/state names, species via `<BirdName>`, locations via `<HotspotLink>`); there is no `dangerouslySetInnerHTML` anywhere in the feature's code. The eBird county-region link is strictly shape-guarded (`^US-[A-Z]{2}-\d{3}$`), `encodeURIComponent`-wrapped, and degrades to plain text on any bad/missing id. The feature adds no new network provider and makes zero network calls for the overlay itself once the bundled geometry loads, so `PRIVACY_POLICY.md` needs no change. **No Critical or High findings — deployment is not blocked.** Three Informational notes are recorded below (a pre-existing weaker region link the change touches, the build script's supply-chain/integrity posture, and a defensive fill-color fallback), all surfaced per policy; none require action before ship.

---

## Findings

### 1. Pre-existing Statistics county-region link uses a looser guard than the new code (touched by this change)

**Severity:** Informational
**Location:** `frontend/src/components/BirdingStats.tsx:884` (and the parallel block ~917) — `href={`https://ebird.org/region/${sp}`}`, gated on `validSp = sp && sp.includes('-')`.
**Description:** This feature re-keys `computeGeo` so same-named counties in different states now emit separate rows, and it edits these exact two render blocks (the React `key=` fix). The interpolated `sp` is the user's CSV-derived `State/Province` value, gated only by `sp.includes('-')` and **not** `encodeURIComponent`-wrapped — looser than the new `CountyLayer` region link (strict `^US-[A-Z]{2}-\d{3}$` + encode). It is **not exploitable**: the href scheme/host prefix is a fixed `https://ebird.org/region/` literal (no scheme-injection possible by appending), and React escapes attribute values (no HTML/attribute injection). Worst case is a harmless malformed URL on the ebird.org host. Flagged only because the change increases the number of rows flowing through this path and touches these lines.
**Remediation:** Optional hardening — route these two links through the same posture as the new code (a state-code shape guard, e.g. `^US-[A-Z]{2}$` / `^[A-Z]{2}-[A-Z0-9]+$`, plus `encodeURIComponent(sp)`), or migrate them to a shared region-link helper. Safe to defer; no security impact today.
**Status:** Open (pre-existing; non-blocking)

### 2. Build script trusts the Census download via HTTPS + structural guards, not a checksum; pulls mapshaper via `npx` at run time

**Severity:** Informational
**Location:** `scripts/build-county-boundaries.mjs` (`fetch(SOURCE_URL)`, `execFileSync('npx', MAPSHAPER_ARGS(...))`).
**Description:** The asset generator fetches a pinned Census Cartographic Boundary `.zip` over HTTPS and runs `npx --yes mapshaper@0.6.102` to transform it. There is no integrity hash on the downloaded zip (trust rests on HTTPS + the hard guards: `MIN_FEATURES` floor, raw/gz size ceilings, 5-digit-geoid check, coordinate-range check), and mapshaper is resolved from the npm registry at run time (version-pinned, but not lockfile-pinned). This is a **build/release-time developer tool, never shipped to users** — `us-counties.json` is a committed, reviewable artifact — so the runtime app is unaffected. `execFileSync` is used (no shell), with all args from constants/temp paths (no injection vector), and the source URL is a hardcoded pinned US-gov public-domain endpoint. Source-trust posture is sound for a dev tool.
**Remediation:** Optional — pin a SHA-256 of the expected Census zip (or vendor mapshaper as a pinned devDependency) for reproducibility/tamper-evidence. Not required; the structural guards already hard-fail on a degraded/truncated result.
**Status:** Open (build-time only; non-blocking)

### 3. Defensive `#000000` fill fallback in the MapLibre match expression

**Severity:** Informational
**Location:** `frontend/src/components/map/CountyLayer.tsx:175` — `'fill-color': ['match', ['get','tier'], 1..4, …, '#000000']`.
**Description:** The fill-color match falls back to opaque black for any `tier` outside 1–4. This is never visible — `fill-opacity` is `0` for `tier 0` (the only out-of-range value the data produces, since tiers are computed over the data's own values), so the black is fully transparent. No correctness or security impact; noted for completeness against the "no hardcoded hex" convention (a theming/contrast matter for QA/Evaluator, not a security issue). The hardcoded `line-color: rgba(71,85,105,0.85)` and toggle-knob `#fff` are likewise theming-convention items, out of security scope; AA contrast is covered by `countyContrast.test.ts`.
**Remediation:** None required for security. If desired, fold the fallback/line colors into `--sr-*` tokens for theming-convention consistency.
**Status:** Open (cosmetic/convention; non-blocking)

---

## Checks Performed

| Check | Result |
|---|---|
| XSS — county name in popup rendered as escaped JSX | Pass — `{sel.name}` / `stateNameFor(sel.stusps)` as JSX children |
| XSS — species names in popup escaped | Pass — via `<BirdName commonName={…}>` (renders `{commonName}` as JSX children) |
| XSS — location names in popup escaped | Pass — via `<HotspotLink name={…}>` (plain branch renders `{name}` as JSX) |
| XSS — in-view list county names / counts escaped | Pass — `{row.name}`, `{value.toLocaleString()}` as JSX children |
| No `dangerouslySetInnerHTML` in feature code | Pass — none in `CountyLayer.tsx` / `countyBoundaries.ts` / `countyShading.ts`; the two in `MapExplorer.tsx` (lines 1410/1640) are pre-existing static SVG constants, untouched |
| eBird region link — strict shape guard before href | Pass — `deriveCountyRegionCode` gates on `^US-[A-Z]{2}-\d{3}$`, returns `null` otherwise |
| eBird region link — `encodeURIComponent` on interpolation | Pass — `${REGION_URL}${encodeURIComponent(selRegion)}` |
| eBird region link — degrades to plain text on bad/missing id | Pass — `selRegion ? <OutboundLink…> : <div>{sel.name}</div>` |
| eBird region link — fixed scheme/host prefix (no scheme injection) | Pass — `REGION_URL = 'https://ebird.org/region/'` constant |
| Top-locations link via `HotspotLink` / `isPublicHotspot` | Pass — id `LOCATION_ID_RE`-guarded + public-hotspot Set gate; plain text otherwise |
| Region-code guard unit-tested (incl. malformed inputs) | Pass — `countyBoundaries.test.ts` covers `06097→US-CA-097`, `''`/`'6097'`/`'abcde'`→null, regex shape |
| Regex hygiene — name normalization is linear / anchored | Pass — `normalizeCountyName` uses fresh literal regexes in `.replace`, no nested quantifiers, suffix-strip `$`-anchored |
| Regex hygiene — no shared `/g` `lastIndex` / `matchAll` pitfall | Pass — `/g` literals used only in `.replace` (resets `lastIndex`); none reused across `matchAll` |
| Regex hygiene — region/geoid guards bounded & anchored | Pass — `^\d{5}$`, `^US-[A-Z]{2}-\d{3}$` |
| Network — no new provider introduced | Pass — overlay is bundled geometry + client-side join |
| Network — overlay makes zero calls once geometry loads | Pass — lines/fill/popup/legend/in-view list are all local |
| Network — `useHotspotSet()` reuses the disclosed cached `/map/hotspot-region` | Pass — same eBird `ref/hotspot` endpoint other tabs already use; sends a region code, not user sightings |
| Privacy — `PRIVACY_POLICY.md` accuracy (NFR-04) | Pass — no new provider/request type; map-tiles + eBird/Cornell disclosures remain true; **no change required** |
| Privacy — nothing about the user's data transmitted by the overlay | Pass — join is local over the already-parsed backup |
| Secrets — none in new source or the build script | Pass — `--sr-county-*` matches are CSS-token names, not credentials |
| Geometry asset trust — bundled, validated at build | Pass — public-domain Census data; build guards on feature count, size, geoid shape, coord range |
| Build script — no shell injection | Pass — `execFileSync` (no shell), args from constants/temp paths only |
| Build script — pinned source URL + tool version | Pass — `VINTAGE`-pinned HTTPS Census URL, `mapshaper@0.6.102` pinned (integrity note → Finding 2) |
| Build script — fetched data not shipped raw | Pass — output is the committed, reviewable `us-counties.json` artifact |
| DoS — viewport cap bounds rendered features | Pass — `COUNTY_CAP = 800`; over-cap returns empty + "zoom in" hint |
| DoS — in-view list cap bounds row count | Pass — `countyListRows` caps at `MARKER_LIST_CAP` with over-cap hint |
| DoS — popup top-k bounded | Pass — `topByCount … slice(0, TOP_N=3)` |
| DoS — aggregation/tiers linear over parse-once cache | Pass — single passes over obs/checklists; `computeCountyTiers` is an `O(n log n)` sort over ≤~3k non-zero counties |
| Trust boundary — user CSV strings treated as untrusted display text | Pass — all rendered via escaped JSX; ids shape-guarded before becoming links |
| Marker-click arbitration (no popup hijack) | Pass — `queryRenderedFeatures` against marker layers short-circuits the county click |
| Shared-code re-key preserves Statistics table behavior | Pass — `computeGeo` output shape unchanged; React keys re-keyed to `${stateProvince}-${name}` to avoid duplicate-key collisions from the new split rows |
| Defensive fill fallback never visible | Pass — `#000000` only reachable at `tier 0`, which has `fill-opacity 0` (Finding 3, cosmetic) |
| Entry-chunk exclusion enforced (NFR-03) | Pass — `entryChunk.test.ts` walks App's static import graph asserting `CountyLayer.tsx`/`us-counties.json`/maplibre are not statically reachable |

---

## Convention Flags

None. The feature already adheres to the established conventions (escaped-JSX popups, shape-guarded + encoded eBird id links, linear regex over CSV text, bundled-data privacy posture). No new standing security rule is warranted — the existing CLAUDE.md "Security — standing checks" already cover these patterns, and this feature is a faithful application of them. The optional hardening in Finding 1 (uniform region-link guard/encode) is a code cleanup, not a new convention.
