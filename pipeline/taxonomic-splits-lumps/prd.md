# PRD - Taxonomic Splits and Lumps

**Feature:** taxonomic-splits-lumps
**Date:** 2026-09-30
**Stage:** 2 - The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

A "Splits and lumps" view on Species Detail, beside the "Subspecies and forms" control: a list of every species in the loaded eBird backup that eBird split or lumped in a covered annual taxonomy update, and, for the selected species, a dated lineage section showing what it was, what it became, which update did it, and how many of the user's own reports sit on each branch, partitioned by whether they predate the update. Everything derives from a bundled build-time history asset and the already-parsed backup, offline and without a key.

## User Stories

> **US-01** - As a birder looking at my own history, I want a list of every species in my backup that eBird has split or lumped, with the year it happened, so that I can see at a glance which of my species eBird has renamed on my behalf.

> **US-02** - As a birder browsing that list, I want picking a species to select it on Species Detail and bring me to its lineage, so that I can move from the overview to the full record without retyping the name.

> **US-03** - As a birder viewing one affected species, I want to see the before name(s), the after name(s), whether it was a split or a lump, and the month and year of the update, so that I understand what eBird did to this species and when.

> **US-04** - As a birder with old records, I want each branch to show how many of my reports carry that name, separated into reports dated before the update (assigned by eBird) and reports dated after it (recorded by me under the current name), so that I can tell which of my records eBird reassigned and which I made myself.

> **US-05** - As a birder whose backup was exported before an update, I want the section to recognise my pre-update name, show it on the before side, and tell me the export predates that update, so that nothing is silently mismatched.

> **US-06** - As a birder whose selected species was never split or lumped, or who has no affected species at all, I want a short honest statement that also says which updates are covered, so that silence about an older change is never read as "nothing happened".

> **US-07** - As a birder offline in the field, or without an eBird key, I want the whole view to work from what is already on my device, so that it is available anywhere my data is.

## Functional Requirements

### The history asset and its build

> **FR-01** - The app shall ship a bundled, build-time history asset of species-level split and lump events from eBird's annual taxonomy updates. Each event shall carry: its kind (split or lump); the update that made it, as a year and a published date (full calendar date); one or more before-side entries and one or more after-side entries, each with an eBird species code, a scientific name and a common name; and, for a split, zero or more slash taxa the split created, each with its code and names. A split has exactly one before-side entry and two or more after-side entries; a lump has two or more before-side entries and exactly one after-side entry.

> **FR-02** - The asset shall carry its coverage: the earliest and the latest update it covers, as years with their published dates. Coverage shall be derived by the generator from the updates it actually produced events for, never hand-typed. The asset may hold zero events and still carry coverage.

> **FR-03** - Where one lineage changed in more than one covered update, the asset shall record each change as its own dated event, and the relationship between them shall be recoverable (an after-side entry of an earlier event that is a before-side entry of a later one), so a chain can be presented in date order.

> **FR-04** - A developer-run generator script shall derive the asset from eBird's published per-update change records and shall fail closed: it shall refuse to emit an asset when any event lacks a kind, a published date, a resolvable code on every before-side and after-side entry, a scientific and common name on every entry, or when a split has fewer than two after-side entries or a lump fewer than two before-side entries. It shall be the same class of developer step as the existing taxonomy snapshot build, never a CI or runtime step.

> **FR-05** - A CI test shall hold the committed asset to the bundled taxonomy snapshot and to a size bound: every after-side code and every slash-taxon code that is current shall resolve in the bundled snapshot; every event shall be complete and dated per FR-01; coverage shall equal the min and max of the event dates present (or a stated empty coverage when there are no events); and the committed file's size shall not exceed a bound declared in the test. The asset shall stay off the entry chunk, asserted by the existing entry-chunk guard.

### Matching the user's species

> **FR-06** - A species in the loaded backup shall be "affected" when it matches an entry on either side of a covered event. Matching shall resolve the species' exported names to an eBird species code through the app's existing resolution path (scientific name first, common name second, against the bundled or cached taxonomy), and shall treat the species as matching an event when that code equals any before-side, after-side or slash-taxon code on the event.

