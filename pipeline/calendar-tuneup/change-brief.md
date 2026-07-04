# Change Brief — calendar-tuneup batch (v0.5.61)

**Lane: Improve (confirmed).** Three small changes to the *already-shipped* Calendar tab
(shipped v0.5.58, refined in v0.5.59/v0.5.60), all built on *existing* patterns: (1) swap the
Species filter's native `<select>` for a searchable combobox by **extracting** the picker that
already exists inline in `SpeciesDetail.tsx` into one shared component; (2) on phones (≤640px)
show only the **Large** view (hide the Compact toggle + suppress the Compact branch) with a small
CSS-tier polish; and (3) a genuine **calculation bug-fix pass** on the shipped combined-years
count paths. No new data model, no new PRD, no new network call / provider / backend route /
bundled dataset / persisted setting — everything stays frontend-only and session-only, exactly the
Calendar's stated model (`frontend/src/lib/calendar.ts:1-8`, `frontend/src/components/Calendar.tsx:1-13`).
Changes 1 and 2 are polish refinements to a shipped feature; change 3 is a **bug fix** folded into
this batch (a correctness pass on the shipped combined-years math) — the same downstream stages
(Engineer → QA → closeout) apply to all three, so the mixed refinement + bug-fix batch is correct
for the Improve lane. There is **no blocking flag** and no open brand/design space (each approach
is specified concretely below). This is a lane **redirect** from a New-Feature pick — noted and
confirmed as maintenance.

**User-facing impact.**
1. The Calendar's **Species filter** becomes a **type-to-filter combobox** (identical in feel to
   Species Detail): typing narrows a scrollable list, Arrow/Enter/Escape work, an "All species" row
   at the top clears the filter. Replaces the current native `<select>` (long, unsearchable on a
   large life list).
2. On **phones (≤640px)** the Calendar always shows the **Large** month grids — the **View** toggle
   (Large | Compact) is hidden and the Compact layout is suppressed — with slightly tighter month
   spacing and marginally larger day numbers for legibility. Tablet/desktop are unchanged (both
   views + toggle remain).
3. A **correctness pass** on the shipped combined-years counts: the audit is documented, the one
   confirmed defect (if any) is fixed, and a new regression test locks the combined-years Species
   UNION invariant that was previously only partially covered.

