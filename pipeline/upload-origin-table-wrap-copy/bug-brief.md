# Bug Brief — Upload origin check, security headers, Targets name wrap, two Settings sentences

Four confirmed defects, one fix run. Issues 1 and 2 are web/Pi backend only (the Tauri
desktop and iOS apps never call the backend: `storage.ts:1376` and `transport.ts:347`
pick `TauriStorage`/`TauriTransport` when `isTauri()`). Issues 3 and 4 are frontend and
reach every platform. Evaluated on `main` at `bf961b9` (1.0.47 included).

## What is broken

**1. Cross-site writes on the self-hosted server.** A page on any other site can make
the user's browser overwrite their stored files and settings on a web/Pi install with
no preflight and no Origin check. CORS (`allow_origins=["http://localhost:5173"]`)
only stops the attacker reading the response; the write still lands. Measured with
TestClient, `FastAPI 0.141.1`, `Origin: https://evil.example`, isolated `SR_DATA_DIR`:

| Route | Body | Cross-site without preflight? |
|---|---|---|
| `POST /settings/files/ebird`, `/settings/files/ml` | multipart | **Yes**: 200, backup / ML export replaced |
| `POST /settings/barcharts/{regionCode}` | multipart | **Yes**: 200, file + manifest written |
| `POST /settings/{key}` (`settingskv.py`) | raw body, `json.loads` itself | **Yes**: 200 with `text/plain`, form-urlencoded, or no Content-Type |
| `POST /settings/keys/{name}`, `/settings/map-defaults` | pydantic JSON | No: 422 for text/plain, form, multipart, no Content-Type; `.env` untouched |
| `POST /taxonomy/codes`, `/nominatim/counties` (read-only lookups) | pydantic JSON | No: 422 |
| Every `DELETE` (files, keys, map-defaults, `{key}`, barcharts, barcharts/{code}) | none | No: needs a preflight; evil-origin preflight gets 400 "Disallowed CORS origin" |

Already recorded as an accepted Informational finding in `ROADMAP.md` line 47 (v1.0.39).

**2. No browser security headers.** No `X-Frame-Options`, CSP, `X-Content-Type-Options`
or `Referrer-Policy` anywhere (grep of `backend/`, `frontend/index.html`; `/health`
returns only `content-length` and `content-type`). The app can be framed by any site.

**3. Targets table scrolls sideways at phone width and large text. Still present after
1.0.47, and still the Species column.** Cause: `.sr-birdname-sci` is `white-space:
nowrap` (globals.css:854) inside `.sr-birdname`, an `inline-flex` column whose width is
shrink-to-fit, so its min-content is the whole scientific name on one line. In the phone
tier the name cell is `min-width: 0`, nothing caps the BirdName box, and the
ellipsis never engages: the box runs past the cell. 1.0.47 changed only the Last report
cell (HotspotLink plus the 13px glyph hang), which neither causes nor fixes this.

**4a. Appearance sentence false on every platform.** `Settings.tsx:181`: "Your
preference will be saved in this browser's local storage, on this device only. Nothing
is sent to the server." `theme.ts persistThemePreference` writes localStorage AND
`storage.setSetting('theme')`. Web/Pi: `POST /settings/theme` to the server
(`data/settings/theme.json`), and `App.tsx:570` applies that value in every browser that
opens the install, so both "this device only" and "nothing is sent" are false.
Tauri (Mac, Windows, iPhone, iPad): saved in `AppLocalData/data/settings.json`, not
browser local storage (which WKWebView wipes on relaunch). Same failure class as
`security.md` "a no-network-call claim is a claim about all six targets".

**4b. Bar-chart section says "this device" on web/Pi. Still real.** The orchestrator's
grep missed it because the noun is templated: `BarChartFilesSection` (Settings.tsx:1650)
uses `hereWord(ics.platform)`, which is "this device" whenever `platform` is null, which
is always on web/Pi. So web/Pi shows "Saved for N counties on this device.", "No
bar-chart files are saved on this device.", "Couldn't check for bar-chart files on this
device.", the Remove-all body "will be removed from this device", and the partial-failure
alert "remain on this device" (builders in `icloudCopy.ts:324-351`). Web/Pi stores them on
the server (`backend/routers/barcharts.py`, `data/barcharts/`). Windows also gets "this
device", which is true there. Other `hereWord` call sites (Settings 505/2603/2627,
TargetsBarChartFile 315) render only with iCloud, so Apple only, and are correct.

## Steps to reproduce

