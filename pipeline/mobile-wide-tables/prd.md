# PRD — Mobile Breeding-Codes Matrix (Comfortable Phone View)
**Feature:** mobile-wide-tables
**Date:** 2026-07-06
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
Make the wide **Breeding Codes matrix** comfortably readable on a phone by
narrowing each breeding-code column to roughly the width of its colored dot
(≈halving the matrix so a full row is scannable at a glance) and relying on the
platform's own **native pinch-zoom** to magnify and pan — no custom zoom
controls, no CSS-`zoom`/`transform:scale`. The Multimedia table gets only minor
legibility/scroll polish (or nothing) as a ride-along. Only the ≤640 phone tier
changes; desktop/tablet behavior stays byte-unchanged.

## User Stories

> **US-01** — As a birder viewing my Breeding Codes matrix on a phone, I want each code column narrowed to about its colored dot, so that a full species row fits in far less width and I can scan it at a glance instead of peering through a one-column peephole.

> **US-02** — As a phone user, I want to pinch-to-zoom and pan the matrix with the same native gesture I use everywhere else in iOS/the browser, so that I can magnify any part that's too small without learning a custom zoom control.

> **US-03** — As a phone user, I want the species name column to stay visible (frozen) and the code headers to stay legible while I read across a row, so that I always know which bird and which code I'm looking at.

> **US-04** — As a birder on any small screen — iOS app, or SnowRaven on the web/a Pi viewed on a phone — I want the same comfortable Breeding Codes layout, so that the improvement isn't limited to one platform.

> **US-05** — As a desktop or tablet user, I want the Breeding Codes matrix to look and behave exactly as it does today, so that this phone-focused change doesn't disturb the view I already use.

> **US-06** — As a screen-reader or keyboard user on a phone, I want each narrowed code cell and header to still announce its full breeding-code meaning and count, so that shrinking a column to a dot doesn't cost me the information.

> **US-07** — As a birder using the Multimedia tab on a phone, I want it to remain at least as legible and easy to scroll as it is now, so that the ride-along polish never regresses a table that already works.

## Functional Requirements

### Breeding Codes matrix — column narrowing (PRIMARY)

> **FR-01** — On the ≤640 phone tier, the app shall narrow each breeding-code column of the Breeding Codes matrix (`BreedingCodeTable.tsx`) to approximately the width of its colored count dot, materially reducing the total matrix width versus today's ~44px-per-column layout.

> **FR-02** — The app shall keep the colored count dot as the primary visible, tappable unit in each narrowed cell: a cell with a recorded count shall render its dot with the count inside, and an empty cell shall stay empty, exactly as today (only the containing column width changes).

> **FR-03** — The app shall keep the species **name column frozen/sticky** on the phone tier so it remains visible while the code columns are scrolled or panned, preserving the existing single-sourced name-column width (`clamp(7.5rem, 40vw, 220px)`) so the header cell, every row's name cell, and the scroll-padding stay aligned.

> **FR-04** — The app shall keep the code **column headers legible** on the phone tier: each header shall continue to show its terse code and remain a real, sortable `<button>` (`role=columnheader`, `aria-sort`) whose accessible name carries the full breeding-code meaning (e.g. "Sort by Nest Building (NB)"). Header legibility at the narrowed width may be assisted by the layout (e.g. the header text sitting above a dot-width column), but the header must not become unreadable or lose its sort control.

> **FR-05** — The app shall apply the narrowed layout **only at the ≤640 phone tier**, branching via CSS responsive conventions and/or the sanctioned `lib/useIsPhone.ts` `matchMedia` store — never a JS `window`/`resize`/`innerWidth` read.

> **FR-06** — At widths above 640px (desktop and tablet), the app shall render the Breeding Codes matrix with byte-unchanged behavior versus today: ~44px code columns, the existing sticky name column, sort, filters, the tier legend, and the `↔ Unbounded/Normal` toggle all behave exactly as before.

### Native pinch-zoom (the magnify strategy)

> **FR-07** — The app shall rely on the platform's **native viewport pinch-zoom gesture** as the sole magnify-and-pan mechanism for the Breeding Codes matrix on a phone. The app shall not build custom zoom controls (−/Fit/+, custom pinch handlers, or any bespoke zoom UI) as part of this feature.

> **FR-08** — The app shall not use CSS `zoom` or `transform: scale()` (or any equivalent CSS pixel-scaling primitive) as the magnify mechanism for this surface — both are proven WKWebView failures for this table (CSS `zoom` did not visibly scale in WKWebView; `transform: scale` broke the frozen column).

