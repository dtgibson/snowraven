# PRD: Hotspot Share Stat
**Feature:** hotspot-share-stat
**Date:** 2026-11-06
**Revised:** 2026-11-06, for `decisions.md` section 1 (the hotspot answer is persisted per region after its first lookup; the strategic brief's revised computation, Success Criteria, Scope, Out of Scope and Key Decisions govern)
**Stage:** 2, The Planner
**Source:** strategic-brief.md (approved, revised)

## Feature Overview

One new statistic in the Statistics tab's **Geographic Stats** section, placed directly above "Top locations by checklists": a two-segment share bar with counts showing how many of the user's checklists were submitted at public eBird hotspots versus personal locations, classified by the region-scoped hotspot Set the section already uses to draw hotspot links. That Set is now persisted per region after its first lookup, so a later launch shows the share and the links with no request to eBird, and the honest third state (checklists whose region has not answered) is confined to a region's first-ever lookup.

## User Stories

> **US-01**: As a birder with years of checklists, I want to see what share of my checklists were submitted at public hotspots, so that I can tell how much of my birding is hotspot birding versus my own patches and one-off pins.

> **US-02**: As a user reading the Geographic Stats section, I want the hotspot share to agree with the linked and plain location names beneath it, so that the number explains the links rather than contradicting them.

> **US-03**: As a user whose eBird key is not entered, I want the block to tell me it needs the key and take me to Settings, so that I know why there is no number and how to get one.

> **US-04**: As a user whose regions are being looked up for the first time, or whose first lookup failed or was rate-limited, I want the block to say how many checklists are not yet classified, so that I never read an unresolved state as "0% hotspots".

> **US-05**: As a user who toggles "Count all forms", I want the hotspot share to stay put, so that a species-counting setting does not appear to change where I bird.

> **US-06**: As a screen-reader or large-text user, I want the share stated as a sentence with the counts, so that the information does not live only in the bar's geometry or colour.

> **US-07**: As a user opening the app again, online or offline, I want the share and the hotspot links to appear from what the app already learned, with no new request to eBird, so that the app does not burden eBird's servers and the statistic is there when I have no signal.

> **US-08**: As a user who replaces my backup with a newer export, I want the app to ask eBird only about a region it has not seen before, so that every upload does not start the lookups over.

## Functional Requirements

### Placement and visibility

> **FR-01**: The app shall render the hotspot share block inside the Geographic Stats section of the Statistics tab, directly above the "Top locations by checklists" sub-label, with a sub-label of its own ("Checklists at hotspots") and the section's standard divider beneath it.

> **FR-02**: The app shall render the block only when the export contains at least one checklist (one or more distinct Submission IDs). With zero checklists the block, its sub-label and its divider shall be omitted entirely (no empty-state box).

### Denominator and classification

> **FR-03**: The denominator shall be the number of distinct Submission IDs in the loaded eBird backup, computed from the unfiltered observations (the same per-checklist rows the Projects section uses), and shall not change when "Count all forms" is toggled. A checklist whose only rows are non-countable forms still counts as one checklist.

> **FR-04**: Each checklist shall be classified into exactly one of three states:
> - **hotspot**: its Location ID is a shape-valid eBird location id (`L` followed by digits) present in the current public-hotspot Set (the union of the persisted per-region answers and whatever this session has fetched, FR-22);
> - **personal**: its Location ID is not in the Set **and** the checklist's region (its `stateProvince` code) has answered. A region has answered when a persisted entry exists for it (fresh or aged past the TTL) or this session's lookup for it has succeeded;
> - **unclassified**: its region has never answered (no persisted entry, and the first lookup is pending, in a re-ask round, failed, or rate-limited past its re-ask rounds), or the checklist carries no askable region code.
>
> `hotspot + personal + unclassified` shall equal the denominator. With persistence the unclassified state is confined to a region's first-ever lookup: a fresh install, a cleared store, a region the export newly introduces, or an entry dropped by validation or eviction (FR-29, FR-30).

> **FR-05**: The classification shall use the existing hotspot membership test and the existing region-scoped Set that the section's `HotspotLink`s already read, so that every top location rendered as a hotspot link counts its checklists as hotspot, and every top location rendered plain in an answered region counts them as personal. The links and the bar read the same Set, persisted or fetched, so they carry the same lag. No other source of hotspot status shall be consulted.

> **FR-06**: A region that answered with an empty hotspot list shall count as **answered**: its checklists classify as personal, never as unclassified. An empty answer is persisted like any other (FR-22), so the region stays answered on later launches.

> **FR-07**: The hotspot-set seam shall expose, beside the Set and moved by the same change epoch, a per-region resolution summary that distinguishes **pending** (first-ever ask, or a re-ask round of a never-answered region, not yet settled), **answered** (a persisted entry exists, fresh or stale, or this session's lookup succeeded; a TTL refresh in flight, failed or rate-limited does not leave this state), and **unanswered** (no persisted entry, and the lookup failed or was rate-limited with no re-ask round left). Existing consumers of the Set shall be unchanged. An invalidation (eBird key or file save, iCloud arrival, a new region list) rebuilds the Set: a region with a persisted entry reads answered from the rebuild's first read of the document, and only a region with no persisted entry resets to pending until its new answer lands. A clear (FR-26) purges the document, after which every region is pending again.

> **FR-08**: When a re-ask round adds hotspot ids or settles a region, or a TTL refresh replaces a region's stored list, the block on the mounted Statistics tab shall update with no user action, through the existing hotspot-set change epoch.

### Persistence

> **FR-22**: The app shall persist each region's hotspot answer after its first successful lookup: one entry per region code holding the shape-valid location ids eBird returned (an empty list included) and the time the answer was fetched, written through the `storage` seam in the project's long-TTL durable cache shape (`lib/countyCompletenessCache.ts` as the reference). The Set the hook returns shall be the union of the persisted entries and this session's fetches. An error of any kind, a 429 included, shall write nothing: no entry, no placeholder, no 429 body.

> **FR-23**: On a launch where every region in the backup has a persisted entry within the TTL, the app shall issue no `/map/hotspot-region` request, and the block shall render the full bar (FR-13) and the section its hotspot links as soon as the persisted document has been read (a local read, not a network round trip). This holds online and offline alike.

> **FR-24**: When the backup is replaced by one that introduces a region with no persisted entry, the app shall request that region and no other; every region with a persisted entry is read from the document. Replacing the backup shall not purge, truncate or rewrite the persisted entries of regions the new backup no longer contains; they stay until the TTL refresh or eviction (FR-30) touches them.

> **FR-25**: A region whose persisted entry is older than the TTL shall be asked again with one request on the next build of the Set (a launch or an invalidation), never on a timer and never more than once per build. While that refresh is in flight the region stays answered and its checklists classify against the stored list. A refresh that succeeds replaces the entry (list and fetch time) and advances the epoch; a refresh that fails or is rate-limited writes nothing, leaves the stored entry and the answered state in place, and a 429 follows the existing re-ask rounds. Offline, a stale entry is served with no request attempted. The TTL is a named constant of the order of the reference store's 30 days; the Architect fixes the number.

> **FR-26**: "Delete all data" in Settings and both iCloud clear paths shall remove the persisted hotspot document through the one teardown in `lib/clearDerived.ts` (`purgeDerivedOnClear`), with a production purge export registered there. After a clear, the next backup starts with every region pending and asks again. Replacing the backup, saving an eBird key, and an iCloud arrival shall NOT purge the document (purge on clear only, never on replace).

> **FR-27**: The persisted hotspot document shall not be carried by iCloud Sync: no new `ITEM_SUBDIRS` kind, no Rust twin. Each device pays one request per region once.

> **FR-28**: The durable store shall be the one caching layer for `/map/hotspot-region`: the path leaves `CACHED_GET_PATHS` in `lib/transport.ts` and stays in `EBIRD_GATED_PATHS`, so the eBird gate keeps owning pacing and the store owns TTL, in-flight dedupe and eviction. Two concurrent reads of the same region within one session share one in-flight request.

> **FR-29**: On load, every persisted entry shall be validated (region code shape, id shape per id, a finite fetch time, bounded list length); a malformed entry is dropped, never thrown, and a dropped entry's region is treated as never answered and is asked again. A document that does not parse is treated as empty.

> **FR-30**: The store shall hold at most a strict number of region entries and a serialized payload budget, both real numbers the Architect sets (NFR-09), with eviction when either is exceeded. An evicted region is treated as never answered and is asked again on the next build, exactly as a newly introduced region is; eviction never changes a classification already rendered until the next build.

### Display states

> **FR-09 (no key)**: When the app knows no eBird API key is stored, the block shall render the Projects section's no-key idiom: the sentence "Checklists at hotspots cannot be counted without an eBird API key." followed by the inline "Add a key in Settings" control that navigates to Settings, with no bar, no counts and no percentage. This state takes precedence over every resolution state, including one where every region has a persisted answer.

> **FR-10 (key status unknown, document not yet read, or first lookups pending)**: While the key status is still being read, or the persisted document has not yet been read, or while any checklist is unclassified and at least one region is pending its first-ever lookup, the block shall render a status sentence and no bar and no percentage. Default copy: "Checking which locations are public hotspots. {u} of {m} checklists not yet classified." When some checklists are already classified the sentence shall also give the counts so far as counts, never as percentages: "So far {h} at hotspots and {p} at personal locations." On a warm launch (FR-23) this state lasts only for the local document read.

> **FR-11 (settled with unclassified checklists, offline)**: When the app is offline, no region is pending, and at least one checklist is unclassified because its region has never answered, the block shall render: "Offline, so {u} of {m} checklists could not be classified yet." plus the counts-so-far sentence from FR-10 when any are classified; no bar, no percentage. Two offline cases are distinguished by what the document holds, not by connectivity:
> - **offline before any answer** (a fresh install or a cleared store, no persisted entry for any region): every checklist with an askable region is unclassified, u equals m less any no-region-code rows, and no counts-so-far sentence renders;
> - **offline after an answer**: every region with a persisted entry, fresh or stale, is answered and its checklists are classified; only a never-answered region's checklists are unclassified. When every region has an entry, FR-13 renders in full and no offline sentence appears.

> **FR-12 (settled with unclassified checklists, online)**: When no region is pending, at least one checklist is unclassified, and the app is online, the block shall render: "eBird did not answer for {k} of your {r} regions, so {u} of {m} checklists could not be classified." plus the counts-so-far sentence from FR-10 when any are classified; no bar, no percentage. k counts only never-answered regions; a region whose TTL refresh failed is answered and is not counted. When the unclassified checklists come only from rows with no askable region code (k = 0), the sentence shall instead read "{u} of {m} checklists carry no region code and could not be classified."

> **FR-13 (fully classified)**: When every checklist is classified (unclassified = 0), the block shall render the share bar, the two percentages, and the counts sentence "{h} of {m} at hotspots, {p} at personal locations." This includes the all-hotspot case (full bar, "{m} of {m} at hotspots, 0 at personal locations") and the none-at-hotspots case (empty hotspot segment, "0 of {m} at hotspots"), each a real rendering, not an empty state. A classification served from a stale persisted entry renders this state without any age or staleness marker.

### Numbers and rounding

> **FR-14**: The two whole percentages shall come from one rounding: the hotspot percentage is `round(h / m * 100)` and the personal percentage is `100` minus it, so the pair reads as a partition of 100%. Bar segment widths shall use the unrounded fractions.

> **FR-15**: A nonzero count whose percentage rounds to 0 shall display as "<1%" (via the existing lone-share formatter) and its complement shall display as ">99%"; a zero count shall display as "0%" and its complement as "100%". No nonzero count shall ever display as "0%".

> **FR-16**: Every count in the block shall be formatted with the app's standard number formatter (thousands separators), and every count-bearing sentence shall agree in number ("1 checklist", "2 checklists"; "1 region", "2 regions").

### Copy

> **FR-17**: Every user-facing string the block renders (sub-label, the sentences in FR-09 to FR-13) shall live in one copy module, generated from the block's state so that the existing plural-agreement and em-dash sweeps run over the full corpus of reachable states. No count-bearing string shall be built inline in the component.

> **FR-18**: `docs/HELP.md`'s Geographic Stats paragraph shall gain one sentence naming the statistic in the same change. Default: "A share bar above the top-location lists shows how many of your checklists were submitted at public eBird hotspots versus personal locations; it needs your eBird API key, because the export itself does not say which locations are hotspots."

### Accessibility and presentation

> **FR-19**: The bar shall be `aria-hidden`; the sentence beside it shall carry every figure the bar shows (both counts, the denominator and both percentages), so the information is complete without the bar.

> **FR-20**: The percentages shall render as surface text beside or above the bar, never as text inside a bar segment (the F032 pattern the Complete-checklists bar follows).

> **FR-21**: The "Add a key in Settings" control shall be the app's native `Button` primitive, reachable by Tab, and shall call the tab's existing go-to-Settings route.

## Non-Functional Requirements

> **NFR-01 (Network posture):** The feature adds no third-party request, no new endpoint or host, and no request moved between components, on any platform (web/Pi, Mac, Windows, iPhone, iPad, Android). Its only network dependency is the region lookup the Statistics tab already issues for its hotspot links, with the user's own eBird key. The change in posture is downward: per build of the Set, one request per region with no persisted entry, plus one request per region whose entry has aged past the TTL, and zero requests on a launch whose regions all hold an entry within the TTL. The eBird pacing contract and the 429 re-ask rounds are unchanged. The Tauri CSP and the `http:allow-fetch` scope are unchanged. On web/Pi the persisted document rides the `storage` seam to the user's own server, as the reference store does; that is the existing settings route, not a new request kind. Requests a system component makes from the app's process are not affected because none are added.

> **NFR-02 (Scan declaration):** Two scans, both declared in the Architect's schema with their linear cost per draw and per re-draw, per `.claude/rules/security.md`, naming the glob the build adds: (a) the classification, one linear pass over the parsed per-checklist rows on the main thread, memoised on the checklist array, the Set and the resolution summary, applying the existing location-id shape test per checklist; a re-ask round or a TTL refresh causes one re-draw; (b) the load-path validation of the persisted document, one pass over its entries and their ids with the id shape test per id, bounded above by the payload budget and the entry cap, run once per document read. No new regex and no other scan over user-file or persisted text.

> **NFR-03 (Performance):** For a 150,000-row export (the current upload-cap scale) the classification pass shall not be measurably slower than the Projects section's existing per-checklist derivation at the same scale, and it shall run at most once per change of its memo inputs. Reading the persisted document and building the Set from it shall be linear in the number of persisted ids and bounded by the payload budget, so a warm launch's cost is one bounded local read.

> **NFR-04 (Accessibility):** WCAG 2.1 AA at 320px width and 200% in-app text scale in both themes: the block wraps rather than overflows, the sentence and percentages meet AA contrast on the section surface, and the bar needs no AA on-fill text because it carries none.

> **NFR-05 (Theming):** Every colour via `var(--sr-*)` tokens already defined in both themes; the two segments use tokens already in use in the Statistics tab's share bars. No new tokens.

> **NFR-06 (Copy):** No em dash (U+2014) in any user-facing string or in the Help sentence; American spelling.

> **NFR-07 (DOM identity):** The block introduces no DOM id or ARIA IDREF; if one is ever needed it is keyed on an index, never on file content.

> **NFR-08 (Published copy):** README and website are not changed and no sentence is proposed for them. The only user-approval stop is the Fastlane changelog text at release.

> **NFR-09 (Settings-route budget):** A durable store inside a settings document is capped by the web/Pi settings route (`_MAX_BYTES`, 16 MiB, `backend/routers/settingskv.py`); past it the write fails silently with a swallowed 413. The store's entry cap and payload budget shall be real numbers the Architect sets, with the worst-case document proven under the route's limit: the worst case is built from the validator's largest admitted value in each dimension (region code length, id length, ids per region, number of regions), and a region's list can run to tens of thousands of ids, so the per-region list bound is a measured figure, not a guess. `settingsRouteBudget.test.ts` gains a `describe` for this store that builds that document through the store's own load path (its sanitizer) and asserts it fits. If the worst case cannot fit beside the other stores, the store moves to its own document and owes an ordered writer of its own.

> **NFR-10 (Clear registry):** The store registers in `lib/clearDerived.ts` because its KEY SET is the list of regions read off the user's export; `cacheInventory.test.ts` gains the pairing row. The purge is a production export, never a test-only reset; it cancels any pending flush, stops a parked load from adopting the old document, and refuses a write from work begun before the purge, with the purge generation captured at the fetch chokepoint before the request. `clearDerived.ts` keeps reaching the store through `import()`, so the store adds nothing to the entry chunk beyond what `entryChunk.test.ts` allows.

> **NFR-11 (Trust boundary):** The persisted document is a runtime cache, not a build-time asset, so it is validated on every load (FR-29); nothing from it is trusted by its presence. The in-memory mirror is the only reader the classification sees.

> **NFR-12 (Data lifetime):** A persisted hotspot answer is eBird's public data, re-derivable on any device for one request per region; it is not synced (FR-27) and it is not exported.

## Out of Scope

- Any new eBird request, endpoint, host, or per-location lookup (`ref/hotspot/info/{locId}` was considered and rejected).
- Inferring hotspot status from the file alone (visit frequency, name heuristics).
- A per-location breakdown (which personal locations, a ranked list of hotspots); the top-location lists beside it already do that.
- A share of distinct locations ("how many of your places are hotspots") as a second figure.
- A species or lifer split by hotspot versus personal.
- Changing how `HotspotLink` or the Map Explorer classify hotspots, or changing the eBird pacing, the 429 re-ask schedule or retry policy. The answer's lifetime changes (it is persisted); its membership test, its source endpoint and its pacing do not.
- Syncing the persisted hotspot answer through iCloud Sync (no new `ITEM_SUBDIRS` kind, no Rust twin).
- A per-launch, on-demand or manual "refresh hotspots" control; the TTL is the only refresh.
- Any age, "last checked" or staleness indicator in the block or beside the links.
- Moving any other `CACHED_GET_PATHS` entry to a durable store; only `/map/hotspot-region` leaves.
- Showing the statistic on the Calendar tab or any zero-network surface.
- A retry control inside the block (the Projects "Try again" idiom); re-asking stays with the existing hotspot-set schedule, the TTL and Settings saves.
- A partial-denominator bar (a percentage over only the classified checklists while some are unclassified).
- A live region or announcement for the block's state changes.
- README and website copy.

## Open Questions

Each is resolved by default in this document; the defaults are flagged for the user at the gate.

1. **Should a bar render over the classified subset while some checklists are unclassified?** Default: no. The bar and percentages appear only when every checklist is classified; until then the block gives counts so far as counts (FR-10 to FR-12). With persistence this is a first-lookup-only condition, so the stricter reading costs little.

2. **Should the block be a live region, as the Projects status row is?** Default: no. A re-ask round or a TTL refresh can settle minutes later while the user is reading elsewhere on the tab, and the block is reference material, not an event; it reads in document order.

3. **Exact wording of the five sentences and the sub-label.** Defaults are given in FR-09 to FR-13 and FR-01. The Designer may refine wording provided the copy module, this PRD's QA rows and the Help sentence move together, with no em dash and the same facts in each sentence.

4. **TTL length.** Default: the reference store's 30 days, as one named constant with its unit conversion in the source. The Architect fixes the number; the accepted lag (a hotspot promoted or demoted since the last fetch) is the TTL, and the links beside the bar carry the same lag.

5. **Does an eBird key save re-ask regions that already have a persisted answer?** Default: no. eBird's public hotspot list does not depend on whose key asked, so a key save re-arms only regions with no persisted entry (FR-07); a persisted region is re-asked only by the TTL.

6. **Should a persisted entry for a region the current backup no longer contains be removed on replace?** Default: no (FR-24). It stays until the TTL or eviction reaches it, so a user who swaps between two exports pays for each region once. The entry cap bounds what this can accumulate.

7. **Should a stale (past-TTL) answer show any marker?** Default: no (FR-13). The links beside the bar have never shown one, and the two read the same Set.

8. **Where does the document live on web/Pi?** Default: the settings route through the `storage` seam, as the reference store does (NFR-09). The Architect moves it to its own document only if the proven worst case does not fit beside the other stores.

9. **What renders during the local document read on a warm launch?** Default: the FR-10 pending sentence, for the duration of that read only (no network). The Designer may choose to hold the block's previous content instead if the read is visibly brief; the sentence is the fallback the QA rows assert against when the read has not settled.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Placement (FR-01) | In a render with a loaded backup, a key, and all regions answered, the sub-label "Checklists at hotspots" appears inside the Geographic Stats section card and precedes "Top locations by checklists" in DOM order, with a divider between them. |
| QA-02 | Zero checklists (FR-02) | With an export of zero checklists the Geographic Stats section contains no "Checklists at hotspots" sub-label and no hotspot-share sentence. |
| QA-03 | Denominator (FR-03) | For a fixture of 4 checklists where one checklist's only row is a spuh, the sentence reads "... of 4 ..." with "Count all forms" off and still "... of 4 ..." after toggling it on. |
| QA-04 | Partition (FR-04) | For every unit fixture (mixed, all hotspot, none, unresolved, stale-persisted) the helper returns `hotspot + personal + unclassified === total`. |
| QA-05 | Hotspot classification (FR-04, FR-05) | Fixture: 3 checklists in region US-MN at ids L1, L2, L3; Set = {L1, L2}; US-MN answered. Helper returns hotspot 2, personal 1, unclassified 0. |
| QA-06 | Invalid id shape (FR-04) | Fixture: a checklist with Location ID "junk" in an answered region returns personal; with Location ID "L1" while the Set is {L1} returns hotspot. |
| QA-07 | Agreement with links (FR-05) | In the same component render, every top location drawn as a `HotspotLink` anchor belongs to a checklist counted as hotspot, and every plain top location in an answered region belongs to one counted as personal (fixture-driven assertion over `geo.topLocations`); the assertion holds equally when the Set came from the persisted document with no fetch. |
| QA-08 | Answered-and-empty (FR-06) | Fixture: region US-ND answered with an empty list; its 2 checklists return personal 2, unclassified 0; the component renders the bar with "0 of 2 at hotspots"; after a simulated relaunch the document holds US-ND with an empty list and the region still reads answered with no request. |
| QA-09 | Resolution summary shape (FR-07) | With an empty document: after `getHotspotSet` is called and before any region settles, every region reads pending; after a region's list arrives it reads answered; after a region fails with a non-429 error it reads unanswered; after a 429 with re-ask rounds remaining it reads pending; after the final round still 429 it reads unanswered. With a persisted entry for the region, fresh or past the TTL, it reads answered throughout, including while its refresh is in flight, after the refresh fails, and after the refresh is rate-limited. |
| QA-10 | Summary reset on invalidation (FR-07) | After `invalidateHotspotSet()` every region without a persisted entry reads pending and the epoch has advanced, while every region with a persisted entry reads answered on the rebuild's first read; after a new backup with a different region list the summary covers only the new regions. |
| QA-11 | Existing consumers unchanged (FR-07) | `useHotspotSet` still returns `{ set, isHotspot }` with the same semantics; `useHotspotSet.test.tsx` and `HotspotLink.test.tsx` pass unmodified; in `hotspotSet.test.ts` no assertion is weakened except ones that asserted a per-launch re-fetch, each named in the Engineer's notes and replaced by a persistence row. |
| QA-12 | Re-ask round updates the mounted tab (FR-08) | With the Statistics tab mounted in the pending state for US-WI (429, no persisted entry), a resolved re-ask round that answers US-WI causes the block to re-render from the pending sentence to the full bar with no user action. |
| QA-13 | No key (FR-09, FR-21) | With `hasEbirdKey === false` the block renders exactly the no-key sentence and a `Button` reading "Add a key in Settings"; clicking it calls the go-to-Settings route; no bar, no "%" text, no counts in the block. |
| QA-14 | No key precedence (FR-09) | With `hasEbirdKey === false` and every region unanswered, the no-key sentence renders, not the FR-11 or FR-12 sentence; with `hasEbirdKey === false` and every region holding a persisted entry, the no-key sentence still renders and no bar. |
| QA-15 | Pending (FR-10) | Fixture: 10 checklists, US-MN answered (4 hotspot, 3 personal), US-WI pending its first lookup (3 checklists). The block renders "Checking which locations are public hotspots. 3 of 10 checklists not yet classified." and "So far 4 at hotspots and 3 at personal locations." with no bar and no "%" text. |
| QA-16 | Key status unknown (FR-10) | With `hasEbirdKey === null` the block renders the FR-10 pending sentence and no bar. |
| QA-17 | Offline, settled, unclassified (FR-11) | With `online === false`, no region pending, US-MN persisted and US-WI never answered, 3 of 10 unclassified: the block renders "Offline, so 3 of 10 checklists could not be classified yet." and the counts-so-far sentence, with no bar and no "%" text. |
| QA-18 | Online, settled, unanswered region (FR-12) | With `online === true`, 1 of 2 regions never answered and 3 of 10 unclassified, the block renders "eBird did not answer for 1 of your 2 regions, so 3 of 10 checklists could not be classified." with no bar and no "%" text; a region whose TTL refresh failed is not counted in k. |
| QA-19 | No-region-code rows (FR-12) | Fixture: 2 checklists with an empty `stateProvince`, all real regions answered. The block renders "2 of {m} checklists carry no region code and could not be classified." and no bar. |
| QA-20 | Fully classified, mixed (FR-13, FR-14) | Fixture: 1,234 hotspot of 3,300. Sentence "1,234 of 3,300 at hotspots, 2,066 at personal locations."; percentages "37%" and "63%"; the hotspot segment's width style equals `37.39…%` (unrounded). |
| QA-21 | All hotspot (FR-13) | Fixture: 5 of 5 hotspot. Bar renders, percentages "100%" and "0%", sentence "5 of 5 at hotspots, 0 at personal locations." |
| QA-22 | None at hotspots (FR-13) | Fixture: 0 of 5 hotspot, all regions answered. Bar renders, percentages "0%" and "100%", sentence "0 of 5 at hotspots, 5 at personal locations." |
| QA-23 | One rounding (FR-14) | Fixture: 1 hotspot of 3 (33.33%) displays "33%" and "67%"; 2 of 3 displays "67%" and "33%"; for every generated (h, m) pair with both counts nonzero and neither rounding to 0, the two displayed integers sum to 100. |
| QA-24 | Rounds-to-zero (FR-15) | Fixture: 1 hotspot of 1,000 displays "<1%" and ">99%"; 999 of 1,000 displays ">99%" and "<1%"; no state ever renders the string "0%" for a nonzero count. |
| QA-25 | Number formatting and agreement (FR-16, FR-17) | Over the generated corpus of every reachable state with counts 0, 1, 2 and 1,234: no string matches `/\b1 [a-z]+s\b/`, every count of 1,234 renders as "1,234", and no string contains U+2014. |
| QA-26 | Copy module (FR-17) | Every user-facing string rendered by the block resolves to an export of one copy module; the component source contains no inline count-bearing template string for the block. |
| QA-27 | Help sentence (FR-18, NFR-06) | `docs/HELP.md`'s Geographic Stats section contains one sentence naming the hotspot share, mentioning the eBird API key, with no em dash. |
| QA-28 | Bar hidden from AT (FR-19) | The bar container carries `aria-hidden="true"`, and the accessible text of the block contains both counts, the denominator and both percentages. |
| QA-29 | Percentages outside the bar (FR-20) | No text node is a descendant of the `aria-hidden` bar container; the "%" strings are rendered in surface text outside it. |
| QA-30 | Network posture (NFR-01, FR-28) | With a transport spy and an empty document, rendering the Statistics tab issues exactly one `/map/hotspot-region` per distinct region and nothing new; `/map/hotspot-region` is absent from `CACHED_GET_PATHS` and present in `EBIRD_GATED_PATHS`; `tauriCsp.test.ts` and `tauriHttpScope.test.ts` pass with no capability or CSP change in the diff. |
| QA-31 | Scans declared (NFR-02) | The Architect's schema names both the classification loop and the load-path validation with their linear cost per draw and per re-draw and the `security.md` glob, and the security review verifies each against its source (one pass, O(1) membership, no nested scan). |
| QA-32 | Performance (NFR-03) | On a generated 150,000-row export the helper completes a pass in time linear with row count (doubling 75k to 150k grows roughly 2x, measured through `cpuTiming.ts`), and a render with unchanged inputs does not call the helper again. |
| QA-33 | Responsive and AA (NFR-04, NFR-05) | In the built app at 320px and 200% text in both themes, the block's content box does not exceed its section's content box and `document.scrollWidth` equals the viewport width; every colour in the block's styles resolves from a `--sr-*` token; sentence and percentage text contrast is at least 4.5:1 on the section surface. |
| QA-34 | Partition invariant under rounding (FR-14, FR-15) | For every generated (h, m) pair, exactly one of the following holds for the displayed pair: both are integers summing to 100; one is "<1%" and the other ">99%"; or one is "0%" and the other "100%". |
| QA-35 | First lookup persisted (FR-22) | With an empty document, after US-MN's lookup succeeds with ids {L1, L2}, the document read back through the storage seam holds one entry for US-MN with exactly {L1, L2} and a finite fetch time; after US-ND answers with an empty list the document holds US-ND with an empty list. |
| QA-36 | No request on a warm launch (FR-23) | With a document holding entries within the TTL for every region in the backup, a fresh module instance plus a transport spy: building the Set and rendering the Statistics tab issues zero `/map/hotspot-region` requests, every region reads answered, the block renders the full bar, and the top locations in the Set render as `HotspotLink` anchors. The same assertion holds with `online === false`. |
| QA-37 | Offline before any answer versus after (FR-11) | With `online === false` and an empty document, 10 checklists across 2 regions render "Offline, so 10 of 10 checklists could not be classified yet." with no counts-so-far sentence; with the same fixture and both regions persisted, the FR-13 bar renders and no offline sentence appears. |
| QA-38 | New-region-only request on replace (FR-24) | With US-MN persisted, replacing the backup with one containing US-MN and US-WI issues exactly one request, for US-WI; US-MN reads answered from the document throughout. |
| QA-39 | Replace keeps entries (FR-24, FR-26) | With US-MN and US-WI persisted, replacing the backup with one containing only US-MN, then saving an eBird key, then simulating an iCloud arrival: the document still holds both entries unchanged and no purge ran. |
| QA-40 | TTL refresh issues one request and serves stale (FR-25) | With US-MN persisted at fetch time older than the TTL, building the Set issues exactly one request for US-MN; before it settles the region reads answered, the Set holds the stored ids and the block renders the FR-13 bar. |
| QA-41 | Stale served on a failed refresh (FR-25) | Continuing QA-40: when the refresh rejects with a non-429 error, the document entry is byte-identical to before, the region still reads answered, the bar still renders from the stored ids, and no second request is issued in that build. |
| QA-42 | Stale served on a rate-limited refresh (FR-25, FR-22) | Continuing QA-40: when the refresh returns a 429, the document entry is unchanged, no 429 body or marker is written anywhere in the document, the region reads answered throughout the re-ask rounds, and a later round that succeeds replaces the entry. |
| QA-43 | Successful refresh replaces the entry (FR-25, FR-08) | Continuing QA-40: when the refresh resolves with {L1, L9}, the document entry for US-MN holds {L1, L9} with a newer fetch time, the epoch has advanced, and the mounted block re-renders with the new counts with no user action. |
| QA-44 | Offline stale read, no request (FR-25) | With US-MN persisted past the TTL and `online === false`, building the Set issues zero requests and US-MN reads answered from the stored list. |
| QA-45 | Cleared on delete and on iCloud clear (FR-26, NFR-10) | After `purgeDerivedOnClear()` (as called by Settings' delete and both iCloud clear paths) the document is absent through the storage seam, the in-memory mirror is empty, every region reads pending on the next build, and that build requests every region. `cacheInventory.test.ts` pairs the store's exported purge to a registry row. |
| QA-46 | Purge supersedes in-flight work (NFR-10) | A lookup started before `purgeDerivedOnClear()` that resolves after it writes nothing to the document, and a parked load started before the purge does not re-adopt the old document. |
| QA-47 | Error never persisted (FR-22) | After a lookup rejects (network error, 5xx, bad key) the document holds no entry for that region, and the next build asks again. |
| QA-48 | Malformed entry dropped, never thrown (FR-29) | A document containing an entry with an invalid region code, an id that fails the shape test, a non-finite fetch time, and a list past the bound loads without throwing; the malformed entries are absent from the mirror, the valid ones are present, and each dropped region is asked again on the next build. An unparseable document loads as empty. |
| QA-49 | Entry cap and payload budget (FR-30) | At `cap + 1` entries, and separately at a payload one id past the budget, the store evicts to within both bounds, the evicted region reads pending on the next build and is requested, and the retained regions are unaffected. The cap and budget are the Architect's numbers, read from the store's exported constants, never restated in the test. |
| QA-50 | Settings-route budget (NFR-09) | `settingsRouteBudget.test.ts` has a `describe` for this store whose worst-case document is built through the store's own load path from the validator's largest admitted value in each dimension, serialises under the route's `_MAX_BYTES`, and whose each-dimension row asserts the bounds against the exported constants. |
| QA-51 | In-flight dedupe (FR-28) | Two concurrent reads of US-MN in one session with no persisted entry issue exactly one request and both resolve to the same list. |
| QA-52 | Not synced (FR-27) | `ITEM_SUBDIRS` in the iCloud seam and its Rust twin are unchanged in the diff, and `entryChunk.test.ts` passes. |
| QA-53 | Key save keeps persisted regions answered (FR-07, Open Question 5) | With US-MN persisted within the TTL and US-WI not, an eBird key save followed by a rebuild issues exactly one request (US-WI) and US-MN reads answered from the first read. |
