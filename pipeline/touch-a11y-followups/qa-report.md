# QA Report — touch-a11y-followups (v0.5.56)

**Date:** 2026-07-02
**Test Runner:** vitest (frontend) + pytest (backend, regression guard only)
**Lane:** Improve (maintain) — regression is the primary concern
**Result:** PASSED

## Test Suite Results

| Suite | Command | Result |
|---|---|---|
| Frontend unit/component | `npx vitest run` | **1259 passed**, 106 files, 0 failed |
| Frontend lint | `npm run lint` (`eslint .`) | clean, 0 errors/warnings |
| Frontend typecheck + build | `npm run build` (`tsc -b && vite build`) | `✓ built` (tsc passed) |
| Entry-chunk guard | `entryChunk.test.ts` | **7/7 passed** |
| Backend (untouched-check) | `.venv/bin/pytest tests/` | **172 passed**, 0 failed |

Notes:
- Vitest count (1259) matches the implementation-notes baseline exactly (1257 pre-existing + 2 new assertions).
- The build's only warning is the documented, pre-existing >1100 kB on-demand chunks
  (`vendor-maplibre` 272.93 kB gz, `ebird-taxonomy` 472.14 kB gz, `us-counties` 1039.77 kB gz) —
  all off the entry chunk (`index-*.js` is a separate, smaller chunk), consistent with CLAUDE.md and
  confirmed green by the entry-chunk guard.
- Backend shows 172 passing and no diff to any `backend/` file — the change is frontend-only as scoped.

## Acceptance Criteria Verification

Criteria are the change brief's "What done looks like" (the Improve-lane spec).

| Criterion | Result | Evidence |
|---|---|---|
| **#26** Breeding-code meanings render as VISIBLE text in the matrix legend (`BreedingCodeTable`) | ✓ Pass | `BreedingCodeTable.tsx:314-320` renders a wrapping `flex` list of `<code> {label}` pairs via `BREEDING_CODE_MAP.get(code)!.label` — the same source the header `title`/`aria-label` use. |
| **#26** Breeding-code meanings render as VISIBLE text in the filter-pill legend (`BreedingCodeList`) | ✓ Pass | `BreedingCodeList.tsx:338-339` appends `<span>{def.label}</span>` after the bold code, reusing `def.label` (from `BREEDING_CODE_MAP`). |
| **#26** Existing `aria-label`s intact; meaning not double-announced into aria | ✓ Pass | `BreedingCodeList.tsx:332` `aria-label={`${def.label} (${code})`}` unchanged (only comment lines changed around it). Matrix legend added meaning as plain visible text with NO new aria on it — the added-lines diff introduces no `aria-*`. Screen reader reads the pill's own `aria-label` once; the visible meaning is not separately re-announced. |
| **#26** A new test asserts the visible meaning | ✓ Pass | `BreedingCodeTable.test.tsx:82-88` — `getByText('Nest Building')` + `getByText('Recently Fledged Young')`. **Mutation-verified**: removing the meaning span makes this throw → test FAILS (confirmed). |
| **#27** Comparer `MediaIcons` counts are visible text at ≤640 via new `.sr-media-count` (base-hidden / phone-revealed) | ✓ Pass | `ChecklistComparer.tsx:83` `<span className="sr-media-count" …>{n}</span>`; `globals.css:706` base `.sr-media-count { display: none; }`, `globals.css:1008` inside the ≤640 media block `.sr-media-count { display: inline; }` — same idiom as `.sr-sidecell-tag` (`globals.css:700` / `:1006`). |
| **#27** `BreedingBadge` full label NOT inlined (left to #26 legend) | ✓ Pass | `ChecklistComparer.tsx:42-59` `BreedingBadge` still renders only `{def.code}`; no label text added. |
| **#27** #5 A/B side-cell tags (`.sr-sidecell-tag` / `sideLabel`, commit 081a2588) preserved | ✓ Pass | `ChecklistComparer.tsx:95-108` (`sideLabel` prop + `.sr-sidecell-tag` render) and `:183-184` (`mode==='both' ? 'A'/'B'`) fully intact; test `ChecklistComparer.test.tsx:99` (A/B-tag test) still passes. |
| **#27** A new test asserts the media-count text | ✓ Pass | `ChecklistComparer.test.tsx:89-97` — asserts `.sr-media-count` `textContent` `['2','1']` and each is `aria-hidden="true"`. **Mutation-verified**: removing the span yields `[]` → `expected [] to deeply equal ['2','1']` FAILS (confirmed). |
| **#40** Default-mode `LifeListTable` `<thead>` no longer applies the inert `position:sticky` | ✓ Pass | `LifeListTable.tsx:217` `...(wideMode ? { position: 'sticky', top: 0 } : {})`. In default mode the spread contributes nothing → no `position`/`top`. |
| **#40** `wideMode` sticky behavior byte-identical | ✓ Pass | In `wideMode` the spread yields exactly `{ position:'sticky', top:0, background:'var(--sr-bg)', boxShadow:'inset 0 -1px 0 var(--sr-border)' }` — identical to the pre-change object. `background`/`boxShadow` stay unconditional (`LifeListTable.tsx:218-219`), so the header looks identical in both modes. |
| **#40** No behavior change on any surface | ✓ Pass | Only the (inert) sticky declaration is removed from default mode; no scroll model or fill/border change. Full suite (incl. `LifeListTable.test.tsx`) green. |

