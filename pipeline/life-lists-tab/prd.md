# PRD: Life Lists
**Feature:** life-lists-tab
**Date:** 2026-11-06
**Stage:** 2, The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

A new configurable **Life Lists** tab, shipped directly after Checklists in the default tab order, that lists every countable species in the loaded eBird backup newest-first by the date it was first recorded, with that first sighting's date, time, checklist and location. Two off-by-default switches (Include Escapees, Include Exotics) widen the list, and three independently selectable media buttons (Photo, Audio, Video) turn it into a photo, audio or video life list, or any combination, dated to the day the species first held every selected media type.

The tab is a pure derivation over the two stored files and the provenance record the Statistics tab already caches. It issues no request of any kind.

## User Stories

> **US-01**: As a birder with years of eBird data, I want to see my life list in the order I added species, so that I can answer "which bird did I add most recently, and when and where?" without leaving the app or scrolling eBird's own list.

> **US-02**: As a birder who uploads to the Macaulay Library, I want a photo life list dated to my first photo of each species, so that I can see which species I photographed recently and which I have never photographed at all.

> **US-03**: As a birder who records sound and video as well as photos, I want to combine media types, so that I can see which species I have both photographed and recorded, dated to when each species first had both.

> **US-04**: As a birder who follows eBird's countability rules, I want the list to apply the same countable-forms fold and the same escapee rule the rest of SnowRaven already applies, so that the list agrees with what I would expect from Statistics and Species Detail.

> **US-05**: As a birder who keeps a strict native-only list, I want naturalized and provisional exotics left out by default with one switch to put them back, so that my headline list is the one I care about and the wider one is one press away.

> **US-06**: As a birder who has not yet run the exotic status check, I want the tab to list every species and tell me plainly that escapee and exotic status is unresolved, so that no lifer is silently dropped and I know where to resolve it.

> **US-07**: As a user who reorders and hides tabs, I want Life Lists to join the tab roster like any other tab, so that I can place it where I want or hide it.

## Functional Requirements

### Tab registration and placement

> **FR-01**: The app shall register a new configurable tab with the user-facing label **Life Lists** and an internal key distinct from the existing Multimedia tab's `life-list` key (recommended `life-lists`), in `TAB_LABELS` and `DEFAULT_TAB_ORDER`, placed immediately after `checklists` in the default order.

> **FR-02**: The tab shall be hideable and reorderable through the existing Settings tab-layout UI with no change to that UI; it shall appear in the desktop tab bar, the compact dropdown, the sidebar rail and Search's tab results through the existing registry.

> **FR-03**: A saved tab order that equals the shipped default from before this feature (element for element, after normalization) shall read as the new default, so a user who never reordered sees Life Lists directly after Checklists; any other saved order shall receive Life Lists appended after its last tab, with the saved hidden set preserved and nothing written back. Exactly one generation migrates: the previous-default constant now holds the pre-feature default and the 1.0.19 order is retired.

> **FR-04**: The Multimedia tab (`life-list`), its label, `LifeList.tsx` and `LifeListTable.tsx` shall be unchanged by this feature; the new tab's component files shall carry distinct names.

### Loading and setup states

> **FR-05**: With no eBird backup saved, the tab shall show the app's standard setup panel: title "eBird Backup Required", body "The Life Lists tab loads automatically from your stored eBird backup. You haven't saved one yet.", the shared eBird backup steps, and the shared go-to-Settings action.

> **FR-06**: With a backup saved that cannot be read or parsed, the tab shall show the shared tab load-error alert with the shared eBird backup load-error message, exactly as the Checklists tab does, and shall not show the setup panel.

> **FR-07**: While the backup is loading the tab shall show the shared loading indicator with an accessible status label, and a load that is superseded (file replaced, tab unmounted) shall write no state.

> **FR-08**: The tab shall load the ML export through the shared ML export cache, treating it as optional: an absent export shall not block the first-sighting list, and an unreadable export shall be reported as described in FR-27 without affecting the first-sighting list.

> **FR-09**: The tab shall re-derive everything it shows whenever the data-file epoch changes (either file saved, replaced or removed, by any writer, including a delete or iCloud clear), by placing the files epoch in its load effect's dependencies; clearing all data shall leave the tab in the setup state with no rows.

### Species roster and the countable fold

> **FR-10**: The roster of species shall be built from the loaded eBird backup only: every observation whose raw common name is a countable form (not rejected by `isNonCountableForm`) contributes to the species keyed by its normalized common name (`normalizeSpeciesName`), so subspecies and other parenthetical forms fold into their parent species and spuhs, slashes, hybrids and domestics never appear.

