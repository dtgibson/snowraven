# Security Review — tab-improvements

- **Date:** 2026-07-04
- **Feature:** tab-improvements
- **Stack:** python-fastapi (frontend-only change)
- **Checklist:** react-vite client-side
- **Outcome:** PASSED

---

## Summary

The tab-improvements batch (v0.5.59, Improve lane) ships three small, display-only UI enhancements to existing tabs, built entirely on existing patterns:

1. **Named Birds sighting-duration string** — a new pure helper `formatSightingDuration` in `formatDate.ts`, rendered as escaped JSX under each row's date range.
2. **Calendar per-species filter** — a native `<select>` narrowing the calendar to one normalized common name, threaded into `buildDayCells` as a pure pre-derivation filter.
3. **Map Explorer locator dots + Labels/Dots toggle** — an always-visible decorative dot on the Nearby Lifers / Media Targets DOM markers, plus two session-only `SegControl`s.

The backend is unchanged (confirmed — no backend files in the working-tree diff). This audit consolidated two independent lenses — (A) injection / DOM safety / preserved-control integrity, and (B) privacy / data-exposure / secrets / supply-chain — and verified every claimed conclusion against the real changed code. Nothing was accepted on the lens's word alone.

**Every claim held.** The improve-lane changes introduce **no new attack surface** and **weaken no existing control**. The escaping, id/URL guards, filter-control aria conventions, and the DOM-marker-as-`<button>` contract are all intact. No finding rises above Informational, and the two Informational items are non-security observations recorded only for completeness.

Because there is no real Critical or High (indeed no security finding at any severity), the outcome is **PASSED**.

## Findings

No security issues found.

Two non-security observations are recorded below for completeness (neither is an attack surface or a weakened control; neither requires action for security sign-off):

- **INFO — `markerMode` passed as a prop, not folded into the marker `key` (deviation from the change-brief step).** `MapExplorer.tsx:2215/2218` keeps the existing `key` (`` `${targetPins.length}-${targetViewMode}` `` / `` `${displayedLiferLocations.length}-${liferWindow}` ``) and passes `markerMode` as a plain prop; the brief suggested folding the mode into the `key` for a clean remount. React reconciles the `display`/style change in place, which works correctly here. This is a render-lifecycle/correctness note with **no security impact** — no trust boundary is crossed either way. Flagged so the implementer is aware the brief's `key`-fold step was not taken.

- **INFO — `PRIVACY_POLICY.md` correctly left unchanged.** The batch adds zero network calls, providers, telemetry, analytics, or persisted data (verified below), so no privacy-policy update is due. Recorded to confirm the omission is correct, not an oversight.

## Verification detail

Confirmed against the real code (not the lens summaries):