**Decisions touched (`DECISIONS.md`).** No prior decision is **reversed**. The Calendar entries —
**"Calendar Tab … (v0.5.58)"**, **"Tab Improvements Batch … (v0.5.59)"**, and the v0.5.60 Calendar
entry (Total-count metric + "X"→0 rule, Large/Compact rename, compact mini-cell numbers) — describe
the metric/tiering/combined-view model; this batch **extends** it (a shared combobox, a phone-only
render constraint, a regression test + any confirmed calc fix), it does not reverse it. **New
decisions to LOG at closeout:** (a) the extracted shared **`SpeciesCombobox`** component (Species
Detail's inline picker is now the reference implementation, lifted for reuse); (b) the
**phone-forces-Large** rule for the Calendar view density (and the mechanism chosen — see change 2);
and (c) the outcome of the **combined-years calc audit** — either "confirmed correct, regression
test added" or the exact defect + fix if one is applied. Any changed count/aggregation semantics
get logged in the same entry.

The batch ships as **one patch release v0.5.61** (current shipped is v0.5.60): bump BOTH
`frontend/package.json` and `src-tauri/tauri.conf.json` (both currently `0.5.60`) to `0.5.61`,
update `CHANGELOG.md`, `docs/HELP.md` (the Calendar section, ~lines 217–242), `README.md`, and
`website/` (feature copy + version pill/footer) in the same change; then push → tag `v0.5.61` →
wait for Windows CI → `./release.sh` per CLAUDE.md. Run `npm run build` (not just vitest/lint) before
pushing — the extracted combobox is exactly the kind of change where an unused param/type passes
lint+vitest but fails `tsc -b` (0.5.35 post-mortem).

---

### 1 Searchable species dropdown

**What is changing.** The Calendar's Species filter is a native `<select>`
(`frontend/src/components/Calendar.tsx:818-834`) — an "All species" `<option value="">` plus one
option per name in `speciesOptions` (`Calendar.tsx:637-642`, sorted/deduped
`normalizeSpeciesName(o.commonName)`). On a large life list it is a long, unsearchable scroll.
Replace it with a **searchable combobox** identical in feel to the Species Detail picker: typing
narrows a scrollable list, Arrow/Enter/Escape/Tab work, and an **"All species"** row at the top
clears the filter.

**Approach: extract a shared `SpeciesCombobox`, then consume it in both tabs.** The Species Detail
picker is **inline JSX inside `SpeciesDetail.tsx`** (input + chevron button + listbox, roughly
`SpeciesDetail.tsx:512-645`, plus its outside-click effect, active-option `scrollIntoView` effect,
and the `selectorDisplayValue` display-value logic at `:445-447`) — **not** a reusable component
(the `speciesDetail/` dir has no combobox file). It cannot be reused as-is because there is nothing
to import and its option row bakes in a per-name scientific-name subtitle (`sciNameMap`) and routes
selection through `selectSpecies()` (which resets ~10 unrelated SpeciesDetail pieces of state).
So the crux of this refinement is a **single extraction** into a new shared component — matching
the app's shared-component convention (`ChecklistLink`, `HotspotLink`, `OutboundLink`, `BirdName`) —
with Species Detail as the reference implementation, kept behaviorally identical.

**Files / symbols.**
- **New:** `frontend/src/components/SpeciesCombobox.tsx` — lift the inline picker (input + chevron +
  listbox) with its three effects (outside-click `mousedown` listener; active-option
  `scrollIntoView`; the `dropdownOpen ? query : selected` display value) and the case-insensitive
  substring filter (currently `filteredSpeciesList` matching common **and** scientific name via
  `sciNameMap`, with the `?? ''` fallback so a missing sci name simply never matches). Proposed
  contract:
  ```ts
  interface SpeciesComboboxOption { name: string; sciName?: string }
  interface SpeciesComboboxProps {
    options: SpeciesComboboxOption[]           // already sorted upstream
    value: string | null                        // selected name; null/'' = none
    onChange: (name: string | null) => void     // null when "All / clear" chosen
    allLabel?: string                           // e.g. "All species" — renders a clearing row at top
    placeholder?: string
    ariaLabel: string
    size?: 'sm' | 'md'                           // Calendar ~30px controls; SpeciesDetail 40px
    className?: string                           // to carry .sr-input-16
  }
  ```
  Key adaptations: (a) the **"All species" reset** — SpeciesDetail has no "All" option; when
  `allLabel` is set, prepend a synthetic first option that calls `onChange(null)` and shows a check
  when `value` is `''`/null, and make it keyboard-reachable in the Arrow sequence with its own
  stable id in `aria-activedescendant`. (b) **Selection side-effects stay in the parent** — the
  combobox only owns the ephemeral `selectorQuery`/`dropdownOpen`/`activeOptionIdx`; `value`/`onChange`
  are lifted, so SpeciesDetail's `selectSpecies` reset and the Calendar's `setPopup(null)` each live
  in that parent's `onChange`. (c) **Namespace the listbox/option ids with `useId()`** so two
  comboboxes on one page can't collide on the hardcoded `species-option-{idx}` /
  `species-listbox` ids (SpeciesDetail currently hardcodes them, fine when there is one).
- `frontend/src/components/SpeciesDetail.tsx` — replace the inline block (~`:512-645`) with
  `<SpeciesCombobox options={displaySpeciesList.map(n => ({ name: n, sciName: sciNameMap.get(n) }))}
  value={selectedSpecies} onChange={selectSpecies} placeholder="Choose a species…"
  ariaLabel="Select species" size="md" className="sr-input-16" />`. Delete the now-dead local
  combobox state/refs/effects. Keep the `Show subspecies` / `Show sp./slash` toggles and the
  `{displaySpeciesList.length} species` count outside the combobox as they are today. This tab must
  stay **regression-free** — it is the reference implementation.
- `frontend/src/components/Calendar.tsx` — replace the `<select>` (`:818-834`) with
  `<SpeciesCombobox options={speciesOptions.map(name => ({ name }))} value={selectedSpecies}
  onChange={n => { setSelectedSpecies(n ?? ''); setPopup(null) }} allLabel="All species"
  placeholder="Filter to one species…" ariaLabel="Filter the calendar to one species" size="sm"
  className="sr-input-16" />`. Calendar's `options` carry **no** `sciName` (Calendar has no
  `sciNameMap`) — the filter matches on `name` only, which the `?? ''` fallback already handles.
  `selectedSpecies` stays a plain `useState` (session-only, no `storage`); `speciesFilterActive`
  (`:646`) and `effectiveForms` (`:652`) are **unchanged** — the stale-selection guard
  (`selectedSpecies !== '' && speciesOptions.includes(selectedSpecies)`) stays in the parent, so the
  combobox just renders whatever `value` it is handed and the parent decides validity.
