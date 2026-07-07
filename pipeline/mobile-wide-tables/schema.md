# schema.md — Mobile Breeding-Codes Matrix (Comfortable Phone View)

**Feature:** mobile-wide-tables
**Stage:** 3 — The Architect
**Path:** **Frontend Only**
**Source:** prd.md (approved), strategic-brief.md, change-brief.md

---

## Path assessment — Frontend Only

The PRD's functional requirements are entirely presentational at the ≤640 phone
tier: narrow existing table columns, lean on a platform magnify gesture, and add
a fallback control. **No new tables, columns, migrations, backend routes, ORM
models, or bundled data.** FR-01…FR-15 are all CSS/layout/interaction on
existing components (`BreedingCodeTable.tsx`, `BreedingCodeList.tsx`,
`LifeListTable.tsx`); the data pipeline (`parseBreedingCodes`,
`aggregateBreedingRows`) is explicitly untouched (Out of Scope). NFR-08 makes it
explicit: no network calls, no third-party providers, no telemetry —
`PRIVACY_POLICY.md` is unaffected.

### Data-layer statement

**No data-layer change of any kind.** No schema, no migration, no backend, no new
persisted setting. The Engineer writes zero migrations for this feature. The one
piece of runtime state introduced (a possible zoom factor, only if the fallback
in FR-11 is needed) is **session-only React `useState`** — it does **not** go
through the `storage` seam and does not persist across relaunch, matching the
`wideMode` toggle and the Point-Size control precedents (session-only,
non-persisted UI state).

---

## SPIKE (gating) — native pinch / webview zoom (QA-11 / OQ-01)

The load-bearing question the brief asked me to resolve **first**: can the app
magnify the matrix in the iOS WKWebView **without** the failed CSS
`zoom` / `transform: scale`? Verdict from the code:

### 1. Native viewport pinch — is it *enabled* as shipped?

**Yes, as far as the code can prove — nothing in the codebase defeats it.**

- **Viewport meta is clean.** `frontend/index.html` (line 6):
  `width=device-width, initial-scale=1.0, viewport-fit=cover` — **no
  `maximum-scale`, no `minimum-scale`, no `user-scalable=no`** (QA-09 satisfied
  as shipped).
- **No global CSS pinch defeat.** `grep` across `frontend/src` found **zero**
  `touch-action` restrictions on the document/body, and no
  `-webkit-text-size-adjust`. The only `touch-action`-adjacent code is inside the
  MapLibre map controls (`MapControls.tsx`), scoped to the map instance — it does
  not reach the Breeding Codes table.
- **No JS gesture defeat.** No `gesturestart` / `gesturechange` handler and no
  document-level `touchmove` `preventDefault` anywhere in the app. The only
  `touchmove` listeners are the map's long-press pin-dropper — again map-scoped,
  not global.
- **The `.sr-input-16` decision is deliberately pinch-preserving.**
  `globals.css:912-919` documents that the sub-16px focus-zoom guard was chosen
  as a per-input 16px font bump **specifically to avoid a `maximum-scale` clamp
  that would kill pinch-zoom** — the intent the brief cites is real and encoded in
  the CSS. Preserving `.sr-input-16` (FR-09) keeps pinch alive.
- **No Tauri iOS viewport override.** `tauri.conf.json`'s `app.windows` block sets
  desktop window size + `zoomHotkeysEnabled: true` (a **desktop** Ctrl/Cmd-+
  affordance, irrelevant on iOS) and carries **no** iOS viewport/scale config; the
  mobile capability file (`capabilities/mobile.json`) grants only
  geolocation + dialog. Nothing there clamps scaling.

**Conclusion:** native viewport pinch is *plausibly enabled* as shipped — there is
no clamp and no gesture-eater in the code. This is the **primary** magnify path.

