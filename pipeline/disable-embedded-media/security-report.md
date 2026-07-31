# Security Review — Disable Embedded Media

**Date:** 2026-07-30
**Feature:** `disable-embedded-media`
**Stack:** `react-vite-tailwind` frontend; `python-fastapi` backend
**Checklists:** Weft `security-react-vite.md` (the React/Vite checklist applies to the configured Tailwind variant) and `security-fastapi.md`
**Outcome:** PASSED WITH NOTES — no open security or privacy findings

---

## Summary

The feature and its complete current production dependency graphs pass security
review. The preference fails closed during hydration, prevents the only iframe
constructor from mounting while disabled, validates catalog IDs before building
URLs, persists through bounded fixed/allowlisted storage paths, and introduces no
secret, account, analytics, telemetry, proxy, cache, or new third-party provider.

All dependency findings raised during the first audit are resolved. The current
pins are `fastapi==0.141.1`, `starlette==1.3.1`,
`python-multipart==0.0.32`, and `python-dotenv==1.2.2`; a clean Python resolution
passes `pip check` and an OSV query of every resolved runtime package returns no
advisories. The complete npm production tree also resolves cleanly and
`npm audit --omit=dev` reports zero vulnerabilities. The only release note is a
non-blocking, test-only Starlette TestClient deprecation warning, documented
separately below.

---

## Findings

### Open findings

No open Critical, High, Medium, Low, or Informational security findings remain.

### Resolved — vulnerable multipart parser in reachable upload routes

**Prior severity:** High, plus three Low upstream advisories
**Location:** `backend/requirements.txt:7`; reachable through
`backend/routers/settings.py:71-97`
**Description:** SnowRaven's two `UploadFile = File(...)` routes invoke the
Starlette/FastAPI multipart parser, so the prior `python-multipart==0.0.28`
advisories were application-reachable. Official OSV/GitHub advisory data records:

| Advisory | CVE | Upstream severity | First fixed version |
|---|---|---:|---:|
| `GHSA-5rvq-cxj2-64vf` | `CVE-2026-53539` | High — quadratic query-string parsing CPU DoS | `0.0.30` |
| `GHSA-6jv3-5f52-599m` | `CVE-2026-53538` | Low — semicolon parameter smuggling | `0.0.30` |
| `GHSA-v9pg-7xvm-68hf` | `CVE-2026-53540` | Low — negative Content-Length buffering | `0.0.31` |
| `GHSA-vffw-93wf-4j4q` | `CVE-2026-53537` | Low — extended-parameter smuggling | `0.0.30` |

**Remediation verification:** The application now pins
`python-multipart==0.0.32`. OSV returns no advisory for that exact version, the
complete backend test suite passes its upload coverage, and the clean runtime
resolution passes `pip check`.
**Status:** Resolved

### Resolved — python-dotenv symlink-following overwrite path

**Prior severity:** Moderate upstream
**Location:** `backend/requirements.txt:5` and
`backend/routers/apikeys.py:4,38,48`
**Description:** `GHSA-mf9w-mj56-hr94` / `CVE-2026-28684` affects
`python-dotenv`'s `set_key()` and `unset_key()` write APIs and is fixed in
`1.2.2`. The previous report incorrectly said SnowRaven used only
`load_dotenv()`. In fact, `backend/routers/apikeys.py` imports and invokes both
affected write APIs when saving and deleting local API keys, so the old
`1.0.1` pin was reachable.

**Remediation verification:** The application now pins
`python-dotenv==1.2.2`, the advisory's exact first fixed version. OSV returns no
advisory for `1.2.2`; API-key route tests and production startup pass.
**Status:** Resolved

### Resolved — Starlette file-serving Range-header DoS and framework advisories

**Prior severity:** High
**Location:** `backend/requirements.txt:1-2`, `backend/main.py:67-70`, and
`backend/routers/settings.py:76-97`
**Description:** FastAPI `0.115.6` constrained the old environment to
Starlette `0.41.3`. `GHSA-7f5h-v6xp-fcq8` / `CVE-2025-62727` is a High-severity
O(n²) denial of service in `FileResponse`'s merging of attacker-controlled
`Range` header values, fixed in Starlette `0.49.1`. It was reachable here in
two independent ways: the production SPA is mounted through `StaticFiles`,
which returns `FileResponse`, and the eBird/ML backup download routes return
`FileResponse` directly.

