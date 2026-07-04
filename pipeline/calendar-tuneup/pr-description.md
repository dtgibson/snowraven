# Calendar tune-up (v0.5.61)

Three small, frontend-only, session-only refinements to the shipped Calendar tab, plus the
extraction of a shared searchable species combobox. No new data model, network call, provider,
backend route, bundled dataset, or persisted setting.

## Changes

### 1. Searchable species filter → shared `SpeciesCombobox`
- Extracted Species Detail's inline type-to-find picker into a new shared component
  `frontend/src/components/SpeciesCombobox.tsx` (input + chevron + listbox, outside-click close,
  active-option `scrollIntoView`, case-insensitive common+scientific substring filter). ids are
  `useId()`-namespaced so two instances on one page never collide; an optional `allLabel`
  prepends an "All species" clearing row (`onChange(null)`) that survives the text filter and is
  reachable in the arrow sequence. Selection **side-effects stay in the parent** — the combobox
  owns only the ephemeral query/open/active state.
- `SpeciesDetail.tsx` now consumes it (`size="md"`); its dead local combobox state/refs/effects
  and the `filteredSpeciesList` memo are removed. It remains the reference behavior — no
  regression (`selectSpecies`, the subspecies / sp.-slash toggles, and the species-count line
  stay outside the combobox).
- `Calendar.tsx` replaces its native `<select>` with the combobox (`size="sm"`,
  `allLabel="All species"`); `onChange` sets `selectedSpecies` and closes the popup. The parent's
  `speciesFilterActive` stale-selection guard and `effectiveForms` logic are unchanged.

### 2. Phones show only the Large view
- New render-safe hook `frontend/src/lib/useIsPhone.ts` — `useSyncExternalStore` over
  `matchMedia('(max-width:640px)')` (SSR-safe `getServerSnapshot = false`). This is the
  React-sanctioned external-store media pattern, **not** a `window.innerWidth`/`resize` handler.
- `Calendar.tsx` derives `effectiveDensity = isPhone ? 'large' : density` and renders on it, so a
  stale `'compact'` carried in from a wider session can't strand a phone in the mini-month layout.
  `density` state + `ViewDensity` are unchanged.
- The View `SegControl` container gains `className="sr-cal-view-toggle"`;
  `globals.css` hides it at ≤640, tightens `.sr-cal-months` gap to 12px, and lifts the in-cell
  day-number size to a `.sr-cal-daynum` class (base 0.5625rem → 0.6875rem on phones). All rem.

### 3. Show the day-of-month date in each Large cell (the real fix)
The reported "combined shows fewer species" was **grid re-alignment**, not a count bug — the
all-years view aligns weekday columns to a fixed reference year, so a cell *position* maps to a
different date than a single-year view. The counts are correct (verified two ways, regression-locked).
The fix labels each day by its date:
- `Calendar.tsx` renders `desc.day` (already computed, pure) in the **top-left corner** of every
  Large-view cell — data, present-but-zero, AND no-data — via a small `DayCorner` helper. `day` is
  now threaded onto the `nodata` descriptor in `buildMonthCells`, so blank days are dated too. Pad
  cells stay empty. Date color: `--sr-cal-fg` on a data tier fill, `--sr-text-muted` on the
  zero/no-data surface (both already AA-guarded). The metric count stays the centered number.
- Combined view: `desc.day` is the MM-DD day, so the cell dates correctly.
- Compact/mini view stays count-only (date remains in the hover title).
- `buildDayCells`, `metricCount`, tiering, legend, and popup are untouched. Added a defensive
  one-line `Math.min(tiers.tierFor(count), 5)` tier-6 clamp at the calendar call site (not in
  `countyShading.ts`).

## Tests
- New `frontend/src/components/SpeciesCombobox.test.tsx` (jsdom): typing filters, Enter selects
  active/first, Arrow moves active, All-species clears (`onChange(null)`), Escape/Tab close, id
  namespacing.
- `Calendar.test.tsx`: rewrote the three per-species-filter tests for the combobox; added phone
  forces-Large (matchMedia-stubbed) and in-cell-date (data / no-data / combined) coverage.
- `calendar.test.ts` retains the combined-years UNION regression test (present + green).
- `calendarContrast.test.ts` unchanged (still guards `--sr-cal-fg` on every tier, both themes).

## Gates
- `npm run typecheck` (tsc -b): pass
- `npm run lint` (eslint): pass
- `npm run test`: full suite 1406 passed (113 files); targeted set 99 passed
- `npm run build` (tsc -b && vite build): pass; `vendor-maplibre` stays off the entry chunk

## Version / docs
- Bumped `frontend/package.json` + `src-tauri/tauri.conf.json` 0.5.60 → 0.5.61.
- Updated `CHANGELOG.md`, `docs/HELP.md` (Calendar section), `README.md`, `website/index.html`
  (feature copy + version pill/footer). `PRIVACY_POLICY.md` unchanged (no new network/provider).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
