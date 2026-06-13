# Codebase research — checklists-tab (Understand workflow, 2026-06-10)

## species-detail-comment-search

Species Detail's comment search is implemented inline in frontend/src/components/SpeciesDetail.tsx (not a separate component): a "Comments" SectionCard with a controls row (keyword input + Newest/Oldest sort toggle + match count) above a list of comment rows, showing 10 initially (COMMENTS_PAGE = 10) with a "Show all N comments" expander. Filtering is a plain case-insensitive substring match on ObservationEntry.speciesComments, recomputed in a useMemo on every keystroke — no debounce. The data comes from the parsed eBird backup CSV ("Species Comments" / "Observation Details" column → ObservationEntry.speciesComments; "Checklist Comments" → optional checklistComments), with no cleaning applied at parse or display time — weather/tide blocks are only DETECTED (lib/commentBlocks.ts hasWeatherBlock/hasTideBlock), never stripped, and [name:] tags are parsed separately by lib/namedBirds.ts but left visible in comment text. The Multimedia tab's MediaCommentsSection (v0.5.18) is a deliberate copy of the same visual pattern but a fully separate implementation: a standalone reusable component (MediaCommentsSection.tsx) whose filter/sort logic is extracted into pure tested helpers (lib/mediaComments.ts) — that component plus its pure-lib split is the best template for the new Checklists tab's two search boxes.

**Files:**
- `/home/parallels/snowraven/frontend/src/components/SpeciesDetail.tsx` — Species Detail page; inline Comments section: state lines 47/66-68/79-90, allComments useMemo lines 370-381, JSX lines 1249-1367 (controls row, 10-row page, show-all expander, S-id-gated checklist links)
- `/home/parallels/snowraven/frontend/src/components/MediaCommentsSection.tsx` — Multimedia tab Media Comments card (v0.5.18) — standalone component mirroring the Species Detail box; best structural template for the new tab's search boxes (BirdName rows, filter resets showAll, null-when-empty)
- `/home/parallels/snowraven/frontend/src/lib/mediaComments.ts` — Pure tested filter/sort/pick helpers behind MediaCommentsSection — the logic-extraction pattern to copy for checklist/species comment search
- `/home/parallels/snowraven/frontend/src/lib/parseEbirdObservations.ts` — CSV parser: 'species comments'/'observation details' → speciesComments (line 73), 'checklist comments' → checklistComments (lines 82, 174-176); protocol/duration/allObsReported/breeding code/catalogIds for the planned filters; trim-only, no cleaning
- `/home/parallels/snowraven/frontend/src/types.ts` — ObservationEntry (lines 57-81, speciesComments + optional checklistComments) and ChecklistEntry (lines 83-102) shapes
- `/home/parallels/snowraven/frontend/src/lib/birdingStats.ts` — computeChecklists (lines 70-106) rolls ObservationEntry[] into ChecklistEntry[] per submissionId — the existing checklist-list builder; computeQuality (~493-510) shows hasWeatherBlock/hasTideBlock applied to checklistComments
- `/home/parallels/snowraven/frontend/src/lib/commentBlocks.ts` — Weather/tide block DETECTORS (hasWeatherBlock, hasTideBlock, hasSnowravenWeatherBlock, hasRaincrowWeatherBlock) — detection only; no stripper exists for the hide-blocks toggle
- `/home/parallels/snowraven/frontend/src/lib/commentText.ts` — decodeEntities / linkify / commentSegments / hasComment — injection-safe comment rendering pipeline
- `/home/parallels/snowraven/frontend/src/components/ChecklistComparer.tsx` — Module-private CommentText component (lines 26-48) rendering commentSegments with validated links and line breaks — extraction candidate for the new tab
- `/home/parallels/snowraven/frontend/src/components/speciesDetail/ui.tsx` — SectionCard, SectionHead, StatValueLink, SUBMISSION_ID_RE (/^S\d+$/) — generic primitives + the checklist-link shape gate
- `/home/parallels/snowraven/frontend/src/lib/observationsCache.ts` — Shared memoized off-thread parse of the eBird backup — load observations through loadEbirdObservations, never re-parse
- `/home/parallels/snowraven/frontend/src/lib/namedBirds.ts` — [name:] tag parsing (bounded NAME_TAG_RE, parseNameTags); tags stay visible in comment text
- `/home/parallels/snowraven/frontend/src/lib/checklistMeta.ts` — protocolName (P20/P21/P22… → display names), formatDuration/formatDistance/formatObservers — for the checklist list rows and protocol filter labels
- `/home/parallels/snowraven/frontend/src/lib/checklistBadges.ts` — deriveBadges: per-checklist weatherComment/tideComment/media/breeding flags — precedent for the composable has-X filter predicates
- `/home/parallels/snowraven/frontend/src/lib/mediaComments.test.ts` — Test pattern for the pure comment-search helpers

