# PRD — Weather Backlog
**Feature:** weather-backlog
**Date:** 2026-07-06
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
A "checklists with no weather block" backlog reached from the bottom of the Weather tab. It lists the user's 100 most-recent complete, non-incidental checklists whose comment carries no recognized SnowRaven/RainCrow weather block — newest first — built entirely from the already-loaded eBird backup. Each row offers three actions: open the checklist on eBird, open the checklist's comment/edit page on eBird, and copy that checklist's weather to the clipboard and (on a successful lookup) open the comment page ready to paste. Pagination pages in 100s; a toggle widens the list to also include incomplete and incidental checklists. It turns the app's original one-at-a-time weather lookup into a "work down my missing-weather backlog" workflow, and leaves the existing single-checklist Weather lookup on the same tab unchanged.

## User Stories

> **US-01** — As a birder with years of eBird checklists, I want a list of my recent checklists that still have no weather block, so that I can see my missing-weather backlog instead of trying to remember which checklists I skipped.

> **US-02** — As a birder working the backlog, I want each row to show enough at-a-glance information (date, location, size, protocol, completeness), so that I can recognize the checklist without opening it.

> **US-03** — As a birder, I want to open any listed checklist on eBird in one click, so that I can review it in context.

> **US-04** — As a birder, I want to jump straight to a checklist's comment/edit page on eBird, so that I can paste weather into it.

> **US-05** — As a birder, I want one action that copies a checklist's weather to my clipboard and lands me on its eBird comment page, so that I can paste immediately without a second lookup step.

> **US-06** — As a birder, I want the list to page in 100s ("Show next 100", "Show all"), so that a long backlog stays fast and I can still reach every checklist.

> **US-07** — As a birder, I want a toggle that also includes my incomplete and incidental checklists, so that I can decide whether to work only my "real" complete outings or my entire backlog.

> **US-08** — As a birder who is sometimes offline or hasn't set up an API key, I want the list to still build and a failed weather lookup to be reported clearly, so that I always understand what happened and never land on an edit page with nothing useful on my clipboard.

## Functional Requirements

### Entry point

> **FR-01** — The Weather tab shall render a "List checklists with no weather blocks" entry point at the bottom of the tab, below the existing single-checklist lookup and the Current/Predict controls.

> **FR-02** — Activating the entry point shall reveal/open the backlog list on the Weather tab. The existing single-checklist Weather lookup, Current, and Predict controls shall remain present and unchanged in behavior.

> **FR-03** — When no eBird backup is loaded, the entry point shall communicate that the backlog needs a loaded eBird backup and shall not present an empty or broken list (see FR-24).

### List building & filtering

> **FR-04** — The backlog shall be computed entirely from the already-loaded eBird backup, with no network call required to build, filter, order, or paginate the list.

> **FR-05** — A checklist shall qualify for the backlog when its checklist comment contains **no recognized weather block** — i.e. `hasWeatherBlock` (the shipped detector in `lib/commentBlocks.ts`, which recognizes both SnowRaven and RainCrow weather blocks) is false for that comment. A checklist carrying any recognized weather block shall be excluded (it is considered "handled"). See Open Questions OQ-1 (resolved).

> **FR-06** — The backlog shall reuse the shipped `hasWeatherBlock` detector; it shall not introduce a second or divergent weather-block detector.

> **FR-07** — In the default view, the backlog shall include only checklists that are **complete** (eBird "All observations reported" — `allObsReported === true`) **and non-incidental** (protocol is not Incidental, eBird `P20`).

> **FR-08** — A checklist whose complete flag is unknown or absent (`allObsReported` is null) shall be treated as not-complete and shall appear only when the include-incomplete toggle is on (FR-20).

> **FR-09** — The backlog shall be ordered newest first (by checklist date, descending). A stable, deterministic tiebreaker (e.g. submission id) shall order checklists sharing the same date so ordering and pagination are repeatable.

