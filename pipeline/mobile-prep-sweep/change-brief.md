# Change Brief — mobile-prep-sweep

## What is changing
A bundled Improve run ahead of the mobile launch: four roadmap-tracked internal
improvements plus the full fix set from the responsive/mobile audit (71 confirmed
findings — 3 high, 20 medium, 48 low; the user chose "fix everything now").

**Internal tidies:**
1. **Test hardening** — a shared-fixture parity test locking the dual-transport
   taxonomy-collapse twins (`collapse_to_species_list` ↔ `collapseToSpeciesList`,
   today lockstep-by-comment only), plus direct `renderHook` tests of
   `useCountyCompleteness`'s eager-fetch gating (birded-only, TTL skip, pool-of-4
   cap, in-flight/queue dedupe, no-key gate).
2. **Pooled httpx client** — replace the 13 per-call `httpx.AsyncClient()`
   instantiations across backend routers/services with one shared keep-alive
   client (lazy singleton created on first use + lifespan shutdown — NOT
   lifespan-created, so module-level `TestClient(app)` tests still work),
   preserving each site's per-request timeout; rework the ~19 constructor-patching
   test-mock sites to patch the shared accessor.
3. **Codes-independent recent-obs cache** — dedupe the underlying eBird
   `data/obs/geo/recent` fetch on `(lat,lng,dist)`, applying the `codes` filter
   after the cached fetch, in BOTH runtimes (`backend/routers/map.py` and
   `lib/tauri/mapService.ts`), so Media Targets + Nearby Lifers at the same center
   share one eBird fetch. 90 s TTL (matches `networkCache`); honor the desktop
   API-key-change invalidation.
4. **Dead geolocation plugin removal** — `@tauri-apps/plugin-geolocation` (JS
   dep), `tauri-plugin-geolocation` (Cargo.toml + lib.rs registration), the three
   `geolocation:*` capability grants, and lockfiles. Zero JS imports exist;
   location stays on the native `get_location` command, untouched.

**Responsive fixes (71):** grouped by the audit's five themes — map-popup
max-height/scroll (3 high), touch-target sizing, iOS sub-16px input auto-zoom,
inline-style layout lifted to classes, and px→rem width corrections. Full detail
in `responsive-audit.md`. New shared globals.css vocabulary is added once (a
touch-target min-height helper, a popup-scroll container, any field-row variants)
and referenced by the per-file fixes — no inline responsive styles.

## Why now
All four tidies are recorded deferrals now due before the mobile push (#2/#3/#4
deferred from the v0.5.52 audit; #1 closes v0.5.54's two QA coverage gaps). The
responsive audit is the explicit mobile-readiness gate: the app must hold on a
320–430px phone at 200% text scale before the native mobile app ships.

## User-facing impact
Tidies: none (tests-only / output-identical / faster / dead-code). Responsive
fixes: visual repair of EXISTING behavior only — better wrapping, reachable popup
content, larger touch targets, no iOS auto-zoom. No new controls, surfaces, or
copy. (Per the scope fork, any finding that had crossed into new-feature
territory would have been split out; none did — all 71 are visual repair.)

## Decisions touched
- **v0.5.52 efficiency sweep** — this run executes its three deferred Horizon
  items (#2, #3, #4).
- **v0.5.54 County Completeness** — closes its two tracked QA coverage gaps (#1);
  its dual-transport lockstep contract is what #1 locks and #3 must preserve.
- **2026-05-26 native-location decision** — its note "`tauri-plugin-geolocation`
  remains registered for future iOS/Android" is REVERSED by #4 (Chronicler logs
  the reversal). Ratified: re-adding is a 3-line change if the mobile app is even
  Tauri-based; shipping dead capability grants is the worse standing state.
- **v0.5.35 Nearby Lifers** — #3 preserves the optional-`codes` route contract and
  the lat/lng/dist bounds.
- **v0.5.37 responsive sweep** — the audit fixes EXTEND its class-based system
  (lift-to-class, established breakpoint tiers, size-in-rem), never inline styles.
  This run adds two lenses that sweep never covered (touch-target size, iOS input
  behavior).

## What done looks like
- Tidies: #1 parity test fails if either twin drifts + hook gating locked;
  #2 zero `httpx.AsyncClient(` in routers/services, all backend tests green after
  mock rework; #3 two same-center calls (with/without codes) provably hit eBird
  once in both runtimes; #4 zero geolocation references, desktop build compiles,
  "Use my location" still works.
- Responsive: all 71 findings resolved with the class-based approach; no inline
  responsive styles introduced; the app holds with no horizontal page scroll at
  320px and 200% text scale across every surface; touch targets on fixed controls
  meet the ~44px posture in the ≤640 tier; no sub-16px form controls on phone.
- Full CI mirror green (vitest + pytest + lint + build + entry-chunk guard); one
  minor version bump (0.5.54 → 0.5.55, both version files), changelog, tag,
  `release.sh`. HELP/README/website refreshed where behavior descriptions touch
  the map popups or the mobile posture; PRIVACY_POLICY unchanged (no new calls).
