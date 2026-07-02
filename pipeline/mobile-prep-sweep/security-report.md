# Security Review — mobile-prep-sweep

**Date:** 2026-07-02
**Feature:** mobile-prep-sweep (Improve lane — 71 responsive fixes + four recorded tidies)
**Stack:** python-fastapi + react-vite (full_stack)
**Checklists:** `reference/checklists/security-fastapi.md`, `reference/checklists/security-react-vite.md` (+ CLAUDE.md "Security — standing checks")
**Outcome:** PASSED

---

## Summary

This is an Improve-lane change: mostly CSS/className/rem responsive repair (no
request-handling surface) plus a dead-code removal that shrinks the desktop
capability surface. The two changes that touch request handling — a shared
lazy-singleton httpx client and a codes-independent recent-obs TTL cache — were
reviewed in depth against injection, DoS/timeout, state-bleed, cache-poisoning,
and trust-boundary criteria. Neither introduces new attack surface, changes a
trust boundary, or weakens an existing control. The geolocation-plugin removal
only deletes capability grants and a dependency; the native `get_location` path
is untouched. No findings.

---

## Findings

No security issues found in this change.

---

## Detail on the primary review targets

### 1. Shared httpx client (`backend/http_client.py` + all callers)

- **No cross-request state bleed.** The shared `httpx.AsyncClient()` is
  constructed with **no default headers, no cookies, no auth, and no base URL**
  (`http_client.py:34`). Every eBird call sets its own `X-eBirdApiToken`
  header per-request (`services/ebird.py:11,101`; `routers/map.py:36,63,95,141`;
  `routers/taxonomy.py:160`), and every OpenWeather call passes `appid` as a
  per-request param (`services/openweather.py:15,35`). No caller's API key is
  ever attached to the shared client, so one caller's credential can never ride
  a later request. httpx does not share a cookie jar across requests unless one
  is configured on the client — none is.
- **Per-request timeouts preserved (DoS/hang surface closed).** All 16
  `client.get(...)` call sites across routers + services carry an explicit
  `timeout=` (mechanically verified: version 5.0; map 10.0/15.0; ebird 10.0;
  openweather 10.0; noaa 10.0; nominatim 8.0; taxonomy 30.0). The shared client
  carries no default timeout, so each request keeps the exact budget it had
  before pooling — no site regressed to an unbounded wait.
- **TLS verification not disabled.** `grep` for `verify=False` across the
  backend (excluding `.venv`/tests) returns nothing; the shared client uses
  httpx's default `verify=True`.
- **Singleton lifecycle is not user-controllable.** `_client` is module-private,
  created on first use, and only ever closed on lifespan shutdown
  (`main.py:32` → `close_client()`). No route mutates it; there is no
  user-reachable global state.
- **`main.py` lifespan change is inert to trust config.** The lifespan now only
  awaits `close_client()` on shutdown (startup does nothing). CORS
  (`allow_origins=["http://localhost:5173"]`, explicit — not wildcard),
  allowed methods, and the StaticFiles mount are all unchanged.

### 2. Codes-independent recent-obs cache (`backend/routers/map.py` + `frontend/src/lib/tauri/mapService.ts`)

- **Cache key cannot be poisoned or collided.** The backend key is the tuple
  `(lat, lng, dist)` (`map.py:158`), and all three come from FastAPI `Query`
  validation with numeric bounds — `lat` float ge/le ±90, `lng` float ge/le
  ±180, `dist` int 1–200 (`map.py:183–185`). No raw user string enters the key.
  The desktop twin keys on `map/recent-obs-raw?lat=…&lng=…&dist=…` with
  `lat/lng` `.toFixed(5)` and numeric `dist` (`mapService.ts:139`), codes
  deliberately excluded. This is a single-user local app; the API key comes
  only from `os.getenv` (one value per process), so there is no multi-key
  scenario in which cached observations for one key could be served under
  another.
- **Errors are never cached (verified by code path, not just by test).**
  `_fetch_recent_obs_raw` raises `HTTPException` on any upstream error
  (`map.py:144–150`) **before** the single cache write at `map.py:177`, which
  is only reached on success; the in-flight task is cleaned up in `finally`
  (`map.py:174–175`). The desktop twin relies on `cachedGet`, which never
  stores a rejected loader. A transient 401/502 therefore does not stick for
  the 90 s TTL in either runtime.
