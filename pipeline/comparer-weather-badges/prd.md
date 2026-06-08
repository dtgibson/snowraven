# PRD — Comparer Weather + Badges

**Feature:** comparer-weather-badges
**Date:** 2026-06-08
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

Enrich the Checklist Comparer's **Checklists** mode (`ChecklistComparer.tsx`,
comparing two individual eBird checklists by ID/URL) with two additions: (1)
at-a-glance **badges** on each checklist's info card — media types present,
breeding codes reported, and separate "weather block" and "tide block" markers
for the comment — and (2) a **fresh weather + tide lookup per checklist, shown
side by side** at the bottom of the comparison, with per-side **Copy** buttons
(no auto-copy) and an honest revision note whenever a fresh lookup coexists with
an embedded weather block. Badges run on data already parsed client-side; the
weather/tide section reuses the existing `/weather/{id}` + `/tide/{id}` transport
path and degrades to a Settings nudge when keys are absent.

---

## User Stories

> **US-01** — As a birder comparing two of my checklists, I want each checklist's
> card to show which media types (photo / audio / video) were reported across its
> species, so I can see at a glance which outing was better documented without
> scanning every row.

> **US-02** — As a birder, I want each checklist's card to show whether any
> breeding codes were reported, so I can tell which list carries breeding
> evidence at a glance.

> **US-03** — As a SnowRaven user, I want separate markers on a checklist's card
> when its comment already contains a weather block and/or a tide block, so I can
> tell at a glance whether that checklist already has weather and/or tide pasted in.

> **US-04** — As a birder comparing two outings, I want to pull a fresh weather
> and tide lookup for each checklist and see them side by side, so I can compare
> the conditions of the two outings in one place.

> **US-05** — As a SnowRaven user whose checklist already has an embedded weather
> block, I want to be told that OpenWeather revises historical data over time, so
> I understand why a fresh lookup might not match the numbers already in my
> comment.

> **US-06** — As a user who hasn't added my API keys yet, I want the comparison
> (species, counts, media, breeding, comments, and the badges) to keep working,
> with a clear nudge to add keys in Settings only where the weather/tide section
> would be, so a missing key never breaks the tool.

> **US-07** — As a birder, I want to copy a side's fresh weather and/or tide (or
> both together), but only when I choose to — nothing should land on my clipboard
> just because I loaded the conditions.

---

## Functional Requirements

### Area A — Per-checklist badges (on the info card)

The info card is the `ChecklistTag` component (one per checklist, badged **A**
and **B**) rendered at the top of the results view. Badges render in the results
state only, beneath the existing effort-metadata strip (`type · distance ·
duration · observers · app`) and the **Notes** disclosure. Data sources are the
already-fetched `ChecklistData` for that checklist (`result.metaA` / `metaB`
plus the per-species rows) — **no new network calls** for badges.

> **FR-01** — In Checklists mode, the app shall render a badge row on each
> checklist's info card (`ChecklistTag`) summarizing that checklist's media,
> breeding, and embedded weather/tide state. The badge row shall appear only in
> the results state, after a successful two-checklist fetch.

> **FR-02 — Media badges:** The app shall show a Photo badge, an Audio badge,
> and a Video badge for the checklist when **any** species on that checklist
> reported that media type. Presence is derived by OR-ing `media.photo`,
> `media.audio`, `media.video` (> 0) across all species of that checklist
> (`ChecklistData.species[].media`, the same `MediaPresence` shape already used
> per-row by `MediaIcons`). Icons shall reuse the existing lucide icons already
> imported in `ChecklistComparer`: `Camera` (photo), `Mic` (audio), `Video`
> (video).

> **FR-03 — Media badge states:** For each of the three media types, the badge
> shall render in a **present** visual state when that type appears on the
> checklist and an **absent** (muted/dimmed) state when it does not. A media type
> shall never be hidden — all three are always shown so A and B align column-for-
> column. The badge's accessible label and `title` shall state the type and
> whether it is present (e.g. "Photos reported" / "No photos reported").