> **FR-11**: A species's first sighting shall be its earliest observation by date (the backup's `YYYY-MM-DD` date, compared as a day), then by that observation's time (earliest first; an observation with a blank or unparseable time ranks after every timed observation on the same day), then by submission id as a final stable tiebreak. The first sighting supplies the row's date, time, checklist and location in the first-sighting list.

> **FR-12**: An observation whose date is not a valid `YYYY-MM-DD` day (month 1 to 12, day 1 to 31) shall not establish a first sighting; a species with no validly dated observation shall not be listed. This mirrors the undated-row handling in the Statistics media card.

> **FR-13**: The species count the tab shows shall equal the number of rows currently in the list (before any paging), for every combination of switches and media buttons.

### Escapee and exotic classification

> **FR-14**: The tab shall read escapee and exotic classification passively from the cached exotic-provenance record, through the same confirmation mechanism the Species Detail Show escapees switch uses: a published name is honored only when every checklist in the loaded backup that carries that species has already been consulted. The tab shall never initiate, retry or extend a provenance pass, and no name-to-code map shall feed classification (the FR-43 code map exists for the species-link marks only).

> **FR-15**: A species shall be classified **escapee** by the existing Statistics rule: every consulted observation of it carries eBird category X and every carrying checklist in the loaded backup has been consulted.

> **FR-16**: A species shall be classified **exotic** by the parallel rule: it is not an escapee, every consulted observation of it carries some exotic category (an eBird category token that is not empty), and every carrying checklist in the loaded backup has been consulted. A species with any consulted observation carrying no category, or with no provenance record, or with any unconsulted carrier, is **native**.

> **FR-17**: The exotic classification shall be published for passive readers by the Statistics pass, the only holder of the name-to-code join, alongside the escapee list it already publishes, under the same name bounds, and with no new request: the Statistics pass's requests, cache, status line and UI are unchanged. Until Statistics has published the exotic list at least once on this build, the exotic classification is unresolved for the tab.

> **FR-18**: With both switches off, the list shall exclude every species classified escapee or exotic. Turning **Include Escapees** on shall add exactly the escapee species, each at its own computed date; turning **Include Exotics** on shall add exactly the exotic species, each at its own computed date; turning a switch off shall remove exactly the species it added. The switches are independent and compose with the media buttons: a species excluded by a switch stays excluded whatever media it has.

> **FR-19**: A species whose classification is unresolved (no record, an unconsulted carrier, or the exotic list not yet published) shall be treated as native and listed, with both switches off.

> **FR-20**: The tab shall show one standing sentence below the controls about status, chosen as follows. When the exotic list has not been published or any checklist in the loaded backup is not in the consulted ledger: "Escapee and exotic status comes from the exotic status check on Statistics, which has not finished for this export, so species it has not settled are listed." Otherwise: "Escapee and exotic status comes from the exotic status check on Statistics, so with both switches off this list can be shorter than the Statistics species figure." The sentence is plain text with no link and triggers nothing.

### Media life lists

> **FR-21**: The three media buttons **Photo**, **Audio** and **Video** shall each be independently selectable toggle buttons (pressed state exposed to assistive technology) rendered through the native `Button` primitive; any subset of the three may be selected at once.

> **FR-22**: For each species and each format, the first asset shall be the earliest ML export row of that format whose normalized common name equals the species's normalized name, by date (the ML row's `YYYY-MM-DD` day), then by the ML row's clock time (earliest first; a blank or unparseable clock ranks after every timed asset on the same day), then by catalog id as a final stable tiebreak. An ML row whose date is not a valid day shall not establish a first and shall be ignored.

> **FR-23**: With one or more formats selected, a species shall appear only if it is on the current roster (FR-10 through FR-19) and has a dated first asset in every selected format. The ML export only narrows and dates the list; a species present in the ML export but absent from the backup roster shall not appear.

> **FR-24**: With exactly one format selected, the row's date, time, checklist and location shall be those of the species's first asset in that format, not its first sighting.

> **FR-25**: With two or three formats selected, the row's date shall be the latest of the selected formats' first-asset dates (compared by day, then by time with the same blank-last rule, then by format name as a stable tiebreak), and the row's time, checklist and location shall be those of that latest asset. The combined date is the day the species first held every selected media type.

> **FR-26**: Deselecting every media button shall return the list to the first-sighting list, including species that have no media at all.

> **FR-27**: With a backup loaded and no ML export saved, the three media buttons shall render disabled (not pressable, state exposed to assistive technology) beside the sentence "Photo, audio, and video life lists need your Macaulay Library export, saved in Settings under Default Files." With an ML export saved that could not be read or parsed, the buttons shall render disabled beside the sentence "SnowRaven couldn't read your Macaulay Library export, so photo, audio, and video life lists are unavailable; re-upload it in Settings under Default Files." In either state the first-sighting list and the switches work normally.

