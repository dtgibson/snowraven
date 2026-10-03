# Change Brief: Desktop CSP and Frame Protection

## What is changing
The Tauri app (Mac, Windows, iPhone, iPad: one webview, one config) gets a real Content Security Policy in place of `"csp": null` in `src-tauri/tauri.conf.json`, so its page runs only its own bundled scripts, talks only to the hosts it already uses, and frames only the Macaulay Library embed.
The web/Pi half of the saved idea is ALREADY DONE and is not redone: since 1.0.48, `SECURITY_HEADERS` in `backend/main.py` (lines 140-161) sends `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff` and `Referrer-Policy` on every web/Pi response. A full backend CSP stays out of scope, as 1.0.48 decided.
Starting policy, every host traced to its call site: `pipeline/desktop-csp-frame-protection/csp-inventory.md` (read it first). In short: `script-src 'self'` with no `unsafe-inline`/`unsafe-eval` (Tauri adds the hash for `index.html`'s inline boot script itself); `style-src 'self' 'unsafe-inline'` plus `"dangerousDisableAssetCspModification": ["style-src"]`; `img-src`/`connect-src` for the map and favicon hosts and the IPC origins `ipc:` `http://ipc.localhost`; `worker-src 'self' blob:`; `frame-src https://macaulaylibrary.org`; `object-src 'none'`; `base-uri 'self'`; `frame-ancestors 'none'`.
API calls (eBird, OpenWeather, NOAA, Nominatim, GitHub) go through the http plugin over IPC, so they need no host entries.
Changes: `src-tauri/tauri.conf.json`; one new guard test under `frontend/src/lib/`; `.claude/rules/security.md` (add `src-tauri/tauri.conf.json` and the guard to its `paths`, plus one bullet); `.claude/rules/maps.md` (a tile provider is now also a CSP entry); `decisions.md` and `changelog-line.md` in this folder.
Does NOT change: any component or `index.html` (the three HTML-string `style=""` attributes stay), capabilities, `tauri.ios.conf.json`, `tauri.icloud.conf.json`, the backend, version files, `CHANGELOG.md`, `website/`, `README.md`, `appstore/`, `PRIVACY_POLICY.md`, `ACCESSIBILITY.md`, `docs/HELP.md`. Spool spin: no bump; the proposed CHANGELOG line goes to `changelog-line.md`.

## Why now
A saved idea from the inbox. Its backend half shipped in 1.0.48 (the targets-hotspot-link security finding F4), and ROADMAP.md (targets-hotspot-link residual 5) names the remaining `"csp": null` as separate work.
`PRODUCT_CONTEXT.md` has called `csp: null` a "Phase 0 only, must be set before Phase 3" placeholder since the Tauri migration; Phase 3 shipped long ago.
Honest scope of the gain: a web page cannot frame `tauri://` at all, so on desktop this is defense in depth. If a script ever reached the webview (an injection bug in one of the `dangerouslySetInnerHTML` paths, a compromised dependency), today it could pull in more code from anywhere and beacon data out through ordinary page requests; the CSP closes both. It does NOT close the http plugin route: `capabilities/default.json` grants `http:allow-fetch` for `https://**`, so injected script could still send data out over IPC. Narrowing that scope is separate work, not this build.

## User-facing impact
None intended. If a host is missed, the symptom is a blank map base or overlay, an empty Macaulay embed, a species-link favicon replaced by its fallback glyph, or the launch splash never releasing (if the boot script's hash fails). Each is a Tester check.
`'unsafe-inline'` must stay effective for styles because three HTML-string `style=""` attributes would otherwise be dropped silently: the Map Explorer hotspot legend teardrops (`TEARDROP_HTML`, `lib/mapExplorerFormat.ts:9`) and the Media Targets chip icon row (`components/map/TargetMarkers.tsx:76`). React `style={}` props use CSSOM and are unaffected.
`npm run desktop:dev` must keep opening with hot reload.

## Design pass
Not needed. No visual change.

## Decisions touched
- DECISIONS.md, 1.0.48 cross-site writes entry: its web/Pi headers are relied on as the done half. Its rejection of "a full CSP" concerns the backend and is NOT reversed.
- ROADMAP.md line 29, residual (5): the "`tauri.conf.json` still sets `"csp": null`" clause is resolved here (The Chronicler updates it).
- PRODUCT_CONTEXT.md, Tauri migration notes (around lines 1624, 1631, 1662): the `csp: null` placeholder notes go stale (The Chronicler).
- `pipeline/named-birds-media/schema.md` section 5 standing note: confirmed, with one correction. The parent policy needs only `frame-src https://macaulaylibrary.org`; the player's own loads are governed by its own document.
- `.claude/rules/maps.md` tile-provider rule: a provider change becomes a CSP change too, enforced by the new guard.
- CLAUDE.md single-webview invariant and the `windows: ["main"]` capabilities: unaffected.
- Published copy: none. No held `PRIVACY_POLICY.md` patch is needed: a CSP only narrows what the page may load. It adds no third-party request, no endpoint or host, and moves no request between components.

## What done looks like
Guard test (suggested `frontend/src/lib/tauriCsp.test.ts`, pure JS so it runs on ubuntu CI, in the style of `iosSceneManifest.test.ts`): parses `tauri.conf.json`; the CSP is non-null; every directive above is present; `script-src` carries no `'unsafe-inline'`/`'unsafe-eval'`; no directive allows bare `*` or `https:`; `connect-src` carries both IPC origins; `dangerousDisableAssetCspModification` is exactly `["style-src"]`. Hosts are DERIVED from source with comments stripped, never restated: `mapStyle.ts` style and tile hosts in `connect-src`, the `MediaEmbed.tsx` iframe host in `frame-src`, the `SpeciesLinks.tsx` favicon hosts in `img-src`. A guard-the-guard row proves the extraction finds them, and each assertion is mutation-checked red.
Built Mac app, not `tauri dev` (on desktop the dev window loads Vite directly and gets no CSP; see the inventory, section 4). For example `npx tauri build --debug --no-bundle`, then the Web Inspector console shows zero CSP violations: the splash releases and theme applies, and the Map Explorer (all four bases, county and atlas shading with textures), Species Detail (map, ML embed, favicons), Named Birds media, Statistics map and charts, Weather and Planner, Targets, and Settings' update check all work. Record which MapLibre worker path ran (inventory, risk R1).
`npm run desktop:dev` still opens with hot reload. The full frontend suite, typecheck and `npm run build` pass.
iPhone and iPad: no agent touches a device. The check is the user's own TestFlight install at the bundle ship (simulator allowed, optional). Windows (`http://tauri.localhost`, `http://ipc.localhost`) is covered at the config and guard level only.