**Remediation verification:** FastAPI is now `0.141.1` and explicitly paired
with `starlette==1.3.1`. FastAPI's installed metadata permits
`starlette>=0.46.0`; `pip check` confirms the pair is compatible. Inspection of
the installed Starlette code confirms `StaticFiles.file_response()` still
flows through `FileResponse`, while the patched Range implementation sorts
ranges once and merges them in one forward scan instead of the vulnerable
quadratic merge. OSV returns no advisory for either exact installed version.

The fresh query also confirmed that `1.3.1` is at or beyond every fix for the
other advisories returned for the former `0.41.3` resolution:

| Advisory | CVE | First fixed Starlette version |
|---|---|---:|
| `GHSA-2c2j-9gv5-cj73` | `CVE-2025-54121` | `0.47.2` |
| `GHSA-7f5h-v6xp-fcq8` | `CVE-2025-62727` | `0.49.1` |
| `GHSA-82w8-qh3p-5jfq` | `CVE-2026-54283` | `1.3.1` |
| `GHSA-86qp-5c8j-p5mr` | `CVE-2026-48710` | `1.0.1` |
| `GHSA-jp82-jpqv-5vv3` | `CVE-2026-54282` | `1.3.0` |
| `GHSA-wqp7-x3pw-xc5r` | `CVE-2026-48818` | `1.1.0` |
| `GHSA-x746-7m8f-x49c` | `CVE-2026-48817` | `1.1.0` |

**Status:** Resolved

---

## Feature Security and Privacy Review

### Iframe and network gating

- `useEmbeddedMediaPreference` begins at `null` and derives
  `embedAllowed` only from the exact hydrated value `false`
  (`frontend/src/lib/useEmbeddedMediaPreference.ts:24-59,90-96`). Missing,
  unreadable, malformed, and non-boolean values preserve the approved
  off-by-default setting while the unresolved startup state remains closed to
  iframe mounts.
- App-root state is passed to both complete embed paths: Species Detail and
  Named Birds (`frontend/src/App.tsx:213-220,1169-1175,1233-1240`).
- The source inventory finds one application iframe constructor only,
  `MediaFrame` in `frontend/src/components/MediaEmbed.tsx:92-148`. It returns
  before constructing an iframe when the gate is false and does not start its
  fallback timer in that state.
- Both production call sites require explicit eligibility. Recent Media checks
  the gate before `MediaFrame` (`RecentMediaEmbed.tsx:42-49`); Named Birds does
  not mount a frame wrapper or create an `IntersectionObserver` while disabled
  (`NamedBirdMedia.tsx:125-142,195-235`). Disabling after mount propagates
  synchronously through React, unmounts the iframe, and runs effect cleanup.
- Disabled mode retains only normal anchor links. Anchors do not contact the
  Macaulay Library until the user chooses to open them, matching the updated
  privacy policy. The feature adds no prefetch, proxy, download, cache,
  re-hosting, service worker, analytics, or telemetry path.

### URL and injection controls

- Every current iframe/link call path checks catalog IDs with the anchored
  digits-only `MEDIA_CATALOG_ID_RE` before use. URL segments are additionally
  passed through `encodeURIComponent` (`MediaEmbed.tsx:128-130`,
  `RecentMediaEmbed.tsx:31-48`, `NamedBirdMedia.tsx:187-229,259-266`).