- **No sensitive data cached; cache is in-process only.** Cached content is
  public eBird radius observations. The store is a plain module-level `dict`
  (`map.py:128`) — in-process, not shared across users, never persisted to
  disk or any world-readable path.
- **Optional-codes contract and validation unchanged.** The route still
  validates lat/lng/dist identically; `codes` is an optional free string used
  only for set membership (`code not in code_set`, `map.py:201`) and is never
  interpolated into a URL, query, or the cache key. Applying the filter after
  the cached fetch does not skip any prior validation. `/map/recent-obs`
  remains in the frontend `CACHED_GET_PATHS` and the grouped `RecentObs`
  response shape is unchanged.

### 3. Geolocation-plugin removal (`src-tauri/`)

- **Removal only; surface shrinks.** The diff deletes exactly the
  `tauri-plugin-geolocation` dependency (`Cargo.toml`), the
  `.plugin(tauri_plugin_geolocation::init())` registration (`lib.rs`), and the
  three `geolocation:*` capability grants (`capabilities/default.json`) —
  nothing else. Removing permission grants is a strict reduction of the
  desktop attack surface.
- **Native location path not weakened.** `location::get_location` (`lib.rs:62`)
  and `location_windows::get_location` (`lib.rs:64`) are still registered in
  the invoke handler; `location.rs`/`location_windows.rs` are not in the diff.
  The native `get_location` command and its entitlement are untouched.
- **No dangling capability reference.** Residual `geolocation` strings appear
  ONLY under `src-tauri/target/` (stale cargo fingerprints + a stale generated
  `out/capabilities.json`) — a gitignored build-artifact directory that
  regenerates on the next `cargo build`. No tracked source retains a reference,
  so nothing errors on a clean build (QA confirmed `cargo check` green).

---

## Briefly confirmed (no deep dive required)

- **Responsive changes are CSS/className/rem only.** No new
  `dangerouslySetInnerHTML` added and none switched away from escaped JSX (the
  one `dangerouslySetInnerHTML` in the MapExplorer diff is unchanged context;
  its `escHtml` path is intact). No map popup switched away from escaped JSX —
  the CountyLayer/TargetMarkers/NearbyLiferMarkers popup changes add only the
  `.sr-map-popup-body` scroll wrapper + `maxWidth`. No new URL interpolation and
  no id/href-shape guard removed (the only `href=` diff is an inline-padding
  tweak on an existing `OutboundLink`, binding and validated `aria-label`
  unchanged).
- **No secrets in source.** Diff scan for hardcoded keys/tokens/passwords in
  changed backend/frontend/rust source returns nothing. `backend/.env` is
  gitignored (verified) and not tracked.
- **No new dependency; one removed.** The only `package.json` dependency change
  is the removal of `@tauri-apps/plugin-geolocation`. No new npm or Cargo
  dependency was added, so no new-CVE exposure is introduced (surface shrinks).
- **No PRIVACY_POLICY change needed.** The pooled client reuses the existing
  eBird/OpenWeather/NOAA/Nominatim/GitHub endpoints; the recent-obs cache
  dedupes existing calls; geolocation removal removes a capability. No new
  network call, provider, analytics, telemetry, or third-party service.

---

## Checks Performed

### FastAPI checklist

