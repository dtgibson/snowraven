## Narrow the desktop http permit (http-permit-narrowed)

### What this does
The Mac, Windows, iPhone and iPad apps send every API call through the Tauri http plugin, and the plugin's fetch scope in `src-tauri/capabilities/default.json` admitted any `https://**` URL. This narrows it to the six origins the `frontend/src/lib/tauri/` services actually call, each held to the path its call site fixes, which closes security finding I3 from the 1.0.49 review: script that reached the webview could send data to any https host over IPC, outside the content security policy. A new vitest guard, `frontend/src/lib/tauriHttpScope.test.ts`, derives the origins and paths from the services' source and goes red when the permit and the code disagree in either direction. No service code changes, and nothing a user sees changes.

The permit, exactly as written:

```json
{ "url": "https://api.ebird.org/v2/*" },
{ "url": "https://api.openweathermap.org/data/3.0/*" },
{ "url": "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter" },
{ "url": "https://nominatim.openstreetmap.org/search" },
{ "url": "https://nominatim.openstreetmap.org/reverse" },
{ "url": "https://macaulaylibrary.org/asset/*/embed" },
{ "url": "https://api.github.com/repos/dtgibson/snowraven/releases/latest" }
```

`http:default` stays a bare string, `windows: ["main"]` is unchanged, and no other capability file or config key grants an http scope.

### How to test
1. `cd frontend && npx vitest run src/lib/tauriHttpScope.test.ts src/lib/tauriCsp.test.ts` (both green; the new file has 48 rows, 39 from the build and 9 from the security errand below).
2. Red-first, by hand: in `src-tauri/capabilities/default.json` replace the `allow` list with `[{ "url": "https://**" }]` and run step 1 again. Four rows of the new file go red (the entry check, origin equality, call-site admission, and every-entry-used). Restore the file.
3. In the Mac app (`npm run desktop:dev` from the repo root), with your keys set: open Map Explorer and load hotspots (eBird), look up weather and tide for a checklist on the Weather tab (OpenWeather, NOAA), search by place name in Map Explorer (Nominatim), and open a Species Detail page with embedded media (the Macaulay Library check). Each should load live data exactly as before. The GitHub version check is not reachable in the Tauri apps (they use the updater), so it cannot be exercised there.

### Notes for reviewer

**How the guard works.** It walks every TypeScript file under `frontend/src` that can ship (test files, `src/test/` and the test setup excluded), finds the files that import `lib/tauri/http.ts` (nine today, all in `lib/tauri/`), and reads their URLs through the TypeScript AST: every literal starting with `https://`, and every template led by a module constant holding one, with each substitution read as `*` and the query dropped. It reads 20 call-site URLs, matching every call site the change brief cites. Against the permit it checks: each entry is one fixed lower-case https host with no wildcard, port, credentials or address, then a path with at most one `*` standing for whole segments after at least one fixed segment; the permit's origins equal the derived origins; every call-site URL falls inside an entry for its host; and every entry admits at least one call-site URL (so an entry left behind by a removed call site goes red). It also fails closed if any shipped file other than `lib/tauri/http.ts` imports `@tauri-apps/plugin-http` or names a `plugin:http|` command, if any capability file other than `default.json` (or any inlined capability in a `tauri*.conf.json`) carries an http permission, and if the reader meets a URL it cannot pin to a fixed https host (a substitution in or glued to the host, a port, `http://`, an exported or non-const base).

**Why structural, not a URLPattern match.** CI runs Node 20, which has no `URLPattern`. The guard models the plugin's matching (tauri-plugin-http 2.5.9 `src/scope.rs`, urlpattern 0.3.0) by structure: exact path for an entry with no `*`, fixed text on both sides of the `*` otherwise. The model is conservative: a call-site substitution that lands inside an exact path, or outside an entry's fixed text, is treated as not admitted.