> **FR-07** - Where the existing path yields no current code for a species (a name eBird has retired, as in an export older than the update), the species shall be matched against the event entries' own names carried on the asset, scientific name first and common name second, so a pre-update name in an old export matches the before side of the same event. No other matching shall be attempted; a species that matches nothing this way is simply not affected.

> **FR-08** - Matching shall operate on the species as the page's merged view names it: a row whose reported name is a subspecies, form, intergrade or domestic type shall match through its parent species (the existing parent normalisation and countability rule), never as a species of its own. A row whose reported name is a hybrid, spuh or slash shall not match as a species, with one exception: a row whose exact reported name is a slash taxon carried on an event as created by that split shall match that slash entry.

> **FR-09** - "Affected" and every count in this feature shall be computed from the full loaded backup; the page's active county and date filters and the "Show all forms" and "Show escapees" toggles shall have no effect on which species are affected or on any count, and the section shall say so in one line whenever a county or date filter is active.

### The list control

> **FR-10** - The app shall show a clearly labelled "Splits and lumps" control on Species Detail, beside the "Subspecies and forms" control, visible only when the page is in its ready state with a backup loaded and "Show subspecies" is off (merged mode). The control shall carry a count of affected species that equals the number of entries in the list it opens.

> **FR-11** - Opening the control shall reveal a list of every affected species, ordered as the species selector orders them. Each entry shall show the species name as it appears in the user's backup, and for each covered event that touches it, the kind of change as a word (Split or Lump) and the update year, most recent first. A species touched by more than one event shows each.

> **FR-12** - Choosing a species from the list shall select it exactly as choosing it in the species selector would, through the page's own selection path including the existing escapee reveal (a species "Show escapees" is hiding is revealed and selected, never dropped), shall close the list, and shall bring the lineage section into view and move focus to it. The list is collapsed by default on every visit and its open state is not persisted.

> **FR-13** - When no species in the loaded backup is affected, the control shall remain visible with a count of zero, and opening it shall show an honest message stating that none of the species in the loaded data was split or lumped in the covered updates, followed by the coverage statement of FR-20.

### The lineage section

> **FR-14** - For a selected species in merged mode, the app shall render a titled lineage section near the Subspecies and Forms section. For an affected species it shall show, per event: the kind of change as a word; the update's month and year; every before-side entry and every after-side entry as bird names; and the slash taxa the split created that the user holds rows under (FR-08). The user's selected species shall be visibly marked in the lineage by a text marker, not by colour alone. A slash taxon the user holds no rows under shall not appear.

> **FR-15** - For a chained lineage (FR-03), the section shall present every covered event that touches the selected species in date order, earliest first, with each event's before and after sides shown against its own update, so the reader can follow the species from its earliest covered name to its current one.

> **FR-16** - For every entry on an event that the user holds rows under, the section shall show the user's report count for that entry, defined as the number of observation rows in the full backup matching that entry per FR-06 through FR-08 (one CSV row is one report). That count shall be partitioned into rows whose observation date is on or before the update's published date and rows whose observation date is after it. A row dated exactly on the published date counts as on or before. The two partition counts shall sum exactly to the entry's count.

> **FR-17** - The on-or-before partition shall be labelled in words as reports eBird reassigned in that update, and the after partition as reports recorded under the current name. The section shall state plainly, once per event, that eBird reassigned the pre-update rows. The section shall never suggest, rank or propose which daughter species a pre-update report belongs to, and shall never present a count as a correction of the user's records.

> **FR-18** - An entry on an event that the user holds no rows under shall still appear in the lineage (so the full before and after sides are always shown) with a short text marker meaning "not in your data" in place of counts.

