# Security Review — Calendar Date Placement

**Date:** 2026-07-05
**Feature:** calendar-date-placement (v0.5.63)
**Stack:** react-vite-tailwind frontend of a python-fastapi app (this change is frontend-only)
**Checklist:** security-react-vite.md (Improve-lane focus: new attack surface / trust-boundary changes only)
**Outcome:** PASSED

---

## Summary

The v0.5.63 change is a frontend-only, fully offline refinement of the Calendar tab: day numbers move off the big month grids and onto the year-overview thumbnails, the overview months become non-interactive, the overview day cells become buttons opening the existing day popup, and each popup checklist row gains a time · location · species-count line. No backend file is touched, no new network call / data source / provider is introduced, and the two new user-facing strings (`location`, `time`) render as auto-escaped JSX children — never `dangerouslySetInnerHTML`, never interpolated into an `href`. Every security-relevant control that existed before (the `ChecklistLink` `SUBMISSION_ID_RE` guard, the popup's escaping paths) is unchanged. No findings.

---

## Findings

No security issues found in this feature.

---

## Trust-boundary & attack-surface analysis

**What crosses into the DOM that did not before.** The popup checklist row now renders two additional values sourced from the user's own eBird backup CSV: the checklist `location` (a free-text human location name) and `time` (an `"HH:MM AM/PM"` string). Both flow from `ObservationEntry` (`frontend/src/types.ts` L62/L72) → captured per-submissionId in `buildDayCells` (`frontend/src/lib/calendar.ts`) → `DayCell.checklists[]` → `PopupChecklistRow` (`frontend/src/components/Calendar.tsx`).

**Render site (the load-bearing check).** In `PopupChecklistRow` the location is folded into `prefix` (`const loc = location.trim()`; `const prefix = prettyTime && loc ? \`${prettyTime} · ${loc}\` : (prettyTime ?? loc)`) and rendered as a JSX text child:

```
<span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{prefix}</span>
```

`{prefix}` is a React child, so React HTML-escapes it. A `location` containing `< > & " '` renders as literal text, and a `javascript:`-looking string is inert text — it is never assigned to `href`, `src`, or any URL-bearing attribute, and there is no `dangerouslySetInnerHTML` anywhere in `Calendar.tsx` (grep: none). The species count renders via `speciesCount.toLocaleString()` — a formatted **number** (`DayCell.checklists[].speciesCount` / `speciesCountWithForms` are `Set.size` values), so it carries no injectable text.

**Link safety.** No new external link/anchor was added. The row's only link is the pre-existing `ChecklistLink` (`frontend/src/components/ChecklistLink.tsx`), which is unchanged in this diff (empty `git diff`) and still gates its `href` on `SUBMISSION_ID_RE` (`/^S\d+$/`) at L59, rendering a junk id as plain text. The `location` is deliberately **plain text — not** `HotspotLink`, `OutboundLink`, or any anchor — precisely to avoid the live hotspot-region fetch `HotspotLink` requires; the code comment at L668–671 documents this as an intentional offline decision. No eBird / location / catalog id is interpolated into any new `href`.

**New network / data / providers.** None. `frontend/src/lib/calendar.ts` imports only `ObservationEntry` (a type) and `speciesUtils` — no transport, no fetch. `Calendar.tsx` gains no `fetch`, `transport.*`, `useHotspotSet`, `axios`, `XMLHttpRequest`, or `WebSocket` (grep confirms the only `fetch`/`HotspotLink` hits are inside the explanatory comment). `time`, `location`, and the species counts all come from the **already-loaded** backup — the Calendar stays fully offline, so `PRIVACY_POLICY.md` remains true and correctly needs no change (confirmed untouched).

**Removed/weakened controls.** Nothing security-relevant was weakened. Making the overview mini-months static (`<button>` → `<div>`) and converting mini-day cells to `<button>`s removed **no** escaping and **no** validated `href` — the old `MiniMonth` button carried only an `expandMonth` view-switch (`setViewMode('months')` + scroll/focus), never a link or user-text render. The new mini-day buttons reuse the same `onOpen` → single `DayPopup` code path as the Compact grid, with accessible names built from `cellDateLabel(bucketKey)` (a date string derived from a `YYYY-MM-DD`/`MM-DD` key, not free text). The day popup, its `ChecklistLink` guard, and the shared comment/escaping paths are untouched.

**Accessibility statement.** `ACCESSIBILITY.md` is untouched and stays true: the newly-interactive overview day cells are real `<button>`s with `aria-label`s ("… — {count}. Open day details" / "… — birded, 0 …. Open day details"), mirroring the Compact grid's cell pattern; making the overview *months* static removes tab stops rather than stranding any control. No published a11y claim is contradicted.

**DoS-adjacent / regex / loops.** No unbounded loop and no new regex over untrusted text. The one new regex, `formatChecklistTime`'s `/^0(\d:)/` (anchored, non-global, matches ≤3 chars), only shaves a leading-zero hour pad on an eBird-formatted time string — no backtracking / ReDoS surface, no shared-`lastIndex`/`matchAll` hazard. The per-checklist species tallies are `Set` insertions inside the existing single derivation pass (no new pass, no per-cell rescan) and collapse to `Set.size` on output.

---

## Checks Performed

| Check | Result |
|---|---|
| XSS — user `location` renders as escaped JSX child, not `dangerouslySetInnerHTML` | Pass |
| XSS — `location` with `< > & " '` cannot break out of the DOM | Pass |
| XSS — `javascript:`-style `location` is inert text, never a URL attribute | Pass |
| Injection — checklist `time` rendered as escaped JSX child | Pass |
| Species count is a rendered number (`Set.size` → `toLocaleString()`), not injectable text | Pass |
| No new `dangerouslySetInnerHTML` introduced (`Calendar.tsx`) | Pass |
| Link safety — no NEW external link/anchor added | Pass |
| Link safety — `ChecklistLink` unchanged; `SUBMISSION_ID_RE` (`/^S\d+$/`) guard intact | Pass |
| Link safety — no eBird/location/catalog id interpolated into a new `href` | Pass |
| Link safety — `location` deliberately plain text (no `HotspotLink`/`OutboundLink`/anchor) | Pass |
| No new network call (`fetch`/`transport`/`useHotspotSet`/`axios`/XHR/WS) | Pass |
| No new third-party provider / data source; Calendar stays offline | Pass |
| `time`/`location`/species sourced from already-loaded backup | Pass |
| `PRIVACY_POLICY.md` needed no change (untouched, still true) | Pass |
| `ACCESSIBILITY.md` needed no change; new day buttons carry accessible names | Pass |
| No security control removed/weakened (popup, ChecklistLink guard, escaping paths intact) | Pass |
| Making overview months static / days buttons removed no escaping or validated href | Pass |
| No unbounded loop introduced (per-checklist tallies in the existing single pass) | Pass |
| No global regex / `matchAll` on untrusted text; `formatChecklistTime` regex bounded (no ReDoS) | Pass |
| Backend untouched (frontend-only change confirmed via `git status` / `git diff`) | Pass |