> **FR-09** — The app shall keep the viewport configuration free of any pinch-disabling clamp: the HTML viewport meta shall not add `maximum-scale`, `minimum-scale`, or `user-scalable=no` (today it is `width=device-width, initial-scale=1.0, viewport-fit=cover` — no clamp), and no per-input or global rule introduced by this feature may re-introduce such a clamp. The existing `.sr-input-16` anti-iOS-focus-zoom approach (which deliberately avoids a `maximum-scale` clamp) shall be preserved.

> **FR-10** — While the user is pinched-in on the matrix, the sticky name column and the code cells shall behave sensibly under native pan/zoom — the frozen column and headers must not visually break, detach, or corrupt as they did under `transform: scale`. (Verification of the actual on-device gesture behavior is QA-11, the blocking on-device check.)

> **FR-11** — If, and only if, the on-device native-pinch verification (QA-11) proves native pinch is unworkable in the shipping iOS WKWebView, the feature shall be **re-scoped** (custom non-CSS-zoom controls become a fallback). Custom zoom UI is explicitly **not** part of the intended build and shall not be added unless that verification fails and the re-scope is accepted.

### Existing behavior preserved

> **FR-12** — The app shall preserve, on the phone tier, all existing Breeding Codes functionality: species name links to Species Detail (via `<BirdName>`), the eBird/Birds-of-the-World favicons, per-cell count dots, the tier legend, sort (A–Z / Taxonomic and per-code column sort), and the code/category/county/date filters.

> **FR-13** — The app shall keep the existing `↔ Unbounded / Normal` (`wideMode`) toggle available; the narrowed-column treatment shall be compatible with both its states (the contained-scroll default and the full-page-scroll Unbounded mode) on the phone tier. (Whether the phone default should switch away from a page-lurching state is Open Question OQ-04.)

### Multimedia — minor ride-along (SECONDARY)

> **FR-14** — For the Multimedia table (`LifeListTable.tsx`), the app shall make at most **minor** phone legibility/scroll polish and shall not rebuild or rearchitect it. If no change measurably improves it, shipping it unchanged is an acceptable outcome for this requirement.

> **FR-15** — Any Multimedia phone polish the app does apply shall not regress its current phone behavior (a name/Entries column plus four narrow fixed columns, contained `overflow-x` scroll, the `wideMode` toggle) and shall not change its desktop/tablet rendering.

## Non-Functional Requirements

> **NFR-01 — Responsive method:** The phone treatment shall be achieved by lifting layout to CSS classes and/or the `useIsPhone` `matchMedia` store, never by inline `display`/breakpoint math that a media query can't reach and never by a JS `resize`/`innerWidth` listener (per the standing responsive conventions).

> **NFR-02 — Small-viewport + text-scale hold:** The narrowed layout shall hold at **320px width** and **200% in-app text scale** without leaking horizontal *page* scroll (the matrix scrolls inside its own contained overflow wrapper; any wide/off-screen node stays under an `overflow`/`position:relative` ancestor). Sizing shall be in rem (not rem→px conversions) so it survives 200% text scale.

> **NFR-03 — No CSS pixel-scaling magnify:** Magnification shall not use CSS `zoom` or `transform: scale()` (restates FR-08 as an enforceable non-functional constraint, since it is the load-bearing lesson of the reverted attempt).

> **NFR-04 — Desktop/web-wide unchanged:** The desktop and tablet (>640px) rendering of both tables shall be byte-unchanged; this is a hard regression boundary.

> **NFR-05 — Touch targets:** Interactive controls introduced or resized on the phone tier (e.g. sortable code headers, the dot cells if made tappable) shall meet the ~44px touch-target posture in the ≤640 tier (reach for `.sr-touch-target` where a dense control needs it), consistent with the standing mobile conventions — noting that native pinch-zoom is expected to bring any sub-44px visual detail up to a comfortable size for reading.

> **NFR-06 — Accessibility (WCAG 2.1 AA) preserved:** Narrowing a code column to a dot shall not remove any accessible information. Each code header keeps its full-meaning accessible name and sort semantics (FR-04); each count dot keeps its count plus its tier-category text (the existing `.sr-only` ", Confirmed/Probable/Possible") so the code is still identifiable by a screen-reader/keyboard user; the frozen name column and `scrollPaddingLeft` (WCAG 2.4.11 focus-not-obscured) behavior is preserved. Any `.sr-only` span in a horizontally-scrolled cell stays scoped under a `position:relative`/`overflow` ancestor so it can't leak page scroll.