- Disabled copy, dates, species names, and other metadata render as React text
  nodes; the feature adds no HTML injection API. A repository scan found no new
  `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, subprocess,
  or shell path. Existing `dangerouslySetInnerHTML` uses are limited to static
  SVG constants or explicitly escaped map-label text and are outside this diff.
- The preference control produces a boolean only; hydration normalizes with
  `raw === true`. No user value is interpreted as code, HTML, a host, or a path.

### Persistence, filesystem paths, and request limits

- Desktop persistence uses the existing fixed AppLocalData
  `data/settings.json` path. The feature supplies the fixed key
  `disableEmbeddedMedia`; no user-controlled path segment is introduced.
- Web/Pi persistence uses relative same-origin `/settings/{key}` calls. The
  backend validates generic keys against the anchored, length-bounded
  `[A-Za-z0-9._-]{1,128}` allowlist before constructing a path and rejects
  reserved route names (`backend/routers/settingskv.py:33-51`).
- Generic settings bodies are capped at 16 MiB and must parse as JSON
  (`settingskv.py:41-42,66-83`); this feature sends only a bare boolean.
  Existing CSV application reads are capped at 50 MiB, and the now-patched
  Starlette/python-multipart layers cover parser-level request handling.
- Preference writes are serialized, apply immediately, and restore the last
  durable value after a failed latest write. Web storage now rejects non-2xx
  saves rather than treating a resolved fetch as persistence
  (`frontend/src/lib/storage.ts:129-144`). Error copy is generic and does not
  expose response bodies, paths, or stack traces.

### Secrets and trust boundaries

- No secret, credential, token, environment variable, or `VITE_` value was
  added. Tracked-file scans found no private-key markers or credential-shaped
  additions; only `.env.example` files are tracked. `.env`, `.env.local`, and
  `.env.*.local` are ignored, including `backend/.env`.
- Macaulay embeds and links use a public keyless provider URL. The preference
  does not cross an authentication boundary and adds no endpoint.
- SnowRaven's existing web/Pi backend remains an intentionally self-hosted,
  single-user service with no account/JWT model. Authentication, TLS, and
  perimeter access control remain deployment concerns for an operator who
  exposes it beyond a trusted local network or tailnet; this feature neither
  expands nor weakens that existing boundary.

---

## Checks Performed — React/Vite

| Checklist item | Result |
|---|---|
| No API keys, tokens, or secrets in source | Pass — none added; changed-source and tracked-file scans are clean. |
| Only `VITE_` variables used client-side | Pass — no client environment variable is read by this feature. |
| `VITE_` values are non-sensitive | Pass — no `VITE_` value was added or changed. |
| `.env` and `.env.local` ignored | Pass — verified with `git check-ignore`; `.env`, `.env.local`, and `.env.*.local` are covered. |
| No credentials in Vite or committed config | Pass — `vite.config.ts`, changed configs, and tracked secret-marker scans are clean. |
| API calls use the configured backend | Pass — preference persistence uses the existing relative same-origin storage seam. The Macaulay iframe/link host is a deliberate public, keyless provider surface. |
| API base URLs are configurable/not hardcoded | Pass — settings calls are relative and use the existing Vite proxy; no backend base URL was added. The fixed Macaulay origin is the provider contract, not an API-key-bearing backend. |
| API errors handled without raw detail exposure | Pass — setting saves reject internally and Settings shows fixed generic reconciliation copy. |
| Appropriate authentication headers; no unsafe bearer storage | N/A — SnowRaven has no account/bearer-token flow and this feature adds none. |
| Authentication tokens not in local/session storage | N/A — no authentication token exists; the stored value is a non-sensitive boolean through the cross-platform storage seam. |
| Logout clears authentication state | N/A — no login/logout state exists. |
| Protected routes enforce server validation | N/A — no protected route or endpoint was added. |
| Token refresh handles expiry | N/A — no token lifecycle exists. |
| User HTML sanitized / no unsafe HTML rendering | Pass — all new UI is escaped React text; no HTML injection API was introduced. |
| External/user URLs validated before `href`/`src` | Pass — catalog IDs are digits-only before URL construction and URL segments are encoded. Invalid IDs produce no iframe or ML link. |
| State-changing form inputs validated client-side | Pass — the accessible switch emits a boolean; only literal `true` disables on hydration. |
| No known vulnerable packages | Pass — fresh `npm audit --omit=dev` reports 0 vulnerabilities over the complete resolved production graph. |
| React, Vite, and direct dependencies supported | Pass — React 19 and Vite 8 are supported current major lines; typecheck, lint, tests, and production build pass. `npm outdated` shows only non-security newer releases. |
| No unused dependency | Pass — the feature adds no frontend package. |
| Production source maps disabled | Pass — Vite does not enable build sourcemaps; the verified `frontend/dist` contains 0 `.map` files. |
| Sensitive console logging removed | Pass — no changed production console logging or secret-bearing debug path exists. |
| Production build excludes debug tooling | Pass — the independent production build passed; no development-only import/path was added. |

---

## Checks Performed — FastAPI

| Checklist item | Result |
|---|---|
| Protected endpoints verify JWT/API key | N/A — the local-first app has no user-authenticated endpoint model; this feature adds no endpoint. |
| JWT validation uses a trusted library | N/A — no JWT flow. |
| JWT secret loaded from environment | N/A — no JWT secret. Existing provider keys come from local environment/app storage and were not changed. |
| Token expiry enforced | N/A — no token flow. |
| Endpoint-level role/permission checks | N/A — no identities or roles. |
| API keys hashed before storage | N/A for provider credentials — eBird/OpenWeather keys must be recoverable to call those services; they remain in the existing operator-owned local storage, not a password/auth database. The feature adds no key handling. |
| Database queries parameterized | N/A — no database is used. |
| No user input passed to eval/exec/subprocess/system | Pass — repository scan is clean; the setting is parsed as JSON only. |
| User-derived paths sanitized | Pass — the feature uses a fixed key; the generic route validates all keys before path construction. |
| XML parser safe | N/A — no XML input. |
| Requirements pin explicit versions | Pass — all seven declared runtime requirements use exact pins; Starlette is now pinned explicitly to prevent a vulnerable transitive resolution. |
| No known vulnerable runtime packages | Pass — clean resolution plus an OSV query for every one of its 25 runtime packages returned zero advisories. |
| No unused backend dependency | Pass — no feature dependency was added; explicit Starlette is an intentional security/compatibility pin used by FastAPI and file serving. |
| Development dependencies excluded from production requirements | Pass — pytest, Ruff, and TestClient tooling are absent from `backend/requirements.txt` and from the clean production closure. |
| Request bodies validated with Pydantic or an equivalent bounded parser | Pass — no body/route was added. The existing generic settings route intentionally accepts arbitrary JSON, validates JSON syntax and size, and the feature normalizes its value to a boolean. |
| Query/path parameters typed and validated | Pass for feature scope — the only path value is the fixed setting key, then server allowlist-validated. |
| Upload content validated | N/A to this feature; existing uploads are opaque user-owned CSV backups stored at fixed targets and served as `text/plain`, not executed or interpreted by the backend. Extension and 50 MiB limits remain, and parser advisories are remediated. |
| Request size limits configured | Pass for affected paths — settings are capped at 16 MiB, uploads at 50 MiB, and current Starlette/python-multipart include patched form/parser limits. |
| Unhandled exceptions return generic 500 | Pass — FastAPI production debug is off; changed storage failures expose only fixed generic copy. |
| Validation errors avoid internal detail | Pass — invalid keys/JSON/sizes receive bounded 4xx responses; no stack trace or filesystem detail is returned. |
| Database errors contained | N/A — no database. |
| Debug mode disabled | Pass — `FastAPI(...)` is created without `debug=True`. |
| Secret/JWT values live in environment | Pass/N/A — no JWT secret; existing service keys are local environment/app-storage values and no credential is committed. |
| Database URL in environment | N/A — no database. |
| No credentials committed | Pass — tracked env/key artifact and private-key marker scans are clean. |
| `.env` ignored | Pass — verified, including `backend/.env`. |
| Production/development secrets separated | N/A to feature — no secret/config value changed; operators supply their own local credentials. |
| CORS origins explicitly configured | Pass — the existing development origin is exactly `http://localhost:5173`, not `*`; production SPA traffic is same-origin. |
| Security headers considered | N/A to feature — no HTTP surface or deployment policy changed. Header hardening remains a reverse-proxy/deployment concern if the self-hosted service is exposed beyond its trusted network. |
| HTTPS enforced in production | N/A to feature — SnowRaven does not terminate TLS itself; operators exposing the self-hosted service beyond a trusted local network/tailnet must supply HTTPS and access control. |
| Rate limiting on authentication endpoints | N/A — no authentication endpoints. |
| Rate limiting on compute-heavy/external endpoints | N/A to feature — the new behavior adds no endpoint or external server call and, when enabled, reduces third-party requests. Existing provider calls retain timeouts, Nominatim pacing, and selected caches/single-flight behavior. |

