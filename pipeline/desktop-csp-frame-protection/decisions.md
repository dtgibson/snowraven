# Decisions: desktop-csp-frame-protection

Improve lane, no design pass. Engineer stage, hands-off Spool spin (build 1 of 5).

## 1. The policy is written as a directive map of single-source lists

`app.security.csp` in `src-tauri/tauri.conf.json` is a map from directive to a JSON
list, never one policy string. Tauri accepts both, but its string parser splits on
single spaces (`tauri-utils-2.9.2/src/config.rs`, `From<Csp> for HashMap`), so a doubled
space becomes an empty source; and the list form is what the guard reads without a
parser of its own. The guard fails closed on any other shape, a string value included.

The policy is the Evaluator's starting policy (`csp-inventory.md` section 3) plus
`form-action 'none'` (security review L2: `form-action` does not fall back to
`default-src`, the app has no form, and no native navigation handler would stop one):

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: <favicon hosts> <eBird's S3 redirect host> <map hosts>;
connect-src 'self' ipc: http://ipc.localhost <map hosts>; worker-src 'self' blob:;
frame-src https://macaulaylibrary.org; object-src 'none'; base-uri 'self';
form-action 'none'; frame-ancestors 'none'
```

plus `"dangerousDisableAssetCspModification": ["style-src"]`.

## 2. `devCsp` is left unset, deliberately

`devCsp` falls back to `csp` when unset (`tauri-2.11.2/src/manager/mod.rs`, `fn csp`), so
it is not an off switch, and it would be dead configuration here anyway: on desktop
`tauri dev` points the window at `devUrl` (`get_app_url` under `cfg(dev)`), so Vite
serves the page and Tauri attaches no header; on iOS the dev proxy branch in
`protocol/tauri.rs` is `cfg(all(dev, mobile))` and only the other branch adds the
header. Measured: `npx tauri dev` (under a scratch identifier) compiled and launched,
Vite answered `/` with no `Content-Security-Policy`, and WebKit's networking process
held a connection to port 5173, which is the dev page and its hot-reload socket.
Reversal condition: a Tauri upgrade that starts serving dev pages through its own
protocol on desktop; then `npm run desktop:dev` would need a `devCsp` that admits
Vite's websocket and its inline preamble.

## 3. `worker-src blob:` stays, as a hedge rather than a measured need (risk R1)

The inventory reasoned from Node that `new URL('tauri://localhost/...').origin` is
`"null"`, which would send MapLibre down its blob-module worker path. WebKit disagrees:
in the built Mac app `location.origin` and `new URL(location.href).origin` both read
`tauri://localhost`, so MapLibre's cross-origin test is false and it constructs its
worker directly from the same-origin URL. Windows (`http://tauri.localhost`) takes the
direct path too. `blob:` is kept because a WebKit that reported the custom scheme's
origin as `"null"` (older iOS and macOS releases were not measured) would otherwise
lose the map entirely, MapLibre's own CSP guidance lists it, and a `blob:` worker
inherits this policy, so it can do nothing the page cannot. The limit that goes with
it (security review L3): Tauri attaches the policy only to HTML documents, so a worker
loaded by URL (MapLibre's on the direct path the Mac takes, and the app's three module
workers in `observationsCache.ts`, `parseMLExportOffThread.ts` and `statsOffThread.ts`)
runs with no policy of its own, while a `blob:` worker inherits the page's; the
follow-up idea (attach the header to worker script responses) is already saved.
Reversal condition: the
supported WebKit floor is shown to read the custom-scheme origin as a tuple; then
`blob:` can go from `worker-src` and the guard's exact row changes with it.

## 4. The map hosts are in `img-src` as well as `connect-src`

MapLibre 6 fetches raster tiles as bytes (`connect-src`) by default, but takes an
`HTMLImageElement` path (`img.src = url`, so `img-src`) when tile refresh is off
(`supportImageRefresh === false` in its `getImage`). The hedge costs nothing (the same
hosts, already disclosed) and the guard asserts both directives for every host in
`mapStyle.ts`, so the two lists cannot drift apart. `maps.md` says both.

## 5. The guard

`frontend/src/lib/tauriCsp.test.ts`, pure JS (the TypeScript compiler API, already used
by `inlineStyleShorthand.test.ts` and `tabOrderCoverage.test.ts`), so it runs on the
ubuntu CI job. Hosts are read from the call sites through the AST, where a comment is
never a node: every `https://` literal in `mapStyle.ts`, the `src` of the `<iframe>` in
`MediaEmbed.tsx`, and every `faviconSrc` prop in `SpeciesLinks.tsx`. A value the reader
cannot resolve to a fixed origin throws, including a template whose substitution
follows the host directly.

- `connect-src`, `frame-src` and `img-src` are asserted by EQUALITY with the derived
  set (plus `'self'` and the two IPC origins for `connect-src`; plus `'self'`,
  `data:`, `blob:` and one named constant for eBird's S3 redirect host, the one host no
  source line names, for `img-src`), so a host removed from source must leave the
  policy too and a foreign host cannot be added. The SET of directive names is pinned
  as well, because a more specific directive (`script-src-elem`, `style-src-elem`)
  overrides its parent and a new one (`font-src`) would be bounded by no row. Both
  rows were added at the security review (L1) and each was proven by one killing
  mutation on a scratch copy of the config run through a scratch copy of the guard
  (adding `font-src`; adding a foreign host to `img-src`), each turning exactly its
  own row red, with the working-tree config and guard hashed identical before and
  after.
