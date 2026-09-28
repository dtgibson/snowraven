# PRD — Targets Tab
**Feature:** targets-tab
**Date:** 2026-09-26
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved; revised once after the user's frequency decision, revised text governs)

## Feature Overview

A new **Targets** tab, placed after Calendar, that lists a chosen US county's species as a sortable target list over the user's own record: lifers, species with a media gap, and species with no breeding code. Every row can carry two kinds of frequency that the UI never conflates: **probability** (eBird's own percent-of-checklists figure from a bar-chart file the user downloads from ebird.org and adds per county) and **live** (a count of days reported in the last 30, with the last report's date, place and distance, from the eBird API with the user's key).

## User Stories

> **US-01** — As a birder planning a day in a county I have birded, I want one list of everything there that would be a lifer, a first photo, audio or video, or a first breeding code for me, so that I stop assembling it across three tabs and a map radius.

> **US-02** — As a birder who trusts eBird's Targets page, I want each species' eBird frequency for this month and year-round from my own downloaded bar-chart file, and I want it to match what eBird shows me, so that I can rank a county the way I already do on eBird.

> **US-03** — As a birder deciding where to go this week, I want to know how many of the last 30 days each species was actually reported in the county, when and where it was last reported, and how far that is from me, so that I can weigh what is findable now against what is merely likely in general.

> **US-04** — As a birder reading the list quickly or with a screen reader, I want the historical probability and the live count to be unmistakably different things wherever they appear, so that I never mistake "3.29% of checklists" for "seen recently" or the reverse.

> **US-05** — As a birder with no ML export loaded, or no eBird key, or no network, I want the tab to show me what it can from my files and its cache and tell me plainly what it cannot, so that the tab is useful on a trail with no signal.

> **US-06** — As a birder who has customized my tab order, I want the new tab to appear without my layout being rearranged, so that an update does not undo my arrangement.

## Functional Requirements

### A. Tab placement and layout

> **FR-01** — The app shall add a configurable tab with id `targets`, label **Targets** (recorded in `TAB_LABELS`, the authoritative source of user-facing tab names), and its own icon, selectable from the tab bar and the compact dropdown, hideable and reorderable exactly like the other configurable tabs.

> **FR-02** — For a user on the default layout, the app shall place Targets immediately after Calendar in `DEFAULT_TAB_ORDER`.

> **FR-03** — The app shall migrate exactly one generation of saved default: a saved order that equals the 1.0.19 through 1.0.36 default element for element (after the existing unknown-id drop and missing-tab append) shall read as the new default with Targets after Calendar; `PREVIOUS_DEFAULT_TAB_ORDER` becomes that 1.0.19 order and the pre-1.0.19 constant is retired. Any other saved order shall be kept verbatim with Targets appended last by the existing missing-tab step. The hidden set shall be preserved through the swap and nothing shall be written back at read time.

> **FR-04** — The Targets tab shall load lazily like the other heavy tabs and shall not add the map library or the county geometry to the entry chunk.

### B. County picker

> **FR-05** — The app shall offer a county picker listing every US county present in the user's eBird backup (from the backup's State/Province and County fields), each shown as "County, ST" with the user's checklist count for that county, sorted by checklist count descending with a name tiebreak.

> **FR-06** — A county whose backup key cannot be joined to a county geometry record, or whose geometry yields no eBird region code, shall be listed as unavailable with a one-line reason ("SnowRaven cannot map this county to an eBird region") and shall not be selectable; it shall never be silently omitted.

> **FR-07** — On the first visit with no remembered county, the app shall open on the available county with the most checklists in the backup.

> **FR-08** — The app shall remember the last chosen county on that device across relaunches, through the `storage` seam. If the remembered county is no longer in the backup or is no longer available, the app shall fall back to the FR-07 default without an error.

> **FR-09** — With no eBird backup stored, the tab shall show the app's standard setup-required guidance for the backup and no county picker. A failed backup status lookup shall show the app's load-error state with a retry, never the setup guidance.

> **FR-10** — The picker shall be operable by keyboard and shall be searchable by typing part of a county or state name.

### C. Species pool

> **FR-11** — The species pool for a county shall be the county's all-time species-level list as already served by the county-species route and held in the shared county completeness store; the tab shall not keep a second copy of that list.

> **FR-12** — When the store holds the county's list (fresh or stale), the app shall render the pool and every target badge before any network call is made, including with no eBird key and while offline.

> **FR-13** — When the store has no list for the county and an eBird key is present and the app is online, the app shall fetch the list through the shared eBird gate and show a one-line "Loading {County}'s species list from eBird" status while it does; the county picker and toggles shall remain usable during the fetch.

> **FR-14** — When the store has no list for the county and there is no eBird key or the app is offline, the app shall show a one-line honest status naming the cause ("Add an eBird API key in Settings to load this county's species list" or "Offline; this county's list has not been loaded before") and no spinner.

> **FR-15** — A pool fetch that fails (server error, refused key, 429 exhausted) shall show a one-line status with the cause and a retry control; the failure shall not be cached.

### D. Target types and toggles