> **FR-19** - When the user's rows for the selected species carry a before-side name of an event (matched per FR-07) and no rows carry any after-side name of that event, the section shall label the species as coming from an export that predates that update, naming the update's month and year, and shall show the before-side entry marked as the user's species with its count. Every such row is necessarily dated before the update; the section shall not show an after partition for it. A lump where the user holds rows under two or more before-side names shall show each such before-side entry with its own count.

> **FR-20** - The section shall show, in every state including the empty ones, a coverage statement naming the earliest and latest covered updates (year each, in the form the copy stage settles) so silence about an uncovered update is never read as "no change". When the asset holds zero events, the statement shall say that no updates are covered in this build.

> **FR-21** - When the selected species is not affected, the section shall render as a short empty state stating that no split or lump is recorded for this species in the covered updates, followed by the FR-20 statement. The section shall never be silently absent for a selected species in merged mode.

> **FR-22** - The section shall carry a text equivalent of the lineage that a screen reader can follow in reading order: per event, the kind, the update, each before-side and after-side entry with its counts and partitions or its "not in your data" marker, and the reassignment sentence. No fact shown graphically shall be absent from the text equivalent, and no meaning shall be carried by colour alone.

### Names, modes and regression safety

> **FR-23** - Every bird name in the list and the section shall render through the app's standard bird-name component. Before-side and after-side names not present in the user's backup shall render unlinked (not recorded); names present in the backup may link to Species Detail through the page's own selection path. Display copy that is not a bird name (kind words, markers, partition labels) shall render as plain text.

> **FR-24** - When "Show subspecies" is on (exact-name mode), neither the control nor the section shall render; turning it off shall restore both without loss of function. Switching "Show all forms" or "Show escapees" in either direction shall produce no change in the list's membership or the section's content.

> **FR-25** - Selecting an affected species through the species selector, through another tab's request, or through the list shall produce the same section content; the list adds only the scroll-and-focus of FR-12.

> **FR-26** - The feature shall change nothing else: the Subspecies Explorer, both existing toggles and the escapee switch, life-list and species counts, every other Species Detail section and every other tab shall behave exactly as before. With the control never opened, the page shall be functionally identical to the prior release apart from the presence of the new control and section.

### Data lifecycle

> **FR-27** - When the loaded backup changes (a new upload, a synced arrival or a removed file), the affected set, the list and the section shall recompute entirely from the new data and no derived value from the prior load shall survive. With no backup stored, the page's existing setup flow appears and no control or section renders.

> **FR-28** - If the history asset cannot be loaded at runtime, the control and the section shall not render and no other part of the page shall change; no error alert shall be raised for it. The asset is bundled, so this state indicates a build defect rather than a user condition.

### Documentation and release

> **FR-29** - The same change shall update the Species Detail coverage in `docs/HELP.md` (no approval stop) and shall carry the changelog entry and the version bump across the repo's four-file set. Copy for `README.md`, `website/`, and the App Store "What's New" line shall be prepared only as a held proposal of at most one sentence for the Species Detail section, shown to the user and written only on their express yes; the build shall never write those surfaces itself.

## Non-Functional Requirements

> **NFR-01 - Network posture:** The feature shall make no third-party request, add no new endpoint or host, and move no request between components; it shall work with no eBird key configured and with the device offline, on Mac, Windows, iPhone, iPad and web/Pi alike (on web/Pi the existing storage seam's requests to the user's own server are unchanged). `PRIVACY_POLICY.md` needs no change.

> **NFR-02 - Trust boundary:** The asset is a build-time artifact defended at build time (FR-04) and CI time (FR-05); no runtime per-entry validation is owed. The generator's inputs are eBird's published records obtained by the developer; the app never fetches them.

> **NFR-03 - Performance:** The affected set and per-entry counts shall derive at most once per loaded backup and per asset load, never on unrelated re-renders, with no per-render work proportional to the backup size; the section's per-species view shall derive at most once per species change. The asset and any code that only it needs shall load lazily on first need and stay off the entry chunk. Verification shall assert work done (derivation invocations, chunk membership), not elapsed time.