---

## Production Dependency Audit

### npm resolved production graph

Commands were run from `frontend/` against the installed lockfile resolution:

- `npm ls --omit=dev --all` — exit 0; no invalid or extraneous package. The
  omitted `mapbox-gl` entries are declared optional peers; SnowRaven uses the
  installed MapLibre implementation.
- `npm audit --omit=dev --json` — exit 0; 0 Info, Low, Moderate, High, or
  Critical vulnerabilities. npm reported 107 production dependency nodes
  (387 total nodes including dev/optional/peer categories).

Resolved top-level production packages:

| Package | Version | Package | Version |
|---|---:|---|---:|
| `@tauri-apps/api` | `2.11.0` | `@tauri-apps/plugin-clipboard-manager` | `2.3.2` |
| `@tauri-apps/plugin-dialog` | `2.7.1` | `@tauri-apps/plugin-fs` | `2.5.1` |
| `@tauri-apps/plugin-geolocation` | `2.3.2` | `@tauri-apps/plugin-http` | `2.5.9` |
| `@tauri-apps/plugin-os` | `2.3.2` | `@tauri-apps/plugin-process` | `2.3.1` |
| `@tauri-apps/plugin-updater` | `2.10.1` | `lucide-react` | `1.14.0` |
| `maplibre-gl` | `5.24.0` | `pmtiles` | `4.4.0` |
| `react` | `19.2.5` | `react-dom` | `19.2.5` |
| `react-map-gl` | `8.1.1` | `recharts` | `3.8.1` |

