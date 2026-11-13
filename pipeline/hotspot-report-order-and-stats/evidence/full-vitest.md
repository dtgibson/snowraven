# Full vitest suite and the timing-row follow-ups (2026-11-12)

Machine: this Mac, one-minute load 400 to 800 throughout from other sessions' work (not this run's; nothing of this run was compiling during the full run).

## Full run (default parallelism)
```
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 7 ⎯⎯⎯⎯⎯⎯⎯
 FAIL  src/components/Calendar.test.tsx > Calendar — grids and controls (QA-13/24/25/48) > renders the twelve month grids Jan–Dec (QA-13)
 FAIL  src/components/MapExplorerSearchThisArea.test.tsx > the presence gate (QA-01) > renders on all three centre views once the viewport has moved
 FAIL  src/components/MapExplorerSearchThisArea.test.tsx > the presence gate (QA-01) > is absent on My Sightings, at any viewport, in any state (QA-02)
 FAIL  src/components/MapExplorerWidgetLink.test.tsx > a widget link applies view, window, media, radius and one search from here (FR-36) > Media Targets, Day, Photo: the targets view, the Photo chip alone, radius 25, one search from the device position
 FAIL  src/components/MapExplorerWidgetLink.test.tsx > a widget link applies view, window, media, radius and one search from here (FR-36) > media any lands on the matching chips (2 of 2 listed) (FR-52, QA-58)
 FAIL  src/lib/hotspotShare.test.ts > the declared scan is linear (schema.md 7.1, QA-32) > doubling the rows (75k to 150k), and doubling every row's own region key, each cost about twice the CPU time
 FAIL  src/lib/lifeListsLinearity.test.ts > the Life Lists derivation is linear in rows (NFR-01, QA-44) > pass 2R (the region assets), every row its own species, 20 counties in 4 states
 Test Files  5 failed | 509 passed | 5 skipped (519)
      Tests  7 failed | 11207 passed | 8 skipped (11222)
   Duration  161.03s (transform 75.69s, setup 5.33s, import 179.25s, tests 707.01s, environment 141.62s)
rc=1
20:24  up 4 days, 19:36, 3 users, load averages: 794.36 558.48 493.63
```

## Each failing file alone, current tree
```
src/components/Calendar.test.tsx rc=0  Tests 86 passed (86)
src/components/MapExplorerSearchThisArea.test.tsx rc=1 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Tests 1 failed | 64 passed (65)
src/components/MapExplorerWidgetLink.test.tsx rc=0  Tests 56 passed (56)
src/lib/hotspotShare.test.ts rc=0  Tests 32 passed (32)
src/lib/lifeListsLinearity.test.ts rc=1 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Tests 1 failed | 19 passed (20)
AssertionError: expected 36.40554216867414 to be less than or equal to 20
20:32  up 4 days, 19:44, 3 users, load averages: 406.39 464.51 472.25

[exited with code 0]
```

## The two still red alone, on a scratch build of HEAD (git archive HEAD), same node_modules
```
now rc=1
     × renders on all three centre views once the viewport has moved 6963ms
Error: Test timed out in 5000ms.
HEAD rc=1
     × pass 2R (the region assets), every row its own species, 20 counties in 4 states 3313ms
     × the region guard can go red: the linear-search mutant of pass 1R exceeds the limit 33863ms
⎯⎯⎯⎯⎯⎯⎯ Failed Tests 2 ⎯⎯⎯⎯⎯⎯⎯
AssertionError: expected 20.23718537571227 to be less than or equal to 20
AssertionError: expected 21.348254470265086 to be less than or equal to 20
      Tests  2 failed | 83 passed (85)
20:36  up 4 days, 19:47, 3 users, load averages: 550.41 492.26 480.39

[exited with code 0]
```

