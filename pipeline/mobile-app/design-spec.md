# Design Spec — Mobile App (iOS + iPadOS)

**Feature:** mobile-app · **Stage:** 4 — The Designer · **Date:** 2026-07-04
**Mockup:** `pipeline/mobile-app/design.html` (self-contained; open in any browser)

This is a **composition contract, not a redesign**. The app's responsive
system (320px → desktop, the ~480/640/1024/1280 tiers, `.sr-grid-*`,
`.sr-touch-target`, `.sr-input-16`) IS the mobile design. The Engineer
verifies the shipped tiers compose as specified below on each canvas; the
only genuinely new UI moment is the native document-picker import flow.
**No new tokens. No new components. No new patterns.** Any polish deviation
gets logged to `pipeline/mobile-app/decisions.md` before it ships.

*Revised after the design review (two user-approved changes):* (1) map
fullscreen on iPad hides the sidebar and surfaces the Filters FAB — the
shipped phone pattern extended to fullscreen at any width; (2) the iOS file
rows use "Import" wording instead of "Upload" (logged in
`pipeline/mobile-app/decisions.md`).

*Revised again after the live simulator preview (two user-requested
composition fixes, logged in decisions.md, both iOS-gated via
`compactChrome()`):* (3) on iOS the brand header collapses to a slim
single-line bar — 20px logo + 1.125rem wordmark, no tagline, minimal
padding — so header + tab nav cost far less vertical space on both device
families; desktop/web keep the full header; (4) on iOS the Map Explorer
panel sizes to the visible viewport
(`100dvh − 112px − env(safe-area-inset-top)`) so the map AND its
fullscreen/Filters FAB cluster are above the fold when the tab opens, in
both iPad orientations and on iPhone; the mode controls above the map stay
reachable, just within the visible composition.

## Visual Direction

Unchanged: quiet utility per `pipeline/design-system.md`. The existing light
and dark themes carry over wholesale; the mockup depicts light theme only
(the dark tokens already exist and are not touched by this feature). What
"designed for mobile" means here: each surface lands in its correct existing
tier on each device, safe areas are respected, and the phone-tier reductions
(Calendar single view, Filters-behind-FAB) read as intentional — because they
are (FR-07).

## Screens / Views — the per-canvas tier contract

Layout keys off **window width, never device identity** — which is what makes
Split View correct for free. Reference widths: iPhone 390pt · Split View
narrow pane 320pt · iPad portrait ~768–834pt (820 depicted) · iPad landscape
~1024–1366pt (1180 depicted).

| Surface | iPhone / Split narrow (≤640) | iPad portrait (≤1024) | iPad landscape (>1024) |
|---|---|---|---|
| **Navigation (TabNav)** | Dropdown (overflow-measured) | Dropdown | **Dropdown** — the full default 11-item bar's probe is ~1,380px natural width, wider than any iPad viewport minus the 48px wrap padding. Reviewed and accepted as-is for v1 (see Interaction Notes). |
| **Weather** | Single column: ID input (16px font, `.sr-input-16`), 44px Get-weather button, stacked weather/tide blocks, per-block Copy + "Copy weather & tide together" | Same content in a centered reading-width column; blocks may sit side by side | Same as portrait; column capped well inside the 1280 `.sr-panel`, never edge-to-edge |
| **Statistics** | Single column (all grids → 1-up) | `.sr-grid-3/-4` → **2-up** (the ≤1024 collapse); `.sr-grid-chart-aside` stays side-by-side (>640) | 3/4-up rows, chart + aside side-by-side — the full desktop composition |
| **Map Explorer** | Map owns the panel (`height: calc(100dvh − 132px)` tier); Filters FAB (mobile-only) + fullscreen FAB in `.sr-map-fab-cluster` | Sidebar visible beside map; Filters FAB hidden; fullscreen FAB remains. **Fullscreen hides the sidebar** — map owns the entire canvas — and the **Filters FAB appears** while fullscreen; the fullscreen FAB exits and restores the sidebar composition | Same, wider map; same fullscreen contract |
| **Calendar** | View toggle hidden (`.sr-cal-view-toggle` ≤640) AND `useIsPhone()` forces the big month grids — the overview never mounts (QA-07) | Compact/Large toggle present. Large (`.sr-cal-year`) = **2-up** mini-months (≤1024) | Large = **3-up** mini-months; day numbers render (each mini-month clears the 152px container floor) |
| **Settings** | Stacked rows, 44px targets, native picker on file rows | Same centered column, wider margins | Same |
| **Species Detail, Multimedia, Breeding Codes, Checklists, List Comparer, Named Birds** | Existing phone tiers: single column, wide tables inside `.sr-scroll-x`, `.sr-action-row` wrapping | Existing wider tiers | Existing desktop tiers |