### Python clean production resolution and OSV

A new Python 3.11 virtual environment was created outside the repository and
installed from `backend/requirements.txt`. Installation and `pip check` both
passed. On 2026-07-31 at `00:22:49Z`, one official OSV QueryBatch request was
made for every resolved production package/version below; every result contained
zero vulnerabilities:

| Package | Resolved version | OSV advisories |
|---|---:|---:|
| `annotated-doc` | `0.0.5` | 0 |
| `annotated-types` | `0.8.0` | 0 |
| `anyio` | `4.14.2` | 0 |
| `certifi` | `2026.7.22` | 0 |
| `click` | `8.4.2` | 0 |
| `fastapi` | `0.141.1` | 0 |
| `h11` | `0.16.0` | 0 |
| `httpcore` | `1.0.9` | 0 |
| `httptools` | `0.8.0` | 0 |
| `httpx` | `0.28.1` | 0 |
| `idna` | `3.18` | 0 |
| `numpy` | `2.4.6` | 0 |
| `pydantic` | `2.13.4` | 0 |
| `pydantic_core` | `2.46.4` | 0 |
| `python-dotenv` | `1.2.2` | 0 |
| `python-multipart` | `0.0.32` | 0 |
| `PyYAML` | `6.0.3` | 0 |
| `starlette` | `1.3.1` | 0 |
| `timezonefinder` | `5.2.0` | 0 |
| `typing_extensions` | `4.16.0` | 0 |
| `typing-inspection` | `0.4.2` | 0 |
| `uvicorn` | `0.32.1` | 0 |
| `uvloop` | `0.22.1` | 0 |
| `watchfiles` | `1.2.0` | 0 |
| `websockets` | `17.0` | 0 |

The repository's existing backend environment independently reports the four
required exact versions and `No broken requirements found` from `pip check`.

### Bootstrap and test tooling boundary

The clean venv was seeded by Python with `pip==23.2.1` and
`setuptools==68.1.2`; neither is declared in `backend/requirements.txt`, neither
is required by any installed runtime package (`Required-by:` is empty), and no
application HTTP module imports or invokes them. OSV does report packaging-time
advisories for that bootstrapped setuptools version — canonical IDs
`GHSA-cx63-2mw6-8hw5` (fixed `70.0.0`), `GHSA-5rjg-fvgr-3xxf` (fixed
`78.1.1`), and `GHSA-h35f-9h28-mq5c` (fixed `83.0.0`) — but those are not in
SnowRaven's resolved production runtime dependency graph or an HTTP-reachable
code path. They are therefore a developer/bootstrap-tool hygiene note, not an
application vulnerability. Likewise, pytest and Ruff are test/development tools,
not production requirements.

---

## Non-blocking Test-Only Compatibility Note

The independent backend run passed all 178 tests but Starlette `1.3.1` emitted:

```text
StarletteDeprecationWarning: Using `httpx` with `starlette.testclient` is deprecated; install `httpx2` instead.
```

Only test modules import `fastapi.testclient.TestClient`; no production module
imports TestClient or `httpx2`. Production startup and a live `/health` request
pass, and the application's production `httpx` client is unaffected. This is a
future test-harness migration note, not a runtime security or release blocker.

---

## Verification Evidence

- Independent QA: 178 backend tests; 1,602 frontend tests; focused 78-test
  feature suite; TypeScript; ESLint; Ruff; production build; startup/health;
  iframe inventory; and diff checks all passed.
- Current installed pins explicitly verified:
  `fastapi==0.141.1`, `starlette==1.3.1`,
  `python-multipart==0.0.32`, `python-dotenv==1.2.2`.
- `backend/.venv/bin/python -m pip check`: no broken requirements.
- Fresh clean-resolution `pip check`: no broken requirements.
- Official OSV API: exact-version query of all 25 resolved Python runtime
  packages returned zero advisories.
- npm registry audit: complete production graph, zero vulnerabilities.
- Source inventory: `frontend/src/components/MediaEmbed.tsx` is the only
  application iframe or Macaulay `/embed` constructor; its only two production
  call sites pass explicit eligibility after digits-only ID validation.
- Production build output contains zero source-map files.
- Tracked secret-marker, environment-file, injection-sink, URL-constructor,
  iframe, TestClient, and changed-console scans were reviewed.

## Convention Flags

None. The implementation follows the project's existing standing rules:
validate IDs before paths/URLs, keep durable settings behind the storage seam,
and keep external media requests closed until an explicit hydrated preference
allows them.
