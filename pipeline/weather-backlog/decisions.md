# Decisions — Weather Backlog

## Stage 4 — The Designer

### Design-system deviations
**None.** The backlog is designed entirely within the established SnowRaven
system (`pipeline/design-system.md`): reused `.sr-card`, the house-header icon
tile, the Checklists-tab row anatomy, the `role="switch"` toggle, the shared
link/failure components, and Lucide icons. **No new `--sr-*` tokens and no new
components** are introduced — all colors resolve from existing tokens in both
`:root` and `[data-theme="dark"]`. This matches the Architect's NFR-05
expectation ("No new tokens are anticipated").

### OQ resolutions rendered as the approved defaults

- **OQ-2 (per-row fields + widen marker).** Field set = **date · location ·
  species count · protocol name · completeness**, laid out as the Checklists-tab
  row (line 1: date · location · count; line 2: protocol · distance · duration ·
  county,state · completeness). Absent fields omit gracefully. A row surfaced
  only by the widen toggle leads its meta line with a chip — amber **Incomplete**
  (`--sr-warning*`) or neutral **Incidental** (`--sr-surface-subtle`) — and gets
  a faint `--sr-surface-faint` row tint, so a widened list is unambiguous
  (FR-13/FR-14).

- **OQ-3 (action #3 copy content) — RESOLVED by the user → weather-only.**
  Action #3 copies the **weather block ONLY** (no tide). The user chose this over
  the initially-rendered combined weather+tide default, to match the literal
  request ("only copy the weather by default"). Implementation: the isolated
  `buildBacklogCopyText` returns the weather block and does **not** fetch or
  append tide — i.e. the schema's tide branch is omitted (the one-line change the
  Architect isolated for exactly this). The mockup's OQ-3 annotation and success
  copy were updated to "weather copied." (If a combined weather+tide variant is
  ever wanted, it's the same one function.)

- **OQ-4 (failure affordance + missing-key case).** Action #3 reports failure
  **inline on the row** in three honest states — **offline** / **missing or
  invalid key** (with a "Settings →" nudge, matching the Weather tab's existing
  key-missing banner) / **generic error** — using the shared `OfflineMessage`
  treatment and the app's `--sr-error*` / `--sr-warning*` tints. The comment/edit
  page is **never** opened on failure, and each state states plainly that nothing
  was copied (FR-19/FR-23). Per-row state is independent.

These three are UX defaults confirmed by the Designer (the Planner deferred them
here); they are product decisions, not design-system deviations.

## Stage 6 — The Tester

### QA-34 (hardcoded white toggle thumb) — resolved: matches sanctioned precedent, no change
The Tester flagged `WeatherBacklog.tsx`'s widen-toggle thumb
(`background:'#fff'` + `boxShadow:'0 1px 2px rgba(0,0,0,.25)'`) as a Partial on the
tokens-only rule. Verified against the codebase: this is the ESTABLISHED switch
pattern — `components/ui/ToggleSwitch.tsx`, `Calendar.tsx`, and `MapExplorer.tsx`
all render a hardcoded white knob with the identical shadow, and the
`--sr-gray-400` off-track token in `globals.css` is explicitly tuned for ≥3:1
contrast **against the white knob** (see its `:root` and dark-theme comments). The
white switch knob is theme-neutral by design (a physical-switch metaphor) and is a
sanctioned literal, like the map boundary-line color exception. WeatherBacklog's
inline switch is a byte-match for Calendar's. **No change made** — a one-off
`--sr-switch-thumb` here would be inconsistent with the other three switches.
Carried to the Chronicler as a design-system convention flag (mint an app-wide
`--sr-switch-thumb` and migrate all four switches together, OR formally sanction
the white-knob literal) — out of scope for this feature.

Full suite green: **1547 frontend + 178 backend**; build + lint pass;
**38 Pass / 1 Partial (resolved above) / 0 Fail** across the 39 QA criteria.

## Stage 8 — The Deployer (live-preview findings)

Two bugs surfaced in the live desktop-app preview that the jsdom test suite could
not catch, both fixed and re-verified before ship (full suite re-run: **1548
frontend** green).

### 1. `window.open` is silently dropped in the Tauri desktop WebView — action #3 didn't open the edit page
Action #3 opened the eBird edit page with `window.open(url, '_blank', …)`. On the
web build that works, but in the **Tauri desktop app the call is silently
swallowed** — WKWebView never opens the system browser. The whole app opens
external links exclusively via `<a target="_blank">` anchors, which
`tauri-plugin-opener` intercepts; nothing else in the codebase uses `window.open`
(the backlog was the sole exception). **Fix:** a new programmatic seam
`frontend/src/lib/openExternal.ts` `openExternalUrl(url)` that synthesizes exactly
what the opener plugin listens for — a transient, detached `<a target="_blank"
rel="noopener noreferrer">` that is appended, `.click()`-ed, and removed. Works in
BOTH web (opens a tab) and desktop (opener plugin intercepts). Action #3 now calls
`openExternalUrl(EDIT_URL(id))`. Security posture unchanged: same
`SUBMISSION_ID_RE` + `encodeURIComponent` id guard, same `noopener,noreferrer`, no
`dangerouslySetInnerHTML`. Covered by `lib/openExternal.test.ts` and the updated
`WeatherBacklog.test.tsx` (mocks the seam).

**→ Convention flag for the Chronicler (CLAUDE.md):** NEVER use `window.open()` to
open an external URL — it is silently dropped in the Tauri desktop WebView. Open
external links via `OutboundLink`/`ChecklistLink` (a user click) or, when the open
must happen from code, the `openExternalUrl` seam (`lib/openExternal.ts`). This is
the programmatic sibling of the OutboundLink convention.

### 2. setState-in-render in the expand toggle
`WeatherBacklog`'s `onToggleExpand` called `setEverExpanded(true)` and the
App-level `onFirstExpand?.()` **inside the `setExpanded` updater function** — which
runs during React's render phase, producing the console warning *"Cannot update a
component (App) while rendering a different component (WeatherBacklog)."* The
automated tests didn't fail on it (React logs it, doesn't throw). **Fix:** moved
the side effects out of the updater and into the event-handler body (guarded by
`everExpanded`, and the component starts collapsed so the first toggle is always
the first expand). No behavior change; warning gone.