> **FR-04 — Breeding badge:** The app shall show a single breeding-codes
> indicator on the card, in a **present** state when **any** species on the
> checklist has a non-empty `breedingCode`, and an **absent** state otherwise.
> The badge shall reuse the `Dna` lucide icon (the same icon used for the
> Breeding Codes tab). The badge shall not enumerate which codes — presence only
> (per the brief). Its `title`/aria-label shall read "Breeding codes reported" /
> "No breeding codes reported".

> **FR-05 — Weather-info & tide-info badges (separate):** The app shall show TWO
> separate comment-content badges on the card. A **weather-info** badge renders in
> a **present** state when the checklist-level comment (`meta.comments`) is
> detected as containing a SnowRaven/raincrow **weather** block (per FR-06a), and
> an **absent** state otherwise; it uses a weather-appropriate lucide icon (e.g.
> `CloudSun`), with `title`/aria-label "Weather block in comment" / "No weather
> block in comment". A **tide-info** badge renders **present** when the comment is
> detected as containing a SnowRaven **tide** block (per FR-06b), absent otherwise;
> it uses a tide/water lucide icon (e.g. `Waves`), with `title`/aria-label "Tide
> block in comment" / "No tide block in comment". A comment may match **neither,
> either, or both** — the Weather tab's "Copy Weather and Tide Together" pastes both,
> so the two markers are independent.

> **FR-06 — Detection heuristics (weather + tide, separate):** Detection shall run
> on the **decoded** checklist comment (decoded via the existing `decodeEntities()`
> from `lib/commentText.ts`, since eBird returns comments HTML-entity-encoded). A
> new pure, unit-tested module (recommended `lib/commentBlocks.ts`) shall export
> `hasWeatherBlock(rawComment: string): boolean` and
> `hasTideBlock(rawComment: string): boolean`.
> - **FR-06a — Weather:** positive when the decoded comment contains **at least two**
>   of the labeled lines `formatWeatherBody()` emits (case-insensitive substrings):
>   `Temperature:`, `Wind:`, `Wind Direction:`, `Cloud Cover:`, `Dew point:`,
>   `Humidity:`, `Sunrise:`, `Sunset:` — **OR** the SnowRaven attribution text
>   (`Weather generated by` / the string `SnowRaven` / `github.com/dtgibson/snowraven`).
>   Markers are taken directly from `formatWeatherBody()` / `ATTRIBUTION` in
>   `lib/weatherFormatter.ts`, the exact block SnowRaven pastes (which raincrow.app's
>   format mirrors).
> - **FR-06b — Tide:** positive when the decoded comment contains the tide block's
>   distinctive markers emitted by `formatters/tide.py` / `lib/tideFormatter.ts` —
>   e.g. `Water level:` and/or `Relative to MLLW`, together with a `Tide:` or
>   `Station:` line. The Engineer shall confirm the exact marker set against the tide
>   formatter so detection matches what SnowRaven actually pastes (and tolerates the
>   "Copy Weather and Tide Together" combined block, which contains both signatures).
>
> Both detectors shall be pure functions with vitest tests (NFR-07).

> **FR-07 — Badge layout & theming:** Badges shall use only `var(--sr-*)` CSS
> custom properties (no hardcoded hex), follow the existing pill/icon styling in
> `ChecklistComparer` (see `BreedingBadge` and `MediaIcons` for sizing
> precedent), and present/absent states shall be distinguishable by more than
> color alone (e.g. muted opacity + a tooltip/aria-label difference) to satisfy
> accessibility.

> **FR-08 — Badges are key-independent:** The badge row shall render regardless
> of whether the eBird/OpenWeather keys are present. (The two checklists were
> already fetched with the eBird key to reach the results state; the badge data
> is entirely client-side from that response.)

### Area B — Weather + tide section (bottom, side by side)

> **FR-09 — Placement & layout:** Below the existing **Comments** table, the app
> shall render a "Weather & Tide" section spanning the comparison width, with two
> columns: Checklist A on the left, Checklist B on the right, each headed by the
> same A/B badge + location/date/ID identity already shown by `ChecklistTag`. At
> the existing two-column breakpoint behavior used elsewhere in the comparer, the
> two sides shall stack vertically on narrow viewports.

