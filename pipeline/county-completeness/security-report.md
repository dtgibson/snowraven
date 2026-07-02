# Security Review — County Completeness

**Date:** 2026-07-02
**Feature:** county-completeness
**Stack:** python-fastapi + react-vite (dual-transport: FastAPI web/Pi + Tauri desktop twin)
**Checklist:** security-fastapi.md + security-react-vite.md (Weft 1.1.0), plus the CLAUDE.md "Security — standing checks"
**Outcome:** PASSED WITH NOTES

---

## Summary

Reviewed the full county-completeness change set: the new `GET /map/county-species` eBird proxy route and its desktop twin, the taxonomy species-collapse on both transports, the pure completeness math, the 30-day storage-seam cache, the bounded fetch controller, the popup/legend/sidebar UI, and the privacy/docs updates. No Critical or High issues. The attack surface is narrow by design — the only user-influenced input is a shape-validated county region code, all popup content is escaped JSX, the eBird key never leaves its established seams, and fetch volume is structurally bounded (pool of 4, in-flight dedupe, 30-day persistent cache, birded-counties-only eager set). Two Low findings (one resolved during review, one open with a precise remediation) and two Informational notes.

---

## Findings

### Backend region-code pattern accepted non-ASCII Unicode digits (twin-parity gap)

**Severity:** Low
**Location:** `backend/routers/map.py:74` (`get_county_species` `regionCode` Query pattern)
**Description:** The pattern was `^US-[A-Z]{2}-\d{3}$`. Under pydantic v2 (2.13.4, rust-regex engine) `\d` matches Unicode decimal digits, so e.g. `US-CA-٠١٢` (Arabic-Indic digits) passed validation — empirically confirmed via TestClient (401 key-check reached instead of 422). The desktop twin's JS `COUNTY_REGION_RE` `\d` is ASCII-only, so the two transports validated differently. **No exploit path existed:** the value is `quote(regionCode, safe='')` percent-encoded into a path segment of the fixed `api.ebird.org` base (no SSRF, no URL restructuring), and eBird would return 4xx → a clean 502. The issue is defense-in-depth and twin parity, not injection.
**Remediation:** Change `\d{3}` to `[0-9]{3}` so the backend matches the twin exactly; add a Unicode-digit case to the malformed-region test.
**Status:** Resolved — fixed during this review (`backend/routers/map.py:74`, plus a `US-CA-٠١٢` rejection case in `backend/tests/test_map_router.py::test_county_species_rejects_malformed_region`). All 21 map-router tests pass.

### Completeness cache load path does not validate per-entry shape

**Severity:** Low
**Location:** `frontend/src/lib/countyCompletenessCache.ts:61–83` (`ensureLoaded`), crash surface at `frontend/src/lib/useCountyCompleteness.ts:233` (`statusFor` → `entry.data.speciesCount`)
**Description:** A JSON-parse failure or a document missing `entries`/`order` correctly normalizes to an empty store (tested: "a corrupt/absent document normalizes to an empty store"). But a *well-formed* document whose entry values are malformed — e.g. `entries: { "US-CA-085": { "data": null } }` — flows unvalidated through `loadAll()` into the hook's `ebirdByRegion` state; `statusFor` then dereferences `entry.data.speciesCount` during render, which throws and lets the app error boundary take the map down until the setting is cleared. The surface is local-only (the document is self-written under the storage seam — `AppLocalData` on desktop, the backend settings file on web/Pi), so an attacker needs local write access, which already implies worse; the realistic trigger is manual edits, a truncated write, or a future shape change (note: `version` is normalized to `1` but never actually checked). Secondary nits on the same path: a non-numeric `fetchedAt` self-heals (NaN TTL comparison → treated stale → refetched), and a non-numeric `bytes` silently disables the byte-cap eviction (the 250-entry count cap still holds).
**Remediation:** In `ensureLoaded`'s normalization, keep only entries that pass a shape check — `typeof e.fetchedAt === 'number' && typeof e.bytes === 'number' && e.data && typeof e.data.speciesCount === 'number' && Array.isArray(e.data.species)` — dropping (not throwing on) anything else, and add a malformed-entry case beside the existing corrupt-document test. Checking `loaded.version === 1` at the same time closes the forward-compat hole.
**Status:** Open

### No automated hostile-name inertness test (QA-35)

**Severity:** Informational
**Location:** `frontend/src/components/map/CountyCompletenessUI.test.tsx`
**Description:** QA-35 requires that a hostile species/county name in popup content renders inert. The property holds structurally — every name renders as React children through `<BirdName>`/JSX (verified: zero `dangerouslySetInnerHTML` in any new or changed path), and species codes surfaced to the UI are constrained to the bundled taxonomy snapshot's species-code set by the collapse (an effective allowlist: a code not in `speciesSet` never reaches the UI). But no test locks it, so a future refactor to string-built popup HTML would regress silently.
**Remediation:** Add one popup test rendering a result whose species `commonName` is `<img src=x onerror=…>` and assert it appears as text (no element injected).
**Status:** Open

