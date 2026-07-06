# Schema / Technical Design — Weather Backlog

**Feature:** weather-backlog
**Stage:** 3 — The Architect
**Path:** Frontend Only
**Date:** 2026-07-06

---

## 0. Data-layer statement

**No data-layer changes are required.**

- No new database tables, columns, or migrations.
- No new backend route, provider, formatter, or fetch policy.
- The backlog is assembled entirely from the **already-loaded eBird backup**
  (`ObservationEntry[]` → `ChecklistRowData[]`), and its one networked action
  (per-row weather lookup) **reuses the existing `/weather/<id>` transport path**
  and the existing `/tide/<id>` path — the same calls the single-checklist
  Weather lookup already makes.
- Reused parse-once caches: `loadEbirdObservations()` (`lib/observationsCache.ts`)
  and `buildChecklistRows()` (`lib/checklistsTab.ts`). Nothing is re-parsed and
  no other tab's data is mutated (FR-04, FR-11, NFR-01, NFR-07, NFR-10).

The remainder of this document is the **frontend technical design** the Engineer
builds from in Stage 5.

---

## 1. VERIFIED: the Incidental predicate (conflict resolved)

**The PRD is correct: Incidental = protocol code `P20`. The earlier `P22` guess
was wrong — `P22` is _Traveling_.**

Confirmed from source:

- `frontend/src/lib/checklistMeta.ts:7-18` — `PROTOCOL_NAMES` maps
  `P20: 'Incidental'`, `P21: 'Stationary'`, `P22: 'Traveling'`, `P23: 'Area'`, …
  `protocolName(id)` returns the display name, or the raw id when unknown
  (`checklistMeta.ts:20-23`).
- **`ChecklistEntry.protocol` stores the RAW eBird "Protocol" column value,
  verbatim, NOT a mapped display name.**
  `frontend/src/lib/parseEbirdObservations.ts:162-164`:
  `if (protocolIdx >= 0) optFields.protocol = cols[protocolIdx]?.trim() || null`
  — the header matched is exactly `'protocol'` (`parseEbirdObservations.ts:79`),
  the value is trimmed and stored as-is (blank → `null`). No code→name mapping
  happens at parse time. It flows unchanged through
  `computeChecklists()` → `ChecklistEntry.protocol`
  (`birdingStats.ts:97`, `firstRow.protocol ?? null`) and is typed
  `protocol: string | null` (`frontend/src/types.ts:96`).
- **The shipped app already treats that raw value as a `P##` CODE.**
  `components/Checklists.tsx:330` renders `protocolName(c.protocol)` and
  `Checklists.tsx:485` builds the Protocol filter dropdown as
  `set(c.protocol) → { id, label: protocolName(id) }`. Both only produce the
  friendly "Incidental"/"Traveling"/… labels **if `c.protocol` is a `P##` code** —
  which is what the real MyEBirdData export's Protocol column contains. So the
  authoritative, shipped-behavior shape is: **`protocol` is the eBird protocol
  code string (`"P20"`, `"P21"`, `"P22"`, …), or `null`.**

### Exact predicate for the Engineer

```ts
// lib/weatherBacklog.ts
export const INCIDENTAL_PROTOCOL = 'P20' as const  // eBird "Incidental" (verified: checklistMeta.ts:8)

export function isIncidental(c: ChecklistEntry): boolean {
  return c.protocol === INCIDENTAL_PROTOCOL
}
```

- A `null` protocol is **not** Incidental (it fails the equality), so a
  protocol-less checklist is treated as non-incidental and can appear in the
  default view (subject to the complete filter). This matches "protocol is not
  Incidental" (FR-07) read literally.
- Do **not** compare against `protocolName(...)` output or against the string
  `"Incidental"` — that would be an indirection that breaks the moment a raw code
  is present (the normal case) and is a needless second source of truth.