- **`TargetMarkers.tsx` `dangerouslySetInnerHTML` (line 97) is the sole such sink in the diff and is the pre-existing sink RELOCATED, not new.** Its input `labelHtml` (lines 64–79) is unchanged: `` `${escHtml(pin.comName)}${iconsHtml}` `` for singles (only the user-export value `pin.comName` passes through, and it goes through the untouched `escHtml`), and the literal `` `${group.length} species` `` numeric template for clusters. `iconsHtml` interpolates `MEDIA_ICONS[t]` where `t` is the typed union `'Photo' | 'Audio' | 'Video'` against a static SVG record — no user string reaches the icon markup. The diff only wraps this span in `style={{ display: dots ? 'none' : 'inline-block' }}`. Escaping is not weakened; a hidden span still escapes. Matches the CLAUDE.md standing check ("run user/external text through `escHtml` first… preserve that").
- **`NearbyLiferMarkers.tsx` label (line 81) renders as escaped JSX children `{label}`**, where `label` is `loc.lifers[0].comName` or the literal `` `${loc.count} species` `` — no `dangerouslySetInnerHTML`, no interpolation into markup/URLs.
- **The locator dots** (`NearbyLiferMarkers.tsx:79`, `TargetMarkers.tsx:94`) use only literal numeric/string inline styles plus `background: bg`, where `bg` comes from `tierColors(recencyTier(...))` / `tierColors(loc.tier)` — CSS-token strings, no user-controlled CSS. `aria-hidden="true"` on the decorative dot is correct.
- **Markers remain real `<button>`s in both modes** (lines 77/92); `aria-label`, keyboard activation, and popup behavior are unchanged — only the label chip's `display` is toggled. The DOM-marker-as-`<button>` contract holds.
- **`formatSightingDuration` (`formatDate.ts:200`)** is pure integer arithmetic over `parseParts` (lexical, no regex on the value → no ReDoS), no `eval`/`new Function`, returns `''` on null (never throws), and reads no `Date.now()` in render (the only `Date.now()` token in the diff is inside the helper's doc-comment explaining it is pure). Output is fixed-format literal strings, rendered as escaped JSX at `NamedBirdRow.tsx`.
- **Calendar species filter (`Calendar.tsx:778–794`)** — options render as escaped `<option>` text and `value`; the `<select>` carries an explicit `aria-label` ("Filter the calendar to one species") and `.sr-input-16` (iOS-zoom lens). The selected value flows into `buildDayCells(observations, view, speciesFilter)` and is used only in a `===` string comparison (`calendar.ts:134`) — a pure pre-derivation filter, no sink. A `speciesFilterActive` option-membership guard prevents a stale value from taking effect.
- **State is session-only** — `selectedSpecies` (`Calendar.tsx:561`), `liferMarkerMode` / `targetMarkerMode` (`MapExplorer.tsx:260/261`) are all plain `useState`. No `storage`/`localStorage`/`sessionStorage`/`indexedDB`/`document.cookie` write in the diff. Nothing persisted; state dies on relaunch, as the brief specifies.
- **No new network, dependency, secret, or console leak.** Grep of the added lines finds no `fetch`/`XMLHttpRequest`/`transport.`/`sendBeacon`/`new Image`/`.src=`/`http(s)://`/`telemetry`/`analytics`, no new `eval`/`new Function`/`innerHTML`/`insertAdjacentHTML`/`document.write`/`setAttribute`, and no `apiKey`/`secret`/`token`/`password`/`console.*`/`process.env`. The only new imports are local relative paths. `frontend/package.json` diff is a single line (`0.5.58` → `0.5.59`); no lockfile / `Cargo` touched.

## Checks Performed

| Check | Result | Notes |
|---|---|---|
| XSS / injection via new `dangerouslySetInnerHTML` | PASS | Sole sink (`TargetMarkers.tsx:97`) is relocated, not new; `labelHtml` still `escHtml`-escaped; only `display` gated |
| Escaped-JSX rendering of user data | PASS | NearbyLifer label `{label}` and Calendar `<option>` text are escaped React children; no new HTML sinks |
| id / URL guards preserved | PASS | `SUBMISSION_ID_RE` (`/^S\d+$/`) checklist gate in both popups unchanged; no new href/src built |
| Pure helper / ReDoS / render-purity | PASS | `formatSightingDuration` is integer math, no regex on input, `''` on null, no render-time `Date.now()` |
| Filter is pure comparison, no dynamic query | PASS | Calendar species filter is `normalizeSpeciesName(...) === speciesFilter` string equality only |
| Filter-control aria + iOS-zoom conventions | PASS | `<select>` has explicit `aria-label` + `.sr-input-16`; `SegControl`s carry `ariaLabel` — controls not weakened |
| DOM-marker-as-`<button>` contract | PASS | Markers stay real `<button>`s in both modes; aria-label / keyboard / popup unchanged |
| No user-controlled CSS | PASS | Dot `background` from `tierColors` tokens; all other inline style values are literals |
| New network / providers / telemetry | PASS | Zero outbound calls added; `PRIVACY_POLICY.md` correctly unchanged |
| New dependency / supply-chain | PASS | Only version bump in `package.json`; no lockfile or `Cargo` change |
| Session-only state / no persistence | PASS | All three new state hooks are plain `useState`; no storage seam, `localStorage`, cookie, or IndexedDB write |
| Secrets / console leakage | PASS | No secrets, no `console.*`, no user export data (coords, names, ids) logged |
| Backend attack surface | PASS | Backend unchanged — no backend files in the diff |