> **FR-10** — The backlog shall include at most one row per checklist (one row per submission id).

> **FR-11** — List building shall not mutate, re-order, or otherwise affect the data used by any other tab, and shall not read `Date.now()`/`new Date()` in a render body or memo (NFR-08).

### Per-row information

> **FR-12** — Each row shall display, at minimum, the checklist's date and location, so the user can identify it. (Exact scannable field set: OQ-2, default below.)

> **FR-13** — The default per-row field set shall be: date, location, species count, protocol name (via `protocolName`, e.g. "Traveling"/"Stationary"), and a completeness indicator. Fields whose source value is absent shall be omitted gracefully (no "null"/"undefined" text, no empty labels).

> **FR-14** — When the include-incomplete toggle is on (FR-20), each row shall make it visually distinguishable whether the checklist is complete/non-incidental or was surfaced only by the wider filter (e.g. an "incomplete" or "incidental" indicator), so a widened list is not ambiguous. (Exact affordance: OQ-2.)

> **FR-15** — A location name that is a public eBird hotspot may render through the shared `HotspotLink` (per the app-wide convention) provided its `isHotspot`/id gating is satisfied; a personal location, junk id, or unresolved hotspot Set shall render as plain text. If the row is built with no hotspot resolution, the location shall render as plain text — never a styled 404 link. (This is a may, not a must; the Weather tab is not the offline-only Calendar tab, so `HotspotLink` is permitted here.)

### Per-row actions

> **FR-16** — Each row shall offer an "open the checklist on eBird" action that opens `https://ebird.org/checklist/<submissionId>` in a new tab, rendered through the shared `ChecklistLink` component (which applies the `SUBMISSION_ID_RE` id-shape guard and the "(opens in a new tab)" cue).

> **FR-17** — Each row shall offer an "open the checklist's comment/edit page on eBird" action that opens the checklist's eBird edit/comment destination — the same destination the app already uses on the Weather tab, `https://ebird.org/edit/effort?subID=<submissionId>` — in a new tab, through the shared `OutboundLink` (or an equivalent shared external-link affordance) with an accessible name that describes it as the checklist's comment/edit page and includes the "(opens in a new tab)" cue.

> **FR-18** — Each row shall offer a "copy weather, then open comments" action that (a) performs the same per-checklist weather lookup the Weather tab uses (the existing `/weather/<id>` transport path), (b) on a **successful** lookup copies the resulting block to the clipboard via the `copyText()` seam, and (c) on a successful copy opens the checklist's comment/edit page (the FR-17 destination) in a new tab so the user can paste. Action #3's copy content default is the combined weather+tide block when tide is available for that checklist and weather-only otherwise, mirroring the Weather tab's "Copy Weather and Tide Together" via the existing formatters (`buildCombined`); see OQ-3.

> **FR-19** — Action #3 shall NOT open the comment/edit page when the weather lookup fails or when the clipboard copy fails; instead it shall surface the failure on that row (FR-22). The user shall never be sent to the eBird edit page without the intended block on their clipboard.

### Pagination

> **FR-20a** — The backlog shall show at most the first 100 matching checklists initially.

> **FR-20b** — When more than 100 checklists match, the list shall offer a "Show next 100" action that appends the next 100 matching checklists (preserving already-shown rows and order), and a "Show all" action that reveals every remaining matching checklist.

> **FR-20c** — When 100 or fewer checklists match, no "Show next 100"/"Show all" controls shall be shown (or they shall be inert), and the list shall show all matches.

> **FR-20d** — "Show all" on a very large backlog shall remain responsive and shall not freeze the tab; if a large render must be bounded, it shall still make every matching checklist reachable (see NFR-01).

### Include-incomplete / incidental toggle

> **FR-21** — The backlog shall provide a toggle, defaulting to **off**, whose off state lists only complete, non-incidental checklists (FR-07) and whose on state **widens** the list to also include incomplete checklists and incidental (`P20`) checklists. The toggle widens the set; it does not switch to a different set.

