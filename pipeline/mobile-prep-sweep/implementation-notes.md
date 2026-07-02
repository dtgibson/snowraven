# mobile-prep-sweep — Implementation Notes

**Version:** 0.5.54 → 0.5.55 (patch)
**Kind:** Mobile-readiness responsive fix pass (71 findings) + four recorded tidies.
User-facing impact is visual repair of existing behavior only — no new controls,
surfaces, or copy.

---

## What / Why

A bundled Improve run ahead of a future mobile build. Two halves:

1. **Responsive/mobile audit fix set** — the full 71-finding sweep (3 high, 20
   medium, 48 low) from `responsive-audit.md`. Every finding is visual repair of
   existing screens so the app holds on a 320–430px phone at 200% in-app text
   scale, with no horizontal page scroll.
2. **Four recorded tidies** — deferrals from the v0.5.52 efficiency sweep (#2/#3/#4)
   plus v0.5.54's two QA coverage gaps (#1). All are output-identical / faster /
   dead-code / tests-only, so they carry no user-facing behavior change.

---

## How to test

Full CI mirror, all green at integration:

| Gate | Command | Result |
|---|---|---|
| Frontend install | `cd frontend && npm install` | removed 1 pkg (geolocation), 0 vuln |
| Unit (vitest) | `cd frontend && npx vitest run` | **1253 passed** / 105 files (baseline 1240 + 13 new) |
| Lint | `cd frontend && npm run lint` | clean |
| Build (pre-push gate) | `cd frontend && npm run build` (`tsc -b && vite`) | passed, no type errors |
| Entry-chunk guard | `grep` `dist/index.html` modulepreload | no `vendor-maplibre` / `us-counties` / county entry |
| Backend (pytest) | `cd backend && .venv/bin/python -m pytest tests/` | **172 passed** (baseline 163 + 9 new) |
| Desktop compile | `cd src-tauri && cargo check` | Finished, compiles after geolocation removal |

Manual smoke (reviewer): on a 320–430px viewport at 200% text scale, confirm no
horizontal page scroll on any tab; open a shaded-county completeness popup / a
sighting-pin popup taller than the viewport and confirm it scrolls internally;
tap a search/filter/date input on iOS and confirm no page auto-zoom; confirm
"Use my location" still works (native `get_location`, unaffected by the plugin
removal).

---

## Tidy outcomes

1. **Test hardening (#1, QA gaps).** Added a shared-fixture parity test locking
   the dual-transport taxonomy-collapse twins (`collapse_to_species_list` ↔
   `collapseToSpeciesList`), previously lockstep-by-comment only:
   `backend/tests/test_taxonomy_collapse_parity.py`,
   `frontend/src/lib/taxonomyCollapse.parity.test.ts`, shared
   `taxonomyCollapse.fixture.json`. Plus direct `renderHook` tests of
   `useCountyCompleteness`'s eager-fetch gating (birded-only, TTL skip, pool-of-4
   cap, in-flight/queue dedupe, no-key gate) in `useCountyCompleteness.test.ts`.
   **Outcome:** either twin drifting now fails the suite; the hook's fetch gating
   is locked.

2. **Pooled httpx client (#2).** New `backend/http_client.py` — one process-wide
   `httpx.AsyncClient` replaces the ~13 per-call `async with
   httpx.AsyncClient()` sites across routers/services. **Lazy singleton, NOT
   lifespan-created** (the test suite mounts `TestClient(app)` at module scope
   without a context manager, so lifespan startup never runs — a lifespan-created
   client would be `None` under every test). `main.py`'s lifespan only *closes*
   it on shutdown. Per-request timeouts preserved by passing `timeout=` at each
   `.get()`/`.post()`. Test mocks reworked from constructor-patching to patching
   the shared accessor. **Outcome:** zero `httpx.AsyncClient(` in routers/services
   (verified); pooled keep-alive connections reused; all backend tests green.

3. **Codes-independent recent-obs cache (#3).** The underlying eBird
   `data/obs/geo/recent` fetch is deduped on `(lat,lng,dist)` with the `codes`
   filter applied *after* the cached fetch, in BOTH runtimes
   (`backend/routers/map.py` and `frontend/src/lib/tauri/mapService.ts`), so
   Media Targets + Nearby Lifers at the same center share one eBird fetch. 90 s
   TTL (matches `networkCache`); desktop API-key-change invalidation honored; the
   optional-`codes` route contract and lat/lng/dist bounds preserved.
   **Outcome:** two same-center calls (with/without codes) hit eBird once.

4. **Dead geolocation plugin removal (#4).** Removed
   `@tauri-apps/plugin-geolocation` (JS dep + lockfile),
   `tauri-plugin-geolocation` (`Cargo.toml` + `lib.rs` registration + Cargo.lock),
   and the three `geolocation:*` capability grants. Zero JS imports existed;
   location stays on the native `get_location` command, untouched. This REVERSES
   the 2026-05-26 note "plugin remains registered for future iOS/Android" —
   re-adding is a 3-line change if the mobile app is even Tauri-based, and
   shipping dead capability grants is the worse standing state. **Outcome:** zero
   dead-plugin refs in source; desktop compiles; "Use my location" intact.

---

## Responsive fix summary (by audit theme)

All fixes EXTEND the v0.5.37 class-based system (lift-to-class, established
breakpoint tiers, size-in-rem) — no inline responsive styles introduced. Across
23 component files + shared `globals.css`.

- **Map-popup max-height / internal scroll (3 high).** Tall map popups (county
  completeness card, sighting / target / nearby-lifer marker lists) capped and
  made to scroll internally via the new `.sr-map-popup-body`
  (`max-height: min(60dvh, 26rem); overflow-y: auto; overscroll-behavior:
  contain`) so they never run off a short phone viewport.
- **Touch-target sizing.** Dense fixed-height controls (icon-only buttons,
  segmented pills, jump-nav chips, reorder/eye buttons, copy buttons) raised
  toward ~44px on phones only, via `.sr-touch-target` (min-height lands in the
  ≤640 tier) and the coarse-pointer rule on `.maplibregl-popup-close-button`.
- **iOS sub-16px input auto-zoom.** Form controls carrying a sub-16px inline
  font-size get `.sr-input-16` (font-size 16px in the ≤640 tier only) — the one
  place a px font-size is correct, since the iOS zoom threshold is an absolute
  px value. Suppresses focus-zoom without a `maximum-scale` that would kill
  pinch-zoom. `index.html` viewport gained `viewport-fit=cover`.
- **Inline layout lifted to classes / wrap.** Overflowing inline `display:flex`
  rows (SegControl, sort-pill groups, radio-group rows, label+value headers)
  wrap via `.sr-wrap-flex`; `.sr-map-layers-seg` gained `flex-wrap` so the
  Map/Satellite/Topo row folds instead of being clipped.
- **px→rem width corrections.** Hardcoded px widths (e.g. CountyLayer popup
  `232px` → `14.5rem`; BirdingStats grid track `minmax(248px, 1fr)` →
  `minmax(min(248px, 100%), 1fr)`) so layouts hold at 200% text scale and
  self-collapse below the track width instead of overflowing a phone.

---

## Convention flags (for future features)

- **Use the four new `globals.css` classes** rather than re-inlining the
  equivalent:
  - `.sr-touch-target` — add to any dense, fixed-height button/pill that ships a
    sub-44px hit area; the min-height lands only ≤640 (desktop density
    untouched). Does not change the visible glyph/label size.
  - `.sr-map-popup-body` — wrap the inner content div of any new map popup that
    can grow tall; it scrolls internally and contains overscroll.
  - `.sr-input-16` — add to any new `<input>`/`<select>`/date-time control that
    carries a sub-16px inline font-size, to suppress iOS focus-zoom.
  - `.sr-wrap-flex` — for inline flex control groups/header rows that would
    otherwise overflow at large text scale; lift the inline `display`/`flex-wrap`
    here, keep gap/colors inline (or `--sr-wrap-gap`).
- **The `[0-9]`-not-`\d` rule** for id-shape guards (`SUBMISSION_ID_RE` etc.)
  already exists in CLAUDE.md and is unchanged by this run — noting it here so the
  next builder doesn't reintroduce a `\d` shortcut.
- **No inline responsive styles** — make a container respond by lifting its
  `display`/grid/flex to a class (inline styles are specificity 1,0,0 and beat
  class rules and can't be reached by a media query). Colors/padding/borders stay
  inline (tokens only). The px→rem and `min(…px, 100%)` self-collapse patterns
  above are the sanctioned inline exceptions (responsive-by-construction, no
  breakpoint math).
- **Pooled backend HTTP** — new backend outbound calls must use
  `http_client.get_client()` + `await client.get(..., timeout=...)`, NOT `async
  with httpx.AsyncClient()`. Pass the per-request `timeout=` at the call site
  (the shared client carries no default). Never close the shared client per
  request.

---

## Known limitations / notes

- **Geolocation reversal is deliberate.** If the future mobile app is Tauri-based
  and needs native geolocation, the plugin re-add is ~3 lines (Cargo.toml +
  lib.rs + capability grants). Shipping the dead grants now was the worse
  standing state; this is a logged decision reversal.
- **`.sr-touch-target` phone-only.** The ~44px min-height lands only in the ≤640
  tier by design; desktop controls keep their intentional compactness. A control
  that must be 44px on desktop too needs its own rule.
- **`us-counties` / `vendor-maplibre` bundle sizes** exceed the 1100 kB warn
  limit (on-demand chunks off first paint) — expected, unchanged by this run,
  and covered by `entryChunk.test.ts`.
- **PRIVACY_POLICY.md unchanged** — none of the tidies add a network call,
  analytics, telemetry, or third-party service. The pooled client reuses the
  existing eBird/weather/tide endpoints; the recent-obs cache dedupes existing
  calls; geolocation removal removes a capability. Confirmed no change needed.
- **cargo `snowraven v0.0.0`** in `cargo check` output is the crate version in
  `Cargo.toml` (intentionally 0.0.0) — the bundle version is sourced from
  `tauri.conf.json` (bumped to 0.5.55), per the CLAUDE.md versioning rule.

---

## Reviewer notes

- Version bumped in BOTH `frontend/package.json` and `src-tauri/tauri.conf.json`
  (lockstep, 0.5.55). CHANGELOG top entry added (user-voice: mobile pass +
  behind-the-scenes tidies).
- Docs touched light where descriptions meet the map popups / mobile posture:
  `docs/HELP.md` (Tab Layout section — popup internal scroll + wrapping/tap-size
  note), `website/index.html` (version pill + footer to 0.5.55). README already
  describes the responsive posture; no change needed. PRIVACY_POLICY unchanged.
- **Not committed or tagged** — the Deployer owns commit/tag/`release.sh`.