**Reusable:**
- MediaCommentsSection.tsx + lib/mediaComments.ts as the structural template: generalize into a shared CommentsSearchSection (props: title, rows of a generic {id, date, location?, text, link} shape, page size 10, filter+Newest/Oldest sort+count controls, show-all expander) — both existing instances are near-identical markup, so one shared component can back (a) the checklist-comments box and (b) the all-species comments box
- computeChecklists() in lib/birdingStats.ts — already builds the ChecklistEntry[] (with checklistComments, protocol, duration, distance, allObsReported, speciesCount) the expandable all-checklists list needs; pair with filterObservations() for spuh handling
- loadEbirdObservations() from lib/observationsCache.ts — shared cached/off-thread parse; do not re-parse the CSV
- hasWeatherBlock / hasTideBlock from lib/commentBlocks.ts — ready-made predicates for the 'has weather/tide block' filter and for locating blocks; a stripWeatherTideBlocks() pure function must be NEW (none exists), built from the same marker constants and the formatter output shapes in lib/weatherFormatter.ts / lib/tideFormatter.ts
- deriveBadges pattern (lib/checklistBadges.ts) — per-checklist boolean flags (media via catalogIds.length, breeding via breedingCode, weather/tide via detectors) as the model for composable filter chips
- CommentText in ChecklistComparer.tsx (lines 26-48) + lib/commentText.ts commentSegments — extract to a shared component for safe rendering (entity decode, validated http(s) links only, \r\n line breaks); prefer it over Species Detail's raw-text rendering
- SectionCard / SectionHead / SUBMISSION_ID_RE from components/speciesDetail/ui.tsx — card chrome and the S-id shape gate for ebird.org/checklist links (render plain text on regex failure, per the standing security check)
- BirdName component with taxonMap + backboneNames + onOpenSpecies (as MediaCommentsSection does) — required for the ALL-species comments box rows; batch-resolve taxon codes via /taxonomy/codes
- protocolName / formatDuration / formatDistance / formatObservers from lib/checklistMeta.ts — checklist row metadata and protocol filter labels
- formatDate from lib/formatDate.ts and the date-as-checklist-link row-header pattern (date links to https://ebird.org/checklist/{S-id} with ExternalLink icon, '·' separator, location in --sr-text-muted)
- parseNameTags from lib/namedBirds.ts if the tab ever needs [name:] awareness; tags are otherwise displayed verbatim
- Behavioral details to copy: page size 10, case-insensitive substring filter with no debounce (useMemo per keystroke is fine at this data size), filter input resets show-all (MediaCommentsSection variant — the better behavior), empty states distinguish 'no matches' vs 'none exist', sort via date.localeCompare with a stable tiebreak

**Details:**

## 1. Species Detail comments section — exact implementation

File: /home/parallels/snowraven/frontend/src/components/SpeciesDetail.tsx (single ~1422-line component; the comments section is NOT its own component).

State (lines 47, 66-68):
- `const COMMENTS_PAGE = 10` (line 47)
- `commentFilter` (string), `commentSort` ('newest' | 'oldest', default 'newest'), `showAllComments` (boolean, default false)
- All three are reset by `selectSpecies()` (lines 79-90) whenever a new species is chosen.

Derivation (lines 370-381, `allComments` useMemo):
```ts
const base = speciesObs.filter(o => o.speciesComments.trim() !== '')
const sorted = [...base].sort((a, b) => commentSort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
if (!commentFilter.trim()) return sorted
const q = commentFilter.toLowerCase()
return sorted.filter(o => o.speciesComments.toLowerCase().includes(q))
```
- Plain case-insensitive substring filter; NO debounce anywhere (useMemo recomputes per keystroke); sort by date string localeCompare (dates are YYYY-MM-DD).
- `speciesObs` is the selected species' ObservationEntry[] already filtered by county + date range (lines 277-289), so the comment search inherits the page's filters.

UI structure (lines 1249-1367):
- `<SectionCard>` + `<SectionHead icon={<MessageSquare size={14}/>} title="Comments" />` (primitives from components/speciesDetail/ui.tsx).
- Controls row: flex container with `padding: '12px 18px'`, `borderBottom: '1px solid var(--sr-border-subtle)'`, `background: 'var(--sr-surface-faint)'` containing:
  - Search input: relative-positioned div with absolutely-positioned lucide `<Search size={12}/>` icon at left 9px; `<input type="text" placeholder="Filter comments…">`, height 32, `border: '1.5px solid var(--sr-border)'`, borderRadius 6, focus/blur swap borderColor to `var(--sr-accent)` via onFocus/onBlur inline handlers.
  - Sort segmented toggle: two buttons Newest/Oldest inside `border: '1.5px solid var(--sr-accent-border)'`; active = `background: var(--sr-accent-bg)`, `color: var(--sr-accent)`; inactive = transparent bg, `var(--sr-text-muted)`.
  - Count badge: `{allComments.length} comment(s)` in `var(--sr-text-disabled)`.
- Empty state: "No comments match this filter." (when filter non-empty) vs "No species comments found."
- Rows: `(showAllComments ? allComments : allComments.slice(0, COMMENTS_PAGE)).map(...)`. Each row keyed `${o.submissionId}-${idx}`, padding '14px 18px', borderBottom `var(--sr-border-subtle)` except last.
  - Header line: if `SUBMISSION_ID_RE.test(o.submissionId)` (`/^S\d+$/` exported from components/speciesDetail/ui.tsx) the date renders as an `<a href="https://ebird.org/checklist/${o.submissionId}" target="_blank" rel="noreferrer">` showing `formatDate(o.date)` + `<ExternalLink size={10}/>` in `var(--sr-accent)`; otherwise the date is a plain span (the standing security check: never link an id that fails the shape regex). Then a `·` separator (`var(--sr-gray-300)`) and `o.location` in `var(--sr-text-muted)`.
  - Body: `{o.speciesComments}` rendered RAW as a React text child (auto-escaped; fontSize 0.84375rem, lineHeight 1.55, `var(--sr-text)`). NOTE: no decodeEntities, no linkify, no \r\n→<br> handling here — unlike the ChecklistComparer (see §4).
- Expander: shown only when `!showAllComments && allComments.length > COMMENTS_PAGE` — a full-width button "Show all {N} comments" with `<ChevronDown size={13}/>`, background `var(--sr-surface-faint)` hovering to `var(--sr-accent-bg)`, sets `showAllComments=true` (one-way; no collapse). Important nuance: typing in the filter does NOT reset showAllComments on Species Detail (MediaCommentsSection DOES reset it — see §5).
- Styling is all inline `style={{}}` objects (no CSS classes for this section), every color a `var(--sr-*)` token: --sr-border-subtle, --sr-surface-faint, --sr-text-disabled, --sr-border, --sr-text, --sr-surface, --sr-accent, --sr-accent-border, --sr-accent-bg, --sr-text-muted, --sr-gray-300, plus --sr-card-shadow via SectionCard.

## 2. Data shape and provenance

- Type: `ObservationEntry` in /home/parallels/snowraven/frontend/src/types.ts lines 57-81. Comment fields: `speciesComments: string` (always present, '' when blank) and optional `checklistComments?: string` (undefined when the CSV lacks the column, '' when blank). Also `ChecklistEntry` (lines 83-102) carries `checklistComments: string` plus protocol/duration/distance/allObsReported/speciesCount/individualCount — i.e. nearly everything the new Checklists tab's filter set needs.
- Parsing: /home/parallels/snowraven/frontend/src/lib/parseEbirdObservations.ts. Column mapping (header lowercased, exact match):
  - species comments: `h === 'species comments' || h === 'observation details'` (line 73) → `speciesComments` trimmed (line 121).
  - checklist comments: `h === 'checklist comments'` (line 82) → `optFields.checklistComments` trimmed (lines 174-176).
  - protocol / duration min / distance traveled (km) / area covered (ha) / number of observers / all obs reported ('1'→true, '0'→false, blank→null) / breeding code (first whitespace token) / ml catalog numbers (split, ML prefix stripped, digits-only kept → `catalogIds: string[]`) are all parsed in the same loop — these power the planned has-media / has-breeding-codes / protocol / complete-incomplete filters.
  - Custom char-level CSV parser handles quoted fields with embedded newlines (multi-line comments survive).
- Loading: `loadEbirdObservations()` from lib/observationsCache.ts — module-level memoized parse of the saved CSV (via the `storage` seam), parsed off-thread in a Web Worker (observationsWorker.ts) with sync fallback; invalidated when the file is saved/cleared. Any new tab should load through this cache, not re-parse.
- Checklist roll-up: `computeChecklists(filteredObs)` in /home/parallels/snowraven/frontend/src/lib/birdingStats.ts lines 70-106 groups ObservationEntry[] by submissionId into ChecklistEntry[] (first row supplies checklist-level fields incl. checklistComments; speciesCount/individualCount computed; sorted by date asc). This is THE existing function for the new tab's "list of all checklists".
- Cleaning: NONE at parse time beyond trim(). Weather/tide blocks are NOT stripped anywhere — /home/parallels/snowraven/frontend/src/lib/commentBlocks.ts provides only pure DETECTORS: `hasWeatherBlock(raw)` (≥2 of the labeled markers Temperature:/Wind:/Wind Direction:/Cloud Cover:/Dew point:/Humidity:/Sunrise:/Sunset:, or the 'Weather generated by' attribution), `hasTideBlock(raw)` ('Tide data from NOAA CO-OPS' credit, or 'Relative to MLLW' + one of Water level:/Station:/Tide:), plus `hasSnowravenWeatherBlock` / `hasRaincrowWeatherBlock` (attribution-based app discrimination). All run on decoded text via `decodeEntities` (lib/commentText.ts). A "hide weather+tide blocks inside displayed comments" toggle will need a NEW pure stripper — none exists; the marker/attribution constants in commentBlocks.ts and the emitters lib/weatherFormatter.ts / lib/tideFormatter.ts define the block vocabulary to cut against. These detectors are already used per-checklist in lib/checklistBadges.ts (`deriveBadges` → weatherComment/tideComment flags) and in birdingStats.ts computeQuality (lines ~493-510: counts checklists with comments, with weather blocks, with weather+tide).
- [name:] tags: handled only by /home/parallels/snowraven/frontend/src/lib/namedBirds.ts — `NAME_TAG_RE = /\[\s*name\s*:([^\]]{0,120})\]/gi` (bounded to avoid ReDoS), `parseNameTags(comment)` extracts distinct names. Tags are NOT removed from displayed comment text anywhere (Species Detail shows them verbatim).

## 3. Safe comment rendering (the better precedent than Species Detail's raw text)

/home/parallels/snowraven/frontend/src/lib/commentText.ts: `decodeEntities` (numeric + named entities, no innerHTML), `linkify` (only http(s) URLs become link segments, trailing punctuation excluded), `commentSegments(raw)` = decode + linkify, `hasComment(raw)`. /home/parallels/snowraven/frontend/src/components/ChecklistComparer.tsx lines 26-48 has a module-private `CommentText({ raw })` component rendering those segments: validated hrefs as `<a target=_blank rel=noopener noreferrer>` (with a belt-and-suspenders `/^https?:\/\//i` re-check), text split on \r\n|\r|\n into <br>-joined fragments. The Checklists tab should render checklist/species comments through this pipeline (extract CommentText to a shared file) rather than copying Species Detail's raw `{o.speciesComments}` — CSV comments can contain URLs and multi-line text.

## 4. Multimedia tab "Media Comments" comparison

Files: /home/parallels/snowraven/frontend/src/components/MediaCommentsSection.tsx (component, 181 lines) + /home/parallels/snowraven/frontend/src/lib/mediaComments.ts (pure helpers, tested in mediaComments.test.ts) + test MediaCommentsSection.test.tsx. Mounted from LifeList.tsx (~line 721, the Multimedia tab) with `rows={rawRows}, backboneNames, taxonMap, onOpenSpecies`.
- SAME visual pattern, SEPARATE implementation — the file comment says it explicitly: "mirroring the Species Detail comments box". It duplicates the controls-row/input/sort-toggle/count/rows/show-all markup (same inline styles, same tokens, MEDIA_COMMENTS_PAGE = 10) rather than sharing code with SpeciesDetail.tsx.
- Differences from Species Detail: (a) logic is extracted to pure functions — `filterAndSortMediaComments(rows, query, sort)` (substring across caption + mediaNotes, date sort with catalogId tiebreak) and `pickComment(row, query)` (priority mediaNotes > caption, prefers the field matching the query, labeled "Media note"/"Caption" via MEDIA_COMMENT_LABEL); (b) typing in the filter resets showAll (`onChange={e => { setFilter(e.target.value); setShowAll(false) }}`) — Species Detail doesn't; (c) returns null when no rows carry a media comment; (d) row header uses `<BirdName size="sm">` (multi-species list — exactly what the new ALL-species comment search needs) + format icon + date + location + an `ML{catalogId}` external link via `mlAssetUrl`; (e) it's a standalone card div with `id="media-comments"` and scrollMarginTop (deep-link target), not SectionCard. Data: MLExportRow caption/mediaNotes columns ('caption', 'media notes' in parseMLExport.ts); 'observation details' is deliberately excluded (duplicated across an observation's assets).

## 5. Shared primitives inventory

- components/speciesDetail/ui.tsx: `SectionCard`, `SectionHead`, `StatLabel`, `StatValueLink`, `SUBMISSION_ID_RE = /^S\d+$/`. Despite the directory name these are generic presentational primitives importable by any tab.
- lib/formatDate.ts `formatDate` for the date labels; lib/checklistMeta.ts `protocolName` (P20→Incidental, P21→Stationary, P22→Traveling, …), `formatDuration`, `formatDistance`, `formatObservers` for checklist metadata display; lib/checklistBadges.ts badge derivation pattern.
- Lucide icons used by both sections: MessageSquare (header), Search (input), ChevronDown (show-all), ExternalLink (links).

## tab-filters

Both tabs implement filtering as plain local `useState` in the tab's top-level component, rendered as inline-styled pill `<button>`s, a county `<select>`, two `type="date"` inputs, and shared `ToggleSwitch`es — there is NO shared pill/filter component (each tab defines its own `pillStyle`/`codePillStyle` helpers, near-identical copies). All filters compose with AND semantics via sequential `.filter()` passes in `useMemo`s; row-level filters (county + date range) re-filter the raw CSV rows and re-aggregate to species entries, while species-level filters (media presence, breeding codes/categories) filter the aggregated entries. Counts render as a right-aligned `aria-live="polite"` span — `"N species"` when clear, `"M of N species"` when filtered — plus an accent-colored "filter strip" banner with a Clear-filter button when county/date is active; a fully filtered-out table just renders an empty tbody (no per-table empty message). Nothing is persisted: no filter state goes through the storage seam, surviving tab switches only because App keeps tabs mounted with display:none. Most pieces (tri-state has/no pills, multi-select Set pills, county dropdown, date range, count label, filter strip, ToggleSwitch, the `requestedFilter` cross-tab seed) map directly onto the planned Checklists-tab filters, and `ChecklistEntry` + `computeChecklists` in birdingStats.ts already provide protocol/complete/comments fields per checklist.

**Files:**
- `/home/parallels/snowraven/frontend/src/components/LifeList.tsx` — Multimedia tab: all filter state + pills (tri-state photo/audio/video, Has media, Is Target), county dropdown w/ 3-pass resolution, date range, ToggleSwitches, AND composition via useMemos, count label + filter strip, requestedFilter consume-once pattern
- `/home/parallels/snowraven/frontend/src/components/LifeListTable.tsx` — Applies the tri-state MediaFilterState inside the table (lines 77-85); empty filter result = empty tbody, no message
- `/home/parallels/snowraven/frontend/src/components/BreedingCodeList.tsx` — Breeding Codes tab: Set<string> code pills + Set<BreedingCategory> category pills (codePillStyle/categoryPillStyle with tier tokens), identical county/date controls, re-aggregation on row filter, whole-tab empty state, filter strip
- `/home/parallels/snowraven/frontend/src/components/BreedingCodeTable.tsx` — Applies the code-Set filter with every() AND semantics (lines 29-31)
- `/home/parallels/snowraven/frontend/src/types.ts` — MediaFilterState/MediaDimensionState ('has'|'no'|null), MEDIA_FILTER_CLEAR, DateRangeState/DATE_RANGE_CLEAR, SortState, BreedingSortState, ObservationEntry (protocol, allObsReported, checklistComments, speciesComments, catalogIds, stateProvince), ChecklistEntry
- `/home/parallels/snowraven/frontend/src/components/ui/ToggleSwitch.tsx` — Shared role=switch pill toggle, the only extracted shared filter control
- `/home/parallels/snowraven/frontend/src/lib/breedingCodes.ts` — BREEDING_CODES canonical list with tiers, BREEDING_CODE_MAP, TIER_COLORS, CATEGORY_CODES (confirmed=tier>=3, probable=2, possible=1)
- `/home/parallels/snowraven/frontend/src/lib/parseBreedingCodes.ts` — deriveBreedingData + aggregateBreedingRows (re-derives entries and codesPresent from county/date-filtered rows)
- `/home/parallels/snowraven/frontend/src/components/MediaCommentsSection.tsx` — The last-10/expandable/searchable comments box on the Multimedia tab (page size 10, text filter, Newest/Oldest, Show all N, empty message) — direct model for the planned comment search boxes
- `/home/parallels/snowraven/frontend/src/lib/mediaComments.ts` — filterAndSortMediaComments / pickComment / hasMediaComment — pure comment filter+sort logic backing MediaCommentsSection
- `/home/parallels/snowraven/frontend/src/lib/checklistMeta.ts` — protocolName() (P20→Incidental etc.), formatDuration/formatDistance/formatObservers — checklist metadata display helpers
- `/home/parallels/snowraven/frontend/src/lib/birdingStats.ts` — computeChecklists(filteredObs): ObservationEntry[] → ChecklistEntry[] aggregation already carrying protocol/complete/comments/speciesCount per checklist
- `/home/parallels/snowraven/frontend/src/lib/commentBlocks.ts` — hasWeatherBlock/hasTideBlock decode-first detectors (markers, attribution phrases) — basis for the hide-weather/tide-blocks toggle; detection only, no stripper yet
- `/home/parallels/snowraven/frontend/src/lib/parseEbirdObservations.ts` — eBird CSV header indices for 'species comments'/'observation details', 'checklist comments', 'protocol' — source of all checklist-filter fields
- `/home/parallels/snowraven/frontend/src/lib/tabLayout.ts` — Tab id/label registry (life-list='Multimedia', breeding-codes='Breeding Codes') — where the new 'checklists' tab id would be added
- `/home/parallels/snowraven/frontend/src/App.tsx` — Tab panel mounting (mountedTabs keeps filter state alive across tab switches), mediaListFilter/requestedFilter cross-tab seeding (line 157, 932)

**Reusable:**
- ToggleSwitch (components/ui/ToggleSwitch.tsx) — the only shared filter control; use as-is for boolean toggles like 'Hide weather/tide blocks'
- pillStyle(active: 'none'|'positive'|'negative') idiom from LifeList.tsx:93 — copy (or extract) for boolean/tri-state checklist pills (has comments / has media / has breeding codes / complete-incomplete)
- MediaDimensionState 'has'|'no'|null tri-state + toggleDimension() pattern (LifeList.tsx:451) — maps directly to per-media-type and complete/incomplete tri-state filters
- Set<string> multi-select pill pattern with clone-add/delete toggle (BreedingCodeList.tsx:89,316-323) — for protocol or breeding-code multi-select
- Options-derived-from-data county <select> (sorted Set over rows, MapPin icon, accent styling when active) — identical in both tabs; reuse verbatim for county/state/protocol dropdowns
- DateRangeState + DATE_RANGE_CLEAR + two native type=date inputs + string-compare predicate (row.date < from / > to) — verbatim for year/date range
- filteredRows-then-reaggregate useMemo pattern (filter raw rows by county/date, then rebuild aggregates) — for checklist list the analogue is filter ObservationEntry rows then computeChecklists()
- countLabel pattern: aria-live span, 'N checklists' vs 'M of N checklists' driven by an isFilterClear flag
- Accent filter-strip banner with join(' · ') summary text + underlined 'Clear filter' button (both tabs, gated on hasLocationFilter)
- Phase union (loading-saved / setup-required / error / ready) + SetupRequired + EBIRD_BACKUP_STEPS + filesVersion-keyed autoLoad with cancelled flag — both tabs' loading skeleton, copy for the Checklists tab
- MediaCommentsSection.tsx + lib/mediaComments.ts — the exact last-10 / text-filter / Newest-Oldest / Show-all-N / 'No X match this filter.' comment-search box to model both planned search boxes on
- requestedFilter + onRequestedFilterConsumed one-shot cross-tab filter seeding (App.tsx:157 / LifeList.tsx:165-169)
- computeChecklists() + ChecklistEntry (lib/birdingStats.ts:70, types.ts:83) — ready-made per-checklist aggregation with protocol, allObsReported, checklistComments, speciesCount
- protocolName() in lib/checklistMeta.ts for protocol filter labels
- hasWeatherBlock()/hasTideBlock() in lib/commentBlocks.ts for the hide-weather/tide toggle (need a new strip function; only detectors exist)
- wideMode ghost button ('↔ Unbounded'/'↔ Normal') if the checklist table needs the same overflow escape hatch
- A–Z/Taxonomic segmented role=group two-button toggle (sort) — adapt for Newest/Oldest checklist sort

**Details:**

## Tab identity
- "Multimedia" tab = `LifeList` component (tab id `life-list`, label "Multimedia" in `lib/tabLayout.ts` TAB_LABELS). Mounted in App.tsx ~line 929.
- "Breeding Codes" tab = `BreedingCodeList` (tab id `breeding-codes`), App.tsx ~line 953.

## MULTIMEDIA TAB (LifeList.tsx) — every filter

State (all `useState`, local, no persistence):
- `filter: MediaFilterState` — `{ photo, audio, video }`, each `MediaDimensionState = 'has' | 'no' | null` (types.ts:17-23, `MEDIA_FILTER_CLEAR`). Tri-state per media dimension. Toggled by `toggleDimension(dim, val)` (LifeList.tsx:451): clicking the same pill again clears that dimension to null; clicking the opposite value replaces it (so "Has photo" and "No photo" are mutually exclusive per dimension). Six pills: "No photo/No audio/No video" (negative red styling) and "Has photo/Has audio/Has video" (positive accent styling), each with a lucide icon (Camera/Mic/Video size 11).
- `filterHasMedia: boolean` — "Has media" pill; keeps entries where `e.catalogIds.some(id => mediaMap[id] === 'Photo'|'Audio'|'Video')` (line 408-410).
- `filterIsTarget: boolean` — "Is Target" pill (custom target-circle SVG, dedicated `--sr-is-target-*` tokens); keeps entries missing at least one of photo/audio/video (`!photo || !audio || !video`, lines 412-419). Seedable from another tab: App.tsx holds `mediaListFilter` state set to `'is-target'`, passed as `requestedFilter` prop; a consume-once effect (LifeList.tsx:165-169) sets `filterIsTarget=true` then calls `onRequestedFilterConsumed()`.
- "All" pill: active styling when `isFilterClear` (`!filter.photo && !filter.audio && !filter.video && !filterHasMedia && !filterIsTarget`, line 421); onClick resets filter + hasMedia + isTarget (NOT county/date).
- `countyFilter: string | null` — single-select native `<select>` with MapPin icon overlay; options = `availableCounties` = sorted Set of `row.county` over rawRows (lines 251-257). Counties are resolved in 3 passes (`resolveMLCounties`): ML CSV column → cross-reference eBird backup location→county map → batched `/nominatim/counties` transport call; while resolving, the dropdown is replaced by a dashed "Resolving counties…" chip with spinner.
- `dateRange: DateRangeState` — `{ from, to }` as `''`-or-`YYYY-MM-DD` strings (types.ts:51-55, `DATE_RANGE_CLEAR`). Two native `type="date"` inputs joined by "→"; comparisons are plain string compares `row.date < dateRange.from` / `> dateRange.to` (works because YYYY-MM-DD).
- Toggles (shared `ToggleSwitch` from components/ui/ToggleSwitch.tsx — role="switch", aria-checked, label prop): "Show subspecies" (`!mergeSubspecies`), "Show sp./slash" (`showSpuh`, uses `isSpuhOrSlash`), "Show non-bird" (`showNonBird`, only rendered when eBird backbone present).
- Sort: A–Z / Taxonomic segmented two-button group (`role="group"` aria-label "Sort order", `aria-pressed`), `SortState { column, dir, nameSortMode }`.
- `wideMode` ghost button "↔ Unbounded"/"↔ Normal" (table overflow behavior).

Composition (strict AND, ordered passes):
1. `filteredRows` useMemo: county AND date-from AND date-to over raw ML rows (lines 259-267).
2. `displayEntries` useMemo: if eBird backbone, filter rawEbirdObs by the same county/date predicate, then `buildComprehensiveEntries(filtEbird, filtML, mergeSubspecies)`; else `aggregateMLRows(filteredRows)`; then drop spuh/non-bird per toggles (lines 276-304). Key pattern: row-level filters re-aggregate species entries from filtered rows rather than filtering the aggregate.
3. `mediaFilteredEntries` (hasMedia) → `isTargetFilteredEntries` (isTarget) → passed to `LifeListTable`, which applies the tri-state photo/audio/video filter itself in a useMemo (LifeListTable.tsx:77-85: six `if` early-returns, all-must-pass AND).

Counts/empty states:
- `countLabel` (line 437): `${displayEntries.length} species` when everything clear, else `${filteredCount} of ${totalSpecies} species`; rendered `<span aria-live="polite">` in right control cluster. `filteredCount` is recomputed in LifeList (duplicating the table's predicate) so the label matches the table.
- `hasLocationFilter` (county or either date bound) shows an accent filter strip (lines 686-705): `var(--sr-accent-bg)` rounded banner, `filterStripText` = `[county, formatted date range, "M of N species"].join(' · ')` with date labels via `formatDate` ("From May 1, 2022" / "Through …" / "a – b"), plus an underlined "Clear filter" button resetting countyFilter + dateRange only.
- When filters exclude everything, `LifeListTable` renders header + empty tbody — no "no matches" message; the 0-of-N count label is the only signal.
- Also on this tab: `MediaCommentsSection` (the last-10/expandable/searchable comments box — `MEDIA_COMMENTS_PAGE = 10`, text filter input + Newest/Oldest segmented sort + "{n} comments" count + "Show all N comments" expander + "No media comments match this filter." empty row; logic in lib/mediaComments.ts `filterAndSortMediaComments`/`pickComment`/`hasMediaComment`), and a "Jump to comments" discoverability banner (`smoothScrollIntoView` to `#media-comments`, gated on commentCount > 0).

## BREEDING CODES TAB (BreedingCodeList.tsx) — every filter

State:
- `filter: Set<string>` — multi-select of individual breeding codes. One pill per code in `codesPresent` (codes actually appearing in the data, in BREEDING_CODES canonical order — derived in parseBreedingCodes.ts: `BREEDING_CODES.filter(d => entries have that code)`); pill shows a 14px tier-colored dot (`TIER_COLORS[def.tier]`) + the code, `title={def.label}`, styled by `codePillStyle(tier, active)` using `rgba(var(--sr-tier-N-rgb), alpha)` tokens. Toggle = clone Set, add/delete (lines 316-323).
- `categoryFilter: Set<BreedingCategory>` — multi-select of Confirmed/Probable/Possible pills (`CATEGORY_META`), each only rendered if any of its codes is in `codesPresent` (line 286). `CATEGORY_CODES` (lib/breedingCodes.ts:92-96): confirmed = tier>=3 codes, probable = tier 2, possible = tier 1.
- "All" pill: active when both Sets empty; resets both.
- `countyFilter` + `dateRange`: IDENTICAL pattern to Multimedia (same `<select>` + MapPin, same two date inputs, same string-compare predicate over `phaseData.rows` (BreedingCodeRow[]), counties = sorted Set of `row.county`); the whole county/date cluster only renders when `counties.length > 0`. No Nominatim pass here — county comes straight from the eBird CSV.
- Sort A–Z/Taxonomic segmented group and `wideMode` ghost button: same as Multimedia (inlined styles rather than the `sortToggleBtn` helper).

Composition (AND everywhere):
1. `filteredRows` useMemo: county AND date over raw rows; `displayData` re-aggregates via `aggregateBreedingRows(filteredRows)` recomputing BOTH entries and `codesPresent` (so code pills shrink to match the filtered region/date window) (lines 152-170).
2. `categoryFilteredEntries`: for EACH selected category, entry must have ≥1 code from that category with count > 0 (`every`-style loop, lines 228-235) — AND across categories, OR within a category's code set.
3. `BreedingCodeTable` applies the code-Set filter: `entries.filter(e => [...filter].every(code => (e.codes[code] ?? 0) > 0))` (BreedingCodeTable.tsx:29-31) — AND across selected codes.

Counts/empty states:
- Same `countLabel` formula (`"N species"` / `"M of N species"`, totalSpecies = unfiltered `phaseData.entries.length`), same `aria-live` span, same accent filter-strip banner with `filterStripText` join(' · ') and "Clear filter" (clears county+date only).
- Whole-tab empty state when `entries.length === 0 && !hasLocationFilter`: centered "No species with breeding codes found in the stored file." (line 220-226). With a location filter active and zero rows, the table renders empty and the strip shows "0 of N species".
- Both tabs share the same Phase union (`loading-saved` spinner / `setup-required` → `SetupRequired` component with steps + Go to Settings / `error` red banner + Go to Settings button / `ready`).

## Persistence
NONE of the filter/sort/wideMode state on either tab goes through the storage seam or localStorage — all plain `useState`, default-cleared. (Verified: zero `getSetting`/`setSetting` hits in LifeList.tsx, BreedingCodeList.tsx, both tables, MediaCommentsSection.tsx.) Filter state survives tab switches only because App.tsx keeps visited tabs mounted (`mountedTabs` + display:none); it does NOT survive relaunch. The only seam-persisted UI state is the tab layout (`sr-tab-layout`). So a Checklists tab using local filter state would match house style; persisting filters would be a new pattern (and per CLAUDE.md must go through `storage.getSetting`/`setSetting`, never localStorage).

## Mapping onto Checklists-tab filters
- has media → Multimedia's `filterHasMedia` boolean pill; at checklist level use `ObservationEntry.catalogIds.length > 0` aggregated per submissionId (catalogIds already parsed from the eBird "ML Catalog Numbers" column in parseEbirdObservations.ts), or join to MLExportRow by catalogId for media TYPE (Photo/Audio/Video tri-state pills exactly like MediaFilterState — `mediaMap: Record<catalogId, format>` from parseMLExport gives format lookup).
- has breeding codes → `ObservationEntry.breedingCode !== null` any-row-per-checklist; the tier/category pill styling (`codePillStyle`, `CATEGORY_CODES`) reuses directly if you want per-code checklist filters.
- has checklist comments / has species comments → `ObservationEntry.checklistComments` (per-checklist, duplicated on rows) and `speciesComments` (per-row) are already parsed (parseEbirdObservations.ts:73,82; headers "checklist comments", "species comments"/"observation details"). Simple boolean pills like "Has media".
- protocol → `ObservationEntry.protocol` (raw eBird ID e.g. "P22"); display via `protocolName()` in lib/checklistMeta.ts (P20 Incidental, P21 Stationary, P22 Traveling, …). Options-derived-from-data pattern = the county dropdown (Set over rows, sorted) or multi-select Set pills like breeding codes.
- complete/incomplete → `ObservationEntry.allObsReported: boolean | null` ("1"/"0"/blank). Tri-state (complete/incomplete/unknown) maps onto the MediaDimensionState 'has'/'no'/null pill pattern.
- year/date → DateRangeState + the two date inputs + string-compare predicate, verbatim from either tab.
- county/state → the county `<select>` pattern verbatim; `stateProvince` is also on ObservationEntry for a state dropdown.
- The list itself: `ChecklistEntry` type (types.ts:83-105) and `computeChecklists(filteredObs)` (lib/birdingStats.ts:70) already aggregate observations into per-checklist records carrying submissionId, date, time, location, county, stateProvince, protocol, duration, distance, numObservers, allObsReported, checklistComments, speciesCount, individualCount.
- Hide weather/tide blocks in comments → detectors already exist: `hasWeatherBlock`/`hasTideBlock` in lib/commentBlocks.ts (decode-first, marker-based — "Temperature:/Wind:…" ≥2 markers, "Relative to MLLW", attribution phrases); no strip/remove function exists yet, only detection.

## Pattern notes for the orchestrator
- There is no shared filter-pill component. `pillStyle(active: 'none'|'positive'|'negative')` (LifeList.tsx:93-110) and `codePillStyle`/`categoryPillStyle` (BreedingCodeList.tsx:23-63) are per-tab inline-style helpers; pills are `<button tabIndex={0} aria-pressed={...}>`. Pill groups are separated by 1×20px `var(--sr-border)` divider divs (`pillSep`). A Checklists tab would either copy this idiom again or be the occasion to extract a shared component (ToggleSwitch was extracted exactly this way per its docblock: "Shared by the tabs that previously each defined an identical copy").
- Multi-select is modeled as `Set<string>` in state, cloned on toggle; tri-state as `'has'|'no'|null` per dimension; single-select as `string | null` via native `<select>`.
- All composition is AND; the only OR is within a breeding category's code set.
- Heights: pills 30px, county/date controls 26px, ghost buttons 28px; fonts 0.75rem; all colors via `var(--sr-*)` tokens (mandatory per CLAUDE.md).
- Cross-tab filter seeding: App-held one-shot `requestedFilter` prop + `onRequestedFilterConsumed` callback (App.tsx:157, LifeList.tsx:165-169) — reusable for e.g. "open Checklists filtered to this checklist's county".
- Data loading skeleton both tabs share: `storage.getFilesStatus()` → `loadEbirdObservations()` (shared parse cache) / `storage.readFile('ml')` + `parseMLExport`, keyed on `filesVersion` prop with a `cancelled` flag; taxon codes batched via `transport.post('/taxonomy/codes', …)` for BirdName favicons/taxonomic sort.

## checklist-data-model

All checklist-level data comes from the eBird backup CSV parsed once by parseEbirdObservations() into ObservationEntry[] (one row per species-observation), memoized app-wide by loadEbirdObservations() in lib/observationsCache.ts (parse runs off-thread via observationsWorker.ts); the ML export is parsed once by parseMLExport() and memoized by loadMLExport() in lib/mlExportCache.ts. The canonical Submission-ID grouping already exists: computeChecklists() in lib/birdingStats.ts folds observations into ChecklistEntry objects (types.ts) carrying date/time/location/protocol/duration/distance/area/numObservers/allObsReported/checklistComments plus rolled-up speciesCount and individualCount, and downstream pure functions (computeEffort, computeQuality, computeTemporal, computeFunStats) derive the complete-checklist bar, comment coverage, and busiest-day stats from it. The code already cleanly distinguishes checklist-level comments (ObservationEntry.checklistComments, from the "Checklist Comments" column, repeated per row and taken from the checklist's first row) from species-level comments (ObservationEntry.speciesComments, from "Species Comments"/"Observation Details"); computeQuality counts the two separately, and the API-driven Checklist Comparer mirrors the split (ChecklistMeta.comments vs ChecklistSpecies.comments). ML media joins to observations by catalog number: ObservationEntry.catalogIds (from "ML Catalog Numbers") looked up in MLExportResult.mediaMap (catalogId → 'Photo'|'Audio'|'Video') via observationMediaFormats() in lib/observationMedia.ts; ML rows also carry an "eBird Checklist ID" column (MLExportRow.checklistId). Weather/tide blocks inside comments are detected (not yet strippable — no stripper utility exists) by hasWeatherBlock/hasTideBlock/hasSnowravenWeatherBlock/hasRaincrowWeatherBlock in lib/commentBlocks.ts.

**Files:**
- `/home/parallels/snowraven/frontend/src/lib/observationsCache.ts` — Parse-once shared cache for the eBird backup: loadEbirdObservations() / clearEbirdObservationsCache(); off-thread parse via observationsWorker.ts
- `/home/parallels/snowraven/frontend/src/lib/parseEbirdObservations.ts` — The eBird backup CSV parser — all per-row column names (submission id, protocol, duration min, distance traveled (km), all obs reported, checklist comments, species comments/observation details, ml catalog numbers, etc.)
- `/home/parallels/snowraven/frontend/src/types.ts` — ObservationEntry (lines 57-81) and ChecklistEntry (83-102) — the row and checklist-shaped data models
- `/home/parallels/snowraven/frontend/src/lib/birdingStats.ts` — computeChecklists() — THE Submission-ID grouper into ChecklistEntry[]; plus computeEffort (complete-checklist bar), computeQuality (checklist-vs-species comment counts, weather/tide block counts), computeTemporal, computeGeo, computeFunStats (busiest day)
- `/home/parallels/snowraven/frontend/src/lib/mlExportCache.ts` — Parse-once shared cache for the ML export: loadMLExport() / clearMLExportCache()
- `/home/parallels/snowraven/frontend/src/lib/parseMLExport.ts` — ML export parser — MLExportRow incl. checklistId ('ebird checklist id'), caption/media notes/observation details, and mediaMap (catalogId → Photo/Audio/Video)
- `/home/parallels/snowraven/frontend/src/lib/observationMedia.ts` — observationMediaFormats(catalogIds, mediaMap) + matchesMediaFilter — the per-observation media join, ready-made for a has-media checklist filter
- `/home/parallels/snowraven/frontend/src/components/SpeciesDetail.tsx` — The model comment-search box: commentFilter/commentSort/showAllComments state (66-68), allComments memo (371-381), COMMENTS_PAGE=10 (47), render 1249-1367 with SUBMISSION_ID_RE-gated checklist links
- `/home/parallels/snowraven/frontend/src/components/MediaCommentsSection.tsx` — Already-extracted second instance of the same searchable last-10 comments pattern (Multimedia tab)
- `/home/parallels/snowraven/frontend/src/lib/mediaComments.ts` — Pure filter/sort/pick helpers behind MediaCommentsSection — template for extracting the new tab's comment-search logic
- `/home/parallels/snowraven/frontend/src/lib/commentBlocks.ts` — Weather/tide block DETECTORS (hasWeatherBlock/hasTideBlock/hasSnowravenWeatherBlock/hasRaincrowWeatherBlock) — markers exist but no stripper utility yet
- `/home/parallels/snowraven/frontend/src/lib/commentText.ts` — Safe comment rendering: decodeEntities, linkify, commentSegments, hasComment (injection-safe link/text segments)
- `/home/parallels/snowraven/frontend/src/lib/compareChecklists.ts` — Checklist Comparer model: ChecklistData/ChecklistMeta (checklist-level comments) vs ChecklistSpecies (per-species comments), MediaPresence; API-driven, not CSV
- `/home/parallels/snowraven/frontend/src/lib/tauri/checklistService.ts` — getChecklist() — eBird /product/checklist/view fetch behind transport.get('/checklists/{id}'); per-species mediaCounts {P,A,V} and obsAux breeding code
- `/home/parallels/snowraven/frontend/src/lib/checklistBadges.ts` — deriveBadges() — per-checklist photo/audio/video/breeding/weatherComment/tideComment flags (the composable-filter flag set, comparer-side)
- `/home/parallels/snowraven/frontend/src/lib/checklistMeta.ts` — protocolName (P20/P21/P22... → display names), formatDuration (hours-based — CSV duration is minutes), formatDistance, formatObservers
- `/home/parallels/snowraven/frontend/src/lib/checklistId.ts` — extractChecklistId / isValidChecklistId (/^S\d+$/)
- `/home/parallels/snowraven/frontend/src/components/speciesDetail/ui.tsx` — Exported SUBMISSION_ID_RE = /^S\d+$/ — the standing-security gate for ebird.org/checklist links
- `/home/parallels/snowraven/frontend/src/lib/namedBirds.ts` — computeNamedBirds / parseNameTags — another Submission-ID-aware grouper over speciesComments ([name:…] tags)
- `/home/parallels/snowraven/frontend/src/lib/speciesStats.ts` — Per-species pure derivations incl. computeMediaCounts(speciesObs, mediaMap) — catalog-id-deduped P/A/V counts
- `/home/parallels/snowraven/frontend/src/lib/tabLayout.ts` — ConfigurableTab union + DEFAULT_TAB_ORDER + TAB_LABELS — where the new Checklists tab gets registered
- `/home/parallels/snowraven/frontend/src/lib/mlCatalog.ts` — mlAssetUrl(catalogId) deep link + mlCatalogLink + extractUserId
- `/home/parallels/snowraven/frontend/src/lib/speciesUtils.ts` — normalizeSpeciesName / isSpuhOrSlash — species normalization used by every grouper
- `/home/parallels/snowraven/frontend/src/components/BirdingStats.tsx` — How a tab consumes the caches (lines 122-123) and computeChecklists (line 300); complete-checklist bar render (1113-1150); busiest-day link (1443+)

**Reusable:**
- loadEbirdObservations() (lib/observationsCache.ts) — the new tab's data source; one call gives all ObservationEntry rows with checklistComments, speciesComments, protocol, duration, distance, allObsReported, breedingCode, catalogIds already parsed and cached
- computeChecklists(obs) (lib/birdingStats.ts) — already produces the exact checklist-shaped objects the expandable checklist list needs (ChecklistEntry with checklistComments, protocol, allObsReported, speciesCount, individualCount); consider lifting it out of birdingStats.ts or importing directly
- loadMLExport().mediaMap + observationMediaFormats()/matchesMediaFilter() (lib/observationMedia.ts) — ready-made 'has media' predicate per observation; OR across a checklist's rows (or join MLExportRow.checklistId) for a checklist-level has-media filter
- The Species Detail comments box (SpeciesDetail.tsx lines 47, 66-68, 371-381, 1249-1367) and its already-extracted twin MediaCommentsSection.tsx + lib/mediaComments.ts — the exact last-10/expandable/searchable/Newest-Oldest pattern to copy for both new search boxes (page size 10, showAll state, case-insensitive substring filter)
- lib/commentBlocks.ts detectors (hasWeatherBlock, hasTideBlock, hasSnowravenWeatherBlock, hasRaincrowWeatherBlock) — the 'has weather/tide block' filter flags; their marker constants are the starting point for the NEW block-stripping function the hide-toggle needs (no stripper exists yet)
- lib/commentText.ts (decodeEntities, commentSegments, hasComment) — injection-safe comment rendering with validated links
- SUBMISSION_ID_RE (components/speciesDetail/ui.tsx) — mandatory gate before building any ebird.org/checklist/{id} href (standing security check)
- lib/checklistMeta.ts protocolName() — protocol-code → display-name map for the protocol filter dropdown (P20 Incidental, P21 Stationary, P22 Traveling, ...)
- computeQuality()'s checksWithComments / obsWithSpeciesComments and computeEffort()'s completeRatio logic (lib/birdingStats.ts) — existing per-checklist predicates for 'has checklist comments', 'has species comments', and complete/incomplete filters
- lib/tabLayout.ts ConfigurableTab/DEFAULT_TAB_ORDER/TAB_LABELS + the storage seam (storage.getSetting) — tab registration and persistence pattern for the new tab
- lib/formatDate.ts formatDate() and lib/checklistId.ts isValidChecklistId() — date display and ID validation
- BirdName component (components/BirdName.tsx) — required for any species names shown in the species-comments search results (per CLAUDE.md, with batched /taxonomy/codes resolution)

**Details:**

## 1. Parse-once shared caches

- /home/parallels/snowraven/frontend/src/lib/observationsCache.ts — `loadEbirdObservations(): Promise<{ text: string; observations: ObservationEntry[] } | null>` reads `storage.readFile('ebird')`, parses via a Web Worker (`lib/observationsWorker.ts`, falls back to sync `parseEbirdObservations`), memoizes by module-level `cache` with in-flight dedupe and a `generation` counter. Invalidated by `clearEbirdObservationsCache()` (called from Settings on file save/clear). Returns the raw CSV `text` too, explicitly so callers needing a second pass can reuse it. Current consumers: BreedingCodeList.tsx:119, LifeList.tsx:194,317, BirdingStats.tsx:122, SpeciesDetail.tsx:160, NamedBirds.tsx:54, MapExplorer.tsx:265.
- /home/parallels/snowraven/frontend/src/lib/mlExportCache.ts — `loadMLExport(): Promise<MLExportResult | null>` reads `storage.readFile('ml')`, parses with `parseMLExport`; unparseable/missing → null ("no media"). Invalidated by `clearMLExportCache()`.

## 2. eBird backup CSV parser — exact columns read

/home/parallels/snowraven/frontend/src/lib/parseEbirdObservations.ts — `parseEbirdObservations(content: string): ObservationEntry[]`. Character-level CSV parser (quoted fields with embedded newlines; BOM-stripped). Headers are `h.trim().toLowerCase()` then matched EXACTLY (so the verbatim CSV headers are these, case-insensitive):
- 'submission id' (required), 'common name' (required), 'date' (required)
- 'scientific name', 'location', 'location id', 'latitude', 'longitude', 'county', 'count'
- 'breeding code' — only the first whitespace token is kept (`rawCode.split(/\s+/)[0]`)
- 'species comments' OR 'observation details' (alias) → `speciesComments`
- 'ml catalog numbers' → `catalogIds: string[]` (split on `/[\s,]+/`, strip leading `ML` prefix, keep only `/^\d+$/`)
- Optional checklist-level (property omitted when column absent; blank → null): 'time' → `time`; 'duration min' OR 'duration (min)' → `duration` (MINUTES, int); 'distance traveled (km)' → `distance` (km, float); 'area covered (ha)' → `area`; 'protocol' → `protocol`; 'number of observers' → `numObservers`; 'all obs reported' → `allObsReported` ('1'→true, '0'→false, blank→null); 'checklist comments' → `checklistComments` (string, '' when blank); 'state/province code' OR 'state province code' OR 'state/province' → `stateProvince` (e.g. "US-MN").

`ObservationEntry` is defined at /home/parallels/snowraven/frontend/src/types.ts lines 57–81; `ChecklistEntry` at lines 83–102 (submissionId, date, location, locationId, latitude, longitude, county, stateProvince, time, duration, distance, area, protocol, numObservers, allObsReported, checklistComments, speciesCount, individualCount).

Other CSV readers (smaller column sets): lib/parseEbird.ts (life-list view: 'common name', 'taxonomic order'); lib/parseBreedingCodes.ts ('common name', 'scientific name', 'breeding code', 'date', 'county'); lib/parseLifeList.ts (ML-side: 'common name', 'scientific name', 'taxonomic order', 'ml catalog numbers').

## 3. Submission-ID grouping utilities

- /home/parallels/snowraven/frontend/src/lib/birdingStats.ts:
  - `computeChecklists(filteredObs: ObservationEntry[]): ChecklistEntry[]` (line 70) — THE canonical grouper. One pass building `firstRowBySub` (checklist-level fields taken from the checklist's first row, incl. `checklistComments`), `speciesBySub` (distinct normalized species per submission → `speciesCount`), `countBySub` (Σ numeric counts → `individualCount`; X/blank contribute 0). Sorted ascending by date. Mounted in components/BirdingStats.tsx:300 (`useMemo(() => computeChecklists(filteredObs))`, after `filterObservations(rawObs, includeSpuh)`).
  - `computeTotals(checklists, lifeList)` (142) — locations/years/states/countries sets, date span.
  - `computeTemporal(checklists, filteredObs)` (211) — yearRows (with `bestDayByYear` per-year best checklist by speciesCount, keeps submissionId), monthRows, dowRows, hourRows (`parseHour(c.time)` parses "H:MM AM/PM").
  - `computeGeo(checklists, filteredObs)` (278) — top locations/counties/states by checklist + species counts.
  - `computeEffort(checklists)` (340) — protocolRows (count/pct/avgDurationMin/avgDistanceMi), observerRows, totals/averages for duration/distance/area, sppPerHour/sppPerMi, **completeRatio/completeCount/allObsCount + protocolComplete** (drives the "Complete checklists" stacked bar in components/BirdingStats.tsx:1113–1150), record outings (longest, farthest, largestArea, biggest=most species, mostIndividuals, largestGroup).
  - `computeQuality(filteredObs, checklists)` (466) — numeric-vs-X count ratio; biggest single counts; **`checksWithComments` = checklists with non-blank `checklistComments` vs `obsWithSpeciesComments` = observations with non-blank `speciesComments`** (the explicit checklist-vs-species comment split); and weather/tide block counts per checklist comment via `hasSnowravenWeatherBlock` / `hasRaincrowWeatherBlock` / `hasTideBlock`.
  - `computeFunStats(filteredObs, checklists, rawObs)` (609) — single-checklist & one-and-done birds (per-species submission sets), streak/dry-spell, **busiestDay** (date with most distinct species; `busiestDaySubId` = that date's checklist with max speciesCount; rendered in BirdingStats.tsx:1443 with `SUBMISSION_ID_RE.test(...)` gating the `https://ebird.org/checklist/{id}` link), Shannon diversity.
  - `computeTopSpecies(filteredObs)` (116) — per-species distinct-submission sets.
- /home/parallels/snowraven/frontend/src/lib/namedBirds.ts — `computeNamedBirds(observations)` groups `[name:…]`-tagged observations into per-individual `NamedBird` records; `parseNameTags(comment)` (ReDoS-bounded regex `NAME_TAG_RE`); dedupes sightings per submissionId (`seenSubs`). Sightings carry `{date, submissionId, comment (= speciesComments), location, latitude, longitude}`.
- /home/parallels/snowraven/frontend/src/lib/speciesStats.ts — per-species derivations for Species Detail: `computeSightingsStats`, `computeMediaCounts(speciesObs, mediaMap: Map<string,string>)` (P/A/V deduped by catalog id), `computeRecentMediaIds`; local `SUBMISSION_ID_RE = /^S\d+$/`.
- Checklist Comparer is API-driven, NOT CSV-grouped: /home/parallels/snowraven/frontend/src/lib/compareChecklists.ts — `compareChecklists(a, b: ChecklistData): ChecklistComparison`; types `ChecklistSpecies` (speciesCode, commonName, count='howManyStr', breedingCode, comments, media:{photo,audio,video}), `ChecklistMeta` (locName, obsDt, protocolId, durationHrs (HOURS, unlike CSV minutes), distanceKm, distanceUnit, numObservers, submissionMethod, submissionVersion, **comments = checklist-level note**); helpers `formatObsDate`, `parseCount`, `higherCount`. Data fetched in components/ChecklistComparer.tsx:235 via `transport.get<ChecklistData>('/checklists/${id}')`; desktop implementation /home/parallels/snowraven/frontend/src/lib/tauri/checklistService.ts `getChecklist(checklistId)` (eBird `/product/checklist/view/{id}`; per-species media from the API's `mediaCounts {P,A,V}`, breeding code from `obsAux` fieldName==='breeding_code'). Comments on this path are HTML-entity encoded.
- /home/parallels/snowraven/frontend/src/lib/checklistBadges.ts — `deriveBadges(comp, side): BadgeFlags` {photo, audio, video, breeding, weatherComment, tideComment} (ORs media/breeding across a side's species; weather/tide from the comment detectors). Rendered by components/ChecklistBadges.tsx.

## 4. ML export join

/home/parallels/snowraven/frontend/src/lib/parseMLExport.ts — `parseMLExport(text): MLExportResult { entries: LifeListEntry[], mediaMap: Record<string,string>, rows: MLExportRow[] }`. Columns matched lowercase: 'catalog number' OR 'ml catalog number' (required; leading 'ML' stripped, digits-only), 'common name' (required), 'format' (required; 'Photo'|'Audio'|'Video' only), 'scientific name', 'date', 'location' OR 'locality', 'county', 'latitude', 'longitude', 'caption', 'media notes', 'observation details' (the eBird observation comment duplicated onto each media row), 'age/sex', 'behaviors', 'time', 'year', 'month', 'average community rating', 'number of ratings', **'ebird checklist id' → `MLExportRow.checklistId`** (e.g. "S123456789", '' when absent).
- Join catalog → media type: `mediaMap[catalogId] = format`; consumed against `ObservationEntry.catalogIds` by /home/parallels/snowraven/frontend/src/lib/observationMedia.ts — `observationMediaFormats(catalogIds, mediaMap): Set<MediaFormat>` and `matchesMediaFilter(formats, filter: 'any'|'photo'|'audio'|'video'|'none')` (Map Explorer's per-sighting media filter — exactly the "has media" predicate a Checklists filter needs, per observation; OR across a checklist's observations for checklist-level).
- Join checklist id → media: lib/mediaStats.ts uses `r.checklistId` gated by `SUBMISSION_ID_RE` for its busiest-day checklist link (lines ~357–370); MediaStatsSections.tsx:132 builds the ebird.org link with encodeURIComponent.
- Asset links: lib/mlCatalog.ts — `mlAssetUrl(catalogId)` (macaulaylibrary.org/asset/{id}), `mlCatalogLink(mediaType, taxonCode, userId)`, `extractUserId(filename)`.

## 5. Checklist-level vs species-level comments — existing distinction

Yes, distinguished in three places: (a) ObservationEntry has separate `speciesComments` (per-row) and `checklistComments?` (checklist-level, repeated on every row of a checklist; computeChecklists collapses to the first row's value); (b) `computeQuality` reports `checksWithComments` (checklist comments, counted over ChecklistEntry[]) separately from `obsWithSpeciesComments` (species comments, counted over observations); (c) the Comparer's ChecklistMeta.comments vs ChecklistSpecies.comments. The Multimedia tab additionally distinguishes per-ASSET comments (caption/mediaNotes) from the observation comment (lib/mediaComments.ts deliberately excludes `observationDetails` because the export duplicates it across an observation's media).

## 6. Comment-search UI pattern (the model for the two new search boxes)

- Species Detail comments box: components/SpeciesDetail.tsx — state `commentFilter` / `commentSort: 'newest'|'oldest'` / `showAllComments` (lines 66–68, reset on species change 81–83); `allComments` memo (lines 371–381): filter `o.speciesComments.trim() !== ''`, sort by `date.localeCompare`, then case-insensitive substring `o.speciesComments.toLowerCase().includes(q)`; `const COMMENTS_PAGE = 10` (line 47); render block lines 1249–1367: search input with Search icon, Newest/Oldest segmented toggle, "{n} comments" counter, rows show formatDate(o.date) as an ebird.org/checklist/{submissionId} link only when `SUBMISSION_ID_RE.test(o.submissionId)` (else plain text), `slice(0, COMMENTS_PAGE)` + "Show all {n} comments" ChevronDown button.
- The same pattern already extracted once: components/MediaCommentsSection.tsx (`MEDIA_COMMENTS_PAGE = 10`, `showAll`, filter+sort) with pure logic in lib/mediaComments.ts (`hasMediaComment`, `pickComment(row, query)`, `filterAndSortMediaComments(rows, query, sort)` — tie-broken by catalogId for stable order).

## 7. Weather/tide block handling (for the hide-blocks toggle)

- lib/commentBlocks.ts — decode-first DETECTORS only: `hasWeatherBlock` (≥2 of WEATHER_MARKERS ['Temperature:','Wind:','Wind Direction:','Cloud Cover:','Dew point:','Humidity:','Sunrise:','Sunset:'] OR the 'Weather generated by' attribution), `hasTideBlock` ('Tide data from NOAA CO-OPS' alone, or 'Relative to MLLW' + one of 'Water level:'/'Station:'/'Tide:'), `hasSnowravenWeatherBlock` ('generated by snowraven' after tag-strip), `hasRaincrowWeatherBlock` ('raincrow.app'). **No block-STRIPPING utility exists anywhere** (grep for strip/remove found none) — hiding weather+tide blocks inside displayed comments will need a new pure function; the marker constants here are the building blocks. The block format source-of-truth is lib/weatherFormatter.ts / lib/tideFormatter.ts.
- lib/commentText.ts — safe comment rendering: `decodeEntities` (no innerHTML), `linkify`, `commentSegments(raw): CommentSegment[]` (plain text + validated http(s) links), `hasComment(raw)`. Used by ChecklistComparer.tsx's CommentText (line 27). Note: CSV-sourced comments are rendered raw on Species Detail (`{o.speciesComments}` as a React child); API-sourced comments need decodeEntities.

## 8. Misc supporting pieces

- lib/checklistId.ts — `extractChecklistId(raw)` (URL or bare ID → S-id), `isValidChecklistId(id)` (/^S\d+$/).
- components/speciesDetail/ui.tsx:50 — exported `SUBMISSION_ID_RE = /^S\d+$/` (the standing-security gate for checklist hrefs; also used by NamedBirdRow.tsx, BirdingStats.tsx).
- lib/checklistMeta.ts — `protocolName(protocolId)` with PROTOCOL_NAMES {P20 Incidental, P21 Stationary, P22 Traveling, P23 Area, P33 Banding, P34 Nocturnal Flight Call Count, P52 Oiled Birds, P54 Heron Area Count, P60/P62 Pelagic}; `formatDuration(hrs)` (CAUTION: takes HOURS — CSV `duration` is minutes, divide by 60), `formatDistance(km, unit)`, `formatObservers(n)`, `submissionLabel(code, version)`.
- lib/formatDate.ts `formatDate(date, { withTime? })` — canonical user-preference date formatter.
- Tab registration for the new tab: lib/tabLayout.ts — `ConfigurableTab` union, `DEFAULT_TAB_ORDER`, `TAB_LABELS` (current tabs: weather, species-detail, birding-stats, map-explorer, life-list ("Multimedia"), breeding-codes, named-birds, comparer).
- lib/speciesUtils.ts — `normalizeSpeciesName` (subspecies folding), `isSpuhOrSlash` (used by `filterObservations(rawObs, includeSpuh)` in birdingStats.ts).

## weather-tide-and-comment-rendering

Weather/tide-block detection lives entirely in frontend/src/lib/commentBlocks.ts (boolean detectors hasWeatherBlock / hasTideBlock / hasSnowravenWeatherBlock / hasRaincrowWeatherBlock) — marker-substring matching on entity-decoded text, no regex on the markers themselves, and there is currently NO strip/remove function anywhere (detectors return booleans only; the new "hide weather+tide blocks" toggle will need a new strip function, ideally in commentBlocks.ts next to the markers it must share). The Statistics → Data Quality stat is computed in computeQuality() in frontend/src/lib/birdingStats.ts (lines ~496-540) and rendered as BarRows in BirdingStats.tsx (~lines 1416-1433). Comment rendering follows three established patterns: Species Detail's searchable comment box (filter input + Newest/Oldest sort + first-10 with "Show all" button, raw text as React children), Named Birds' quoted comment block (var(--sr-quote-bg) background with a 3px var(--sr-accent-border) left border), and Checklist Comparer's CommentText component (commentSegments from lib/commentText.ts: entity decode + validated http(s) linkify + \r\n→<br>, all injection-safe JSX). MediaCommentsSection.tsx + lib/mediaComments.ts is the cleanest extracted model of the "last 10, expandable, searchable" box the new tab needs (pure filterAndSortMediaComments + a self-contained section component).

**Files:**
- `/home/parallels/snowraven/frontend/src/lib/commentBlocks.ts` — THE detection module: hasWeatherBlock/hasTideBlock/hasSnowravenWeatherBlock/hasRaincrowWeatherBlock, verbatim WEATHER_MARKERS/tide marker constants; natural home for a new stripWeatherTideBlocks()
- `/home/parallels/snowraven/frontend/src/lib/commentBlocks.test.ts` — Detector tests built from real formatter output + entityEncode round-trip helper — the pattern a strip function's tests should copy
- `/home/parallels/snowraven/frontend/src/lib/commentText.ts` — decodeEntities, linkify (URL_RE), commentSegments, hasComment — the safe comment-rendering pipeline
- `/home/parallels/snowraven/frontend/src/lib/weatherFormatter.ts` — formatWeatherBody/formatWeather emit shape + exported ATTRIBUTION constant (line 33) — the exact text a strip function must remove
- `/home/parallels/snowraven/frontend/src/lib/tideFormatter.ts` — formatTideBody/formatTide/buildCombined, NOAA_CREDIT, TIDE_ATTRIBUTION, COMBINED_ATTRIBUTION, SR_LINK — tide/combined block shapes
- `/home/parallels/snowraven/frontend/src/lib/birdingStats.ts` — computeQuality (line 466; weather/tide loop ~496-516) computes the Data Quality stat; computeChecklists (line 70) builds ChecklistEntry records the new tab's list needs
- `/home/parallels/snowraven/frontend/src/components/BirdingStats.tsx` — Data Quality section render, weather/tide BarRow card at lines 1416-1433
- `/home/parallels/snowraven/frontend/src/lib/checklistBadges.ts` — deriveBadges: BadgeFlags incl. weatherComment/tideComment from the detectors — reusable flag shape for the new tab's filters
- `/home/parallels/snowraven/frontend/src/components/ChecklistBadges.tsx` — Six fixed-order present/absent badge pills (photo/audio/video/breeding/weather/tide) — candidate filter-chip/indicator UI
- `/home/parallels/snowraven/frontend/src/components/SpeciesDetail.tsx` — The model comment search box: COMMENTS_PAGE=10, commentFilter/commentSort/showAllComments state (47, 66-68, 370-381), render at 1249-1367
- `/home/parallels/snowraven/frontend/src/components/MediaCommentsSection.tsx` — Self-contained searchable comments section mirroring Species Detail — best component template for the new tab's two search boxes
- `/home/parallels/snowraven/frontend/src/lib/mediaComments.ts` — Pure extracted filterAndSortMediaComments/pickComment — the lib-side pattern to replicate for checklist/species comment search
- `/home/parallels/snowraven/frontend/src/components/NamedBirdRow.tsx` — Quoted comment block styling (lines 107-117: --sr-quote-bg/--sr-quote-border + 3px accent left border) and accordion row chrome
- `/home/parallels/snowraven/frontend/src/lib/namedBirds.ts` — [name:] tag parsing: NAME_TAG_RE (ReDoS-bounded), parseNameTags, computeNamedBirds, sortNamedBirds
- `/home/parallels/snowraven/frontend/src/components/ChecklistComparer.tsx` — CommentText (lines 26-48, safe decode+linkify render), SideCell comment toggle, CommentLine, ChecklistTag Notes disclosure (427-490)
- `/home/parallels/snowraven/frontend/src/components/speciesDetail/ui.tsx` — SectionCard/SectionHead chrome + SUBMISSION_ID_RE (/^S\d+$/) checklist-link gate
- `/home/parallels/snowraven/frontend/src/globals.css` — --sr-quote-bg/--sr-quote-border tokens: light lines 39-40, dark lines 140-141
- `/home/parallels/snowraven/frontend/src/types.ts` — ObservationEntry.speciesComments/.checklistComments (69, 79) and ChecklistEntry (~85-103) with protocol/allObsReported/checklistComments
- `/home/parallels/snowraven/frontend/src/lib/parseEbirdObservations.ts` — CSV column mapping: 'species comments'|'observation details' (line 73), 'checklist comments' (line 82)
- `/home/parallels/snowraven/frontend/src/lib/mapExplorerFormat.ts` — escHtml (line 45) — map-popup-only HTML escaping; comment rendering stays JSX-escaped instead

**Reusable:**
- lib/commentBlocks.ts detectors (hasWeatherBlock/hasTideBlock/hasSnowravenWeatherBlock/hasRaincrowWeatherBlock) — directly usable for the 'has weather/tide' checklist filters; add the new stripWeatherTideBlocks() here so it shares the same marker constants and formatter-fixture tests
- MediaCommentsSection.tsx + lib/mediaComments.ts filterAndSortMediaComments — the exact 'last 10, expandable, searchable' box pattern (PAGE=10, filter input, Newest/Oldest toggle, Show-all button) with logic already extracted pure; clone for checklist-comments and species-comments search boxes
- Species Detail Comments section (SpeciesDetail.tsx 1249-1367) — the original UI convention the new boxes must match: controls strip on --sr-surface-faint, Search-icon input, segmented sort toggle, count label, row header 'date-link · location', Show all N button
- ChecklistComparer CommentText component (commentSegments → escaped JSX + validated links + \r\n line breaks) — lift to a shared module for rendering comment text in the new tab (currently file-local)
- NamedBirdRow quote-block style: background var(--sr-quote-bg), 1px var(--sr-quote-border), 3px solid var(--sr-accent-border) left border, radius 7, padding 8px 11px — the established 'quoted comment' look for displayed comments
- NamedBirdRow/NamedBirdsTable accordion pattern (chevron button, aria-expanded, --sr-surface-faint expanded body, singleOpen prop) — for the expandable all-checklists list
- lib/checklistBadges.ts deriveBadges + ChecklistBadges.tsx pills — flag shape and present/absent pill UI for has-media/has-breeding/has-weather/has-tide filters and per-checklist indicators
- computeChecklists (lib/birdingStats.ts:70) — per-submissionId ChecklistEntry aggregation (checklistComments, protocol, allObsReported, duration, distance, speciesCount, individualCount) feeding the filterable list; protocol/complete-incomplete filters read ChecklistEntry.protocol / .allObsReported
- SUBMISSION_ID_RE (/^S\d+$/) from components/speciesDetail/ui.tsx + the date-as-checklist-link row-header pattern — required gate for every ebird.org/checklist link in the new tab
- SectionCard/SectionHead from components/speciesDetail/ui.tsx — section chrome matching Species Detail and Media Comments
- parseNameTags / NAME_TAG_RE (lib/namedBirds.ts) — if the species-comments box wants to badge [name:] tags; also the model for writing ReDoS-safe bounded regexes over comments
- hasComment / decodeEntities / commentSegments (lib/commentText.ts) — presence checks and safe text pipeline; search should match on the same text the user sees
- BarRow (components/statsPrimitives.tsx) — if the new tab shows any coverage/count bars

**Details:**

## 1. Weather/tide block DETECTION — frontend/src/lib/commentBlocks.ts

All detection is case-insensitive substring matching on DECODED text (`decodeEntities(rawComment).toLowerCase()` — eBird API returns comments HTML-entity-encoded; CSV comments pass through unchanged). No regexes for the markers. Verbatim patterns:

- `WEATHER_MARKERS` (need >= 2 to count as a weather block, threshold avoids prose false positives like "Wind: gusty"):
  `'Temperature:', 'Wind:', 'Wind Direction:', 'Cloud Cover:', 'Dew point:', 'Humidity:', 'Sunrise:', 'Sunset:'`
- `WEATHER_ATTRIB_TOKENS = ['Weather generated by']` (1 hit alone is enough — catches a block trimmed to emoji + condition + attribution). Deliberately NOT the bare "SnowRaven" token, because a standalone tide block's attribution also contains it.
- Tide constants: `TIDE_RELATIVE = 'Relative to MLLW'` (strongest discriminator), `TIDE_WATER_LEVEL = 'Water level:'`, `TIDE_STATION = 'Station:'`, `TIDE_TREND = 'Tide:'`, `TIDE_NOAA_CREDIT = 'Tide data from NOAA CO-OPS'`.

Functions (exact signatures):
- `hasWeatherBlock(rawComment: string): boolean` — true if `countMarkers >= 2` of WEATHER_MARKERS, OR the attribution token present.
- `hasTideBlock(rawComment: string): boolean` — true if NOAA credit present; else requires `'Relative to MLLW'` AND one of Water level:/Station:/Tide:.
- `hasSnowravenWeatherBlock(rawComment)` — hasWeatherBlock AND, after `normalizeForApp` (decode → strip tags via `/<[^>]*>/g` → collapse whitespace → lowercase), contains `SR_WEATHER_ATTRIB = 'generated by snowraven'` (matches both standalone "Weather generated by …SnowRaven" and combined "Weather and tide generated by …SnowRaven").
- `hasRaincrowWeatherBlock(rawComment)` — hasWeatherBlock AND decoded-lowercased text contains `RAINCROW_ATTRIB = 'raincrow.app'` (matched WITHOUT tag-stripping because the domain lives in the href).

The detectors are coupled to the real formatter output, and the tests (commentBlocks.test.ts) build fixtures from the formatters themselves — a strip function should do the same. The block text a strip function must remove (verbatim emit shapes):
- Weather block (lib/weatherFormatter.ts `formatWeatherBody`/`formatWeather`): lines joined with `\n`: emoji, condition, `Temperature: …°F`, `Wind: …`, `Wind Direction: …`, `Cloud Cover: …%`, `Humidity: …%`, `Dew point: …°F`, `Sunrise: …`, `Sunset: …`, then `ATTRIBUTION = 'Weather generated by <a href="https://github.com/dtgibson/snowraven">SnowRaven</a>'` (exported const, line 33).
- Tide block (lib/tideFormatter.ts `formatTideBody`/`formatTide`): `🌊`, `Observed|Predicted`, `Water level: X ft` (or range `X – Y ft`), `Tide: Rising|Falling` (optionally `(turned during your checklist)`), optional `Previous high|low: X ft at TIME`, optional `Next high|low: …`, `Station: NAME (ID), N.N mi away`, `Relative to MLLW`, then either bare `NOAA_CREDIT = 'Tide data from NOAA CO-OPS'` or `TIDE_ATTRIBUTION = 'Tide data from NOAA CO-OPS · via <a href="https://github.com/dtgibson/snowraven">SnowRaven</a>'`.
- Combined block (`buildCombined` in tideFormatter.ts, line ~64): `weatherFormatted-minus-ATTRIBUTION + '\n\n' + tideBody + '\n\n' + COMBINED_ATTRIBUTION` where `COMBINED_ATTRIBUTION = 'Weather and tide generated by <a href="https://github.com/dtgibson/snowraven">SnowRaven</a>'`. `SR_LINK = '<a href="https://github.com/dtgibson/snowraven">SnowRaven</a>'`.
- Note: in eBird round-trips the `<a>` may survive as a literal tag, entity-encoded `&lt;a&gt;…`, or bare link text — the tests cover all three; a strip function must too. Raincrow blocks mirror the SnowRaven body but attribute `Weather generated by <a href="https://raincrow.app">Raincrow</a>`.

NO existing strip function: grep for strip/remove confirms the detectors are presence-only. The "hide weather and tide blocks" toggle needs a new pure function (suggest `stripWeatherTideBlocks(raw): string` in commentBlocks.ts, tested against formatter-built fixtures like commentBlocks.test.ts does, including the entityEncode round-trip helper already in that test file).

## 2. Statistics → Data Quality stat

- Computation: `computeQuality(filteredObs, checklists)` in frontend/src/lib/birdingStats.ts (function starts line 466; the weather/tide loop is ~lines 496-516). Per checklist, on `c.checklistComments`: counts `anyWeatherCount` (SnowRaven OR Raincrow weather), `snowravenWeatherCount`, `raincrowWeatherCount`, `snowravenTideCount`, `snowravenWeatherAndTideCount` (SnowRaven weather AND tide on the same checklist). Returns those plus `weatherTideTotal = checklists.length` and per-count ratios (`anyWeatherRatio` etc., null when 0 checklists). Hand-written "Label: value" prose with no app credit is deliberately NOT counted (the SnowRaven/Raincrow variants gate on attribution).
- Rendering: frontend/src/components/BirdingStats.tsx, Section 6 "Data Quality" (`SectionCard title="Data Quality"`, line 1344). The weather/tide card is at lines 1416-1433: header "Weather & tide blocks" + "of N checklists", five `<BarRow>`s (Any weather / Raincrow weather / SnowRaven weather / SnowRaven tide / Weather + tide) with `labelWidth={120}` and token colors (`--sr-accent`, `--sr-chart-slate`, `--sr-graph-photo`, `--sr-chart-blue-light`, `--sr-graph-video`), plus an explanatory footnote paragraph. `BarRow` comes from components/statsPrimitives.tsx.
- Same detectors also drive the Checklist Comparer's Weather/Tide badges: `deriveBadges` in frontend/src/lib/checklistBadges.ts (lines 42-43: `weatherComment: hasWeatherBlock(comments)`, `tideComment: hasTideBlock(comments)`), rendered by components/ChecklistBadges.tsx (CloudSun/Waves icons, present = accent-bg pill, absent = outline pill, never color-alone). And WeatherTideSection.tsx passes `hasEmbeddedWeatherBlock={hasWeatherBlock(metaA.comments)}` to warn before copying a duplicate block.

## 3. Other comment-processing utilities

- frontend/src/lib/commentText.ts — safe rendering toolkit (no innerHTML anywhere):
  - `decodeEntities(s)` — decodes `&#nn;` / `&#xhh;` numeric entities plus named amp/lt/gt/quot/apos/nbsp/#39 via String.fromCodePoint, no DOM.
  - `linkify(s): CommentSegment[]` — splits on `URL_RE = /(https?:\/\/[^\s<>"')\]]+)/g`, trims trailing `[.,;:!?]+` punctuation out of the link; segments are `{ text, href? }`.
  - `commentSegments(raw)` = `linkify(decodeEntities(raw))` — the canonical pipeline for rendering an eBird comment.
  - `hasComment(raw)` — non-empty after decode+trim.
- frontend/src/lib/namedBirds.ts — `[name:]` tag parsing: `NAME_TAG_RE = /\[\s*name\s*:([^\]]{0,120})\]/gi` (whitespace-lenient; the `{0,120}` bound is a deliberate ReDoS guard — keep any new comment regexes linear like this). `parseNameTags(comment): string[]` (distinct, case-insensitive, in order); `computeNamedBirds(observations)` groups into per-individual records keyed `name.toLowerCase()::normalizedSpecies.toLowerCase()`, one sighting per submissionId, sightings sorted newest-first with submissionId tie-break; `sortNamedBirds(birds, sort, orderFor?)`.
- `escHtml` — frontend/src/lib/mapExplorerFormat.ts line 45: `s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')`. Used ONLY for map popup/label HTML strings (components/map/TargetMarkers.tsx, MapExplorer.tsx) — NOT for comment rendering, which is escaped-JSX throughout. Per CLAUDE.md standing security checks, keep new comment rendering as JSX (React auto-escape), never dangerouslySetInnerHTML.
- ID validation before linking: `SUBMISSION_ID_RE = /^S\d+$/` exported from frontend/src/components/speciesDetail/ui.tsx — gate every `https://ebird.org/checklist/${id}` href on it; render plain text otherwise (pattern used in SpeciesDetail.tsx, NamedBirdRow.tsx, StatValueLink in speciesDetail/ui.tsx).
- Data source fields: ObservationEntry.speciesComments (always) and .checklistComments (optional) in frontend/src/types.ts (lines 69, 79); parsed from CSV headers 'species comments' | 'observation details' and 'checklist comments' in frontend/src/lib/parseEbirdObservations.ts (lines 73, 82). `computeChecklists` in birdingStats.ts (line 70) aggregates per-submissionId into ChecklistEntry (types.ts ~line 85-103) carrying checklistComments, protocol, duration, distance, allObsReported, speciesCount, individualCount — exactly the record the new tab's filterable checklist list needs.

## 4. How comments are RENDERED today

A) Species Detail comments box — frontend/src/components/SpeciesDetail.tsx, "Comments" SectionCard lines ~1249-1367; state at lines 47, 66-68 (`COMMENTS_PAGE = 10`, `commentFilter`, `commentSort: 'newest'|'oldest'`, `showAllComments`), filter/sort memo at lines 370-381 (case-insensitive `.includes` on `speciesComments`, sorted by `date.localeCompare`). UI: controls strip (Search-icon-inset text input "Filter comments…" with accent focus border, two-button Newest/Oldest segmented toggle, "N comments" count) on `--sr-surface-faint` with `borderBottom: 1px solid var(--sr-border-subtle)`; rows = date (eBird checklist link gated on SUBMISSION_ID_RE, with ExternalLink icon) `·` location header line, then the comment as plain `{o.speciesComments}` (fontSize 0.84375rem, color var(--sr-text), lineHeight 1.55); first 10 shown, then a full-width "Show all {N} comments" button (ChevronDown, surface-faint background, accent text, hover accent-bg). Empty states: 'No comments match this filter.' vs 'No species comments found.'. Note: CSV comments render RAW (no decodeEntities) here and in Named Birds.

B) Media Comments box — frontend/src/components/MediaCommentsSection.tsx + frontend/src/lib/mediaComments.ts. Explicitly "mirroring the Species Detail comments box": `MEDIA_COMMENTS_PAGE = 10`, same filter input / Newest-Oldest toggle / show-all pattern, but with the filter+sort logic EXTRACTED into pure tested `filterAndSortMediaComments(rows, query, sort)` and `pickComment(row, query)`. This is the best template to copy for the new tab's two search boxes (pure lib function + section component).

C) Named Birds quoted comment block — frontend/src/components/NamedBirdRow.tsx lines 107-117: each expanded sighting renders the species comment in the quote style: `background: 'var(--sr-quote-bg)', border: '1px solid var(--sr-quote-border)', borderLeft: '3px solid var(--sr-accent-border)', borderRadius: 7, padding: '8px 11px', marginTop: 5`, fontSize 0.8125rem, lineHeight 1.55, color var(--sr-text). Quote tokens in frontend/src/globals.css: light `--sr-quote-bg: #EFF1F3; --sr-quote-border: #E0E2E6` (lines 39-40), dark `#2E2E33 / #3A3A40` (lines 140-141). Row chrome: card with `border 1px solid var(--sr-border), borderRadius 10, background var(--sr-surface), boxShadow var(--sr-card-shadow)`; collapsed header is a full-width button with ChevronRight/ChevronDown, aria-expanded; expanded body on `--sr-surface-faint` with `borderTop: 1px solid var(--sr-border-subtle)`; per-sighting meta line = date · location (ellipsized, title attr) · submissionId link. NamedBirdsTable.tsx adds the `singleOpen` accordion prop (one open row = one WebGL map context).

D) Checklist Comparer — frontend/src/components/ChecklistComparer.tsx. `CommentText({ raw })` (lines 26-48) is the only place comments go through the safe pipeline: `commentSegments(raw)` → validated http(s) links as `<a target="_blank" rel="noopener noreferrer" style={{color:'var(--sr-accent)', textDecoration:'underline', wordBreak:'break-word'}}>`, plain text split on `/\r\n|\r|\n/` into `<br>`-joined Fragments; belt-and-suspenders re-check `/^https?:\/\//i` before emitting an anchor. Species-level: `SideCell` shows a MessageSquare toggle button (aria-expanded, accent when open) → `CommentLine` (A/B label + CommentText, fontSize 0.75rem, color var(--sr-text-muted), lineHeight 1.5). Checklist-level: `ChecklistTag` (lines 427-490) has a "Notes" chevron disclosure; the note box style is `padding: '8px 10px', borderRadius: 6, background: 'var(--sr-bg)', border: '1px solid var(--sr-border-subtle)', fontSize: '0.75rem', color: 'var(--sr-text-muted)', lineHeight: 1.5, maxWidth: 460, wordBreak: 'break-word'` wrapping `<CommentText raw={meta.comments} />`. Comparer comments come from the eBird API (entity-encoded), hence the decode pipeline; CSV-sourced tabs render raw text. The new tab reads CSV data, so plain-text rendering matches Species Detail/Named Birds, but routing through CommentText/commentSegments is harmless and adds linkification for free.

Shared section chrome: `SectionCard` / `SectionHead` (icon-in-accent-square + 0.8125rem 600 title) in frontend/src/components/speciesDetail/ui.tsx — used by Species Detail and mirrored inline by MediaCommentsSection.

## tab-registry

Adding a "Checklists" tab touches exactly two type/registry files for the core wiring — frontend/src/lib/tabLayout.ts (the `ConfigurableTab` union, `DEFAULT_TAB_ORDER` array, `TAB_LABELS` record) and frontend/src/App.tsx (component import, `TAB_ICONS` record, `DEFERRED_TABS` array, and a new `role="tabpanel"` div with id `panel-checklists` gated on `mountedTabs.has('checklists')`) — plus a new tab component modeled on NamedBirds.tsx. TabNav.tsx and Settings.tsx's TabLayoutSection need NO changes: both are fully data-driven from the navItems/TAB_LABELS registries, and the bar auto-collapses to the z-index-1200 dropdown by measurement, not breakpoint. There is no settings migration to write: `parseLayout` in tabLayout.ts already drops unknown ids and appends tabs missing from a user's saved order (so existing users see the new tab appended at the END of their layout, never hidden), but ~6 hardcoded order arrays in tabLayout.test.ts will break and need updating. Docs require a `## Checklists` section in docs/HELP.md plus a manually-maintained TOC entry in HelpDocs.tsx — where the literal name "Checklists" collides with the existing `### Checklists` h3 under List Comparer (both slugify to id `checklists`), and note the TOC was already forgotten for Named Birds. Per CLAUDE.md, the change must also bump frontend/package.json + src-tauri/tauri.conf.json, update CHANGELOG.md, README.md, and the website (feature card + version pill, currently v0.5.26).

**Files:**
- `/home/parallels/snowraven/frontend/src/lib/tabLayout.ts` — Tab registry: ConfigurableTab union, DEFAULT_TAB_ORDER, TAB_LABELS, parseLayout (auto-migration of saved layouts: drops unknown ids, appends missing tabs), storage key 'sr-tab-layout'
- `/home/parallels/snowraven/frontend/src/lib/tabLayout.test.ts` — Tests that hardcode full order arrays — serializeLayout round-trip (l.152–168) and append-missing test (l.89–98) WILL break when DEFAULT_TAB_ORDER grows
- `/home/parallels/snowraven/frontend/src/App.tsx` — TAB_ICONS record (l.83–106), DEFERRED_TABS (l.113–116), mountedTabs defer-mount effect (l.376–384), navItems useMemo (l.532–549, no edit needed), tabpanel divs (named-birds panel l.957–972 is the template), lazy-chunk + idle-prefetch pattern (l.30–37, 358–373), persistLayout/parseLayout storage-seam hydration (l.195–221)
- `/home/parallels/snowraven/frontend/src/components/TabNav.tsx` — NO changes needed — data-driven from NavItem[]; measurement-based collapse to dropdown (l.30–50); dropdown zIndex 1200 (l.283); derives tab-${id}/panel-${id} ARIA ids
- `/home/parallels/snowraven/frontend/src/components/Settings.tsx` — NO changes needed — TabLayoutSection (l.622–800) renders reorder/hide UI from tabOrder prop + TAB_LABELS
- `/home/parallels/snowraven/frontend/src/components/HelpDocs.tsx` — Manually-maintained TOC array (l.7–23) needs a 'checklists' entry (and is missing 'named-birds' — existing bug); textToId slugifies headings; scrollToSection uses getElementById (first-match)
- `/home/parallels/snowraven/docs/HELP.md` — Needs a new '## Checklists' top-level section; GOTCHA: '### Checklists' already exists under List Comparer (l.307) — same slug 'checklists', place the new section before List Comparer or rename
- `/home/parallels/snowraven/frontend/src/components/NamedBirds.tsx` — Canonical tab-component template: Phase union, SetupRequired gate, loadEbirdObservations cache, /taxonomy/codes batch, BirdName rendering, props { onGoToSettings, filesVersion?, onOpenSpecies? }
- `/home/parallels/snowraven/frontend/src/components/SetupRequired.tsx` — Empty-state component shown when no eBird backup is loaded (paired with EBIRD_BACKUP_STEPS from setupCopy.tsx)
- `/home/parallels/snowraven/README.md` — Feature list bullet required per CLAUDE.md (named-birds added 1 line)
- `/home/parallels/snowraven/website/index.html` — Feature card (~l.286 for Named Birds) + version pill (l.48) + footer version (l.471) must be updated in the same change per CLAUDE.md
- `/home/parallels/snowraven/CHANGELOG.md` — Mandatory entry with the version bump
- `/home/parallels/snowraven/frontend/package.json` — Version bump (currently 0.5.26) — must match tauri.conf.json
- `/home/parallels/snowraven/src-tauri/tauri.conf.json` — Version bump — source of the desktop bundle/updater version
- `/home/parallels/snowraven/website/tools/gen-demo-data.mjs` — Synthetic demo-data generator — seed demo checklist/species comments if website screenshots of the new tab are wanted

**Reusable:**
- parseLayout in lib/tabLayout.ts — zero-code 'migration': unknown tab ids dropped, missing tabs appended to saved orders, so 'checklists' auto-appears (last, visible) for users with saved layouts on both web-localStorage and desktop storage-seam paths
- The named-birds commit (43fea15) as the exact-footprint checklist for adding a tab: tabLayout.ts (3 lines), App.tsx (import + icon + DEFERRED_TABS + tabpanel), new component + lib module + tests, HELP.md, README, CHANGELOG, version bumps, demo-data seed
- NamedBirds.tsx tab template: Phase state machine, storage.getFilesStatus() → SetupRequired(EBIRD_BACKUP_STEPS) gate, loadEbirdObservations() shared parsed-CSV cache (lib/observationsCache.ts), filesVersion-triggered reload, transport.post('/taxonomy/codes') batch for BirdName favicons
- Defer-mount pattern in App.tsx: add tab id to DEFERRED_TABS, gate panel body on mountedTabs.has(id), panel div with display:none toggling — state survives tab switches, no work on first paint
- Lazy-chunk + idle-prefetch pattern (importX thunk + lazy() + requestIdleCallback warm + <Suspense fallback={<TabLoading/>}>) if the Checklists tab pulls heavy deps
- TabNav.tsx and Settings.tsx TabLayoutSection require zero changes — both are registry-driven; the responsive dropdown (z-index 1200) and drag-reorder UI pick up new tabs automatically
- BirdName component + navigateToSpeciesDetail prop wiring (onOpenSpecies) for any species names shown in checklist rows or comment search results
- SUBMISSION_ID_RE (/^S\d+$/) from components/speciesDetail/ui — required gate before building eBird checklist hrefs from CSV data (standing security check, every checklist row will need it)
- HelpDocs.tsx TOC array + textToId slug rules — add the section AND the TOC entry; watch the 'checklists' slug collision with List Comparer's '### Checklists' h3

**Details:**

## 1. frontend/src/lib/tabLayout.ts — the tab registry (3 edits)

- `ConfigurableTab` union (lines 1–9): add `| 'checklists'`. Current members: 'weather' | 'species-detail' | 'birding-stats' | 'map-explorer' | 'life-list' | 'breeding-codes' | 'named-birds' | 'comparer'. `Tab = ConfigurableTab | 'settings'` (line 33) flows automatically.
- `DEFAULT_TAB_ORDER: ConfigurableTab[]` (lines 11–20): insert 'checklists' at the desired default position. NOTE: this position only affects FRESH installs — existing users with a saved layout get it appended at the end (see migration below).
- `TAB_LABELS: Record<ConfigurableTab, string>` (lines 22–31): add `'checklists': 'Checklists'`. Because it's a `Record<ConfigurableTab, …>`, TypeScript errors until added — same guardrail applies to TAB_ICONS in App.tsx. Existing labels for reference: 'life-list' → 'Multimedia', 'birding-stats' → 'Statistics', 'comparer' → 'List Comparer'.
- `KNOWN_TABS` (line 55) is derived from DEFAULT_TAB_ORDER — no separate edit.

### Saved-layout migration: ALREADY HANDLED, no code needed
`parseLayout(parsed: unknown): TabLayoutState` (tabLayout.ts lines 69–94) is the single normalizer for BOTH persistence paths (web localStorage key `sr-tab-layout` and the desktop storage-seam setting `tabLayout`). Behavior with a tab id it has never seen:
1. Unknown ids in a stored `order`/`hidden` are filtered out via `KNOWN_TABS.has(id)` (so an old app version reading a layout saved by a newer version silently drops 'checklists').
2. Tabs in DEFAULT_TAB_ORDER but missing from the stored order are APPENDED in DEFAULT_TAB_ORDER iteration order — so a user with a pre-Checklists saved layout sees the new tab appear as the LAST tab, visible (it can't be in their `hidden` set). This is tested ("FR-13" tests, tabLayout.test.ts lines 70–99 and 135–143).
3. Malformed input → full default layout.

## 2. frontend/src/lib/tabLayout.test.ts — WILL BREAK, must update
Several tests hardcode complete order arrays and will fail once DEFAULT_TAB_ORDER grows:
- `serializeLayout` round-trip (lines 152–168) hardcodes the full 8-tab order; parseLayout will append 'checklists', breaking `expect(restored.order).toEqual([...original.order])`.
- "appends tabs that are missing from stored order" (lines 89–98) asserts `state.order[state.order.length - 1] === 'comparer'`; if 'checklists' is added after 'comparer' in DEFAULT_TAB_ORDER, the last appended tab becomes 'checklists'.
- Other tests (lines 28–35, 102–111, 116, 170–175) use 7-element arrays that still pass via auto-append but should be refreshed. The previous tab addition only had to touch this file in 1 place (the serializeLayout literal), per `git show 43fea15`.

## 3. frontend/src/App.tsx — five wiring points

- Import the new component (~line 21, next to `import { NamedBirds } from './components/NamedBirds'`). Two patterns exist: (a) static import (ListComparer, LifeList, BreedingCodeList, NamedBirds, Settings) or (b) lazy chunk with a named import thunk so it can be idle-prefetched — `const importBirdingStats = () => import('./components/BirdingStats'); const BirdingStats = lazy(() => importBirdingStats().then(m => ({ default: m.BirdingStats })))` (lines 30–37), with the thunk also called in the idle-warm effect (lines 358–373) and the panel wrapped in `<Suspense fallback={<TabLoading label="…" />}>`. A Checklists tab with heavy search is fine as a static import unless it pulls a heavy dep — NamedBirds parses the whole backup and is static.
- `TAB_ICONS: Record<ConfigurableTab, React.ReactNode>` (lines 83–106): add an entry, e.g. a lucide icon at `size={14} strokeWidth={2.5} aria-hidden="true"` (named-birds uses `<Tag size={14} strokeWidth={2.5} aria-hidden="true" />`; weather/map-explorer/comparer use inline 14x14 SVGs). Record type forces the addition.
- `DEFERRED_TABS: Tab[]` (lines 113–116): add 'checklists'. Everything except the always-mounted Weather panel is here, including 'settings'. The defer-mount mechanics: `mountedTabs` state (line 165) is seeded with the initial activeTab if deferred; the effect at lines 376–384 adds the active tab to the set post-commit (deliberately post-paint, see comment); once mounted a tab STAYS mounted so its parsed-CSV state survives tab switches. Panels use `display: activeTab === id ? 'flex' : 'none'` — they are hidden, not unmounted.
- New tabpanel div (pattern at lines 957–972, the Named Birds panel): `role="tabpanel"`, `id="panel-checklists"`, `aria-labelledby="tab-checklists"`, `className="sr-panel"`, `style={{ display: activeTab === 'checklists' ? 'flex' : 'none', flexDirection: 'column', padding: '40px 24px 24px' }}`, body gated `{mountedTabs.has('checklists') && (<Checklists onGoToSettings={() => setActiveTab('settings')} filesVersion={filesVersion} onOpenSpecies={navigateToSpeciesDetail} />)}`. The ids matter: TabNav derives `aria-controls={'panel-'+item.id}` and `id={'tab-'+item.id}` from the item id.
- `navItems` useMemo (lines 532–549) builds from `visibleTabs(tabLayout)` + TAB_LABELS + TAB_ICONS and appends Settings — no edit needed; the new tab flows in automatically.
- Props contract available from App: `onGoToSettings`, `filesVersion` (bumped when files are re-saved in Settings — triggers reload), `onOpenSpecies={navigateToSpeciesDetail}` (Species Detail navigation for `<BirdName>`), optionally `keyStatus` (ListComparer takes it).

## 4. frontend/src/components/TabNav.tsx — NO CHANGES
Fully data-driven from `items: NavItem[]` ({ id, label, icon }). Desktop bar (roving tabindex + arrow keys) and the narrow dropdown both render the same list. The collapse decision is by measurement, not breakpoint: a hidden probe renders all tabs at natural width and `useLayoutEffect` collapses to the dropdown when `probe.scrollWidth > wrap.clientWidth - 48` (lines 30–50) — so a 9th tab just makes the bar collapse slightly earlier. The dropdown menu has `zIndex: 1200` (line 283) to sit above the map. The Settings divider in the dropdown keys off `item.id === 'settings'`.

## 5. frontend/src/components/Settings.tsx — NO CHANGES
`TabLayoutSection` (lines 622–800) renders rows from the `tabOrder` prop using `TAB_LABELS[tab]` for names, drag-reorder via HTML5 DnD, eye-toggle visibility (last-visible-tab disabled), "Restore defaults" comparing against DEFAULT_TAB_ORDER. All driven by the registry; the new tab appears automatically.

## 6. In-app Help — TWO places
- docs/HELP.md: add a `## Checklists` section (sections are separated by `---` hrs; current top-level order mirrors tab order: Weather, Species Detail, Statistics, Map Explorer, Multimedia, Breeding Codes, Named Birds, List Comparer, Settings; named-birds' section is ~10 lines, lines 289–297). CLAUDE.md: HELP.md is the single source of truth for in-app help and MUST be updated before pushing.
- frontend/src/components/HelpDocs.tsx: the `TOC` array (lines 7–23) is MANUALLY maintained `{ id, label, sub }` — it is NOT generated from the markdown. Heading anchors ARE generated: `textToId(text)` lowercases and dashes the heading text, and `scrollToSection(id)` uses `document.getElementById`.
- GOTCHA — duplicate anchor: HELP.md already contains `### Checklists` (line 307, a sub-heading under `## List Comparer` describing its checklist mode). Both that h3 and a new `## Checklists` h2 slugify to id `checklists`; `getElementById` returns the first in document order. Place the new `## Checklists` section BEFORE `## List Comparer` in HELP.md (natural if it mirrors tab order) so the TOC entry scrolls to the right place, or reword one heading.
- GOTCHA — existing omission: the TOC array has NO 'Named Birds' entry even though `## Named Birds` exists in HELP.md (the 0.5.23 tab addition forgot it). Add both 'named-birds' and 'checklists' TOC entries, keeping TOC order matching document order.
- HELP.md is bundled at build time via `import helpText from '../../../docs/HELP.md?raw'` — no runtime fetch, no extra wiring.

## 7. Release/doc duties (CLAUDE.md mandates, mirrored by the named-birds commit footprint)
- Version bump in BOTH frontend/package.json and src-tauri/tauri.conf.json (currently 0.5.26); CHANGELOG.md entry.
- README.md feature bullet (one line in the feature list, ~line 17 region).
- website/index.html: feature card (Named Birds card is at ~line 286) + version pill (line 48, `v0.5.26`) + footer version (line 471); screenshots only from SYNTHETIC demo data (website/tools/gen-demo-data.mjs — the named-birds commit seeded demo data for the showcase; a Checklists tab with comment search would similarly want demo checklist/species comments).
- PRODUCT_CONTEXT.md / DECISIONS.md updates were part of the previous tab-addition commit (pipeline convention).
- website/tools/capture.mjs references only `#panel-weather`, no per-tab registry to update there.

## 8. Tab component template — frontend/src/components/NamedBirds.tsx
Canonical shape for a backup-driven tab: props `{ onGoToSettings: () => void; filesVersion?: number; onOpenSpecies?: (commonName: string) => void }`; local `Phase` union ('loading-saved' | 'setup-required' | 'error' | 'ready'); on mount (and on `filesVersion` change) `storage.getFilesStatus()` → if `!status.ebird` render `<SetupRequired>` with `EBIRD_BACKUP_STEPS` (from setupCopy.tsx); else `loadEbirdObservations()` (shared parsed-CSV cache in lib/observationsCache.ts); batch-resolve taxon codes via `transport.post('/taxonomy/codes', { species })` so `<BirdName>` favicons work; render names through `<BirdName commonName … taxonCode … hasEntry onOpenSpecies={onOpenSpecies}>`.

## 9. Other gotchas
- Initial activeTab (App.tsx lines 134–138) is the first visible tab of the saved layout — if a user later drags Checklists first, it can be the boot tab; the `mountedTabs` seed handles that (line 165–167).
- Desktop (Tauri) hydration: the layout is re-read from the storage seam AFTER mount (App.tsx lines 205–221) because WKWebView wipes localStorage on relaunch; nothing new to do, but persist any new Checklists-tab settings (e.g. the hide-weather/tide toggle) through `storage.getSetting/setSetting`, never localStorage directly (CLAUDE.md rule).
- The dropdown's `aria-activedescendant`/option ids also derive from `tab-${id}` — consistent automatically.
- An eBird submission id interpolated into a link must be gated on `SUBMISSION_ID_RE` (`/^S\d+$/`, exported from components/speciesDetail/ui) — standing security check, directly relevant since the Checklists tab will link every row to eBird.