> **FR-10 — Reuse the existing lookup path:** Each side shall fetch weather and
> tide through the transport seam exactly as the Weather tab does:
> `transport.get('/weather/{id}')` and `transport.get('/tide/{id}')`. The same
> call works on web (Python backend) and desktop (`TauriTransport` routes
> `/weather/` and `/tide/` to the TS services). The section shall reuse the
> response contracts already defined: weather returns
> `{ formatted, checklist_id, loc_name, obs_dt }`; tide returns
> `{ status: 'ok' | 'too-far' | 'outside-us' | 'unavailable', formatted?, body?,
> station?, distanceMi? }`. **No new endpoints, formatters, or backend changes
> shall be introduced.** The section shall render the `formatted` weather text
> and the `formatted` tide text (the same human-readable blocks the Weather tab
> shows), in a monospace presentation consistent with the Weather tab.

> **FR-11 — Two checklists → two lookups:** On the user action that loads
> conditions, the app shall fetch weather + tide for **both** checklist IDs (the
> `idA` / `idB` already held in `ChecklistComparer` state). The two sides are
> independent: each side owns its own loading / success / error state so one
> side's failure never blocks or blanks the other.

> **FR-12 — Explicit user action, not auto-fetch:** The weather/tide lookups
> shall be triggered by an explicit user action (a "Load weather & tide" button
> in the section), **not** automatically when the comparison renders.
> *Justification:* a comparison is four extra third-party API calls (2
> checklists × weather + tide, where weather itself fans out per checklist hour);
> auto-firing them on every comparison spends the user's rate-limited OpenWeather
> "One Call by Call" quota whether or not they care about conditions, and the
> brief explicitly bounds these as "on user action only." After the first load
> for a given comparison, the resolved results shall remain visible until a new
> comparison is started.

> **FR-13 — Per-side loading state:** While a side is loading, that column shall
> show a loading indicator (reuse the `Loader2` spinner pattern already in the
> component) labeled for that checklist. The two sides may load concurrently
> (`Promise.all`-style) but render their states independently.

> **FR-14 — Per-side weather error state:** If a side's weather lookup fails
> (network error, 404 not found, 502 upstream, timeout), that column shall show
> an inline, non-blocking error message scoped to that side, surfacing the
> backend/service `detail` when available (the same `TransportError.detail`
> handling already used in `handleCompare`). The other side and the tide of the
> same side shall be unaffected.

> **FR-15 — Per-side tide states:** Each side shall render the tide outcome by
> `status`: `ok` → the formatted tide block; `too-far` / `outside-us` → a short
> notice naming the nearest station and distance (mirroring the Weather tab's
> notice copy), with the same one-tap override the Weather tab offers (per OQ-2);
> `unavailable` → a brief "No tide reading available" line; an outright fetch
> error → a brief per-side tide error line. Tide failure shall never affect that
> side's weather, nor the other side.

> **FR-15.1 — Copy buttons, no auto-copy:** Once a side's conditions have loaded,
> that side shall offer copy affordances — **Copy weather**, **Copy tide**, and
> **Copy weather & tide together** (mirroring the Weather tab's combined copy) —
> all via the `copyText()` clipboard seam (`lib/clipboard.ts`), never a direct
> `navigator.clipboard` call. **Nothing in this section writes to the clipboard
> automatically.** Unlike the Weather tab (which auto-copies on a successful
> lookup), the comparer's "Load weather & tide" action shall NOT touch the
> clipboard; copying happens only on an explicit button press. A transient
> "Copied" confirmation may be shown on press. The combined copy shall carry a
> single SnowRaven attribution, matching the Weather tab's "Copy Weather and Tide
> Together" output. Copy buttons appear only for content that loaded (e.g. no
> "Copy tide" when that side's tide is `unavailable`).

### Area C — Reconciliation note (always-note)

> **FR-16 — Always-note trigger:** For a given side, whenever **both** (a) a
> fresh weather lookup resolved successfully for that checklist **and** (b) that
> checklist's comment was detected as containing an embedded weather block
> (FR-06a result is true for that side), the app shall display a reconciliation
> note attached to that side's weather result. (The note is weather-specific; the
> tide-info badge does not trigger a reconciliation note in v1, since NOAA
> predicted tides are not revised the way OpenWeather history is.)