**Red-first table** (the new file's 39 rows; each mutation applied to a snapshot of the working set, restored and verified by sha256 after every run; the unmutated baseline was 0 red of 39):

| Mutation | Red |
|---|---|
| Permit back to `https://**` | 4 (entry check, origin equality, call-site admission, every-entry-used) |
| eBird entry with a wildcard host (`https://*.ebird.org/v2/*`) | 4 (same four) |
| A wildcard-host entry added beside the seven | 3 (entry check, origin equality, every-entry-used) |
| Nominatim `/reverse` entry removed | 1 (call-site admission) |
| Dead entry on a fetched host (`/v1/*`) | 1 (every-entry-used) |
| OpenWeather entry on the wrong version | 2 (call-site admission, every-entry-used) |
| Root-path eBird entry (`https://api.ebird.org/*`) | 4 |
| A second http scope in `desktop.json` | 1 (one-http-scope row) |
| `http:default` given a scope of its own | 1 (one-http-scope row) |
| A service gains a host the permit lacks | 2 (origin equality, call-site admission) |
| A service path moved outside its entry (`/v3`) | 1 (call-site admission) |
| A service imports the plugin directly | 1 (plugin-import row) |
| A service names `plugin:http|fetch` | 1 (plugin-import row) |
| Analyser: the importer scan matches nothing | 5, including the real-tree row (call-site admission stays green vacuously, which is why that row exists) |
| Analyser: bases never resolved through their templates | 4 |
| Analyser: admission ignores the exact path | 1 (the admission-model row; the permit rows stay green, which is why that row exists) |
| Analyser: the entry check accepts any host | 6 (the six host rows of the refusal table) |
| Analyser: comments read as live code | 16 |

**Dev-mode check, run on this Mac (done criterion 2).** `npm run desktop:dev -- --no-watch --config '{"identifier":"com.snowraven.scratch-http-permit","build":{"devUrl":"http://127.0.0.1:17631","beforeDevCommand":"true"}}'`, with the window pointed at a scratch probe page served from outside the repo that loads the plugin's own JS (`@tauri-apps/plugin-http` 2.5.9 from `frontend/node_modules`, through an import map) and calls its `fetch` exactly as `tauriFetch` does. The scratch identifier kept the real `com.snowraven` data directory closed; the only folder it created (`~/Library/Caches/com.snowraven.scratch-http-permit`) was removed afterwards. tauri-build compiled the narrowed capability into that binary (the dev profile rebuilt the app crate), and 15 of 15 cases came out as expected:

| Request | Result |
|---|---|
| `api.ebird.org/v2/ref/hotspot/geo?...` (a nested path, so `*` crosses `/`) | sent, HTTP 403 (no key) |
| `api.ebird.org/v2/product/checklist/view/S100000000` | sent, HTTP 403 (no key) |
| `api.openweathermap.org/data/3.0/onecall?...` | sent, HTTP 401 (dummy key) |
| `api.openweathermap.org/data/3.0/onecall/timemachine?...` | sent, HTTP 401 (dummy key) |
| `api.tidesandcurrents.noaa.gov/api/prod/datagetter?...` | sent, HTTP 200 |
| `nominatim.openstreetmap.org/search?...` | sent, HTTP 200 |
| `nominatim.openstreetmap.org/reverse?...` | sent, HTTP 200 |
| `macaulaylibrary.org/asset/611213066/embed` | sent, HTTP 200 |
| `api.github.com/repos/dtgibson/snowraven/releases/latest` | sent, HTTP 200 |
| Control: `https://example.com/` (unlisted host) | refused: `url not allowed on the configured scope: https://example.com/` |
| Control: `https://api.ebird.org/v1/ref/taxonomy/ebird` (listed host, path outside the entry) | refused, same error |
| Control: `https://api.github.com/` (listed host, other path) | refused, same error |
| Control: `http://api.ebird.org/v2/ref/taxonomy/ebird` (plain http) | refused, same error |
| Control: `https://macaulaylibrary.org/asset/611213066` (outside `/asset/*/embed`) | refused, same error |
| Control: `https://nominatim.openstreetmap.org/status` (listed host, other path) | refused, same error |

None of the admitted requests redirected (the final URL equaled the requested one). The controls are what make this a measurement: under the old `https://**` scope the first four would have been sent.

**Decisions made during implementation.**
- The derivation reads every shipped file that imports `lib/tauri/http.ts`, wherever it lives, rather than only `lib/tauri/`: a caller added elsewhere is still read. Every importer must yield at least one URL, so a file whose URLs the reader cannot see fails as a reader failure instead of passing as a file with nothing to check.
- A module constant holding a URL counts as a base when every use of it leads a template, and as a URL in its own right otherwise (so `GITHUB_API`, passed to `tauriFetch` bare, must match its exact entry, and `EBIRD_BASE`, only ever a template prefix, does not need `/v2` itself admitted).
- OpenWeather stays at `/data/3.0/*`, as the brief approved, although both call paths are fully fixed and two exact entries would also pass the guard: same host, and the query passes either way.
- Macaulay uses `*` (`/asset/*/embed`) rather than a URLPattern named group, so the guard models one wildcard form; the call site already admits only digits and encodes them.
- The "at least six derived origins" row is a floor on the denominator, not a second copy of the list: removing a service lowers it in the same change, and adding one is the permit rows' business.
- `tauriCsp.test.ts`: besides the header paragraph that named the `https://**` scope as its blind spot, the first paragraph's list of API hosts (which omitted the Macaulay Library check) now states the property instead ("every `lib/tauri/` service").
- Because a test file under `frontend/` is a Tailwind source, the built CSS was compared against a build with HEAD's versions of the two test files: byte-identical (`index-kngkoBkd.css` and `vendor-maplibre-CKRTiAqP.css`, same sha256).

**Known limitations, stated in the guard's header and the rule.** A URL built from something other than a literal in the importing file is invisible to the guard and is refused by the permit unless it falls inside an entry. The permit bounds where a request goes, not its method, headers, body or query, and only the first hop of a redirect. The updater, the iOS widgets' and Alerts' native requests, and everything the page loads itself (the CSP's business) are outside it by design. Follow-up (2) in ROADMAP, attaching the policy to worker script responses (security L3), stays open.