> **NFR-04 - Accessibility:** WCAG 2.1 AA shall hold at 320px viewport width and 200% in-app text scale in both themes. The control, the list and the section shall be fully keyboard operable; the control's expanded state shall be conveyed to assistive technology; every count, partition, marker and kind shall be readable as text; the lineage's text equivalent (FR-22) shall be in reading order. Every app-owned button and link shall render through the canonical `Button` and `Link` primitives. Any DOM id or ARIA reference the feature mints shall be keyed on an index, never on user file content.

> **NFR-05 - Theming and layout:** Every colour shall come from the `var(--sr-*)` token set and render correctly in both themes, with no hardcoded colour values in components. Responsive behaviour shall be achieved by lifting to classes, never inline styles. No horizontal page overflow at any supported width, including at 320px and 200% text scale with the longest names an event can carry. No new dependency: the lineage is hand-built with the app's existing means.

> **NFR-06 - Copy standards:** No em dash (U+2014) in any user-facing copy or in the published documentation prose this feature touches. Count-bearing strings shall live in a copy module and follow the repo's singular and plural rules over the whole input domain. "Split" and "Lump" are the kind words; an update is named by month and year.

> **NFR-07 - One rule, one renderer:** Countability shall be decided only by the existing shared predicate, parent folding only by the existing shared normalisation, and code resolution only by the existing taxonomy resolution path plus FR-07's asset-name fallback; no new or duplicated classification rule.

## Out of Scope

- Subspecies-group, ISSF and form-level rearrangements, and pure renames of common or scientific names without a split or lump (the existing rename bridge covers renamed names for lookups).
- Changes to taxonomic order, family placement, or newly described species.
- Spuhs as a destination of a split: a spuh predates and outlives the split, so it is not an event product; only slash taxa the event created are carried.
- Editing, reassigning or second-guessing the user's records; the app reports what eBird did and when.
- Any eBird API use for this feature: no fetching prior taxonomy versions, no version listing, no personalized report; the existing taxonomy refresh is untouched.
- A browse of the whole world's splits and lumps: only species present in the user's backup appear in the list, though an affected species' full lineage shows names the user never recorded (FR-18).
- Splits and lumps on other tabs (Statistics, Multimedia, Breeding Codes, Calendar); Species Detail only, matching the Subspecies Explorer precedent.
- An exact-name-mode variant; the feature is defined for merged mode only.
- Following the page's county and date filters; counts reflect the whole backup (FR-09).
- Region-limited or hand-curated coverage; the record is global and machine-derived, or an update is absent and the coverage statement says so.
- Persisting the control's open state, or any new stored setting or cache document.
- Copy, export or share actions on the lineage.
- Any change to `PRIVACY_POLICY.md`: nothing new leaves the device.
- **A runtime download of the change list (the user's "download once and cache" direction).** Weighed in the brief and not dropped: the once-per-year cadence is met by the release-time refresh because nothing fetchable exists today (Cornell's spreadsheets sit behind a bot check and would be a new host; the eBird API expresses no parent-to-daughter relationships). Reversal condition, carried for the Architect: if eBird publishes a fetchable change list on an existing disclosed host, a once-per-taxonomy-year download becomes the better design, stated in the durable network form, held in a long-TTL persistent cache of the `lib/countyCompletenessCache.ts` shape, with the bundled asset as the offline floor. See OQ-04.

## Open Questions

