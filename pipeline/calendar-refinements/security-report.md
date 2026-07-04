# Security Report — calendar-refinements

- **Date:** 2026-07-04
- **Feature:** calendar-refinements
- **Stack:** python-fastapi (frontend-only change)
- **Checklist:** react-vite client-side
- **Outcome:** PASSED

## Summary

The calendar-refinements batch (v0.5.60, Improve lane) makes three presentational/derivational refinements to the already-shipped Calendar tab: (1) a third **Total count** metric summing individual birds per day, (2) a **Months|Year → Large|Compact** view-density relabel, and (3) day-count numbers rendered in the Compact mini-cells. Reviewed the real diff against `HEAD~1` across all changed source: `frontend/src/lib/calendar.ts`, `frontend/src/components/Calendar.tsx`, `frontend/src/globals.css` (plus tests, version bumps, docs, and `website/index.html`). Backend is unchanged (confirmed absent from the diff).

The batch adds **no attack surface and weakens no control.** Every new rendered value is a number reaching the DOM through escaped JSX (`{totalNum.toLocaleString()}`, `{desc.count}`, the mini-cell `title` attributes) or a static label/CSS literal. The `Total count` metric derives locally from the already-parsed numeric `ObservationEntry.count` via `individualsOf(count) = count ?? 0` (pure arithmetic, no string flow into markup). No new network call, provider, dependency, persisted setting, secret, or log statement is introduced. The `ViewDensity` rename is session-only `useState` with no storage/migration surface. The new `globals.css` rules are static container queries with no user input. `ChecklistLink` and its `SUBMISSION_ID_RE` guard are outside every diff hunk — unchanged. `PRIVACY_POLICY.md` correctly needs no change (zero new data egress). Two independent review lenses (injection/DOM; privacy/supply-chain) each returned all-PASS; both were verified against the actual code before consolidation.

## Findings

No security issues found.

## Checks Performed

| Check | Result | Notes |
|---|---|---|
| New DOM injection sinks (`dangerouslySetInnerHTML`, `innerHTML`, `insertAdjacentHTML`, `document.write`) | PASS | Grep of the `+` diff lines returned none; all new values are escaped-JSX text children or `title` attributes on numeric/date data. |
| `eval` / `new Function` / dynamic code | PASS | None added. |
| Total-count metric data flow | PASS | `individualsOf(count) = count ?? 0` is pure arithmetic on the already-parsed numeric `ObservationEntry.count: number \| null`; no string reaches markup. Feeds numeric accumulators → `{totalNum.toLocaleString()}` (escaped). |
| Compact mini-cell number rendering | PASS | `{desc.count}` (a number) rendered as escaped JSX; `pointerEvents:none` keeps the single button the sole hit target; `title` is an attribute, not a markup sink. |
| Large/Compact enum rename | PASS | Session-only `useState<ViewDensity>`; no storage seam, no persistence/migration surface; only static label/title strings change. |
| New / unsafe URL construction | PASS | None. Sole URL path (`ChecklistLink`) is untouched (outside all diff hunks); its `SUBMISSION_ID_RE` guard still gates junk ids to plain text. |
| New network / telemetry / analytics | PASS | Grep of changed source for `fetch`/`XHR`/`transport.`/`navigator.`/`http`/websocket found only the two pre-existing local imports; nothing leaves the device. |
| New dependency / supply-chain | PASS | `package.json` diff is one line (`0.5.59` → `0.5.60`); no runtime deps or new imports added. |
| Secrets / keys / credential logging | PASS | No keys, tokens, or `console.*` in the diff. |
| State persistence / storage seam | PASS | New/renamed state (`metric`, `density`) is plain session `useState`; no `setSetting`/`localStorage` writes; no stored value to migrate. |
| Dynamic CSS construction | PASS | New `globals.css` rules are static container queries; the only dynamic CSS value (`rgba(var(--sr-cal-${tier}-rgb), 0.9)`) interpolates a numeric internal `CalTier`, not user input. |
| Privacy-policy impact | PASS | No new data egress or provider; `PRIVACY_POLICY.md` unaffected. |
| Backend attack surface | PASS | Backend unchanged (not in diff); no route, validator, or twinned-pattern change. |
| Preserved escaping controls (ChecklistLink, map/comment popups) | PASS | `ChecklistLink` import and use unchanged; escaped-JSX popup rendering intact. |