## Regression Verification (Improve-lane primary concern)

| Check | Result | Evidence |
|---|---|---|
| `.sr-media-count` does not leak onto desktop | ✓ Pass | Base rule `display:none` (`globals.css:706`); shown only inside the `@media (max-width: 640px)` media block (`globals.css:1008`). No desktop-tier rule exists. |
| Breeding legend change is additive text, no layout break | ✓ Pass | Matrix legend uses `flex-wrap:wrap` with `whiteSpace:nowrap` per code chip (`BreedingCodeTable.tsx:314-317`); footer container already `flexWrap:'wrap'`. Filter pill already had gap+padding; meaning is one more inline span. Wraps gracefully on phones. |
| `LifeListTable` change removes styling only in default mode | ✓ Pass | Diff is confined to the `<tr>` `position`/`top`; `wideMode` object unchanged. |
| No hardcoded colors introduced (all `var(--sr-*)`) | ✓ Pass | Added-line scan for `#hex` / `rgb(` / `rgba(` / `hsl(` across all 5 changed files → **none**. `TIER_COLORS` (used, pre-existing) resolves to `var(--sr-tier-*)` (`breedingCodes.ts:83-88`). |
| The two new test assertions are meaningful (fail if fix reverted) | ✓ Pass | Both mutation-tested: temporarily reverting each fix made its test fail with the expected message, then restored. Full suite re-confirmed 12/12 on the two files post-restore. |
| Change is frontend-only (no backend regression) | ✓ Pass | No `backend/` file in the diff; pytest 172 passed. |
| Version bumped in lockstep | ✓ Pass | `frontend/package.json` and `src-tauri/tauri.conf.json` both `0.5.56`. |
| No overlap with the concurrent #5 session | ✓ Pass | Session-state overlap check confirmed #5's A/B work was already in commit 081a2588 and is preserved here; no conflicting edits. |

## Edge Cases Tested

- **Mutation testing of both new assertions** — each fix was independently reverted; the paired
  test failed with the expected message (`getByText('Nest Building')` throw for #26;
  `expected [] to deeply equal ['2','1']` for #27), then the original code was restored and the
  suite re-verified green. Confirms the tests are genuinely coupled to the fixes, not tautological.
- **`wideMode` byte-identity for #40** — verified by expanding the conditional spread by hand: the
  resulting style object in `wideMode` is identical to the pre-change object.
- **Token-only color discipline** — automated added-line scan across all 5 changed files found no
  color literals; `TIER_COLORS` traced to `var(--sr-tier-*)`.
- **Entry-chunk / bundle discipline** — `entryChunk.test.ts` 7/7; maplibre / counties / taxonomy
  remain off the entry chunk after this change.

## Known Limitations

- **No live 375px browser verification was run.** This QA pass verified the ≤640 reveal, the legend
  text, and wrapping at the code + test level (base-hidden/phone-revealed CSS rules, the new test
  assertions, and mutation testing), not by rendering the app in a real phone-width viewport.
  **Recommended before/at release:** a quick manual phone-width smoke (≈375px, e.g. device
  emulation) of (1) the **Breeding Codes** tab — confirm the matrix legend and the filter-pill
  legend both read `CODE Meaning` and wrap cleanly, and (2) **List Comparer → Compare Checklists**
  with a media-rich pair — confirm the small count number appears beside each camera/mic/video icon
  at ≤640 and is hidden above 640. This is a visual-polish confirmation only; functional correctness
  is already covered by the automated suite.
- `BreedingCodeList` has no dedicated test file (as noted by the Engineer); its #26 change is a
  small additive visible span reusing the same `def.label`. Verified by code reading and covered by
  the parallel, tested matrix-legend change. Low risk.

## Convention Flags

None. The work follows existing CLAUDE.md standing conventions (surface hover-only info for touch;
base-hide / ≤640 reveal via a `globals.css` class; token-only colors). `.sr-media-count` is one more
instance of the established base-hidden / phone-revealed idiom alongside `.sr-sidecell-tag` — no new
standing rule is warranted.