## Map Explorer row, current tree alone twice, then the row alone on each copy, alternating
```
run 1 rc=1 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Tests 1 failed | 64 passed (65)  × renders on all three centre views once the viewport has moved 5500ms
run 2 rc=1 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Tests 1 failed | 64 passed (65)  × renders on all three centre views once the viewport has moved 5313ms
20:39  up 4 days, 19:51, 3 users, load averages: 493.68 468.73 471.00
Map Explorer files untouched

[exited with code 0]
snowraven  ✓ src/components/MapExplorerSearchThisArea.test.tsx > the presence gate (QA-01) > renders on all three centre views once the viewport has moved 2529ms
headbuild  ✓ src/components/MapExplorerSearchThisArea.test.tsx > the presence gate (QA-01) > renders on all three centre views once the viewport has moved 4625ms
snowraven  ✓ src/components/MapExplorerSearchThisArea.test.tsx > the presence gate (QA-01) > renders on all three centre views once the viewport has moved 1395ms
headbuild  ✓ src/components/MapExplorerSearchThisArea.test.tsx > the presence gate (QA-01) > renders on all three centre views once the viewport has moved 2501ms
20:41  up 4 days, 19:53, 3 users, load averages: 526.74 483.60 476.10

[exited with code 0]
```

## Full run with two workers (load rose from 397 to 774 during it)
```
20:54  up 4 days, 20:06, 3 users, load averages: 397.09 404.27 428.96
      Tests  16 failed | 11198 passed | 8 skipped (11222)
   Duration  1040.66s (transform 273.71s, setup 13.71s, import 470.25s, tests 1061.16s, environment 338.94s)
 FAIL  src/components/BirdingStatsCoverageDenominator.test.tsx > media documentation coverage counts only forms eBird counts > excludes a named hybrid from the denominator
 FAIL  src/components/Calendar.test.tsx > Calendar overlays: the ML export is read only while Media is on (FR-31 to FR-33, QA-35 to QA-38) > never read with Media off, through metric changes and a popup; once on the flip on; once when hydrating to on (QA-35)
 FAIL  src/components/Calendar.test.tsx > Calendar overlays: the day popup (FR-24 to FR-27, QA-27, QA-30, QA-31) > reads the overlays live: flipping Media while the popup is open adds and removes its lines (FR-27, QA-31)
 FAIL  src/components/Calendar.test.tsx > Calendar overlays: the tile, names and Large marks (FR-17 to FR-29, QA-18, QA-19, QA-21, QA-25, QA-26, QA-32, QA-33) > Media on without the export: one frame row with the total, and the plain count in the name (QA-19, QA-33)
 FAIL  src/components/Calendar.test.tsx > Calendar overlays: the tile, names and Large marks (FR-17 to FR-29, QA-18, QA-19, QA-21, QA-25, QA-26, QA-32, QA-33) > both on: the name carries every code with its category; rows are strongest first; "By category" leaves the name alone (QA-33, QA-48)
 FAIL  src/components/Calendar.test.tsx > Calendar — no re-read / no re-parse on toggle (QA-04 / QA-41) > loads exactly once on mount and never re-reads when the user flips controls
 FAIL  src/components/HotspotLink.test.tsx > HotspotLink full-name link > never adds or drops a character, over a generated corpus of names
 FAIL  src/components/Settings.icloud.test.tsx > platform gate (FR-01, QA-01) > with the gate false there is no iCloud markup, toggle, copy, or sync status region
 FAIL  src/components/lifeLists/LifeListsTab.test.tsx > paging, focus and the live region (FR-37, NFR-04; QA-39, QA-48) > shows 100, then 200, then all, and focus never falls to the body
 FAIL  src/lib/dateRangeFieldsCss.test.ts > on a phone, one register overrides all five without !important > checklists: stacks into a joined pair of wrapping fields with a visible word, at every phone width
 FAIL  src/lib/dateRangeFieldsCss.test.ts > on a phone, one register overrides all five without !important > map-sidebar: stacks into a joined pair of wrapping fields with a visible word, at every phone width
 FAIL  src/lib/dateRangeFieldsCss.test.ts > on a phone, one register overrides all five without !important > multimedia: stacks into a joined pair of wrapping fields with a visible word, at every phone width
 FAIL  src/lib/hotspotShare.test.ts > the declared scan is linear (schema.md 7.1, QA-32) > doubling the rows (75k to 150k), and doubling every row's own region key, each cost about twice the CPU time
 FAIL  src/lib/lifeListsLinearity.test.ts > the Life Lists derivation is linear in rows (NFR-01, QA-44) > pass 2R (the region assets), 200 species repeated, every row its own (state, county)
 FAIL  src/lib/tauri/taxonomyService.floor.test.ts > taxonomy bundled offline floor > normalizes a sub-form code to its parent via the bundled reportAs map
 FAIL  src/lib/tauri/taxonomyService.floor.test.ts > taxonomy bundled offline floor > resolves a species code from the bundled snapshot with no network
 Test Files  9 failed | 505 passed | 5 skipped (519)
rc=1
⎯⎯⎯⎯⎯⎯ Failed Tests 16 ⎯⎯⎯⎯⎯⎯⎯
   1 AssertionError: distinct 75k=20.616ms 150k=66.551ms CPU: expected 3.2281237873496305 to be less than 3
   1 AssertionError: expected "vi.fn()" to not be called at all, but actually been called 1 times
   1 AssertionError: expected 25.866059817938243 to be less than or equal to 20
  11 Error: Test timed out in 5000ms.
21:12  up 4 days, 20:24, 3 users, load averages: 632.86 560.61 492.55
```