> **FR-16** — The app shall classify every pool species into zero or more of three types against the user's whole record, using the app's existing definitions and no parallel ones:
> - **Lifer**: the species is not in the user's recorded set, by the normalized-name subtraction Nearby Lifers uses and the species-code subtraction `completenessTargets` uses.
> - **Media**: the user has recorded the species and the ML export lacks at least one of Photo, Audio, Video for it (Map Explorer's Media Targets rule).
> - **Breeding**: the user has recorded the species and no observation of it carries a breeding code from the `BREEDING_CODES` set (F and H included, as the Breeding Codes tab counts them).

> **FR-17** — Types shall be disjoint by construction: a Lifer shall never carry a Media or Breeding badge; a recorded species may carry both Media and Breeding.

> **FR-18** — The app shall show a row for a pool species if and only if it carries at least one type whose toggle is on. A species with no type shall never appear.

> **FR-19** — The app shall provide three toggles, Lifer, Media, Breeding, all on by default, each with an accessible pressed state. Turning one off shall remove exactly the rows whose only on-type it was; a species carrying two types stays while either toggle is on.

> **FR-20** — With no ML export stored, the Media toggle shall be shown disabled with the reason "Add your ML export in Settings to see media targets" and shall count as off. A failed stored-file status lookup is the FR-09 load-error state (one lookup covers both files), never the add-the-export reason. An ML export that is stored but cannot be read shall show the toggle as unavailable with "Couldn't read your ML export" and a retry, not the add-the-export reason. (Amended at Stage 3, see schema.md and decisions.md.)

> **FR-21** — When the Media toggle is on, the app shall offer Photo, Audio and Video chips. Each row's Media badge shall name which of the three the user lacks. With no chip selected, any missing type qualifies; with one or more selected, only species missing every selected type qualify (AND).

> **FR-22** — When the Breeding toggle is on, the app shall offer a two-position threshold: **Any code** (default: a species is a target only if it has no breeding code at all) and **Confirmed** (a species is a target if it has no code in `CATEGORY_CODES.confirmed`, the tier 3 and 4 codes).

> **FR-23** — With all three toggles off, the app shall show an empty list with the one-line message "Turn on at least one target type" and no other status.

> **FR-24** — A county whose pool yields zero targets for the current toggles shall show "No {selected types} targets for you in {County}" with the pool size, distinguishing this from a county whose pool has not loaded (FR-14).

> **FR-25** — The app shall show a summary line above the list: the number of rows shown and the count per type among them ("42 targets: 17 lifers, 30 media, 9 breeding"), updating with every toggle, chip, threshold and window change.

### E. Probability: eBird frequency from a bar-chart file

> **FR-26** — For the selected county, the app shall offer an **Add eBird bar-chart file** action when no file is stored for that county, and **Replace** and **Remove** actions when one is. The file is a new stored user-file kind, one per county, stored through the `storage` seam on both transports, and every add, replace or remove shall bump the bar-chart files epoch (`lib/barChartFilesChanged.ts`, a dedicated module of the `filesChanged` shape; amended at Stage 3, see schema.md §1.4 and decisions.md).

> **FR-27** — Every import shall go through the stored-file refusal registry (filename check before the bytes are read, content check before anything is written). A refusal shall store nothing, clear nothing, bump no epoch, and leave the county's existing file exactly as it was.

> **FR-28** — The filename check shall accept eBird's bar-chart download extensions (`.txt`, `.tsv`) and refuse everything else with a plain reason. The content check shall refuse a file over the app's stored-file size cap with the standard too-large message, and shall refuse a file that is not in eBird's bar-chart layout (a Sample Size row and at least one species row in the period columns) with "This is not an eBird bar-chart file. Download it from the county's bar chart page on ebird.org (Download Histogram Data)."

> **FR-29** — When the filename carries an eBird region code (`ebird_US-CA-001__...`) that differs from the selected county's region code, the import shall be refused with "This file is for {that region}, not {County}. Open {County} and add it there, or download {County}'s file." When the code matches, or the filename carries no code, the file shall be attributed to the selected county.

> **FR-30** — The app shall parse the file's year range and month range (from the filename when present, otherwise from the periods whose sample size is greater than zero) and shall show them in the file's status line ("eBird bar chart, {County}, {y1}-{y2}, {months}").

> **FR-31** — For each pool species that joins a row in the file, the app shall show **this month**: eBird's percent of checklists reporting the species in the current calendar month (device local date), derived from the current month's periods in the file, displayed with two decimals and a percent sign. If the current month is outside the file's month range, this-month shall read "Not in file range" for every row.

> **FR-32** — For each pool species that joins a row in the file, the app shall show **year-round**: the sample-size-weighted share of checklists across all of the file's periods, displayed with two decimals and a percent sign. Year-round shall be offered only when all twelve months are present in the file; otherwise the column and its sort shall read "Needs a full-year file (this one covers {months})".

> **FR-33** — Against the user's real Alameda County file, Lincoln's Sparrow shall read exactly **3.29%** year-round, matching the user's eBird Targets page. This is an acceptance row; the exact derivation is pinned against that file (see Open Questions).

> **FR-34** — A pool species with no matching row in the file shall show "No eBird figure" in both probability cells and shall sort after every species with a figure under the two probability sorts.

> **FR-35** — File rows that do not join a pool species shall be counted and surfaced, never dropped silently. The file status line shall report rows matched, rows skipped as non-species forms (spuh, slash, hybrid, subspecies, by the app's existing taxonomy rule), and rows unmatched (species-shaped names that joined nothing), with a control that lists the unmatched names.

> **FR-36** — Every probability figure and both probability sort names shall carry the percent sign and name their source and range: "eBird, {County}, {y1}-{y2}, {Month}" for this month and "eBird, {County}, {y1}-{y2}, year-round" for year-round. A narrowed year range shall appear in that label. The same text shall be in the column headers' and sort options' accessible names.

> **FR-37** — Removing a county's file shall return the county to the no-file state (FR-38) and restore the default sort rule of FR-45. Replacing a file shall re-run FR-27 through FR-30 and, on refusal, leave the previous file in place.

> **FR-38** — With no file for the county, the two probability sorts and columns shall be shown as unavailable with the one-line prompt "Add {County}'s eBird bar-chart file to sort by eBird frequency" and a link labeled "Open {County}'s bar chart on ebird.org" that opens the county's bar chart page in the system browser through the app's external-open seam. The rest of the list shall work fully.

> **FR-39** — The parsed frequency table shall be derived from the stored file on load and no derived document shall be persisted for it, so that deleting the file is its whole teardown. (If the Architect persists a derived document instead, it shall register a `clearDerived.ts` row and a `cacheInventory` pairing.)

> **FR-40** — A failed file-status lookup for the county shall show "Couldn't check for a bar-chart file" with a retry, never the add-a-file prompt.

### F. Live: eBird API 30-day sweep

> **FR-41** — With an eBird key and network, the app shall sweep the county's reported species for each of the last 30 calendar days (device local date, ending today) through a per-day county historic-observations lookup available on both transports, and for every pool species shall derive: the **live count** (days reported, 0 to 30), the **last report** (most recent date within those 30 days), and that report's **place** and **coordinates** when eBird supplies them.

> **FR-42** — The live count shall always be displayed as a count with its window, "Reported {N} of the last 30 days", with the last report's date beside it, and never as a percent or fraction. During a sweep it shall read "Reported {N} of {K} days checked so far". The same wording shall be in the accessible name.

> **FR-43** — The sweep shall run only when an eBird key is present. Without a key, the live cells shall read "Needs an eBird API key" and no eBird call shall be made. Offline, the live cells shall show whatever the cache holds and the status line "Offline; live counts from {date}" naming the last complete sweep, or "Offline; no live data yet" when none exists, with no spinner.

> **FR-44** — Each day's result shall be cached durably per (county region code, date) so that a revisit the same day costs no calls and the next day costs one; a day before today shall be treated as complete once fetched, and today's day shall be re-fetched at most once per visit because it is still accruing. The cache shall follow the app's durable-cache pattern (validated at the write chokepoint, entry and payload budgets, FIFO eviction, errors never cached, offline stale reads) and shall register in `clearDerived.ts` with a `cacheInventory` row, because its keys are counties the user has birded.

> **FR-45** — The sweep shall show a visible progress line ("Checking eBird: {K} of 30 days") and rows shall fill in progressively; the pool and badges shall be visible throughout (FR-12).

> **FR-46** — Every sweep call shall go through the shared eBird gate (the route joins `EBIRD_GATED_PATHS` on both transports with the shared 429 mapper). A 429 shall pause the sweep for the gate's cooldown and show "eBird asked us to slow down; resuming in {s} s" in the progress line; the sweep shall own its own pass-scale pacing in the tab's controller and never change gate policy. A day that fails after the bounded retries shall be shown as unchecked ("{N} of {K} days checked; {M} days could not be checked") with a retry control, and shall not be cached.

> **FR-47** — A species with no report in the 30 swept days shall read "Not reported in the last 30 days", with no last-report date, place or distance.

### G. Sorts and window

> **FR-48** — The app shall offer six sorts with these names in the control and in the accessible name: "eBird frequency, this month (%)", "eBird frequency, year-round (%)", "Live: days reported, last 30", "Distance to last report", "Alphabetical", "Taxonomic". Every sort shall break ties in the pool's eBird taxonomic order; Alphabetical shall sort by displayed common name.

> **FR-49** — The default sort shall be "eBird frequency, this month (%)" when the selected county has a file whose range includes the current month, and "Live: days reported, last 30" otherwise. The default is re-evaluated when the county changes or its file is added or removed; a sort the user chose explicitly in the session is kept while it remains available.

> **FR-50** — The two probability sorts shall be unavailable (shown, disabled, with the FR-38 prompt) when the county has no file, and year-round shall additionally be unavailable when the file lacks a month (FR-32). The live sort shall be available whenever any live data exists (cached or partial) and shall otherwise be shown disabled with "Needs an eBird API key" or "No live data yet".

> **FR-51** — The distance sort and the distance cell shall measure from the saved Default Location, or from the device position when the user presses **Use my location** (the existing location seam, no new permission prompt or storage). With neither, the distance sort shall be disabled with the no-anchor reason (as approved at the Stage 4 re-entry: "No location set. Choose where to measure from", which opens the FR-51a chooser) and every distance cell shall read "No location set". A row whose last report has no coordinates, or no report in the window, shall show "No distance" and sort last.

> **FR-51a** — The user shall be able to choose, inside the tab, where distances are measured from, through a "Measure distances from" chooser opened from the anchor name in the status line. It shall offer **My location**; **Default Location** (disabled with "Not set in Settings" when none is saved); **A place**, using the app's existing place-name search, which looks a name up on OpenStreetMap only when the user presses Search (never as they type) and shows the app's existing "No location found" line on a miss, leaving the anchor unchanged; and **Places in this list**, every location named by the county's loaded live data, each showing its distance from the current anchor, available offline and costing no request. A choice shall re-measure every distance cell, the distance sort and the distance slider at once, and the status line shall name the anchor and its kind ("Distances from Arrowhead Marsh, a place in this list."). The choice lasts for the session, survives a county change, and is never written to storage; after a relaunch distances are measured from the Default Location again. (Added at the Stage 4 re-entry after the user's live look; user decisions: session-only, keep the list places. See decisions.md.)

> **FR-52** — Alphabetical and Taxonomic shall work with no key, no file and offline, over the cached pool.

> **FR-53** — The app shall offer a window on the last county report with four positions, Day, Week, 30 days, Any time, default Any time, using the shared `isWithinWindow` predicate. A row shall be hidden by the window only when every day inside that window has been checked (from the sweep or the cache) and none reported the species; a row shall never be hidden because its days have not been checked yet. "Any time" hides nothing.

> **FR-54** — Without any live data for the county (no key, or offline with an empty cache), the window control shall be shown disabled with "Needs live eBird data" and no row shall be hidden by it.

> **FR-54a** — The app shall offer a distance filter as a slider with six stops: **Any distance** (the default, hides nothing), **1**, **5**, **10**, **25** and **50 miles**, measured from the FR-51 anchor to the same last report the distance cell shows. It combines with the window (FR-53) and the type toggles. A row shall be hidden by it only when its last report is known and farther than the chosen distance, or when every day in the window has been checked and none reported the species; a row shall never be hidden because its days have not been checked yet. With no anchor location the slider shall be disabled with the FR-51 reason, and with no live data it shall be disabled with "Needs live eBird data"; in both cases no row is hidden by it. The slider shall be operable by keyboard (arrow keys step between stops) and announce its value as a phrase ("Within 5 miles", "Any distance"). (Added at Stage 4 at the user's request; see decisions.md.)

> **FR-55** — `isWithinWindow` shall count calendar days by rounding rather than flooring the elapsed time, so that on the day after a spring-forward transition a report from eight calendar days earlier is outside Week and one from two calendar days earlier is outside Day (flooring admits both; amended at Stage 3, see schema.md §7); the `widgetRows.parity.test.ts` declared-difference row shall flip to agreement in the same change. The fix reaches Nearby Lifers, Media Targets and the hotspot 7-day count identically.

### H. Rows and detail

> **FR-56** — Every row shall show: the species name through `<BirdName>`; its type badges (Lifer, or Media with the missing types, and/or Breeding); this-month and year-round probability (when a file exists); the live count with the last report date; the last report's place; the distance. Cells whose data is unavailable shall carry the specific reason text from this document, never a blank.

> **FR-57** — A row for a recorded species (Media or Breeding) shall open Species Detail for that species on activation; a Lifer row shall not (the species is not in the user's record) and shall render the name plain with the standard link marks.

> **FR-58** — The two kinds shall be distinguishable without color or position: probability cells and headers carry "%" and the source label (FR-36); live cells carry a count and a window (FR-42); a screen reader reading a row shall hear both distinctions.

> **FR-59** — The list shall remain responsive to toggle, chip, threshold, sort and window changes while a pool fetch or a sweep is in progress; no control shall be blocked by network activity except the actions the status text names.

### I. Published surfaces and records

> **FR-60** — `docs/HELP.md` shall gain a Targets section in the same change, including the steps to download a county's bar-chart file from ebird.org while signed in (bar chart page, Download Histogram Data), what "probability" and "live" each mean, and that the file stays on the device and is not part of iCloud Sync. No em dashes.

> **FR-61** — `PRIVACY_POLICY.md` shall gain, shown to the user before landing: the per-day county observations query in the eBird bullet, and the statement that an imported eBird bar-chart file is stored only on the device and is not synced. The policy shall remain true.

> **FR-62** — The website and README shall receive at most one PROPOSED sentence for the Targets tab, shown as before/after pages, and nothing shall be written to either until the user approves. The App Store listing copy is not touched by this build unless the user asks.

> **FR-63** — The version shall be bumped (patch) in all four places CLAUDE.md names, with a CHANGELOG entry, and the user shall get a live tailnet look at the built tab against their real backup and their real Alameda file before the deploy gate.

## Non-Functional Requirements

> **NFR-01 — Performance:** With the pool cached, the list (badges, alphabetical and taxonomic sorts, summary line) renders with no network call and within one frame budget on the user's dataset; a first-visit sweep costs at most 30 gated eBird calls and completes in roughly 5 to 8 seconds at the 150 ms gate floor with no 429; a same-day revisit costs zero sweep calls.

> **NFR-02 — Performance:** The entry chunk gains no map library, county geometry, or chart dependency; `entryChunk.test.ts` stays green.

> **NFR-03 — Accessibility:** WCAG 2.1 AA holds at 320px viewport width and 200% in-app text scale: no horizontal overflow, no clipped controls, every toggle, chip, sort, window, picker and file action reachable and operable by keyboard with a visible focus ring, and the distinction of FR-58 present in accessible names.

> **NFR-04 — Accessibility:** Every app-owned button and link renders through the canonical `Button` and `Link` primitives; DOM identifiers are index-keyed, never built from species or county names.

> **NFR-05 — Theming:** All color through `var(--sr-*)` tokens in both themes; no hardcoded hex or RGB; badges and status text meet contrast in light and dark.

> **NFR-06 — Security:** The bar-chart parser scans untrusted text and shall be linear in the input, declared in the Architect's schema with its linearity argument per `.claude/rules/security.md`; the header read is bounded by `MAX_HEADER_CHARS`; region codes parsed from filenames and used in URLs pass the same id-shape guard and `encodeURIComponent` as every other eBird id in the app.

> **NFR-07 — Security and pacing:** No eBird call is made without a key; all sweep and pool calls go through the shared eBird gate; a 429 anywhere slows every eBird call on the key; the upstream `Retry-After` is parsed and bounded, never reflected raw; both transports surface a 429 as a 429 on the new route.

> **NFR-08 — Privacy:** The bar-chart file and the per-day cache stay on the device; neither is synced through iCloud; the app makes no request to ebird.org other than the disclosed API calls and opening the bar chart page in the system browser at the user's press.

> **NFR-09 — Compatibility:** The tab, the file import and the sweep work identically on the desktop (Tauri) and web/Pi transports; the new backend route's prefix is added to the Vite proxy; the file kind is written and read through the `storage` seam on both.

> **NFR-10 — Data integrity:** Shared-document writes for the new file kind's metadata join the per-document promise chain; a failed status lookup for any stored file is UNKNOWN, never EMPTY (FR-09, FR-20, FR-40).

> **NFR-11 — Correctness:** The year-round and this-month derivations are pinned by a fixture drawn from the user's real Alameda file, with Lincoln's Sparrow at 3.29% year-round as one row and at least two other species and one zero-sample period as further rows.

## Out of Scope

From the strategic brief:
- Fetching eBird's bar-chart data from ebird.org on the user's behalf (login-gated); deriving a year of frequency from the API (365 per-day calls per county).
- A month picker (probability for any month other than the current one); a probability sort for a county with no file.
- Syncing bar-chart files through iCloud (device-local in v1).
- Non-US counties, states, hotspots, radii or multi-county regions.
- "County lifers" (new to the county, already on the life list) as a fourth type.
- Breeding-season filtering; joining the California Breeding Bird Atlas overlay.
- CSV or clipboard export; per-species month bars; a Targets home-screen widget.
- Re-ranking the Completeness popup's five-species floor from this data.
- Any change to the Calendar, Map Explorer or Breeding Codes surfaces beyond the shared `isWithinWindow` fix.

Added while writing the PRD:
- Showing species that are in the file but not in the county's eBird pool (the pool governs the list; such rows are only counted under FR-35).
- A live count window other than 30 days, or extending the "last report" search beyond the 30 swept days.
- Persisting the chosen sort, window, chips or threshold across relaunches (session state only; the county is the one remembered choice).
- Importing several counties' files in one action, or a file drop zone outside the county's own view.
- Any change to the App Store listing copy or screenshots for this build.

## Open Questions

1. **Exact year-round derivation.** Default assumption: year-round = sum over all 48 periods of (frequency x sample size) divided by the sum of sample sizes, shown as a percent to two decimals. The Architect confirms this reproduces 3.29% for Lincoln's Sparrow against the user's real Alameda file, which the user is asked to supply before the Engineer starts; if it does not, the derivation changes until it does and this document is amended.

2. **This-month derivation.** Default assumption: the sample-size-weighted share across the current month's periods in the file (eBird splits each month into four), to two decimals; if the file holds only some of the month's periods, those present are used.

3. **Today in the 30-day window.** Default assumption: the window is the 30 calendar days ending today (device local date), today re-fetched at most once per visit because it is incomplete; a "complete" cache entry is written only for days before today.

4. **Accepted file extensions.** Default assumption: `.txt` and `.tsv`, since eBird's download is `..._barchart.txt`; the content check, not the extension, decides.

5. **Media chip default.** Default assumption: no chip selected means any missing type qualifies; selecting chips narrows with AND. If the Designer prefers the Map Explorer's exact All / Photo / Audio / Video pills, the semantics stay as stated.

6. **File import with no pool yet.** Default assumption: a file may be added to a county whose pool has not loaded (offline, no key); probability figures appear once the pool arrives, and the file status line (FR-30, FR-35) reports matched rows only once the pool exists ("Species list not loaded yet" until then).

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01: tab exists and behaves like the others | `targets` appears in the tab bar and compact dropdown labeled "Targets" with an icon; can be hidden, shown and dragged in Settings; `TAB_LABELS` carries the label; `tabOrderCoverage` and the tabLayout tests pass |
| QA-02 | FR-02: default placement | A fresh install's tab bar reads ... Species Detail, Calendar, Targets, Multimedia ... |
| QA-03 | FR-03: one-generation migration | A saved layout equal to the 1.0.19-1.0.36 default reads back with Targets after Calendar; a saved custom order (any single swap) reads back verbatim with Targets appended last; the hidden set is unchanged in both; no write occurs at read time; a saved pre-1.0.19 order is returned as saved plus Targets last |
| QA-04 | FR-04, NFR-02: entry chunk | `entryChunk.test.ts` is green; the Targets chunk, maplibre and county geometry are absent from the entry chunk manifest |
| QA-05 | FR-05: picker contents | With the user's backup, the picker lists every US county in it as "County, ST" with a checklist count, ordered by count descending, name tiebreak |
| QA-06 | FR-06: unjoinable county | A fixture county whose State/County key matches no geometry record appears in the picker as unavailable with the stated reason and cannot be selected; it is not omitted |
| QA-07 | FR-07: first-visit default | With no remembered county, the tab opens on the available county with the most checklists |
| QA-08 | FR-08: remembered county | Choose a county, relaunch: same county. Replace the backup with one lacking that county: the tab opens on the new default with no error |
| QA-09 | FR-09, NFR-10: no backup / unknown status | No backup: setup-required guidance, no picker. A rejected backup status lookup: load-error state with retry, not setup guidance |
| QA-10 | FR-10: keyboard picker | With keyboard only, the picker opens, filters by typed "Alam", and selects Alameda County |
| QA-11 | FR-11: shared pool store | The county-species result read by the tab is the `county-completeness-v1` store entry; no second persisted copy of the list exists after a visit |
| QA-12 | FR-12: offline pool render | With a cached county and network disabled and no key, the pool renders with badges and alphabetical/taxonomic sorts before and without any request being issued |
| QA-13 | FR-13: pool fetch status | Uncached county, key present, online: the loading status line appears, one gated county-species request is issued, picker and toggles remain usable during it |
| QA-14 | FR-14: pool unavailable, honest status | Uncached county with no key shows the key status line; uncached county offline shows the offline status line; no spinner in either |
| QA-15 | FR-15: pool fetch failure | A 500 on county-species shows the failure status with retry; the store holds no entry for that county afterwards; retry issues a new request |
| QA-16 | FR-16: Lifer classification | A pool species absent from the user's normalized-name set and species-code set carries Lifer; a species present by name or by code does not |
| QA-17 | FR-16: Media classification | A recorded species lacking any of Photo/Audio/Video in the ML export carries Media naming the missing types; a species with all three does not |
| QA-18 | FR-16: Breeding classification | A recorded species with no observation carrying any `BREEDING_CODES` code (F and H count as codes) carries Breeding; one with a single F does not under Any code |
| QA-19 | FR-17: disjointness | No row carries Lifer together with Media or Breeding; a fixture species missing photo and lacking codes carries both Media and Breeding |
| QA-20 | FR-18: no-type species hidden | A recorded species with full media and a confirmed code never appears with any toggle combination |
| QA-21 | FR-19: toggle semantics | Toggling Lifer off removes every Lifer row and only those; a Media+Breeding species stays with Media off and Breeding on, and with Media on and Breeding off; toggles expose `aria-pressed` |
| QA-22 | FR-20: Media toggle without ML export | No ML export: toggle disabled with the stated reason, counts as off. Rejected stored-file status lookup: the FR-09 load-error state, not the add-the-export reason. ML export stored but unreadable: toggle unavailable with "Couldn't read your ML export" and a working retry |
| QA-23 | FR-21: media chips | No chip: species missing any type shown. Photo+Audio selected: only species missing both remain; a species missing only Photo disappears |
| QA-24 | FR-22: breeding threshold | Species with codes {F}: target under Any code = no; under Confirmed = yes. Species with {NY}: no under both. Default is Any code |
| QA-25 | FR-23: all toggles off | Empty list with exactly the message "Turn on at least one target type" and no other status |
| QA-26 | FR-24: zero targets | A fixture county where the user has recorded, documented and confirmed every pool species shows the no-targets message with the pool size, distinct from the FR-14 not-loaded status |
| QA-27 | FR-25: summary line | The summary counts equal the visible rows and per-type badge counts after each toggle, chip, threshold and window change |
| QA-28 | FR-26: add / replace / remove | No file: Add offered. File present: Replace and Remove offered. Each successful action bumps the bar-chart files epoch exactly once and does NOT bump `filesChanged` and the file is readable back through the `storage` seam on both transports |
| QA-29 | FR-27: refusal is a no-op | A refused import (any reason) leaves the existing file byte-identical, bumps no epoch, and writes nothing |
| QA-30 | FR-28: filename and content refusals | `.csv` and `.zip` refused by name before reading; a 60 MB file refused as too large; a CSV eBird backup renamed `.txt` refused as not a bar-chart file with the stated message; the real Alameda file accepted |
| QA-31 | FR-29: region-code mismatch | `ebird_US-CA-001__...txt` added on Contra Costa County refused with the stated reason naming both; the same file on Alameda accepted; a file named `barchart.txt` accepted on the selected county |
| QA-32 | FR-30: range display | The Alameda file's status line reads "eBird bar chart, Alameda, CA, 1900-2026, Jan-Dec"; a file named `..._2015_2026_3_5_...` reads 2015-2026, Mar-May |
| QA-33 | FR-31: this-month figure | In September, each joined row shows the September figure to two decimals with "%"; a file covering Mar-May shows "Not in file range" in every this-month cell in September |
| QA-34 | FR-32: year-round gating | A full-year file shows year-round figures; a Mar-May file shows the "Needs a full-year file" text in the column and disables the year-round sort |
| QA-35 | FR-33, NFR-11: Alameda acceptance | With the user's real Alameda file imported, Lincoln's Sparrow reads 3.29% year-round; the fixture drawn from that file passes for at least three species and one zero-sample period |
| QA-36 | FR-34: species not in file | A pool species with no file row shows "No eBird figure" in both cells and sorts after every species with a figure under both probability sorts |
| QA-37 | FR-35: unmatched rows surfaced | The status line reports matched, skipped-form and unmatched counts summing to the file's species rows; a fixture with a renamed species and a spuh yields unmatched 1 and skipped 1; the unmatched list names the renamed species |
| QA-38 | FR-36, FR-58: probability labeling | Column headers and sort options for probability contain "%" and "eBird, Alameda, CA, 1900-2026" plus "September" or "year-round", in visible text and accessible name; a 2015-2026 file shows that range instead |
| QA-39 | FR-37: remove and replace | Remove returns the county to the no-file state and the default sort becomes the live sort; Replace with a refused file leaves the previous file and figures intact |
| QA-40 | FR-38: no-file prompt and link | No file: both probability sorts disabled with the stated prompt; the link opens `https://ebird.org/barchart?r={regionCode}` (or the Architect's confirmed county bar-chart URL) through the external-open seam, never `window.open`; the rest of the list works |
| QA-41 | FR-39: no derived document | After import and a visit, no new storage document exists beyond the stored file and its metadata; deleting the file leaves no derived data (or, if a derived document exists, `cacheInventory.test.ts` pairs its purge to a `clearDerived.ts` row) |
| QA-42 | FR-40: unknown file status | A rejected file-status lookup shows "Couldn't check for a bar-chart file" with retry, not the add prompt |
| QA-43 | FR-41: sweep derivation | With a fixture of 30 daily responses, a species present on 12 days shows count 12, last report equal to its most recent day, and that day's place and coordinates |
| QA-44 | FR-42, FR-58: live wording | Live cells read exactly "Reported 12 of the last 30 days" with the date; during the sweep "Reported 5 of 9 days checked so far"; no live cell or header ever contains "%"; accessible name matches |
| QA-45 | FR-43: no key / offline live | No key: live cells "Needs an eBird API key", zero requests. Offline with a cached sweep: cached counts and "Offline; live counts from {date}". Offline with empty cache: "Offline; no live data yet"; no spinner in any case |
| QA-46 | FR-44: per-day durable cache | First visit issues 30 requests; a same-day revisit issues at most 1 (today); the next day issues 1 or 2; a fixture with a malformed cached entry is dropped on load without throwing; the store obeys its entry and payload budgets with FIFO eviction; a 429 or 500 day is never written; `cacheInventory.test.ts` pairs the store's purge to its `clearDerived.ts` row and a backup delete purges it |
| QA-47 | FR-45: progress and progressive fill | The progress line counts up to 30; rows fill in as days land; the pool and badges are visible from the first frame |
| QA-48 | FR-46, NFR-07: 429 during sweep | A 429 with `Retry-After: 4` pauses all eBird starts for 4 s, shows the slow-down line, then resumes; a day failing after bounded retries is reported as unchecked with retry and is not cached; the shared gate's cooldown is observed by a concurrent Map Explorer call |
| QA-49 | FR-47: not reported | A species absent from all 30 days reads "Not reported in the last 30 days" with no date, place or distance |
| QA-50 | FR-48: sort names and tiebreak | The six sort options carry the exact names; under each sort, equal keys fall in pool taxonomic order; Alphabetical orders by displayed common name |
| QA-51 | FR-49: default sort rule | County with a full-year file opens on this-month; the same county after Remove opens on the live sort; a user-chosen Alphabetical persists across a county change while available |
| QA-52 | FR-50: sort availability | No file: two probability sorts disabled with the prompt. Partial-year file: only year-round disabled. No key: live sort disabled with "Needs an eBird API key"; cached partial live data: live sort enabled |
| QA-53 | FR-51: distance anchor and disabled state | With a Default Location, distances are haversine from it; Use my location re-measures from the device; with neither, the sort is disabled with the stated text and cells read "No location set"; a row without coordinates reads "No distance" and sorts last |
| QA-53a | FR-51a: choosing the distance anchor | The anchor name in the status line opens the chooser with all four options. Picking a place in this list re-measures every distance, the distance sort and the slider, and the status line reads "Distances from {Place}, a place in this list."; offline, list places still work and cost no request. A searched place makes exactly one OpenStreetMap request per press of Search and none while typing; a miss shows "No location found" and the anchor is unchanged. With no Default Location the Default item is disabled with "Not set in Settings". The choice survives a county change, nothing about it is written to storage, and after a reload the anchor is the Default Location. The chooser is keyboard operable and Escape returns focus to the trigger |
| QA-54 | FR-52: offline sorts | No key, no file, offline, cached pool: Alphabetical and Taxonomic sort the full list correctly |
| QA-55 | FR-53: window semantics | Full sweep: Week hides every species whose last report is older than 7 days by `isWithinWindow`; a species last reported exactly 7 days ago stays; a species not yet checked in the window's days is not hidden during a partial sweep; Any time hides nothing |
| QA-56 | FR-54: window without live data | No key or offline with empty cache: the window control is disabled with "Needs live eBird data" and no row is hidden |
| QA-56a | FR-54a: distance filter | Default reads "Any distance" and hides nothing. At 5 miles with a complete sweep: a species last reported 4.9 mi from the anchor stays, one at 5.1 mi is hidden, one with no report in the window is hidden. During a partial sweep a species not yet found is not hidden. Combined with Week, both filters apply. No anchor: disabled with the FR-51 reason; no live data: disabled with "Needs live eBird data"; neither hides a row. Arrow keys step through all six stops and the accessible value reads "Within 5 miles" / "Any distance" |
| QA-57 | FR-55: DST fix | `isWithinWindow` with `nowMs` on the day after a spring-forward transition counts a report from 8 calendar days earlier as outside Week and one from 2 calendar days earlier as outside Day, while a report from 7 calendar days earlier stays inside Week; the `widgetRows.parity.test.ts` row reads agreement; Nearby Lifers and Media Targets tests stay green |
| QA-58 | FR-56: row contents | Every row shows name, badges, both probability cells (with a file), live count with date, place and distance, or the specific unavailable text; no cell is ever blank |
| QA-59 | FR-56, NFR-04: names and primitives | Every species name in the tab renders through `<BirdName>`; `tabOrderCoverage.test.ts` passes over the new `.tsx` files; no id or IDREF is built from a species or county name |
| QA-60 | FR-57: row activation | Activating a Media or Breeding row opens Species Detail on that species; a Lifer row is not activatable and shows the name plain with link marks |
| QA-61 | FR-59: responsive during network | Toggling, sorting and changing the window all take effect while a sweep is in flight, with the sweep continuing |
| QA-62 | FR-60: HELP | `docs/HELP.md` has a Targets section with the ebird.org download steps, the probability/live explanation and the device-only statement; no U+2014 in it |
| QA-63 | FR-61: privacy policy | `PRIVACY_POLICY.md` names the per-day county query and the device-only bar-chart file; the text was shown to the user before landing (recorded in the run's decisions) |
| QA-64 | FR-62: website and README | No change to `website/` or `README.md` exists in the diff unless a recorded user approval of the exact sentence precedes it; the App Store listing is untouched |
| QA-65 | FR-63: version and preview | All four version locations agree, CHANGELOG has the entry, and the run record shows the tailnet preview with the real Alameda file happened before the deploy gate |
| QA-66 | NFR-01: cost | Network log shows 30 gated requests on first visit, 0 to 1 on a same-day revisit; requests are at least 150 ms apart at their starts |
| QA-67 | NFR-03: 320px and 200% | At 320px wide and 200% text scale, no horizontal scroll, every control reachable by Tab with a visible focus ring, no clipped text in badges, sort names or status lines |
| QA-68 | NFR-05: theming | Stylesheet scan finds no hex or RGB literal in the tab's components; badges and status text pass contrast in both themes |
| QA-69 | NFR-06: linear parser | The Architect's schema declares the bar-chart scan with its linearity argument; a doubling-input timing check on hostile inputs (long lines, no line breaks, repeated tabs) grows linearly with an explicit `testTimeout` |
| QA-70 | NFR-06: region code in URLs | The bar-chart-page link and every route parameter carrying a region code pass the id-shape guard and `encodeURIComponent`; a filename with a malformed code is refused, not reflected |
| QA-71 | NFR-08: privacy | No request leaves the app for `ebird.org` other than the disclosed API routes; the bar-chart page opens only on the user's press; the file and the cache are absent from the iCloud sync document set |
| QA-72 | NFR-09: both transports | The import, the file status line, the pool and the sweep produce identical results on the Tauri and web/Pi transports over the same fixtures; the new route prefix is in `vite.config.ts`'s proxy; the backend route test and the Tauri service test both cover the 429 mapping |
| QA-73 | NFR-10: serialized metadata writes | An interleaving test of two concurrent metadata writes (the new file kind and another document) shows both survive; `storageWriteSerialization.test.ts`-shaped |