- **New test:** `frontend/src/components/SpeciesCombobox.test.tsx` (jsdom docblock) — typing filters
  the list, Enter selects the active (or first) option, Arrow keys move active, "All species" clears
  (`onChange(null)`), Escape/Tab close. Locks the a11y contract at the component level.

**a11y (preserved from the reference + two upgrades).** Keep `role="combobox"` + `aria-expanded` +
`aria-autocomplete="list"` + `aria-controls` + `aria-haspopup="listbox"` + `aria-activedescendant`;
`role="listbox"`/`role="option"` + `aria-selected`; keyboard Arrow/Enter/Escape/Tab; active-option
`scrollIntoView`. **Upgrades:** (1) `useId()`-prefixed listbox/option ids so two instances can't
collide; (2) the "All species" synthetic row gets its own stable id and is reachable in the arrow
sequence. Add `.sr-input-16` to the input via `className` on **both** call sites — the Calendar's
control font is sub-16px (`0.75rem`) and SpeciesDetail's is 14px (`0.875rem`); both are below the
iOS 16px no-zoom threshold, so both want `.sr-input-16` (the sanctioned px exception, per the
mobile-prep conventions). Carry `position:relative; z-index` on the combobox root so the open
dropdown stacks above sibling controls (SpeciesDetail wraps its selector in `zIndex: 20`; the
Calendar control strip sits above the grid, so the same stacking context is needed).

**Edge cases.** Stale selection after a backup change → the parent's `speciesFilterActive` guard
already covers it (`Calendar.tsx:646`); keep it in the parent. Empty option list (no observations)
→ combobox renders the "All species" clearing row + a "No species match" empty state; parents gate
on the `ready` phase. Long lists (the whole point) → the listbox is `maxHeight:260; overflowY:auto`,
substring-filtered — responsive without virtualization.

**What done looks like.** The Calendar's Species control is a type-to-filter combobox identical in
feel to Species Detail: typing narrows a scrollable list, Arrow/Enter/Escape/Tab work, an "All
species" row at top clears the filter, selection re-derives the grid via the **untouched**
`buildDayCells` filter path (`Calendar.tsx:656`) and closes the popup; Species Detail behaves
exactly as before, now sharing one component; `SpeciesCombobox.test.tsx` is green; `npm run build`
+ vitest green.

---

### 2 Mobile: keep only the Large view (+ light polish)

**What is changing.** The **View** density `SegControl` (`Calendar.tsx:870-877`,
`ariaLabel="View density"`, `value={density}`, options `large`/`compact`, `LayoutGrid`/`Grid2x2`
icons; `density` is `useState<ViewDensity>('large')` at `:596`, `ViewDensity = 'large' | 'compact'`
at `:40`) gates the render at `:913`: `density === 'large' ? <MonthGrid…> : <YearOverview…>`. On a
phone (≤640px) the two layouts already converge visually — `.sr-cal-year` is single-column at ≤640
and `.sr-cal-months` is `minmax(min(280px,100%),1fr)` → also effectively one column — so Compact is
redundant on a phone (and, if a user set Compact on desktop then narrowed the window, they'd be
stranded in the mini-month layout on a phone). Make phones **always** show the Large month grids,
hide the View toggle at ≤640, and apply a small legibility polish to the Large view on phones.