> **NFR-07 — Contrast:** Any color used shall come from existing `--sr-*` tokens (no hardcoded hex/rgb); the feature is expected to need **zero new tokens** (the prior design pass proved this), and any text-on-fill remains AA in both themes.

> **NFR-08 — No new dependencies / providers / privacy surface:** The feature shall be frontend-only, add no network calls, no new third-party providers, no bundled data, and no telemetry — `PRIVACY_POLICY.md` is unaffected.

> **NFR-09 — Tests:** The phone-tier layout logic shall be covered by vitest to the extent jsdom allows (e.g. that the phone branch renders, that the dot-width class/style is applied at ≤640 and not above, that headers/cells retain their accessible names and the name column stays sticky). Native pinch/scroll/scale behavior is explicitly **out of automated scope** — jsdom cannot exercise it — and is covered by the manual on-device check (QA-11).

## Out of Scope
- **CSS `zoom` and `transform: scale()` as the magnify primitive** — proven WKWebView failures for this surface; not part of any path here.
- **Reviving `ZoomableWideSurface` / `lib/zoomableSurface.ts` as-is** — the reverted CSS-`zoom` component and its mechanism carry forward only their *goal*, not their implementation.
- **Custom zoom controls / custom zoom UI** — deliberately excluded; only a fallback if the on-device native-pinch check (QA-11) fails, which would be a conscious re-scope, not this build.
- **A Multimedia rebuild / rearchitecture** — Multimedia is minor polish or nothing (FR-14).
- **The Species Detail and List Comparer wide tables** — explicitly out; the pain solved here is the Breeding Codes matrix only.
- **Desktop/tablet (>640px) Breeding Codes and Multimedia rendering** — unchanged.
- **New `--sr-*` tokens** beyond what the dot-width layout strictly needs (default to zero new tokens).
- **Any change to sort logic, filter logic, or the data pipeline** (`parseBreedingCodes`, `aggregateBreedingRows`) — the feature is presentational at the phone tier.

## Open Questions

- **OQ-01 — Does native pinch-zoom actually work in the shipping iOS WKWebView?** This is the pivotal, load-bearing unknown. The HTML viewport carries no pinch-disabling clamp (confirmed: `frontend/index.html` viewport = `width=device-width, initial-scale=1.0, viewport-fit=cover`; no `maximum-scale`/`user-scalable=no`), and CLAUDE.md records the intent to preserve pinch — but whether the WKWebView/Tauri iOS config actually honors the gesture must be proven on real hardware.
  **Default assumption:** native pinch works (per the preserved-pinch intent). **BUT** the Architect must make "prove native pinch works in the shipping WKWebView (and enable it without a `maximum-scale` clamp if it doesn't)" the **first, gating spike** before committing to dot-width-columns as the sole magnify strategy. If it fails, FR-11 (re-scope to custom non-CSS-zoom controls) applies.

- **OQ-02 — Do very small dots need a tap-to-reveal-code affordance?** If a code column narrows to roughly dot-width, a screen-reader user is already covered (NFR-06), but a *sighted* touch user at 1:1 zoom may find the terse code header hard to associate with a dot before pinching in.
  **Default assumption:** no extra affordance — the header (FR-04) plus native pinch-to-magnify plus the always-visible tier legend suffice; add a tap-to-reveal only if the on-device review shows the association is genuinely lost at 1:1.

- **OQ-03 — Exact target width for the narrowed dot column (and dot size).** "Roughly dot-width" needs a concrete px/rem value; today the dot is 28px inside a 44px column.
  **Default assumption:** target a column of roughly the dot's own footprint plus minimal padding (on the order of ~28–32px), tuned on-device so the header code stays legible and the matrix roughly halves; keep the dot itself at its current 28px (or size in rem so it holds at 200% text scale). Final value is the Architect/Engineer's call within this range.