**Caveat (the one the brief flagged):** whether the shipping iOS WKWebView
*honors* the gesture on the real device is **not knowable from code** — WKWebView
can decline pinch on a page whose content is `width=device-width` even with a
clean meta, and Tauri's iOS webview config is a moving target. **QA-11 (the
on-device, user-owned check) remains the definitive gate.** The code lets us
commit to "native pinch should work and nothing we ship defeats it"; it cannot
prove the device honors it. That is exactly why the fallback below is designed
in advance rather than deferred.

### 2. Tauri native webview zoom — `setZoom` (the real unlock, unused last time)

**Confirmed available and granted.**

- **Capability granted:** `src-tauri/capabilities/default.json:9` —
  `"core:webview:allow-set-webview-zoom"` is in the `default` capability's
  permission list (applies to the `main` window, all platforms including iOS).
- **API present in the installed SDK:** `@tauri-apps/api@^2` is a dependency
  (`frontend/package.json:18`), and the installed
  `@tauri-apps/api/webview.d.ts:347` exposes
  `setZoom(scaleFactor: number): Promise<void>` on the webview returned by
  `getCurrentWebview()`. This is **native webview zoom** (the platform scales the
  whole webview content the way browser zoom does) — categorically the same
  primitive class as native pinch, and **fundamentally different from CSS
  `zoom` / `transform: scale`**, which is what failed in WKWebView last time. The
  last attempt never tried this path.
- **A clean capability seam already exists:** `isIOS()` in
  `frontend/src/lib/platform.ts` is a render-safe pure probe intended precisely
  for "capability branching" (its own comment lists updater absence, offline
  section, iOS import wording). `setZoom` is Tauri-only, so any control that calls
  it is gated on `isTauri()` / `isIOS()` and is invisible on web/Pi.

**Conclusion:** `setZoom` is a **usable, granted, native** zoom primitive today,
with no new capability, dependency, or config change required. It is the
**backstop / fallback** magnify path (FR-11) and the honest answer to "what if
native pinch is declined by the WebView."

### Spike verdict (lead with this)

