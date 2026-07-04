# Security Report — Calendar Tab

- **Date:** 2026-07-03
- **Feature:** calendar-tab
- **Stack:** python-fastapi (frontend-only change — no backend diff)
- **Checklist:** react-vite (client-side)
- **Outcome:** **PASSED**

---

## Summary

The Calendar tab is a frontend-only feature that renders the birder's own already-loaded
eBird export as a month-grid calendar, with a day popup listing that day's checklists as
links. The review consolidated two independent scan lenses (injection/DOM and
privacy/supply-chain), then verified every claimed check against the actual source.

**No security issues were found.** All findings from both lenses were "PASS"; verification
against the real code confirmed each one. The implementation follows the app's standing
security posture precisely:

- **No new attack surface.** The backend is confirmed untouched (`git diff --stat -- backend/`
  is empty). The tab adds no network call, provider, backend route, bundled dataset,
  telemetry, or persisted setting. All data derives from the already-loaded
  `loadEbirdObservations()` array; `PRIVACY_POLICY.md` correctly requires no change.
- **Injection-safe by construction.** No `dangerouslySetInnerHTML` / `innerHTML`, no
  hand-rolled anchors, no `eval` / `new Function`. Every user/export value renders as
  auto-escaped JSX children; the only external links go through the shared `ChecklistLink`,
  which shape-guards the submission id (`SUBMISSION_ID_RE` = `/^S\d+$/`) before it becomes an
  `href` and renders a junk id as plain text.
- **Correct regex discipline.** The one new regex (`DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/`,
  `calendar.ts:68`) is anchored, fixed-length, non-global, and used only via `.test()` — no
  ReDoS hazard and no shared-`lastIndex` / `matchAll`-clone pitfall. It correctly uses the
  explicit `[0-9]` ASCII class (not `\d`), so a Unicode-digit date is rejected.
- **No unsafe data flow.** Day buckets are keyed in a `Map` (not an object literal), so a
  malicious `commonName` / `submissionId` cannot reach `__proto__` / `constructor` — no
  prototype-pollution vector. Inline styles are built only from `var(--sr-cal-N[-rgb])`
  tokens and numeric hatch specs, never from user strings — no CSS-injection vector.
- **Clean supply chain.** `frontend/package.json` changed only the version bump
  (0.5.57 → 0.5.58, matched in `src-tauri/tauri.conf.json`); no new dependency, no lockfile
  change. `CalendarDays` is imported from the already-present `lucide-react`.

The two lenses agreed independently, and spot-verification of the load-bearing claims (the
date-guard regex, the `dangerouslySetInnerHTML` absence, the `ChecklistLink` link path, the
`package.json` diff, and the absence of any map/maplibre static import) confirmed them
against the real code.

---

## Findings

**No security issues found.**

---

## Checks Performed

| # | Check | Area | Result |
|---|---|---|---|
| 1 | Backend confirmed unchanged (`git diff --stat -- backend/` empty) — frontend-only | Scope | PASS |
| 2 | No `dangerouslySetInnerHTML` / `innerHTML`; all export/user values render as escaped JSX | XSS / DOM injection | PASS |
| 3 | Checklist links only via shared `ChecklistLink`; id shape-guarded (`SUBMISSION_ID_RE`) before `href`; junk id → plain text | Link / URL injection | PASS |
| 4 | No hand-rolled `<a>` / `target=_blank`; no raw anchor bypassing `ChecklistLink`/`OutboundLink` | Link handling | PASS |
| 5 | `DATE_RE` anchored, fixed-length, non-global, `.test()`-only — no ReDoS, no `lastIndex`/`matchAll` hazard | ReDoS / regex hygiene | PASS |
| 6 | Date guard uses explicit `[0-9]` ASCII class (not `\d`); Unicode-digit dates rejected | Input validation | PASS |
| 7 | Day buckets keyed in a `Map`, not an object literal — no `__proto__`/`constructor` reachability | Prototype pollution | PASS |
| 8 | No `eval` / `new Function` / dynamic code execution | Code injection | PASS |
| 9 | Inline styles built only from `--sr-cal-*` tokens + numeric hatch specs, never user strings | CSS injection | PASS |
| 10 | No new network: no `fetch`/`XHR`/`axios`/`transport.*`/`sendBeacon`/`WebSocket` in new files | Data exfiltration / privacy | PASS |
| 11 | `PRIVACY_POLICY.md` correctly unchanged — no new data category leaves the device | Privacy disclosure | PASS |
| 12 | No secrets/tokens/API keys in new files; no `console.*` logging of export data | Secrets / sensitive logging | PASS |
| 13 | View/metric/textures/density/includeForms are session-only `useState`; no `localStorage`/`setSetting` write | State persistence / bleed | PASS |
| 14 | `frontend/package.json` diff is version-bump-only (0.5.57→0.5.58); no new dependency, no lockfile change; `tauri.conf.json` bumped in lockstep | Supply chain | PASS |
| 15 | No map/maplibre static import in any calendar file (`SnowMap`/`SightingsMap`/`react-map-gl`/`CountyLayer`) — DayPopup is a plain DOM dialog | Entry-chunk / map-popup rule | PASS |