## The two-worker run's newly failing files, each alone
```
src/lib/dateRangeFieldsCss.test.ts rc=1 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Tests 1 failed | 38 passed (39)  × breeding-codes: stacks into a joined pair of wrapping fields with a visible word, at every phone width 6116ms
src/components/BirdingStatsCoverageDenominator.test.tsx rc=0  Tests 2 passed (2) 
src/components/Calendar.test.tsx rc=0  Tests 86 passed (86) 
src/components/HotspotLink.test.tsx rc=1 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Tests 1 failed | 24 passed (25)  × never adds or drops a character, over a generated corpus of names 7763ms
src/components/Settings.icloud.test.tsx rc=1 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Tests 1 failed | 42 passed (43)  × the failure line goes once iCloud no longer holds synced files, and does not come back with a later upload 2447ms
src/components/lifeLists/LifeListsTab.test.tsx rc=0  Tests 46 passed (46) 
src/lib/tauri/taxonomyService.floor.test.ts rc=0  Tests 6 passed (6) 
21:17  up 4 days, 20:29, 3 users, load averages: 464.70 511.22 491.08
```

## The three still red alone, paired: current tree, then HEAD's scratch copy
```
snowraven src/lib/dateRangeFieldsCss.test.ts rc=0  Tests 39 passed (39) 
headbuild src/lib/dateRangeFieldsCss.test.ts rc=0  Tests 39 passed (39) 
snowraven src/components/HotspotLink.test.tsx rc=0  Tests 25 passed (25) 
headbuild src/components/HotspotLink.test.tsx rc=0 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯
 Tests 1 failed | 24 passed (25)  × never adds or drops a character, over a generated corpus of names 7484ms
snowraven src/components/Settings.icloud.test.tsx rc=0  Tests 43 passed (43) 
headbuild src/components/Settings.icloud.test.tsx rc=0  Tests 43 passed (43) 
21:21  up 4 days, 20:33, 3 users, load averages: 485.45 470.81 476.14
```

## Full run on a quiet machine (2026-11-13 00:11, one-minute load 1.6), after the D-11 errand
```
 Test Files  514 passed | 5 skipped (519)
      Tests  11215 passed | 8 skipped (11223)
   Duration  75.28s (transform 17.40s, setup 3.80s, import 65.09s, tests 332.87s, environment 69.03s)
rc=0
```

Every failure in the two loaded runs above is absent here; none was in a file this change touches.
