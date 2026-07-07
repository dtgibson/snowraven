# QA Report — Unbounded Column Narrowing (Breeding Codes matrix)

**Date:** 2026-07-07
**Lane:** Improve (maintain) — Stage 3, autopilot
**Test Runner:** vitest
**Result:** PASSED

## Gate Results (the real CI/release gates)

| Gate | Command | Result |
|---|---|---|
| Unit suite | `npm run test` (vitest) | **1569 passed / 0 failed** (124 files) |
| Type check | `npm run typecheck` (`tsc -b`) | **Clean** (no errors) |
| Production build | `npm run build` (`tsc -b && vite build`) | **exit 0** — built successfully |

Entry-chunk guard re-confirmed as a no-regression check: `dist/index.html` modulepreload
carries no `vendor-maplibre` / `us-counties` (entry chunk clean). The chunk-size warning
is the pre-existing, expected one (isolated maplibre + county vendor chunks, off first
paint) — not a regression from this change.

## Acceptance Criteria Verification

| Criterion (from change-brief) | Result | Notes |
|---|---|---|
| Unbounded ≤640 code columns are dot-width (~30px), authoritative | ✓ Pass | `.sr-bc-matrix` @≤640 sets `table-layout: fixed; width: max-content; min-width: 0` (globals.css L1259); `.sr-bc-code-col` @≤640 = `width:30px;min-width:30px` (L1237). Under `fixed`, declared widths bind in both modes. Class hooks asserted by tests; pixel result live-verified @375px by the Engineer (table 540 / code 30 / name 150, all 13 cols reachable). |
| Unbounded card hugs the table (no trailing whitespace) | ✓ Pass | `.sr-bc-card` @≤640 = `width: min-content` (L1269), sizing the card to the declared-width sum (~540px) not intrinsic content (~1751px). Class hook asserted; ~1200px whitespace removal live-verified. |
| Desktop (>640) unchanged | ✓ Pass | Base `.sr-bc-matrix` = `width:100%;min-width:max-content` and `.sr-bc-card` = `width:max-content` are byte-identical to the old inline values; no `table-layout` override above 640 → keeps `auto` (content-driven wide columns). Live-verified unchanged both modes. |
| Normal ≤640 unchanged | ✓ Pass | Normal already squeezed columns to the 30px floor via its `overflowX:auto` wrapper; `table-layout: fixed` makes that authoritative without altering the result. Normal mode never carries `.sr-bc-card` (asserted by test L391). |
| Breeding Codes only (Multimedia / `LifeListTable.tsx` untouched) | ✓ Pass | `git diff` touches only `BreedingCodeTable.tsx`, its test, and `globals.css`. `LifeListTable.tsx` not in the diff. |
| Fix stays inside the class convention (no defeating inline width) | ✓ Pass | Table has no inline `width`/`minWidth`/`tableLayout`; wideMode card has no inline `width`. Asserted by the new `unbounded-column-narrowing` test block (L317-398) so the media queries can bind (specificity guard). |

## Regression Review (code + tests)

Confirmed no regression to the Breeding Codes matrix. Verified in code and covered by tests:

- **Sort** (A–Z / Taxonomic / per-code): `nameCompare` + `handleHeaderClick` unchanged; header-button sort covered (tests L59, L134).
- **Filters** (category via `filter` Set; the county/date filters are upstream in the tab, not this component): filter logic unchanged; empty-result path covered (L90).
- **wideMode / "↔ Unbounded" toggle**: sticky name column kept in Normal, dropped in wideMode — asserted for corner + row cells in both modes (L153, L260, L268).
- **Tier dot colors + count badge**: `TIER_COLORS` / `TIER_TEXT_COLORS` untouched; badge tier-category `.sr-only` text asserted (L73).
- **`.sr-only` tier text, header `aria-*`**: `aria-sort` on `<th>`, full-meaning `aria-label` on code buttons — asserted (L43, L51, L134), unchanged by the layout-only edit.
- **Sticky name column (horizontal `left:0`)**: asserted present in Normal / absent in wideMode (L250, L268); `NAME_COL_WIDTH` clamp still declared on corner + name cells so fixed layout distributes cleanly (L357).
- **Vertical `--sr-border-subtle` separators**: `.sr-bc-code-col` / `.sr-bc-name-col` border rules untouched; class presence on all cells asserted (L190, L198).
- **Natural page scroll + legend after table**: wrapper is `overflowX:auto` only, no `maxHeight`/`overflow`, no capped-box class — asserted (L292); legend markup unchanged.
- **Class contracts asserted with no defeating inline styles**: the new test block (L305-399) locks `.sr-bc-matrix` on the table and `.sr-bc-card` on the wideMode card, each with empty inline `width`/`minWidth`/`tableLayout`, in BOTH modes — exactly the specificity guard the media queries depend on.

## Convention Checks

| Check | Result |
|---|---|
| Tokens only, no hardcoded hex/rgb in changed CSS | ✓ Pass — the changed rules carry only width/layout properties; borders reuse `var(--sr-border-subtle)`. |
| No em dashes in user-facing copy | ✓ Pass — the change adds no user-facing strings; the only `—` occurrences are in code comments (explicitly out of scope). |
| No `console.log` / `debugger` / dead code | ✓ Pass — none in `BreedingCodeTable.tsx`; edit is class-hook + CSS only. |
| Scope discipline (no stray files) | ✓ Pass — diff limited to the three intended files. |

## Known Limitations

- **jsdom / CI cannot evaluate layout or media queries.** The automated suite proves the
  class hooks are present and that no inline `width`/`minWidth`/`tableLayout` defeats the
  ≤640 rules (the specificity guard), plus every accessibility/sort/separator invariant.
  The actual pixel narrowing (30px columns in Unbounded @≤640), the card hugging the table,
  the horizontal scroll reaching all far columns, and the whitespace removal were verified
  by the Engineer in a real browser at 375px — that layer is not, and cannot be, covered by
  vitest. This is the expected split for a CSS-layout change and is not a gap in the fix.
- **Dev scratch present in the working tree** (`data/` demo CSVs, `backend/.env`,
  `.claude/launch.json`, a running preview server) — per the session-state note these must
  be purged before the release commit. Flagged for the Deployer, not a QA blocker.

## Convention Flags

None. The fix reinforces the existing standing conventions (lift responsive layout to a
class so a media query can reach it; `table-layout: fixed` is the sanctioned way to make
`.sr-bc-code-col` widths bind) without introducing a new pattern worth codifying.