**1.** Run `backend/.venv/bin/python` with `SR_DATA_DIR` set to a temp dir and
`routers.apikeys.ENV_FILE` patched to a temp file (never the real `data/` or `.env`), then
`TestClient(main.app).post("/settings/files/ebird", files={"file": ("x.csv", b"a,b\n", "text/csv")}, headers={"Origin": "https://evil.example"})` returns 200 and writes `ebird-backup.csv`.
Same shape for `/settings/barcharts/US-CA-001` (multipart `.txt`) and
`/settings/theme` with `content=b'"dark"'` and `Content-Type: text/plain`.
In a browser: an HTML `<form enctype="multipart/form-data">` or a `no-cors` fetch from any site.

**2.** `TestClient(main.app).get("/health").headers` or `curl -I http://localhost:1620/`
with `./start.sh` running: no security headers.

**3.** Measured (Playwright, Chromium and WebKit, freshly built CSS, static reproduction of
the phone-tier row markup taken from `TargetsList.tsx`/`BirdName.tsx`/`HotspotLink.tsx`,
`--sr-text-scale` set inline on `<html>`, panel padding 24px). Scroll of `.sr-scroll-x`
(BirdName box past the cell): 320px at 200% = **74px** (83px), driven by "Xanthocephalus
xanthocephalus"; "Chroicocephalus philadelphia" +53, "Coccothraustes vespertinus" +38;
360px at 200% = 34px; 400px at 200% = 0 (3px absorbed by row padding); 150% at 320px =
0 (9px absorbed). Identical in both engines. In the app: Targets tab, any county whose
pool includes Yellow-headed Blackbird or Bonaparte's Gull, 320px wide, Text size 200%.

**4a.** Settings, Appearance, choose Light or Dark with no saved choice: the prompt shows
the sentence. On web/Pi, watch `POST /settings/theme`; open the install in a second
browser and the chosen theme is applied after load.

**4b.** Web/Pi (`npm run dev` or `./start.sh`), Settings, Bar-chart files section. With
one file added on Targets: "Saved for 1 county on this device." `Settings.barcharts.test.tsx`
lines 104-188 currently pin this wording with `isTauri` mocked false.

## Expected behavior

**1.** State-changing requests are accepted only from SnowRaven's own page. Refuse (403)
any unsafe-method request a browser sends cross-site; `Origin: null` counts as foreign.
Requests with no `Origin` and no `Sec-Fetch-Site` keep working: curl, every backend test
(TestClient sends neither), and Node `fetch` in `website/tools/capture-lib.mjs:360` (Node
sends no Origin or Sec-Fetch-Site but does send `sec-fetch-mode: cors`, so never key on
that). `settingskv.py` also requires `application/json` (the ROADMAP fix line); its
`test_non_json_body_rejected_422` posts `text/plain` and will change.
Deployment shapes that must keep working, which is why a plain `Origin == Host`
check is not enough: `./start.sh` (same origin on :1620, browser sends Origin on every
POST/DELETE, `Sec-Fetch-Site: same-origin`); the Vite dev proxy, whose string shorthand
sets `changeOrigin: true` (verified in `node_modules/vite/dist/node/chunks/node.js:17926`),
so the backend sees `Host: localhost:1620` with `Origin: http://localhost:5173` or
whatever LAN/tailnet host the dev page was opened on; a Pi by LAN hostname or IP; a Pi
behind nginx (default rewrites Host) or `tailscale serve` (https outside, http to uvicorn).
Two mechanisms fit (The Engineer picks): backend-only, refuse when `Sec-Fetch-Site` is
present and not `same-origin`, falling back to Origin host[:port] vs Host /
`X-Forwarded-Host` / the dev origin when it is absent (Safari before 16.4); or require a
custom header on POST/DELETE whenever Origin or Sec-Fetch-Site is present (it forces a
preflight the CORS middleware already refuses), added in `WebStorage`/`WebTransport`.

**2.** Every backend response, the static SPA included (that is what framing protection
is for), carries `X-Frame-Options: DENY`, `Content-Security-Policy: frame-ancestors
'none'` (a CSP with only this directive restricts nothing else), `X-Content-Type-Options:
nosniff`, and `Referrer-Policy: strict-origin-when-cross-origin` (today's browser default,
so no outbound request changes; `no-referrer` or `same-origin` would strip the Referer
tile hosts and the Macaulay embed see, so not those). Nothing in the repo frames the app:
`website/tools` drive it top-level with `page.goto`, and the only `<iframe>` in `src` is
`MediaEmbed` framing macaulaylibrary.org, which these headers do not affect.
**A full CSP is out of scope**: it would need a hash or `'unsafe-inline'` for the
`index.html` anti-flash script, `style-src 'unsafe-inline'` for React inline styles,
`worker-src 'self'` for MapLibre's worker and three module workers, the tile/style/font
hosts (tiles.openfreemap.org, server.arcgisonline.com, tile.waymarkedtrails.org),
favicons from ebird.org and birdsoftheworld.org, `frame-src` macaulaylibrary.org, and a
report-only rollout.