### Ordering

> **FR-28**: Rows shall be ordered newest first by the row's computed date; rows with the same date shall be ordered by the row's time, later first, with rows whose time is blank or unparseable after every timed row of that day; rows still tied shall be ordered by normalized common name ascending (locale compare). The order shall be identical across reloads and across platforms for the same inputs.

### Row content and controls

> **FR-29**: Each row shall show, in reading order: its position number (FR-42); the species name rendered through `<BirdName>` with the normalized common name, the scientific name beneath it and the species-link marks beside it (FR-43), opening the species on Species Detail through the existing in-app navigation when the host provides it, exactly as Checklists does; the row's date formatted through the app's date-format preference; the row's time (FR-30); the row's checklist (FR-31); the row's location (FR-32); and, when an ML export is loaded and readable, the media presence cell (FR-44).

> **FR-30**: The time shall be shown in the 12-hour clock form the eBird backup carries (for example "7:05 AM"); an ML asset's clock shall be converted to the same form; a blank or unparseable time shall show a single dash.

> **FR-31**: The checklist shall render through the shared `ChecklistLink` when the id matches the eBird submission-id shape (the shared `isValidChecklistId` guard), linking to that checklist on eBird; a row whose id does not match the shape, or whose ML asset carries no checklist id, shall show a single dash in that position and no link.

> **FR-32**: The location shall be shown as plain text: the location name, followed by the county and the two-letter state or province where present, in the "County, ST" form the Checklists tab uses for its place string. For a first-sighting row these come from the eBird observation (Location, County, State/Province); for a media row they come from the ML asset (Locality and County; no state). The location is not a hotspot link and the tab does not load the hotspot set.

> **FR-33**: The tab shall show one count-and-rule sentence above the list, from this template, where N is the row count formatted with locale grouping: no format selected, "N species, newest first by the date of your first sighting."; Photo only, "N species with a photo, newest first by the date of your first photo."; Audio only, "N species with audio, newest first by the date of your first audio recording."; Video only, "N species with video, newest first by the date of your first video."; two formats, "N species with {a photo and audio | a photo and video | audio and video}, newest first by the date each had both."; three formats, "N species with a photo, audio, and video, newest first by the date each had all three."

> **FR-34**: When the list is empty the tab shall show one sentence in place of the rows: with no format selected, "No countable species in your eBird backup yet."; with any format selected, "No species matches this selection yet."

> **FR-35**: The two switches shall render through the app's existing `ToggleSwitch` control with the visible labels "Include Escapees" and "Include Exotics", off by default, each announcing its state to assistive technology.

> **FR-36**: The switch states and the media selection shall be session-only: they persist while the app runs (tabs stay mounted while hidden) and reset to off and none on relaunch. Nothing about this tab is written through the `storage` seam, synced, or registered in `clearDerived.ts`.

> **FR-37**: The list shall render through the app's existing long-list pattern from the Weather backlog: the first 100 rows, then a **Show next 100** control and a **Show all** control while more remain, rendered through the native `Button` primitive; activating a paging control shall not move keyboard focus to the document body (the control stays mounted or focus is placed explicitly). The count sentence (FR-33) always states the full count, not the visible count.

> **FR-38**: Every DOM id or ARIA IDREF the tab mints shall be keyed on a row or control index, never on species names, locations or any other user-file content.

> **FR-39**: The tab shall make no third-party request, add no new endpoint or host, move no request between components, load no hotspot set, and initiate no provenance request. The one request the tab causes is the batched `/taxonomy/codes` resolve of FR-43, which on web/Pi goes to the user's own server and in the native apps is answered locally by the Tauri service, and which joins the cached-paths handling that call already has. On web/Pi the only other HTTP the tab causes is the two stored-file reads through the `storage` seam and the lazy chunk load that every tab incurs. No request a system component makes from the app's process is added.

### Help and published copy

> **FR-40**: `docs/HELP.md` shall gain a "## Life Lists" section directly after "## Checklists" in the same change, describing the first-sighting list, the two switches and their relation to the Statistics exotic status check, the media buttons and the combined-date rule, and the session-only controls; and the Getting Started and Default Files sentences that list the tabs reading the eBird backup and the ML export shall name Life Lists.

> **FR-41**: The build may prepare at most one proposed sentence each for README, the website and the App Store listing as a held patch in `pipeline/life-lists-tab/`; nothing shall be written to those surfaces, or to the privacy policy, without the user's explicit yes.