> **FR-17 — No value diff:** The app shall **not** compare or diff individual
> weather values between the embedded block and the fresh lookup (explicit v1
> non-goal). The note is informational text only.

> **FR-18 — Note copy:** The reconciliation note shall communicate that
> OpenWeather revises historical data over time and that SnowRaven shows what the
> API currently returns, so a fresh lookup may differ from a weather block already
> in the comment. Suggested copy (final wording open to The Architect/Engineer):
> *"This checklist's comment already includes a weather block. OpenWeather revises
> its historical data over time, so this fresh lookup may differ from what's in
> the comment — SnowRaven shows what the API returns now."* The note shall use a
> muted/info visual treatment (not an error), styled with `var(--sr-*)` tokens.

### Area D — Graceful degradation

> **FR-19 — Keys absent → nudge, badges intact:** When the required API keys are
> not configured, the **badges and the entire species comparison shall continue
> to work**, and only the Weather & Tide section shall be replaced by an "add
> your API keys in Settings" nudge with a link/button that navigates to the
> Settings tab. Required keys for this section: **eBird** (needed to resolve both
> checklists for both weather and tide) **and OpenWeather** (needed for weather).
> Tide's NOAA source is keyless but still needs eBird. The nudge shall name which
> key(s) are missing, consistent with the Weather tab's existing key-notice copy
> (App.tsx already renders separate eBird / OpenWeather notices).

> **FR-20 — Key-status plumbing:** The comparer currently does not receive key
> status or a "go to Settings" navigation callback. To satisfy FR-19, the app
> shall pass the existing `keyStatus` (`{ ebird, openweather }`, already fetched
> on mount in `App.tsx`) and a `onGoToSettings` callback (the same
> `() => setActiveTab('settings')` used by other tabs) down through
> `<ListComparer …>` (App.tsx ~line 889) into `ChecklistComparer`. This is a
> props-plumbing change; the architecture of key fetching is unchanged. *(If the
> Architect prefers the section to attempt the lookup and treat the resulting
> `500 "API key not configured"` error as the nudge trigger instead of gating on
> `keyStatus` up front, that is an acceptable alternative — see Open Questions
> OQ-1.)*

> **FR-21 — Partial resolution:** When one checklist's lookup succeeds and the
> other fails (e.g. one ID is unresolvable, one upstream call errors), the app
> shall show the resolved side's weather/tide normally and the failed side's
> error state, side by side (per FR-11 / FR-14). A failure on one side shall not
> remove or block the other side's content.

> **FR-22 — Comparer keeps working without keys:** Reaching the Checklists-mode
> results state already requires the eBird key (the `/checklists/{id}` fetch).
> The badges and comparison therefore always have data once results render; the
> only key-gated surface added by this feature is Area B (and OpenWeather is only
> required there). No existing comparer behavior shall regress when keys are
> absent or partially present.

---

## Non-Functional Requirements

> **NFR-01 — Performance / quota:** The feature shall add **zero** network calls
> to the badge path and shall add the four weather/tide calls only on explicit
> user action (FR-12). Existing per-call timeouts in the desktop service layer
> (`lib/tauri/http.ts`) apply unchanged; no new long-hanging calls shall be
> introduced.

> **NFR-02 — No backend changes:** The feature shall be frontend-only. It shall
> reuse `/weather/{id}`, `/tide/{id}`, and the existing `/checklists/{id}`
> response (which already includes `media`, `breedingCode`, `comments`,
> `submissionMethod`, effort fields). No router, formatter, or service file in
> `backend/` shall be modified.

> **NFR-03 — Theming:** All new UI shall use `var(--sr-*)` tokens only (no
> hardcoded hex/RGB), per the project color convention, and shall render
> correctly in both light and dark themes.

