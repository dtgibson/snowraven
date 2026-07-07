# QA Report — Mobile Breeding-Codes Matrix (Comfortable Phone View)

**Feature:** mobile-wide-tables
**Date:** 2026-07-06
**Stage:** 6 — The Tester
**Test Runner:** vitest (frontend); backend pytest not exercised (feature is frontend-only, no backend surface touched)
**Result:** PASSED

Verified against the FINAL agreed feature state recorded in `session-state.json`
`autonomyNote` (4 live-verified revisions, incl. the deliberate revert of the
frozen-header/capped-box experiment back to natural page scroll), not merely the
baseline PRD. Criteria that reference the reverted/deferred ideas are reconciled
below, not failed.

## Gate Results (the real CI/release gate, all three)

| Gate | Command | Result |
|---|---|---|
| Test suite | `npm run test` (vitest run) | **1563 passed / 0 failed**, 124 files, 19.06s |
| Typecheck | `npm run typecheck` (`tsc -b`) | **PASS** (exit 0) |
| Production build | `npm run build` (`tsc -b && vite build`) | **PASS** (exit 0, `✓ built in 677ms`) |

Build note: the "chunks > 1100 kB" warning is pre-existing and expected — the
maplibre / ebird-taxonomy / us-counties chunks are deliberately isolated
on-demand chunks (CLAUDE.md convention). Entry-chunk guard confirmed: no
maplibre/county/SnowMap/SightingsMap asset is preloaded on `dist/index.html`.

## Test Suite Results

1563 tests passing, 0 failing across 124 files. The feature's own coverage lives
in `BreedingCodeTable.test.tsx` (2 pre-existing describe blocks + the two
mobile-wide-tables blocks: "mobile column narrowing" and "column separators +
horizontal-sticky name column"), all green — 204 lines added, covering the class
hooks, the no-inline-width guard, the no-CSS-zoom/scale guard, the
horizontal-sticky name column in Normal (dropped in wideMode), the absence of any
vertical (top) freeze, and the no-capped-height-box wrapper.

## Acceptance Criteria Verification

| ID | Criterion | Result | Notes |
|---|---|---|---|
| QA-01 | Dot-width columns at ≤640 (FR-01) | ✓ Pass | `.sr-bc-code-col` = 44px base, narrowed to 30px inside `@media (max-width:640px)` (globals.css L1222). Materially narrower than desktop 44px; ~halves a ~16-code matrix. On-screen pixel size confirmed by the user's live review at the gate. |
| QA-02 | Dot + count preserved (FR-02) | ✓ Pass | Count-dot render path unchanged (28px dot, count inside, empty cell empty). Only column width moved to the class. Test: `.sr-bc-code-col` on every `<td>`. |
| QA-03 | Frozen name column (FR-03) | ✓ Pass | `NAME_COL_WIDTH = clamp(7.5rem, 40vw, 220px)` single-sourced across corner header, row headers, and `scrollPaddingLeft`. Sticky `left:0` in Normal. Test-verified. |
| QA-04 | Header legibility + sort (FR-04) | ✓ Pass | Headers stay real `<button>` with `aria-label="Sort by {label} ({code})"`; ≤640 drops font to 0.625rem + removes letter-spacing (`!important` required to beat inline `font:inherit`). `aria-sort` on the `<th>`. Test-verified. |
| QA-05 | ≤640-only application (FR-05, NFR-01) | ✓ Pass | Width lifted to a class + `@media (max-width:640px)`; no inline width on the header (test guards it). No `window`/`resize`/`innerWidth` read added (grep clean). |
| QA-06 | Desktop/tablet unchanged (FR-06, NFR-04) | ✓ Pass (with one intended delta) | >640 keeps 44px columns, sticky name col, sort, filters, legend, wideMode toggle. **Intended delta from "byte-unchanged":** the thin vertical column separators (`--sr-border-subtle` right-border) now apply at ALL widths per the agreed final state — a deliberate, user-approved visual addition, not a regression. All pre-existing Breeding-Codes tests stay green. |
| QA-07 | No custom zoom UI (FR-07) | ✓ Pass | No −/Fit/+ control, no bespoke pinch handler. No `.sr-bc-scroll` / `MATRIX_MAX_HEIGHT` / `ZoomableWideSurface` / `zoomableSurface` remnants (grep clean; the sole `sr-bc-scroll` hit is a negative regression assertion in the test). |
| QA-08 | No CSS pixel-scaling magnify (FR-08, NFR-03) | ✓ Pass | No `zoom` / `transform:scale` on the surface; a test greps the rendered DOM for `[style*="scale"],[style*="zoom"]` and asserts zero. |
| QA-09 | Viewport allows pinch (FR-09) | ✓ Pass | `frontend/index.html` viewport = `width=device-width, initial-scale=1.0, viewport-fit=cover` — no `maximum-scale`/`minimum-scale`/`user-scalable=no`. `.sr-input-16` anti-focus-zoom approach intact (unchanged). |
| QA-10 | Sticky column sane while pinched (FR-10) | ✓ Reconciled (device-only) | Covered with QA-11 — verifiable only on real iOS hardware; ships via TestFlight. Code side: sticky is `left:0` only (no `top`), and wideMode drops it as the graceful escape. |
| **QA-11** | **BLOCKING on-device native-pinch (MANUAL, USER-OWNED)** | ⧗ Deferred to device (as designed) | jsdom/CI cannot exercise native pinch. This is the user-owned on-device check via the TestFlight build. The core win (column narrowing) works regardless of pinch. Not a CI blocker; see Known Limitations. |
| QA-12 | 320px + 200% text scale hold (NFR-02) | ✓ Pass | Matrix scrolls inside its `overflowX:auto` + `position:relative` wrapper (min-width:0 on card + wrapper); `.sr-only` spans scoped to that container so they can't leak page scroll. All sizing in rem. Live-verified by the user at the gate. |
| QA-13 | Existing functionality preserved (FR-12) | ✓ Pass | Name links via `<BirdName>` (`hasEntry`/`onOpenSpecies`), favicons, count dots, tier legend, sort (A–Z/Taxonomic via `nameCompare`; per-code column sort), and code/category/county/date filters — all code paths unchanged. Tests cover sort, aria, legend, tier badge. |
| QA-14 | wideMode compatibility (FR-13) | ✓ Pass | `↔ Unbounded/Normal` intact; wideMode → `width:max-content`, drops the sticky name col; Normal → contained `overflowX:auto`. Both render sensibly with narrowed columns. Test-verified both branches. |
| QA-15 | Multimedia not regressed (FR-14, FR-15) | ✓ Pass | `LifeListTable.tsx` has **zero** changes vs HEAD (git diff empty). Out of scope, untouched, unchanged on both phone and desktop. |
| QA-16 | Accessible info preserved on narrowed cells (NFR-06) | ✓ Pass | Each dot keeps `<span class="sr-only">, {Confirmed/Probable/Possible}</span>`; each header keeps its full-meaning `aria-label`; frozen name col + `scrollPaddingLeft` (WCAG 2.4.11) preserved; `.sr-only` scoped under `position:relative`. Tests verify the badge announces its tier category. |
| QA-17 | Touch targets (NFR-05) | ✓ Reconciled | Code headers stay `<button>`s; sub-44px visual detail is intended to be brought up by native pinch (documented in the PRD). No new dense control needed `.sr-touch-target`. Consistent with the agreed design. |
| QA-18 | Tokens / no new deps (NFR-07, NFR-08) | ✓ Pass | Changed CSS uses only `--sr-border-subtle` (existing token) — zero new tokens, zero hardcoded hex/rgb. Frontend-only; no network, providers, bundled data, or telemetry. `PRIVACY_POLICY.md` unaffected. |
| QA-19 | Automated coverage present (NFR-09) | ✓ Pass | vitest covers the class-hook application at the phone tier, the no-inline-width guard, retained accessible names, the sticky name column, and the no-CSS-scale guard — to the extent jsdom allows. Native pinch explicitly deferred to QA-11. |

## Final-State Reconciliation (design decisions verified, not defects)

The following were TRIED then DELIBERATELY REVERTED / are intended and are
confirmed correct in the shipped code — NOT flagged as defects:

- **No frozen (vertical/top-sticky) header, no capped-height inner-scroll box.**
  The header row scrolls away with the page; the table renders full-height; the
  tier legend sits in normal flow right after the last row. Verified: no `top`
  inset on the corner or code headers in either mode; wrapper has no `maxHeight`
  / `overflow` / `sr-bc-scroll`. This is the user's explicit choice (natural page
  scroll). Tests assert all of this.