**Approach: CSS-tier for the toggle (no JS resize), render-safe media hook to force the branch.**
CLAUDE.md forbids JS `window`/`resize`/`innerWidth` checks and `react-hooks/purity` forbids impure
reads in render, so the toggle-hide is **pure CSS**. But the two render branches are **different
DOM** (`MonthGrid` vs `YearOverview`), so CSS alone can't turn a mounted `YearOverview` into a
`MonthGrid` — a stale `'compact'` state carried onto a phone would still render mini-months with no
toggle to escape. So the render-branch force uses a **render-safe media hook** (NOT a resize
listener):
1. **Hide the toggle at ≤640 via CSS.** Wrap the View `SegControl`'s container (`:870-877`) in a
   class `sr-cal-view-toggle`; add `@media (max-width:640px){ .sr-cal-view-toggle{ display:none } }`
   in the existing 640 block of `globals.css`. `display:none` removes it from the tab order and the
   a11y tree on phones — correct, no orphaned control.
2. **Force the Large branch at ≤640 without a resize listener.** Add a tiny render-safe hook
   `useIsPhone()` backed by `window.matchMedia('(max-width:640px)')` via **`useSyncExternalStore`**
   (subscribe to the `MediaQueryList` `change` event; `getSnapshot = () => mql.matches`;
   `getServerSnapshot = () => false`). This is the React-sanctioned external-store media pattern —
   **not** a `window.innerWidth`/`resize` check (no innerWidth arithmetic, no per-pixel resize
   handler, no impure read in the render body), so it honors the spirit of the CLAUDE.md rule (which
   targets the imperative resize/innerWidth anti-pattern the mobile sweep removed). Then
   `const effectiveDensity = isPhone ? 'large' : density`, and render on `effectiveDensity` at
   `:913`. A phone always mounts `MonthGrid`, even if `density` is a stale `'compact'` from a wider
   session (window narrow / rotation). `density` still defaults to `'large'` (`:596`) and
   `expandMonth` still forces `'large'` (`:693-694`) — no other logic changes; `effectiveDensity` is
   the only new derived value threaded into the `:913` ternary.
   > CLAUDE.md-literalist fallback (weaker, only if the maintainer wants zero JS): rely on the CSS
   > toggle-hide alone and let the two CSS layouts converge — but this can't convert `YearOverview`'s
   > mini-months into `MonthGrid` cards, so a phone user who last chose Compact would still see
   > mini-months. This does **not** satisfy "phones always show Large," so the `useSyncExternalStore`
   > hook is recommended.

**Light polish of the Large view on phones (concrete, minimal).** In the `@media (max-width:640px)`
block: (a) tighten the inter-month spacing — `.sr-cal-months { gap: 12px; }` (down from the default
`gap:18px`) so stacked months need less scroll on a single column; (b) optionally lift the in-cell
day-number size in the phone tier via a `.sr-cal-daynum` class bumped to ~`0.8125rem` (up from the
Large cell's `0.6875rem`), so the number reads better in the large single-column cells (which are
already ≥44px via `.sr-touch-target` at ≤640). Keep both minimal and in **rem** so they hold at 200%
in-app text scale — the primary deliverable is dropping Compact, not restyling.

**Files / symbols.**
- `frontend/src/components/Calendar.tsx`: wrap the View `SegControl` container (`:870-877`) in
  `className="sr-cal-view-toggle"`; add `useIsPhone()` (a shared `frontend/src/lib/useIsPhone.ts`
  is preferred so it is reusable later, or a local hook); derive `effectiveDensity` and use it in
  the `:913` render branch. `ViewDensity` (`:40`) and `density` state are unchanged.
- `frontend/src/globals.css`: `.sr-cal-view-toggle{display:none}` and `.sr-cal-months{gap:12px}` in
  the `@media (max-width:640px)` block; optional `.sr-cal-daynum` bump.
- **New (if shared):** `frontend/src/lib/useIsPhone.ts` — `useSyncExternalStore` over
  `matchMedia('(max-width:640px)')`, SSR-safe snapshot.
- Tests: a `Calendar.test.tsx` assertion (mock `matchMedia` matching) that at phone width the
  Compact branch is never rendered and the toggle is absent; grep existing tests for the View label
  before editing.

**a11y.** Hiding the toggle with `display:none` removes it from the tab order and a11y tree on
phones (no orphaned control). The Large view's cells are already real `<button>`s with
`.sr-touch-target` (44px min at ≤640) and descriptive aria-labels; no new interactive elements. With
the hook, the forced-Large render means the (now-hidden) `density` `aria-pressed` state can't
disagree with what's shown.