> **NFR-04 — Accessibility:** Badges shall convey present/absent by more than
> color (icon + opacity + `title`/aria-label). Interactive elements (Load button,
> Copy buttons, Settings link, any tide override) shall be keyboard-focusable with
> visible focus, consistent with the existing `tabIndex={0}` buttons in the
> component. Loading and error regions shall use appropriate `role`/`aria-live`
> consistent with the component's existing `role="alert"` / `role="status"` usage.

> **NFR-05 — Comment-safety:** Weather/tide-block detection shall operate on
> decoded text via `decodeEntities()` and shall not introduce any `innerHTML` /
> `dangerouslySetInnerHTML`. Any comment text rendered in the new UI shall reuse
> the existing safe `CommentText` renderer. (Standing project security check on
> comment rendering.)

> **NFR-06 — Dual runtime:** The weather/tide section (lookups AND copy) shall
> behave identically on web (Python backend) and desktop (Tauri TS services) by
> going through the `transport` and `copyText()` seams — no direct `fetch`, no
> `navigator.clipboard`, no `isTauri()` branching in the new UI.

> **NFR-07 — Test coverage:** The detection heuristics (weather + tide) and any
> new pure helpers (media/breeding presence reducers) shall ship with vitest unit
> tests, matching the project's testing convention (`compareChecklists.test.ts`,
> `checklistMeta.test.ts`, `commentText.test.ts` are the precedents).

---

## Out of Scope

From the strategic brief, and confirmed during PRD writing:

- **Editing or auto-fixing** the comment's weather block (no write-back to eBird).
- **Value-by-value weather diffing** between the embedded block and the fresh
  lookup (the reconciliation is an always-note only).
- **A tide reconciliation note** — only weather gets the revision note (FR-16).
- **Weather charts / graphs / history visualizations.**
- **More than two checklists** in one comparison.
- **The Life Lists (CSV) mode** of the comparer — this feature touches the
  **Checklists** mode only (`ChecklistComparer`, not `ResultsView`).
- **New backend endpoints, formatters, or services** — the feature is frontend
  reuse of existing contracts.
- **Auto-copying to the clipboard on load** — copy buttons ARE included (FR-15.1),
  but unlike the Weather tab the comparer never writes to the clipboard
  automatically; copying is always an explicit button press.
- **Persisting** the loaded weather/tide across a "New comparison" reset or app
  relaunch.

---

## Open Questions

> **OQ-1 — Nudge gating mechanism.** FR-19/FR-20 gate the Weather & Tide section
> on the up-front `keyStatus` passed from `App.tsx`. The alternative is to render
> the Load button always, attempt the lookup, and convert the resulting
> `500 "API key not configured"` into the nudge. **Default if undecided:** pass
> `keyStatus` + `onGoToSettings` down (FR-20) and gate up front — it avoids a
> wasted round-trip and matches the Weather tab's existing pattern. Architect to
> confirm.

> **OQ-2 — Tide too-far / outside-US override. RESOLVED (user):** Include the same
> per-side one-tap override the Weather tab offers (carried into FR-15) for
> consistency.

> **OQ-3 — Copy affordances. RESOLVED (user):** Include copy buttons on each side —
> Copy weather, Copy tide, and Copy weather & tide together — via the `copyText()`
> seam. **Nothing auto-copies on load** (the deliberate difference from the Weather
> tab). See FR-15.1.