### Row additions from the design pass (D-10 to D-12)

> **FR-42**: Every row shall show its position on the list currently shown at its leading edge: the newest row at the top carries the full row count (the same N as the FR-33 sentence) and the oldest row at the bottom carries 1. The number is the position in the whole list, not the page, so after Show next 100 the second page continues from where the first left off, and a media selection renumbers for that narrowed list. The number is plain text (never a link), in tabular figures, right-aligned in a fixed-width track; it is derived at render from the sorted list and never stored; it is never used as a DOM id or IDREF (FR-38 holds). The visible number is hidden from assistive technology and an equivalent "N of M." prefix in the name cell carries the position to a screen reader.

> **FR-43**: Each row's `<BirdName>` shall render with `showSci` and the species's scientific name beneath the common name, and with `taxonCode` so the eBird and Birds of the World marks (`SpeciesLinks`) draw and link exactly as the Checklists tab draws them for its species-comment lead. The scientific name shall come from the eBird backup's own Scientific Name column of the species's first-sighting observation (FR-11), reduced to the binomial (the first two whitespace-separated tokens), so a subspecies or form row folded into its species shows the species name; the ML export's Scientific Name column is never consulted for this. Taxon codes shall come from one batched `/taxonomy/codes` resolve of the roster's normalized names through `transport.post`, in the Checklists shape (`codeFor(name)` falling back to the normalized name), issued once per derivation and re-issued only when the roster's set of names changes; a failed or pending resolve shall render the names without marks and shall never block, delay or re-order the list. This reverses Open Question 6 at the user's request.

> **FR-44**: When an ML export is loaded and readable, every row shall carry one passive media presence cell at its trailing edge with three fixed slots in the Photo, Audio, Video order, drawn with the media buttons' own glyphs: a format the species has at least one dated asset of is drawn in the text ink, and a format it lacks is drawn as a faint outline that keeps its slot, so position carries identity and ink carries presence. The cell is not interactive, is not a link, adds no tab stop, and carries an accessible label naming the formats present in the fixed order (the design spec's "Media: photo, audio" form) or "No media", so a screen reader hears the same fact. Presence is read from the per-format first-asset computation FR-22 already requires (a format is present exactly when it has a first asset) and is the same whatever the current selection; no new scan is added. With no ML export, or an unreadable one, the cell is omitted and its track is dropped.

## Non-Functional Requirements

> **NFR-01, Performance:** The derivation shall be linear in the number of rows: one pass over the parsed observations to build the roster and first sightings, one pass over the parsed ML rows to build per-species per-format firsts, and one pass over the roster to apply switches and media selection and to sort (the sort is over species, not rows). No step shall re-scan the raw file text; every field read is an already-parsed field of `ObservationEntry` or `MLExportRow`. A guard over a generated corpus shall demonstrate the scaling, reading CPU time through the shared `cpuTiming` helper, with its own stated `testTimeout`.

> **NFR-02, Responsiveness:** Toggling a switch or a media button shall not re-run the two file passes; only the roster filter and sort re-run. Loading the files and deriving the firsts shall happen off the render path (an effect or memo, never a render body), with no `Date` construction in a render body.

> **NFR-03, Memory:** The derivation shall hold at most one record per species per format plus one per species for the first sighting; it shall not copy the observations or ML rows, and it shall hold no reference that outlives the loaded files (a new files epoch releases the previous derivation).

> **NFR-04, Accessibility:** The tab shall meet WCAG 2.1 AA at 320px wide and at 200% text scale: every row readable without horizontal scrolling, every control reachable and operable by keyboard through the native `Button`, `Link` and `ToggleSwitch` primitives, pressed and checked states exposed, the count sentence in a polite live region that settles rather than churning, and no information carried by color alone.

> **NFR-05, Theming:** Every color shall be a `var(--sr-*)` token that resolves in both themes; layout shall be responsive through classes, never inline widths.

> **NFR-06, Bundle:** Nothing new shall land on the entry chunk beyond the registry entries in `lib/tabLayout.ts`; the tab's component and derivation module load with the tab, as the other tabs do (`entryChunk.test.ts`).

> **NFR-07, Security:** The derivation adds no new scan over user-file text; it reads parsed fields only. The three bounded reads it performs on parsed fields (a `YYYY-MM-DD` day, a clock, and the FR-43 binomial reduction, which takes the first two whitespace-separated tokens of one parsed Scientific Name per species) are fixed-shape and linear in the field's length, and the Architect's schema shall state them with the `security.md` citation. No id reaches a URL except through `ChecklistLink`'s existing shape guard.

