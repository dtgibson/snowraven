# Change Brief: Narrow the desktop http permit

## What is changing
`src-tauri/capabilities/default.json` lets the http plugin fetch any `https://**` URL. That narrows to the
six origins the `lib/tauri/` services fetch (Host inventory). Each entry names one fixed https host, with no
wildcard in the host and no port, scoped to the path prefix its call site fixes (for example
`https://api.ebird.org/v2/*`), because the plugin checks only the first URL (see redirects below).
`http:default` stays a bare string, no other capability file and no `tauri.conf.json` key grants an http scope,
and `windows: ["main"]` stays. A new vitest guard shaped like `lib/tauriCsp.test.ts` derives the origins from the
TypeScript AST of every file that imports `tauriFetch`, set-equal to the permit, red first against `https://**`,
failing closed if any file other than `lib/tauri/http.ts` imports `@tauri-apps/plugin-http`, with guard-the-guard
rows. `.claude/rules/security.md` gains the permit rule (and the new test's path in its `paths`), and the CSP rule's
"Stated limit" sentence and `tauriCsp.test.ts`'s header comment are updated. Unchanged: the CSP, all service code.

## Why now
The 1.0.49 security review (I3) found that script that reached the webview could still send data to any https
host over IPC, outside the new content security policy, and saved this as the follow-up the CSP rule names as
its stated limit. With the CSP in place, this permit is the widest outbound door left, and the worker-policy
follow-up (L3) was explicitly sequenced after it.

## User-facing impact
None if the inventory is complete. Web and Pi are untouched, because the backend makes those calls. The risk is
a missed host: the plugin refuses before sending, `isOfflineError` (`lib/offlineDetect.ts:69`) reads that
statusless rejection as offline, and the surface shows offline or replayed data in the Mac, Windows, iPhone and
iPad apps only, while `npm run dev` and vitest stay green (the 2026-05-26 post-mortem's silent shape). The
compiled permissions change in every Tauri binary, iOS included (`default.json` has no `platforms` field), so this
rides the bundle's version bump and gets a CHANGELOG line. No published copy changes: `PRIVACY_POLICY.md` already
names these six services, and the permit now enforces that list.

## Design pass
Not needed: no visual change.

## Decisions touched
- 2026-05-26, "tauri-plugin-http v2.5.x requires explicit URL scope": this is the narrowing its "scope it more
  narrowly if needed" left open. The `http:allow-fetch` requirement stands; superseded in part, not reversed.
- 1.0.49, desktop-csp-frame-protection: closes saved follow-up (1) (security I3). Follow-up (2), the worker policy
  (L3), stays open, as the free channel that entry predicted.
- `.claude/rules/security.md`: the CSP rule's "Stated limit" sentence and the `src-tauri/capabilities/**` gate note.
- ROADMAP.md, "Two follow-ups to the Tauri content security policy": item (1) closes.
- CLAUDE.md single-webview invariant: the `windows: ["main"]` backstop is kept as is.

## What done looks like
1. The CI guard passes against the narrowed permit and fails against `https://**` and against a wildcard host.
2. One real Tauri-mode check on this Mac: `npm run desktop:dev` under a scratch identifier. Each of the six
   hosts answers with any HTTP status (a 401 or 403 without a key still proves the permit let the request
   through, because a refusal happens before sending), and one unlisted host is refused with "url not allowed on
   the configured scope". Dev mode counts here, unlike for the CSP: tauri-build compiles `capabilities/` into
   the binary (`cargo:rerun-if-changed=capabilities`), and the permissions are enforced in dev and release alike.
3. The full frontend suite, typecheck and build pass.

## Host inventory

### In the permit: 6 origins (all files under `frontend/src/lib/tauri/`)
| Origin | Path its call site fixes | Proof (base literal; fetch) |
|---|---|---|
| `https://api.ebird.org` | `/v2/` | `mapService.ts:16` (:34 :44 :76 :117 :152 :171), `regionInfo.ts:10` (:22), `taxonomyService.ts:4` (:129), `weatherService.ts:13` (:35 :58 :74), `checklistService.ts:8` (:142) |
| `https://api.openweathermap.org` | `/data/3.0/` | `weatherService.ts:14` (:99 :261) |
| `https://api.tidesandcurrents.noaa.gov` | `/api/prod/datagetter` | `tideService.ts:24` (:50) |
| `https://nominatim.openstreetmap.org` | `/search`, `/reverse` | `nominatimService.ts:3` (:53 :99; fetch :33) |
| `https://macaulaylibrary.org` | `/asset/<id>/embed` | `mediaService.ts:38` (:37), the once-a-session embed status check |
| `https://api.github.com` | `/repos/dtgibson/snowraven/releases/latest` | `versionService.ts:4` (:19). Unreachable in the Tauri apps today: `App.tsx:841` sends their update check to the updater, and only the web branch (:857) asks `/version/check`. Kept at its one exact URL because `transport.ts:175` still routes it; removing the route and the entry is a separate idea. |

### Not in the permit, and why
- `github.com/.../releases/latest/download/latest.json` and GitHub's asset redirect: updater-owned. `tauri.conf.json`
  `plugins.updater.endpoints`, fetched by tauri-plugin-updater 2.10.1's own client (`src/updater.rs:451`, `:663`),
  which never reads the http scope; the download is signature-verified.
- Map style and tile hosts (`lib/mapStyle.ts:12-13`, `:79`, `:81`, `:83`), the ebird.org and birdsoftheworld.org
  favicons (`components/SpeciesLinks.tsx:147`, `:154`) and eBird's S3 redirect host: webview loads, under the CSP.
- The macaulaylibrary.org player iframe (`components/MediaEmbed.tsx:153`): same host as the status check, but a
  webview frame under `frame-src`, not a plugin fetch.
- api.ebird.org from the iOS widgets and Alerts: native URLSession
  (`gen/apple/snowraven_widgets/Sources/Logic/EBirdRequest.swift:13`), not the plugin.
- Rust: `src-tauri/src/*.rs` sends no HTTP of its own (no reqwest or ureq). iCloud is a file container.
- Links opened in the browser: the opener plugin, not a fetch.

### How the plugin matches (tauri-plugin-http 2.5.9, `src/scope.rs`, `src/commands.rs`)
- URLPattern (urlpattern 0.3.0): exact hostname, default port only; an empty or `/` path, an empty query and an
  empty hash are widened to `*`, so query strings always match. `deny` entries exist and win over `allow`; none is
  needed.
- Redirects: the scope is checked once, on the requested URL (`commands.rs:216-229`). reqwest then follows up to 10
  redirects unchecked; no service sets `maxRedirections` (`:255`). So narrowing cannot break a redirect, and the
  permit bounds the first hop only, which is why entries carry path prefixes. None of the six redirected from this
  Mac on 2026-10-03.
- CI runs Node 20, which has no `URLPattern`, so the guard checks structure (fixed host, no wildcard, entry path a
  prefix of each literal). A row that tests matching itself must not skip on CI and pass as coverage.
- `src-tauri/gen/schemas/` is gitignored (`.gitignore:38`) and rebuilt by tauri-build: nothing to regenerate or commit.