- One row beyond the brief's list: no `tauri.<platform>.conf.json` overlay may carry
  `app.security`. Tauri merges the platform overlay over the base file as a JSON merge
  patch on every iOS build, so an overlay with `app.security` would silently replace
  the policy on that platform; the brief's "one webview, one config" rests on it.
  Overlays are found with `readdirSync(..., { withFileTypes: true })` and `isFile()`.
- Mutation table (scratch harness, snapshot-restore verified by sha256, no git): 29
  mutations of the config, the three call sites, the iOS overlay and the readers all
  turned the file red: 27 on the row meant to catch them, and the two reader
  mutations that broke the iframe's extraction by failing closed at load rather than
  reading nothing. 4 equivalent rewrites (reordered lists, a commented-out iframe and
  a commented-out tile host) stayed green.
- What it cannot see: an iframe or image added at a call site other than these three,
  and the http plugin's `https://**` fetch scope (Rust makes those requests).
- Declared scans: none. The guard reads repository source at test time, not user file
  content, so `.claude/rules/security.md`'s declared-scan rule does not apply.
- The test file adds no stylesheet rule: the built `index-*.css` and
  `vendor-maplibre-*.css` are byte-identical to a HEAD build made before any edit
  (sha256 `7f2b1be6...` and `a44e9c85...`), and the entry chunk's hash is unchanged.

## 6. How the policy was verified, and why it took two instruments

The Mac was locked for the whole unattended run (a `screencapture` showed the lock
screen), so the app window was hidden. WebKit suspends a hidden page's work soon after
load: a probe that drove the surfaces wrote nothing in thirteen minutes. Two
instruments replaced the one the brief named.

**Inside the built Tauri app** (`npx tauri build --debug --no-bundle --config
'{"identifier":"com.snowraven.cspprobe"}'`, a scratch data folder seeded with the
synthetic demo dataset, never the real data; a temporary probe module, since removed,
with `main.tsx` verified identical to HEAD). Synchronous checks and the first IPC
round trip complete before the page is suspended, and they showed:

- the served header, read with `fetch('/index.html')` from inside the page, is the
  config's policy with Tauri's sha256 list appended to `script-src` and NO nonce in
  `style-src`;
- the inline boot script ran (`window.srLaunch` defined, `data-theme` set), and its
  hash in that header equals the hash computed independently from `dist/index.html`
  (`sha256-QRGDbIcus1dDd5pWfUgnS7Y34Apch2D5/ZCPFEbbpvs=`);
- negative controls were refused with `enforce` violations: an injected inline
  `<script>`, indirect `eval`, `new Function`;
- an HTML-string `style="color: rgb(1, 2, 3)"` applied (`'unsafe-inline'` is in force);
- IPC worked under the policy (the probe's report was written through the fs plugin)
  with no IPC fallback error;
- the origin reading behind decision 3.

**Playwright WebKit over the same built bundle**, with the same policy and boot hash
delivered as a real response header by a loopback proxy in front of the FastAPI
backend on a scratch copy of the demo dataset (identity checked: the demo export's
file names answered). Zero violations across boot, the Map Explorer (Map, Satellite,
Topo (US), Trails, county lines, county shading with textures, atlas blocks and atlas
shading with textures), Species Detail, Named Birds with a row open, Statistics (map
and nine Recharts charts), Multimedia, Weather, Targets, Calendar, Checklists and
Settings. All four tile hosts answered 200. Favicons loaded exactly as in a no-policy
control leg of the same tour: all of them on Statistics (358), Multimedia (298),
Checklists (20) and Named Birds (6), and the same 4 of 22 on Species Detail in both legs
(the rest are `loading="lazy"` and off screen). The Species Detail pins' HTML-string
`fill:var(--sr-accent)` resolved to the accent color, and a Macaulay embed frame
loaded. The negative control then produced exactly three refusals: `connect-src`,
`img-src` and `frame-src` to `https://example.com`.

**An instrument defect, recorded so it is not rediscovered as a finding:** a first
WebKit leg injected the header with `page.route`, and every favicon hung with no
violation and no response while tiles loaded. A minimal page with the identical policy
served by a server loaded both favicons, and the full tour with the header from the
proxy loaded all of them. Playwright's WebKit request interception, once any route is
registered, stalled cross-origin images; the policy was never the cause.

## 7. What was not exercised

- The real Macaulay player inside the app: Cornell's bot gate is up
  (`/media/embed-status` answers `gated: true`), so no surface mounts an iframe today.
  `frame-src` was proven by a direct frame load in both instruments.
- The Map Explorer hotspot legend teardrops (`TEARDROP_HTML`) and the Media Targets
  chip icons need an eBird key, which the demo dataset does not carry. The same
  mechanism (an HTML-string `style=""` under `'unsafe-inline'`) was shown on the
  Species Detail pins and in the Tauri webview directly.
- Settings' update check: the web build has no updater, and the Tauri window was
  hidden. The updater is IPC, which the policy does not govern.
- iPhone, iPad and Windows: no device or Windows machine is touched. The user's own
  TestFlight install at the bundle ship is the iOS check; Windows is covered at config
  and guard level only.

## 8. Records left for The Chronicler

- `PRODUCT_CONTEXT.md`, the Tauri migration notes (lines 1624, 1631 and 1662): the
  `csp: null` "Phase 0 only, must be set before Phase 3" placeholder notes are stale.
- `ROADMAP.md` line 29, targets-hotspot-link residual (5): the clause "`tauri.conf.json`
  still sets `"csp": null`; a Tauri CSP is separate work" is resolved.
- `DECISIONS.md` 2034 (v0.5.65 Named Birds media) says "CSP is `null`"; historical, but
  a reader may take it as current.
- A saved idea is worth recording: narrow `http:allow-fetch` in
  `src-tauri/capabilities/default.json` from `https://**` to the hosts the services
  call (risk R5).