| Question | Verdict |
|---|---|
| Native viewport pinch **enabled** as shipped? | **Yes, code-clean** — no `maximum-scale`/`user-scalable=no`, no `touch-action`/`gesturestart`/`touchmove-preventDefault`, `.sr-input-16` deliberately preserves pinch. **On-device honoring = QA-11, unproven by code.** |
| `setZoom` **usable + granted**? | **Yes** — `core:webview:allow-set-webview-zoom` granted; `setZoom(scaleFactor)` present in installed `@tauri-apps/api/webview`; native (not CSS) scaling. |
| **Primary** magnify path | **Native viewport pinch** (zero custom code — the brief's bet). |
| **Fallback** magnify path | **Tauri `setZoom` (native webview zoom)**, iOS-only, behind a −/Fit/+ control — built **only if** QA-11 shows native pinch is declined (FR-11 re-scope). NOT CSS zoom, NOT `transform: scale`. |

**No CSS `zoom` / `transform: scale` on this surface, on either path** (FR-08 /
NFR-03 / QA-08).

---

## Design — dot-width column narrowing (PRIMARY layout win)

### How the code columns are sized today

In `BreedingCodeTable.tsx`, each breeding-code `<th>` (lines 185-191) and its
cells are hardcoded to **`width: 44, minWidth: 44`** (px, inline). The count dot
inside each cell (lines 266-278) is a **28×28** circle. The sticky name column is
single-sourced to `NAME_COL_WIDTH = clamp(7.5rem, 40vw, 220px)` (line 46), used
by the header cell, every row's name `<th>`, and `scrollPaddingLeft`. The table
sits in an `overflowX: auto` wrapper with `position: relative` (line 152) that
scopes the `.sr-only` spans and contains horizontal scroll.

### Target design (≤640 only)

Narrow each code column from **44px → ~30px** on the phone tier (OQ-03 range
28–32px; **30px** is the design target — the 28px dot plus ~1px of breathing room
each side, which materially reduces total matrix width, ≈ halves it on a ~16-code
dataset → QA-01). **Keep the dot itself at 28px** (unchanged — it stays the
visible, tappable, legible unit; FR-02). Desktop/tablet stay byte-unchanged at
44px (FR-06 / NFR-04 / QA-06).

**Method — the load-bearing responsive-convention call.** The current width is an
**inline** `width: 44` on the `<th>`/cell. Per the standing convention ("make
layout responsive by LIFTING it to a class, never with an inline style — a media
query can't reach an inline width"), the correct approach is:

- Give the code `<th>` and each code `<td>` a **class** (e.g.
  `sr-bc-code-col`) that carries `width: 44px; min-width: 44px` as its **base**
  rule in `globals.css`, and **remove the inline `width: 44`** from the JSX so the
  class is reachable.
- Add a `@media (max-width: 640px)` rule that narrows it to
  `width: 30px; min-width: 30px` (sized so the terse header code still reads;
  tune 28–32px on-device per OQ-03).
- **Prefer the CSS-only path** (a class + a media query) over threading
  `useIsPhone` into the width — a pure column-width change is expressible in CSS
  and needs no JS branch (NFR-01 / FR-05). Reserve `useIsPhone` for the fallback
  control's mount branch (below), where *which DOM mounts* changes.

This keeps the desktop rule byte-identical (the class base rule equals today's
`44`), satisfies "≤640-only via CSS, no `window`/`resize` read" (QA-05), and holds
at 200% text scale because everything else in the cell is rem/px-dot-sized and the
matrix scrolls in its contained wrapper (NFR-02 / QA-12).

**Header legibility at 30px (FR-04 / QA-04).** The breeding codes are terse
(2–4 chars: NB, ON, CF, FL, …). At 30px with the existing `padding: 10px 0` and
`fontSize: 0.6875rem`, a 2–4-char code fits. The header stays a real sortable
`<button>` with `aria-sort` on the `<th>` and its full-meaning `aria-label`
(`Sort by ${def.label} (${code})`) — **unchanged** (FR-04, NFR-06). If a specific
code proves too wide at 30px on-device, the **first** remedy is a slightly wider
target within the OQ-03 band (32px), **not** rotating the header (rotation hurts
tap-target legibility more than it helps and complicates the sticky header). Treat
rotated/abbreviated headers as an on-device-only fallback the Engineer applies
only if a real code overflows — default is horizontal terse code, as today.

**Accessibility preserved (NFR-06 / QA-16).** Nothing about narrowing removes
information: the dot keeps its count + the existing `.sr-only ", Confirmed/
Probable/Possible"` tier text (lines 280), the header keeps its full-meaning
accessible name, the always-visible tier legend (lines 294-324) still spells every
code. No `.sr-only` span escapes the `position: relative` scroll wrapper.

### `NAME_COL_WIDTH` and sticky column — unchanged (FR-03 / QA-03)

The `clamp(7.5rem, 40vw, 220px)` sticky name column and its single-sourcing across
header/rows/`scrollPaddingLeft` stay exactly as-is. **Do not touch it** — it
already narrows correctly on phones and is the frozen column the whole design
depends on.

---

## Magnify strategy — how it composes with the sticky column + scroll

**Primary (native pinch): zero code.** Native viewport pinch scales the entire
rendered page including the sticky column and the horizontal scroll region. The
sticky-`left:0` name column is a normal part of the layout the browser
magnifies — under **native** viewport zoom the sticky offset scales with
everything else, so the column does not detach the way it did under
`transform: scale` (which created a new containing block and broke `position:
sticky`). Two-finger pan moves the magnified viewport; the contained
`overflowX: auto` still scrolls the matrix within its own box at 1:1. **This is
the design's bet and needs no new component** (FR-07 / QA-07 — no custom zoom UI
shipped).

**The sticky-column-under-zoom risk (call it out).** The one genuine unknown is
how `position: sticky` behaves under **native viewport pinch** in the specific
shipping WKWebView — most browsers keep sticky offsets correct under native page
zoom (unlike `transform: scale`), but WKWebView's exact behavior here is the thing
QA-11 must eyeball. If the sticky column visually misbehaves under native pinch on
device, the **mitigation is already in the codebase**: `wideMode` (`↔ Unbounded`)
drops the sticky positioning entirely (the `<th>` sticky styles are gated
`...(wideMode ? {} : { position: 'sticky', … })`, lines 231-232) and lets the
whole matrix scroll as `width: max-content`. So a "sticky breaks under pinch"
outcome degrades gracefully to an existing, tested state rather than a broken one.
This is why OQ-04 (phone default for `wideMode`) is flagged but **not** changed
here — leave both states compatible with the narrowed columns (FR-13 / QA-14) and
let the on-device review decide if the phone default should flip.

**Fallback (FR-11) — designed but NOT the default build.** *Only if* QA-11 proves
native pinch is unworkable in the WKWebView:

- A small, keyboard/AA-reachable **− / Fit / + control** (three `<button>`s,
  ≥44px touch targets via `.sr-touch-target`, `aria-label`s, focus-restoring) that
  calls `getCurrentWebview().setZoom(factor)` — **native webview zoom, not CSS**.
- **iOS-only mount**, gated on `isIOS()` (web/Pi never see it; on those platforms
  native browser pinch is reliable). Phone-tier mount additionally gated on
  `useIsPhone()` (this is a *which-DOM-mounts* branch → the sanctioned
  `useIsPhone` use, not a width read).
- Session-only `useState` for the factor (no `storage` seam, no persistence). Any
  `Date.now()`-style impurity is irrelevant here (there is none); the factor is a
  plain number with clamp bounds (e.g. 1.0–3.0).
- **This is a conscious re-scope, not a silent code change** — per FR-11 it ships
  only after QA-11 fails and the user accepts the re-scope. The Engineer builds the
  primary (dot-width + native pinch) path first; the fallback is a documented,
  ready design, not part of the default deliverable.

---

## Multimedia (`LifeListTable.tsx`) — minor ride-along (SECONDARY)

**Recommendation: ship unchanged** (FR-14 explicitly allows this; QA-15 passes if
it matches today). The Multimedia table is **not** genuinely wide: a name/Entries
column + four narrow fixed columns (Photo/Audio/Video 80px, Total 70px), a plain
`overflowX: auto` frame, and the same `wideMode` toggle. It already fits a 320px
phone with modest scroll and already honors the standing conventions
(`.sr-input-16`, sticky header, `.sr-only` under `position: relative`, rem sizing).

The **one optional, zero-risk polish** the Engineer may apply if desired: wrap its
scroll frame in the shared **`.sr-scroll-x`** class (which adds
`-webkit-overflow-scrolling: touch` + `position: relative` + `max-width: 100%` +
`min-width: 0`) if it isn't already, for momentum scrolling and page-scroll-leak
safety parity with the standing convention. This must not change its
desktop/tablet rendering (FR-15). **No rebuild, no rearchitecture** (Out of
Scope). If nothing measurably improves it, unchanged is the accepted outcome.

---

## Module / CSS touch-points

| File | Change |
|---|---|
| `frontend/src/globals.css` | Add `.sr-bc-code-col` base rule (`width:44px;min-width:44px`) + a `@media (max-width:640px)` narrow rule (`~30px`). Both use existing patterns; **zero new `--sr-*` tokens** (NFR-07 / QA-18). Optionally add a header-legibility tweak if a code overflows on-device. |
| `frontend/src/components/BreedingCodeTable.tsx` | Replace the inline `width: 44, minWidth: 44` on code `<th>`/`<td>` with the new class so the media query can reach it. Everything else (sticky name col, dot, `.sr-only`, sort buttons, `aria-*`) **unchanged**. |
| `frontend/src/components/BreedingCodeList.tsx` | **No change** for the primary path. (Only touched if the FR-11 fallback control is built — it would mount the − / Fit / + control here or in the table, `useIsPhone()`+`isIOS()`-gated.) |
| `frontend/src/components/LifeListTable.tsx` | **No change** (recommended), or the one optional `.sr-scroll-x` wrap polish. |
| `frontend/index.html` | **No change** — viewport already clean; must stay clean (FR-09 / QA-09). |
| **Fallback only (FR-11):** a small zoom-control component calling `getCurrentWebview().setZoom()` via the Tauri webview API, `isIOS()`-gated. Not built unless QA-11 fails. |

No new dependency (`@tauri-apps/api` already present), no new capability
(`allow-set-webview-zoom` already granted), no backend, no bundled data, no
network call (NFR-08).

---

## Test surface

- **vitest (jsdom), what it *can* cover (NFR-09 / QA-19):**
  - The code column carries the `sr-bc-code-col` class (so the ≤640 media query is
    reachable) and the desktop base width equals today's 44px (guards NFR-04 — no
    desktop regression).
  - Each code header keeps its `aria-label` (`Sort by … (…)`), `aria-sort`, and is
    a focusable `<button>`; sort still fires (FR-04 / QA-04 / QA-13).
  - Each count dot still renders with its count + the `.sr-only` tier text; empty
    cells stay empty (FR-02 / QA-02 / QA-16).
  - The sticky name `<th>` keeps `position: sticky; left: 0` in the non-`wideMode`
    branch and drops it in `wideMode` (FR-03 / FR-13 / QA-03 / QA-14).
  - No `transform: scale` / CSS `zoom` string appears on the changed surface
    (QA-08) — a code/DOM assertion.
  - Existing `BreedingCodeTable` / `BreedingCodeList` tests stay green (QA-06).