**Edge cases.** Stale `'compact'` carried onto a phone (desktop → narrow/rotate) → `effectiveDensity`
forces Large, so the user never sees an orphaned Compact view with no exit. Tablet band (641–1024) →
untouched: both views + toggle remain, `.sr-cal-year` is 2-up. The 640 boundary is the established
phone line (CLAUDE.md) — don't move it. `expandMonth` (Compact → tap a mini-month → Large) is
unreachable on a phone now (Compact hidden) but harmless. 200% text scale → all sizing stays rem;
the `.sr-touch-target` min-height and any number bump are rem.

**What done looks like.** On ≤640px: no View toggle, the calendar always renders the Large month
grids (even if `density` was `'compact'` from a wider session), months stack single-column with
tightened spacing, cells stay tappable (44px) with legible numbers. On tablet/desktop: both Large
and Compact remain, toggle visible, behavior unchanged. No `window.innerWidth`/`resize` handler is
introduced. `npm run build` + vitest green.

---

### 3 Show the calendar DATE in each cell (the real fix) + counts verified correct

**REVISED after user clarification.** The reported "combined shows fewer species" is NOT a count bug and NOT the shading — it is **grid re-alignment**. The combined ("All years") view lays weekday columns against a fixed reference year, so a given cell POSITION maps to a *different date* than in a specific-year view (the user's exact words: "January 31 in 2026 became January 29 in all years"). Because the day cells render only the COUNT and carry **no visible DATE** (`Calendar.tsx:207-209` renders `desc.count` only), the user read the same grid *position* as the same day and saw a different (correct) number. Counts are verified correct TWO independent ways (union/sum ≥ single year; regression test added — see the retained audit below).

**The fix the user asked for: render the day-of-month DATE in each calendar cell, alongside the count, so a day is identified by its LABEL, not its grid position.**
- **Scope = the Large month grids only** (`DayCellButton` + the `zero`/`nodata` cell branches, `Calendar.tsx:~160-211`). EVERY real day cell — data, present-but-zero, AND no-data/blank — shows its day-of-month number so every day is labeled and unambiguous (even days with no checklist). `desc.day` is already available from `buildMonthCells` for data/zero cells; **thread `day` onto the `nodata` descriptor too** (currently `{ kind: 'nodata' }` at `:242` — add `day`) so blank days are dated as well. `pad` cells (leading blanks) stay empty.
- **Layout:** date small in the TOP-LEFT corner (wall-calendar convention), the metric count stays the prominent centered number on data days. Legibility: on a data cell the date uses `--sr-cal-fg` (the AA-guarded on-tier color) at a small size; on no-data/zero cells the date uses `--sr-text-muted` on the surface/subtle fill. Keep the `.sr-touch-target` 44px min; date + count must fit at 320px and 200% text scale (size in rem). No new color token needed (reuses `--sr-cal-fg` / `--sr-text-muted`, both already guarded).
- **Combined view:** cells show the day-of-month (well-defined — combined is keyed by `MM-DD`, and `desc.day` is that day). This is precisely what removes the re-alignment confusion.
- **Compact / mini view: unchanged** — keep the count-only heatmap (date stays in the hover `title`); mini-cells are too small for two numbers, and mobile is Large-only (change 2), so phones get dates. (Open option: add dates to Compact later if the user asks.)
- `buildDayCells`, `metricCount`, tiering, the legend, and the popup are UNCHANGED — this is purely adding the date to the Large cell render. The count/shade meaning is identical.
- Keep the combined-count UNION **regression test** (counts confirmed correct) and, optionally, the one-line `Math.min(tiers.tierFor(count), 5)` tier-6 clamp from the audit below.
- **Tests:** assert a Large-view data cell shows BOTH its day-of-month and its count; assert a no-data cell shows its date; assert the combined view dates a cell by its MM-DD day.
- **What done looks like:** in the Large view every day cell shows its calendar date in the corner plus its count; switching a specific year ↔ All Years no longer makes a day look like it "moved" (you read the date, not the position); blank days are dated; Compact unchanged; both themes AA; 320px + 200% hold; `npm run build` + vitest green.

---

### 3 (original investigation, retained for the record) Combined-years count audit

This is the **correctness core** of the batch. Two independent investigations ran: a focused
**root-cause** on the reported combined-years symptom, and a full **calculation audit** of every
count/aggregation path in `calendar.ts` + `Calendar.tsx`. Their findings are precise below.

**CONFIRMED root cause of the reported combined-years symptom: there is no count defect — the
combined path is correct, and the reported "combined shows fewer species" is a *perceptual shading*
effect, not a wrong number.** The root-cause agent tried to reproduce a broken combined-years count
first (failing-first) and it **passed**, then locked a permanent regression test. Specifically:
- `buildDayCells`' combined path computes a **true cross-year species UNION**. It runs ONE loop over
  all observations (`calendar.ts:145-174`); for combined view the bucket key is `date.slice(5)` →
  `MM-DD` (`:155`), so every year's rows for the same month/day land in the **one** bucket. Per
  bucket it accumulates a `Set<normalizedName>` (`:162,164-166`); a Set accumulated across all years
  **is** the cross-year union; `speciesCount = w.countable.size` (`:180`). There is no per-year max,
  no global dedup, no re-bucketing of pre-computed cells, and each bucket gets fresh Sets (`:158`).
- The displayed number is `metricCount(cell, 'species', includeForms)`
  (`Calendar.tsx:243`, via `buildMonthCells`), reading `speciesCount`/`speciesCountWithForms`
  directly (`calendar.ts:231-235`) — the true union, not a scaled/tiered value.
- **Test evidence:** with `2023-01-12` = Robin+Jay and `2024-01-12` = Crow, single-year 2023 = **2**,
  single-year 2024 = **1**, combined `01-12` = **3** — the union is correctly ≥ every single year.
  The v0.5.60 `total`-metric commit (`6de8f74`) left the `countable`/`withForms` species Sets
  untouched (verified by diff) — no species-accumulation regression was introduced.
- **The real mechanism the user likely saw is a perceptual, not a count, effect.** Shading is
  quantile-tiered **per view**: `tiers = computeCountyTiers(nonZeroMetricCounts(cells, metric,
  effectiveForms), 5)` (`Calendar.tsx:660-663`). In combined view the union counts are larger and
  span a wider range, so the 5-class quantile breaks shift upward — a day that was a dark top-tier in
  a single year can render **lighter** in combined even though its printed number is **larger**
  (reproduced: a `01-12` day printing 3 in-year vs 5 combined can both fall to tier 1 when surrounded
  by high-count Feb days). If the user reads *shade darkness* as "how many species," combined reads
  as "fewer/lighter." **The number itself is always correct and ≥ the single-year number.**

**The exact fix.** There is **no one-or-few-line count fix to apply** — the pure model is correct and
the union invariant is proven. The applied fix is a **permanent regression test** (already added by
the root-cause agent): a case *"combined Species UNION over DIFFERENT species per year …"* in the
combined-view `describe` block of `frontend/src/lib/calendar.test.ts`, locking
`combined ≥ max(single years)` for **differing** species per year. This case was previously untested —
the existing QA-17 test only covered the **same** species across years (the union collapsing to 1),
so the genuinely-different-species union was uncovered. All 46 tests pass; no production code
changed. **Engineer action:** confirm the added regression test is present and green, and decide with
the user whether the *perceptual* shading behavior warrants a small UX note (e.g. a legend hint) or an
absolute-vs-per-view scaling option — but that is a **product/UX** choice, **not** a defect fix, and
is out of scope for this correctness pass unless the user asks for it. If the reported symptom was
instead a smaller **printed number**, the near-certain cause is a **left-active species filter** (under
a filter, combined Species is 0-or-1 per day by design — `Calendar.tsx:646-652,656`), for which the
searchable-combobox change (§1, with its explicit "All species" clear row) is itself a mitigation.

**Other calculation issues the audit found.** The full audit traced every count/aggregation/tiering/
date path against the PRD/schema and found **no other real calculation bug**. Two items are worth
recording, both non-defects:
- **(LOW / latent, currently unreachable) `tierFor` out-of-range tier `6`.** `tierFor`
  (`countyShading.ts:197`) returns `breaks.length` for a value above the max break; `Calendar.tsx:245`
  casts `tiers.tierFor(count) as CalTier` and interpolates `var(--sr-cal-${tier})`, and there is no
  `--sr-cal-6`. **It cannot fire today** because the tiers are always computed from
  `nonZeroMetricCounts(cells, metric, effectiveForms)` over the **same** `cells`, and every rendered
  cell's `count` is `metricCount(cell, metric, effectiveForms)` — i.e. every rendered count is a
  member of the set the breaks were built from and the last break is always the max, so
  `value <= breaks[last]` always matches → tier ≤ 5. **Fix if hardening (optional):** clamp at the
  calendar call site — `Math.min(tiers.tierFor(count), 5) as CalTier` — **not** in `countyShading.ts`
  (the county overlay relies on the current `breaks.length` return). Flag as a latent fragility; a
  one-line defensive clamp is a safe, self-contained addition to this batch if the Engineer wants it,
  but it changes no current behavior.
- **(INFO / by design, not a bug) the `count === 0` present-but-zero branch.** `Calendar.tsx:244`
  renders a `zero`-kind cell for a data day whose active-metric value is 0. For Species this is the
  intended present-but-zero case; for **Total count** an all-"X" day (`individualsOf(null)=0` →
  `totalCount 0`) also renders as the present-but-zero cell — explicitly the intended v0.5.60
  behavior; for **Checklists** the branch is unreachable (a populated bucket has ≥1 submissionId).
  Confirmed correct/intended. (Relatedly, the legend `min`/`max` can read ≥1 while a visible cell
  reads 0 — the FR-20 "present-but-zero is excluded from the non-zero tiering set" contract, surfaced
  in the legend's separate "birded · 0" swatch. Intended.)

**Paths the audit verified CORRECT (brief):** single-year & combined **Species** (Set-dedup,
`isNonCountableSpecies` exclusion, union across years); **Checklists** (distinct `submissionId`,
single-year set-size = combined sum via globally-unique ids, spuh-only checklist still counts);
**Total count** (`individualsOf(o.count)`, X/null → 0, with-forms vs countable gate, SUM no-dedup,
combined sums across years, matches Statistics `individualCount` arithmetic); `individualsOf`
(`count ?? 0`, consistent with `parseEbirdObservations` `NaN → null`); tiering
(`computeCountyTiers(…, 5)`, re-tiers on metric/forms/view/filter change, empty input safe); legend
ranges (`min = breaks[i-1]+1` integer semantics); day-of-week / leading blanks (Sakamoto, Sunday=0,
combined keyed on 2000); `daysInMonth`/leap/combined Feb-29; navigable years / `defaultYear` /
`adjacentDataYear` (no `SESSION_NOW_MS`); the **species-filter + `effectiveForms`** interaction across
all three metrics and both views (filter drops non-matching rows before bucketing; `effectiveForms`
forces with-forms under a filter); and popup-vs-grid agreement (the grid cell number equals the
popup's corresponding tile). **Bottom line: no new real calculation bug; the combined-years count is
correct, the invariant is now regression-locked, and the one flaggable item (#1 above) is a latent,
currently-unreachable fragility with an optional one-line clamp.**

**What done looks like.** The combined-years Species UNION regression test is present and green in
`calendar.test.ts`; the audit outcome is recorded in the closeout `DECISIONS.md` entry ("combined-years
count confirmed correct; regression test added; perceptual per-view shading noted, not a defect");
optionally a one-line `Math.min(…, 5)` clamp at `Calendar.tsx:245` hardens the latent tier-6 case
without changing behavior; `npm run build` + vitest (all Calendar tests incl. the new regression case)
green.

---

**Batch close-out reminder.** One patch release **v0.5.61**: version bump in BOTH
`frontend/package.json` and `src-tauri/tauri.conf.json` (both currently `0.5.60` → `0.5.61`), plus
`CHANGELOG.md`, `docs/HELP.md` (Calendar section — searchable species filter; phone shows Large only),
`README.md`, and `website/` (feature list + version pill/footer, kept in lockstep) all updated
together; log a short new `DECISIONS.md` entry covering (a) the extracted shared `SpeciesCombobox`,
(b) the phone-forces-Large view rule + its `useSyncExternalStore`/`matchMedia` mechanism, and (c) the
combined-years calc audit outcome (correct + regression test added; any confirmed fix; the latent
tier-6 note) — noting the v0.5.58/v0.5.59/v0.5.60 Calendar entries are **extended, not reversed**;
then push → tag `v0.5.61` → wait for Windows CI → `./release.sh`. Run `npm run build` (not just
vitest/lint) before pushing (0.5.35 post-mortem).