- **OQ-01 - How far back does coverage reach?** The generator's floor is whatever eBird's machine-readable per-update change records parse to; earlier updates (documented in prose on eBird's update pages) may not. Default: cover every update the generator can produce complete events for, state the resulting range per FR-20, and never hand-type an event to extend it. The Architect records the achieved range in the schema.

- **OQ-02 - Published date for the partition.** eBird's conversion runs over weeks; the brief settles on the update's published release date. Default: the published date, one per update, carried on the asset; rows dated on it count as on-or-before (FR-16).

- **OQ-03 - Where exactly the section sits.** The brief says near the Subspecies and Forms section. Default: immediately after Subspecies and Forms and before Graph Options, full width, in merged mode; the Designer may adjust position within the merged view but never interleaves with or alters an existing section.

- **OQ-04 - The runtime-download reversal.** Should this build prepare any plumbing for a future fetch? Default: no. The bundled asset is the whole design; the reversal condition is recorded in Out of Scope and the Architect's schema, and nothing speculative is built.

- **OQ-05 - Filter honesty line.** FR-09 asks for a one-line note when a filter is active. Default: the same shape the Species Detail Weather card uses ("The figures cover every checklist in your export"), shown only while a county or date filter is active, in the section's muted register.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Asset shape (FR-01) | Every event in the committed asset has a kind, a year, a full published date, complete before/after entries (code, scientific name, common name), split has 1 before and >= 2 after, lump has >= 2 before and 1 after; slash taxa appear only on splits |
| QA-02 | Coverage carried and derived (FR-02) | The asset's earliest and latest updates equal the min and max published dates over its events; a generator run over a fixture with two updates emits exactly that range, and over zero events emits the stated empty coverage |
| QA-03 | Chained lineage recoverable (FR-03) | On a fixture where update A splits X into Y and Z and update B lumps Y with W, the two events are distinct, dated, and Y is discoverable as an after-side entry of A and a before-side entry of B |
| QA-04 | Generator fails closed (FR-04) | For each of: missing kind, missing date, unresolvable code, missing name, split with one daughter, lump with one parent, the generator exits non-zero and writes no asset |
| QA-05 | CI holds the asset (FR-05) | The CI test resolves every current after-side and slash code in the bundled snapshot, re-checks FR-01 completeness, re-derives coverage, asserts the file size is within the declared bound, and the entry-chunk guard shows the asset absent from the entry graph; mutating any one of these in a copy turns the test red |
| QA-06 | Match by current code (FR-06) | On a fixture backup whose rows carry a current after-side name of a split, that species is affected; a fixture species on no event's sides is not |
| QA-07 | Match a retired name (FR-07) | A fixture backup carrying only the pre-split scientific and common name (no current code) matches the before side; a row whose names match nothing on the asset is not affected; scientific name wins over a conflicting common name |
| QA-08 | Forms roll up, non-countables do not (FR-08) | Rows named as a subspecies group, intergrade and domestic type of an affected species count toward that species; a hybrid and a spuh count nowhere; a row exactly matching the event's created slash taxon counts on the slash entry and nowhere else |
| QA-09 | Filters and toggles inert on counts (FR-09) | With a county filter, a date range, "Show all forms" and "Show escapees" each applied, the affected set and every count are byte-identical to the unfiltered result, and the FR-09 line appears only while a county or date filter is active |
| QA-10 | Control placement, gating and count (FR-10) | In ready state with merged mode on, a control labelled "Splits and lumps" renders beside the "Subspecies and forms" control; its count equals the number of list entries; it is absent in setup-required, loading, and exact-name states |
| QA-11 | List content and order (FR-11) | The list holds exactly the affected species in selector order; each entry shows the backup's name, and per event the word Split or Lump with the update year, most recent first; a two-event species shows two lines |
| QA-12 | Pick-to-select with reveal (FR-12) | Choosing an entry selects that species (all sections update), closes the list, scrolls the lineage section into view and moves focus to it; choosing an escapee-hidden species turns the reveal on and selects it |
| QA-13 | No affected species (FR-13) | With a fixture backup touching no event, the control renders with a count of zero, and opening it shows the honest message followed by the coverage statement |
| QA-14 | Section content for a split and a lump (FR-14) | For a split, the section shows the word Split, the update's month and year, the before name, every after name, the created slash taxon only when the backup holds rows under it, and a text marker on the selected species; for a lump, the same with sides reversed |
| QA-15 | Chained presentation (FR-15) | On the QA-03 fixture with Y selected, the section shows event A then event B in date order, each with its own sides and update |
| QA-16 | Counts and partition (FR-16) | Each entry's count equals a hand count of matching rows; rows dated on the published date fall in the on-or-before partition; rows dated one day after fall in the after partition; the two partitions sum to the count for every entry |
| QA-17 | Reassignment wording, no proposals (FR-17) | The on-or-before partition's label names eBird as the assigner, the after partition's label names the current name, the reassignment sentence appears once per event, and no string in the section suggests which daughter a report belongs to (copy-module sweep) |
| QA-18 | Absent entries still shown (FR-18) | An after-side daughter the user never recorded renders by name with the "not in your data" marker and no counts |
| QA-19 | Export predates the update (FR-19) | A fixture carrying only a pre-split name shows the "export predates" label naming the update's month and year, marks the before entry as the user's species with its count, and shows no after partition; a pre-lump fixture with rows under two parents shows both before entries with their own counts |
| QA-20 | Coverage statement everywhere (FR-20) | The statement naming the earliest and latest covered updates appears in the affected, not-affected and zero-affected states; with a zero-event asset it says no updates are covered |
| QA-21 | Not-affected empty state (FR-21) | Selecting an unaffected species renders the section with the one-line empty state and the coverage statement; the section is present, not missing |
| QA-22 | Text equivalent complete (FR-22) | For each rendered lineage, every kind, update, name, count, partition, marker and reassignment sentence appears in the text equivalent in reading order; removing any one from the graphic without the text fails a parity test; no meaning is carried by colour alone (colour-stripped render still conveys kind and marker) |
| QA-23 | Name rendering and linking (FR-23) | Every bird name in the list and section renders through the shared bird-name component; names absent from the backup render unlinked; kind words, markers and labels render as plain text |
| QA-24 | Modes (FR-24) | With "Show subspecies" on, neither control nor section renders; turning it off restores both; toggling "Show all forms" and "Show escapees" both ways leaves list membership and section content byte-identical |
| QA-25 | Same content by any route (FR-25) | Selecting an affected species via the selector, via a request from another tab, and via the list yields byte-identical section content |
| QA-26 | No regression (FR-26) | With the control unopened, the Subspecies Explorer, both toggles, the escapee switch, species counts, every other section and every other tab match the prior release in the regression suite |
| QA-27 | Backup lifecycle (FR-27) | Replacing export A with export B recomputes the affected set, list and section from B only; a species affected in A and absent in B is gone; with no stored backup the setup flow shows and no control or section renders |
| QA-28 | Asset load failure (FR-28) | With the asset import rejected in a test, the control and section are absent, no alert region carries text, and every other section renders as before |
| QA-29 | Documentation and release (FR-29) | The change updates `docs/HELP.md`'s Species Detail section, bumps all four version files and adds a CHANGELOG entry; the README, website and What's New sentences exist only as a held patch in the pipeline folder and none of those surfaces differs from `main` |
| QA-30 | Network posture (NFR-01) | A full session (open list, pick, read section, filter, reload backup) records zero requests to any host other than the existing storage seam, with no eBird key configured and the transport's outbound seam offline; no new endpoint or host appears in the route table or the privacy policy diff |
| QA-31 | Memoized derivation and lazy load (NFR-03) | An instrumented run derives the affected set once per backup load and the per-species view once per species change, with no derivation on unrelated re-renders; the asset chunk is requested only after Species Detail reaches ready state and is absent from the entry graph |
| QA-32 | Accessibility (NFR-04) | At 320px and 200% text scale in both themes: no horizontal overflow, full keyboard operation of control, list and section, expanded state announced, AA contrast on all new text, every new button and link through the canonical primitives (tab-order guard green), no DOM id or IDREF built from a bird name |
| QA-33 | Theming, layout and copy (NFR-05, NFR-06) | No hardcoded colours or inline layout styles in the new UI; no new dependency in `package.json`; no U+2014 in user-facing copy or touched documentation prose; the copy-module corpus sweep finds no singular/plural defect |
| QA-34 | One rule (NFR-07) | The feature imports the shared countability predicate, the shared normalisation and the existing taxonomy resolution path; a source scan finds no local reimplementation of any of them |