| Check | Result |
|---|---|
| Protected endpoints verify the API key | Pass — `_api_key()` gates every `/map/*` route (401 if unset); eBird key required per call |
| No manual token parsing | Pass — N/A; the app has no JWT/session auth (single-user local app), keys are opaque headers |
| Secrets loaded from environment, not hardcoded | Pass — `os.getenv("EBIRD_API_KEY"/"OPENWEATHER_API_KEY")`; no key on the shared client |
| Parameterized queries / no string-built SQL | Pass — no database; N/A |
| No user input to eval/exec/subprocess/os.system | Pass — none introduced |
| File paths from user input sanitized (no traversal) | Pass — no user-derived file paths in the changed code |
| Request bodies validated with Pydantic | Pass — `NominatimRequest`/`LocationPoint` unchanged; recent-obs uses typed `Query` |
| Query/path params typed and validated | Pass — recent-obs `lat`/`lng`/`dist` carry numeric bounds; `regionCode` routes keep their regex patterns |
| Unhandled exceptions → generic 500, no stack traces | Pass — upstream errors mapped to 502/503 with generic detail; no traceback leak |
| Validation errors structured, no internals leaked | Pass — FastAPI 422 for out-of-bounds params; error strings are generic |
| Dependencies pinned / no unpinned | Pass — no backend dependency change in this run |
| No known vulnerable packages introduced | Pass — no new backend package added |
| Unused dependencies not present | Pass — this run REMOVES a dead dependency (geolocation) |
| CORS explicitly configured, not wildcard | Pass — `allow_origins=["http://localhost:5173"]`, unchanged |
| Rate limiting on compute-heavy/external-call endpoints | Pass (informational) — pre-existing posture (Nominatim `_rate_lock` + 1 s sleep unchanged); the new cache REDUCES external eBird calls; no regression |
| Per-request timeout on every outbound call (DoS/hang) | Pass — all 16 `client.get` sites carry explicit `timeout=` |
| TLS verification not disabled | Pass — no `verify=False`; shared client uses default `verify=True` |
| No cross-request state bleed via shared client | Pass — no default headers/cookies/auth; keys set per-request |
| Cache key derived from validated numeric inputs only | Pass — `(lat, lng, dist)` all bounded `Query` values |
| Upstream errors not cached | Pass — raise precedes the cache write; verified by code path + test |

### React + Vite checklist

| Check | Result |
|---|---|
| No API keys/secrets in source | Pass — none in the diff |
| Only `VITE_`-prefixed vars client-side / non-sensitive | Pass — no `VITE_` secret introduced; keys live behind the storage seam |
| `.env`/`.env.local` gitignored | Pass — verified via `git check-ignore` |
| No credentials in `vite.config.ts` / config | Pass — no config-file secret change |
| API calls go through the backend (no key exposure) | Pass — unchanged; transport seam preserved |
| API error responses handled gracefully | Pass — recent-obs errors surface as thrown Errors, not raw details |
| No Bearer tokens in localStorage | Pass — N/A; unchanged |
| dangerouslySetInnerHTML not added with unsanitized input | Pass — none added; existing `escHtml` path unchanged; map popups stay escaped JSX |
| URLs from user/external data validated before href/src | Pass — no new URL interpolation; id-shape guards intact |
| Form inputs affecting navigation validated | Pass — responsive changes are layout-only, no data-flow change |
| No known vulnerable packages | Pass — no package added; one removed |
| Direct deps on current supported versions | Pass — unchanged except the removal |
| Unused dependencies not present | Pass — dead geolocation dep removed |
| Source maps not deployed to production | Pass — no Vite `sourcemap` directive (prod default off); unchanged |
| Console logs with sensitive data removed | Pass — none introduced |
| No dev-only/debug code paths in prod build | Pass — none introduced |

### CLAUDE.md standing security checks

| Check | Result |
|---|---|
| Map popups remain escaped JSX (not `dangerouslySetInnerHTML`) | Pass — CountyLayer/TargetMarkers/NearbyLifer popups still JSX; only scroll-wrapper added |
| eBird id shape-validated before becoming a link (`[0-9]` not `\d`) | Pass — no id-guard touched; implementation-notes reaffirms the `[0-9]` rule |
| Comment text renders via `CommentText` (escaped) | Pass — unchanged; responsive changes add wrap classes only |
| Module-level `/g` regex hygiene | Pass — no regex added in this run |
| Map tile providers ↔ PRIVACY_POLICY in sync | Pass — no provider/basemap change |

---

## Convention Flags

None. The implementation notes already record the durable conventions for
Stage 9 (pooled backend HTTP via `http_client.get_client()` with a per-call
`timeout=`; the four new `globals.css` classes; no inline responsive styles).
No new standing security rule emerged from this review — the existing
"per-request timeout on every outbound call" and "no key on the shared client"
practices are already captured in those notes.