> **OQ-4 — Exact icons for the comment badges.** `CloudSun` (weather-info) and
> `Waves` (tide-info) are suggested (lucide, distinct from each other and the tab's
> own cloud icon). **Default if undecided:** `CloudSun` + `Waves`. Cosmetic;
> Engineer's discretion.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Media badges reflect checklist content (FR-02/03) | For a checklist where ≥1 species has a photo, the A card shows the Photo badge in its present state; for a type with no media on that checklist, that badge shows the absent (muted) state. All three media badges are always present on both cards. |
| QA-02 | Breeding badge presence (FR-04) | For a checklist with ≥1 species carrying a `breedingCode`, the breeding badge renders present; for a checklist with no breeding codes, it renders absent. |
| QA-03 | Block detection — positive (FR-05/06) | A checklist whose comment contains a pasted SnowRaven weather block shows the **weather-info** badge present; one whose comment contains a tide block (`Water level:` / `Relative to MLLW`) shows the **tide-info** badge present; a comment with the combined weather+tide block shows **both** present. |
| QA-04 | Block detection — negative & independent (FR-05/06) | An empty or ordinary-prose comment shows both the weather-info and tide-info badges absent. A weather-only comment shows weather-info present + tide-info absent (and vice-versa). Detection runs on decoded text (an entity-encoded block is still detected). |
| QA-05 | Badges are key-independent (FR-08) | With OpenWeather key removed (but eBird present so the comparison loads), all badges still render correctly on both cards. |
| QA-06 | Weather/tide section placement & layout (FR-09) | After a comparison, a "Weather & Tide" section appears below the Comments table with A on the left and B on the right; on a narrow viewport the two stack. |
| QA-07 | Explicit-action lookup (FR-12) | The weather/tide section does not fire any `/weather` or `/tide` call until the user clicks the Load button; clicking it fetches for both A and B. |
| QA-08 | Reused contract / dual runtime (FR-10/NFR-06) | On both web and desktop, the loaded section shows the same formatted weather block and tide block the Weather tab produces for the same checklist ID, with no new endpoint introduced. |
| QA-09 | Per-side independence (FR-11/FR-13/FR-14) | When checklist B's weather fetch is made to fail (e.g. invalid/unresolvable B), A's weather + tide still render fully and B shows a scoped error; the section is not blanked. |
| QA-10 | Tide states (FR-15) | A US coastal checklist shows an `ok` tide block; a non-coastal/outside-US checklist shows the appropriate too-far/outside-US/unavailable notice on that side only, with the one-tap override, without affecting weather. |
| QA-11 | Always-note appears when both exist (FR-16) | For a side whose comment contains a weather block AND whose fresh weather lookup succeeds, the reconciliation note (revision wording) is shown attached to that side. |
| QA-12 | Always-note absent otherwise (FR-16/17) | For a side with a successful fresh lookup but NO embedded weather block (or with a block but a failed lookup), the reconciliation note is not shown. A tide block alone does not trigger it. No value-by-value diff appears anywhere. |
| QA-13 | Keys-absent nudge, comparison intact (FR-19/FR-22) | With OpenWeather (or eBird) key absent, the species comparison and all badges still render; the Weather & Tide area shows a nudge naming the missing key(s) with a working link to Settings — and no weather/tide call is attempted (per the chosen OQ-1 default) or the 500 is shown as the nudge (alt). |
| QA-14 | Settings navigation (FR-20) | Clicking the nudge's Settings link switches the app to the Settings tab. |
| QA-15 | Invalid/unresolvable checklist in the section (FR-21) | When one checklist ID resolves and the other does not at lookup time, the resolved side shows weather/tide and the unresolved side shows its error, side by side. |
| QA-16 | No backend change / theming / a11y (NFR-02/03/04) | `git diff` touches no file under `backend/`; all new UI uses `var(--sr-*)` tokens and renders in dark mode; badges convey state without relying on color alone; new interactive controls are keyboard-focusable. |
| QA-17 | Detection unit tests (NFR-07) | `hasWeatherBlock` and `hasTideBlock` (and any presence reducers) have passing vitest tests: weather block present, tide block present, combined weather+tide block (both true), entity-encoded block, plain prose, empty comment. |
| QA-18 | Copy buttons, no auto-copy (FR-15.1) | Loading a side's weather & tide writes **nothing** to the clipboard. After load, Copy weather / Copy tide / Copy weather & tide together appear and copy the corresponding block(s) via `copyText()` only when clicked; the combined copy carries a single SnowRaven attribution. |

---

*Note: This PRD governs where it expands the strategic brief. No conflicts with
the brief were found — the brief's locked decisions (always-note, include tides,
graceful degradation) are carried through verbatim in FR-12/FR-15/FR-16 and
FR-19. The two user revisions (include copy buttons with no auto-copy; separate
weather-info and tide-info badges) are reflected in FR-05/FR-06/FR-15.1, US-03,
US-07, OQ-3, and QA-03/04/17/18.*
