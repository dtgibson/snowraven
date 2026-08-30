# CLAUDE.md

This file is auto-loaded by Claude Code at the start of every session.
It holds pipeline conventions, tool rules, and project-specific
decisions that all builders must follow.

## Versioning

- Version is tracked in `frontend/package.json` (semver, patch increments for small features/fixes, minor for larger features)
- **Bump BOTH `frontend/package.json` AND `src-tauri/tauri.conf.json` to the same version.** `tauri.conf.json` is the source of the desktop *bundle* version (macOS `CFBundleShortVersionString`, Windows installer version, and the in-app updater's version check) and does NOT read from `package.json`. Forgetting it ships a mislabeled bundle and breaks the updater; `release.sh`'s version guard catches the macOS side, but the Windows installer is built by CI from `tauri.conf.json` at the tagged commit, so the tag must point at a commit where both are bumped. (Patch-only by default — never minor/major unless explicitly told.)
- `CHANGELOG.md` at the repo root must be updated with every version bump
- **Always bump the version and update the changelog when adding a feature or fix**, even if the user does not ask
- **A dev-only / toolchain change that does NOT affect the shipped bundle — a dev-dependency `npm audit fix`, a lockfile refresh, test-only tooling — does NOT require a version bump, changelog entry, tag, or release.** It produces a byte-identical app, so commit it straight to `main`; it reaches the release machine on the next `git pull`. The "always bump" rule above is about user-facing features and fixes. (Precedents in `DECISIONS.md`: the `dev-dependency-cleanup` `undici` patch, and the Node-25 release-tooling fix — both "no version bump.")
- **After pushing a version bump, run `./release.sh`** to build, notarize, and publish the macOS desktop app. This script creates the GitHub release (or uploads to an existing one), signs the updater bundle, and generates `latest.json` for in-app update detection. Credentials (Apple API key, notarization) stay local — never stored in GitHub.
- **Do not use `gh release create` directly** for desktop app releases — always use `release.sh` so the signed binary and `latest.json` are included. The in-app update check depends on `latest.json` being present in the release assets.
- **Tauri v2 macOS updater mechanism:** `downloadAndInstall` performs synchronous in-place bundle replacement — no shell script, no sleep, no `open -a`. The `.app` bundle is fully replaced on disk before the Promise resolves. After `downloadAndInstall` returns, call `relaunch()` (not `exit(0)`). `relaunch()` spawns `current_exe` (now the new binary) and exits cleanly. `exit(0)` just terminates the process with no relaunch, leaving the user with no running app.
- **Release rhythm (summary):** bump version → commit → push `main` → push the `vX.Y.Z` tag (starts Windows CI) → wait for CI green → run `./release.sh` → ship the iOS TestFlight build of the SAME version → submit that same build for App Store review. **A release goes to ALL available platforms, every time** (user direction, v0.5.78; the App Store became a standing leg at 1.0.0) — a release is not done until every leg has shipped and been submitted. The full runbook lives in the `snowraven-release` skill (below).
- **Cross-platform Rust deps must live in `[dependencies]`, not `[target.'cfg(target_os = "macos")'.dependencies]`.** `tzf-rs` (used by the cross-platform `get_timezone` command) was mis-scoped there and broke the Windows build with "unresolved import." The macOS-only block is only for genuinely macOS-only crates (objc2*, the CoreLocation stack).
- **iOS app icons must be fully OPAQUE — NO alpha channel — in BOTH `src-tauri/icons/ios/` AND the committed `src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset/`** (App Store Connect rejects the upload otherwise, altool error 90717; desktop icons MAY keep alpha). Flattening detail and precedent are in the release skill.
- **For ANY release, packaging, updater-artifact, TestFlight, or App Store work, invoke the `snowraven-release` skill** (`.claude/skills/snowraven-release/SKILL.md`). It holds the complete mechanics and post-mortem guards moved out of this file: `release.sh` preflights and the pinned-Node story, universal-binary and `latest.json` rules, headless DMG styling and notarization/keychain, the Windows CI artifact-selection guard, and the full iOS build + upload recipe with its env-name mappings. Do not ship from this file alone.

## Pipeline Overview

This project uses the Weft framework. Run /new-feature to start a new feature.

- **This repo's Weft pipeline tracks SnowRaven only.** Never record issues, follow-ups, or status for outside projects (e.g. snowraven-mini, which has its own repo and its own Weft session) in pipeline state, handoffs, ROADMAP.md, or the record files (DECISIONS.md, PRODUCT_CONTEXT.md, CHANGELOG.md). If work here surfaces something about another project, tell the user in chat and stop there — it does not enter this repo's records.

## Conventions

### Ports
- Backend runs on port **1620** (not 8000)
- Frontend dev server runs on port **5173** (Vite default)
- Vite proxies `/weather`, `/tide`, `/nominatim`, and the other backend route prefixes to `http://localhost:1620` (see `frontend/vite.config.ts`). **When you add a backend route, add its path prefix to that proxy.** Otherwise the web-dev path hits Vite's SPA fallback (HTML) instead of the backend and the call silently fails under `npm run dev` — this bit the new `/tide/at` route in 0.5.34 (and, latently, the existing checklist tide, which is normally exercised only via the desktop app or the FastAPI-served build).

### Environment
- API keys live in `backend/.env` — never commit this file

- Required keys: `EBIRD_API_KEY`, `OPENWEATHER_API_KEY`

- OpenWeather key must be subscribed to "One Call by Call" at openweathermap.org

### Running locally
```
# Backend
cd backend && uvicorn main:app --reload --port 1620

# Frontend
cd frontend && npm run dev
```

### Running tests
```
cd backend && python -m pytest tests/ -v
```

### Standing rules and lazy-loaded convention files

The detailed conventions live in `.claude/rules/*.md`. Each auto-loads when you work on files matching its `paths` frontmatter; if your change is related but starts from other files, READ the relevant file first. Never work from these summaries alone, and never weaken a rule without reading its full entry — most rules are backed by guard tests, so an off-path violation still fails the suite.

- **UI construction** — `.claude/rules/ui.md` (colors/theming, responsive layout, accessibility, display-copy conventions). Always true: every color via `var(--sr-*)` tokens in both themes, no hardcoded hex/RGB in components; layout made responsive by lifting to classes, never inline styles; WCAG 2.1 AA holds at 320px and 200% in-app text scale; the in-app brand mark is the shared `RavenGlyph` component, never a lucide bird or a re-inlined copy of its path.
- **Maps** — `.claude/rules/maps.md` (MapLibre layers, overlays, sprites, popups, FABs, tile providers). Always true: all maps render through the shared `<SnowMap>`; maplibre and the county geometry stay OFF the entry chunk (`entryChunk.test.ts` guards it); tile-provider changes are a `PRIVACY_POLICY.md` change.
- **Bird names** — `.claude/rules/bird-names.md`. Always true: every user-facing bird name renders through `<BirdName>`; countability goes through `isNonCountableForm`; ML catalog links build on `ML_CATALOG_BASE`.
- **Testing and verification methodology** — `.claude/rules/testing.md`. Read before writing or judging any frontend test, CSS fix, performance claim, or guard test. Always true: `vitest` + `eslint` are NOT the pre-push gate — run `npm run build` (or at minimum `npm run typecheck`) before pushing.
- **Media embeds** — `.claude/rules/media-embeds.md` (ML embed iframes, the embed-eligibility gate, non-destructive fallbacks).
- **Security standing checks** — `.claude/rules/security.md`. Apply to ANY change touching hrefs/links, regexes over untrusted text, routes, outbound requests, or lookup tables keyed by external strings; a security review must read the file.
- **Weather/tide comment blocks** — `.claude/rules/weather-tide.md` (`stripWeatherTideBlocks` contract, byte-golden moon-phase parity across both runtimes).
- **Backend conventions** — `.claude/rules/backend.md` (datadir single-sourcing, the import-time env gotcha, exact dependency pins, the shared pooled http client).
- **Docs and website** — `.claude/rules/docs-and-website.md`. Always true: `docs/HELP.md` is the single source of truth for in-app help; every feature or behavior change updates `docs/HELP.md`, `README.md`, and `website/` in the SAME change; `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` are published statements that must stay true; no em dashes (U+2014) in user-facing copy or the published prose surfaces.

### Production build
```
./start.sh
```
Builds frontend into `frontend/dist/`, starts uvicorn on port 1620.
FastAPI serves the built frontend as static files automatically.

### Desktop app seams

Permanent architectural seams route all platform-sensitive operations. Use them in new code — do not bypass them.

- **Transport:** `transport.get()` / `transport.post()` from `frontend/src/lib/transport.ts` — for all outbound HTTP calls. In Tauri mode, `TauriTransport` routes each API path directly to a TypeScript service (weather, map, taxonomy, nominatim, stats, version). In web/Pi mode, `WebTransport` delegates to the Python backend.
- **Caching layers — pick by lifetime.** `CACHED_GET_PATHS` in `transport.ts` is the short-TTL (~90s) repeat-call cache; `replayStore` is the live-first offline replay of a last-loaded result. A **long-TTL persistent network cache** ("hold live data for days") follows `lib/countyCompletenessCache.ts` instead: a storage-seam document with an in-memory mirror, TTL-gated reads, per-entry shape validation on load (malformed entries dropped, never thrown on), a strict 250-entry cap plus a `JSON.stringify(data).length` payload-code-unit budget with `order[]` FIFO eviction, an in-flight dedupe Map, errors never cached, and offline stale-reads served for display. Keys, metadata, ordering and the document envelope are outside that budget, and one sole oversized newest payload is allowed; do not call it a byte cap. `replayStore` has the same semantics with a 300-entry cap. `storage.ts` is the persistence seam, not a cache owner; `persistedStyle.ts` has a finite shipped caller graph but its string-accepting API is not structurally bounded. A path served by a durable cache stays OUT of `CACHED_GET_PATHS` — one caching layer per call. `lib/hotspotActivityCache.ts` (6h TTL, FIFO at 2,000) is the second instance of the `countyCompletenessCache` pattern and adds one rule worth copying (v0.5.92): a durable cache computes its DERIVED fields at ONE chokepoint — the cache module's own `dedupedFetch` — so every persisted entry is fixed-shape by a single write path rather than by every caller's discipline. **Sharpened at the third instance, `lib/checklistProjectsCache.ts` (v1.0.5): that chokepoint must also VALIDATE, not merely compute.** Run the candidate entry through the store's own per-entry validator — the same predicate the load path already uses — before merging, so "no out-of-bounds value can exist in this document" is a property of the cache MODULE rather than of whichever producer happens to sit upstream. It matters most where the decision to ship without a payload budget is justified by those very bounds: the projects store shipped with `isValidEntry` present in the module and called on load only, while its write path built entries from a defensive re-read whose contract was strictly weaker than the transport seam's normalizer (no pattern or length bound on the id string, no upper bound or length cap on the id array). Bounds enforced at the seam and again on load are two places the next store's author may simply not wire up; the validator at the write chokepoint is the one that travels with the pattern.
- **A BUNDLED BUILD-TIME ASSET AND A PERSISTED RUNTIME CACHE ARE DIFFERENT TRUST BOUNDARIES, and the per-entry validation rule above applies only to the second (v0.5.89).** The distinguishing question is whether an attacker can change the document without already being able to change the code that reads it. For a Vite-inlined JSON import the answer is no — malformed JSON fails the build, not the user's session — so the correct defenses are **build-time** (a generator that fails closed on implausible output) and **CI-time** (an equivalence test against an independent re-derivation, plus a size bound on the entry chunk), not runtime validation. `ebird-countability.json` is the reference: `build-countability.mjs` hard-fails on short lists, overlapping lists, and a name collision in the inversion; `countableForms.test.ts` asserts it member by member and pins its `version` to the taxonomy snapshot; `entryChunk.test.ts` bounds it. Worth stating because the cache rule is written forcefully enough to be applied where it costs bytes on first paint and buys nothing. **If such an asset ever becomes runtime-loaded, this note inverts and the cache rule applies in full.**
- **A durable cache may hold TWO stores with OPPOSITE retention policies, and the choice follows what an eviction COSTS (v0.5.87).** The escapee document is the reference: its checklist ledger is **FIFO**, because evicting an entry costs one redundant request and loses no answer; its species index uses **admission control** (fill to the limit, then stop admitting, never evict), because evicting there would destroy a paid-for network answer and, at capacity+1, would do so on every pass forever. This is the v0.5.86 rule applied rather than contradicted — capacity+1 is a measurement rule, not a universal policy. Gate admission on the CONTAINER's own size, never a separate counter, and prove it: a test re-merges one species fifty times to show admission capacity is not silently consumed, and both stores are measured at capacity+1 asserting **work done**, not elapsed time.
- **A denormalized, PUBLISHED classification field is a legitimate member of a persistent cache document when a passive reader structurally cannot re-derive it — provided the raw evidence stays the source of truth and the reader CONFIRMS rather than trusts it (v0.5.87).** `ProvenanceSnapshot.excludedNames` is the reference: the Calendar holds no name-to-code join and may not fetch one, so it cannot classify by code; Statistics publishes the escapee-only names, the raw tokens remain in the document, and Statistics always re-derives from them. The passive reader then **confirms** the published list against the persisted checklist ledger using its own observations, so a newly loaded export that adds a carrier re-opens that species offline exactly as it does on Statistics. **Without the confirmation step this is a stale-cache trap**; with it, the offline reader tracks a new export correctly. Stated limit: for a species the passive reader cannot re-open, a published name is only as current as the last Statistics visit.
- **Nominatim has one bounded retention and provider-etiquette contract on both transports (v0.5.86).** Tauri and FastAPI each retain at most 4,096 rounded-coordinate county results with fill-and-stop admission: overflow calls still return their result but do not evict the admitted working set. On desktop, forward search and reverse county lookup share one request-start queue enforcing at least one second between starts, and concurrent reverse calls for the same rounded key share one in-flight Promise. Keep the JS/Python rounded-key semantics in parity, including negative half-step cases.
- **Outbound eBird fetching at volume follows ONE pacing contract on both transports (v0.5.92): spaced request starts + one key-global Retry-After-honoring cooldown + bounded per-item retries — the eBird analogue of the Nominatim queue, at eBird scale rather than Nominatim's mandated 1 s.** The mechanics are pure in `lib/rateLimit.ts`: 150 ms global start spacing (the concurrency pool stays a latency-absorbing ceiling; spacing is the governor); a 429 opens ONE shared cooldown gating every request start (the KEY is over the limit, not a slot), honoring a seconds-form `Retry-After` capped at 60 s, else bounded exponential 2 s → 30 s with jitter; a burst of simultaneous 429s counts as one wave, a post-cooldown success resets the ladder, and the cooldown deliberately survives a pass restart. Bounded retries per item (2), then the honest unanswered state with Retry; a 429 is NEVER cached. The upstream `Retry-After` is parsed, bounded, and re-serialized identically on both transports (`rateLimit.ts` ↔ `_parse_retry_after_seconds` in `backend/routers/map.py`) — never reflected raw — and both transports surface a 429 AS a 429 on EVERY eBird-backed `/map/*` route (one shared mapper per transport: `_raise_ebird_http_error` ↔ `throwEbirdHttpError`; single-sourcing prevents drift, so each route/function still keeps its own 429 test). Two test rules ride with it: anchor timing-policy measurements on CLIENT observation of request starts with a settled main thread, never network-side fulfill timestamps; and `rateLimit.ts` deliberately rides the entry chunk (dependency-free by extraction, policed by `entryChunk.test.ts`). **Scope since v0.5.93: every eBird-backed Map Explorer lookup is governed.** The cooldown/spacing STATE lives in the shared module-scoped gate `lib/ebirdGate.ts` (also entry-chunk-safe); the transport chokepoint routes `/map/hotspots`, `/map/recent-obs`, `/map/hotspot-region`, and `/map/county-species` through `gatedEbirdCall` (serialized spaced starts + cooldown wait-out + the same bounded retries), wired BELOW `CACHED_GET_PATHS` so a cache hit never waits. **One enforcement point per request:** `/map/hotspot-activity` is deliberately NOT transport-gated — the activity controller enforces the identical contract for it over the SAME shared state, so a 429 anywhere slows everywhere. A future eBird-backed lookup joins `EBIRD_GATED_PATHS` (transport.ts) or owns its enforcement over the shared state — never neither, never both. Accepted, stated cost: a transport-cache miss that an inner cache would serve (backend recent-obs single-flight; desktop raw-fetch dedupe) still waits for its start slot, bounded at the spacing floor. Still outside the gate by scope: the non-map eBird families (weather/tide checklist lookups, taxonomy, escapee provenance). **A pass-scale pacing layer rides ON TOP of the gate, in the pass's own controller — never inside gate policy (v1.0.8).** A sweep that must escalate across 429 waves owns that policy itself (the projects sweep: `sweepSpacingMs` in `rateLimit.ts` + the pause in `useChecklistProjects`); the gate contributes observation-only MONOTONIC fields (`waveCount` in `ebirdGate.ts` — never reset by a success, never consulted by gate policy) that a pass reads by DIFFERENCING over its own window, so single-shot lookups never inherit a sweep's escalation or pause. A layered schedule sleeps its FULL widened interval between items: the gate's floor elapses during the sleep, so the two never add, and "widened minus the floor" quietly under-delivers. Slower than the floor is always contract-compliant, so the layer needs no gate-policy change to exist.
- **Storage:** `storage.getApiKey()` / `storage.getSetting()` / etc. from `frontend/src/lib/storage.ts` — for all key, setting, and file access. Do not call `/settings/*` endpoints directly from new components.
- **Platform detection:** `isTauri()` from `frontend/src/lib/platform.ts` — single source of truth for branching on Tauri vs. web. Do not check `window.__TAURI_INTERNALS__` elsewhere.
- **Clipboard:** `copyText()` from `frontend/src/lib/clipboard.ts` — for all clipboard writes. In Tauri mode it uses the native `@tauri-apps/plugin-clipboard-manager` (no user-gesture requirement, so auto-copy after an `await` works); on web it uses `navigator.clipboard` with an `execCommand` fallback. **Do not call `navigator.clipboard` directly** — an async clipboard write that runs after an `await` (outside a click) throws `NotAllowedError` in WKWebView/WebView2 and is silently lost on desktop. The capability grants `clipboard-manager:allow-write-text` only (write, not read).
- **Opening an external URL from code:** `openExternalUrl(url)` from `frontend/src/lib/openExternal.ts` — **never `window.open()`**. `window.open()` is silently dropped in the Tauri desktop WebView (WKWebView never opens the system browser), so an external open works on web but does nothing on desktop with no error (the Weather Backlog's "Copy weather & go" hit exactly this, v0.5.67). The whole app opens external links only via `<a target="_blank">` anchors, which `tauri-plugin-opener` intercepts; `openExternalUrl` synthesizes exactly that — a transient, detached `<a target="_blank" rel="noopener noreferrer">` that is appended, `.click()`-ed, and removed — so it works in BOTH web and desktop. For a **user click**, prefer the shared link components (`OutboundLink` / `ChecklistLink` / `HotspotLink`); reach for `openExternalUrl` only when the open must happen from code (e.g. after an `await`). Keep the same id-shape guard + `encodeURIComponent` on any id in the URL as everywhere else.

### Desktop storage (Tauri)

`TauriStorage` in `storage.ts` uses **`tauri-plugin-fs` with `BaseDirectory.AppLocalData` for everything** — API keys, settings, file metadata, and CSV files. All data lives under `AppLocalData/data/`:

| File | Contents |
|---|---|
| `data/api-keys.json` | API keys (`ebird`, `openweather`) |
| `data/settings.json` | App settings (map center, zoom, etc.) |
| `data/metadata.json` | Uploaded file metadata |
| `data/ebird-backup.csv` | eBird data file |
| `data/ml-export.csv` | ML data file |

Every write calls `mkdir(DATA_DIR, { recursive: true })` before writing to ensure the directory exists.

**Shared-document writes serialize on a per-document promise chain (v1.0.9).** Every read-modify-write on a shared JSON document above (settings, api-keys, metadata) runs as a link on that document's chain in `TauriStorage` (`docChains`, keyed by the closed set of path constants) — a new writer joins the chain, never bypasses it; a link never awaits another chained op, and a failed link rejects only its own caller. Unserialized read-modify-write is the lost-update clobber that silently erased the projects ledger (post-mortem in DECISIONS.md v1.0.9); a future store that rewrites a whole shared document from a base read owes the same mechanism and an interleaving test shaped like `storageWriteSerialization.test.ts`.

**Do not use `localStorage`** — it is ephemeral in Tauri's WKWebView and cleared on every relaunch.  
**Do not use the system Keychain** (`keyring` crate / `invoke('get_api_key', ...)`) — it requires entitlements not configured in this app and fails silently.

**Persist all UI settings through the `storage` seam, never `localStorage` directly.** Anything that must survive a desktop relaunch (e.g. the tab layout) goes through `storage.getSetting`/`setSetting`. The web/Pi path may still read `localStorage` synchronously inside the seam for a flash-free first paint, but the seam — not `localStorage` — is the source of truth on desktop. (See the tab-layout post-mortem in DECISIONS.md.)

Desktop development (requires Rust + `@tauri-apps/cli`):
```
npm run desktop:dev    # Tauri dev mode
npm run desktop:build  # production .app / .exe bundle
```
