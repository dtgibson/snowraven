## desktop-csp-frame-protection: a real CSP for the Tauri apps

### What this does
Replaces `"csp": null` in `src-tauri/tauri.conf.json` with a content security policy
for the one webview the Mac, Windows, iPhone and iPad apps share: the page runs only
its own bundled scripts, talks only to the map, favicon and IPC origins it already
uses, frames only the Macaulay Library embed, and cannot be framed. A new pure-JS
guard, `frontend/src/lib/tauriCsp.test.ts`, holds the policy to the call sites that
load those hosts, deriving each host from source instead of restating it. No component,
`index.html`, capability or backend file changes, and the built frontend is unchanged
(byte-identical CSS, same entry chunk); only the native app's served header differs.

### How to test
1. `cd frontend && npx vitest run src/lib/tauriCsp.test.ts` (18 tests).
2. Change a tile host in `frontend/src/lib/mapStyle.ts` (or the iframe host in
   `MediaEmbed.tsx`, or a `faviconSrc` in `SpeciesLinks.tsx`) without touching the
   policy, rerun, and see it go red; put it back.
3. From the repo root, `npx tauri build --debug --no-bundle`, run
   `src-tauri/target/debug/snowraven`, right-click > Inspect Element > Console, and
   use the Map Explorer (all bases, Trails, county and atlas shading with textures),
   Species Detail, Named Birds, Statistics, Weather, Targets and Settings. Expect no
   "Refused to ..." line. Dev mode (`npm run desktop:dev`) runs with no policy and
   cannot show one. Step by step: `how-to-see.md`.

### Notes for reviewer
- **Files.** `src-tauri/tauri.conf.json` (the policy and
  `"dangerousDisableAssetCspModification": ["style-src"]`); new
  `frontend/src/lib/tauriCsp.test.ts`; `.claude/rules/security.md` (two `paths`
  entries, a comment-block note, one rule bullet); `.claude/rules/maps.md` (a tile
  provider is also a CSP entry in `connect-src` and `img-src`). Pipeline:
  `decisions.md`, `changelog-line.md`, `how-to-see.md`, this file.
- **`'unsafe-inline'` in `style-src` is load-bearing**, and works only because
  `dangerousDisableAssetCspModification` is `["style-src"]`: otherwise Tauri adds a
  style nonce and the browser ignores `'unsafe-inline'`, dropping every HTML-string
  `style=""` (legend teardrops, Species Detail pins, Media Targets chip icons).
  `script-src` modification stays on; that is what admits the boot script's hash.
- **`devCsp` is deliberately unset** (decisions 2): desktop dev loads Vite directly
  and gets no header, so a `devCsp` would be dead configuration.
- **`worker-src blob:` is a hedge** (decisions 3): in the built Mac app MapLibre takes
  its direct worker path, because WebKit reads `tauri://localhost` as a real origin.
- **What I ran and saw.** The Mac was locked for this unattended run, so the app
  window was hidden and WebKit suspended the page shortly after load; two instruments
  replaced a manual console read (decisions 6):
  - Built Tauri debug app under a scratch identifier and the synthetic demo dataset
    (never the real data), with a temporary probe since removed (`main.tsx` verified
    identical to HEAD). The page read its own served header: the configured policy,
    with Tauri's sha256 list on `script-src` (the boot script's hash among them,
    matching an independent hash of `dist/index.html`) and no nonce on `style-src`.
    The boot script ran; an injected `<script>`, `eval` and `new Function` were
    refused with enforce-mode violations; an HTML-string `style=""` applied; IPC worked.
  - Playwright WebKit over the same built bundle, with the same policy delivered as a
    response header by a loopback proxy in front of the backend on a scratch copy of
    the demo dataset: zero violations across every tab, all four tile hosts 200,
    favicons loading exactly as in a no-policy control leg, a Macaulay frame loading,
    then exactly three refusals from the negative control (`connect-src`, `img-src`,
    `frame-src`).
  - `npx tauri dev` (scratch identifier) compiled and launched; Vite served the page
    with no policy header and WebKit held a connection to it.
  - `npm run typecheck`, `npm run build`, `npx eslint .`: clean. Full frontend suite:
    432 files passed, 5 skipped; 9,259 tests passed, 6 skipped. Built CSS and the entry
    chunk are byte-identical to a HEAD build. Mutation table: 29 mutations red, 4
    equivalent rewrites green (decisions 5).
  - A final `npx tauri build --debug --no-bundle` with the shipped config (no
    overrides) compiled; it was not run, since it would open the real data.
- **Security review fixes (L1-L3):** `form-action 'none'` added with an exact row
  (L2); the guard now pins the exact set of directive names and makes `img-src` an
  exact match with eBird's S3 redirect host as a named constant, each row proven by
  one killing mutation on a scratch copy of the config (L1); the rule text and
  decisions 3 now say a worker loaded by URL runs with no policy of its own while a
  `blob:` worker inherits the page's (L3). The built-app runs above predate
  `form-action`, which governs no load the app makes.
- **Not exercised** (decisions 7): the real Macaulay player in the app (Cornell's bot
  gate is up, so no surface mounts one; `frame-src` was proven by a direct frame
  load), the hotspot legend and Media Targets chips (need an eBird key), Settings'
  update check (IPC, not governed by the policy), any iPhone, iPad or Windows run.
  The user's own TestFlight install at the bundle ship is the iOS check.
- **Known limit, out of scope:** `http:allow-fetch` is scoped to `https://**`, so script
  that reached the webview could still send data out over IPC. Narrowing it is
  separate work.
- **No published copy changes and no version bump** (Spool spin). The proposed
  CHANGELOG line is in `changelog-line.md`. No `PRIVACY_POLICY.md` change: the policy
  only narrows what the page may load, adds no request or host, and moves no request
  between components.