> **NFR-08, Compatibility:** The tab shall work identically on Mac, Windows, iPhone, iPad, Android and web/Pi; it uses no platform-gated surface and no feature newer than the Android WebView floor. Safe-area rules, if any are added, carry the Android twin.

> **NFR-09, Copy:** No em dash (U+2014) in any string the tab renders or in `docs/HELP.md`; American spelling; the serial comma in lists.

## Out of Scope

- Any third-party request, any new endpoint or host, and initiating, retrying or widening the exotic-provenance resolution; that stays a Statistics action. The tab also does not load the hotspot set, so location names are plain text. (The one request the tab causes is the `/taxonomy/codes` batch of FR-43.)
- Changing the Multimedia tab (`life-list`, `LifeList.tsx`, `LifeListTable.tsx`) or its coverage view.
- Changing the Statistics tab's UI, status line, request budget or cache beyond publishing the exotic classification beside the escapee list it already publishes.
- A "Count all forms" or "Show all forms" switch; non-countable forms are excluded in this version.
- Per-year, per-region, per-county or per-location life lists; this is the whole-history list only.
- Any sort other than newest-first by the computed date; a search or species filter box; grouping.
- A Calendar lifer overlay (the Horizon item stays separate and may reuse this derivation later).
- Exporting or sharing the list, persisting the controls across sessions, or iCloud-syncing them.
- Per-observation escapee handling: the provenance record is per species, so a species's first sighting is its earliest observation regardless of that observation's own tag.
- Media thumbnails, per-species asset counts, or a link into the Multimedia tab.
- A Count ("N of 3") or dots variant of the media presence cell, or a setting to choose one; the Quiet treatment was chosen (D-12) and the Engineer builds that one alone.
- Changes to README, the website, the App Store listing or the privacy policy beyond the single held proposal sentence per surface (FR-41).
- A migration of any saved order other than the one-generation default migration in FR-03.

## Open Questions

Each question is decided here with a default; the build proceeds on the default unless the user redirects before Stage 5.

1. **Do the switches and media buttons persist across sessions?** Default: no, session-only (FR-36). Reasoning: the Statistics escapee and forms checkboxes are per-session by standing decision, nothing else on a read-only derived tab persists except where the user asked, and session-only keeps this feature out of the `storage` seam, iCloud Sync and `clearDerived.ts` entirely. Reversal is a small change: a UI setting through the `storage` seam.

2. **How is the exotic classification delivered to a tab that holds no taxonomy join?** Default: the Statistics pass publishes the exotic-only names beside the escapee-only names it already publishes, same bounds, same passive confirmation (FR-16, FR-17). Reasoning: Statistics is the only holder of the name-to-code join, and the brief forbids this tab any request, including the taxon-code batch. Consequence the user must know: after updating, the exotic list is unresolved until the Statistics tab has been opened once with a resolved provenance record; the FR-20 sentence says so. Whether the stored document keeps its key with an optional field or bumps its key suffix is the Architect's call.

3. **What shows when a row has no time?** Default: a single dash, and date-equal rows with a blank time sort after timed rows, then by name (FR-30, FR-28). Reasoning: incidental and historical checklists carry a blank Time, and a dash reads as "none" without inventing a time.

4. **How is the location rendered?** Default: plain text, "Location name" then "County, ST" where present, matching the Checklists place string but without the hotspot link (FR-32). Reasoning: the Checklists hotspot link depends on a hotspot set that is loaded by eBird region requests, which this tab may not cause. Media rows show the ML Locality and County only, because the ML export carries no state column.

5. **How are large lists bounded?** Default: the Weather backlog's pattern of 100 rows, Show next 100 and Show all (FR-37), with the derivation linear in rows (NFR-01). Reasoning: the Multimedia table mounts every species and Checklists shows 10 then all; a whole-history life list of several hundred to a few thousand rows fits the backlog's 100-row pages better than either, and that pattern already exists.

