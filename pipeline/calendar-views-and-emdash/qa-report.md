# QA Report — Calendar Views + Em-Dash Removal

**Date:** 2026-07-06
**Lane:** Improve (maintain) — Session 78, Stage 3
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

Maintain-lane focus is regression (the em-dash sweep touched ~50 files) plus
confirming both improvements match the change brief. No regressions found.

## Test Suite Results

| Suite | Command | Result |
|---|---|---|
| Frontend | `npx vitest run` | **124 files, 1549 tests passing, 0 failing** |
| Backend | `.venv/bin/python -m pytest -q` | **178 passing, 0 failing** |
| Production build | `npm run build` | **Green** (`tsc -b && vite build`; TS6133 clean) |
| Lint | `npm run lint` (`eslint .`) | **Clean** (incl. `react-hooks/purity` — Calendar changed its render branch) |

The backend suite was unchanged/green as expected (this is a frontend-only run).
Note: `python`/`python3` on PATH lack pytest; the backend venv at
`backend/.venv/bin/python` is the correct interpreter (178 tests, 0.73s).

Build confirms the entry-chunk contract holds: `dist/index.html` modulepreload
contains **no** `vendor-maplibre` / `us-counties` / `CountyLayer` — Calendar and
the maps stay lazy. `entryChunk.test.ts` (the automated guard) is in the suite
and passed.

## Acceptance Criteria Verification

Mapping the change brief "What done looks like" to results.

### Item 1 — Calendar Compact/Large view modes

| Criterion (change brief) | Result | Notes |
|---|---|---|
| Phone force removed (`effectiveMode = isPhone ? 'months' : viewMode` gone) | ✓ Pass | `isPhone`/`effectiveMode`/`useIsPhone` all removed from `Calendar.tsx`; render branch (L1047) now reads `viewMode` directly. |
| `useIsPhone` import removed from Calendar | ✓ Pass | No import; the hook itself stays in `lib/useIsPhone.ts` (used elsewhere, CLAUDE.md-blessed) — only Calendar's *use to force a mode* is gone. |
| `.sr-cal-view-toggle { display:none }` ≤640 rule removed | ✓ Pass | No such selector anywhere in `globals.css`; the ≤640 block now carries an explanatory comment that the toggle stays visible on phone. |
| Phone-only date corner removed (`.sr-cal-bigday`, `bigPhone`, `.sr-cal-daynum` phone bump) | ✓ Pass | No `.sr-cal-bigday`/`bigPhone` in `src/` (only a test *comment* references the removal). |
| Compact = per-day counts, no day-of-month date, at all widths | ✓ Pass | `DayCellButton` renders `{desc.count}`, no `DayCorner`, at every width. Test asserts `.sr-cal-daynum` is `null` in Compact cells at desktop AND phone width. |
| Large = dated + shaded mini-months, no count (data on tap) | ✓ Pass | `MiniDayCell` renders `DayCorner` (dates) on the fill, no count. Test asserts day numbers (14, 15) present and no count leaks as visible text. |
| Both views distinct + reachable on a phone (toggle governs at all widths) | ✓ Pass (with live-preview note) | Test stubs `matchMedia(max-width:640px)=true` and proves clicking Large mounts 12 mini-months (previously pinned Compact); Compact re-mounts big grids. Layout at 320px / 200% needs the live preview (see Known Limitations). |
| Large single-column card clears the 152px container-query date floor on phone | ✓ Pass (structural) | The `@container (min-width:152px)` reveal is intact; single-column card is wider than 152px. Visual confirmation deferred to live preview. |
| Day tap opens the same `DayPopup` from either view | ✓ Pass | Test opens the popup from Compact and from Large for the same day; view does not switch on open. |
| `Calendar.test.tsx` phone/date describes rewritten to the NEW behavior | ✓ Pass | Two new describe blocks (v0.5.68) assert the phone toggle and the count/date split — real, non-trivial assertions, not stale/green-by-accident. |
| `tsc -b`, lint (incl. `react-hooks/purity`), vitest, `npm run build` green | ✓ Pass | All four green. |
| Calendar stays a lazy chunk (no maplibre/county entry-chunk regression) | ✓ Pass | `Calendar-*.js` is a separate chunk; entry HTML clean; `entryChunk.test.ts` green. |
| Offline / zero-network guarantee + plain-text popup location preserved | ✓ Pass | No `HotspotLink`/`useHotspotSet`/`transport`/`fetch`/`OutboundLink` in `Calendar.tsx`; popup location is escaped plain-text JSX with the do-not-linkify comment intact. |
| `calendar.ts` derivation, `--sr-cal-*` ramp, `calendarContrast.test.ts`, `calendarTextures.test.ts` untouched/green | ✓ Pass | Both contrast/texture tests present and green in the full run; ramp + derivation unchanged. |

### Item 2 — Remove em dashes from user-facing copy

