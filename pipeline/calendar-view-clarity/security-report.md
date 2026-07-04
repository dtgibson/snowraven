# Security Review — calendar-view-clarity

**Date:** 2026-07-04
**Feature:** calendar-view-clarity (v0.5.62)
**Stack:** react-vite-tailwind frontend of a python-fastapi app (this change is frontend-only)
**Checklist:** reference/checklists/security-react-vite.md (Improve-lane focus: new attack surface / trust-boundary delta)
**Outcome:** PASSED

---

## Summary

This is a frontend-only Calendar-tab refinement (weekday-column alignment to the current
year, shading-only YearOverview mini-cells, and a view-toggle label/state swap) plus docs
and version sync. It introduces no new attack surface and changes no trust boundary: no new
network calls, data sources, or tile/service providers; no new `dangerouslySetInnerHTML` or
unescaped interpolation; no external links or eBird-id-to-href construction; no secrets. The
one code-removing change (dropping the mini-cell number span and its `title`) strictly
reduces surface — it removed a React-auto-escaped `title` attribute built from
internally-derived data, not any escaping or validated href. PRIVACY_POLICY.md and
ACCESSIBILITY.md correctly required no change.

---

## Findings

No security issues found in this feature.

---

## Scope confirmation

- **No backend files touched.** `git status` shows the diff is limited to
  `frontend/src/components/Calendar.tsx`, `frontend/src/lib/calendar.ts`,
  `frontend/src/globals.css`, the two matching test files, docs (README.md, docs/HELP.md,
  website/index.html, CHANGELOG.md), and the two version manifests (frontend/package.json,
  src-tauri/tauri.conf.json). No `backend/` path is in the diff, so the FastAPI attack
  surface (routes, pydantic guards, outbound HTTP) is untouched.
- **Trust boundaries unchanged.** The Calendar reads only the already-loaded backup via the
  existing derivation in `lib/calendar.ts`; no new inputs cross any boundary.

---

## Checks Performed

| Check | Result |
|---|---|
| No new/changed `dangerouslySetInnerHTML` in changed source | Pass — `grep` finds none in Calendar.tsx; the map/popup JSX-escaping guard holds |
| User/API text rendered only through shared escaped components (CommentText/BirdName/escaped popups) | Pass — no new text interpolation; the removed `title` used `cellDateLabel(bucketKey)` + numeric `desc.count`, both internally derived (bucketKey sliced into `Number()`/array indices), and rode a React-escaped native `title` attribute |
| Removed elements did not remove escaping or a validated href | Pass — deletion of the mini-cell number span + `title` is a pure surface reduction; no escaping, sanitizer, or href was in the removed code |
| External links go through OutboundLink/ChecklistLink/HotspotLink | Pass — no new external links added; the only link (ChecklistLink in the day popup, Calendar.tsx ~589–601) is pre-existing and untouched by the diff |
| eBird ids shape-guarded before becoming an href (SUBMISSION_ID_RE / LOCATION_ID_RE) | Pass — no new id-to-href construction; the untouched ChecklistLink retains its internal SUBMISSION_ID_RE guard |
| `encodeURIComponent` on any id riding in a query string | Pass — no new query-string id interpolation introduced |
| No secrets/keys/tokens introduced in source | Pass — no key, token, or credential literal in the diff |
| No new network calls / fetch / URL / provider (offline promise intact) | Pass — `grep` for `fetch(`, `http(s)://`, `new URL`, `transport.get/post`, `navigator.*` finds none in changed source; Calendar stays offline, zero new network |
| PRIVACY_POLICY.md accurately needs no change | Pass — no new browser→provider request or data source; policy unaffected, file correctly unmodified |
| ACCESSIBILITY.md accurately needs no change | Pass — change removes a decorative number/`title` and hides the toggle on phones as before; the mini-month stays one `<button>` with an aria-label; no a11y contract regressed that would falsify the statement |
| Render purity — no impure `Date.now()`/`new Date()` in render/useMemo | Pass — new `SESSION_NOW_MS = Date.now()` and `CURRENT_YEAR` are module-level constants evaluated once at import; render/useMemo read the constants only (react-hooks/purity contract honored) |
| DoS-adjacent — no unbounded iteration from the new date logic | Pass — combined-view February is pinned to a constant 29; month loops stay bounded 1..12 and 1..daysInMonth; no user-controlled loop bound |
| No dangling dead code from the removal (weakening-by-omission check) | Pass — `.sr-cal-mininum` class + its container-query CSS fully removed from both TSX and globals.css with no remaining references; the still-present `.sr-cal-daynum` rule belongs to the untouched big MonthGrid view, not the removed mini-cell |
| Version manifests in lockstep (bundle/updater integrity) | Pass — frontend/package.json and src-tauri/tauri.conf.json both at 0.5.62; website pill matches |

---

## Convention Flags

None. The existing standing checks (JSX-escaped map popups, id shape-guards, offline
Calendar, module-level `SESSION_NOW_MS` for now-reads) already cover this change; no new
standing rule emerged.