> **FR-22** — Toggling shall re-evaluate the matching set and reset pagination to the first 100 of the new set (so a stale "Show next 100" offset from the previous set cannot mis-page), keeping newest-first order (FR-09).

### Error, empty & edge states

> **FR-23** — When action #3's weather lookup fails, the row shall show a clear, distinct per-row state for each cause: **offline** (no connection / local server not running), **missing or invalid API key** (eBird and/or OpenWeather), and **other lookup error** — derived from the shipped `classifyLiveError` kinds (`offline` / `no-key` / `error`). The missing-key state shall point the user toward Settings.

> **FR-24** — When no eBird backup is loaded, the backlog shall show an explanatory empty/needs-data state (not a blank list and not a spinner that never resolves).

> **FR-25** — When a backup is loaded but zero checklists match the current filter (including the case where every recent checklist already has a weather block), the backlog shall show a clear "no matching checklists" empty state that names the active filter context (e.g. "no complete checklists are missing weather" vs. the widened set), rather than an empty list.

> **FR-26** — A checklist whose submission id is malformed or absent (fails `SUBMISSION_ID_RE`) shall still be listed with its available info, but its eBird checklist link, comment/edit link, and the "open comments" step of action #3 shall degrade to plain, non-navigating affordances (never a styled link to a 404). Action #3's copy step may still function if a lookup is possible; if the id is unusable for the lookup, action #3 shall report that rather than opening a dead page.

> **FR-27** — Concurrent or repeated action #3 invocations shall be handled safely: a row's action #3 shall reflect its own loading/result state independently of other rows, and re-invoking shall not open the comment page twice for a single successful copy or leave a row stuck in a loading state.

## Non-Functional Requirements

> **NFR-01 — Performance:** Building, filtering, ordering, and paginating the backlog from the already-loaded backup shall complete without a perceptible freeze on a large backup (tens of thousands of observations), reusing the app's parse-once caches rather than re-parsing. "Show all" on a very large backlog shall not lock up the UI.

> **NFR-02 — Offline / network:** The list itself shall build and page with no network. Only action #3's per-row weather lookup requires the network; its failure shall be surfaced (FR-23), never silently swallowed.

> **NFR-03 — Accessibility (WCAG 2.1 AA):** Every interactive control (entry point, the three per-row actions, pagination buttons, the toggle) shall be keyboard operable with a visible focus indicator and an explicit accessible name. The toggle shall be a real, keyboard-operable control carrying its selected state (e.g. `aria-pressed`/switch semantics). Per-row loading, success, and error states shall be announced to assistive tech via a polite live region or alert as appropriate. Reused shared components (`ChecklistLink`, `OutboundLink`, `HotspotLink`) shall keep their established accessible-name and new-tab-cue behavior.

> **NFR-04 — Responsive layout:** The backlog shall be usable from ~320px phones to large desktops, using the shared `.sr-*` layout vocabulary (e.g. `.sr-action-row`, `.sr-grid-auto`/`.sr-grid-*`, `.sr-scroll-x`, `.sr-touch-target`) rather than inline breakpoint styles. Dense per-row action controls shall meet the ~44px touch-target posture in the ≤640 tier. Layout shall hold at 200% in-app text scale (size in rem).

> **NFR-05 — Theming:** All colors shall use `var(--sr-*)` tokens in both light and dark themes; no hardcoded hex/RGB. Any new token shall be added to both `:root` and `[data-theme="dark"]` and pass AA where it carries text. (No new tokens are anticipated; reuse existing surface/text/warning/accent tokens.)

> **NFR-06 — Clipboard:** Action #3 shall write to the clipboard only through the `copyText()` seam (native on desktop, `navigator.clipboard` with fallback on web) — never `navigator.clipboard` directly — so a copy after an `await` succeeds in the desktop WebView.