| Criterion (change brief) | Result | Notes |
|---|---|---|
| No em dash (—) in any user-facing rendered string | ✓ Pass | A comment-aware scan (string-literal + JSX-text only) of `frontend/src/**` (excluding tests/golden) finds **only the 2 declared out-of-scope residuals** below. All other `—` hits are `//` or `{/* */}` comments (out of scope). |
| No em dash in `docs/HELP.md` | ✓ Pass | `grep -n '—' docs/HELP.md` returns nothing. 57 lines changed (matches the ~57 expected). |
| En dashes (–) untouched | ✓ Pass | HELP.md keeps 2 en dashes; `frontend/src` keeps en dashes across many files (year-span `2019–2025`, legend `min–max`, `(A–Z)`). |
| Weather/tide block format untouched | ✓ Pass | No em dash in the formatter *output* (only `#`/`//` comments in `weatherFormatter.ts`/`tideFormatter.ts`/`weather.py`/`tide.py`). Block output never contained em dashes (as the brief noted). |
| Comments, tests, eBird/ML data passthrough untouched | ✓ Pass (see note) | Comments/JSDoc untouched. Test files that changed are **assertion-string tracking only** (e.g. `checklistLinkAriaLabel` now emits `:` not `—`, the "Show N more" media label, the offline-replay + caches-cleared messages) — the components' new copy required the matching assertion, which is correct, not scope creep. |
| Replacements read naturally in the app's voice | ✓ Pass | Spot-checked ~15 replacements across `SnowMap`, `UpdateFooter`, `WelcomeScreen`, `offlineMessage.ts`, `WeatherBacklog`, `BirdingStats`, `Calendar` aria-labels, `CountyCompletenessPopup`, and `docs/HELP.md`. Context-appropriate periods/commas/colons/semicolons/parentheses throughout; correct capitalization after new periods; no double spaces or orphaned punctuation (whole-diff scan clean). |
| `grep -rn '—'` over rendered copy + HELP.md returns clean | ✓ Pass | Clean apart from the 2 declared residuals. |

**The 2 declared out-of-scope residuals (both correct to leave):**
1. `frontend/src/lib/mapStyle.ts:80` — `SATELLITE_ATTRIB` Esri attribution string
   (`'Tiles © Esri — Source: Esri, Maxar, …'`). A rendered string, but it is Esri's
   mandated attribution wording, not SnowRaven's own copy.
2. `frontend/src/lib/mediaStats.ts:39` — regex character class `[–—-]` in a parser,
   not display copy.

### Version + changelog

| Criterion | Result | Notes |
|---|---|---|
| `frontend/package.json` = 0.5.68 | ✓ Pass | |
| `src-tauri/tauri.conf.json` = 0.5.68 | ✓ Pass | In lockstep with package.json (CLAUDE.md requirement). |
| `CHANGELOG.md` entry coherent | ✓ Pass | `[0.5.68] - 2026-07-06`: **Fixed** (Calendar mobile), **Changed** (em-dash removal), **Internal** (the prior `--sr-switch-thumb` tokenize, folded in). Accurate and user-readable. |

## Edge Cases Tested

- **Combined ("All years") Compact cell** — carries its MM-DD count with no date corner (test `combined … carries its MM-DD count with NO date corner`).
- **Present-but-zero day cells** in both Compact and Large open the day popup with parity accessible names.
- **Large view does not switch to Compact** when a day popup opens (aria-pressed stays on Large).
- **Combined-view header glyph** `'—'` → `'·'` (a display separator, not prose) — a reasonable per-context judgment call.
- **BirdingStats empty-value placeholders** `'—'` → `'-'` (null-cell markers, not prose) — consistent across all effort tiles/tables; reads fine.
- **Whole-diff scans** for introduced double-spaces and lowercase-after-period both returned clean.

## Known Limitations

- **Live preview required for the Calendar mobile visual layout (not blocking QA).**
  jsdom verifies the render *branch* (which components mount, the count/date split,
  the toggle behavior at a stubbed phone media-query) but cannot confirm the actual
  pixel layout at 320px width or 200% in-app text scale. The change brief and the
  session note (Studio-Style, live preview before ship) both call for a desktop +
  mobile preview against real data before the Deploy gate. What the preview must
  confirm: (1) the View toggle is visible and tappable at ≤640; (2) Compact shows
  counts with no date and Large shows dated shaded mini-months at phone width;
  (3) the single-column Large mini-month card is wide enough that its day numbers
  render (clears the 152px container-query floor); (4) a day tap opens the popup
  from both views; (5) no horizontal page scroll and touch targets hold at 320px /
  200%.
- The `.sr-cal-view-toggle` class remains as a (now style-less) wrapper hook in
  `Calendar.tsx` — harmless orphan; the tests use it as a stable query anchor
  (`closest('.sr-cal-view-toggle')`). Not a defect; noted for future cleanup only.

## Convention Flags

None. The em-dash-free product-voice preference is already captured in Weft's
product-copy guidance (cited in the change brief); no new standing test or rule
emerged from this run that isn't already covered by the existing contrast/texture/
entry-chunk guards.