**3.** At 320 to about 400px and every text scale, no Targets row widens the table:
the common name wraps (the favicon pair drops intact below it if needed) and the
scientific name **wraps rather than ellipsizes** (an ellipsis at 200% is lost content,
the reason the Rainbow Connection repair chose wrapping). Scope the rule to the Targets
name cell, mirroring `.sr-bc-name-col` / `.sr-fl-name` (globals.css:6062-6076); do not
change shared `.sr-birdname-sci`. A candidate measured clean at 320/360/400 x 200% in both
engines, with the 1.0.47 place link present: `.sr-tg-name .sr-birdname { width: 100%;
max-width: 100% }`, `.sr-tg-name .sr-birdname-row { flex-wrap: wrap }`, `.sr-tg-name
.sr-birdname-sci { white-space: normal; overflow-wrap: anywhere }`.

**4a.** The sentence says where it is actually saved, per platform, by the house
`isTauri()` branch (Settings.tsx:2344 does the same for files). Candidates, no em dashes:
Tauri "Your preference will be saved in this app's settings on this device."; web/Pi
"Your preference will be saved on this server, so every browser that opens SnowRaven
here uses it."

**4b.** On web/Pi the section names the server: `here` is "this server" when
`!isTauri()` (matching "Files are stored on this server"), so "Saved for 3 counties on
this server.", "will be removed from this server.", etc. Mac/iPhone/iPad and Windows unchanged.

## Blast radius

**1.** Backend only: a middleware or dependency in `backend/main.py` plus a content-type
check in `settingskv.py`. The frontend changes only if the custom-header route is chosen.
Every backend test must still pass without headers; add rows for the shapes above (foreign
Origin, `Origin: null`, same-origin, dev origin through a rewritten Host, no Origin,
`Sec-Fetch-Site` values). Update the ROADMAP line 47 finding (1) and the comment at
`barcharts.py:237`. `security.md` is path-gated on `backend/main.py` and `backend/routers/**`,
so it loads.

**2.** Same middleware location. `nosniff` blocks any script or stylesheet served with a
wrong MIME: confirm every `frontend/dist` `.js` and `.css` is served as JS/CSS on Linux
(Starlette uses `mimetypes`; module scripts already require it). Dev pages from Vite get
no headers (dev only, fine).

**3.** CSS only, Targets name cell. `testing.md`: verify against the REAL built app,
element against its container, swept across a band (about 320 to 420px, 100 to 200%) in
Chromium and WebKit; my reproduction is element evidence, not page evidence. Extend
`frontend/src/lib/targetsSortSelectCss.test.ts` (it already parses globals.css and pins
F1 to F4 including the 1.0.47 hang) with a resolved-cascade row for the name cell, and
`Targets.test.tsx` for the markup (BirdName with `showSci` inside `td.sr-tg-name`). Related
precedents: `breedingNameColumnCss.test.tsx`, `scrollLeakCss.test.ts`. Must not disturb the
1.0.47 Last report hang (F4).

**4.** In-app copy and its tests only. `Settings.barcharts.test.tsx` web rows (lines
104-188) flip to the server wording and gain a Windows row (`isTauri` true, platform null,
"this device"). `docs/HELP.md` already says web/Pi bar-chart files are "saved on the server"
(line 581) and makes no theme-storage claim, so no Help change is required. No published
surface repeats either claim.

## What done looks like

1. A cross-site multipart or `text/plain` POST to any `/settings/...` write route is
   refused and writes nothing; the app's own uploads, setting saves and deletes still work
   under `./start.sh`, under `npm run dev`, and with no Origin (backend suite green).
2. Every backend response, `/` included, carries the four headers; the built app still
   loads, maps render, workers start and the Macaulay embed plays.
3. Targets at 320 to 400px and 200% (both engines, built app): no sideways scroll, full
   common and scientific names visible, the 1.0.47 place link unchanged.
4. Appearance and Bar-chart files sentences true on Tauri and on web/Pi, pinned by tests
   for both branches.
