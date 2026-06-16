# Responsive Audit — mobile-responsive-sweep
_Read-only audit produced at Stage 1 (The Evaluator) by a 10-agent parallel sweep + consolidation. Supporting material for The Engineer. The gate artifact is `change-brief.md`._
**119 findings across 10 screen groups — 19 high, 37 medium, 63 low.**

## Systemic patterns (fix the family, fix every instance)
### 1. space-between flex row + flexShrink:0/whiteSpace:nowrap action button + NO flexWrap (growable text gets crushed or the row overflows). This is THE dominant defect class app-wide.
- **Where:** App.tsx warning banners (684-723) & tide notice (929-943); WeatherForecastPanel too-far (446); WeatherTidePanel comparer too-far (207); WeatherTideSection Nudge (67) & header (114); SpeciesDetail filter strip (725-744); LifeList strip (790-810); BreedingCodeList strip (464-484); ResultsView header (42-103); Settings Documentation card (1184-1218). ~10+ instances.
- **Fix:** Add a single shared class (e.g. .sr-action-row) carrying flexWrap:'wrap'+rowGap and minWidth:0 on the text child; under 640px let the action button go full-width (flex-basis:100%). Move the inline flex to the class so the existing 640px block reaches it. One rule fixes the whole family.
### 2. flex:1 text child WITHOUT minWidth:0 next to a nowrap count/pill/icon. A flex child cannot shrink below its longest word unless minWidth:0 is set, so it pushes the trailing element into overflow (clipped by SectionCard overflow:hidden, not scrollable).
- **Where:** SpeciesDetail Breeding Codes (1009-1025), Top Locations (1139-1164), Reported With (1080-1101), selector option (566-597); BirdingStats top-locations (836-857); NamedBirdRow header (35-63); Checklists count pairs.
- **Fix:** Add minWidth:0 + overflow:hidden/textOverflow:ellipsis (or overflowWrap:anywhere) to every flex:1 text span paired with a fixed/nowrap sibling. Cheap, broad; hardens the whole class at the call sites.
### 3. Fixed multi-column inline grid that never collapses (inline display:grid can't be reached by the 640px media block — documented at globals.css 532-534). Includes fixed N-col grids and fixed-px pie/donut companion columns.
- **Where:** BirdingStats month '1fr 160px' (680), observer '1fr 160px' (1192), breeding repeat(3,1fr) (1515); WeatherForecastPanel tide 2-col (124) & lat/lng/date/time 2x2 (377); Settings default-location '1fr 1fr 88px' (1340); ListComparer dropzone inline 1fr 1fr (235-275); ChecklistComparer comments grid (549).
- **Fix:** Lift these to reusable class hooks the way .sr-two-col already is: a .sr-grid-auto (repeat(auto-fill,minmax(min,1fr)) — self-collapsing, no breakpoint math) plus named .sr-grid-2/.sr-grid-3 that drop to 1fr under 640px. FrivolousListsSections NAME_GRID auto-fill is the in-repo reference.
### 4. width:100% table inside overflowX:auto with NO minWidth → wrapper never scrolls, columns crush and headers wrap to 3-4 lines. The app already has the correct fix elsewhere (wideMode → width:'max-content' in LifeListTable/BreedingCodeTable).
- **Where:** BirdingStats protocol-averages table (1147-1167) & biggest-counts table (1426-1458); SpeciesDetail NamedBirdsTable call site lacks any overflowX wrapper (1393-1403).
- **Fix:** Give these tables width:'max-content' (or a sensible minWidth) inside their existing overflowX:'auto' wrapper so the scroll actually engages on phones — the documented house pattern. Wrap NamedBirdsTable at its call site too (SectionCard is overflow:hidden, so unscrolled overflow is lost).
### 5. Inner pill/toggle group with display:flex;gap:4 and NO flexWrap, even when the OUTER row wraps. A 4-pill group (~230px) alone exceeds ~300px usable card width and clips the last pill ('Total').
- **Where:** BirdingStats accumulation granularity (470-490), breeding tier filter (1532), media mode/interval (1632/1652); SpeciesDetail Graph Options pill groups (966-996).
- **Fix:** Add flexWrap:'wrap' to the inner pill groups (not just the outer rows). MediaStatsSections age-sort header (215) is the correct wrap-enabled reference.
### 6. Atomic two-native-date-input range group (inline-flex, no flexWrap). Native type=date inputs have a hard intrinsic min-width (~95-130px) that does NOT shrink, so two inputs + the '→' floor near ~230-260px and overflow at <=375px regardless of an outer wrap.
- **Where:** WeatherForecastPanel predict 2x2 (377); SpeciesDetail filter (633-667); LifeList date range (740-774); BreedingCodeList date range (409-447).
- **Fix:** Let the inner date group wrap (flexWrap) and/or stack From/To full-width under 640px via a class. This is the one place where 'just add minWidth:0' will NOT help — the inputs have a real intrinsic floor.
### 7. Component-local horizontal padding (SectionCard, predict/result panels, SetupRequired, HelpDocs row, footer) is inline, so the 640px .sr-card/.sr-panel padding-trim never reaches it — phones keep desktop side padding.
- **Where:** SectionCard (BirdingStats/SpeciesDetail); WeatherForecastPanel panels (349/419/472); SetupRequired (52px 32px); HelpDocs .sr-help-row padding:'0 24px' (352); App footer 24px (1196-1324); App SetupRequired-style empty states.
- **Fix:** Give each a class and add a horizontal-padding override to the existing 640px block (mirroring .sr-card). Low individual severity but compounds with the fixed-width content inside.
### 8. Fixed-px chart/map heights with one (or zero) breakpoint step; recharts ResponsiveContainer is width-responsive but height is hardcoded.
- **Where:** SightingsGraph height=220 (all 3 charts), -16 left margin clips Y tick at 320px; MediaStatsSections donut 132 / BirdingStats pie 120 don't scale; .sr-media-iframe fixed 280/360px ignores aspect; .sr-map-container fixed 380/300; PredictMap fixed 180.
- **Fix:** Prefer aspect-ratio (16/9 for iframes) and dvh/clamp-based heights over fixed px; verify the recharts -16 left margin at 320px. Lower priority than overflow defects.

## Recommended approach
EXTEND the existing class-hook + 640px pattern; do NOT rewrite inline styles wholesale. The architecture constraint is documented at globals.css 532-534 and DECISIONS.md 1541: React inline styles are specificity 1,0,0 and BEAT class rules, and inline grids can't be media-queried — that is exactly why .sr-two-col/.sr-compare-panels/.sr-media-grid were lifted to classes. Follow that same lift-to-class move for the offending containers only.

Concrete sweep order: (1) Add a small shared class vocabulary to globals.css and override it in the breakpoint blocks — .sr-action-row (flexWrap+rowGap+minWidth:0 child, action full-width under 640), .sr-grid-auto (repeat(auto-fill,minmax(min,1fr)), self-collapsing), .sr-grid-2/.sr-grid-3 (drop to 1fr under 640), .sr-container (max-width ~1280-1400 + margin-inline:auto for the >=1440 cap). (2) Migrate the ~10 space-between-no-wrap rows and the ~6 fixed-column grids to these classes (purely swap inline display:flex/grid for className). (3) Sprinkle minWidth:0 + ellipsis on the flex:1-without-minWidth:0 text spans IN PLACE (these are leaf-level, no class needed). (4) Apply width:'max-content' to the two crushing Stats tables and wrap NamedBirdsTable's call site, matching LifeListTable's existing wideMode pattern. (5) Harden the BarRow primitive's label span (overflow:hidden+ellipsis) once — it fixes every Stats consumer at once. (6) Let the atomic date-input groups wrap. (7) Add an overflow-x backstop (html/body overflow-x:hidden or a min-width:0 utility) as a SAFETY NET only — real fixes stay per-component. (8) Delete index.css and App.css. Keep all changes additive to the rem/token/reduced-motion layer, which is sound.

## Breakpoint strategy
Keep mobile-first and minimal — four tiers, not a full framework. Keep 640px as the existing phone/tablet boundary (do not move it; lots already hangs off it). ADD: ~480px (small-phone tightening — padding trims, the tightest grids to 1col, the date-input stacks), ~1024px (laptop — optional two/three-col enablement for the tablet band that currently gets nothing between 641 and desktop), and a >=1440px container cap via a single .sr-container max-width hook (there is currently NO upper bound anywhere). Prefer self-collapsing grids (repeat(auto-fill,minmax(min,1fr))) so most cases need ZERO breakpoint math — reserve explicit .sr-grid-2/-3 collapses for the few that need column control. Name the tiers in comments/CSS vars so a future sweep targets class hooks, not inline styles. Do not introduce JS window/resize checks in MapExplorer — DECISIONS.md 1539 forbids it; the map stays CSS-class + ResizeObserver only.

## Effort sizing
Medium sweep, ~2-3 focused days. The work is bounded because the fixes collapse into ~8 systemic patterns, not 119 one-offs. Roughly: ~0.5d CSS infra (new class hooks + 4 breakpoints + container cap + overflow backstop + delete dead CSS); ~1d migrating the ~16 high/med containers (space-between rows + fixed grids + 2 tables) to the class hooks; ~0.5d leaf-level minWidth:0/ellipsis + BarRow primitive + date-group wraps; ~0.5-1d real-viewport verification at 320/360px AND 360px@200% text-scale across all 9 screens plus the regression-risk re-check (focus traps, map overlay display-toggle, table wideMode, fullscreen). 6 high-severity screens carry the bulk; overlays-shared and app-shell are mostly low and quick. Effort labels in findings skew S/M; no L except the breakpoint-infra item itself.