> **Fixture note for the Engineer (do not be misled).** The repo's test fixtures
> disagree on this shape: `lib/checklistsTab.test.ts` uses `protocol: 'P22'` /
> `'P21'` (codes — CORRECT for real data), while `lib/parseEbirdObservations.test.ts`
> and `lib/birdingStats.test.ts` use `protocol: 'Traveling'` / `'Stationary'`
> (display strings — these pass only because unknown values fall through
> `protocolName`'s identity fallback; they are NOT what a real export contains).
> Write the new backlog tests with **`P##` codes** (`P20`, `P21`, `P22`), matching
> the shipped `Checklists.tsx` consumer and real MyEBirdData exports.

---

## 2. Module decomposition

Three new modules, one edit to `App.tsx`. No changes to existing lib files.

### 2a. Pure React-free core — `frontend/src/lib/weatherBacklog.ts`

Holds **all** predicate / ordering / pagination logic. No React, no I/O, no
`Date.now()`. This is the unit-test target (mirrors `lib/checklistsTab.ts`).

```ts
import type { ChecklistRowData } from './checklistsTab'
import type { ChecklistEntry } from '../types'

export const INCIDENTAL_PROTOCOL = 'P20' as const
export const PAGE_SIZE = 100

export interface BacklogOptions {
  /** FR-21: off = complete & non-incidental only; on = widen to include
   *  incomplete + incidental. Defaults to false. */
  includeWidened: boolean
}

export interface BacklogRow {
  row: ChecklistRowData
  /** Precomputed so the component needn't re-derive per render (FR-14). */
  isComplete: boolean       // allObsReported === true
  isIncidental: boolean     // protocol === 'P20'
  /** True when this row is present ONLY because the widen toggle is on
   *  (i.e. it is not complete, or it is incidental). Drives the FR-14 marker. */
  surfacedByWiden: boolean
}

export function isIncidental(c: ChecklistEntry): boolean {
  return c.protocol === INCIDENTAL_PROTOCOL
}

/** No recognized weather block (SnowRaven OR RainCrow). Reuses the precomputed
 *  flag — does NOT re-run any detector (FR-05, FR-06). */
export function hasNoWeatherBlock(r: ChecklistRowData): boolean {
  return !r.weatherBlock
}

/** Build the full ordered, filtered backlog (NOT yet paginated).
 *  Newest-first with a deterministic tiebreak (FR-09), one row per
 *  submission id (FR-10, already guaranteed by buildChecklistRows). */
export function computeBacklog(
  rows: ChecklistRowData[],
  opts: BacklogOptions,
): BacklogRow[]

/** Pure slice helper (FR-20). `shown` is the count currently revealed. */
export function pageBacklog(all: BacklogRow[], shown: number): {
  visible: BacklogRow[]
  total: number
  hasMore: boolean         // total > shown  → show "next 100" / "all"
  nextCount: number        // min(shown + PAGE_SIZE, total)
}
```

Ordering (inside `computeBacklog`, FR-09):

1. Filter: `hasNoWeatherBlock(r)` always; then
   - **off** (`!includeWidened`): keep only `isComplete && !isIncidental`.
   - **on**: keep all (the widen is a **superset** — FR-21; do not switch sets).
2. Sort **newest first** by `checklist.date` descending (`date` is `"YYYY-MM-DD"`,
   so a reverse `localeCompare` is correct and stable), tiebroken by
   `checklist.submissionId` descending (deterministic, repeatable across reloads
   — QA-08). `submissionId` is the "S…" id, monotonic-ish and always present as a
   map key, so it is a safe final tiebreak even when two checklists share a date.
   - Rationale for id (not `time`) as the tiebreak: `time` is nullable and
     format-y (`"HH:MM AM/PM"`); `submissionId` is always present and gives a
     total order. FR-09 only asks for _a_ stable deterministic tiebreak.

`isComplete = c.allObsReported === true`. A `null` `allObsReported` is **not**
complete (FR-08) → excluded from the default view, included when widened.

### 2b. Presentational component — `frontend/src/components/WeatherBacklog.tsx`

Mounted at the **bottom of the Weather tab**, after `<WeatherForecastPanel />`
(the Weather tab renders in `App.tsx` ~679–1021; the bottom currently holds
`<WeatherForecastPanel />` per the code map). It is a third bottom section.

**Recommendation: collapsed entry link that expands in place (not always-rendered).**

- Consistent with the PRD's "List checklists with no weather blocks" _entry point_
  wording (FR-01) and "Activating the entry point shall reveal/open the backlog
  list" (FR-02, QA-01/QA-02).
- Keeps the Weather tab's default weight unchanged and the single-checklist lookup
  visually primary (NFR-10 posture).
- Building the list is cheap and offline (FR-04), but deferring the _mount_ of the
  list rows until expanded is the right default for a section that can render up
  to `PAGE_SIZE` rows with three action controls each.

Toggle mechanics:

- A single `<button>` entry point ("List checklists with no weather blocks") with
  `aria-expanded` reflecting the open state (NFR-03). Session-only `useState`
  `expanded: boolean`, default `false`. No persistence (Out of Scope — session-only).
- When `expanded`, render the section: the widen toggle, the summary/empty states,
  the list, and the pagination controls.
- The **needs-a-backup** state (FR-03/FR-24) and **zero-match** state (FR-25) are
  shown _inside_ the expanded section, never as a broken/empty list.

Props (kept thin so the tab owns data-loading; see §4 on where the backup comes from):

```ts
interface WeatherBacklogProps {
  /** Already-loaded rows, or null when no backup is loaded (→ needs-data state). */
  rows: ChecklistRowData[] | null
  /** The tab's existing per-checklist lookup wrappers (see §3). */
  lookupWeather: (id: string) => Promise<string | null>
  lookupTideBody: (id: string) => Promise<string | null>
  /** Shared clipboard seam. */
  onCopy: (text: string) => Promise<boolean>
  /** Optional hotspot resolution (FR-15); omit → plain-text locations. */
  isHotspot?: (locId: string | null) => boolean
}
```

> The component receives **already-built `ChecklistRowData[]`** and the lookup
> wrappers as props — it does not call the transport or the backup loader itself.
> This keeps it presentational, keeps the transport reuse in one place, and makes
> the jsdom component test trivial to drive with mocked props.

### 2c. Per-row action sub-component / row model — inside `WeatherBacklog.tsx`

A `BacklogRow` sub-component (co-located, or a small `WeatherBacklogRow.tsx` if it
grows) owns **action #3's per-row state machine** (§3) via its own local `useState`.
Each mounted row has independent state (FR-27, QA-30). The two navigating actions
(#1 open checklist, #2 open comment/edit page) are stateless shared components
(`ChecklistLink`, `OutboundLink`).

---

## 3. Per-row action #3 state machine

**Action #3 = "copy weather, then open comments"** (FR-18/19/23/27).

### States (per row, independent)

| State | Meaning |
|---|---|
| `idle` | Nothing in flight. Button enabled (if the id is usable — see FR-26). |
| `looking-up` | `/weather/<id>` (and, when applicable, `/tide/<id>`) in flight. Button shows a spinner; **re-clicks are ignored while in this state** (guards double-open / double-fetch, FR-27). |
| `copying` | Lookup succeeded; writing to the clipboard via `copyText()`. |
| `success` | Copy succeeded → the comment/edit page was opened **exactly once** (FR-18c). Row shows a brief confirmation. |
| `error-offline` | Lookup failed, `classifyLiveError.kind === 'offline'`. Honest offline copy. **Page NOT opened** (FR-19/FR-23). |
| `error-no-key` | `kind === 'no-key'`. "add it in Settings" nudge. **Page NOT opened.** |
| `error-other` | `kind === 'error'`, or the clipboard copy returned `false`. Generic "lookup/copy failed." **Page NOT opened.** |
| `error-bad-id` | The submission id fails `SUBMISSION_ID_RE` and cannot be used for the lookup/open (FR-26). Report inline; do not open a dead page. |

### Transitions

```
idle ──click──▶ looking-up
looking-up ──weather OK──▶ copying
looking-up ──weather null/throws──▶ error-offline | error-no-key | error-other   (classifyLiveError.kind)
copying ──copyText()===true──▶ (window.open edit URL, once) ──▶ success
copying ──copyText()===false──▶ error-other
(any error / success) ──click──▶ looking-up   (re-invoke allowed; resets to a fresh attempt)
looking-up ──click──▶ (ignored)               (in-flight guard: no double fetch, no double open)
```

Invariants (map to FR-19/FR-27/QA-18/QA-30):

- The `window.open(editUrl)` call happens **only** on the `copying → success`
  edge, i.e. only after a successful copy. It is **never** reached from any error
  edge (FR-19).
- A single successful copy opens the page **exactly once**: the open is on the
  state-transition edge, not in a render/effect that could re-fire.
- The in-flight guard (`if (state === 'looking-up' || state === 'copying') return`
  at the top of the click handler) prevents a second concurrent invocation from
  double-fetching or double-opening, and guarantees a row can't get stuck: every
  path out of `looking-up`/`copying` lands in a terminal state.
- Each row's state is a **separate `useState`** in its own `BacklogRow` instance,
  so rows are fully independent (FR-27).

### Seams used by action #3

| Purpose | Seam / function | Source |
|---|---|---|
| Weather lookup | `lookupWeather(id)` → `/weather/<id>` via `transport.getReplayable` | prop; wraps the App path |
| Tide body (for combined copy) | `lookupTideBody(id)` → `/tide/<id>` via `transport.getReplayable`, returns `body` or null | prop; wraps the App path |
| Compose copy text | `buildCombined(weatherFormatted, tideBody)` | `lib/tideFormatter.ts:63` |
| Clipboard | `copyText(text)` → `Promise<boolean>` | `lib/clipboard.ts:16` (via `onCopy` prop) |
| Error classification | `classifyLiveError(err)` → `{ kind: 'offline'\|'no-key'\|'error' }` | `lib/offlineMessage.ts:24` |
| Open edit page | `window.open('https://ebird.org/edit/effort?subID=' + encodeURIComponent(id), '_blank', 'noopener,noreferrer')` | see §6 |
| Id guard | `SUBMISSION_ID_RE` (`/^S\d+$/`) | `components/speciesDetail/ui.tsx:50` |

> **Important reuse caveat — do NOT reuse App's `loadWeather`/`loadTide`
> directly.** App's `loadWeather(id)` / `loadTide(id, force)` (App.tsx ~450–489)
> set the **single-checklist section's** component state (`setState`,
> `setTideState`) as a side effect. Calling them from the backlog would corrupt
> the single-lookup UI (violates NFR-10). Instead, the tab passes the backlog
> **thin, state-free wrappers** that make the same `transport.getReplayable`
> calls but return the string/`body` (or null) without touching the single-lookup
> state. The transport call, the URL shape, `encodeURIComponent`, and the
> replay/offline behavior are identical to the App helpers — only the state
> side-effects are dropped. This satisfies "reuses the existing `/weather/<id>`
> transport path" (FR-18/NFR-07) while keeping the single lookup byte-behavior
> unchanged (NFR-10).

---

## 4. Copy content (OQ-3 — RESOLVED: weather-only)

> **DECISION (Stage 4, user): action #3 copies the WEATHER BLOCK ONLY — no tide.**
> The user chose weather-only over the initially-proposed combined default.
> Implementation: `buildBacklogCopyText` returns the weather block and does NOT
> fetch or append tide — omit the tide branch shown below (the one-line change
> this section was written to isolate). `lookupTideBody` is not needed for the
> copy; drop it from the action-#3 path unless a future combined variant is added.

Original default (SUPERSEDED by the decision above): combined weather+tide when
tide is available for the checklist, weather-only otherwise.

Keep the choice behind **one well-named function** so a switch to weather-only is a
one-line change (Designer-confirmable default):

```ts
// inside WeatherBacklog.tsx (or weatherBacklog.ts if pure enough)
async function buildBacklogCopyText(
  id: string,
  lookupWeather: (id: string) => Promise<string | null>,
  lookupTideBody: (id: string) => Promise<string | null>,
): Promise<string | null> {
  const weather = await lookupWeather(id)
  if (weather == null) return null            // lookup failed → caller shows error, no open
  const tideBody = await lookupTideBody(id)   // null when no tide / too-far / outside-US
  return tideBody ? buildCombined(weather, tideBody) : weather
}
```

- Tide is **best-effort and non-blocking to success**: a failed/absent tide never
  fails action #3 — it just yields the weather-only block (mirrors the Weather
  tab's own "combined if tide, else weather" behavior, NFR-10). Only the
  **weather** lookup failing produces an error state (FR-19).
- To flip to strictly weather-only (if the Designer decides so under OQ-3), delete
  the tide branch — a single-line change, no other code moves.

---

## 5. State & data flow

### Where the backup comes from

- The Weather tab does **not** currently hold `ChecklistRowData[]`. The backlog
  needs them. Reuse the tab-level pattern used elsewhere: on first expand (or on
  tab mount), obtain observations from the shared cache and build rows once:

  ```ts
  const res = await loadEbirdObservations()   // lib/observationsCache.ts:46 → { text, observations } | null
  const rows = res ? buildChecklistRows(res.observations, mediaMap /* may be null */) : null
  ```

  - `mediaMap` may be `null` — the backlog uses none of the ML-media flags, so
    pass `null` (or the tab's existing map if already loaded). Do **not** re-detect
    weather blocks; `buildChecklistRows` already precomputes `weatherBlock`
    (`checklistsTab.ts:67`, `= hasWeatherBlock(raw)`), which is exactly the FR-05
    predicate source (FR-06 — no second detector).
  - `res === null` (no backup loaded) → pass `rows = null` to the component →
    needs-a-backup state (FR-03/FR-24, QA-03).
- **Prefer reusing observations the tab already has in memory** if the Weather tab
  is later refactored to hold them; today, `loadEbirdObservations()` is itself the
  parse-once cache (NFR-01) so calling it is cheap and non-duplicating. Build
  `rows` **once**, memoized, and slice/paginate in pure helpers — never re-parse.

### Session state (all plain `useState`, no persistence — Out of Scope)

| State | Scope | Default | Notes |
|---|---|---|---|
| `expanded` | `WeatherBacklog` | `false` | entry-point open/close (FR-01/02). |
| `includeWidened` | `WeatherBacklog` | `false` | the widen toggle (FR-21). |
| `shown` | `WeatherBacklog` | `PAGE_SIZE` (100) | how many rows are revealed (FR-20a). |
| action-#3 state | each `BacklogRow` | `idle` | independent per row (FR-27). |

### Derivations (memoized, pure — NFR-08)

```ts
const backlog = useMemo(
  () => rows ? computeBacklog(rows, { includeWidened }) : [],
  [rows, includeWidened],
)
const page = useMemo(() => pageBacklog(backlog, shown), [backlog, shown])
```

- **Toggle resets pagination (FR-22, QA-24):** on `includeWidened` change, reset
  `shown` to `PAGE_SIZE`. Do this in the toggle's **event handler**
  (`setIncludeWidened(v => !v); setShown(PAGE_SIZE)`), not in an effect — so a
  stale offset can never mis-page the new set, and there's no render-time impurity.
- **"Show next 100"** → `setShown(s => Math.min(s + PAGE_SIZE, backlog.length))`.
  **"Show all"** → `setShown(backlog.length)`. Both in event handlers.
- **Render purity (NFR-08, QA-37):** no `Date.now()` / `new Date()` anywhere in
  render bodies or memos. Ordering uses only `date`/`submissionId` string compares
  (no "now"). Action #3 needs no timestamp; if any is ever needed, it lives in the
  click handler.

---

## 6. Reuse map (do not reinvent)

| Need | Use | Source |
|---|---|---|
| Backlog predicate flag (`weatherBlock`) | `buildChecklistRows(...).weatherBlock` | `lib/checklistsTab.ts` |
| Weather-block detector | `hasWeatherBlock` (already inside `buildChecklistRows`) | `lib/commentBlocks.ts` |
| Observations (parse-once) | `loadEbirdObservations()` | `lib/observationsCache.ts:46` |
| Per-checklist rows | `buildChecklistRows(observations, mediaMap)` | `lib/checklistsTab.ts:38` |
| Open checklist (#1) | `<ChecklistLink submissionId label />` (applies `SUBMISSION_ID_RE` + new-tab cue) | `components/ChecklistLink.tsx` |
| Open comment/edit page (#2) | `<OutboundLink href="https://ebird.org/edit/effort?subID=<id>" …>` with an accessible name describing it as the comment/edit page + "(opens in a new tab)" | `components/OutboundLink.tsx` |
| Edit/comment URL | `https://ebird.org/edit/effort?subID=<id>` (id `encodeURIComponent`-wrapped; the same destination App.tsx ~854 uses) | — |
| Copy weather (#3) | `copyText(text)` via `onCopy` prop | `lib/clipboard.ts:16` |
| Compose combined block | `buildCombined(weather, tideBody)` | `lib/tideFormatter.ts:63` |
| Error states | `classifyLiveError(err).kind` + `<OfflineMessage kind message />` | `lib/offlineMessage.ts`, `components/OfflineMessage.tsx` |
| Protocol label | `protocolName(c.protocol)` | `lib/checklistMeta.ts:20` |
| Date / duration / distance | `formatDate(date)`, `formatDuration(hrs)`, `formatDistance(km, unit)` | `lib/formatDate.ts`, `lib/checklistMeta.ts` |
| Location (hotspot) | `<HotspotLink … />` when `isHotspot` + `/^L\d+$/`; else plain text (FR-15) | `components/HotspotLink.tsx` |
| Id guard | `SUBMISSION_ID_RE` = `/^S\d+$/` | `components/speciesDetail/ui.tsx:50` |
| Layout | `.sr-action-row`, `.sr-action-row-stack`, `.sr-grid-auto`, `.sr-scroll-x`, `.sr-touch-target`, `.sr-min0` | `globals.css` |

**Where NOT to reinvent / cautions:**

- Do **not** write a second weather-block detector or re-run `hasWeatherBlock`
  per row — read the precomputed `weatherBlock` flag (FR-06).
- Do **not** call `navigator.clipboard` directly — only `copyText()` (NFR-06,
  CLAUDE.md clipboard seam).
- Do **not** call App's stateful `loadWeather`/`loadTide` — pass state-free
  wrappers (§3 caveat) so the single-lookup UI is untouched (NFR-10).
- Do **not** interpolate a raw id into any href without `SUBMISSION_ID_RE` +
  `encodeURIComponent` (FR-26, NFR-09). `ChecklistLink` already guards its own;
  guard action #2's `OutboundLink` href and action #3's `window.open` id yourself.
- `HotspotLink` on the Weather tab is a **may**, not a must (FR-15). The Weather
  tab is not the offline-only Calendar tab, so `HotspotLink` is _permitted_ — but
  if the backlog is built without hotspot resolution, render locations as plain
  text (never a styled 404 link). Simplest v1: plain text; wire `HotspotLink` only
  if the Designer asks for it.

---

## 7. Test surface

### Pure core — `frontend/src/lib/weatherBacklog.test.ts` (node env)

Covers the logic (no DOM):

- **Predicate (FR-05/06, QA-05):** `weatherBlock === true` rows excluded (both
  SnowRaven and RainCrow), `false` rows included. Drive via `ChecklistRowData`
  fixtures with `weatherBlock` set.
- **Default filter (FR-07, QA-06):** default view keeps only
  `allObsReported === true && protocol !== 'P20'`; an incomplete row and a `P20`
  row are both absent. **Use `P##` codes in fixtures** (see §1 fixture note).
- **Unknown-complete (FR-08, QA-07):** `allObsReported === null` absent by default,
  present when widened.
- **Ordering (FR-09, QA-08):** newest-first by date; two rows sharing a date order
  by `submissionId` deterministically and repeatably.
- **One row per id (FR-10, QA-09):** (guaranteed upstream; assert no dup ids.)
- **Widen is a superset (FR-21, QA-23):** on-set ⊇ off-set; incidental + incomplete
  added, nothing removed.
- **Pagination (FR-20, QA-19/20/21):** `pageBacklog` slices to `shown`; `hasMore`
  correct; `nextCount` caps at total; ≤100 → no more.
- **`surfacedByWiden`/`isIncidental`/`isComplete` flags** correct for FR-14.

### Component — `frontend/src/components/WeatherBacklog.test.tsx` (jsdom docblock)

Covers wiring/UI with mocked props:

- **Entry point + expand (QA-01/02):** entry button present at the bottom; toggling
  reveals the list; the single-lookup section (rendered by App, out of this
  component) is not affected.
- **Needs-backup (QA-03):** `rows === null` → explanatory state, no spinner.
- **Zero-match (QA-25/28):** `rows` present but empty backlog → filter-aware empty
  copy (names default vs. widened context).
- **Action #1/#2 (QA-14/15):** `ChecklistLink` target + `OutboundLink` edit-URL
  target + accessible names + new-tab cue.
- **Action #3 success (QA-16/17):** mock `lookupWeather`→string, `lookupTideBody`→
  body → `onCopy` receives `buildCombined(...)`; `window.open` (spied) called once
  with the edit URL. With no tide → `onCopy` receives weather-only.
- **Action #3 failure (QA-18/25/26/27):** mock `lookupWeather`→null with each
  `classifyLiveError` kind → correct per-row state; `window.open` **not** called.
- **Independence + no-double-open (QA-30):** two rows; one succeeds (opens once),
  the other errors; re-click on an in-flight row is a no-op.
- **Malformed id (QA-29):** id failing `SUBMISSION_ID_RE` → links/actions degrade
  to plain, non-navigating; action #3 reports rather than opening.
- **Toggle resets pagination (QA-24):** page to >100, toggle widen, assert `shown`
  is back to first 100 of the new set.
- **A11y (QA-31/32):** keyboard operability, `aria-expanded` on entry,
  `aria-pressed`/switch on the widen toggle, live-region announcements for
  loading/success/error and the empty/needs-backup states.

### Existing Weather-tab tests to keep green (NFR-10)

`WeatherTideSection.test.tsx`, `WeatherTidePanel.test.tsx`,
`WeatherForecastPanel.test.tsx` — must still pass unchanged; the single-lookup /
Current / Predict behavior is not modified.

> **jsdom chart note:** the backlog mounts no recharts charts, so the
> `afterAll(() => new Promise(r => setTimeout(r, 120)))` chart-teardown rule does
> **not** apply here. Follow the standard component-test setup otherwise.

---

## 8. FR / NFR coverage & residual risk

| Requirement area | Satisfied by |
|---|---|
| FR-01/02 Entry point + tab unchanged | §2b collapsed entry (`aria-expanded`); App mounts below `WeatherForecastPanel`; single-lookup untouched (NFR-10). |
| FR-03/24 Needs-backup | §2b/§5 `rows === null` → needs-data state. |
| FR-04 Offline build | §0/§5 built from cache, no network to build/filter/order/paginate. |
| FR-05/06 `!hasWeatherBlock` | §2a `hasNoWeatherBlock` reads precomputed `weatherBlock`. |
| FR-07 Default: complete + non-incidental | §1/§2a `allObsReported === true && protocol !== 'P20'`. |
| FR-08 Unknown-complete | §2a `null` → not complete → widen-only. |
| FR-09 Newest-first + tiebreak | §2a date desc, `submissionId` desc tiebreak. |
| FR-10 One row per checklist | upstream `buildChecklistRows`. |
| FR-11/NFR-08 No mutation / render purity | §5 memos pure; no `Date.now()` in render; toggles in handlers. |
| FR-12/13/14 Per-row fields + widen marker | §2c row model; `surfacedByWiden` flag; graceful omission via empty-string formatters. |
| FR-15 Location link gating | §6 `HotspotLink` (may) or plain text; never a 404 link. |
| FR-16/17 Actions #1/#2 | §6 `ChecklistLink` / `OutboundLink` + edit URL. |
| FR-18/19/23/27 Action #3 machine | §3 state machine; open only on success edge; per-row independent. |
| OQ-3 Copy content | §4 `buildBacklogCopyText` (combined-or-weather), one-line switchable. |
| FR-20a–d Pagination | §2a `pageBacklog` + §5 `shown`; "Show all" = reveal all. |
| FR-21/22 Widen toggle + reset | §5 superset filter; handler resets `shown`. |
| FR-25/26 Empty / malformed id | §7 empty state; §3 `error-bad-id`; id guard. |
| NFR-01 Perf | §5 parse-once cache, build-once memo, pure slice. |
| NFR-02 Offline | §0 list offline; only #3 networks (surfaced). |
| NFR-03 A11y | §7 keyboard, aria-expanded/pressed, live regions; shared components keep names. |
| NFR-04 Responsive | §6 `.sr-*` classes, `.sr-touch-target` on dense controls. |
| NFR-05 Tokens | reuse existing `--sr-*` tokens (surface/text/warning/accent); none new anticipated. |
| NFR-06 Clipboard seam | §3/§6 `copyText` only. |
| NFR-07 Transport/seams | §0/§3 existing `/weather` + `/tide` via `transport`; no new route. |
| NFR-09 Security | §6 `SUBMISSION_ID_RE` + `encodeURIComponent`; escaped renderers; no `dangerouslySetInnerHTML`. |
| NFR-10 No regression | §3 caveat: state-free wrappers, App helpers untouched. |
| NFR-11 Privacy | §0 no new provider/telemetry; `PRIVACY_POLICY.md` unchanged. |

### Residual risks / decisions for the Engineer & Designer

1. **"Show all" on a very large backlog (FR-20d / NFR-01 / QA-22).** Filtering,
   sorting, and slicing are all O(n) and cheap even on tens of thousands of
   checklists — the risk is purely **DOM cost of rendering thousands of rows at
   once**, each with three action controls. Recommended v1 posture: render exactly
   the sliced `page.visible` and let "Show all" set `shown = total`. If a large
   render is observed to jank, the bounded-but-complete strategy is
   **windowing/virtualization of the row list** (render only on-screen rows while
   `shown === total`), which still makes **every** match reachable (FR-20d). Do
   **not** cap the reachable set — cap the mounted DOM, not the data. Flag for QA
   to test at "thousands of matches."

2. **OQ-3 copy content is a documented default, Designer-confirmable.** §4 isolates
   it to one function so weather-only is a one-line flip.

3. **OQ-2 (per-row field set + widen marker) is the Designer's.** The core exposes
   `isComplete` / `isIncidental` / `surfacedByWiden` so the component can render
   whatever affordance the Designer specifies without touching the pure logic.

4. **`HotspotLink` on this tab is optional (FR-15 "may").** Simplest correct v1 is
   plain-text locations; wire `HotspotLink` + `useHotspotSet()` only if the
   Designer wants linked hotspots (it adds a region-scoped fetch, which is fine on
   the Weather tab — unlike the offline-only Calendar tab).