Not individually depicted in the mockup: the last row's six tabs. Their
contract is simply "the shipped tier at that width" — QA-05/06 verify them in
the simulator; no bespoke composition is specified for them and none should
be invented.

**Exactly-1024pt iPads:** older 9.7"/10.2" models are 1024pt wide in
landscape, and the collapse tier is `max-width: 1024px` **inclusive** — those
devices get the 2-up tier even in landscape. This is correct shipped
behavior, not a defect; do not special-case it.

## Component Usage

All existing, none new:

- `TabNav` — untouched; the overflow probe already handles every width.
- `SectionCard`/house-header pattern, `SegControl` (`aria-pressed`), filter
  pills, `BirdName` rows, `ChecklistLink`/`OutboundLink` — as shipped.
- `Settings.tsx` `FileRow` — the platform branch (schema.md §2.6): on iOS the
  existing button presents the native `UIDocumentPicker` (WKWebView presents
  it from the existing `<input type="file" accept=".csv">` path — if the
  Architect's smoke holds, this is a picker-for-free adaptation). Button copy
  on iOS: **"Import file…"** (empty row) / **"Import new…"** (replace), with
  the transient state reading **"Importing…"** — the user-approved iOS copy
  adaptation (design review, logged in decisions.md). Desktop/web keep
  "Upload file" / "Upload new" / "Uploading…" unchanged; the branch rides the
  same `isIOS()` seam as the picker itself.
- `OfflineMapsSection` — not rendered on iOS (gate `isTauri() && !isIOS()`).
- Footer update affordance ("Check for updates" / "Install update and
  restart") — not rendered on iOS; footer shows version only.
- The document picker itself is **OS-owned UI** — the mockup's sheet is a
  depiction, not a spec. Do not attempt to restyle it.

## Design Tokens Applied

Verbatim from `frontend/src/globals.css`, light theme depicted: surfaces
(`--sr-bg/surface/surface-subtle/surface-faint`), text
(`--sr-text/-muted/-gray/-disabled`), borders (incl. `--sr-border-input` on
form controls), accent family (`--sr-accent` #277448 et al.), quote block
(`--sr-quote-*`) for the formatted weather/tide text, milestone gradients
(`--sr-milestone-1..4-*`), calendar ramp (`--sr-cal-1..5` + `--sr-cal-fg`),
county ramp (`--sr-county-1..10`) in the map legend, map pin tokens
(`--sr-map-pin-*`). **Zero new tokens minted.** The mockup's device bezels,
iOS-blue picker Cancel, and page chrome are mockup furniture, not app UI.

## Interaction Notes (what the Engineer implements/verifies)

**Safe areas (NFR-07).** `viewport-fit=cover` already ships in `index.html`.
Surfaces that must respect `env(safe-area-inset-*)` on device, both
orientations:
- App footer / any bottom-anchored content → `padding-bottom:
  env(safe-area-inset-bottom)` posture (home indicator, 34pt class).
- `.sr-map-fab-cluster` → bottom/right insets so the 44px FABs sit clear of
  the home indicator and rounded corners.
- The fullscreen map overlay (`position: fixed; inset: 0; 100dvh`) → its own
  chrome (close affordance, FAB cluster) inside the insets; the map canvas
  itself may bleed edge-to-edge.

**Map fullscreen composition (user-approved at design review).** Entering
map fullscreen — at ANY width, iPad included — hides the sidebar along with
the rest of the app chrome: the map owns the entire canvas. While
fullscreen, the **Filters button appears in the FAB cluster** (the shipped
mobile affordance, opening the same filters drawer/panel the phone tier
uses) so filters stay reachable; the fullscreen FAB exits and restores the
non-fullscreen composition (sidebar beside map on iPad). Engineer note:
this is expected to be a visibility-rule change, not a new component —
extend the existing mobile-only Filters-button rule to
*(phone tier OR fullscreen)*; the fullscreen overlay itself already hides
the app chrome today. Non-fullscreen iPad keeps the sidebar visible beside
the map, unchanged.
- The TabNav dropdown menu (`maxHeight: calc(100dvh − 96px)`) → verify the
  open menu's bottom clears the home indicator; adjust the offset with the
  bottom inset if it doesn't.
- Map popups (`.sr-map-popup-body`) → already viewport-capped; verify on a
  notched device.
- Top: the app's first row must clear the Dynamic Island / status bar
  (59pt class on iPhone; ~24pt on iPad).

**Import flow states (FR-08..13)** — all existing states, one new presenter,
iOS-approved "Import" wording on the controls:
1. *Idle/empty:* FileRow with "No file saved" pill + **"Import file…"**.
2. *Picker:* tap presents the native document picker (Files, iCloud Drive,
   any provider). Non-CSV files are dimmed by the picker's type filter.
3. *Cancel:* clean no-op — no state change, no error, prior data intact.
4. *Importing:* the existing disabled-button transient state, reading
   **"Importing…"** on iOS ("Uploading…" on desktop/web).
5. *Success:* existing metadata confirmation — filename + "Saved {date}" —
   and persistence across relaunch (FR-10).
6. *Error:* existing states — "Only .csv files are accepted." for wrong
   type; existing malformed-CSV error; prior file untouched either way.
7. *Re-import:* **"Import new…"** replaces the file of that kind; tabs
   recompute via existing cache invalidation (FR-11).

**Platform-conditional visibility (FR-14/15, schema §2.5)** — on iOS:
absent = updater UI (footer check/install), Offline-maps region section.
Adapted = the FileRow copy ("Import file…" / "Import new…" / "Importing…",
per the approved iOS wording). Present = everything else, including
Troubleshooting/Rebuild caches (Tauri surface, not desktop-only per the
schema's conditional list). Absences are true absences — no disabled
ghosts, no dangling copy. (The mockup's dashed "ghost" rows appear only in
its notes mode, for the reviewer.)

**Location (FR-16):** "Use my location" triggers the system prompt on first
use; denial degrades to the existing message with manual entry/place search
fully usable. No new UI.

**Clipboard (FR-17):** every Copy affordance keeps the existing
"Copied!" 2s button state; the copy-after-await path must work (native
clipboard plugin, not `navigator.clipboard`).

**Touch/zoom invariants (NFR-02/03):** 44px targets via `.sr-touch-target`
in the ≤640 tier; no sub-16px form-control font (`.sr-input-16` on the
element itself); no `maximum-scale` clamp; all surfaces hold at 320px and
200% text scale.

**Reviewed and kept as-is for v1 (design review):** the TabNav dropdown
trigger renders full-width on iPad (~1,100pt wide button), and Statistics
composes 2-up in iPad portrait — both accepted unchanged. A trigger
`max-width` cap (~26rem, centered) on wide viewports remains noted as a
possible future polish only; do not implement it in this run.

## Content Notes

- All mockup content is **synthetic** (Bottle Beach SP / Grays Harbor,
  "MyEBirdData.csv", Snowy Owl #400, etc.) — the established
  never-real-data convention; App Store screenshots follow the same rule
  (FR-27) using the website demo-data tooling.
- The weather/tide block text in the mockup is **illustrative**; the real
  `weatherFormatter`/`tideFormatter` output is the source of truth and is
  not modified by this feature.
- Copy tone unchanged: informative, never promotional; existing degradation
  messages (offline / no-key / provider error) carry over verbatim (FR-24).
- Per the phased-announcement decision, no public surface mentions mobile
  until App Store launch — nothing in this design introduces user-facing
  copy that violates that.
