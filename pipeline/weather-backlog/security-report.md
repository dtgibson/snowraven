# Security Review — Weather Backlog

**Date:** 2026-07-06
**Feature:** weather-backlog (v0.5.67)
**Stack:** python-fastapi (backend) + react-vite-tailwind (frontend) — **frontend-only change**
**Checklist:** `reference/checklists/security-fastapi.md` (backend, reads as "no backend change") + SnowRaven's standing frontend security checks (CLAUDE.md → Security)
**Outcome:** PASSED

---

## Summary

The Weather Backlog is a frontend-only assembly of already-shipped, already-audited
parts: a pure filter/sort/paginate core (`lib/weatherBacklog.ts`), a presentational
component (`components/WeatherBacklog.tsx`), and a thin state-free lookup wrapper in
`App.tsx`. Every eBird id that becomes a URL is `SUBMISSION_ID_RE`-validated **and**
`encodeURIComponent`-wrapped; the one `window.open` is opened with
`'noopener,noreferrer'` and is reachable only after id validation and a successful
clipboard copy; all clipboard writes go through the `copyText()` seam; all outbound
navigation goes through the shared `ChecklistLink`/`OutboundLink` (id- and rel-guarded)
components; and all user-CSV-derived text (location names, place) renders as escaped
React children with **no** `dangerouslySetInnerHTML`. No new provider, endpoint,
secret, or telemetry is introduced, and `PRIVACY_POLICY.md` correctly needs no change.
Confirmed no Python/backend file was touched. **No findings at any severity.**

---

## Scope confirmation

`git diff --stat` / `git status` confirm the change is frontend-only: modified
`frontend/src/App.tsx` plus the two new frontend files, version files
(`frontend/package.json`, `src-tauri/tauri.conf.json`), `CHANGELOG.md`, docs
(`README.md`, `docs/HELP.md`), `website/index.html`, and `pipeline/`. **No backend
route, model, or Python file changed** — the FastAPI checklist therefore reads as
"no backend change / no new attack surface," and the review focuses on the new
frontend code.

Files reviewed:
- `frontend/src/lib/weatherBacklog.ts` (pure logic — no I/O, no DOM, no URLs but one)
- `frontend/src/components/WeatherBacklog.tsx` (UI + per-row action state machine)
- `frontend/src/App.tsx` diff (`<WeatherBacklog>` wiring + `lookupBacklogWeather`)

---

## Findings

No security issues found in this feature.

---

## Checks Performed

| Check | Result |
|---|---|
| **URL/id validation — action #2 (`OutboundLink` href)** — edit URL only rendered as a link when `validId` (`SUBMISSION_ID_RE.test`) is true; invalid id degrades to a plain, non-navigating `<span>` (`WeatherBacklog.tsx:229–246`) | Pass |
| **URL/id validation — action #3 (`window.open`)** — `runAction3` returns early to `error-bad-id` when `!validId`, so `window.open(EDIT_URL(...))` at line 139 is unreachable for a bad id | Pass |
| **`encodeURIComponent` on interpolated id** — `EDIT_URL(id) = https://ebird.org/edit/effort?subID=${encodeURIComponent(id)}` (`WeatherBacklog.tsx:73`); the App weather lookup uses `/weather/${encodeURIComponent(id)}` (`App.tsx`) | Pass |
| **Exact edit URL shape** — `https://ebird.org/edit/effort?subID=<encoded id>`, matching FR-17 and the existing Weather-tab destination | Pass |
| **`window.open` hardening** — opened with `'_blank', 'noopener,noreferrer'` so the eBird tab cannot reach `window.opener` (`WeatherBacklog.tsx:139`) | Pass |
| **`window.open` opens exactly once, only on success** — the open sits on the `copying → success` transition edge after `copyText()` returns true; the in-flight guard (`if (state.kind === 'looking-up' \|\| 'copying') return`) blocks double-fire (FR-19/FR-27) | Pass |
| **Clipboard via seam only** — `onCopy` is the `copyText` seam (`App.tsx:1069`); no direct `navigator.clipboard` in either new file (grep-confirmed empty) | Pass |
| **No `dangerouslySetInnerHTML`** — grep-confirmed absent in both new files; location name, `place`, `dateLabel`, and meta all render as escaped React children | Pass |
| **User-CSV text escaping (XSS)** — `c.location`, `c.county`, `stateAbbr`, species count all interpolated as JSX text nodes (auto-escaped); no HTML-string sink | Pass |
| **Location-link gating (FR-15)** — `HotspotLink` used only when an `isHotspot` resolver is passed; current App wiring omits it, so locations render as plain escaped text (`isHotspot` gate + `LOCATION_ID_RE` inside `HotspotLink` also hold) | Pass |
| **Action #1 via shared `ChecklistLink`** — id-shape-guarded, `target=_blank rel=noreferrer`, new-tab cue baked in (`ChecklistLink.tsx`) | Pass |
| **Action #2 via shared `OutboundLink`** — always `target=_blank rel=noreferrer` + "(opens in a new tab)" cue (`OutboundLink.tsx`) | Pass |
| **No hand-rolled `<a target="_blank">` without `rel`** — grep-confirmed no `target=` in the new files; all outbound nav goes through shared components | Pass |
| **No hardcoded secrets/keys** — grep for apikey/secret/token/password/bearer in new files returned nothing; keys stay in the storage seam | Pass |
| **Transport seam reuse** — `lookupBacklogWeather` calls `transport.getReplayable('/weather/<id>')` (shared seam); no raw `fetch`/`XMLHttpRequest` in new code | Pass |
| **No direct `/settings/*` or platform API calls** — navigation to Settings/Import is via `setActiveTab` props; no seam bypass | Pass |
| **Error handling (no info leak / no dead-page nav)** — failures classified via shipped `classifyLiveError` into offline/no-key/other; comment page is NOT opened on any error edge; no raw error object rendered to the DOM | Pass |
| **Privacy (NFR-11)** — no analytics/telemetry/account/new provider; reuses only the already-disclosed `/weather` path; `PRIVACY_POLICY.md` unchanged (grep/status confirm) | Pass |
| **Render purity (no impure sink abuse)** — no `Date.now()`/`new Date()` in render bodies or memos; ordering uses string compares only (the sole match is a code comment) | Pass |
| **No new DOM sinks** — grep for `innerHTML`/`document.write`/`eval`/`localStorage`/`sessionStorage` in new files returned nothing | Pass |
| **Backend surface** — no Python/route/model/pydantic change; no new twinned regex guard to audit (`[0-9]` vs `\d` rule N/A this feature) | Pass |
| **No trust-boundary change** — the one networked action reuses the existing per-checklist `/weather` call the Weather tab already makes; no new inbound data path or elevation | Pass |

---

## Convention Flags

Nothing new to establish. The feature correctly reuses the existing standing checks
already documented in CLAUDE.md (`SUBMISSION_ID_RE` + `encodeURIComponent` id guard,
`copyText()` clipboard seam, shared `ChecklistLink`/`OutboundLink`/`HotspotLink`,
escaped-JSX rendering, `noopener,noreferrer` on `window.open`). No amendment required.