> **NFR-07 — Transport & seams:** The per-row weather lookup shall reuse the existing `/weather/<id>` transport path via `transport` (no new backend route). External navigations shall use the shared link components. No `/settings/*` or platform APIs shall be called directly outside the storage/platform seams.

> **NFR-08 — Render purity:** No component render body or `useMemo`/`useCallback` shall call `Date.now()`/`new Date()` or other impure functions (`react-hooks/purity` is build-blocking). Any "now" reference (e.g. for a fresh lookup timestamp) shall live in an event handler or a module/session constant.

> **NFR-09 — Security:** Every eBird id interpolated into a URL shall be shape-validated (`SUBMISSION_ID_RE` = `^S\d+$`) before it becomes an href and `encodeURIComponent`-wrapped where it rides in a query string; a failing id renders as plain text (FR-26). Any user/comment text rendered shall go through the shared escaped renderers, not `dangerouslySetInnerHTML`.

> **NFR-10 — No scope regression:** The existing single-checklist Weather lookup, Current, and Predict behaviors on the Weather tab shall be byte-behavior-unchanged. No new weather/tide provider, formatter, or fetch policy shall be introduced.

> **NFR-11 — Privacy:** The feature shall introduce no analytics, telemetry, account, or new third-party service. It reuses only providers already disclosed in `PRIVACY_POLICY.md`; if a review finds otherwise, the policy shall be updated in the same change (no expected change here).

## Out of Scope