- **jsdom *cannot* cover (deferred to QA-11, manual, user-owned):** actual native
  pinch magnify + two-finger pan, sticky-column behavior *under* pinch, and (if
  built) `setZoom` on real hardware. jsdom has no layout engine, no WKWebView, no
  gesture surface — this is stated in NFR-09 and is the blocking on-device gate.
- **The definitive confirmation is the user's on-device interactive test at
  preview** (TestFlight / iOS WKWebView). Per the memory note, a live preview
  against real data precedes ship; QA-11 is that step and it **gates** the design.

---

## FR / NFR coverage note

- **Layout (FR-01, FR-02, FR-03, FR-05, FR-06):** dot-width class + ≤640 media
  query; sticky name column and dot untouched; desktop byte-unchanged.
- **Magnify (FR-07, FR-08, FR-09, FR-10):** native viewport pinch primary (no
  custom UI, no CSS scaling); viewport meta stays clamp-free; sticky-under-pinch
  risk mitigated by the existing `wideMode` escape and gated by QA-11.
- **Fallback (FR-11):** `setZoom`-based native control designed, iOS-gated,
  session-only — built only on QA-11 failure (conscious re-scope).
- **Existing behavior (FR-12, FR-13, FR-14, FR-15):** all filters/sort/links/
  legend/favicons preserved; `wideMode` compatible with narrowed columns;
  Multimedia unchanged or one optional `.sr-scroll-x` polish.
- **NFR-01…09:** class-lifted responsive method (no inline breakpoint / no
  `resize`); holds at 320px + 200% text scale (rem/dot sizing, contained scroll);
  no CSS pixel-scaling magnify; desktop byte-unchanged; ~44px touch targets on any
  fallback control; a11y accessible-info preserved; existing `--sr-*` tokens only,
  **zero new tokens expected**; no new deps/providers/privacy surface; vitest
  covers the phone branch to jsdom's limit with native pinch deferred to QA-11.

**The one thing code cannot commit to and QA-11 must settle:** whether the
shipping iOS WKWebView actually honors native pinch (and keeps the sticky column
sane under it). The `setZoom` fallback exists precisely so a "no" there is a
planned re-scope, not a dead end.
