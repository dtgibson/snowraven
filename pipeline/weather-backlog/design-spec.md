# Design Spec — Weather Backlog

**Feature:** weather-backlog · **Stage:** 4 — The Designer
**Status:** designed entirely WITHIN the established SnowRaven design system
(`pipeline/design-system.md`). No new tokens, no new patterns, no new
dependencies. Every deviation (there are none of substance) is logged in
`decisions.md`.

## Visual Direction
Quiet utility, unchanged. The backlog reads as a natural third block at the
bottom of the Weather tab — same `.sr-card` surface, same 30px accent icon
tile as the app's house headers, same Checklists-tab row anatomy (date ·
location · badges, species count right-aligned in accent green). Color stays
restrained: the accent green marks exactly one action per row ("Copy weather &
go") and the active toggle; everything else is neutral surface/text/border.
Failure uses the app's existing warning/error tints — never invented reds.

## Screens / Views

### Collapsed entry point
A single full-width `.sr-card`-style button at the bottom of the Weather tab,
below the (unchanged) single-checklist lookup and the Current/Predict panel.
- 30px accent-bg icon tile (Lucide `list` mark) + title "List checklists with
  no weather blocks" + a one-line muted subtitle + a chevron that rotates on
  expand.
- `aria-expanded` reflects open state; activating expands the list in place
  (never navigates). Session-only; not persisted (per scope).

### Expanded backlog
- **Header** (`.sr-head`-style block, bottom-bordered): 30px icon tile + h2
  "Checklists missing weather"; a muted count/context line
  ("**100** most recent complete, non-incidental checklists with no weather
  block · newest first"); then the widen toggle.
- **Widen toggle:** a real `role="switch"` (the app's 34×20 pill, accent when
  on) on a `--sr-surface-faint` strip, labelled "Also show incomplete &
  incidental — widens the list". Default OFF. Toggling updates the header
  context line and resets pagination to the first 100.
- **Rows:** one per checklist, `--sr-border-subtle` separators.

### Row anatomy (OQ-2 default rendered)
- **Line 1:** date link (accent, `→` to the checklist) · `·` · location
  (`HotspotLink`-style accent link with trailing external-link glyph when a
  public hotspot; plain text otherwise) · species count right-aligned, accent
  green bold — exactly the Checklists-tab treatment.
- **Line 2 (meta):** protocol name · distance · duration · county, state ·
  completeness ("Complete"). Absent fields are omitted (no "null" text). When
  a row is surfaced only by the widen filter it leads with a chip:
  amber **Incomplete** (`--sr-warning*`) or neutral **Incidental**
  (`--sr-surface-subtle`), and the whole row gets a faint
  `--sr-surface-faint` tint so a widened list is never ambiguous.
- **Line 3 (actions):** three controls, all keyboard-operable, ~44px on phone.
  1. **Open checklist ↗** — icon-only neutral button (`ChecklistLink`).
  2. **Open comment/edit page** — icon-only neutral button (`OutboundLink` to
     `ebird.org/edit/effort?subID=…`).
  3. **Copy weather & go** — the single accent button. A flex spacer separates
     it from #1/#2 so the "do the work" action reads as primary and distinct.
- **Row states shown:** idle/ready; mid-lookup (spinner, "Looking up…", button
  busy); success (`--sr-accent-bg` "Copied · comment page opened").

### Failure states (OQ-4 default rendered)
Inline under the row, in the app's honest three-state vocabulary (the shared
`OfflineMessage` treatment), and the comment/edit page is **not** opened:
- **Offline** — `--sr-error*` tint, activity-off icon, "You're offline… nothing
  was copied and the comment page wasn't opened."
- **Missing/invalid key** — `--sr-warning*` tint, lock icon, "Weather lookup
  needs an API key. Add your eBird & OpenWeather keys in **Settings →**" — the
  same Settings nudge the Weather tab already uses for missing keys.
- **Generic error** — `--sr-error*` tint, alert-circle icon, "Weather lookup
  failed… Try again."
Each carries `role="alert"`; per-row state is independent.

### Pagination
Centered footer over a `--sr-border-subtle` top border: **Show next 100**
(neutral) + **Show all (N)** (ghost/accent text) + a muted "Showing 1–100"
note. Controls appear only when >100 match.

### Empty / needs-data states
- **Needs data:** file icon, "Load your eBird backup first", explanatory body,
  accent "Go to Import" CTA. Never a blank list or endless spinner.
- **Zero match:** check-circle in accent-bg, "No complete checklists are
  missing weather" — names the active filter context and points at the widen
  toggle, so "everything is handled" reads as a win.

## Component Usage (reused, not reinvented)
- **Card / header:** `.sr-card` + the house-header icon-tile pattern.
- **Row:** the Checklists-tab `ChecklistRow` layout (baseline flex, `·`
  separators, right-aligned accent count).
- **Links out:** `ChecklistLink` (#1), `OutboundLink` (#2), `HotspotLink`
  (location, when a public hotspot) — all keep their id-shape guards and
  "(opens in a new tab)" cues.
- **Toggle:** the app's `role="switch"` pill (accent on-state).
- **Failure:** `OfflineMessage` (offline / no-key / error kinds).
- **Icons:** Lucide only — `list`, `external-link`, `square-pen`, `copy`,
  `check`, `loader`, `triangle-alert`, `circle-alert`, `lock`, `file-text`,
  `check-circle`, `download`. 11–15px, stroke ~2.2, purposeful.
- **Layout classes:** `.sr-action-row`, `.sr-min0`, `.sr-truncate`,
  `.sr-touch-target` (≤640 44px), `.sr-only`.

## Design Tokens Applied
- **Accent action / active toggle / counts:** `--sr-accent`, `--sr-on-accent`,
  `--sr-accent-strong`, `--sr-accent-bg`, `--sr-accent-border-strong`.
- **Surfaces:** `--sr-surface` (card), `--sr-surface-faint` (toggle strip,
  widened rows), `--sr-surface-subtle` (incidental chip, hovers).
- **Text:** `--sr-text`, `--sr-text-muted`, `--sr-text-disabled` (separators).
- **Borders:** `--sr-border`, `--sr-border-subtle` (row/footer separators),
  `--sr-border-medium` (neutral buttons).
- **Warning (incomplete chip, missing-key):** `--sr-warning`,
  `--sr-warning-bg`, `--sr-warning-subtle`.
- **Error (offline / generic):** `--sr-error`, `--sr-error-bg`,
  `--sr-error-border`.
- **Toggle track:** `--sr-gray-400`; knob white; card shadow
  `--sr-card-shadow`. All resolve in both `:root` and `[data-theme="dark"]`.

## Interaction Notes (for the Engineer)
- Entry point: `aria-expanded`; expands the section in place; single-lookup /
  Current / Predict untouched (NFR-10).
- Widen toggle: `role="switch"` + `aria-checked`; on change, re-evaluate the
  set (superset) and reset `shown` to 100 in the handler (FR-22).
- Action #3 copy content (user decision): copies the **weather block only** — NOT
  tide. `buildBacklogCopyText` returns the weather block with no tide fetch/append.
- Action #3 state machine (per row, independent): idle → looking-up (busy,
  re-clicks ignored) → copying → success (open edit page exactly once, on the
  success edge only) | error-offline | error-no-key | error-other. The edit
  page is opened ONLY on the copy-success edge (FR-19).
- Success/loading/error and the empty/needs-data states announce via a polite
  live region (loading/success) or `role="alert"` (failures).
- Pagination "Show next 100" appends; "Show all" reveals all remaining.

## Content Notes
Copy is informative and calm, matching SnowRaven — no exclamation, no
promotion. The zero-match state frames completeness positively. Failure copy is
honest and specific per cause, and every failure states plainly that nothing
was copied / the page wasn't opened. Realistic California/coastal birding data
throughout (Point Reyes, Bodega Head, Pillar Point, Elkhorn Slough, etc.),
species counts 6–63, protocols Traveling/Stationary/Incidental.

## Deviations from the design system
None of substance. This feature extends existing patterns only; see
`decisions.md` for the OQ resolutions (which are UX defaults, not system
deviations) and confirmation that no new tokens or components are introduced.