- **Horizontal-sticky species-name column KEPT** (`position:sticky; left:0`, no
  `top`) in Normal; dropped in wideMode. Verified in code + tests.
- **Vertical column separators apply at ALL widths** (not phone-only) — the
  agreed final state. Confirmed.

## Edge Cases Probed (code-read + tests)

- **Sort:** A–Z vs Taxonomic (`nameCompare` reads `taxonOrders`, falls back to
  `localeCompare`); per-code column sort with count tiebreak → name — logic
  unchanged. Click handler + `aria-sort` verified by tests.
- **Filters:** the `filter.size===0 ? all : every-code-present` AND-filter is
  intact; the empty result renders "No species match these filters." (test).
- **Tier colors + `.sr-only` category text:** `TIER_COLORS` fill +
  `TIER_TEXT_COLORS` (`--sr-tier-N-text`) unchanged; badge announces
  Confirmed/Probable/Possible (test).
- **wideMode ↔ Normal toggle:** both branches render; sticky drop verified.
- **Convention scan:** no em dash in any user-facing string (all `—` hits are in
  code comments, which are explicitly out of scope per the CLAUDE.md em-dash
  rule); no `console.log`/`debugger`; no dead code from reverted revisions; no
  `window`/`resize`/`innerWidth`; layout lifted to classes (not inline).
- **Entry-chunk guard:** `dist/index.html` preloads no maplibre/county/map asset.

## Known Limitations

- **QA-11 (native-pinch on real iOS) is a device-only, user-owned check** — it
  cannot be exercised by jsdom/CI and ships for verification via the TestFlight
  build. The core deliverable (dot-width column narrowing, ≈halving the matrix)
  is fully verified and works regardless of the pinch behavior; if native pinch
  were ever found unworkable on-device, FR-11's fallback (custom non-CSS-zoom
  controls) is a conscious re-scope, not a silent change.
- **Dev-scratch to clean before the release commit** (for the Deployer, per the
  autonomyNote): `data/` demo CSVs, `backend/.env` throwaway placeholder,
  `.claude/launch.json`, and any running preview servers.

## Convention Flags
(none — no new standing rule emerged; the existing conventions covered every
check, including the em-dash-in-copy rule, tokens-only, responsive-lift-to-class,
and the "npm run build is the real gate" rule, all of which held.)