**Gates run.** `npx vitest run src/lib/tauriHttpScope.test.ts src/lib/tauriCsp.test.ts src/lib/storage.countyDayObs.test.ts src/lib/statementsPublishedClaims.test.ts` (the guard plus every test that reads `capabilities/`): 4 files, 100 tests passed. Full suite `npx vitest run`: 437 files passed, 5 skipped; 9,356 tests passed, 6 skipped. `npm run typecheck`, `npm run lint` and `npm run build` clean. `cargo build` in `src-tauri` with the normal config clean (tauri-build validates the capability against the plugin's schema).

**Docs.** `.claude/rules/security.md` gains the permit rule beside the CSP rule, the CSP rule's "Stated limit" and worker sentences are corrected, and the new test joins the rule's `paths` (`src-tauri/capabilities/**` was already gated). ROADMAP's CSP follow-up (1) is marked FIXED. No published copy changes: `PRIVACY_POLICY.md` already names these six services. The change alters the compiled permissions in every Tauri binary, iOS included, so it rides the bundle's version bump and wants a CHANGELOG line at the deploy stage.

### Security errand (after the security review)

This closes L2, L1 and I5 in `security-report.md`. `default.json` and the service files are unchanged.

- **L2, dot segments.** `tauriHttpScope.test.ts` gets one shared check, `DOT_SEGMENT`. It matches a `.` or `..` path segment in every spelling the URL parser reads as one (`%2e` in either case, and `\` as a separator), ended by a separator or the end of the path.
  - `parseEntry` refuses a dot segment, and any percent escape, in an entry.
  - `splitShape` refuses a dot segment in a call-site URL's fixed path.
  - Nine new rows: five entry refusals (`/v2/../*`, `/v2/%2e%2e/*`, `/v2/./*`, a trailing `/v2/..`, a percent escape), three call-site refusals (the review's M3b pairing `${B}/../ref/x`, `%2E%2E` in capitals, a dot segment between backslashes), and one row that must stay green: the real permit and URLs, plus segments that only contain a dot (`3.0`, `.well-known`, `..x`, `x..`, `...`, `latest.json`).
- **L1, tightness.** Closed with a rule clause rather than a tightness row (`decisions.md`, 2026-10-03). The rule and the guard's header now say the guard enforces a floor, and that tightness is a review check on any `src-tauri/capabilities/**` diff.
- **I5, rule wording.** Three changes to the permit bullet in `.claude/rules/security.md`, checked across the whole paragraph:
  - Point (2) now says a URL the guard cannot see is refused "unless it falls inside an entry".
  - The history sentence now says the scope was `https://**` through 1.0.49 and is narrowed in the release after it.
  - Point (1) now carries the L1 clause and the dot-segment and percent-escape refusal.

**Red-first.** Each mutation was made to a scratch copy of the guard placed beside it. Each one matched exactly once and changed the text. Afterwards the scratch copy was removed and the real guard's sha256 was unchanged.

| Mutation | Red of 48 |
|---|---|
| Unmutated copy (baseline) | 0 |
| No dot check in either function | 7 (four entry dot rows, three call-site rows) |
| No dot check in `parseEntry` | 4 (the four entry dot rows) |
| No dot check in `splitShape` | 3 (the three call-site rows) |
| No percent check in `parseEntry` | 1 (the percent row) |
| Regex matches `..` only | 1 (`/v2/./*`) |
| Regex matches `.` only | 6 |
| Regex matches any run of dots | 1 (the must-stay-green row, on `...`) |
| Regex drops the `%2e` spelling | 2 |
| Regex is case-sensitive | 1 (`%2E%2E`) |
| Regex drops the end-of-path arm | 1 (the trailing `/v2/..`) |
| Regex takes `/` as the only separator | 1 (the backslash row) |
| Regex drops the lookahead | 1 (the must-stay-green row) |
| Regex drops the leading separator | 1 (the must-stay-green row) |
| Naive form, any `.` refused | 10, including the real-tree rows (OpenWeather's `3.0`) |

**Gates.**
- `npx vitest run src/lib/tauriHttpScope.test.ts src/lib/tauriCsp.test.ts`: 66 passed (48 + 18).
- `npm run typecheck` and `eslint` on the guard: clean.
- The test file is a Tailwind source, so the frontend was built into a scratch directory: `index-kngkoBkd.css` and `vendor-maplibre-CKRTiAqP.css` came out byte-identical (same sha256) to the build recorded above.