### No server-side rate limiting on the new external-call endpoint

**Severity:** Informational
**Location:** `backend/routers/map.py` (`/map/county-species`)
**Description:** The FastAPI checklist asks for rate limiting on external-call endpoints; the new route has none — consistent with every existing `/map/*` route and the app's architecture (single-user, self-hosted localhost/LAN, no developer server, the user's own eBird key so the only quota at risk is the user's own). Client-side the call volume is structurally bounded: fixed pool of 4 (`EAGER_FETCH_CONCURRENCY`), in-flight dedupe at the cache chokepoint, a 30-day persistent cache, eager fetching restricted to birded + region-resolvable + non-fresh in-view counties, and errors never cached (retry is click-driven, so a failing county cannot loop). A pan storm was traced through `CountyLayer` → `onViewportCounties` → the queue gates (`queuedRef`/`loadingRef`/`transient`/TTL) and cannot stampede eBird.
**Remediation:** None required for this deployment model; revisit only if the backend is ever exposed publicly.
**Status:** Accepted

---

## Checks Performed

### Python / FastAPI checklist

| Check | Result |
|---|---|
| Protected endpoints verify API key via dependency/helper | Pass — `_api_key()` raises 401 before any network; no endpoint assumes a key (no JWT/user auth by design — single-user app) |
| JWT validation uses a trusted library | Pass (N/A — no JWT anywhere in the app) |
| JWT secret from environment | Pass (N/A — no JWT) |
| Token expiry enforced | Pass (N/A — no tokens issued) |
| Role/permission checks at endpoint level | Pass (N/A — single-user, no roles) |
| API keys hashed before storage | Pass with note — the eBird key is an *outbound* credential (must be plaintext to call eBird), held in gitignored `backend/.env` / the desktop storage seam; it is not an inbound auth secret, so hashing does not apply |
| DB queries parameterized | Pass (N/A — no database) |
| No user input to eval/exec/subprocess/os.system | Pass — none in the new code |
| File paths from user input sanitized | Pass (N/A — feature touches no file paths from input) |
| XML parsed safely | Pass (N/A — no XML) |
| requirements.txt pins versions | Pass — all six deps `==`-pinned; unchanged by this feature |
| No known vulnerable packages | Pass — backend deps unchanged; frontend `npm audit --omit=dev` → 0 vulnerabilities |
| No unused dependencies | Pass — zero new dependencies added |
| Dev deps not in production requirements | Pass — requirements.txt is runtime-only |
| Request bodies validated with Pydantic | Pass — new route is GET-only; the one param is typed + pattern-validated |
| Query/path params typed and validated | Finding (Resolved) — `regionCode` pattern hardened to `^US-[A-Z]{2}-[0-9]{3}$`; 422 on malformed, verified by tests incl. the new Unicode-digit case; validation runs before the key check and any network |
| File uploads validated by content | Pass (N/A — no uploads in feature) |
| Request size limits | Pass — GET with no body; upstream eBird response is a bounded county species list, parsed once |
| Unhandled exceptions → generic error, no stack traces | Pass — upstream failures map to 502 with fixed detail strings (`eBird API error: <status>` / `Could not reach the eBird API.` / `Could not load the eBird taxonomy. Try again.`); exception messages, URLs, and headers (where the key rides) never reach the response |
| Validation errors structured, no internals | Pass — standard FastAPI 422 shape |
| DB errors caught and logged | Pass (N/A — no database) |
| Debug mode disabled | Pass — no DEBUG flag; uvicorn run plain |
| SECRET_KEY/JWT secret in .env | Pass (N/A — no JWT; `EBIRD_API_KEY` via env) |
| DATABASE_URL in .env | Pass (N/A — no database) |
| No credentials in committed files | Pass — sweep of every changed/new file clean; test fixtures use `"test-key"` |
| .env in .gitignore | Pass — verified: `.env`, `.env.local`, `.env.*.local` at `.gitignore:2–4` |
| Prod env vars differ from dev | Pass (N/A — self-hosted single-user; the only secrets are the user's own keys; no developer-shared secrets exist) |
| CORS origins explicit, not wildcard | Pass — `allow_origins=["http://localhost:5173"]` in `main.py`; unchanged |
| Security headers set | Pass with note — no security-header middleware (pre-existing posture: desktop runs inside Tauri, web is self-hosted localhost/LAN; no public server); unchanged by this feature |
| HTTPS enforced in production | Pass (N/A — no production web deployment; all provider calls are HTTPS) |
| Rate limiting on auth endpoints | Pass (N/A — no auth endpoints) |
| Rate limiting on compute-heavy / external-call endpoints | Finding (Informational, Accepted) — see above; client-side bounding is structural |

### React + Vite checklist

| Check | Result |
|---|---|
| No keys/tokens/secrets in source | Pass — sweep clean across all new/changed files and tests |
| Only VITE_ vars client-side | Pass (N/A — no env vars used by the new code) |
| VITE_ vars non-sensitive | Pass (N/A — none added) |
| .env / .env.local gitignored | Pass — verified |
| No credentials in vite.config.ts / committed config | Pass — `vite.config.ts` untouched (`/map` already proxied, verified per schema) |
| API calls through the configured backend | Pass — web: `transport` → Vite proxy → FastAPI (key stays server-side in `.env`); desktop: seam-routed `mapService.getCountySpecies` with the key from the storage seam (the app's disclosed device-to-provider design) |
| API base URLs not hardcoded per-component | Pass with note — `EBIRD_BASE` is the established fixed-provider constant in `mapService.ts` (one source); web paths are relative through the proxy |
| API error responses handled gracefully, raw details not shown | Pass — three-state classification (`classifyFetchError`); displayed `detail` strings are server-authored constants; rendered as escaped JSX; no key/URL/header material in any message; desktop `tauriFetch` timeout (10 s) and backend httpx timeout (15 s) prevent hung spinners |
| Auth headers appropriate; no Bearer tokens in localStorage | Pass — `X-eBirdApiToken` set only inside the two service twins; key read via `storage.getApiKey('ebird')`; nothing touches localStorage |
| Auth tokens httpOnly/in-memory, not localStorage | Pass (N/A — no auth tokens; key handling per the storage seam) |
| Logout clears auth state | Pass (N/A — no accounts) |
| Protected routes redirect unauthenticated users | Pass (N/A — no routes/auth) |
| Token refresh handles expiry | Pass (N/A) |
| No dangerouslySetInnerHTML with unsanitized input | Pass — zero occurrences in every new/changed path; all species/county names are React children via `<BirdName>`/JSX; species codes are allowlisted by the taxonomy collapse |
| URLs from external data validated before href/src | Pass — no new hrefs are built from eBird data; the popup's region link keeps the pre-existing `deriveCountyRegionCode` shape guard; region codes are shape-validated (`COUNTY_REGION_RE`) + `encodeURIComponent`/`quote`-wrapped on both transports before URL interpolation |
| Form inputs validated client-side | Pass (N/A — no free-text inputs; SegControl + buttons only) |
| No known vulnerable packages | Pass — `npm audit --omit=dev`: 0 vulnerabilities |
| react/vite on supported versions | Pass — unchanged by this feature; audit clean |
| No unused dependencies | Pass — zero new dependencies |
| Source maps not deployed | Pass — no `build.sourcemap` in `vite.config.ts` (Vite default: off) |
| No sensitive console logs | Pass — zero `console.*` in the new modules |
| No dev-only code in production build | Pass — the exported test seams (`setCompletenessMaxEntries`/`MaxBytes`, `_resetCountyCompletenessCacheForTests`) mirror the established `REPLAY_MAX_*` pattern and carry no debug tooling |

### CLAUDE.md standing checks (project-specific)

| Check | Result |
|---|---|
| Map popups are escaped JSX, never HTML strings | Pass — `CountyCompletenessPopup` and all CountyLayer additions are pure JSX |
| eBird ids shape-validated before becoming links + encodeURIComponent in queries | Pass — both transports; backend pattern hardened this review (Finding 1) |
| Module-level `/g` regex hygiene; linear regex over untrusted text | Pass — new regexes (`monthDay`'s anchored date match, `COUNTY_REGION_RE`) are non-global and linear; `normalizeSpeciesName` (run over eBird names in `completenessTargets`) is an anchored negated-class match, memoized, cache bounded by distinct-name vocabulary |
| Map-tiles privacy disclosure | Pass — no tile/provider change; `PRIVACY_POLICY.md`'s eBird bullet updated to disclose the county region species-list call (FR-36 verified accurate against the code) |
| Entry chunk unwidened | Pass — `entryChunk.test.ts` extended to assert all four new completeness modules stay off the entry chunk and out of `dist/index.html` modulepreload |
| Cache stores nothing privacy-sensitive | Pass — `county-completeness-v1` holds only public eBird data (region codes, species codes/names, fetch timestamps); the which-counties-fetched signal lives on-device beside the far more sensitive backup CSV, so no new exposure; nothing is transmitted anywhere |
| `/map/county-species` NOT in `CACHED_GET_PATHS` | Pass — verified in `transport.ts` (the 30-day cache is the single layer) |
| Version + changelog lockstep | Pass — 0.5.54 in both `frontend/package.json` and `src-tauri/tauri.conf.json`; CHANGELOG, README, HELP.md, and website copy all accurate (no third-party requests added to the website; no claims contradicting behavior) |

---

## Convention Flags

- **Dual-transport shape guards must be character-class identical: in backend pydantic patterns, use `[0-9]`, never `\d`.** pydantic v2's rust-regex engine treats `\d` as Unicode decimal digits while the JS twin's `\d` is ASCII-only, so the "same" pattern validates differently on the two transports (the gap this review found and fixed in `/map/county-species`). Any future route that twins a JS shape guard should write explicit ASCII classes on the Python side, and its malformed-input test should include a non-ASCII-digit case.
