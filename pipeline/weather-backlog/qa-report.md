# QA Report — Weather Backlog

**Date:** 2026-07-06
**Test Runner:** vitest (frontend) · pytest (backend)
**Lane:** New Feature (Stage 6)
**Result:** PASSED (with one minor token observation — non-blocking)

## Test Suite Results

| Suite | Command | Result |
|---|---|---|
| Frontend (vitest) | `npx vitest run` | **1547 passed / 1547** across **123 files**, 0 failing. Duration 19.36s. |
| Backend (pytest) | `python -m pytest -q` (via `.venv`) | **178 passed**, 0 failing. Backend is unchanged (frontend-only feature) — no regression. |
| Production build | `npm run build` (`tsc -b && vite build`) | **PASS** — built in 697ms, exit 0. No TS6133 / no type errors. `WeatherBacklog` bundles into the entry chunk; `vendor-maplibre` stays isolated (no entry-chunk regression). |
| Lint | `npm run lint` (`eslint .`) | **PASS**, exit 0. |

The 44 new tests (17 in `weatherBacklog.test.ts` + 27 in `WeatherBacklog.test.tsx`) are all green as part of the full suite. No flake re-runs were needed — the full suite passed clean on the first run.

## Acceptance Criteria Verification

| Criterion | Result | Notes |
|---|---|---|
| QA-01 Entry point present & placed | ✓ Pass | `<WeatherBacklog>` mounts in `App.tsx` (line 1066) at the bottom of the Weather tab, after `WeatherForecastPanel` (Current/Predict). Test `entry point` asserts the collapsed button renders. |
| QA-02 Entry point opens list; tab unchanged | ✓ Pass | `aria-expanded` toggles false→true, heading appears on expand (test `renders a collapsed entry button…`). Single-checklist lookup / Current / Predict are untouched — `App.tsx` diff only adds the backlog block + a state-free `lookupBacklogWeather`; no existing handler modified. |
| QA-03 No-backup entry state | ✓ Pass | `rows === null` renders the "Load your eBird backup first" `StateBlock` with a Go-to-Import CTA; not a spinner (test `needs-data state`). App passes `rows={backlogRequested ? backlogRows : null}`. |
| QA-04 List builds offline | ✓ Pass | `computeBacklog`/`pageBacklog` are pure and React-free — no I/O. Rows are built from the parse-once `loadEbirdObservations` cache (`App.tsx` effect, lines 517–527); no network to build/filter/order/paginate. |
| QA-05 "No weather block" = `!hasWeatherBlock` | ✓ Pass | `hasNoWeatherBlock(r) = !r.weatherBlock`, and `weatherBlock` is set upstream by `hasWeatherBlock(raw)` in `buildChecklistRows` (`checklistsTab.ts:74`) — the shipped SnowRaven-OR-RainCrow detector. No second detector introduced. Test `computeBacklog — predicate` covers include/exclude. |
| QA-06 Default filter: complete + non-incidental | ✓ Pass | `INCIDENTAL_PROTOCOL = 'P20'` (VERIFIED as the incidental code); default view drops `!complete \|\| incidental`. `isComplete = allObsReported === true`. Test `default filter` asserts only S1 (complete, P22) survives; incomplete + P20 dropped. |
| QA-07 Unknown-complete handling | ✓ Pass | `allObsReported === null` → `isComplete` false → `surfacedByWiden` true → absent by default, present when widened. Test `unknown-complete` asserts both, plus `isComplete=false`/`surfacedByWiden=true`. |
| QA-08 Newest-first, deterministic order | ✓ Pass | Sort by `date` desc, tiebroken by `submissionId` desc (both `localeCompare`); submissionId is a total order. Test `ordering` asserts date desc and same-date tie is stable and input-order-independent. |
| QA-09 One row per checklist | ✓ Pass | One row per checklist guaranteed upstream by `buildChecklistRows`; test `one row per id` asserts no duplicate ids. |
| QA-10 Required per-row fields | ✓ Pass | Line 1 always renders date (`ChecklistLink` label) + location. Test `malformed submission id` confirms row still lists its info even with a bad id. |
| QA-11 Default field set renders cleanly | ✓ Pass | Meta line conditionally pushes protocol / distance / duration / place / "Complete" — each guarded (`if (c.protocol)`, `!= null && > 0`, `filter(Boolean)`), so absent fields are omitted with no "null"/"undefined". Species count via `.toLocaleString()`. |
| QA-12 Widened-list rows distinguishable | ✓ Pass | Incomplete rows get a warning "Incomplete" chip; incidental rows a neutral "Incidental" chip; widened rows also get a faint `--sr-surface-faint` background. Test `widened-list markers` asserts chips appear only after toggling on. |
| QA-13 Location link gating | ✓ Pass (with note) | `HotspotLink` used only when an `isHotspot` resolver prop is supplied; otherwise plain-text location (never a 404 link). **App currently passes no `isHotspot`** → locations render as plain text — the FR-15-permitted fallback (a "may", not "must"). Correct per spec; not a Fail. |
| QA-14 Action #1 — open checklist | ✓ Pass | `ChecklistLink` → `https://ebird.org/checklist/<id>`, `target="_blank"`, SUBMISSION_ID_RE-guarded, "(opens in a new tab)" cue. Test asserts href + target. |
| QA-15 Action #2 — open comment/edit page | ✓ Pass | `OutboundLink href={EDIT_URL(id)}` = `https://ebird.org/edit/effort?subID=<encoded id>`, `target="_blank"`, `rel="noreferrer"`, aria-label "…comment and edit page on eBird (opens in a new tab)". Test asserts href + target. |
| QA-16 Action #3 — copy then open (success) | ✓ Pass | On success: `onCopy(block)` (copyText seam) then `window.open('https://ebird.org/edit/effort?subID=<id>', '_blank', 'noopener,noreferrer')` — called **exactly once**, only on the success edge (line 139). Test asserts `openSpy` called once with the edit URL after `onCopy`. |
| QA-17 Action #3 copy content default | ✓ Pass (user decision) | Copied text is **weather-only** — `buildBacklogCopyText` just returns `lookupWeather(id)`. **No tide fetch, no `buildCombined`** anywhere in the file (grep confirms the only "tide" hit is a comment). This is the user's explicit decision (weather-only), documented in `decisions.md §OQ-3`; PRD default (combined) was overridden. Test `does NOT fetch or append tide` asserts `lookupWeather` called once, copy = the weather block. |
| QA-18 Action #3 — no navigate on failure | ✓ Pass | Every failure path (`throw` → offline/no-key/other, null lookup, copy returns false) sets an error state and `return`s before the single `window.open`. Tests `failures never open the edit page` assert `openSpy` not called for all five failure modes. |
| QA-19 Pagination — first 100 | ✓ Pass | `shown` inits to `PAGE_SIZE=100`; `pageBacklog` slices `[0, shown)`. Test `shows the first 100 initially` renders 150 matches → 100 action-#3 buttons. |
| QA-20 Pagination — Show next 100 | ✓ Pass | "Show next 100" → `setShown(s => min(s+100, len))`, preserving order. Test appends 150-total to 150 visible after one click. |
| QA-21 Pagination — Show all | ✓ Pass | "Show all" → `setShown(backlog.length)`. ≤100 matches → `page.hasMore` false → controls not rendered. Tests `Show all reveals every remaining match` + `≤100 matches → no pagination controls`. |
| QA-22 Show-all responsiveness | ✓ Pass (design-bounded) | Pure slice + keyed row map; no per-row network on render (action #3 lookup is on click only). Rows are lightweight DOM. No artificial cap — "Show all" reveals the full set; every match reachable. No freeze observed in the 250-row pure test and 150-row component test. |
| QA-23 Toggle default & widening | ✓ Pass | Toggle defaults off (complete/non-incidental only); on = superset (adds incomplete + incidental, removes nothing). Test `widen is a superset` asserts off ⊆ on and on = {S1,S2,S3}. |
| QA-24 Toggle resets pagination | ✓ Pass | `toggleWiden` sets `setShown(PAGE_SIZE)` in the handler (not a render/effect). Test `toggling widen resets pagination` pages to 150 then toggles → back to 100, and "Show all (190)" names the widened total. |
| QA-25 Action #3 offline state | ✓ Pass | A connection-level throw (no HTTP status) → `classifyLiveError` kind `offline` → `error-offline` state ("You're offline…"), page not opened. Test `offline error → offline state, no open`. |
| QA-26 Action #3 missing-key state | ✓ Pass | A 401/no-key throw → kind `no-key` → `error-no-key` state with a "Settings →" button wired to `onGoToSettings`; page not opened. Test asserts the Settings nudge fires and no open. |
| QA-27 Action #3 other-error state | ✓ Pass | A 500 (or any non-offline/non-key) → `error-other` ("Weather lookup failed") with a Try-again; page not opened. Tests `generic error` + `a null lookup` + `copy returning false` all land here with no open. |
| QA-28 Zero-match empty state | ✓ Pass | `backlog.length === 0` renders a `CheckCircle2` `StateBlock` naming the active filter ("No complete checklists are missing weather" vs. "No checklists are missing weather" when widened). Test `zero-match empty state` asserts both contexts. |
| QA-29 Malformed submission id | ✓ Pass | `validId = SUBMISSION_ID_RE.test(id)`; bad id → checklist link degrades to plain (ChecklistLink renders plain text), comment/edit becomes a disabled non-nav span, action #3 short-circuits to `error-bad-id` without a lookup or open. Test `malformed submission id` asserts row lists, no checklist link, no lookup, no open. |
| QA-30 Per-row action independence | ✓ Pass | Each `BacklogRowView` owns its `useState` state machine. In-flight re-click guarded (`if looking-up/copying return`). Success opens exactly once. Tests `per-row independence` (one succeeds/opens once while another errors offline) + `in-flight re-click does not double-fetch or double-open`. |
| QA-31 Keyboard & accessible names | ✓ Pass | Entry point (`aria-expanded`), toggle (`role="switch"` + `aria-checked`), the three actions (real `<a>`/`<button>` with explicit aria-labels), pagination (`<button>`s) are all native focusable elements. Test `the widen toggle is a switch carrying its checked state`. |
| QA-32 Live-region announcements | ✓ Pass | Loading/success announced via `role="status" aria-live="polite"` sr-only span; failures via `role="alert"` `RowStatus`; needs-data/loading/zero-match wrapped in `role="status"`. Tests `failures render as role=alert` + `a polite live region announces success`. |
| QA-33 Responsive at 320px & 200% | ✓ Pass (static review) | Uses shared `.sr-wrap-flex`, `.sr-touch-target`, `.sr-truncate`, `.sr-only` classes (not inline breakpoint styles); action buttons are 32px glyph raised toward 44px via `.sr-touch-target` in the ≤640 tier; sizing in rem for text. No inline `@media`. (Visual 320px/200% pass deferred to live preview — see Known Limitations.) |
| QA-34 Tokens only | ◐ Partial | All semantic surface/text/warning/accent/error colors use `var(--sr-*)`. **One deviation:** the toggle knob at line 476 uses `background: '#fff'` (+ `boxShadow: rgba(0,0,0,.25)`). This is a physically-white switch thumb (a common pattern; shadows are typically exempt), but strictly violates the "no hardcoded hex/RGB in a component" rule — an `--sr-*` white token (e.g. `--sr-on-accent`) exists. Renders correctly in both themes (a white thumb is theme-neutral). **Non-blocking**; flagged for a one-line follow-up. |
| QA-35 Clipboard via seam | ✓ Pass | App passes `onCopy={copyText}` (the shared seam); the component only calls `onCopy`, never `navigator.clipboard`. Copy runs after the async lookup `await` — the exact case `copyText` exists for on desktop. |
| QA-36 No new backend route / transport reuse | ✓ Pass | `git status backend/` is empty — zero backend changes. `lookupBacklogWeather` calls `transport.getReplayable('/weather/<id>')` — the existing path. No new provider/formatter. |
| QA-37 Render purity | ✓ Pass | `npm run build` + lint pass. Grep of both new files finds `Date.now`/`new Date` only in comments, never in a render body or memo. `computeBacklog`/`pageBacklog` are pure; the in-flight guard needs no timestamp. |
| QA-38 Security — id validation & escaping | ✓ Pass | Every id is SUBMISSION_ID_RE-validated before becoming an href (ChecklistLink internally; `validId` gate on the edit link + action #3). `EDIT_URL` wraps the id in `encodeURIComponent`. No `dangerouslySetInnerHTML` in the new files. |
| QA-39 Privacy unchanged | ✓ Pass | No analytics/telemetry/account/new third-party service. Reuses only the already-disclosed `/weather` provider path and eBird link-outs. `PRIVACY_POLICY.md` needs no change. |

**Tally: 38 Pass, 1 Partial (QA-34, non-blocking), 0 Fail.**

## Edge Cases Tested (beyond the criteria)

- **Null lookup with no throw** → treated as a generic error, no open (test present).
- **Copy returns false** (clipboard seam failure) → generic error, no open (test present).
- **`onFirstExpand` fires exactly once** across open/close/re-open — the lazy backup-build trigger (test present).
- **Same-date tie ordering is input-order-independent** — verified by reversing the input array and asserting identical output.
- **Widen toggle grows the total from 150 → 190** while resetting the visible page to 100 — confirms no stale offset mis-pages the new set.
- **Two rows, one succeeds + one errors** — success opens once, the other shows offline, states fully independent.

## Known Limitations

- **QA-33 / QA-34 were verified by static code review, not a live 320px / 200%-zoom / dark-mode render.** The code uses the correct `.sr-*` responsive classes and `var(--sr-*)` tokens, and the component tests exercise behavior in jsdom (no layout). A visual pass on the desktop dev app against real data (the user's standing preference before ship) would fully close QA-33 and confirm the QA-34 white-thumb reads correctly in both themes. This is the natural place to also eyeball the widen chips and the failure banners. Recommend surfacing this at the Designer/Deploy gate.
- **QA-13 HotspotLink is intentionally not wired.** The App passes no `isHotspot` resolver, so backlog locations are plain text — the spec-permitted FR-15 fallback. If richer location linking is later wanted, the component already accepts the resolver prop; wiring `useHotspotSet()` in would light it up. Not a gap in this release.
- **QA-22 "Show all" has no hard render cap.** For the largest conceivable backups (many thousands of matching rows all mounted at once), rows are lightweight and action #3 does no work until clicked, so no freeze was observed — but this is a design-bounded pass, not a stress-tested one. If a user reports lag on a very large "Show all," a windowed/virtualized list is the follow-up (already a documented FR-20d/NFR-01 fallback path).

## Convention Flags

- **A component-file `#fff`/`rgba()` on a "physically white" control (toggle thumb, shadow) is a recurring gray area against the "tokens only" rule.** The rule as written admits no exception; in practice white thumbs and drop-shadows recur. Worth a Stage-9 decision on whether to (a) mint/standardize an `--sr-switch-thumb` (+ `--sr-shadow-*`) token pair and forbid raw literals outright, or (b) explicitly carve out "physically-neutral control chrome (white thumbs, black shadows)" as a sanctioned exception — so future reviews don't re-litigate it row by row. Either way, applying it to this toggle is a one-line change.