## Dead code
Confirmed dead: both frontend/src/index.css and frontend/src/App.css. Verified directly — main.tsx imports ONLY './globals.css' (and SnowMap imports maplibre-gl.css); grep across src + index.html finds ZERO references to index.css or App.css. Both are Vite/Tauri React-TS starter boilerplate (App.css = .hero/#next-steps/Vite-logo demo selectors that don't exist in the app; index.css = starter tokens + a duplicate @import 'tailwindcss' + #root{width:1126px} + a competing @media(max-width:1024px) font tier). DELETE BOTH as cleanup. index.css is the more dangerous one: if ever accidentally imported it would impose a 1126px fixed root width and a conflicting 1024px breakpoint tier. No version bump needed for the deletion itself (no behavior change), though follow the repo's bump-on-change convention if shipped with the responsive sweep.

## Coverage gaps — must verify in a real viewport
- IN-APP TEXT-SIZE SCALE (--sr-text-scale, up to 200%) interacting with layout: every audit reasoned at scale=1 but explicitly flagged that nowrap/fixed-px/fixed-rem rows overflow far sooner at 150-200%. The build MUST re-test the high-severity rows (FileRow/KeyRow, mode bar, In-Both side cells, filter strips, pill groups) at 200% scale on a 360px viewport — fixed-rem widths like SIDE_CELL_WIDTH 8.25rem GROW with scale, so an 8.25rem cell becomes ~264px at 200%.
- EMPTY / UNSET / LOADING / ERROR / TOO-FAR states: under-covered except in Settings (where the empty-state status pill is the WORST collision for FileRow/KeyRow) and Weather (too-far/out-of-range branches add the action-button-beside-text rows). Verify: 'No file saved'/'No key saved' pills, tide too-far + 'Show nearest station anyway', map 'Finding nearby lifers…' loading chip vs the layers switcher, and empty-list states. Loading chips were noted only in passing.
- VERY LONG SPECIES / SUBSPECIES / PLACE NAMES: callouts exist (eBird hotspot names like 'Point Reyes National Seashore--Drakes Beach Parking Lot', subspecies parentheticals, long CSV filenames in ResultsView). Build must seed real long values, not short demo labels — several rows 'fit today' only because current labels are short (tab-layout rows, HelpDocs header/TOC, breeding-code labels).
- LANDSCAPE PHONE / SHORT VIEWPORT: only the tab dropdown (no max-height → Settings unreachable) and the map calc(100vh-178px) were tied to short height. Build should test ~360px-TALL landscape: open tab dropdown reaching Settings, map height not collapsing to a sliver, inline maps (380/300px) crowding a ~360px-tall viewport.
- MAP FULLSCREEN ON A PHONE: the overlay path (position:fixed/inset:0/100dvh) is intentional and correct, but width:100vw is redundant and can add a 1-2px horizontal scrollbar on classic-scrollbar engines; the mode bar / top overlays still render inside fullscreen and inherit the same no-wrap defects — verify the mode bar in fullscreen too.
- ULTRA-WIDE DESKTOP (>=1440px): no global max-width container anywhere; several screens self-cap (Settings 680, Stats 900, Comparers 880) but the Map Explorer, full-width SectionCards, and any inline full-width grid stretch edge-to-edge. Reading measures and 2/3-up grids stay 2/3-up at 1920px with no denser tier. Lower priority than narrow.
- POPUP CONTENT AT 320px: map *Markers.tsx popups (260-280px) were OUTSIDE the map-explorer auditor's file set — flagged but NOT audited. 280px ≈ 88% of a 320px screen; verify long location/species/comment text inside Sighting/Hotspot/Target popups.
- THE TABLET BAND (641-820px): the single 640px breakpoint means a 268px fixed map sidebar + map at ~700px leaves a very narrow map, and grids that go 2/3-up at 641px get no intermediate treatment. No 480px small-phone tier either, so 320-375 gets the same rules as 640px.
- WHAT TO VERIFY IN A REAL NARROW VIEWPORT (must-do): load the app at 320 and 360px (and 360px at 200% text scale) and scroll EVERY tab watching for (a) a sideways-scrolling page — there is currently NO overflow-x backstop, so one stray element scrolls the whole page; (b) clipped content inside overflow:hidden SectionCards/cards (it won't scroll, it just vanishes); (c) the four-pill mode bar, the In-Both rows, FileRow/KeyRow empty states, and all filter strips specifically.

## Top regression risks to protect
- MAP SIDEBAR display-toggle (DECISIONS.md 1541, the v0.1.1 correction): NEVER put `display` on the .sr-map-sidebar-overlay element or any element whose CSS class toggles display — React inline styles (specificity 1,0,0) override the class's `display:none` and silently break the mobile overlay (this exact bug shipped once). If the sweep migrates the sidebar or any class-toggled element to a class, keep display OFF the inline style. Same goes for the Filters FAB (double-gated: display:none on desktop + conditional render).
- MAP OVERLAY Z-INDEX: floating overlays over the map must stay at z-index 1200 (DECISIONS.md: above MapLibre controls; the responsive tab dropdown uses 1200). If the tab-dropdown max-height fix or any new overlay touches stacking, preserve 1200. Don't lower the fullscreen overlay's 1200 either.
- TABLE wideMode / width:'max-content' horizontal-scroll pattern: LifeListTable (207) and BreedingCodeTable (128/132) already implement this correctly with a sticky first column and scrollPaddingLeft. When applying the SAME pattern to the two crushing Stats tables, do NOT alter the existing tables' wideMode branch or the sticky-column boxShadow/z-index — match it, don't refactor it. NamedBirdsTable's single-open accordion (caps WebGL contexts) must not be disturbed by adding the overflowX wrapper at its call site.
- FOCUS MANAGEMENT & FOCUS TRAPS (overlays/map): the tab-dropdown max-height/scroll fix and any sidebar/overlay change must not break the close-restores-focus contract or the re-query-focusables-per-Tab trap (HelpDocs.tsx, MapExplorer.tsx restoreFiltersFocusRef pattern). Adding overflowY:auto to the dropdown is fine; do not change its keyboard/listbox semantics.
- IN-APP TEXT-SIZE SCALE (--sr-text-scale on html font-size, calc at globals.css 510): all fixes must hold at 200%. rem/em-based widths (SIDE_CELL_WIDTH 8.25rem, BarRow rem label widths) GROW with scale — verify the new wrap/collapse rules trigger correctly when a fixed-rem element is enlarged. Do NOT convert rem sizing to px to 'fix' overflow; that would break the accessibility scale.
- TabNav overflow-driven collapse (ResizeObserver probe, NOT a fixed breakpoint): robust today; the only defect is the un-capped dropdown height. Do not convert TabNav to a media-query/window-width collapse — keep the ResizeObserver mechanism; just add max-height+overflowY to the listbox.
- OVERFLOW-X BACKSTOP regression: if html/body{overflow-x:hidden} is added as a safety net, verify it does not clip the map fullscreen overlay or any intentionally-positioned element, and does not suppress a legitimately-needed scroll (e.g. the wideMode page-scroll tables rely on horizontal scroll). Treat it as a backstop, not the fix.

## Prioritized screens
- **Statistics (BirdingStats + Frivolous + MediaStats + statsPrimitives)** — _high_, 4 high. Two fixed '1fr 160px' pie-companion grids crush the chart/bar column, two width:100% tables crush instead of scrolling, the Rainbow Warrior row overflows; plus a swarm of non-wrapping inner pill groups and a no-ellipsis BarRow primitive that leaks across every consumer.
- **Species Detail (SpeciesDetail + SightingsGraph)** — _high_, 2 high. Active-filter strip (space-between, no wrap, no minWidth:0) and the 'Reported With' table (~282px of fixed cells) hard-overflow; recurring flex:1-without-minWidth:0 rows (Breeding Codes, Top Locations, selector) clip inside overflow:hidden SectionCards.
- **Comparers & Checklists (ChecklistComparer + ResultsView + ListComparer + Checklists)** — _high_, 4 high. ChecklistComparer 'In Both' twin 8.25rem side cells + matching side headers leave no room for the bird name; comments 3-col grid clips inside overflow:hidden with no collapse; ResultsView header lacks the flexWrap its sibling has; ListComparer dropzones use an inline 1fr 1fr that never collapses.
- **Map Explorer (MapExplorer + App map panel + SnowMap + AtlasLayer)** — _high_, 2 high. Four nowrap mode-bar pills force horizontal overflow (top suspect for the confirmed phone overlap); calc(100vh-178px) bakes desktop chrome height and mis-sizes against the taller phone nav + wrapping footer; top-anchored map overlays can collide and the atlas blocklist blankets a phone map.
- **Settings (Settings + DropZone)** — _high_, 2 high. FileRow and KeyRow are icon + flex:1 text + fixed nowrap button-group with no flexWrap; the empty/unset state adds a status pill, the worst-case collision. Default-location 3-col grid never collapses; worsens sharply at the in-app 150-200% text scale.
- **Data Tables (NamedBirdRow + LifeList + BreedingCodeList + tables)** — _high_, 1 high. NamedBirdRow collapsed header has flexShrink:0 on BOTH ends so the right date-range/count group overflows and is clipped by overflow:hidden; the two filter strips and date-range groups repeat the space-between and atomic-date-group patterns. The actual tables already use wideMode correctly.
- **App Shell / Nav (App.tsx + TabNav + SetupRequired)** — _med_, 0 high. Map panel magic-number height (shared with Map Explorer) is the structural item; warning/tide banner rows are space-between-no-wrap; collapsed tab dropdown has no max-height (Settings unreachable on a short/landscape phone); footer wraps raggedly.
- **Weather / Forecast / Tide** — _high_, 1 high. Lat/lng/date/time 2x2 grid with native date/time inputs forces real overflow at <=375px (high); tide Next/Prev fixed 2-col never collapses; four space-between too-far/nudge/header rows repeat the no-wrap-button pattern. .sr-two-col comparer collapse is already correct.
- **Overlays / Shared primitives (HelpDocs + CommentText + SpeciesLinks + BirdName + ToggleSwitch)** — _low_, 0 high. No standalone hard overlaps. Help row keeps 24px padding at 640px; inline <code> and plain comment segments lack overflow-wrap (links already have it); SpeciesLinks adds a fixed ~58px favicon cluster to every BirdName that crowds narrow table cells (true fix lives in host tables).

---

## Full findings by screen

### Map Explorer (sidebar, controls, mode bar, fullscreen, popups, atlas)
_Auditor notes:_ Cross-checked against the 640px block first. Already handled there (NOT reported): the sidebar becoming a `min(282px,90vw)` absolute overlay with display:none when hidden, the Filters button (`.sr-map-filters-btn`) showing, the sidebar close header (`.sr-map-sidebar-close`) showing, and the backdrop. The FAB cluster (`.sr-map-fab-cluster`, bottom-right, flex gap) is structurally collision-proof per its comment and reads fine on phones — not reported.\n\nThe single highest-confidence defect is the mode bar (mode-bar-no-wrap): four nowrap pills in a non-wrapping flex row are the clearest cause of the user-confirmed phone overlap/horizontal overflow. The panel-fixed-height-178 finding is the second structural issue — the calc(100vh-178px) bakes in desktop chrome height that the 640px block changes.\n\nWithin my assigned files the in-marker Popup maxWidth I could see is AtlasLayer's 240px (fits 320px) — fine. The other Popups (Sighting/Hotspot/Target markers, 260-280px) live in map/*Markers.tsx which are OUTSIDE my assigned file set, so I did not audit their content/overflow; flag for the owner of those files that 280px popups sit right at the edge of a 320px viewport and their inner content (long location/species names, comment text) should be width-checked.\n\nDesktop (>=1440px): the Map Explorer is map-dominated (sidebar fixed 268px, map flex:1), so it scales acceptably wide — no awkward whitespace there. The main desktop-adjacent note is the redundant 100vw in fullscreen.\n\nUncertainty: exact pixel collision points depend on the app's user Text Size multiplier on html font-size; the mode-bar overflow is certain in direction even if the exact breakpoint varies (a larger Text Size makes it worse and can overflow even above 360px).

#### [HIGH/S] Map view mode bar is a non-wrapping flex row of 4 wide pills
`frontend/src/components/MapExplorer.tsx:1631-1672`
- **Problem:** The mode bar is `display:'flex', gap:8` with four pill buttons, each `padding:'7px 14px'`, `whiteSpace:'nowrap'`, an icon + label ("My Sightings", "Hotspots", "Media Targets", "Nearby Lifers"). There is NO flexWrap, so the row cannot wrap.
- **On a phone:** At 360/375/320px the four nowrap pills (~roughly 360-400px of intrinsic content + gaps) exceed the viewport and force horizontal overflow of the whole Map Explorer panel — the rightmost pills (Media Targets / Nearby Lifers) clip or push the page wider. This is the most likely source of the confirmed phone overlap.
- **Fix:** Add a responsive rule: either `flexWrap:'wrap'` (let pills wrap to a second line) or, consistent with the 640px CSS-class pattern, give the bar a class and at ≤640px make it horizontally scrollable (`overflow-x:auto; flex-wrap:nowrap`) or shrink padding/hide labels to icons. Mirror the TabNav overflow approach if a dropdown is preferred.

#### [HIGH/M] Map Explorer panel height hardcoded to calc(100vh - 178px)
`frontend/src/App.tsx:1121-1128`
- **Problem:** The non-fullscreen Map Explorer tabpanel is `height:'calc(100vh - 178px)'` with `overflow:'hidden'`. The 178px is the desktop header (`.sr-header` padding-top 48px) + tab nav chrome; the 640px block raises `.sr-header` padding-top to 24px and stacks chrome differently on mobile, so the 178px offset no longer matches the actual chrome height on a phone.
- **On a phone:** On a phone the real chrome height differs from 178px, so the map area is mis-sized: either a dead gap below the map or the map under-fills / over-fills, and because the panel is `overflow:hidden` the mode bar + map can be cut off. On short landscape phones the map can shrink to a sliver.
- **On desktop:** On very tall or very short desktop windows the fixed 178px offset is approximate; mostly fine on desktop but it is the assumption that breaks on mobile.
- **Fix:** Derive the offset responsively (a CSS var for chrome height, or use flex from a 100dvh root rather than a magic-number calc), and use 100dvh not 100vh so iOS Safari URL-bar resize doesn't clip. Add a ≤640px override matching the mobile chrome height, consistent with the existing 640px-block pattern.

#### [MED/S] Atlas 'blocks in view' panel fixed at width 220 / maxHeight 60% / top 78 can dominate a phone map
`frontend/src/components/AtlasLayer.tsx:262-329`
- **Problem:** The keyboard blocklist is `position:'absolute', top:78, left:10, width:220, maxHeight:'60%'`. It is anchored top-left below the MapLibre NavigationControl (also top-left). Width 220 + left 10 = 230px.
- **On a phone:** On a 320px-wide phone the 230px panel covers ~72% of the map width, and at 60% maxHeight it covers most of a short phone-fullscreen map — it occludes the map and sits directly under/near the top-left zoom control with only a small offset (top 78 vs the zoom buttons). When expanded it can overlap the centered loading chip (top 12) region and crowd the top-right layers switcher visually. Not clipped, but it blankets the map.
- **Fix:** At narrow widths reduce the panel width (e.g. `width:min(220px, 60vw)`) and/or lower maxHeight, or collapse it by default with a smaller toggle. It already defaults collapsed, so primarily clamp the width via a responsive rule.

#### [MED/M] Three top-anchored map overlays (zoom top-left, layers switcher top-right, loading chip top-center, atlas list top-left) can collide on a phone
`frontend/src/components/SnowMap.tsx:160-174`
- **Problem:** The base/overlay switcher is `position:'absolute', top:8, right:8` (`.sr-map-layers` is a column with a segmented Map/Satellite/Topo control + Trails row). Combined with the MapLibre NavigationControl (top-left), the centered `.sr-map-loading-chip` (top 12, nowrap), and AtlasLayer's blocklist (top-left, top 78), the top band has four absolutely-positioned elements with no responsive coordination.
- **On a phone:** At 320-375px the top-right layers switcher (segmented 3-button control + Trails label) is intrinsically ~150-180px wide; with the top-center nowrap loading chip ('Finding nearby lifers…' ~170px) present during a search, the chip and the switcher can overlap/touch near the top edge. None of these reposition or shrink on narrow screens.
- **Fix:** On narrow widths, shrink/relayout the loading chip and the layers switcher (e.g. smaller padding, icon-only base buttons, or move the chip lower) so the top band doesn't crowd. Add responsive overrides to `.sr-map-layers` and `.sr-map-loading-chip`.

#### [LOW/M] Desktop sidebar is a fixed 268px; mobile overlay width set via 640px block
`frontend/src/components/MapExplorer.tsx:1686-1690`
- **Problem:** The sidebar div has inline `width:268, flexShrink:0`. On desktop this is a permanent 268px column. The 640px block overrides `.sr-map-sidebar-overlay` to `width:min(282px,90vw)` as an absolutely positioned overlay, so the narrow case IS handled — but only via the class, while the inline `width:268` still applies above 640px and at the 641-768px tablet band where the sidebar is NOT yet an overlay.
- **On a phone:** None below 640px (handled). In the 641-820px tablet band the 268px fixed sidebar + map leaves the map very narrow (~370-550px) with no overlay collapse, and the sidebar content (selects, seg controls) is cramped but not broken.
- **On desktop:** At >=1440px the 268px sidebar is fine but the map area grows unbounded; acceptable. The gap is the tablet band having no intermediate treatment (overlay only triggers at <=640px).
- **Fix:** Consider moving the overlay breakpoint up (e.g. <=820px) or making the sidebar width clamp (`width:clamp(240px,28vw,300px)`) so the tablet band gets a usable map. Keep the existing class-override mechanism.

#### [LOW/S] KeyNotice uses justifyContent:'space-between' with a nowrap 'Settings →' button
`frontend/src/components/map/MapSidebarUI.tsx:134-158`
- **Problem:** KeyNotice is a flex row `justifyContent:'space-between'` containing a left icon+text block and a right `whiteSpace:'nowrap', flexShrink:0` 'Settings →' button.
- **On a phone:** Inside the ~268px (or min(282px,90vw)) sidebar the left text 'eBird API key required. Add it in Settings to use this feature.' plus the nowrap button is tight; the left block can wrap (it's allowed) so it doesn't overflow, but on the narrowest 90vw-of-320px (~256px) overlay it is visually cramped. Lower risk because the left block wraps.
- **Fix:** Acceptable as-is, but consider allowing the row to wrap (`flexWrap:'wrap'`) at the narrowest sidebar width so the button drops below the text.

#### [LOW/S] Nearby-lifers in-view list secondary line joins ALL lifer names with no truncation
`frontend/src/components/MapExplorer.tsx:1602-1614`
- **Problem:** `getSecondary={l => `${l.count} lifer… · ${l.lifers.map(s => s.comName).join(', ')}`}` produces a comma-joined list of every lifer common name. InViewMarkerList renders the secondary line WITHOUT ellipsis/nowrap (unlike the primary, which has overflow/ellipsis/nowrap at MapSidebarUI.tsx:111).
- **On a phone:** In the ~268px / 90vw sidebar a location with many lifers (e.g. 10+ long species names) produces a long wrapped block several lines tall, ballooning the row height. It wraps rather than overflowing horizontally, so no clip, but rows become very tall and visually inconsistent on a phone.
- **On desktop:** Same tall-row effect in the desktop sidebar for dense locations.
- **Fix:** Truncate/clamp the secondary (e.g. line-clamp to 2 lines, or show 'N lifers · first few…') consistent with how the primary line ellipsizes.

#### [LOW/S] Manual target-species checkbox list fixed maxHeight 130 with up to 60 rows
`frontend/src/components/MapExplorer.tsx:1355-1371`
- **Problem:** The no-ML manual species picker is `maxHeight:130, overflowY:'auto'` rendering `filteredManualSpecies.slice(0,60)` checkbox rows.
- **On a phone:** Functionally OK (scrolls). Long species names in the `<span>` have no ellipsis but the label is `display:'flex'` and can wrap; rows just grow taller. Minor on a narrow sidebar — no horizontal overflow.
- **Fix:** Low priority; optionally ellipsize long names with overflow/textOverflow on the name span. The fixed 130px scroll height is intentional and fine.

#### [LOW/S] Fullscreen map uses width:100vw which can exceed visual viewport with a scrollbar
`frontend/src/App.tsx:1125-1126`
- **Problem:** Fullscreen mode sets `position:'fixed', inset:0, width:'100vw', height:'100dvh'`. `inset:0` already pins all edges, so the extra `width:'100vw'` is redundant and, when a vertical scrollbar is present (desktop), 100vw is wider than the content box and can introduce a horizontal scrollbar.
- **On a phone:** On phones generally fine (overlay scrollbars), but combined with `inset:0` the 100vw is redundant; on Android WebView with classic scrollbars it can cause a 1-2px horizontal overflow.
- **On desktop:** On desktop with a persistent scrollbar, `width:100vw` overshoots the viewport content width by the scrollbar width, producing a faint horizontal scrollbar in fullscreen.
- **Fix:** Drop the explicit `width:'100vw'` (rely on `inset:0`), or use `width:'100%'`. Keep `height:'100dvh'`.

### Statistics (charts, media stats, comments, frivolous lists)
_Auditor notes:_ Cross-checked globals.css 640px block first (lines 767-803): it only targets .sr-header/.sr-panel/.sr-card/.sr-two-col/.sr-compare-panels/.sr-map-container/.sr-media-grid/.sr-media-iframe/.sr-help-row/.sr-help-toc and the map sidebar overlay. NONE of the Statistics components use any of those class names — every layout here is inline-styled (SectionCard uses clamp() padding, all grids/flex rows are inline). So nothing in this group is covered by the existing breakpoint; all findings are genuinely unhandled.

Highest-confidence real overlaps (user confirmed real phone overlaps): (1) the two fixed '1fr 160px' grids in BirdingStats (month pie ~680, observer donut ~1193) crush the left chart/bar column on phones with no collapse; (2) the Rainbow Warrior row (FrivolousListsSections 96-124) whose flexShrink:0 date+location cluster (location maxWidth 190) plus a non-wrapping row forces horizontal overflow at ~360px; (3) the two data tables (biggest counts 1426, protocol averages 1147) are width:100% inside an overflowX:auto wrapper with NO minWidth, so the wrapper never scrolls and columns crush — the fix is the documented wideMode / width:'max-content' table pattern.

Pattern theme: many pill/toggle groups use an inner display:flex; gap:4 with NO flexWrap (accumulation granularity 472, breeding tier filter 1532, media mode/interval 1632/1652). Even where the OUTER row wraps, the inner 4-pill group (~230px) can alone exceed ~300px usable card width and clip the last pill ('Total'). Adding flexWrap to those inner groups is a cheap broad fix. The MediaStatsSections age-sort header (215) and Frivolous HEAD_ROW (26) are the correct wrap-enabled reference patterns; FrivolousListsSections NAME_GRID auto-fill minmax is the correct responsive-grid reference the fixed-column grids (breeding repeat(3,1fr), month/observer 1fr 160px) should copy.

Shared root-cause hardening: BirdingStats' BarRow primitive (statsPrimitives 58-86) has a fixed-width label box with NO ellipsis, so any long label (behaviors labelWidth 150, weather-tide 120) overflows rather than clipping. Adding overflow:hidden+ellipsis to the BarRow label span fixes every consumer at once.

Desktop side: the whole page is capped at maxWidth:900 (line 362), centering content with large gutters at >=1440px — acceptable for readability but none of the multi-column sections benefit from extra width on large screens; donuts (132px) and pies (120px) don't scale up either.

Could not run the app (read-only audit); all width assessments reason about 320/360/375/414 viewports minus SectionCard clamp(14px,4vw,24px) padding (~272-300px usable inner width on phones).

#### [HIGH/M] Checklists-by-month grid hard-codes a 160px pie column that never collapses
`frontend/src/components/BirdingStats.tsx:680-701`
- **Problem:** <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16 }}> — a two-column grid with a fixed 160px right column for the 120px peak donut. No responsive collapse; the bar list is forced into 1fr minus 160px minus 16px gap.
- **On a phone:** At ~360px (minus SectionCard clamp padding, usable ~300px) the bar list column is squeezed to ~120px. BarRow has a 28px label + gaps + a fixed 4.25rem(68px) value column, leaving the bar track near-zero; the percentages and donut crowd. No wrap because it is a fixed-column grid.
- **Fix:** Collapse to a single column under a phone breakpoint (stack the pie below the bars), mirroring how .sr-two-col drops to 1fr at 640px; or use auto-fit minmax.

#### [HIGH/M] Lists-by-observer-count grid hard-codes a 160px donut column that never collapses
`frontend/src/components/BirdingStats.tsx:1192-1244`
- **Problem:** <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16 }}> wrapping the observer BarChart (ResponsiveContainer) on the left and a fixed 120px PieChart + legend on the right. Fixed two-column grid, no media collapse.
- **On a phone:** Same as the month grid: at ~300px usable the left ResponsiveContainer chart is crushed to ~120px; recharts X-axis tick labels overlap/clip and the bar chart is unreadable. The chart cannot wrap below the donut.
- **Fix:** Collapse to single column under a phone breakpoint (stack chart above the donut/legend), mirroring .sr-two-col at 640px.

#### [HIGH/S] Biggest-single-counts table: width:100% with no min-width, Species (BirdName+favicons) can overflow
`frontend/src/components/BirdingStats.tsx:1426-1458`
- **Problem:** Same as the protocol table: wrapped in overflowX:'auto' but <table> is width:'100%' with no minWidth. The Location <td> has maxWidth:180 + nowrap + ellipsis, and the Species column renders a full <BirdName> with favicons (can't shrink much). Four columns (Species/Count/Date/Location).
- **On a phone:** At ~300px the Species column (BirdName + favicons) plus Count/Date/Location forces severe column crushing; the BirdName favicons can push the row wider than the card while the overflowX wrapper still does not scroll (table is 100%, not max-content). Likely real overlap/clipping of the species name vs its favicons.
- **Fix:** Set the table to width:'max-content' (or minWidth ~480) so the overflowX:'auto' container scrolls horizontally on phones, matching the app's wideMode table pattern.

#### [HIGH/M] Rainbow Warrior row: swatch + colorname + BirdName + ChecklistLink + location(maxWidth 190 nowrap) in a non-wrapping flex row
`frontend/src/components/FrivolousListsSections.tsx:96-124`
- **Problem:** Each <li> is <div style={{ display:'flex', alignItems:'center', gap:12 }}> with NO flexWrap: 16px swatch, COLOR_NAME width:64 flexShrink:0, flex:1 minWidth:0 BirdName, then a flexShrink:0 cluster of ChecklistLink + LOC (maxWidth:190 nowrap ellipsis).
- **On a phone:** At ~290px usable: swatch(16) + colorname(64) + gaps(36) + checklistlink(~70) + location(up to 190) far exceeds 290px. The location+date cluster is flexShrink:0 and cannot shrink, so the flex:1 BirdName is crushed toward 0 AND the right cluster still overflows the row → horizontal overflow / clipping. No wrap to relieve it — a strong overlap candidate on phones.
- **Fix:** Add flexWrap:'wrap' to the row and let the date+location cluster drop below the bird name on narrow widths, or reduce LOC maxWidth and give the cluster minWidth:0 / drop flexShrink:0 so it can shrink.

#### [MED/S] Breeding totals use gridTemplateColumns: 'repeat(3, 1fr)' that never collapses to one column
`frontend/src/components/BirdingStats.tsx:1515-1528`
- **Problem:** <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}> for the Confirmed / Probable / Possible stat tiles — a hard 3-column count, not auto-fit.
- **On a phone:** At ~300px usable each tile is ~100px; the 1.5rem number plus the label 'Confirmed species' wraps awkwardly and crowds against the cell borders. Unlike the other tile grids (auto-fill minmax), this one is forced 3-wide regardless of width.
- **Fix:** Switch to repeat(auto-fit, minmax(6rem, 1fr)) like the other StatCell grids in this file so it can drop to 2 or 1 columns on a phone.

