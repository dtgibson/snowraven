# Security Report — calendar-tuneup

| | |
|---|---|
| **Date** | 2026-07-04 |
| **Feature** | calendar-tuneup |
| **Stack** | python-fastapi (frontend-only change — backend untouched) |
| **Checklist** | react-vite client-side |
| **Outcome** | **PASSED** |

## Summary

Improve-lane batch (v0.5.61): (1) a shared searchable `SpeciesCombobox` extracted from Species Detail's inline picker, now consumed by both Species Detail and the Calendar species filter; (2) phone-width forcing of the Large calendar view via a `useSyncExternalStore`/`matchMedia` hook (`useIsPhone`) plus CSS; (3) day-of-month labels in Large calendar day cells; ride-along `.sr-input-16 !important` CSS fix. Two review lenses (injection/DOM and privacy/data-exposure/supply-chain) were run and consolidated; every claim was re-verified against the real working-tree diff (12 modified + 3 new files; backend and `package-lock.json` untouched).

The batch's central question — does the combobox extraction lose any escaping or introduce injection — is answered no. `SpeciesCombobox.tsx` renders species and scientific names exclusively as escaped JSX children; its filter is plain-string `toLowerCase().includes()` (no `RegExp` anywhere in the file, so no ReDoS/regex-injection surface); its DOM ids are built solely from React `useId()` + a numeric index (an improvement over the old hardcoded `species-option-{idx}` ids, which could collide across instances); and selection cannot synthesize a name outside the parent-supplied `options` list. The deleted inline SpeciesDetail block was already escaped-JSX-only, and the replacement wires the identical `selectSpecies` path. Nothing in the batch adds a network call, a dependency, a persistence write, a logging statement, or a new sink; two changes are mild hardenings (the tier clamp `Math.min(tierFor(count), 5)` preventing an out-of-palette CSS-var interpolation, and the `!important` that makes the previously-inert app-wide iOS no-zoom guard actually bind).

**No findings at any severity. Nothing in this batch adds attack surface or weakens an existing control.**

## Findings

No security issues found.

## Checks Performed

| # | Check | Scope | Result |
|---|---|---|---|
| 1 | XSS / injection in `SpeciesCombobox` — names render only as escaped JSX (`{row.name}`, `{row.sciName}`, controlled input `value`); no `dangerouslySetInnerHTML`, no HTML string construction | `frontend/src/components/SpeciesCombobox.tsx` | PASS |
| 2 | Filter is plain-string, not regex — `trim().toLowerCase().includes()`; zero `new RegExp`/`RegExp(` in file (no ReDoS / regex injection from typed queries) | `SpeciesCombobox.tsx:54-60` | PASS |
| 3 | DOM-id / selector sinks — `getElementById` + `aria-activedescendant` ids built from `useId()` + numeric index only; no user/export-derived string reaches an id, selector, or attribute sink | `SpeciesCombobox.tsx:48-50,84,162` | PASS |
| 4 | Refactor parity — deleted SpeciesDetail inline picker was escaped-JSX-only; replacement uses the same validated `selectSpecies` path; options still sourced from `displaySpeciesList`/`sciNameMap`; combobox cannot select a name outside `options` (zero-match Enter is a no-op); dead state/effects/imports fully removed | `frontend/src/components/SpeciesDetail.tsx` | PASS |
| 5 | Calendar consumer — `onChange` maps `null → ''`, identical semantics to the removed `<select>`; stale-selection guard (`speciesFilterActive`) untouched in parent | `frontend/src/components/Calendar.tsx:861-873` | PASS |
| 6 | Day-of-month labels — `desc.day` is the integer loop counter from `buildMonthCells`, rendered as JSX text in `DayCorner` (`aria-hidden`, `pointer-events:none`); no sink | `Calendar.tsx:225-244,272-283` | PASS |
| 7 | Tier clamp `Math.min(tierFor(count), 5)` — defensive hardening against an out-of-palette `var(--sr-cal-6)` interpolation; call-site-only, county overlay's `breaks.length` contract untouched | `Calendar.tsx:282` | PASS |
| 8 | `useIsPhone` — `matchMedia` query is a static module constant `'(max-width:640px)'`; no dynamic string, no user input; SSR / no-`matchMedia` safe fallbacks; reads viewport width only, stores nothing | `frontend/src/lib/useIsPhone.ts` | PASS |
| 9 | Sink grep over full diff (tracked + new files) — `dangerouslySetInnerHTML`, `eval(`, `new Function`, `innerHTML`, `document.write`, `javascript:`, `new RegExp`, `href=`, `window.open`, dynamic `url(`: zero hits in added lines | all changed frontend files | PASS |
| 10 | Zero new network — no `fetch`/`XHR`/`WebSocket`/`sendBeacon`/`transport.` in any new or added code; combobox imports only `react` + already-bundled `lucide-react`; no new tile provider or third-party service (PRIVACY_POLICY.md correctly unchanged) | new files + diff | PASS |
| 11 | Supply chain — `package.json` and `tauri.conf.json` diffs are version-only (0.5.60 → 0.5.61); `package-lock.json` untouched; `useSyncExternalStore` is React core; no new npm/Rust dependency, no CI/workflow change; backend confirmed untouched | `frontend/package.json`, `src-tauri/tauri.conf.json`, `git status` | PASS |
| 12 | State & persistence — combobox owns only ephemeral `query`/`open`/`activeIdx` `useState`; Calendar filter state stays session-only; no `localStorage`/`sessionStorage`/storage-seam/IndexedDB writes anywhere in the diff; no typed query persisted | diff-wide | PASS |
| 13 | Secrets / logging — no `console.*` in new or changed files; no keys/tokens/credentials in diff (docs/website/tests grep-clean); test fixtures use synthetic names only | diff-wide | PASS |
| 14 | CSS changes display-only — `.sr-input-16 { font-size: 16px !important }` activates (strengthens) the previously-inert iOS no-zoom guard against inline sub-16px styles; `.sr-cal-daynum`, `.sr-cal-view-toggle{display:none}`, `.sr-cal-months` gap are presentation-only; no selector broadening, no new trust boundary | `frontend/src/globals.css` | PASS |
| 15 | Preserved standing controls — `ChecklistLink`/`SUBMISSION_ID_RE`, `CommentText`, media-link/`resolveMediaLinkTaxonCode` paths, and all map popup code are not in the diff; incidental `--sr-border` → `--sr-border-input` is an a11y improvement | CLAUDE.md "Security — standing checks" | PASS |