6. **Does the tab resolve taxon codes for BirdName favicons?** REVERSED at the design gate (D-11, 2026-11-06): yes. The user asked for the eBird and Birds of the World links on every row, so FR-43 requires the Checklists-shaped `/taxonomy/codes` batch and FR-39 now states the durable no-network form from the brief (no third-party request, no new endpoint or host, no request moved between components) rather than "zero requests". The original default was no, on the reasoning that zero requests at the transport seam is the simplest property to verify; QA-41 now asserts exactly one codes post per derivation and zero other requests instead.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Tab registration (FR-01) | `TAB_LABELS` maps the new key to "Life Lists"; `DEFAULT_TAB_ORDER` places the new key at the index directly after `checklists`; the key is not `life-list`. |
| QA-02 | Roster integration (FR-02) | With a fresh (default) layout, the tab appears in the desktop bar, the compact dropdown and the sidebar directly after Checklists; hiding it in Settings removes it from all three; dragging it in Settings reorders it. |
| QA-03 | Default-order migration (FR-03) | A stored layout whose order equals the pre-feature default loads with Life Lists directly after Checklists and its hidden set intact; a stored order with one swap loads with Life Lists as the last tab; neither load writes storage; the retired 1.0.19 order loads as a custom order with Life Lists appended last. |
| QA-04 | Multimedia untouched (FR-04) | `git diff` for the feature shows no change to `LifeList.tsx`, `LifeListTable.tsx` or the `life-list` label; the new component files have names that are not `LifeList.tsx` or `LifeListTable.tsx`. |
| QA-05 | Setup state (FR-05) | With `getFilesStatus().ebird` false, the tab renders the setup panel with title "eBird Backup Required", the stated body sentence, the shared steps and a working go-to-Settings action; no rows and no controls render. |
| QA-06 | Load error (FR-06) | With a backup saved whose load resolves null, the tab renders the shared load-error alert with the shared message and does not render the setup panel. |
| QA-07 | Loading and cancellation (FR-07) | While loading, an element with role status and an accessible loading label is present; unmounting mid-load produces no state update warning and no stale render. |
| QA-08 | ML optional (FR-08) | With a backup and no ML export, the first-sighting list renders fully; with an ML export whose load resolves null, the first-sighting list is identical to the no-export case. |
| QA-09 | Files-epoch re-derive (FR-09) | With the tab mounted, saving a different backup through the seam (epoch bump) re-renders the list from the new file within one load cycle; removing the backup returns the tab to the setup state; the Settings delete-all path leaves the tab in the setup state with zero rows. |
| QA-10 | Countable fold (FR-10) | A backup with rows "Dark-eyed Junco (Oregon)" on 2020-03-01 and "Dark-eyed Junco" on 2021-01-01 yields one row "Dark-eyed Junco" dated 2020-03-01; rows "Dark-eyed Junco (Slate-colored x Oregon)", "gull sp.", "Mallard (Domestic type)" and "Herring/Iceland Gull" yield no row of their own. |
| QA-11 | First sighting by date then time (FR-11) | Observations of one species on 2019-05-02 "9:10 AM" (S1) and 2019-05-02 "6:30 AM" (S2) yield a row dated 2019-05-02 with time "6:30 AM" and checklist S2; adding 2018-11-20 with a blank time (S3) moves the row to 2018-11-20, dash, S3. |
| QA-12 | Blank time ranks last within a day (FR-11) | Observations on the same day, one timed "7:00 AM" (S1) and one blank (S2), yield the timed one as the first sighting (S1). |
| QA-13 | Undated rows (FR-12) | An observation dated "2024-13-05" or "" does not establish a first; a species whose only observations are undated does not appear and is not counted. |
| QA-14 | Count equals rows (FR-13) | For every combination of the two switches and the eight media selections over a fixture, the N in the count sentence equals the number of rows in the derived list. |
| QA-15 | Passive read, no join (FR-14) | A static import-graph check (the existing `exoticProvenanceGraph` shape) shows the derivation module's closure reaches neither `transport`, nor any `lib/tauri/` service, nor `useExoticProvenance`, nor `buildCoverIndex`; the tab component reaches `transport` only for the FR-43 codes batch, and the resolved code map is passed to `BirdName` alone and never to the classification or derivation calls. |
| QA-16 | Escapee rule (FR-15) | A species whose published escapee name is confirmed (every carrying checklist in the ledger) is absent with Include Escapees off and present with it on; a species whose published name has one unconsulted carrier is present with the switch off. |
| QA-17 | Exotic rule (FR-16) | A species whose tokens are all "N|" or "P|" with every carrier consulted is absent with Include Exotics off and present with it on; a species with tokens "N|" and "|" (one observation with no category) is present with the switch off; a species with tokens "X|" and "N|" (not an escapee) and every carrier consulted is classified exotic, not escapee. |
| QA-18 | Published by Statistics (FR-17) | After a Statistics pass over a fixture, the stored provenance document carries the exotic-only names beside the escapee-only names, bounded by the same caps; the pass issued no additional request compared with the pre-feature pass (request count at the transport seam equal). |
| QA-19 | Switch composition (FR-18) | On a fixture with native A, escapee B and exotic C: off/off lists A; escapees on lists A and B; exotics on lists A and C; both on lists A, B and C; turning each switch back off removes exactly the species it added; with Photo selected and B having a photo, B is absent until Include Escapees is on. |
| QA-20 | Unresolved is native (FR-19) | With an empty provenance snapshot, every countable species in the backup is listed with both switches off, and the count equals the countable species count. |
| QA-21 | Status sentence (FR-20) | With an unpublished exotic list or any backup checklist missing from the ledger, the first sentence renders verbatim; with the list published and every backup checklist in the ledger, the second renders verbatim; the sentence contains no link and no button. |
| QA-22 | Media buttons are toggles (FR-21) | Each of Photo, Audio, Video renders through `Button` with `aria-pressed` reflecting its state; all three can be pressed at once; pressing a pressed button releases it. |
| QA-23 | First asset per format (FR-22) | ML rows for one species, Photo on 2022-04-01 time "1530" (ML1) and Photo on 2022-04-01 time "0905" (ML2), yield a first photo of ML2 (9:05 AM); a Photo row dated "" is ignored; an Audio row does not affect the first photo. |
| QA-24 | Media narrows the roster (FR-23) | With Photo selected, a species with a photo but no backup observation is absent; a species on the roster with no photo is absent; a species on the roster with one dated photo is present. |
| QA-25 | Single-format date (FR-24) | A species first seen 2015-06-01 with a first photo 2019-08-14 at "0712" on checklist S77 at "Lake Park" renders, with Photo selected, as 2019-08-14, "7:12 AM", S77 link, "Lake Park", not the 2015 sighting. |
| QA-26 | Combined-media date is the max of firsts (FR-25) | First photo 2019-08-14 (S77, "Lake Park") and first audio 2021-02-03 time "0650" (S90, "River Trail"): with Photo and Audio selected the row is dated 2021-02-03, "6:50 AM", S90, "River Trail"; adding Video with a first video 2020-01-01 keeps 2021-02-03; with a first video 2023-05-05 the row becomes 2023-05-05 with that asset's time, checklist and location. |
| QA-27 | Deselect returns the sighting list (FR-26) | After selecting and then releasing every media button, the list, count and dates equal the initial first-sighting list, including species with no media. |
| QA-28 | No-ML and bad-ML states (FR-27) | With no ML export saved, the three buttons are disabled with the no-export sentence verbatim beside them; with an unreadable export, they are disabled with the unreadable sentence verbatim; in both states the switches still filter and the first-sighting list renders. |
| QA-29 | Same-day ordering (FR-28) | Species P first seen 2020-05-05 "6:00 AM", Q 2020-05-05 "9:30 AM", R 2020-05-05 blank, S 2020-05-06 "5:00 AM": the order is S, Q, P, R; two blank-time species on one day order by name ascending. |
| QA-30 | Stable order (FR-28) | Deriving twice from the same inputs, and once from the same rows shuffled, yields identical row sequences. |
| QA-31 | Row content (FR-29) | Each row contains a `BirdName` with the normalized common name, a date formatted through the current date preference (changing the preference re-renders the date), a time, a checklist cell and a location; activating the species name calls the host's open-species handler with the normalized name. |
| QA-32 | Time display (FR-30) | An eBird time "7:05 AM" renders "7:05 AM"; an ML clock "643" renders "6:43 AM" and "1530" renders "3:30 PM"; a blank or "abc" time renders a single dash. |
| QA-33 | Checklist link shape (FR-31) | Submission id "S123456789" renders a `ChecklistLink` to that checklist; id "junk" or an ML row with an empty checklist id renders a single dash and no anchor. |
| QA-34 | Location text (FR-32) | An observation with Location "Lake Park", County "Hennepin", State/Province "US-MN" renders "Lake Park" and "Hennepin, MN"; with no county and no state it renders "Lake Park" alone; a media row with Locality "River Trail" and County "Dakota" renders "River Trail" and "Dakota"; no hotspot link and no hotspot-set load occurs. |
| QA-35 | Count sentence (FR-33) | Each of the eight media selections renders its template sentence verbatim with N formatted with locale grouping (for example "1,204 species"). |
| QA-36 | Empty states (FR-34) | A backup with only non-countable rows renders the first empty sentence; a selection that matches nothing renders the second; neither renders a paging control. |
| QA-37 | Switch controls (FR-35) | Two `ToggleSwitch` controls with labels "Include Escapees" and "Include Exotics" render unchecked by default and expose their checked state. |
| QA-38 | Session-only controls (FR-36) | Switching tabs and back preserves the switch and media state; a fresh mount after relaunch starts with both off and none pressed; no storage write occurs on any control change (seam spy records zero writes); `clearDerived.ts` and `cacheInventory.test.ts` are unchanged. |
| QA-39 | Paging (FR-37) | With 250 rows, 100 render with a Show next 100 and a Show all control; Show next 100 renders 200; Show all renders 250 and removes the controls; after activating either, `document.activeElement` is not `body`; the count sentence reads 250 throughout. |
| QA-40 | Index-keyed ids (FR-38) | A static scan of the tab's components finds no `id=` or `aria-*` IDREF attribute built from a species name, location or other row field; a fixture with a species named `"><img` renders without a duplicate or malformed id. |
| QA-41 | No network beyond the codes batch (FR-39) | Mounting the tab, loading both files, toggling every control and paging to Show all records exactly one `/taxonomy/codes` post at the transport seam per derivation (one for the load, none for any control change, one more only after a files-epoch change that alters the roster's name set), zero other transport calls, zero fetches and zero hotspot-set loads (spies on each, otherwise unchanged); the import-graph check of QA-15 holds. |
| QA-42 | Help updated (FR-40) | `docs/HELP.md` contains a "## Life Lists" heading directly after the Checklists section, and the Getting Started and Default Files tab lists name Life Lists; the file contains no U+2014. |
| QA-43 | Published copy held (FR-41) | No diff to `README.md`, `website/`, `appstore/LISTING.md`, `PRIVACY_POLICY.md` or the Fastlane metadata in the feature's commits before the user's yes; any proposal exists only as a held patch under `pipeline/life-lists-tab/`. |
| QA-44 | Linear derivation (NFR-01) | A guard with its own `testTimeout` derives over generated backups of N and 10N rows (and ML exports of M and 10M rows) and asserts the CPU-time ratio, read through the shared `cpuTiming` helper, stays within the linear band the Architect states; the derivation module contains no nested loop over rows. |
| QA-45 | Toggle cost (NFR-02) | Toggling a switch or media button after load does not re-invoke the two file passes (a counter on each pass increments only on a files-epoch change). |
| QA-46 | Memory bound (NFR-03) | The derived structure for a fixture holds exactly one first-sighting record per species and at most one record per species per format; a new files epoch drops the previous derivation (no reference retained in module scope). |
| QA-47 | 320px and 200% readability (NFR-04) | At a 320px viewport and at 200% text scale in the built app, every row's name, date, time, checklist and location are visible without horizontal scrolling, every control is reachable by Tab in reading order and operable by keyboard, and the live look before the deploy gate records a screenshot of each. |
| QA-48 | Live region (NFR-04) | The count sentence sits in a polite live region whose text updates after the selection settles (not on every intermediate render). |
| QA-49 | Tokens and themes (NFR-05) | A stylesheet and inline-style scan of the tab's components finds every color as `var(--sr-*)` and each token defined in both themes; no inline pixel width on a layout container. |
| QA-50 | Entry chunk (NFR-06) | `entryChunk.test.ts` passes; the entry chunk's size change is attributable to the registry entries alone. |
| QA-51 | No new user-text scan (NFR-07) | The Architect's schema names the two bounded parses (day and clock) with their linearity argument and the `security.md` citation; the derivation module reads only parsed fields and imports no regex over raw file text. |
| QA-52 | No platform gating (NFR-08) | `androidReadings.test.ts` and `androidInsetsCss.test.ts` pass; the tab's components import no `isIOS`, `isAndroid` or platform-gate predicate. |
| QA-53 | Copy rules (NFR-09) | A scan of the tab's components, its copy module and the HELP section finds no U+2014; the FR-27 and FR-33 sentences match the PRD verbatim, including the serial comma. |
| QA-54 | Position numbers (FR-42) | With 3 rows the numbers read 3, 2, 1 top to bottom; on a 250-row list after Show next 100 the 101st rendered row reads 150; selecting Photo on that list renumbers so the top row reads the Photo count from the FR-33 sentence; the number is rendered as text, not inside an anchor, and no element id or IDREF contains it; the name cell's screen-reader prefix reads "N of M." for the same N and M. |
| QA-55 | Scientific name and species-link marks (FR-43) | A fixture whose first-sighting row carries Scientific Name "Setophaga coronata auduboni" renders "Setophaga coronata" beneath the common name, and an ML row with a different scientific name does not change it; with the code map resolved, the row carries the eBird and Birds of the World marks with the same hrefs Checklists would produce for that code; with the resolve rejected or still pending, the row renders without marks and the row order and count are identical; the codes post carries the roster's normalized names once per derivation. |
| QA-56 | Media presence cell (FR-44) | With an ML export loaded, a species with a photo and audio but no video shows the first two slots in the text ink and the third as the faint outline, with the accessible label naming photo and audio in that order; a species with no asset shows three faint slots and the "No media" label; the cell has no link, no button and no tab stop; with no ML export, or an unreadable one, no row renders the cell. |