#### [MED/S] Breeding 'activity by month' header: 4 filter pills in a non-wrapping flex group beside the label
`frontend/src/components/BirdingStats.tsx:1530-1559`
- **Problem:** Header is a flex row with flexWrap:'wrap' (good), but the inner pill group <div style={{ display: 'flex', gap: 4 }}> (All/Confirmed/Probable/Possible) has NO flexWrap. Each pill is height 24, padding '0 8px', labels up to 'Confirmed'.
- **On a phone:** The 4-pill group is ~230-260px and cannot wrap internally; on a ~300px-usable phone the whole group drops to its own line, but the group itself can still exceed the card width and clip the last pill on the narrowest widths.
- **Fix:** Add flexWrap:'wrap' to the inner pill group so individual pills wrap; same fix applies to the accumulation, media interval, and media mode pill groups.

#### [MED/S] Life-list accumulation header uses justifyContent:'space-between' with a non-wrapping 4-pill group
`frontend/src/components/BirdingStats.tsx:470-490`
- **Problem:** <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}> with SubLabel left and a 4-button group (Weekly/Monthly/Yearly/Total) right; outer row has NO flexWrap and the inner button group <div style={{ display: 'flex', gap: 4 }}> has NO flexWrap.
- **On a phone:** At ~300px the SubLabel 'Life list accumulation' plus the 4 pills cannot coexist on one line; with space-between and no wrap the pills push right and overflow the card edge, clipping 'Total'.
- **Fix:** Add flexWrap:'wrap' + rowGap to the outer row and let the button group wrap, matching the breeding header which at least wraps the outer row.

#### [MED/S] Media section controls row: two pill groups via justify-between, inner groups never wrap
`frontend/src/components/BirdingStats.tsx:1629-1670`
- **Problem:** Outer row has flexWrap:'wrap' + rowGap:8 (good), but each group (Per Period/Cumulative and Weekly/Monthly/Yearly/Total) is <div style={{ display: 'flex', gap: 4 }}> with NO flexWrap. The 4-pill interval group is ~230px wide.
- **On a phone:** On a phone the outer wrap puts each group on its own line, but the 4-pill interval group alone (~230px) plus card padding can still exceed ~300px usable, clipping 'Total' off the right edge with no horizontal scroll.
- **Fix:** Add flexWrap to the interval/mode groups so individual pills wrap, not just the whole group.

#### [MED/S] Average-by-protocol table is width:100% with no min-width, columns crush instead of scrolling
`frontend/src/components/BirdingStats.tsx:1147-1167`
- **Problem:** Table is wrapped in <div style={{ overflowX: 'auto' }}> (good) but the <table> is width:'100%' with NO minWidth, so instead of triggering horizontal scroll the 4 columns (Protocol / Avg Duration (min) / Avg Distance (mi) / Count) compress and the long header text wraps to 3-4 lines at ~300px.
- **On a phone:** Headers like 'Avg Duration (min)' wrap to multiple lines, making the table tall and cramped rather than scrolling. The overflowX container is wasted because nothing forces width past 100%. Contrast the documented wideMode / width:'max-content' table pattern which would scroll.
- **Fix:** Give the table width:'max-content' (or minWidth ~480) so the overflowX:'auto' wrapper actually scrolls on phones instead of crushing columns.

#### [MED/S] Media Comments controls bar: search + Newest/Oldest toggle + count in a non-wrapping flex row
`frontend/src/components/MediaCommentsSection.tsx:57-105`
- **Problem:** <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}> with the search input (flex:1), a fixed-width sort toggle (two buttons '0 12px', flexShrink:0), and a count span (flexShrink:0). The row has NO flexWrap.
- **On a phone:** At ~300px usable: the toggle (~130px) + 'NN comments' (~70px) + gaps consume ~210px, leaving the flex:1 search input ~90px — barely usable, placeholder 'Filter media comments…' clipped. Toggle and count are flexShrink:0 with no wrap, so the input is starved rather than the controls wrapping.
- **Fix:** Add flexWrap:'wrap' (with rowGap) so the sort toggle + count drop below the search input on narrow widths, keeping the input usable.

#### [MED/S] BarRow label box has no ellipsis and fixed value column — long labels overflow on phones
`frontend/src/components/statsPrimitives.tsx:58-86`
- **Problem:** BarRow lays out: label (rem-scaled fixed width, right-aligned, NO overflow:hidden/textOverflow) + flex:1 bar + value span fixed '2.5rem'/'4.25rem'. A label wider than its fixed box visually overflows or pushes layout.
- **On a phone:** This primitive is reused everywhere (month/dow/hour/coverage/weather-tide/behaviors). On a phone the fixed label + fixed value columns eat most of the row; the bar shrinks toward zero in tight grids (e.g. the 160px-paired month grid). A label longer than its box (behaviors labelWidth 150, weather-tide 120) overflows horizontally with no clipping.
- **Fix:** Add overflow:hidden + textOverflow:'ellipsis' + whiteSpace:'nowrap' (or minWidth:0) to BarRow's label span so long labels clip instead of forcing overflow — hardens every consumer at once.

#### [LOW/M] Top-locations rows: nowrap+ellipsis name next to a non-shrinking count, squeezed on phones
`frontend/src/components/BirdingStats.tsx:836-857`
- **Problem:** Row is flex gap 8: rank (width 16), name <span style={{ flex: 1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>, and a count span 'N lists · N sp.' with flexShrink:0. Same pattern for top-locations-by-species (847-858).
- **On a phone:** At ~300px usable the count '1,234 lists · 567 sp.' (~110px) plus rank leaves ~150px for the name; long location names truncate to a few characters. No overflow (the name flexes), but the dominant content of the Geographic section becomes near-illegible on phones.
- **Fix:** Allow the count to wrap below the name on narrow widths, or stack name/count vertically below a breakpoint so the full location name is readable.

#### [LOW/S] County/State bar rows use a fixed 6.25rem/6rem ellipsised label, names truncate hard on phones
`frontend/src/components/BirdingStats.tsx:862-1009`
- **Problem:** Counties grid is repeat(auto-fit, minmax(200px, 1fr)) so it collapses to one column (good), but each row hard-codes the name span width '6.25rem'(100px)/states '6rem'(96px) with nowrap+ellipsis, plus a flex bar, plus a fixed 32-40px value.
- **On a phone:** Names truncate hard (e.g. 'San Luis Obispo' → ~10 chars); the bar track survives. No horizontal overflow because the grid collapse already prevents it — this is a legibility nit, not an overlap.
- **Fix:** Optional: widen/rem-scale the label or allow the county name to wrap. The grid collapse is correct.

#### [LOW/S] First observation / Most recent / First species cards use flex '1 1 160px' — correct wrap pattern
`frontend/src/components/BirdingStats.tsx:431-463`
- **Problem:** Cards are flex:'1 1 160px' in a flexWrap:'wrap' row (collapses fine). Inside, the location <p> has no nowrap/ellipsis but wraps naturally.
- **On a phone:** Minor: on a phone each card is full width and the location wraps naturally with no overflow. Low risk — the flex-basis wrap here is actually a correct pattern.
- **Fix:** No change needed; '1 1 160px' wrap is the right approach. Noting only that location text is unbounded (wraps, doesn't overflow).

#### [LOW/S] Whole Statistics page capped at maxWidth:900 — wide desktop whitespace
`frontend/src/components/BirdingStats.tsx:362-362`
- **Problem:** Root container is width:'100%', maxWidth:900, margin:'0 auto'. On >=1440px the content column is centered at 900px with ~270px empty margins each side.
- **On a phone:** None on phones (width:100% fits).
- **On desktop:** On large desktops the page sits in a 900px column with large empty gutters; multi-column sections (Top Species, Geographic two-up) could use more width. Acceptable for readability but flagged as the deliberate cap.
- **Fix:** Optionally raise the maxWidth (e.g. to ~1100-1200) on large viewports, or let specific multi-column sections widen; keep a readable measure for prose.

#### [LOW/S] Media comment row meta line: location not truncated; ML link marginLeft:auto
`frontend/src/components/MediaCommentsSection.tsx:123-146`
- **Problem:** Header line is flex with flexWrap:'wrap' (good) and the ML link uses marginLeft:'auto' + flexShrink:0. But the location span '· {row.location}' has no maxWidth/ellipsis/nowrap.
- **On a phone:** The wrap handles most of it; a long location string makes the line tall and can push the marginLeft:auto ML link alone onto a new line. Mostly cosmetic since the row wraps — no horizontal overflow.
- **Fix:** Optionally cap the location with maxWidth + ellipsis (as Geographic rows do) so the meta line stays tidy; low priority.

#### [LOW/S] Donut is a fixed 132x132 PieChart (not ResponsiveContainer); two donuts in a flex-wrap row
`frontend/src/components/MediaStatsSections.tsx:42-74`
- **Problem:** Donut renders <PieChart width={132} height={132}> at a hard 132px in a fixed 132x132 wrapper. Two donuts sit in <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, justifyContent: 'center' }}>.
- **On a phone:** The flexWrap row stacks the two 132px donuts vertically on a phone (each fits in ~300px) — no horizontal overflow. Legend below has maxWidth:200 and wraps. Safe pattern; noted only because it is a fixed-size (non-responsive) chart unlike the ResponsiveContainer charts.
- **Fix:** No urgent change — 132px fits the narrowest viewport and the row wraps. Leave as-is unless you want the donut to scale up on desktop.

#### [LOW/S] Age-coverage header: SubLabel + A–Z/Taxonomic toggle in a flex-wrap row (reference pattern)
`frontend/src/components/MediaStatsSections.tsx:215-237`
- **Problem:** Header <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}> with the sort toggle pushed by marginLeft:'auto'. The toggle is a 2-button group, flex with overflow:hidden.
- **On a phone:** flexWrap on the outer row means the toggle drops to its own line on a phone (marginLeft:'auto' harmlessly ineffective). The ~150px toggle fits. Low risk — correctly wrap-enabled. Noted as the safe reference the BirdingStats pill rows should copy.
- **Fix:** No change needed; this is the wrap-correct pattern the non-wrapping BirdingStats pill groups should adopt.

#### [LOW/S] Behaviors BarRow uses labelWidth={150}, leaving a very narrow bar track on phones
`frontend/src/components/MediaStatsSections.tsx:287-291`
- **Problem:** BarRow label width is passed as 150 (→ 9.375rem fixed). The BarRow label box + value column (2.5rem) + gaps leave the flexible bar between them.
- **On a phone:** At ~300px usable: 150px label + gaps + 40px value = ~206px fixed, leaving the bar track ~94px. Long behavior labels can overflow the fixed 150px box (BarRow's label has no ellipsis) and the bar is cramped. Real but minor.
- **Fix:** Use a smaller labelWidth on narrow viewports, or allow the behavior label to wrap, or have BarRow ellipsis-clip its label (see barrow-value-col-textsize).

#### [LOW/S] Frivolous NAME_GRID minmax(230px, 1fr) collapses to one column (reference pattern)
`frontend/src/components/FrivolousListsSections.tsx:33-36`
- **Problem:** NAME_GRID = gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))'. auto-fill with a 230px floor drops to one column below ~478px.
- **On a phone:** Single column on phones works; each NAME_ROW (check + BirdName) fits. The 230px floor is safe because auto-fill drops to 1 column when it can't fit. Low risk; noted as the correctly responsive grid the fixed-column grids should copy.
- **Fix:** No change needed; this auto-fill pattern is the responsive reference for the fixed-column grids (breeding repeat(3,1fr), month/observer 1fr 160px).

#### [LOW/S] Frivolous HEAD_ROW: SubLabel + progress(marginLeft:auto) + badge — already wrap-enabled
`frontend/src/components/FrivolousListsSections.tsx:26-32`
- **Problem:** HEAD_ROW has flexWrap:'wrap' (good); PROGRESS uses marginLeft:'auto' and the optional CompletionBadge follows. On wrap, marginLeft:auto loses effect harmlessly.
- **On a phone:** flexWrap saves it: on a phone the progress + badge wrap below the SubLabel. Low risk — wrap-enabled. Noted for completeness as a safe pattern.
- **Fix:** No change needed; wrap is already present.

### List Comparer, Checklist Comparer, Checklists
_Auditor notes:_ Cross-checked against the 640px block in globals.css FIRST: `.sr-two-col` and `.sr-compare-panels` ARE collapsed to 1 column there, so I did NOT report those two grids as defects (ChecklistComparer's 'Checklist A only / B only' pair at line 332 uses .sr-two-col, and ResultsView's panels at line 128 use .sr-compare-panels — both handled). The 640px block does NOT touch any inline grid/flex inside these components.

Width math basis: App.tsx wraps every one of these in `.sr-panel` with inline `padding:'40px 24px 24px'`; the 640px rule only overrides .sr-panel top/bottom padding, so the 24px side padding persists on phones → at a 360px viewport the inner content width is ~312px, at 320px it's ~272px. All overflow calls above use ~312px.