- Bulk or automatic posting of weather into eBird. eBird has no write API; the user always pastes manually. Action #3's ceiling is "clipboard + land on the edit page."
- Any change to the existing single-checklist Weather lookup, Current, or Predict behavior on the Weather tab.
- New weather/tide data providers, or any change to how weather/tide is fetched or formatted (the existing formatters/endpoints are reused as-is).
- Tide-station backfill or any tide-coverage improvement as a goal (tide only rides along if action #3 copies the combined block — OQ-3).
- A new backend route. This is a frontend assembly of shipped parts; if later profiling shows the per-row lookup needs server help, that is a follow-up Architect call, not committed here.
- Backlogs for tide-only-missing, RainCrow-only, or "no SnowRaven block specifically." The backlog targets absence of *any* recognized weather block (OQ-1, resolved).
- A separate/standalone tab or route for the backlog — it lives at the bottom of the Weather tab.
- Persisting the toggle, pagination position, or backlog scroll across relaunch (session-only unless the Designer/Architect decides otherwise).
- Non-US or protocol-specific special handling beyond the complete/incidental distinction already specified.

## Open Questions

> **OQ-1 (RESOLVED) — "No weather block" = `!hasWeatherBlock`.** The backlog targets checklists with **no recognized weather block of any kind** (SnowRaven or RainCrow), i.e. `hasWeatherBlock === false`. A checklist that already carries any recognized weather block (including a RainCrow-only block) is "handled" and stays off the backlog.
> *Alternative considered and rejected for v1:* `!hasSnowravenWeatherBlock`, which would re-list a checklist that carries only a RainCrow block. Rejected because the user's goal is finding checklists that still *need* weather, and any existing weather block satisfies that need. If the Designer/user later wants a "re-do RainCrow blocks with SnowRaven" mode, that is a distinct future option, not this backlog.

> **OQ-2 (Designer) — Exact per-row field set and how a widened-list row is visually distinguished.**
> *Default if deferred:* date, location, species count, protocol name, and a completeness indicator (FR-13); when the toggle is on, incomplete/incidental rows carry a small distinguishing indicator (FR-14). Designer confirms the precise scannable set and the exact visual treatment for complete vs. incomplete/incidental rows.

> **OQ-3 (Designer) — Does action #3 copy weather-only or weather+tide?**
> *Default if deferred:* mirror the Weather tab — copy the combined weather+tide block (`buildCombined`) when tide is available for the checklist, weather-only otherwise (FR-18) — so the backlog produces the same paste the main lookup does. Designer confirms whether the backlog should instead be strictly weather-only.

> **OQ-4 (Designer) — Exact per-row failure affordance and the missing-key case.**
> *Default if deferred:* action #3 reports failure inline on the row with three distinct honest states — offline, missing/invalid key (pointing to Settings), other error — and does NOT open the comment page on failure (FR-19/FR-23). Designer owns the exact inline affordance and the missing-key nudge wording/placement.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Entry point present & placed | A "List checklists with no weather blocks" entry point renders at the bottom of the Weather tab, below the single-checklist lookup and Current/Predict controls. (FR-01) |
| QA-02 | Entry point opens the list; tab unchanged | Activating the entry point reveals the backlog list; the single-checklist lookup, Current, and Predict controls remain present and behave as before. (FR-02, NFR-10) |
| QA-03 | No-backup entry state | With no eBird backup loaded, the entry point/list shows an explanatory needs-a-backup state — no empty list, no infinite spinner. (FR-03, FR-24) |
| QA-04 | List builds offline | With the backup loaded and the network disabled, the backlog list builds, filters, orders, and paginates with zero network requests. (FR-04, NFR-02) |
| QA-05 | "No weather block" = `!hasWeatherBlock` | A checklist whose comment contains a SnowRaven weather block is absent; one with a RainCrow-only weather block is absent; one with no recognized weather block is present. (FR-05, FR-06, OQ-1) |
| QA-06 | Default filter: complete + non-incidental | In the default (toggle-off) view, every listed checklist has `allObsReported === true` and is not the Incidental protocol (`P20`); an incomplete checklist and an incidental checklist are both absent. (FR-07) |
| QA-07 | Unknown-complete handling | A checklist with `allObsReported === null` is absent in the default view and present when the toggle is on. (FR-08, FR-21) |
| QA-08 | Newest-first, deterministic order | Listed checklists are ordered by date descending; two checklists on the same date appear in a stable, repeatable order across reloads. (FR-09) |
| QA-09 | One row per checklist | No submission id appears in more than one row. (FR-10) |
| QA-10 | Required per-row fields | Every row shows at least the checklist date and location. (FR-12) |
| QA-11 | Default field set renders cleanly | Rows show date, location, species count, protocol name, and a completeness indicator; a row whose protocol/species-count is absent omits that field with no "null"/"undefined" text. (FR-13) |
| QA-12 | Widened-list rows distinguishable | With the toggle on, an incomplete or incidental row is visually marked as such, distinct from complete/non-incidental rows. (FR-14) |
| QA-13 | Location link gating | A public-hotspot location may render as a `HotspotLink`; a personal location, junk id, or unresolved Set renders as plain text (never a 404 link). (FR-15) |
| QA-14 | Action #1 — open checklist | Each row's "open checklist" action targets `https://ebird.org/checklist/<id>`, opens in a new tab, renders via `ChecklistLink`, and carries its accessible name + new-tab cue. (FR-16) |
| QA-15 | Action #2 — open comment/edit page | Each row's "open comments" action targets `https://ebird.org/edit/effort?subID=<id>`, opens in a new tab, and has an accessible name describing it as the comment/edit page with a new-tab cue. (FR-17) |
| QA-16 | Action #3 — copy then open (success) | On a successful weather lookup, action #3 copies the block via `copyText()` and then opens `https://ebird.org/edit/effort?subID=<id>` in a new tab. (FR-18, NFR-06) |
| QA-17 | Action #3 copy content default | On success with tide available, the copied text is the combined weather+tide block (`buildCombined` output); with no tide, it is the weather-only block. (FR-18, OQ-3) |
| QA-18 | Action #3 — no navigate on failure | When the weather lookup fails or the copy fails, action #3 does NOT open the comment/edit page and instead shows a per-row failure state. (FR-19, FR-23) |
| QA-19 | Pagination — first 100 | With more than 100 matches, at most 100 rows render initially. (FR-20a) |
| QA-20 | Pagination — Show next 100 | With more than 100 matches, "Show next 100" appends the next 100 matches, preserving prior rows and order; repeating reaches subsequent pages. (FR-20b) |
| QA-21 | Pagination — Show all | "Show all" reveals every remaining matching checklist; with ≤100 matches, the next/all controls are absent or inert and all matches show. (FR-20b, FR-20c) |
| QA-22 | Show-all responsiveness | "Show all" on a very large backlog (e.g. thousands of matches) does not freeze the tab and leaves every match reachable. (FR-20d, NFR-01) |
| QA-23 | Toggle default & widening | The toggle defaults to off (complete, non-incidental only); turning it on adds incomplete and incidental checklists to the same list (a superset), not a switched set. (FR-21) |
| QA-24 | Toggle resets pagination | Toggling re-evaluates the set and resets to the first 100 newest-first; no stale offset mis-pages the new set. (FR-22) |
| QA-25 | Action #3 offline state | With the network off, action #3 shows the honest "offline / local server not running" state and does not open the comment page. (FR-23, NFR-02) |
| QA-26 | Action #3 missing-key state | With the eBird and/or OpenWeather key missing or invalid, action #3 shows a distinct missing-key state that points to Settings and does not open the comment page. (FR-23) |
| QA-27 | Action #3 other-error state | On a non-offline, non-key lookup error, action #3 shows a distinct "lookup error" state and does not open the comment page. (FR-23) |
| QA-28 | Zero-match empty state | With a backup loaded and no checklists matching, a clear "no matching checklists" empty state renders (naming the active filter context), not an empty list. (FR-25) |
| QA-29 | Malformed submission id | A checklist with an id failing `SUBMISSION_ID_RE` still lists with its info; its checklist link, comment/edit link, and action #3's open-comments step degrade to plain non-navigating affordances (no 404 link). (FR-26, NFR-09) |
| QA-30 | Per-row action independence | Each row's action #3 loading/success/error state is independent of other rows; a successful copy opens the comment page exactly once and never leaves a row stuck loading. (FR-27) |
| QA-31 | Keyboard & accessible names | Entry point, all three per-row actions, pagination buttons, and the toggle are reachable and operable by keyboard with a visible focus ring and an explicit accessible name; the toggle exposes its selected state. (NFR-03) |
| QA-32 | Live-region announcements | Per-row loading/success/error and the zero-match/needs-backup states are announced via a polite live region or alert. (NFR-03) |
| QA-33 | Responsive at 320px & 200% | The backlog is usable at 320px width and 200% in-app text scale with no horizontal page scroll; dense action controls meet the ~44px posture in the ≤640 tier; layout uses `.sr-*` classes, not inline breakpoint styles. (NFR-04) |
| QA-34 | Tokens only | All colors resolve from `var(--sr-*)` tokens and render correctly in both light and dark themes; no hardcoded hex/RGB introduced. (NFR-05) |
| QA-35 | Clipboard via seam | Action #3 writes to the clipboard only through `copyText()`; the desktop build copies successfully after the async lookup completes. (NFR-06) |
| QA-36 | No new backend route / transport reuse | The per-row lookup uses the existing `/weather/<id>` transport path; no new backend route, provider, or formatter is added. (NFR-07, NFR-10, Out of Scope) |
| QA-37 | Render purity | `npm run build` and lint pass; no `Date.now()`/`new Date()` appears in a render body or memo in the new code. (NFR-08) |
| QA-38 | Security — id validation & escaping | Every eBird id is `SUBMISSION_ID_RE`-validated (and `encodeURIComponent`-wrapped in query strings) before becoming an href; no `dangerouslySetInnerHTML` on backlog content. (NFR-09) |
| QA-39 | Privacy unchanged | No analytics/telemetry/account/new provider is introduced; `PRIVACY_POLICY.md` needs no change (or is updated in the same change if a review finds a new disclosure). (NFR-11) |
