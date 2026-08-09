# Bug Brief — Mobile Filter Text Size

## What is broken
On phones (≤640px) the filter rows mix two text sizes. `.sr-input-16` (`globals.css:1880`, `font-size: 16px !important`, phone tier only) forces every `<select>`/date input to 16px for the iOS focus-zoom guard, while the pills, sort toggles and switches beside them stay at their inline `0.75rem` (12px at 1x): `pillStyle` (`LifeList.tsx:103`), `sortToggleBtn` (`LifeList.tsx:539`), `ToggleSwitch` (`ui/ToggleSwitch.tsx:45,52`). They wrap in one flex row, so 12px and 16px sit side by side. It also **inverts** at large text scale: root is `calc(100% * var(--sr-text-scale))` (`globals.css:643`), so at 200% the pills reach 24px while the controls stay pinned at 16px. Desktop is unaffected (both 12px).

## Steps to reproduce
1. Load an eBird backup plus an ML export, open the **Multimedia** tab at a phone width (~402px, or any viewport ≤640px).
2. Read across the wrapped filter row: the "Has media" / "Is Target" / "Has photo" pills against the "Any sex", "Any age" and "All Counties" dropdowns.
3. Pills compute to 12px, the three dropdowns and both date inputs to 16px (`LifeList.tsx:655,669,738,770,790`).
4. Widen past 640px: both sides return to 12px and the mismatch disappears, confirming it is phone-only.
5. Back at phone width, set Text Size to 200% in Settings: the mismatch inverts, pills at 24px against controls still pinned at 16px.

## Expected behavior
Every interactive control in a filter row reads at one size, at 1x and at 200%, without any control dropping below 16px on a phone. Recommended fix is option (a), raise the neighbours, expressed once in `globals.css` as a shared phone-tier `font-size: max(16px, 0.75rem)` applied to both the guarded controls and their pill/toggle/switch neighbours: 16px for both at 1x (consistent, iOS-safe), 24px for both at 200% (consistent, and it scales again). Shrinking the selects is not available, sub-16px reintroduces the exact iOS focus zoom `.sr-input-16` was added for in v0.5.55/v0.5.61, and a `maximum-scale` viewport clamp would kill pinch zoom. Option (c), moving only same-row neighbours, is not implementable: the filter row is one wrapping flex container, so membership shifts with viewport width and with conditional controls (county select, non-bird toggle), leaving no stable subset.
**Cost, stated plainly:** pill text grows 1.333x while the fixed 24px padding and ~11px icon do not, so a representative pill ("Has media") widens ~24%, roughly one item fewer per row. Multimedia's filter block goes from about 10 rows to about 12 at 402px, and likely +3 rows at 320px, pushing the table further down. The pills' fixed `height: 30` still fits 16px, but The Engineer should confirm no clipping at 200%, where that fixed height binds both sides equally (pre-existing, not worsened).
**Not fully eliminated:** the uppercase section labels in these rows are deliberately smaller (`rowLabelStyle` 0.71875rem in `Checklists.tsx:299`, `ctrlLabelStyle` 0.6875rem in `Calendar.tsx:1072`, `SegControl` 0.71875rem). This fix makes the *controls* one size and leaves those labels smaller by design, so the row will not be literally single-size.

## Blast radius
Five tabs share the defect and should be fixed together, app-wide in `globals.css` rather than per-tab: **LifeList.tsx** (serves both Life List and Multimedia, worst case, 5 guarded controls among ~16 pills/toggles), **Checklists.tsx** (`674,690,702,711`, TriPills adjacent), **BreedingCodeList.tsx** (`442,482,500`, A–Z/Taxonomic buttons at 0.75rem in the same row, `400-425`), **SpeciesDetail.tsx** (`492,509,537,553`), **Calendar.tsx** (`965`, combobox `sm` at 0.75rem beside SegControl).
Milder and lower priority: **WeatherForecastPanel.tsx** (`390,405,409,413,417`, inputs at 0.84375rem in a form grid, no pill neighbours) and **App.tsx** (`835`, a lone 0.875rem input with nothing beside it).
Clean, no form controls so no adjacency: List Comparer, Named Birds, Statistics, Media Stats, Weather Backlog, Breeding Code Table, Checklist Comparer.
**Separate finding, flag before touching:** `MapExplorer.tsx` has 9 form controls (`150,1030,1032,1376,1385,1387,1395,1419,1736`) and **zero** `.sr-input-16`. Its sidebar is internally consistent at 0.75rem so it does not show this bug, but every control there triggers iOS focus zoom, a v0.5.61 sweep miss. Adding the guard naively would import this mismatch into the map sidebar, so it must land with the shared rule, not before it.
Phone-only throughout (≤640px). No desktop rendering changes.

## What done looks like
At 320px and ~402px, on all five affected tabs, the interactive filter controls render at one identical size at both 1x and 200% text scale, verified by live preview on the phone rather than by reading CSS.
No form control computes below 16px on a phone (iOS focus zoom stays fixed), no page horizontal scroll appears at 320px, touch targets hold the ~44px posture, and the layout change lives in `globals.css` as a class rather than any inline style.