- **OQ-04 — Phone default for the `wideMode` toggle.** Today `↔ Unbounded` triggers a full-page sideways lurch and is available at all widths; the brief frames that lurch as part of the problem.
  **Default assumption:** leave the toggle as-is and both states compatible with the narrowed columns (FR-13); do **not** silently change the phone default in this feature unless on-device review shows the narrowed contained-scroll default is clearly better and the change is confirmed. (Flagged so the user can decide if they want the page-lurch default killed on phones.)

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Dot-width columns at ≤640 (FR-01) | At a ≤640 viewport, each Breeding Codes code column renders at approximately dot width (materially narrower than the desktop ~44px); the total matrix width is visibly reduced (≈halved on a representative ~16-code dataset). |
| QA-02 | Dot + count preserved (FR-02) | On the phone tier, a cell with a recorded count shows its colored dot with the count inside; an empty cell renders empty. No count or dot is lost by the narrowing. |
| QA-03 | Frozen name column (FR-03) | On the phone tier, the species name column stays visible (sticky) while the code columns scroll/pan horizontally; the header, name cells, and scroll-padding stay aligned to the single-sourced `clamp(7.5rem, 40vw, 220px)` width. |
| QA-04 | Header legibility + sort (FR-04) | On the phone tier, each code header shows its terse code and is a focusable/activatable sort `<button>` with `aria-sort`; the header is readable at the narrowed width and sorting still works. |
| QA-05 | ≤640-only application (FR-05, NFR-01) | The narrowed layout appears at ≤640 and not above; the branch is driven by CSS and/or `useIsPhone`, with no `window`/`resize`/`innerWidth` read added (verified in code + by resizing across the 640 boundary). |
| QA-06 | Desktop/tablet unchanged (FR-06, NFR-04) | At >640px the Breeding Codes matrix is byte-unchanged: 44px columns, existing sticky column, sort, filters, legend, and `↔ Unbounded/Normal` toggle all behave as before. Existing Breeding-Codes tests stay green. |
| QA-07 | No custom zoom UI (FR-07) | The shipped build adds no −/Fit/+ or other custom zoom control and no bespoke pinch handler for this surface (verified in code and UI). |
| QA-08 | No CSS pixel-scaling magnify (FR-08, NFR-03) | No CSS `zoom` or `transform: scale()` is used to magnify the matrix (verified by code search across the changed surface). |
| QA-09 | Viewport allows pinch (FR-09) | `frontend/index.html`'s viewport meta contains no `maximum-scale`, `minimum-scale`, or `user-scalable=no`, and the feature introduces no rule that clamps user scaling; `.sr-input-16` anti-focus-zoom behavior is intact. |
| QA-10 | Sticky column/cells sane while pinched (FR-10) | On a real iOS device, pinching in and panning the matrix does not visually break, detach, or corrupt the frozen name column or the headers (covered together with QA-11). |
| **QA-11** | **BLOCKING on-device native-pinch check (FR-07, FR-10, OQ-01) — MANUAL, USER-OWNED** | **On a real iOS device (WKWebView / TestFlight build): native pinch magnifies the Breeding Codes matrix, two-finger pan moves around it, and the sticky name column behaves sensibly throughout. This CANNOT be verified by jsdom/CI — it is a manual, on-device check owned by the user and GATES the design. If it fails, the fallback (FR-11: custom non-CSS-zoom controls) is a re-scope, not a silent code change.** |
| QA-12 | 320px + 200% text scale hold (NFR-02) | At 320px width and 200% in-app text scale, the matrix reads and scrolls within its contained wrapper with no horizontal *page* scroll leaked; rem sizing holds (no rem→px regressions). |
| QA-13 | Existing functionality preserved (FR-12) | On the phone tier: name links open Species Detail, favicons render, count dots show, the tier legend shows, sort (A–Z/Taxonomic/per-code) works, and code/category/county/date filters work. |
| QA-14 | `wideMode` compatibility (FR-13) | On the phone tier, the `↔ Unbounded/Normal` toggle still works and both its states render sensibly with the narrowed columns. |
| QA-15 | Multimedia not regressed (FR-14, FR-15) | The Multimedia table on a phone is at least as legible/scrollable as before; if polished, it still shows its name/Entries + four fixed columns with contained scroll and its `wideMode` toggle, and its desktop rendering is unchanged. If shipped unchanged, it matches today exactly. |
| QA-16 | Accessible info preserved on narrowed cells (NFR-06) | With a screen reader on the phone tier, each count dot announces its count plus tier category (Confirmed/Probable/Possible) and each code header announces its full meaning; no `.sr-only` span leaks page horizontal scroll. |
| QA-17 | Touch targets (NFR-05) | Interactive controls resized/added on the phone tier meet the ~44px posture in the ≤640 tier (or rely on native pinch to bring detail to a comfortable size, documented per control). |
| QA-18 | Tokens / no new deps (NFR-07, NFR-08) | No hardcoded colors are added (all `--sr-*`); ideally zero new tokens; no new network calls, providers, bundled data, or telemetry; `PRIVACY_POLICY.md` unchanged. |
| QA-19 | Automated coverage present (NFR-09) | vitest covers the phone-branch rendering (dot-width applied at ≤640 and not above, accessible names retained, name column sticky) to the extent jsdom allows; native pinch/scroll/scale is explicitly deferred to QA-11. |