Highest-confidence real overlaps (match the user's confirmed phone overlaps):
1. cc-bothrow-twin-sidecells + cc-sideheader-fixed-width — the ChecklistComparer 'In Both' panel: two fixed 8.25rem (~132px) non-shrinking side cells leave no room for the bird name at phone width. This is the single most severe defect in the group.
2. cc-comments-grid-no-scroll — the Comments table's 3-col grid is inside overflow:hidden with a 120px first-column floor and no responsive collapse → clipped content on phones.
3. rv-header-no-wrap — ResultsView header lacks flexWrap (ChecklistComparer's equivalent header HAS it, line 270), so the nowrap sort+reset cluster overflows; rv-comparing-paragraph-labels compounds it with un-truncated filenames.
4. lc-droppzone-2col-no-collapse — uses an INLINE 1fr 1fr grid instead of .sr-two-col, so it never collapses like the rest of the app's two-col blocks.

The Checklists tab (Checklists.tsx) is the most responsive-aware of the group — most rows already use flexWrap and min-width:0 ellipsis. Its residual risks are nowrap count pairs and un-max-widthed native selects, all med/low.

ChecklistBadges.tsx has no real defect (already wraps); included one informational entry for completeness.

Suggested fix posture matches the house pattern: prefer adding to the single 640px block in globals.css with new class names (as .sr-two-col / .sr-compare-panels already do) rather than scattering more inline media logic, since inline styles can't be overridden by media queries.

#### [HIGH/M] In-Both species row: two fixed 8.25rem side cells + name in a non-wrapping space-between row
`frontend/src/components/ChecklistComparer.tsx:90-112, 147-166`
- **Problem:** SpeciesRow renders a name on the left and a right group holding TWO SideCells, each `width: SIDE_CELL_WIDTH` (8.25rem ≈ 132px) with `flexShrink: 0`. The outer row is `display:flex; justifyContent:'space-between'; gap:8` with NO flexWrap; the right `<span>` is also `flexShrink:0`. Two side cells alone are ~264px before gaps.
- **On a phone:** At ~360px the panel inner width is only ~312px (App .sr-panel keeps 24px side padding under 640px). Two 132px side cells (264px) + gaps + the In-Both panel's own 14px row padding leave essentially no room for the BirdName, which collides with / is overrun by the count cells. The row cannot wrap, so it overflows horizontally or the name is crushed to a sliver. This is the worst overlap in the group.
- **Fix:** Add a 640px rule (or a class) that lets the In-Both row wrap: shrink SIDE_CELL_WIDTH on narrow widths, drop the twin-cell layout to a stacked A/B presentation, or allow flexWrap and let the name take a full line. Move the fixed-width alignment behind a min-width media query like the existing .sr-two-col / .sr-compare-panels pattern.

#### [HIGH/S] In-Both panel header: two fixed 8.25rem SideHeaders pinned right of the title
`frontend/src/components/ChecklistComparer.tsx:318-323, 523-528`
- **Problem:** Panel `headerExtra` is a flex span with two SideHeaders, each `width: SIDE_CELL_WIDTH` (8.25rem). The Panel header is `justifyContent:'space-between'` with the title on the left; the two headers consume ~264px on the right and do not shrink.
- **On a phone:** At ~360px the two A/B column headers (~264px) plus the 'In Both' title overflow the ~312px panel width — the header row clips or pushes the title out, and it visually de-aligns from the (separately broken) rows below.
- **Fix:** Tie the header widths to the same responsive treatment chosen for SideCell (shrink SIDE_CELL_WIDTH below 640px, or stack). Keep header/cell widths in lockstep so alignment holds at every breakpoint.

#### [HIGH/M] Comments table: 3-column grid minmax(120px,1.2fr) 2fr 2fr with no horizontal-scroll container
`frontend/src/components/ChecklistComparer.tsx:549, 564-600`
- **Problem:** CommentsTable uses `display:grid; gridTemplateColumns: 'minmax(120px, 1.2fr) 2fr 2fr'` for Species + A + B columns, inside a card with `overflow:hidden`. There is no wideMode/`width:max-content` scroll wrapper. The first column floors at 120px and the two comment columns each carry free-text (URLs via CommentText).
- **On a phone:** At ~360px three columns share ~310px: the species column eats 120px, leaving ~95px each for two comment columns. Long words break (wordBreak:break-word helps), but an unbreakable token (a long checklist URL in a comment) or the column floor forces horizontal overflow that is then CLIPPED by the card's overflow:hidden — content is lost, not scrollable. The grid never collapses to a single column on phones.
- **Fix:** Below 640px collapse to a stacked layout (Species heading then A/B comments stacked) or wrap in a horizontal-scroll container with `width:max-content` like the app's existing wide-table pattern; raise/remove the 120px floor on narrow widths.

#### [HIGH/S] ResultsView header: space-between with NO flexWrap; comparing-text vs nowrap sort+reset cluster
`frontend/src/components/ResultsView.tsx:42-103`
- **Problem:** Header is `display:flex; alignItems:'center'; justifyContent:'space-between'; gap:16` with NO `flexWrap`. Left is a `<p>` ("Comparing A and B") that can shrink; the right cluster (`flexShrink:0`) holds the Taxonomic/A–Z toggle and a '← Compare new files' button, BOTH `whiteSpace:'nowrap'`.
- **On a phone:** At ~360px the non-shrinking, nowrap right cluster (~250px: ~120px sort toggle + ~150px reset button) plus the shrunk 'Comparing' paragraph cannot both fit in ~312px. Without flexWrap the cluster stays on the same line and the paragraph is squeezed to near-zero / the button overflows. Long list labels in the paragraph make it worse since it must shrink to almost nothing.
- **Fix:** Add `flexWrap:'wrap'` to the header (matching ChecklistComparer's results header) so the button cluster drops below the description on narrow widths; optionally shrink button padding under 640px.

#### [MED/S] Comparing paragraph: filenames in <strong> with no truncation
`frontend/src/components/ResultsView.tsx:51-56`
- **Problem:** The 'Comparing <strong>{nameA}</strong> and <strong>{nameB}</strong>' paragraph renders raw uploaded filenames (listBLabel = file.filename) with no ellipsis/maxWidth and no wordBreak.
- **On a phone:** A long CSV filename (e.g. 'ebird_world_year_list_2024_final_v3.csv') won't break at spaces and, combined with the non-wrapping header (rv-header-no-wrap), forces the header wider than the viewport at ~360px. Even with header wrap fixed, the long token can overflow the paragraph line.
- **Fix:** Add `overflow-wrap:anywhere`/`wordBreak:break-word` to the paragraph (or ellipsize the labels) so long filenames wrap inside the available width.

#### [MED/S] List A / List B dropzone grid is a hard 1fr 1fr with no single-column collapse
`frontend/src/components/ListComparer.tsx:235-275`
- **Problem:** The two DropZones are laid out with inline `display:'grid'; gridTemplateColumns:'1fr 1fr'; gap:12`. This is an INLINE grid (not the class-based .sr-two-col), so the 640px globals rule that collapses .sr-two-col does NOT apply to it. The List A 'My List' card also has `minHeight:192` and `padding:'40px 24px 28px'`.
- **On a phone:** At ~320-360px each column is ~150px; the dropzone label/content and the My-List card's 24px side padding crowd badly, and the two side-by-side drop targets are far too narrow for comfortable tap/drag on a phone. The grid never becomes a single column, unlike every other 2-col block in the app.
- **Fix:** Replace the inline `gridTemplateColumns:'1fr 1fr'` with the `.sr-two-col` class (which already collapses to 1 column under 640px) or add a matching media query so the two dropzones stack on phones.

#### [MED/S] Checklist row header: date+location+badges then a marginLeft:auto species/birds count, all in one wrap row
`frontend/src/components/Checklists.tsx:329-358`
- **Problem:** The row's top line is `display:flex; flexWrap:'wrap'` containing DateLink (nowrap), location (ellipsis, min-width:0), a badge cluster, then a right group with `marginLeft:'auto'`, `flexShrink:0`, `paddingLeft:12` holding 'N species' and 'N birds' (both `whiteSpace:'nowrap'`).
- **On a phone:** `marginLeft:'auto'` only works while items share a line; once the row wraps at ~360px the count group drops to its own line but, being flexShrink:0 + nowrap and ~150px+ wide ('1,234 species   5,678 birds'), it can still exceed ~312px when both counts are large, causing horizontal overflow. The location ellipsis competes with the badge cluster for the first line. Generally degrades acceptably via wrap, but the nowrap count pair is the overflow risk.
- **Fix:** Let the 'species / birds' count pair wrap internally (remove forced nowrap on the pair or allow the inner group to wrap) and verify two large numbers fit at 320px; consider dropping marginLeft:auto to a wrap-friendly layout.

#### [MED/S] Protocol/County selects and the accent filter strip — long option text and strip text on narrow rows
`frontend/src/components/Checklists.tsx:658-702, 706-722`
- **Problem:** Protocol and County `<select>`s use selectStyle (height:28, no max-width) and sit in flex-wrap rows; their rendered width tracks the longest selected option (e.g. a long county or protocol name). The accent filter strip (lines 707-722) is `flexWrap:'wrap'` with a `filterStripText` span (long: county + date range + 'N of M checklists') and a 'Clear filter' button.
- **On a phone:** At ~320-360px a long selected county/protocol can make the native select wider than the row and overflow (selects don't ellipsize their button text by default and have no max-width here). The filter strip text wraps (it's in a wrap row with the span having no nowrap) so that part is OK, but the select widths are the concrete overflow risk.
- **Fix:** Add a max-width (e.g. maxWidth:'100%' or a clamp) to selectStyle so the native selects can't exceed the row; verify long county names don't push horizontal scroll at 320px.

#### [LOW/S] Results header: ChecklistTag column + nowrap sort/reset cluster, cluster is flexShrink:0
`frontend/src/components/ChecklistComparer.tsx:270-298`
- **Problem:** Header row is `justifyContent:'space-between'; gap:16; flexWrap:'wrap'` (wrap IS present, good) but the right cluster (sort toggle + '← New comparison', both `whiteSpace:'nowrap'`) is `flexShrink:0`, and the left ChecklistTag column is `flex:'1 1 320px'`.
- **On a phone:** flexWrap lets the cluster drop to its own line, so this mostly survives — but the '← New comparison' button plus the Taxonomic/A–Z toggle, both nowrap and non-shrinking, total ~230px+; on a 312px line that is tight and can still edge-overflow when combined with focus-ring outline-offset (3px+6px box-shadow). Lower risk than the rows, but worth a wrap/shrink check.
- **Fix:** Allow the inner button cluster to wrap (it currently can't internally) or shrink the buttons below 640px; verify the nowrap labels don't exceed the narrow line width.

#### [LOW/S] ChecklistTag Notes disclosure uses maxWidth:460 — fine on phone, but fixed
`frontend/src/components/ChecklistComparer.tsx:468-476`
- **Problem:** The expanded Notes panel sets `maxWidth: 460` with `wordBreak:'break-word'`. 460 exceeds the ~312px narrow content width, but the box is inside a flex column with min-width:0 so it should clamp.
- **On a phone:** Low risk: maxWidth is a ceiling, not a floor, and the parent is min-width:0, so it shrinks. Noted only because the fixed 460 reads as a desktop assumption; confirm it doesn't combine with the A/B badge indent to push width.
- **Fix:** Leave as-is or switch maxWidth:460 to a max-width that is relative (e.g. min(460px,100%)) for clarity; no action strictly required.

#### [LOW/S] Top mode toggle: two 0 20px-padded segments centered in a maxWidth:880 row
`frontend/src/components/ListComparer.tsx:149-166`
- **Problem:** The Life Lists / Checklists segmented toggle uses buttons with `padding:'0 20px'` inside an inline-flex with `overflow:hidden`, centered. Fixed horizontal padding, no shrink.
- **On a phone:** Low risk — only two short labels ('Life Lists', 'Checklists') so ~220px total fits in ~312px. Noted as a fixed-padding pattern but not an overflow at 320px.
- **Fix:** No change needed; if Text Size is enlarged, consider letting the segments wrap. Low priority.

#### [LOW/S] Filter rows: rowLabelStyle width:72 + many nowrap TriPills wrapping but label is a fixed-width flex item
`frontend/src/components/Checklists.tsx:285-293, 612-703`
- **Problem:** Each filter row is `display:flex; flexWrap:'wrap'; gap:6` with a fixed `width:72, flexShrink:0` row label followed by many TriPills (each `whiteSpace:'nowrap'`, height:30) and a count span with `marginLeft:'auto'`. The pills themselves wrap, which is good.
- **On a phone:** Mostly OK because the pill row wraps. Residual issues at ~320px: (a) the 72px fixed label plus a single wide pill like 'Checklist comment'/'Species comments' (nowrap) on the same wrap line can edge past ~312px; (b) the count span's `marginLeft:'auto'` collapses oddly once items wrap onto multiple lines, landing on whatever the last wrap line is. Low-to-med severity given wrap exists.
- **Fix:** Confirm the widest single TriPill + 72px label fits at 320px; consider letting the label sit on its own line under 640px, and give the count span a stable position (own line) rather than marginLeft:auto after wrap.

#### [LOW/S] Comment search box controls: search input (flex 1 1 200px, max 340) + SortSeg + count, flexWrap present
`frontend/src/components/Checklists.tsx:173-203`
- **Problem:** Controls row is `flexWrap:'wrap'; gap:8`; the search wrapper is `flex:'1 1 200px', maxWidth:340`, then SortSeg (flexShrink:0) and a count span with `marginLeft:'auto'`.
- **On a phone:** Largely fine due to flexWrap and the `1 1 200px` basis (the input shrinks). At exactly ~320px the 200px flex-basis plus 8px gap plus SortSeg (~110px) exceeds the line, but wrap handles it — the input drops the SortSeg to the next line. The `marginLeft:'auto'` count then floats oddly. Low severity.
- **Fix:** Lower the search flex-basis (e.g. 1 1 140px) so it shrinks before wrapping on the smallest phones; optionally give the count a fixed position rather than marginLeft:auto.

#### [LOW/S] Results capped at maxWidth:880 — comfortable on phone, but leaves wide whitespace at >=1440px
`frontend/src/components/ResultsView.tsx:35-41`
- **Problem:** ResultsView (and ChecklistComparer results, line 269) cap the whole results area at `maxWidth:880`, centered in the .sr-panel.
- **On a phone:** No narrow-width problem (max-width is a ceiling).
- **On desktop:** At >=1440px the 3-up species panels / comparison are pinned to 880px in a much wider panel, leaving large empty gutters on both sides. The 3-column .sr-compare-panels could read better wider, or the panels could be larger. Purely a desktop whitespace/under-use observation, consistent across the comparer screens.
- **Fix:** Consider raising maxWidth at a >=1280px breakpoint, or letting the species panels grow, so the comparison uses more of a large desktop. Optional polish.

#### [LOW/S] Badge row already wraps (flexWrap:'wrap') — no defect, dividers are the only caveat
`frontend/src/components/ChecklistBadges.tsx:51-74`
- **Problem:** ChecklistBadges is `display:flex; flexWrap:'wrap'; gap:5` with six small badges and two 1px Dividers. Badges wrap correctly.
- **On a phone:** No overflow: the row wraps. Minor cosmetic-only note — the vertical Dividers (height:13) can land at the start/end of a wrapped line and read oddly, but this is not an overlap or overflow.
- **Fix:** No functional change required; optionally hide a divider when it falls at a line wrap. Listed for completeness — this file has no real responsive defect.

### Settings (keys, file upload, tab layout, text size, date format)
_Auditor notes:_ Cross-checked globals.css 640px block (lines 767-803): it overrides ONLY .sr-header/.sr-panel/.sr-card/.sr-two-col/.sr-compare-panels/.sr-map-container/.sr-media-grid/.sr-help-row/.sr-help-toc and the map sidebar overlay. NONE of these classes appear in Settings.tsx or DropZone.tsx — both are styled 100% with inline styles and have ZERO responsive handling, so nothing here is already covered. The Settings panel host (App.tsx line 1174) is `.sr-panel` with padding '40px 24px 24px', which the 640px block trims to padding-top 20 / padding-bottom 16 but LEAVES the 24px horizontal padding, so on a 360px phone the Settings inner width is ~312px — that is the budget I evaluated against. Settings inner content caps at maxWidth 680 centered.\n\nThe dominant, confirmed-real defect is the repeated pattern across FileRow, KeyRow (display + edit), the Documentation card, and the Default Location grid: icon + flex:1 text + fixed-width flexShrink:0 action buttons in a flex row with NO flexWrap. The buttons cannot shrink and the empty/unset states add an extra status pill ('No file saved' / 'No key saved'), which is the worst case for collision. The cleanest fix is consistent with the app's existing approach — add a small set of class names (e.g. .sr-settings-row, .sr-settings-actions, .sr-map-defaults-grid) and override them in the SAME 640px block (flexWrap + full-width action line, single-column grid), rather than introducing new inline media logic. The app already uses width:'max-content'/wideMode horizontal-scroll for wide tables elsewhere, but there are no true tables here, so the wrap-the-actions approach fits better than a scroll container.\n\nUncertainty: exact pixel collision depends on rendered button label width at the user's text-scale setting (Settings itself offers up to 200% text scale) — at 150-200% scale every one of these rows overflows much sooner, so the severity of the high items is if anything understated for accessibility-scaled users.

#### [HIGH/M] FileRow: non-wrapping flex row crushes filename column behind fixed action buttons
`frontend/src/components/Settings.tsx:276-349`
- **Problem:** The outer FileRow is `display:flex; alignItems:center; gap:12` with NO flexWrap. It holds a 38px icon (flexShrink:0), a `flex:1 minWidth:0` text column, and a `flexShrink:0` button group containing 'Upload new'/'Update file' + 'Clear' (both whiteSpace:'nowrap', not shrinkable) plus, in the empty state, an extra 'No file saved' pill. None of the right-side controls can shrink.
- **On a phone:** At ~312px inner width (360px phone minus the 24px panel padding each side), icon(38)+gaps(12+12)+two buttons(~75+~50)+inner gap(8) consume ~195px; the empty state adds the ~90px 'No file saved' chip, exceeding the row. The flex:1 filename/text column collapses to near-zero or the whole group overflows horizontally — the confirmed overlap. The filename ellipsis (maxWidth:200) plus the nowrap '· Saved {date}' span have no room.
- **Fix:** Allow the row to wrap (flexWrap:'wrap') below ~640px or drop the action buttons onto their own full-width line; do it via a CSS class hooked into the existing 640px block rather than inline. Let the button group stretch to full width when wrapped.

#### [HIGH/M] KeyRow (display mode): same non-wrapping icon + text + button-group collision
`frontend/src/components/Settings.tsx:412-490`
- **Problem:** Identical structure to FileRow — `display:flex; gap:12`, no flexWrap; 38px icon, flex:1 minWidth:0 text column (masked key span maxWidth:220 ellipsis), and a flexShrink:0 group with 'Update'/'Add key' + 'Clear' (both nowrap) plus a 'No key saved' pill in the empty state. The masked key row also nests a Show/Hide button inside the text column.
- **On a phone:** At ~312px the fixed-width button group plus icon and gaps leave too little for the flex:1 column; the masked-key + Show button line and the buttons crowd/overlap, worst in the unset (extra pill) state.
- **Fix:** Same as FileRow — wrap the action buttons to a second line under ~640px via a shared CSS class in the 640px block; keep buttons full-width when wrapped.

#### [MED/S] KeyRow (editing mode): input + Save + Cancel non-wrapping row
`frontend/src/components/Settings.tsx:493-538`
- **Problem:** Edit row is `display:flex; gap:8; padding:'0 16px 14px'` with a flex:1 monospace input and Save + Cancel buttons each flexShrink:0 and whiteSpace:'nowrap'. No wrap.
- **On a phone:** At ~312px the two flexShrink:0 buttons (~55 + ~60px) plus gaps squeeze the API-key input to roughly ~150px, awkward for pasting/reading a long key, though still functional. No overlap, just cramped.
- **Fix:** Below ~640px let the input take the full row and wrap Save/Cancel beneath, or shrink button padding; use a CSS class rather than inline.

#### [MED/S] Default Location: 3-column grid (1fr 1fr 88px) never collapses; monospace placeholders clip
`frontend/src/components/Settings.tsx:1340-1380`
- **Problem:** `display:grid; gridTemplateColumns:'1fr 1fr 88px'; gap:8` for Latitude / Longitude / Radius inputs. The column count is fixed at three; it never reflows to fewer columns. Inputs are fontSize 0.75rem monospace with placeholders 'e.g. 37.8275' and 'e.g. -122.4238'.
- **On a phone:** At ~312px: 88px fixed radius column + 2×8px gaps leaves ~104px each for the lat/lng inputs. The monospace placeholder 'e.g. -122.4238' is wider than ~104px and gets clipped; entered coordinates with 5 decimals also crowd. The labels ('Longitude') are borderline. Functional but cramped and placeholder-clipped.
- **Fix:** Collapse to a single column (or lat/lng stacked, radius full-width) under ~640px via a CSS grid override class, matching the .sr-two-col pattern already in the 640px block.

#### [MED/S] Help/Documentation card: icon + text + button row at fixed padding 16 with no wrap
`frontend/src/components/Settings.tsx:1184-1218`
- **Problem:** The top Documentation card is `display:flex; alignItems:center; gap:16; padding:16` with a 40px icon (flexShrink:0), flex:1 text, and an 'Open documentation' button (flexShrink:0, whiteSpace:'nowrap', padding '0 16px'). No flexWrap.
- **On a phone:** At ~312px (further reduced by the card's own 16px padding each side to ~280px): icon 40 + gap 16 + button (~150px) + gap 16 leaves ~58px for the two text lines; the heading 'SnowRaven Documentation' and description wrap to many lines or the button crowds the text. Cramped, button may dominate the row.
- **Fix:** Wrap the button below the text under ~640px (flexWrap + the text given flex-basis 100%), via a CSS class.

#### [LOW/S] Tab Layout rows: drag handle + name + three 28px control buttons, no wrap
`frontend/src/components/Settings.tsx:813-890`
- **Problem:** Each reorder row is `display:flex; gap:10; padding:'10px 16px'` with a 14px drag handle, a flex:1 tab-name span, an optional 'hidden' badge, and three flexShrink:0 28px buttons (Move up, Move down, eye). No wrap.
- **On a phone:** At ~312px the fixed controls (handle 14 + 3×28 + 4 gaps ≈ 138px) leave ~140px for the tab name; current labels are short so they fit, but a long/translated label plus the 'hidden' badge would crowd the buttons. Tight rather than broken at default labels.
- **Fix:** Keep on one line but ensure the name span has minWidth:0 + ellipsis so a long label truncates instead of pushing the controls off-row; consider reducing horizontal padding under ~640px.

#### [LOW/S] Settings content capped at maxWidth 680 centered — desktop reads well (no defect, noted for completeness)
`frontend/src/components/Settings.tsx:1180-1180`
- **Problem:** Outer wrapper is `width:100%; maxWidth:680; margin:0 auto`. This caps a single-column settings form at 680px and centers it.
- **On a phone:** At phone widths the form simply fills available width (good).
- **On desktop:** At ≥1440px the form does NOT stretch uncomfortably — 680px is an appropriate reading measure for a settings form. This is correct behavior, not a stretch defect.
- **Fix:** No change needed; included so it is not flagged as an over-wide-desktop problem.

#### [LOW/S] DropZone: absolutely-positioned label overlaps centered content only if height shrinks; minHeight 192 protects it
`frontend/src/components/DropZone.tsx:91-135`
- **Problem:** The label is `position:absolute; top:14; left:18` over a column-flex centered body (icon + text). The zone has minHeight:192 and padding '40px 24px 28px'. Filename uses wordBreak:'break-all' (good). Error text is maxWidth:220.
- **On a phone:** At narrow widths the body content (icon, 'Drop file here', filename) is centered and could in principle rise under the absolute label, but the 40px top padding + 192px minHeight keep them clear at 320-414px. A very long filename with break-all grows the box downward, not into the label. No overlap in practice.
- **Fix:** No responsive fix required for DropZone itself; its grid context (1fr 1fr that never collapses) is in ListComparer.tsx and is that screen's concern, not this file's.

### Species Detail (header, sightings graph, pins map, panels)
_Auditor notes:_ Cross-checked against the 640px block in globals.css (lines 767-803): already handled here are .sr-two-col (Sightings+Media collapse to 1 col), .sr-map-container (map height 300px), .sr-media-grid (Recent Media to 1 col) and .sr-media-iframe (360px). I did NOT report those collapses — they are covered. Everything else in these files is inline-styled and therefore NOT reachable by the 640px class overrides.

KEY THEME: this group is almost entirely inline-styled flex rows. The two highest-severity hard-overflow risks are (1) the active-filter strip with justifyContent:'space-between' and no wrap (lines 725-744), and (2) the 'Reported With' table built from ~282px of fixed-width cells (rank 20 + bar 100 + rate 38 + checklists 84 + gaps) that crush the species-name column on a phone. Both are genuine, not hypothetical.

RECURRING PATTERN worth a single shared fix: many list rows give the text a flex:1 WITHOUT minWidth:0, then place a whiteSpace:'nowrap' count/pill or a fixed icon after it — Breeding Codes (1009-1025), Top Locations (1139-1164), Reported With (1080-1101), and the selector option (566-597). A flex child can't shrink below its content's longest word unless minWidth:0 is set, so every one of these can horizontally overflow its SectionCard (which has overflow:hidden, so overflow is clipped, not scrollable). Adding minWidth:0 + ellipsis/wordBreak to those flex:1 spans fixes the class of bugs cheaply.

CONSISTENCY NOTE for fixes: the app's established responsive lever is a .sr-* class targeted in the single 640px block (since inline styles can't be media-queried). The cleanest fixes here are to (a) add flexWrap to the inline rows directly where wrapping is always acceptable, and (b) promote the few fixed-width-grid rows (Reported With, date-range group, Graph Options pills) to .sr-* classes so the 640px block can restack/hide the fixed bar. SectionCard padding is inline ('14-22px 18px') and is NOT covered by the .sr-card 640px rule — if padding-trim is wanted on phones, SectionCard needs a class.

NOT IN SCOPE BUT ADJACENT: NamedBirdsTable (rendered at lines 1393-1403) and HeatmapLayer/MapBoundsFitter are separate files; I flagged only the call-site overflow risk for NamedBirdsTable (no overflowX wrapper at this site + SectionCard overflow:hidden). recharts charts (SightingsGraph) are width-responsive via ResponsiveContainer but height is hardcoded 220 with a -16 left margin that can clip the leftmost Y tick at ~320px.

DESKTOP (>=1440): minimal issues in this group — the SectionCards are full-width single-column and read fine wide; the only desktop note is the fixed 220px chart height looking squat in a very wide card.

#### [HIGH/S] Active-filter strip row uses justifyContent:'space-between' with no flexWrap
`frontend/src/components/SpeciesDetail.tsx:725-744`
- **Problem:** The filter summary strip is a flex row with justifyContent:'space-between' (no flexWrap) holding a long left span (e.g. 'Marin · Jan 1, 2020 – Dec 31, 2024 · Showing 312 of 540 checklists') and a 'Clear filter' button. The left span has no minWidth:0 / ellipsis.
- **On a phone:** At ~360px the concatenated filter text (county + full date range + 'Showing N of M checklists') is far wider than the strip; with no wrap and no shrink/ellipsis on the span the text and the 'Clear filter' button collide/overlap, and the text overflows the rounded accent pill.
- **Fix:** Add flexWrap:'wrap' (or row-gap) to the container, and minWidth:0 on the text span; alternatively give the strip a .sr-* class and stack/allow-wrap in the 640px block like the other inline rows.

#### [HIGH/M] 'Reported With' table rows/headers use fixed pixel column widths that crowd at phone width
`frontend/src/components/SpeciesDetail.tsx:1069-1101`
- **Problem:** Header row and each data row are a non-wrapping flex with fixed-width cells: rank span width:20, a fixed bar div width:100, rate span width:38, checklists span width:84, plus four 10px gaps — ~282px of fixed width before the flex:1 species-name column (BirdName with favicons).
- **On a phone:** At 360px (minus card padding 18+18) the fixed cells consume essentially all width, leaving ~40-70px for the species name; the BirdName + favicons truncate to near-nothing and the 100px progress bar dominates the row. The row is unreadable on a phone and the count cell ('1 checklist'/'12 checklists') is squeezed against the rate.
- **Fix:** Drop or shrink the fixed 100px bar on narrow widths (hide via a .sr-* class in the 640px block), and let rate/checklists columns shrink or move the count below the name; give the species column a sensible min so the name stays legible.

#### [MED/S] Comments controls row (filter input + sort toggle + count) cannot wrap
`frontend/src/components/SpeciesDetail.tsx:1282-1332`
- **Problem:** Flex row with gap:8, no flexWrap, containing a flex:1 search input, a fixed two-button Newest/Oldest sort toggle (each button padding 0 12px, flexShrink:0), and a flexShrink:0 'N comments' count span.
- **On a phone:** At ~360px the flex:1 input is squeezed by the non-shrinking sort toggle (~140px) and the count text; the input becomes too narrow to read its placeholder, and with the 18px card padding on both sides the toggle + count can push the input width near zero / overflow horizontally.
- **Fix:** Allow the row to wrap (flexWrap:'wrap' with row-gap) so the sort toggle + count drop below the full-width search input on phones, or give the input a min-width and move the count under the controls.

#### [MED/M] County + date-range filter row: native date inputs are fixed-content width and crowd despite flexWrap
`frontend/src/components/SpeciesDetail.tsx:604-683`
- **Problem:** The outer row has flexWrap:'wrap', but the date-range group (lines 633-667) is itself a nested inline-flex with two type=date inputs and an arrow that does NOT wrap; native date inputs render at a fixed intrinsic width (~110-130px each on iOS/Android).
- **On a phone:** At 320-360px two side-by-side date inputs (~260px) plus the '→' overflow the row; the inner group can't wrap, so the second date input is clipped or pushes horizontal overflow, and on iOS the date control's spinner UI is cut off.
- **Fix:** Let the inner date group wrap (flexWrap on the from/→/to group) or make each date input flex with a min-width; consider stacking from/to vertically under 640px.

#### [MED/S] Graph Options row two segmented groups with gap:24 — wraps but groups have nowrap labels
`frontend/src/components/SpeciesDetail.tsx:966-996`
- **Problem:** Outer row has flexWrap:'wrap' (good) with gap:24, but each group (Interval, View) is an inline-flex with a whiteSpace:'nowrap' label plus a 3-button / 2-button pill toggle that cannot shrink.
- **On a phone:** At 360px the Interval group (label 'INTERVAL' + Weekly/Monthly/Yearly pills ~210px) can exceed the row width; since the inner group is nowrap it won't break, so it can overflow the card horizontally before the outer wrap helps (the wrap only moves the View group to a new line, not shrink the Interval pills).
- **Fix:** Allow the pill button group to wrap or shrink, or stack label above the pills under 640px; verify the 3-button Interval toggle fits within ~288px content width.

#### [MED/S] Breeding Codes rows: long label with flex:1 next to a whiteSpace:'nowrap' count pill
`frontend/src/components/SpeciesDetail.tsx:1009-1025`
- **Problem:** Each breeding row is a non-wrapping flex: dot + code (minWidth:28) + label (flex:1) + count pill (whiteSpace:'nowrap'). The label has no minWidth:0, so a long breeding-code label can't shrink below its content.
- **On a phone:** At 360px a long breeding label (e.g. 'Confirmed — Nest with Young (NY)') with flex:1 but no minWidth:0 won't wrap/shrink and pushes the nowrap '12 times' pill, causing horizontal overflow of the card row.
- **Fix:** Add minWidth:0 to the flex:1 label span (and allow it to wrap) so the nowrap count pill stays on-row.

#### [MED/S] Top Locations rows: long location name (flex:1, no minWidth) beside nowrap sighting count + link icon
`frontend/src/components/SpeciesDetail.tsx:1139-1164`
- **Problem:** Each location row is a non-wrapping flex: rank (minWidth 22) + location name (flex:1, no minWidth:0, no ellipsis) + count span (whiteSpace:'nowrap') + 26x26 external-link button (flexShrink:0).
- **On a phone:** eBird hotspot/location names are long ('Point Reyes National Seashore--Drakes Beach Parking Lot'); with flex:1 but no minWidth:0 the name can't shrink below its longest word, pushing the nowrap '14 sightings' count and the link button to overflow the card horizontally at 360px.
- **Fix:** Add minWidth:0 + overflow/textOverflow ellipsis (or wordBreak) to the location name span so the count + link icon stay on-row.

#### [MED/S] Species selector dropdown option: common name (flex:1) + italic sci-name in a nowrap row
`frontend/src/components/SpeciesDetail.tsx:566-597`
- **Problem:** Each option is a flex row: check (16) + common name span (flex:1, no minWidth:0) + scientific-name span (italic, no flexShrink/ellipsis). Neither text span can shrink.
- **On a phone:** At 360px a long common name plus a long scientific name (e.g. 'Black-and-white Warbler' / 'Mniotilta varia') exceed the dropdown width; with no minWidth:0 on the flex:1 name and no shrink on the sci-name, the option overflows horizontally and the sci-name is clipped by the listbox right edge.
- **Fix:** Add minWidth:0 + ellipsis to the common-name span and let the sci-name shrink/ellipsis or hide it under 640px.

#### [MED/S] Named Individuals embeds NamedBirdsTable inside a 16/18px-padded card without a horizontal-scroll guarantee
`frontend/src/components/SpeciesDetail.tsx:1393-1403`
- **Problem:** The Named Individuals card wraps NamedBirdsTable in padding '16px 18px'. NamedBirdsTable is a wide table; whether it overflows depends on that component, but here it is given no overflowX container of its own at this call site.
- **On a phone:** If NamedBirdsTable renders a multi-column table (date/count/checklist/per-row map), it can exceed 320-360px; without an overflowX:auto wrapper at this site the table clips inside the SectionCard (overflow:hidden on SectionCard) rather than scrolling.
- **Fix:** Wrap the NamedBirdsTable in an overflowX:auto container here (the app's wideMode/width:max-content table pattern), or confirm NamedBirdsTable owns its own scroll; SectionCard's overflow:hidden means clipped content is invisible.

#### [LOW/S] Summary card large title + media/breeding pill row at fixed padding
`frontend/src/components/SpeciesDetail.tsx:749-812`
- **Problem:** The Summary SectionCard uses padding '20px 22px 18px' and a 1.5rem (24px) bold title. The media buttons + breeding pill sit in a flexWrap:'wrap' row (good), but the title relies on wordBreak:'break-word' only.
- **On a phone:** Mostly fine due to wordBreak + flexWrap, but the 22px horizontal padding on a 320px screen leaves a narrow content box; a very long common name (e.g. 'Black-throated Blue Warbler' / subspecies form) still breaks awkwardly. Lower severity since wrap/break are present.
- **Fix:** Reduce card horizontal padding under 640px (the .sr-card 640px rule sets 20px but SectionCard padding is inline, not class-based, so it isn't covered). Consider a .sr-* class so the 640px block can trim padding.

#### [LOW/S] Sightings stat grid is a fixed 2-column grid; Frequency cell borderLeft assumes a column position
`frontend/src/components/SpeciesDetail.tsx:829-890`
- **Problem:** gridTemplateColumns:'1fr 1fr' fixed two-column grid inside the (already-collapsed-to-one-column-via-sr-two-col) Sightings card. The Frequency cell has borderLeft + paddingLeft:12 assuming it sits in the right column.
- **On a phone:** The 2-col stat grid itself is OK at phone width (cells are short numbers), but inside the .sr-two-col single column on a 320px phone, two stat numbers (1.25rem) plus the borderLeft divider get tight; the Frequency progress bar (fixed height 3, width %) is fine. Minor crowding, no hard overflow.
- **On desktop:** On the desktop two-column .sr-two-col layout the inner 1fr 1fr grid is fine; no >=1440 issue.
- **Fix:** Low priority; if Sightings card narrows, ensure the borderLeft divider doesn't strand when the grid would benefit from a single column at <360px.

#### [LOW/M] All three recharts charts use a fixed height={220} with left margin -16
`frontend/src/components/speciesDetail/SightingsGraph.tsx:92-108, 117-133, 143-179`
- **Problem:** ResponsiveContainer width is '100%' (good for width) but height is hardcoded 220 and the LineChart margin uses left:-16 to pull the Y axis in.
- **On a phone:** Width is responsive so no horizontal overflow, but at 320-360px the X-axis date/period tick labels (interval:'preserveStartEnd' with formatPeriodLabel) crowd; the negative left margin (-16) can clip the leftmost Y-axis tick at very narrow widths. Height 220 doesn't scale down, making the chart proportionally tall/cramped on a phone. The Media chart's Legend (Photo/Audio/Video) may wrap and collide with the plot at narrow widths since height is fixed.
- **On desktop:** At >=1440 the 220px fixed height looks short relative to a wide chart; charts feel squat in a full-width card.
- **Fix:** Keep ResponsiveContainer width 100% but consider a responsive height (e.g. taller on desktop, shorter min on phone) and reduce X tick density on narrow widths; verify the -16 left margin doesn't clip ticks at 320px.

#### [LOW/S] Comment meta row location span has no wrap/shrink guard
`frontend/src/components/SpeciesDetail.tsx:1351-1359`
- **Problem:** Meta row is flexWrap:'wrap' (good) but the location span (line 1358) has no maxWidth/ellipsis; a long location pushed onto its own wrapped line is fine, but inline with the date+dot it can be very long.
- **On a phone:** Mostly mitigated by flexWrap, but a long single-word location token has no break, so it can still overflow the comment row at 320px. Low because wrap is present.
- **Fix:** Add wordBreak/overflow-wrap to the location span; low priority given the row already wraps.

#### [LOW/S] Map popup maxWidth 260px with minWidth 120 — fine on phone, but anchor offset can push it past the map edge
`frontend/src/components/SightingsMap.tsx:70-85`
- **Problem:** The <Popup> uses maxWidth='260px' and inner minWidth:120; on the 300px-tall .sr-map-container (640px block) the map is full app-width, so 260px popup near a corner pin can extend toward the viewport edge.
- **On a phone:** At 320px viewport a 260px popup opened on an edge pin can clip against the map container's left/right edge (MapLibre keeps it inside the map canvas, but content is tight). Mostly acceptable; flagged because 260px is a large fraction of a 320px screen.
- **Fix:** Consider maxWidth: 'min(260px, 80vw)' so the popup never approaches the phone viewport edge; low priority since MapLibre clamps within the canvas.

#### [LOW/S] Sighting Locations card header: title + Pins/Heatmap segmented toggle in a no-wrap row
`frontend/src/components/SpeciesDetail.tsx:1196-1232`
- **Problem:** Header is a flex row (no flexWrap) with icon (28) + 'Sighting Locations' title + a marginLeft:auto Pins/Heatmap pill group. The title has no truncation.
- **On a phone:** At 360px the title 'Sighting Locations' + the two-button toggle (~110px) + icon roughly fit, but with the 18px card padding it is tight; a future longer title or larger text would collide. Borderline — listed for completeness.
- **Fix:** Allow the header to wrap (flexWrap) so the toggle drops below the title on very narrow phones, mirroring the Map Explorer pattern.

#### [LOW/S] SpeciesPanel header uses justifyContent:'space-between' (title ellipsis is handled; count pill flexShrink:0 — OK, but full panel has no min-width guard)
`frontend/src/components/SpeciesPanel.tsx:22-52`
- **Problem:** Header row is space-between with the title span using overflow/ellipsis/nowrap (good) + a flexShrink:0 count pill. The panel itself has no minWidth, so when used in a multi-column grid (e.g. .sr-compare-panels 3-up) it relies on the parent grid.
- **On a phone:** The header itself is safe (title ellipsizes). The risk is purely from the parent grid: if SpeciesPanel is placed in a non-collapsing fixed-column grid at this group it would be too narrow — but here the title ellipsis prevents overflow. Listed as low/no-defect-in-isolation.
- **Fix:** No change needed in SpeciesPanel itself; ensure any grid that hosts it collapses to 1 column under 640px (compare-panels already does).

### Data tables — Life List, Breeding Codes, Named Birds
_Auditor notes:_ Cross-checked against the single 640px block in globals.css (lines 767-803): none of the data-table components rely on the classes it handles except `.sr-named-map` (a fixed 220px map height inside an expanded Named Birds card — not a defect; the per-row map is gated behind cardMarkers.length>0 and the SightingsMap empty guard, and the single-open accordion caps WebGL contexts). So nothing reported here is already covered by that block.\n\nMechanism note: the app's established responsive escape hatches are (a) the wideMode / width:'max-content' table pattern + overflowX:'auto', which both tables (LifeListTable, BreedingCodeTable) already use correctly — so wide tables degrade to horizontal scroll rather than overflow the page; and (b) flexWrap on the big controls containers (LifeList line 592, BreedingCodeList line 273), which wrap the pill toolbar. The real defects are the constructs the wrap doesn't reach: atomic inline-flex sub-groups with no internal wrap (the two-date-input range groups) and the two justifyContent:'space-between' filter strips with non-shrinkable text + button.\n\nHIGHEST-CONFIDENCE OVERLAP: NamedBirdRow.tsx header (lines 35-63). It is the only no-wrap flex row in this group where BOTH ends are flexShrink:0 (bird name + the date-range/count group) and the sole shrinkable child (species) can collapse to zero, after which the right group overflows and is clipped by the card's overflow:'hidden' (line 34). This matches the user-confirmed real-phone overlap. The sighting detail rows inside the expanded card (lines 73-94) are correctly built (location ellipsizes via minWidth:0), so they are fine.\n\nUncertainty: native <input type=date> intrinsic minimum width varies by platform/locale (WebKit ~95-110px, Chromium narrower). The date-range findings are firm at 320px and marginal at 375-414px depending on engine. All severities assume the default text-scale of 1; the in-app Text Size multiplier (--sr-text-scale) would worsen every nowrap/fixed-width case proportionally.

#### [HIGH/M] Named Bird collapsed-header flex row cannot wrap; name + date-range + count collide and clip
`frontend/src/components/NamedBirdRow.tsx:35-63`
- **Problem:** The collapsed accordion header is a single flex row (display:'flex', alignItems:'baseline', gap:8) with NO flexWrap. Its children are chevron (flexShrink:0), bird name span (flexShrink:0, line 47), an optional species span (the ONLY shrinkable child, minWidth:0, line 49), and a marginLeft:'auto' group (flexShrink:0, line 55) holding the date-range span (whiteSpace:'nowrap', line 56) and the sighting-count span (whiteSpace:'nowrap', line 59). Both the bird name and the entire right-hand group are flexShrink:0, so once name + date-range ('Jan 1, 2020 – Dec 31, 2024') + count ('12 sightings') exceed the viewport, only the species collapses to zero width and the right group overflows.
- **On a phone:** At ~360px the date-range (~22 chars) + count (~12 chars) + bird name overflow the row. The species name collapses to nothing, then the right group runs off the right edge and is CLIPPED by the card wrapper's overflow:'hidden' (line 34) — the date range / sighting count are cut off or visually collide with the bird name. This is the user-confirmed real overlap class.
- **Fix:** Add flexWrap:'wrap' to the header button (allow the right group to drop to a second line) OR give the date-range/count group flexWrap and let the species span ellipsize; mirror the wrap-aware pattern already used in NamedBirdsTable's sort group. Add a 640px CSS class to the header so the date-range + count stack under the name on phones.

#### [MED/S] Active-filter strip uses justifyContent:'space-between' with no wrap; long filter text collides with Clear button
`frontend/src/components/LifeList.tsx:790-810`
- **Problem:** The hasLocationFilter strip is a flex row with justifyContent:'space-between' and NO flexWrap. The left span holds filterStripText (e.g. 'Alameda · May 1, 2022 – Dec 31, 2024 · 245 of 350 species') with no minWidth:0, and the 'Clear filter' button has no flexShrink:0. There is no horizontal-scroll container.
- **On a phone:** At ~360px the concatenated county + date-range + 'N of M species' text cannot shrink (no minWidth:0) and pushes the Clear-filter button off-row or makes the two visually touch/overlap; nothing wraps.
- **Fix:** Add flexWrap:'wrap' (and minWidth:0 on the text span / flexShrink:0 on the button) so the Clear button drops below the strip text on phones; add a 640px class. Same pattern as the BreedingCodeList strip.

#### [MED/S] Breeding-codes active-filter strip: same space-between no-wrap collision as the Life List strip
`frontend/src/components/BreedingCodeList.tsx:464-484`
- **Problem:** Identical construct to LifeList: flex row, justifyContent:'space-between', no flexWrap, left span holds filterStripText (county · date-range · 'N of M species') with no minWidth:0, 'Clear filter' button has no flexShrink:0.
- **On a phone:** At ~360px the long filter text and the Clear-filter button collide / the button is pushed past the right edge; no wrap and no scroll container to recover.
- **Fix:** flexWrap:'wrap' + minWidth:0 on the text span, flexShrink:0 on the button, or a 640px class that stacks them.

#### [MED/S] Date-range pair is a non-wrapping inline-flex of two native date inputs that don't shrink
`frontend/src/components/LifeList.tsx:740-774`
- **Problem:** The 'From'/'To' date controls live in an inline-flex container (line 740) with no flexWrap. Each native <input type=date> has paddingLeft:24/6 and no width set; native date inputs have a fixed intrinsic minimum width (~95-110px on iOS/WebKit) that does NOT shrink below their content, so the two inputs + the '→' separator have a hard floor near ~230px.
- **On a phone:** On a 320px phone the two date inputs + arrow cannot fit once the row also carries the calendar icon padding; the inner inline-flex has no flexWrap so it overflows its wrapping slot (the outer pills container wraps, but this atomic group does not), pushing past the viewport or being clipped.
- **Fix:** Allow the date-range group to wrap (flexWrap:'wrap') so 'From' and 'To' stack on phones, and/or set the inputs to width:'100%'/min-width:0 within a stacked layout via a 640px class.

#### [MED/S] Breeding-codes date-range pair: same non-wrapping two-date-input group
`frontend/src/components/BreedingCodeList.tsx:409-447`
- **Problem:** Same construct as the Life List date range — inline-flex (line 409), no flexWrap, two native date inputs with no width and a fixed intrinsic minimum, plus the '→' separator.
- **On a phone:** At 320px the two date inputs + arrow exceed the available width and the inner group overflows (it cannot shrink or wrap), crowding the County dropdown that wraps adjacent to it.
- **Fix:** Same as the Life List date range: let the group wrap and/or stack the inputs full-width under 640px.

#### [LOW/S] Vertical pill-separator dividers float mid-wrap on phones
`frontend/src/components/LifeList.tsx:515-517`
- **Problem:** The controls row packs ~20 wrappable pills/selects/toggles plus several vertical pillSep dividers (width:1, height:20, alignSelf:'center', flexShrink:0). When the flex-wrap container (line 592) reflows onto many rows at phone width, these vertical hairline dividers land at arbitrary wrap boundaries — sometimes at the start/end of a wrapped line — reading as stray vertical lines rather than group separators.
- **On a phone:** At 320-414px the dense filter bar wraps to 6+ rows and the vertical dividers appear orphaned/misplaced between rows; cosmetic clutter, not an overlap.
- **On desktop:** Fine on desktop (single row).
- **Fix:** Hide the pillSep dividers (or convert section grouping to row-grouped containers) under 640px via a class.

#### [LOW/S] Multimedia table relies on horizontal scroll; name column minWidth:200 leaves little room on a 320px phone
`frontend/src/components/LifeListTable.tsx:202-225`
- **Problem:** Normal mode wraps the table in overflowX:'auto' (line 207) — the documented scroll pattern — and the name <th> has minWidth:200 (line 224) plus 3×80 media columns + 70 total ≈ 510px minimum. wideMode swaps to width:'max-content' (page-scroll) per the app pattern, so the mechanism is correct.
- **On a phone:** At 320px the table is ~510px wide and must be horizontally scrolled inside the card; the 200px name column consumes most of a 320px viewport, leaving the media columns mostly off-screen until scrolled. Functional (scroll container present) but cramped; no overlap.
- **On desktop:** width:'100%' fills wide screens fine.
- **Fix:** Acceptable as-is given the wideMode/overflowX pattern; optionally reduce name minWidth under 640px so at least one media column is visible without scrolling.

#### [LOW/S] Breeding-codes table: 220px sticky first column dominates a phone viewport; many code columns force long horizontal scroll
`frontend/src/components/BreedingCodeTable.tsx:121-219`
- **Problem:** The table has overflowX:'auto' + a sticky 220px-wide first column (width/minWidth/maxWidth all 220, line 213-215) and a dynamic number of 44px code columns (codesPresent can be 10-20+). Total width can exceed 1000px. The mechanism (scroll + sticky first col) follows the documented wideMode pattern, but the fixed 220px first column is not responsive.
- **On a phone:** At 320-360px the sticky first column (220px) leaves only ~100-140px of viewport for the scrollable code columns, so users see roughly two code columns at a time; with many codes the horizontal scroll is very long. Usable but tight; no overlap or clip beyond the intended scroll.
- **On desktop:** Fine on desktop.
- **Fix:** Optionally narrow the sticky first column (e.g. 150-170px) under 640px so more code columns are visible per scroll; keep the existing sticky + overflowX pattern.

#### [LOW/S] Named Birds intro paragraph has no max measure; over-wide line length at >=1440px
`frontend/src/components/NamedBirds.tsx:121-133`
- **Problem:** The intro block (icon + heading + descriptive <p> at line 129) sits in a full-width column with no max-width on the paragraph. The <p> stretches to the full content width.
- **On a phone:** None — it wraps fine on phones.
- **On desktop:** At >=1440px the explanatory paragraph runs to a very long single-line measure (well past comfortable reading length) before wrapping, reducing readability.
- **Fix:** Cap the paragraph measure (e.g. maxWidth ~640-720px / ch-based) for desktop readability; no phone impact.

### Weather / Current-Predict forecast / Tide panels
_Auditor notes:_ Cross-check done against globals.css 640px block (lines 767-803): of the classes overridden there, only .sr-two-col is used in this screen group (WeatherTideSection line 157) and it correctly collapses the two comparer panels to one column on phones. EVERY other layout in these four files is built with inline styles and gets NO responsive handling - the 640px block cannot reach them.\n\nThe app's existing good patterns appear here and are correctly applied in a few spots (worth mirroring elsewhere): (1) the <pre> copy/mono blocks use whiteSpace:'pre' + overflowX:'auto' (WeatherForecastPanel line 472, WeatherTidePanel line 44) = the horizontal-scroll wideMode container; (2) the weather detail chips row uses flexWrap:'wrap' (WeatherForecastPanel line 102); (3) text inputs carry minWidth:0 (line 61) so flex search rows shrink gracefully. These are the templates the broken rows should adopt.\n\nThe RECURRING defect across all four files is the space-between flex row with no flexWrap plus a flexShrink:0 / whiteSpace:'nowrap' action button beside growable text - it appears 4x (WeatherForecastPanel 446, WeatherTidePanel 207, WeatherTideSection 67 Nudge and 114 header). A single fix pattern (add flexWrap:'wrap', let the button go full-width when wrapped) resolves all of them. The two non-collapsing fixed-2-column grids (WeatherForecastPanel 124 tide Next/Prev, and 377 the lat/lng/date/time 2x2) are the highest-impact: the lat/lng/date/time grid is high severity because native date/time inputs have an intrinsic min-width that forces real horizontal overflow at <=375px.\n\nPredictMap width:100% means no horizontal overflow (good); its fixed 180px height is the only desktop-side note (too short on >=1440). I evaluated empty/loading/error/too-far/out-of-range states: the too-far and out-of-range result branches are where the overlap risk concentrates because they introduce the action-button-beside-text rows. No recharts in this group (no chart-container findings apply). No position:absolute/fixed overlapping content in these files (the map is the only positioned context and it is contained).

#### [HIGH/S] Predict lat/lng/date/time inputs are a fixed 2x2 grid that never collapses
`frontend/src/components/WeatherForecastPanel.tsx:377-394`
- **Problem:** The Latitude/Longitude/Date/Time field block uses gridTemplateColumns:'1fr 1fr' (line 377) with gap:12 and no breakpoint. The date and time inputs are native type='date'/type='time' controls with intrinsic minimum widths (browser-rendered spinner/picker UI).
- **On a phone:** At 320-375px, inside the predict panel (16px padding) plus the outer card padding, each 1fr column is ~120-140px. Native date/time inputs have a fixed minimum content width (calendar/clock affordances) wider than that, so they overflow their grid cell and push horizontal overflow on the whole panel; lat/lng number inputs are usable but cramped.
- **Fix:** Give this grid a responsive class that collapses to 1fr below ~480-640px (or grid-template-columns: repeat(auto-fit, minmax(150px,1fr))) so the four controls stack one-per-row on a phone.

#### [MED/S] Tide Next/Prev high-low grid is fixed 2-column and never collapses
`frontend/src/components/WeatherForecastPanel.tsx:124-127`
- **Problem:** TideSummaryView's inner grid uses gridTemplateColumns:'1fr 1fr' (line 124) with no breakpoint. Each cell holds 'Next high 5.2 ft · 11:34 PM' / 'Prev low 1.2 ft · 6:02 AM' at 0.8125rem.
- **On a phone:** At ~320-375px each 1fr column is ~140px after the card padding; the 'Next {kind} {v} ft · {timeLocal}' string can't fit, so cells wrap raggedly or the longer one overflows its column and visually overlaps the neighbouring cell. Text does not nowrap so it wraps to several lines, breaking the 2-up grid alignment.
- **Fix:** Drop the inline 2-col grid for a class that collapses to a single column below 640px (mirror the .sr-two-col pattern), or use repeat(auto-fit, minmax(180px, 1fr)) so each row goes full-width when narrow.

#### [MED/S] Tide too-far notice + 'show anyway' button row is space-between, no wrap, button nowrap
`frontend/src/components/WeatherForecastPanel.tsx:446-455`
- **Problem:** The too-far/outside-US warning is a flex row with justifyContent:'space-between' and gap:12, no flexWrap (line 446). It holds a multi-line notice sentence (from tideTooFarNotice) on the left and a flexShrink:0, whiteSpace:'nowrap' override button on the right (line 451).
- **On a phone:** At ~320-360px the notice text + the non-shrinking button can't coexist on one row; the notice column gets squeezed very narrow and wraps to many lines beside a tall button, or the button (nowrap, flexShrink:0) forces the row wider than the card and clips/overflows. The override label can be long ('Show nearest station anyway').
- **Fix:** Add flexWrap:'wrap' (or flexDirection:'column' below a breakpoint) so the button drops under the notice on narrow widths; let the button be full-width when wrapped.

#### [MED/S] Comparer tide too-far row is space-between with non-shrinking nowrap button, no wrap
`frontend/src/components/WeatherTidePanel.tsx:207-227`
- **Problem:** The too-far/outside-US block in the comparer panel is a flex row justifyContent:'space-between', gap:12, no flexWrap (line 207-212); left is a multi-line notice, right is a flexShrink:0 whiteSpace:'nowrap' override button (line 217-223).
- **On a phone:** After .sr-two-col stacks at 640px each panel is full phone width, but the panel itself has only 14px inner padding so at 320px the notice text + non-shrinking button collide: the notice column is squeezed to a sliver and wraps to many lines while the nowrap button forces the row toward overflow. Same class of defect as the Now/Predict too-far row.
- **On desktop:** On the 2-up desktop layout each panel is ~half width, so this row is ALSO tight on a narrow desktop column (e.g. 1024px split in two ≈ 480px panel) — the button can crowd the notice.
- **Fix:** Add flexWrap:'wrap' or stack to column below a width threshold; make the button full-width when wrapped.

#### [MED/S] Section header space-between with long 'Load weather & tide' nowrap button can crowd at 320px
`frontend/src/components/WeatherTideSection.tsx:113-129`
- **Problem:** The section header is a space-between flex row gap:8 (line 114) with the 'Weather & Tide' title and a nowrap, fixed-height button labelled 'Load weather & tide' (whiteSpace:'nowrap', line 122). No flexWrap.
- **On a phone:** At 320px the title + the wide nowrap button ('Load weather & tide' ≈ 150px+ at padding 16) plus gap can exceed the row; with no flexWrap the title shrinks to nothing or the button pushes the row to overflow. The button cannot shrink (nowrap, fixed padding).
- **Fix:** Add flexWrap:'wrap' to the header row so the button drops to its own line on narrow widths, or shorten the button label to an icon+'Load' on phones.

#### [MED/S] Settings Nudge row is space-between, no wrap, with a nowrap 'Go to Settings' link and long sentence
`frontend/src/components/WeatherTideSection.tsx:64-81`
- **Problem:** The Nudge is a flex row justifyContent:'space-between', gap:12, no flexWrap (line 67) with a long warning sentence on the left and a flexShrink:0, whiteSpace:'nowrap' 'Go to Settings ->' button on the right (line 75).
- **On a phone:** At 320px the sentence ('eBird API key not configured — weather & tide lookups require an eBird API key.') plus the non-shrinking 'Go to Settings ->' button can't share one row; the sentence column is crushed and wraps to many lines beside the button, or the row overflows. No flexWrap to relieve it.
- **Fix:** Add flexWrap:'wrap' so the action drops below the text on narrow widths.

#### [LOW/S] Result header place name + status pill row relies on ellipsis but pill can crowd at 320px
`frontend/src/components/WeatherForecastPanel.tsx:420-423`
- **Problem:** The result header is a space-between flex row (line 420) with an h3 place name (whiteSpace:'nowrap'+ellipsis) and a pill (flexShrink:0, nowrap). Pill text can be 'FORECAST · DAILY'.
- **On a phone:** Graceful-ish: the h3 truncates with ellipsis so it won't overflow, but at 320px a long pill ('FORECAST · DAILY') leaves almost no room for the place name, truncating it to a few characters. Not an overlap, but the place becomes unreadable.
- **Fix:** Acceptable as-is for overlap; optionally allow the pill to wrap below the title on very narrow widths, or shorten the daily pill text. Low priority.

#### [LOW/S] Large fixed font temperature row with emoji can crowd the H/L suffix at 320px
`frontend/src/components/WeatherForecastPanel.tsx:86-101`
- **Problem:** WeatherSummaryView header is a flex row gap:14 with a 2.5rem emoji+moon span and a 2.1rem temp; the temp line appends 'H 72° · L 54°' at 0.9375rem with marginLeft:8 (lines 86-95). The text wrapper has minWidth:0 so it can shrink, but the temp line itself has no wrap control.
- **On a phone:** At 320px the 2.5rem emoji (~40px+) plus the 2.1rem '72°F' plus the inline H/L suffix on the same line can exceed the available width; the H/L suffix wraps under the big temp awkwardly. Usable but visually cramped. The emoji+moon (two glyphs) at 2.5rem is wide.
- **Fix:** Allow the temp line to wrap the H/L suffix, or reduce the emoji/temp font-size via a clamp() on narrow widths. Low/med.

#### [LOW/M] Predict panel and result card use fixed inline padding not reduced on phones
`frontend/src/components/WeatherForecastPanel.tsx:348-349`
- **Problem:** The predict input panel (padding:16, line 349) and the result region (padding:'16px 18px', line 419) and the copy-block <pre> (padding:'18px 20px', line 472) are fixed inline paddings with no media-query class. Unlike .sr-card these get no 640px padding reduction.
- **On a phone:** On a 320px phone these panels sit inside the already-reduced .sr-card (20px) so usable space is ~360-2*20-2*16 ≈ small; the fixed inner padding plus the non-collapsing grids inside compound the crowding. The pre's 20px horizontal padding eats into the already-narrow monospace block.
- **Fix:** Move these panels' padding to classes that reduce horizontal padding below 640px (consistent with the .sr-card pattern), e.g. padding:12 on phones.

#### [LOW/S] Predict map fixed height:180 is short on desktop; fallback duplicates the height independently
`frontend/src/components/PredictMap.tsx:50-59`
- **Problem:** PredictMap hardcodes style={{ height: 180, width:'100%' }} (line 54); the Suspense fallback in WeatherForecastPanel uses height:180 (line 372). Width:100% is fine, height is fixed.
- **On a phone:** Width:100% means no horizontal overflow on a phone (good). A fixed 180px map height is small but workable on a phone; the draggable-pin interaction in a 180px-tall non-scroll-zoom map is tight on touch but not an overlap defect. No collision.
- **On desktop:** On a wide >=1440px screen, 180px is quite short for a location-picker map embedded in a roomy card; the map feels cramped vertically while there is ample width. Minor.
- **Fix:** Consider a slightly taller map on wider viewports (e.g. clamp/min height ~220-260px above 640px) and keep the fallback height in sync (share a constant) so the two never drift.

#### [LOW/S] Weather detail chips row already wraps (flexWrap) — verified not a defect
`frontend/src/components/WeatherForecastPanel.tsx:102-108`
- **Problem:** The Wind/Humidity/Dew pt/Cloud/Sun chips row uses display:flex with flexWrap:'wrap' and gap:'8px 18px' (line 102). Each chip nowraps internally via the <b> but the row wraps.
- **On a phone:** No overflow: chips reflow to multiple lines at 320px. The 'Sun 6:12 AM – 8:31 PM' chip is the widest single chip and fits within ~280px. This is the correct pattern; included only to confirm it is NOT a defect.
- **Fix:** No change needed; this is the reference wrap behaviour the other rows lack.

#### [LOW/S] Comparer MonoBlock <pre> scrolls horizontally (good) but stacked layout makes it very narrow
`frontend/src/components/WeatherTidePanel.tsx:39-49`
- **Problem:** MonoBlock uses whiteSpace:'pre', overflowX:'auto' (line 44) — the correct horizontal-scroll wideMode pattern. The weather/tide formatted blocks are wide fixed-width monospace.
- **On a phone:** Not an overflow defect (overflowX:auto contains it). But when .sr-two-col collapses to 1 column at 640px, the two panels stack and each pre is full-width minus paddings; a long monospace weather line forces an inner horizontal scrollbar on the phone. Acceptable, by design (same as the Weather tab pre).
- **Fix:** No change required; documenting that the scroll container is present and correct.

#### [LOW/S] BlockEyebrow space-between row is safe (short label + nowrap Copy button)
`frontend/src/components/WeatherTidePanel.tsx:60-83`
- **Problem:** BlockEyebrow is a space-between flex row (line 61) with a short uppercase label ('WEATHER OUTPUT') and a nowrap Copy button.
- **On a phone:** No overlap: the label is short and the button small; even at 320px they coexist. Documented as NOT a defect to be exhaustive.
- **Fix:** No change needed.

#### [LOW/S] Comparer panels use .sr-two-col which IS collapsed at 640px (handled)
`frontend/src/components/WeatherTideSection.tsx:157-170`
- **Problem:** The two WeatherTidePanels are wrapped in className='sr-two-col' (line 157), which the globals.css 640px block sets to grid-template-columns:1fr.
- **On a phone:** Handled by globals.css line 771 — the two panels stack to a single column below 640px, so no side-by-side overflow on a phone. Listed to confirm it is NOT a finding (the cross-check the task requested).
- **Fix:** No change; the inner-row issue (comparer-toofar-row) remains.

#### [LOW/S] Predict place input + search button row is safe (input minWidth:0 + flexShrink:0 button)
`frontend/src/components/WeatherForecastPanel.tsx:358-370`
- **Problem:** The place-search row is flex gap:8 (line 358) with a width:100% input (textInput has minWidth:0, line 61) and a flexShrink:0 icon button.
- **On a phone:** No overflow: the input has minWidth:0 so it shrinks, the button is a fixed-size icon. Correct pattern; documented as NOT a defect.
- **Fix:** No change.

### App shell, header, footer, Weather card, Tab nav, Welcome/Setup
_Auditor notes:_ Cross-checked against the single 640px block in globals.css FIRST. Already-handled (NOT reported): .sr-header top padding, .sr-panel vertical padding, .sr-card padding 32->20, .sr-two-col / .sr-compare-panels / .sr-media-grid collapse, .sr-map-container/.sr-media-iframe heights, the map sidebar overlay + filters FAB + sidebar-close, and the map fullscreen overlay (position:fixed/inset:0/100dvh in App.tsx lines 1125-1126 is intentional and viewport-correct). The weather/tide <pre> blocks (App.tsx 893-910, 959) correctly use overflowX:'auto' with whiteSpace:'pre' — no finding. The weather input row (742-793) is sound: input has flex:1 + minWidth:0, button has flexShrink:0. WelcomeScreen (overflowY:'auto', maxWidth 540 centered, two-step card) is responsive-safe down to 320px; its bottom button row (gap:18) is tight but not breaking — not reported. RootErrorBoundary and setupCopy.tsx have no responsive defects. The TabNav collapse mechanism (ResizeObserver overflow probe) is robust; the only TabNav defect is the un-capped dropdown height. Highest-confidence real defect for the user's confirmed phone overlap is map-fixed-vh-chrome (the calc(100vh - 178px) magic number) — it is the one place a desktop chrome-height assumption is baked in and will mis-size against the taller phone nav + wrapping footer. The space-between-without-flexWrap banner/notice rows are the next most likely overlap sources at ~360px. The recurring pattern across this group: inline-styled flex rows with justifyContent:'space-between' + a flexShrink:0/nowrap action button and no flexWrap; the durable fix consistent with the app's class+media-query pattern is to give these rows classes and add flexWrap/column-stack rules to the existing 640px block.

#### [HIGH/M] Map Explorer panel height hardcoded to calc(100vh - 178px)
`frontend/src/App.tsx:1121-1128`
- **Problem:** The non-fullscreen Map Explorer tabpanel uses style height: 'calc(100vh - 178px)'. The 178px is a magic number that assumes the DESKTOP chrome stack (header at 48px top padding + wordmark + tagline, the single-row tab bar, the footer). On a phone the chrome differs: the 640px block shrinks .sr-header padding-top to 24px, the tab bar becomes a taller dropdown (padding 12px 16px), and the footer wraps to multiple lines. So 178px no longer matches the real header+nav+footer height.
- **On a phone:** At ~360px the subtracted 178px under-counts the actual chrome (taller dropdown nav + multi-line wrapped footer), so the map either pushes the footer off-screen / overlaps it or leaves the map taller than the available space, forcing whole-page vertical scroll the map already manages itself. On very short phones the map can clip below the fold.
- **On desktop:** Brittle even on desktop: any header/footer text reflow (longer update-status text, a second footer line) breaks the 178px assumption and the map mis-sizes.
- **Fix:** Replace the magic calc with a flex-driven height (let the map panel be flex:1 inside the column flex container that <main> already implies) or a 100dvh-minus-measured-chrome approach. At minimum move the value behind the 640px media pattern so phones get a viewport-appropriate height (e.g. a .sr-map-explorer-panel class sized with dvh).

#### [MED/S] Collapsed tab dropdown listbox has no max-height / scroll
`frontend/src/components/TabNav.tsx:280-351`
- **Problem:** The TabDropdown listbox is position:absolute, left:16/right:16, top:calc(100% - 2px) with padding:6 and no maxHeight or overflow. It renders one ~44px-tall option per nav item. With all 9 configurable tabs visible plus the Settings entry (10 rows) the menu can be ~440px+ tall.
- **On a phone:** On a short phone viewport (especially landscape, ~360px tall) the open menu exceeds the viewport and the bottom options (Settings is always last) are clipped with no way to scroll to them — the user cannot reach Settings from the nav.
- **Fix:** Add maxHeight (e.g. calc(100dvh - <trigger bottom> - 16px) or a fixed cap like 70vh) plus overflowY:'auto' to the listbox container, consistent with capping overlays to the viewport.

#### [MED/S] API-key warning banners: space-between row with a nowrap, non-shrinking button
`frontend/src/App.tsx:684-723`
- **Problem:** Each warning banner is a flex row with justifyContent:'space-between', gap:12, no flexWrap. The message <span> has no min-width:0 and the 'Go to Settings →' button is whiteSpace:'nowrap' + flexShrink:0. The OpenWeather message is long (two sentences).
- **On a phone:** At ~320-375px the non-shrinking nowrap button reserves its full width and the message column is squeezed to a very narrow strip; with the longer OpenWeather copy the text wraps to many short lines and the button can crowd hard against it (no wrap to its own line). On very narrow widths the row can overflow horizontally since the span's intrinsic min-width plus the nowrap button exceed the container.
- **Fix:** Add flexWrap:'wrap' so the button drops below the text on narrow widths, or stack the banner (flexDirection column) under 640px via a class, matching the existing media-query approach.

#### [MED/S] Tide too-far / outside-US notice: space-between row with a nowrap override button
`frontend/src/App.tsx:929-943`
- **Problem:** The too-far/outside-us tide notice is a flex row with justifyContent:'space-between', gap:12, no flexWrap; the inner text span is flex with align-items flex-start (icon + message) and the override button is flexShrink:0 + whiteSpace:'nowrap'. Override labels like 'Show nearest station anyway' are long.
- **On a phone:** At ~360px the nowrap button cannot shrink or wrap below the text, so the message column gets crushed and the row risks horizontal overflow inside the 540-max card (which is full-width and box-sizing border-box on a phone).
- **Fix:** Add flexWrap:'wrap' (and min-width:0 on the text span) so the action button can wrap beneath the message on narrow widths.

#### [LOW/S] Checklist meta line (id / locName / date) can overflow with a long location name
`frontend/src/App.tsx:848-857`
- **Problem:** The result meta renders `${state.checklistId} / ${state.locName} / ${formatObsDate(...)}` as a single monospace span with letterSpacing, no overflow-wrap/word-break handling. eBird location names can be long single tokens (URLs, hyphenated place strings).
- **On a phone:** On a 320-375px card a long unbroken location token does not wrap at the slashes and overflows the card horizontally (monospace + letterSpacing widens it further); no overflowX container here.
- **Fix:** Add overflowWrap:'anywhere' (or word-break) to the span, or render the three parts on separate lines / with wrapping, so a long locName breaks within the card.

#### [LOW/S] SetupRequired uses 32px horizontal padding, not covered by the 640px block
`frontend/src/components/SetupRequired.tsx:10-20`
- **Problem:** The empty-state container is padding:'52px 32px 48px'. SetupRequired is its own component (not .sr-card/.sr-panel), so the 640px media block never reduces this padding. Inner blocks use maxWidth (420/440) with width:100%.
- **On a phone:** At 320px the 32px each-side padding leaves only ~256px of content width, crowding the numbered steps (each step is a flex row with an 18px circle + gap:10 + text); long step text gets a narrow column and the screen feels cramped versus the rest of the app whose .sr-panel padding shrinks on phones.
- **Fix:** Reduce horizontal padding under 640px (give the container a class and add it to the media block, mirroring .sr-card/.sr-panel) so the phone padding matches the rest of the app.

#### [LOW/M] Weather card and panel content capped at maxWidth 540 leaves a wide empty desktop
`frontend/src/App.tsx:725-734`
- **Problem:** The Weather panel centers a single column whose card, helper text and footer note are all maxWidth:540. The panel itself is full width with 24px side padding.
- **On a phone:** 
- **On desktop:** At >=1440px the entire Weather tab is a 540px column floating in a very wide centered void — large awkward whitespace on both sides; the tab reads as under-filled on big screens. (Phones are fine: card goes width:100%.)
- **Fix:** Consider a wider max-width or a two-column layout (e.g. inputs/output beside the forecast panel) at large breakpoints; at minimum nudge the max-width up on wide screens. Cosmetic/desktop polish only.

#### [LOW/S] Footer is a single inline paragraph with many separated actions/status
`frontend/src/App.tsx:1196-1324`
- **Problem:** The footer <p> strings together SnowRaven link, ' · Self-hosted Birding Tools · ', Help button, ' · ', Check For Updates button, optional ' · Install update and restart', a status span, and an optional downloading progress span — all inline, separated by ' · ' middots, with 24px side padding (not reduced by the 640px block; only .sr-header/.sr-panel/.sr-card are).
- **On a phone:** At ~320-360px the inline chain wraps mid-phrase, and the ' · ' separators can strand at line ends/starts, producing a ragged multi-line footer; with an active 'available' update the extra Install button + status text crowds further. It does wrap (it's a <p>) so no overflow, but the layout reads broken on a phone.
- **Fix:** At narrow widths render the footer as a wrapping flex with consistent gap instead of inline middot separators, or stack the actions; reduce side padding under 640px.

### Overlays & shared — Help, BirdName, SpeciesLinks, CommentText, ToggleSwitch
_Auditor notes:_ All findings in this group are LOW severity — none produce a hard overlap on their own. The Help overlay's stacking IS already handled by the 640px block in globals.css (lines 777-780: .sr-help-row flex-direction:column + .sr-help-toc width:100%/position:static/max-height:none), and the sticky-TOC calc(100vh - 52px) and content maxWidth:680 are both reset/benign at narrow widths, so I did NOT flag those. The <pre> blocks correctly use overflowX:'auto'. The remaining concrete gaps are: (1) the inline padding:'0 24px' on .sr-help-row is the one piece of the help row NOT reset at 640px (it is the only material narrow squeeze in HelpDocs); (2) long-token overflow guards missing on inline <code> (HelpDocs) and plain text segments (CommentText) — links already have wordBreak:'break-word', so this is an inconsistency; (3) SpeciesLinks contributes a fixed ~58px non-shrinking favicon cluster to every BirdName, which is the real phone-table crowding driver but is a shared-width contributor whose true fix is in the host tables (out of scope for this group) plus an optional dense variant here. BirdName's own CSS is sound (sci line truncates by design with min-width:0 throughout). ToggleSwitch and SpeciesLinks have no internal overlap; their narrow risk is as fixed-width pieces inside host toolbars/tables that lack flexWrap — flagged as contributing factors so the parent agent can correlate with the toolbar/table findings from other groups. Desktop (>=1440px): all five components behave well — the help content maxWidth:680 within a centered maxWidth:1100 row gives a comfortable measure with no awkward stretch; no desktop defects found.

#### [LOW/S] Help overlay content row keeps 48px horizontal padding at phone widths
`frontend/src/components/HelpDocs.tsx:352-355`
- **Problem:** The .sr-help-row wrapper has inline style padding: '0 24px' (and gap: 40). The 640px block in globals.css (lines 779-780) only overrides flex-direction, gap, and .sr-help-toc width — it does NOT touch the inline left/right padding. So on a phone the doc column still pays 48px (24+24) of horizontal padding.
- **On a phone:** At 320px the content area shrinks to ~272px; combined with the content div's own layout this crowds prose, <pre> blocks, and long inline links. Not an overlap but a measurable squeeze that the rest of the 640px stacking work otherwise fixed.
- **Fix:** Add a .sr-help-row padding override inside the existing 640px block in globals.css (e.g. padding: 0 14px !important), matching the class-based override pattern the help row already relies on for flex-direction/gap.

#### [LOW/S] Help overlay header has fixed 0 20px padding and a non-wrapping title/close row
`frontend/src/components/HelpDocs.tsx:316-348`
- **Problem:** The header is a flex row (justifyContent implied by flex:1 on the title group + the 32px close button) with inline padding: '0 20px', gap: 12, height: 52, and no flexWrap. The title span has no truncation. The title 'SnowRaven Documentation' is short so it fits today, but the row is a fixed-padding, no-wrap space-between layout that is not reset at the 640px breakpoint.
- **On a phone:** At 320px the header keeps 40px of horizontal padding; fine for the current short title but the construct (no-wrap, fixed padding, no narrow override) is the same pattern flagged elsewhere and would clip/overflow if the title ever lengthens or is localized.
- **Fix:** Acceptable as-is given the short fixed title; if hardened, reduce header padding in the 640px block and add minWidth:0 + ellipsis to the title span. Consistent with the CSS-class override pattern.

#### [LOW/S] Inline `code` spans in help markdown have no overflow-wrap for long tokens
`frontend/src/components/HelpDocs.tsx:46-56`
- **Problem:** renderInline emits inline <code> with monospace font, border, and padding but no overflowWrap/wordBreak. A long unbroken code token (e.g. a long path, URL, or key name) in HELP.md cannot break inside the code span.
- **On a phone:** On a 320-414px viewport a long inline code token pushes horizontal overflow inside the doc column (the column itself has no overflow-x scroll; only <pre> blocks set overflowX:'auto'), causing a horizontal scrollbar or clipped text.
- **Fix:** Add overflowWrap:'anywhere' (or wordBreak:'break-word') to the inline <code> style, mirroring the wordBreak:'break-word' already used on links in CommentText.tsx.

#### [LOW/S] TOC buttons are full-width block text with no truncation when stacked above content
`frontend/src/components/HelpDocs.tsx:370-394`
- **Problem:** Each TOC button is display:block, width:100%, textAlign:left with no whiteSpace/overflow handling. At 640px the TOC stacks full-width above the content (640px block sets .sr-help-toc width:100%).
- **On a phone:** Labels are short so they fit at 320px today; the construct relies on label brevity rather than any wrap/ellipsis guard. Not a current overlap.
- **Fix:** Low priority; labels are short. If hardened, the buttons already wrap on spaces (default whiteSpace), so no change is strictly needed.

#### [LOW/M] Favicon cluster appends ~50-58px of fixed, non-shrinking width to every bird name
`frontend/src/components/SpeciesLinks.tsx:10-17`
- **Problem:** Outer span is display:inline-flex, alignItems:center, gap:5, marginLeft:6. Each of the two favicon links has padding:5 / margin:-5 (a 24px hit target around a 14px icon) and each .sr-favicon-slot is flex-shrink:0 (globals.css 415-422). The cluster therefore reserves roughly marginLeft 6 + two 24px hit targets + gap 5 ≈ 58px that cannot shrink. The outer span itself has no flex-shrink:0 but its fixed-size children dominate.
- **On a phone:** BirdName puts this cluster in .sr-birdname-row (flex, min-width:0) next to the name. In dense table cells at 320-375px this fixed ~58px chunk steals width from the name, forcing the name text to wrap to multiple lines (or, in nowrap cells used by callers, to push the cell wider). Magnified across every row of a species table on a phone.
- **Fix:** Mostly a caller/table-layout concern, but this component is the fixed-width contributor. Consider a denser/smaller hit-target variant (or hiding favicons) for sm-size BirdName in narrow contexts, or let callers opt out of favicons in phone tables. Keep WCAG 2.5.8 24px target on desktop.

#### [LOW/S] BirdName row pairs a wrappable name with a fixed favicon cluster; sci line truncates by design
`frontend/src/components/BirdName.tsx:40-58`
- **Problem:** The .sr-birdname-row is a flex row holding the (wrappable) common name button/text plus the fixed-width SpeciesLinks cluster. The stacked sci line uses .sr-birdname-sci with white-space:nowrap + ellipsis (globals.css line 440), so it truncates rather than overflows — fine by design. The crowding risk is the name+favicon pairing, not BirdName's own CSS.
- **On a phone:** At 320-375px a long common name (e.g. subspecies parenthetical) plus the ~58px favicon cluster in one flex row leaves little room; the name wraps under the favicons or the row grows, depending on the host cell. The component is sound; the defect surfaces only with the SpeciesLinks fixed width in narrow host cells.
- **Fix:** No change to BirdName itself required; address via the SpeciesLinks density variant (see specieslinks-fixed-favicon-cluster-width) and the host tables' narrow handling.

#### [LOW/S] Plain (non-link) comment text segments lack overflow-wrap for long unbroken tokens
`frontend/src/components/CommentText.tsx:29-36`
- **Problem:** Link segments get wordBreak:'break-word' (line 25), but plain text segments are rendered as raw children split only on \r\n/\n. A very long unbroken token in a comment (no spaces — e.g. a pasted hashtag string or URL-without-scheme that linkify did not turn into an anchor) has no wordBreak and normal whitespace wrapping cannot break it.
- **On a phone:** On 320-414px such a token overflows the comment container horizontally (Checklists / Comparer comment cells), producing a horizontal scrollbar or clipped text.
- **Fix:** Apply overflowWrap:'anywhere' on the comment container or wrap plain segments with the same wordBreak:'break-word' used for links, so all comment text breaks consistently.

#### [LOW/S] ToggleSwitch is a fixed-height inline-flex pill whose label cannot wrap; crowds in toolbars
`frontend/src/components/ui/ToggleSwitch.tsx:12-41`
- **Problem:** The button is display:inline-flex, height:30 (fixed), with a 28px knob track (flex-shrink:0) and the label text appended inline. The label has no whiteSpace handling, so it can wrap, but the pill has no flexWrap and a fixed height; with a long label the text would wrap and either be clipped by the fixed 30px height or break the pill shape.
- **On a phone:** On its own the component is small and fits at 320px. The risk is (a) a long label wrapping inside the fixed 30px-height pill clips the second line, and (b) rows of multiple ToggleSwitches in host toolbars (no flexWrap there) crowd/overflow at 360px — a contributing factor rather than an internal overlap.
- **Fix:** Add whiteSpace:'nowrap' to the button so labels never wrap inside the fixed-height pill; rely on host toolbars adding flexWrap to handle multiple toggles at narrow widths.

### CSS / breakpoint infrastructure & dead boilerplate
_Auditor notes:_ SCOPE / DEAD-FILE CONFIRMATION: Grep across src (*.ts/*.tsx/*.js/*.jsx/*.html) shows the ONLY CSS imports are `import './globals.css'` in main.tsx and `import 'maplibre-gl/dist/maplibre-gl.css'` in SnowMap.tsx. index.css and App.css are imported NOWHERE (index.html references no css; App.tsx import block does not reference App.css). Both are Vite/Tauri React-TS starter-template leftovers (App.css = .hero/#next-steps/Vite-logo demo; index.css = starter tokens + `#root{width:1126px}` + a duplicate `@import \"tailwindcss\"`). RECOMMEND DELETING BOTH as cleanup — they are inert, but index.css carries a stale 1126px fixed root width and a competing 1024px font tier that would conflict if ever imported.

BREAKPOINT STRATEGY ASSESSMENT (the additional task): One 640px breakpoint is NOT enough for phone+tablet+desktop. What exists today: exactly one `@media (max-width:640px)` block (globals.css 767-803) toggling ~10 class hooks, plus JS-driven TabNav overflow collapse (ResizeObserver, not a fixed breakpoint) and the map's CSS-overlay/100dvh fullscreen. Crucially, the app is ~entirely inline-styled, and the comment at globals.css 532-534 documents the core constraint: inline grid styles CANNOT be overridden by media queries, which is exactly why only 3 grids (.sr-two-col, .sr-compare-panels, .sr-media-grid) were lifted into classes. Everything else laid out with inline `display:grid`/`flex` has no responsive hook and cannot collapse at any width.

RECOMMENDED MINIMAL STRATEGY (consistent with the existing CSS-class approach, avoids rewriting every inline style):
1) Add a small tier set: ~480 (small-phone tightening), keep 640 (phone/tablet boundary, already here), ~1024 (laptop two-col enablement), and a >=1440 container cap. Four breakpoints, mobile-first, named in comments/vars.
2) Add a handful of REUSABLE responsive class hooks and migrate the offending inline-style containers to them (the same lift-to-class move already used at lines 526-539): `.sr-container` (max-width ~1280-1400 + margin-inline:auto, fixes the >=1440 over-wide problem AND there is currently NO desktop max-width anywhere), `.sr-grid-auto` (repeat(auto-fill,minmax(min,1fr)) — self-collapsing, no breakpoint math needed), and named `.sr-grid-2`/`.sr-grid-3` that drop to 1fr at the new tiers for the cases that need explicit control.
3) Add a backstop `overflow-x` guard / `min-width:0` on flex-grid children so one stray fixed-width inline element does not make the entire page scroll sideways on a phone (the symptom the user reported). Real fixes still belong per-component.
4) Adopt the existing table pattern app-wide for wide tables (width:'max-content' inside an overflow-x:auto wrapper) and prefer `aspect-ratio` over fixed iframe/map heights.

This keeps the inline-style architecture intact: the sweep targets a small number of shared class hooks + four breakpoints rather than touching thousands of inline style props. The per-component findings (the actual overlaps the user saw) live in the other audit groups; this group's job was the infra + dead-code call, both of which are confirmed above. Files referenced (absolute): /home/parallels/snowraven/frontend/src/globals.css, /home/parallels/snowraven/frontend/src/index.css, /home/parallels/snowraven/frontend/src/App.css, /home/parallels/snowraven/frontend/src/main.tsx.

#### [HIGH/L] Only one 640px breakpoint covers the whole 320px-1440px+ range
`frontend/src/globals.css:767-803`
- **Problem:** The entire responsive layer is a single `@media (max-width: 640px)` block overriding ~10 class hooks (.sr-header, .sr-panel, .sr-card, .sr-two-col, .sr-compare-panels, .sr-map-container, .sr-media-grid, .sr-media-iframe, .sr-help-row/.sr-help-toc, the map sidebar overlay). There is no small-phone (~360px), tablet (~768px), or laptop (~1024px) tier, and no max-width container cap for large desktops.
- **On a phone:** Everything between the toggle classes and ~360px is untreated: .sr-two-col / .sr-compare-panels collapse only at <=640 (good), but any component using raw inline-style grids/flex/fixed widths gets zero help. At 360px the 640px rules already fired, yet padding (e.g. .sr-card 20px on each side = 40px lost) plus fixed-width inline content still overflows. No 480px tier means small phones (320-375) get the same treatment as a 600px-wide tablet portrait.
- **On desktop:** No upper bound: at >=1440px content (and any full-width inline-style container/.sr-two-col grid) stretches edge to edge with no max-width/centering, producing uncomfortably wide reading measures and awkward whitespace. Grids that are 2/3-up at 641px stay 2/3-up at 1920px with no denser tier.
- **Fix:** Introduce a small tier set consistent with the existing class-hook approach: keep 640 as the phone/tablet boundary, add ~480 (small-phone tightening), ~1024 (tablet/laptop two-col enablement), and a >=1440 container cap. Add a shared `.sr-container { max-width: ~1280-1400px; margin-inline: auto }` hook and apply it to the top-level panels rather than rewriting inline styles. Document the tiers as named CSS vars/comments so a sweep can target class hooks, not per-component inline styles.

#### [HIGH/M] Only 5 layout classes exist as responsive hooks; most layout is inline-style and unreachable by media queries
`frontend/src/globals.css:526-570`
- **Problem:** The only collapsible/responsive class hooks defined are .sr-two-col (1fr 1fr -> 1fr at 640), .sr-compare-panels (3-up -> 1 at 640), .sr-media-grid (repeat(3) -> 1 at 640), plus the map container/iframe heights. The comment at lines 532-534 explicitly notes inline grid styles 'can't be overridden by a media query' and that is why these few were lifted into CSS. Every other multi-column inline grid in the app (Stats cards, milestone chips, frivolous lists, etc.) has no equivalent hook, so it cannot collapse at any width.
- **On a phone:** Any component that lays out columns with `style={{display:'grid',gridTemplateColumns:'repeat(N,...)'}}` or a fixed-gap non-wrapping flex row keeps N columns at 360px, causing horizontal overflow / clipping. The 640 block can only fix the three grids that were deliberately migrated to classes.
- **Fix:** Establish a small reusable set of responsive grid utility classes (e.g. `.sr-grid-auto` using `grid-template-columns: repeat(auto-fill, minmax(<min>, 1fr))`, or named `.sr-grid-2`/`.sr-grid-3` that collapse at the new breakpoints) and have the inline-style components opt in by switching their grid definition from inline to className. This matches the existing lift-to-class pattern (lines 526-539) and avoids rewriting all inline styles.

#### [MED/S] .sr-media-iframe fixed 280px/360px height ignores aspect ratio on narrow screens
`frontend/src/globals.css:564-570, 775`
- **Problem:** .sr-media-iframe has a fixed `height: 280px` (desktop) and `height: 360px` under 640px, with `width: 100%`. The height is a constant, not aspect-ratio-derived.
- **On a phone:** At 320-375px a full-width embed (e.g. a 16:9 media player) is only ~320px wide but forced to 360px tall, so a video/audio embed is badly letterboxed or cropped relative to its natural aspect. The single 640 step does not scale height with width across 320/375/414.
- **On desktop:** In a single-column desktop card a 100%-wide iframe pinned to 280px can be over-tall for a wide column.
- **Fix:** Prefer `aspect-ratio: 16/9` (with a max-height clamp) over a fixed pixel height so the embed scales with the available width at every breakpoint, instead of two hard-coded heights.

#### [MED/S] No global horizontal-overflow guard on html/body to catch inline-style overflow
`frontend/src/globals.css:506-520`
- **Problem:** html/body set background and font only; there is no `overflow-x: hidden` safety net and no global `max-width: 100%` / `box-sizing` baseline beyond Tailwind's preflight. Given the app is almost entirely inline-styled with many fixed pixel widths, a single overflowing element produces a horizontally-scrollable page on phones.
- **On a phone:** Any one fixed-width inline element wider than the viewport (tables, wide flex rows, fixed minWidth cards) makes the WHOLE page scroll sideways at 320-414px, the classic mobile overflow symptom the user reported. There is no infrastructure-level guard, so each defect surfaces app-wide.
- **Fix:** Add a conservative safety net (e.g. `html, body { overflow-x: hidden }` or better, an `*{ min-width: 0 }` on flex/grid children via a utility) AS A BACKSTOP only — the real fixes belong in the offending components, but a guard prevents a single defect from breaking the whole page. Pair with the per-component table-scroll wrapper pattern the app already uses (width:'max-content' inside an overflow-x:auto container).

#### [LOW/S] Map container heights are fixed px (380/300/220) rather than viewport/dvh-aware
`frontend/src/globals.css:541-551, 773`
- **Problem:** .sr-map-container is `height: 380px` (300px under 640) and .sr-named-map is `height: 220px`. These are static and only have one breakpoint step.
- **On a phone:** 300px is usable on a phone, but there is no small-phone tier and no dvh-based sizing; on a very short landscape phone (e.g. 360x640 rotated, ~360px tall) a 300-380px inline map plus surrounding chrome can crowd the viewport. Acceptable but worth a tier-aware review.
- **On desktop:** On a >=1440px / tall desktop the inline (non-fullscreen) maps stay 380px, which is short for a large screen where a taller map would read better.
- **Fix:** Consider clamping with `min(380px, 45dvh)` style sizing per tier, or add a laptop/desktop step that grows the inline map height; keep the existing fullscreen 100dvh overlay path unchanged.

#### [LOW/S] Map sidebar overlay width min(282px, 90vw) — verify on 320px
`frontend/src/globals.css:782-790`
- **Problem:** Under 640px the map sidebar becomes an absolute overlay at `width: min(282px, 90vw)`. At 320px that is 282px (282 < 288=90vw), leaving only ~38px of map visible behind it.
- **On a phone:** On a 320px phone the open filters sidebar covers ~88% of the screen, which is fine functionally (it is a modal-style overlay with a backdrop at line 663-668), but the 282px floor means the content inside it must itself wrap to ~282px; any fixed-width control inside the sidebar (inline-styled, not in these files) would overflow it. Flagged for cross-check against MapExplorer's sidebar contents, not a defect in globals.css itself.
- **Fix:** Likely fine as-is; the floor could be `min(282px, 88vw)` for a sliver more map at 320px. Real risk is inline-styled controls inside the sidebar exceeding 282px — verify in MapExplorer.tsx.

#### [LOW/S] Floating map FAB cluster uses fixed bottom/right offsets and fixed 36px control sizes at all widths
`frontend/src/globals.css:611-652`
- **Problem:** .sr-map-fab-cluster is `position:absolute; bottom:20px; right:16px` with a 10px gap; it contains a 36px-circle fullscreen button and (mobile-only) a Filters pill with `padding: 0 16px; height: 36px`. No width-aware adjustment.
- **On a phone:** On a 320px phone the Filters pill ('Filters' label + icon + 32px of horizontal padding) plus the 36px circle plus 10px gap can approach the available map width near the bottom-right; combined with the loading chip (line 586-604, top-center) it is tight but generally clears. Low risk, but the absolute offsets do not shrink on small phones and can crowd MapLibre's own bottom-right attribution/controls.
- **Fix:** Acceptable; if crowding is observed, reduce the cluster offset/gap under ~400px and ensure it does not overlap MapLibre attribution (which sits bottom-right by default).

#### [LOW/S] index.css is dead Vite/Tauri starter boilerplate — not imported anywhere
`frontend/src/index.css:1-114`
- **Problem:** index.css is the Vite React-TS template starter stylesheet: a duplicate `@import "tailwindcss"`, an unrelated purple `--accent:#aa3bff` token set, `#root { width: 1126px }`, and `code/.counter` styles. Confirmed NOT imported by main.tsx, App.tsx, index.html, or anywhere in src (only main.tsx imports globals.css; SnowMap imports maplibre-gl.css).
- **On a phone:** None at runtime (file is dead), but it is a trap: it contains `#root { width: 1126px; max-width: 100% }` and a `@media (max-width: 1024px)` font tier that, if ever accidentally imported, would conflict with globals.css and impose a 1126px fixed root width. It also re-imports the entire Tailwind framework.
- **Fix:** Delete frontend/src/index.css as cleanup. It is unreferenced starter boilerplate and its stale tokens/breakpoints would actively conflict if reintroduced.

#### [LOW/S] App.css is dead Vite/Tauri starter boilerplate — not imported anywhere
`frontend/src/App.css:1-185`
- **Problem:** App.css is the Vite/Tauri starter demo stylesheet (.hero, #next-steps, #docs, .vite/.framework logo transforms, .counter, .ticks). None of these selectors exist in the SnowRaven app. Confirmed NOT imported anywhere (grep for 'App.css' returns no import; App.tsx import block does not reference it).
- **On a phone:** None at runtime (dead file). Pure clutter; references CSS variables (--accent, --border) defined only in the equally-dead index.css.
- **Fix:** Delete frontend/src/App.css as cleanup. It is unreferenced starter-template demo CSS with no live selectors.

#### [LOW/S] Token/theme/reduced-motion layer is sound and width-agnostic (no defect)
`frontend/src/globals.css:1-179, 758-765`
- **Problem:** The :root / [data-theme=dark] token palette, the rem-based font scaling (html font-size driven by --sr-text-scale), the prefers-reduced-motion block, and the focus-ring/skip-link rules are all width-independent and correct. No responsive defect here.
- **On a phone:** None. rem-based scaling actually helps small screens via the Text Size control. Noted only to scope the audit (these lines are clean).
- **Fix:** No change needed. Keep the rem/token approach; new breakpoints should layer on top of it.
