# PRD: Life Lists Region Filter
**Feature:** life-list-region-filter
**Date:** 2026-11-09
**Stage:** 2, The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

A Region control on the **Life Lists** tab (`life-lists`; not Multimedia) that narrows the list to one eBird region the user has birded, a country, a state/province or a county, and shows that region's life list: the species with a sighting inside it, each dated to its first in-region sighting, or, under the media buttons, to its first in-region asset. The region is derived from the loaded backup, applied before the existing switches and media selection, and remembered by the app.

Requirement IDs below are this feature's own. Where a requirement of the shipped tab is meant, it is cited as `tab FR-nn` (from `pipeline/life-lists-tab/prd.md`).

## User Stories

> **US-01** As a birder with a home county, I want to pick that county on Life Lists, so that I see my county life list dated to the first time I saw each species there, not the day I first saw it anywhere.

> **US-02** As a birder who keeps a state list and a country list, I want to pick a state/province or a country the same way, so that one control covers every level eBird keeps a life list at.

> **US-03** As a birder, I want the regions offered to be only the places in my own backup, so that I never scroll past places I have not birded and nothing is looked up online.

> **US-04** As a birder with a Macaulay Library export, I want the Photo, Audio and Video lists under a region to be dated to my first photo, recording or video taken on a checklist inside that region, so that my county photo list means what eBird's would.

> **US-05** As a birder, I want the Include Exotics and Include Escapees switches to keep their meaning under a region, so that the regional count follows the same rule as the world count.

> **US-06** As a birder who always opens the tab on my county, I want the region I chose remembered on this device, so that I do not pick it again after every launch, while the switches and media buttons still start fresh.

> **US-07** As a screen reader user, I want the count sentence and the empty state to name the region and to be announced when I change it, so that I know which list I am reading.

## Functional Requirements

### Region choices

> **FR-01** The tab shall derive its region choices from the loaded eBird backup only, from the observations that are eligible to establish a first sighting (a valid `YYYY-MM-DD` day, a countable form, a non-empty submission id; tab FR-10 to FR-12), at three levels: country, state/province, county. No other source (eBird's region API, a bundled boundary set, the ML export) shall supply a choice, so every offered region holds at least one countable species before the switches are applied.

> **FR-02** The three levels shall be defined from the observation's State/Province and County cells exactly as the parser delivers them: the **country** is the text of the State/Province cell before its first hyphen, or the whole cell when it has no hyphen; the **state/province** is the whole State/Province cell, offered only when the cell contains a hyphen; the **county** is the pair (State/Province cell, County cell), offered only when the County cell is non-empty and the State/Province cell contains a hyphen. A cell longer than the stored bound the schema names (16 characters for State/Province, 96 for County) is not offered at any level. A county's identity is the pair, so two counties with the same name in different states are two choices, and a county is never offered under a country alone.

> **FR-03** An observation whose State/Province cell is empty or missing shall contribute to no region choice and shall belong to no region; it still counts in the unfiltered list. A non-empty County cell beside an empty State/Province cell offers nothing.

> **FR-04** Choices shall be presented grouped by level in the order country, state/province, county, each group ordered by its label (locale compare), de-duplicated by identity, never by label. Default labels, which the Designer may restyle but not re-source: a country shows its English name, resolved offline from locale data the app already has, with no bundled table, no network and no new host or endpoint (for example "United States"), and a code the app cannot name (unknown, user-assigned or malformed) shows as itself, as the backup spells it; a state/province shows the app's existing offline region name where one is known and the code otherwise (`regionName`); a county shows the Checklists place form "County, ST" (`placeOf`). The choice list shall carry no per-choice count unless the Designer adds one from the same derivation.

> **FR-05** The unfiltered state shall be a choice of its own (default wording "Everywhere") and shall be the state with nothing saved. In the unfiltered state the tab shall behave exactly as it does today: same rows, same dates, same sentences, same order, same positions, for every combination of switches and media buttons.

> **FR-06** The choices shall be re-derived whenever the data-file epoch changes (either file saved, replaced or removed, by any writer), through the same load effect dependency the tab already keys on.

### The Region control

> **FR-07** The tab shall show one Region control in its control strip through which exactly one region, or the unfiltered state, is selected at a time. The control shall be keyboard operable, shall expose its current selection to assistive technology, and when it offers type-ahead shall filter choices by label. Every button-shaped part of it renders through the native `Button` primitive, and every DOM id or ARIA IDREF it mints (listbox, option, active descendant) is keyed on an index, never on a region's text.

> **FR-08** The control shall be present whenever a backup is loaded. When the loaded backup yields no region choice (FR-01 and FR-03 leave nothing), the control shall offer only the unfiltered state and render disabled with that state exposed; the list is the unfiltered list.

> **FR-09** Selecting a region or the unfiltered state shall behave as a control press, exactly as a switch press does today: the list re-derives, paging resets to the first page, the live-region announcement is re-keyed, and rows the change adds receive the same added-row treatment. Keyboard focus shall stay on the Region control; it never moves to the document body.

### The regional first-sighting list

> **FR-10** With a region selected and no media format selected, the list shall contain exactly the species on the current roster (tab FR-10 to FR-19, after the switches of FR-17) that have at least one first-sighting-eligible observation inside the region. Each row shall be dated to that species' earliest in-region observation under the existing order (day, then time with blank last, then submission id; tab FR-11), with that observation's time, checklist and place. A species whose global first sighting lies outside the region shall never show its global date, checklist or place in a regional list.

> **FR-11** Membership shall be decided from the observation's own State/Province and County cells: inside a country when the cell's country part (FR-02) equals the country; inside a state/province when the whole cell equals it; inside a county when both cells equal the pair. Comparison is exact on the parsed text, with no further normalization.

> **FR-12** A row's scientific name shall be the binomial reduced from the observation that dates the row (tab FR-43's rule); its media presence cell (tab FR-44) shall stay what the species has anywhere, the same whatever the region, as it is the same whatever the media selection today.

### The regional media lists

> **FR-13** With a region selected, an ML asset shall be inside the region exactly when its checklist id is non-empty and equals the submission id of a checklist in the loaded backup whose State/Province and County cells place it inside the region by FR-11. A checklist's cells are read from its observations in the backup; the backup does not disagree within one checklist, and if it ever did, the first observation in file order would govern.

> **FR-14** An asset with an empty checklist id, or whose checklist id matches no submission id in the loaded backup, shall be outside every region and shall never date or admit a row in a regional media list; it still counts in the unfiltered media lists exactly as today.

> **FR-15** Under a region with one or more formats selected, each species' per-format first asset shall be its earliest in-region asset under the existing order (day, then clock with blank last, then catalog id; tab FR-22); the single-format row and the combined-date rule for two or three formats (tab FR-24, FR-25) apply unchanged to those in-region firsts; and a species shall appear only if it is on the regional roster of FR-10 and has an in-region first asset in every selected format (tab FR-23, with the roster now regional).

> **FR-16** The ML export's own County, Locality, latitude and longitude cells shall never decide region membership.

### Composition, order, count and copy

> **FR-17** Include Exotics and Include Escapees shall keep their meaning and defaults (tab FR-14 to FR-20; Include Exotics starts on): they act on the regional roster by species name exactly as they act on the world roster, so the region only changes which rows they act on. The status line under the switches is unchanged.

> **FR-18** Rows shall keep the existing newest-first order (tab FR-28), and positions shall renumber within the current selection, the oldest row 1 and the newest the full count (tab FR-42), under every region.

> **FR-19** With a region selected, the count sentence shall name the region by its label (FR-04) and state the in-region dating, in every one of the eight media states; with the unfiltered state it shall be today's sentence verbatim (tab FR-33). Default templates for the Designer: no format, "N species in {region}, newest first by the date of your first sighting there."; one format, "N species with {a photo | audio | video} in {region}, newest first by the date of {your first photo | your first audio recording | your first video} there."; two or three formats, "N species with {list} in {region}, newest first by the date each had {both | all three} there." N remains the full row count before paging.

> **FR-20** With a region selected and no rows, the empty-state sentence shall name the region: default "No countable species in {region} yet." with no format selected and "No species matches this selection in {region} yet." with any format selected. Unfiltered, the existing sentences stand (tab FR-34).

> **FR-21** On every region change the count sentence shall be announced through the tab's existing polite live region, once, as switch and media presses are announced today.

### Persistence

> **FR-22** The selected region shall persist through the `storage` seam (per device on the desktop and mobile apps; on web/Pi the settings document is the install's, so every browser that opens it sees the choice)'s settings document (`storage.setSetting`) under one key, written only when the user changes the selection, with the unfiltered state written as the absence of a region, so a fresh install and an explicit return to Everywhere read alike. The write is best-effort: a failed write shall neither block the selection nor show an error.

> **FR-23** The tab shall read the saved region during its loading phase, so the first list it renders for a saved region that exists in the loaded backup is already that region's list, with the control showing it; the unfiltered list shall not flash first.

> **FR-24** A saved region that is not among the current choices (after a file replace, a clear, or a backup with no such place) shall read as the unfiltered state silently, with no message and no write; the stored value is not required to be cleared. Until the user changes the selection in this session, the saved value is consulted again at every epoch, so a region that returns with a later file applies again; after a user change, the session's choice governs and is what is saved.

> **FR-25** A stored value shall be accepted only when its shape is the one the app writes, its level is one of the three, and each text part is within the length bounds of NFR-04; anything else reads as the unfiltered state. A stored region is only ever matched against the derived choices; its text is never rendered, never placed in a DOM id, IDREF or URL, and never used to build a label.

> **FR-26** The switches and the media selection shall stay session-only (tab FR-36; QA-38 of the tab PRD holds): a switch or media press performs no storage write; only a region change writes, and it writes only the region key.

> **FR-27** The feature shall add nothing to iCloud Sync (no item kind, no change to what sync carries) and shall register nothing in `clearDerived.ts`: the saved region is a UI preference of the same kind as the Targets tab's remembered county (`targetsCounty`), which follows this precedent. Open Question 6 records the alternative.

### Re-derivation and network

> **FR-28** Every region-derived structure (the choices, each observation's membership, the checklist-to-cells join of FR-13, the saved region's application) shall be re-derived when the data-file epoch changes and shall not be re-derived on a control press; a press only re-selects over structures already derived.

> **FR-29** The feature shall make no third-party request, add no new endpoint or host, and move no request between components; the one existing batched `/taxonomy/codes` post of tab FR-43 shall be unchanged in shape, count and trigger (once per roster-name change, and a region change that does not change the roster's set of names issues none). No request a system component makes from the app's process is added. On web/Pi the only HTTP the feature adds is the settings read and write through the `storage` seam, to the user's own server.

### Help and published copy

> **FR-30** `docs/HELP.md`'s "## Life Lists" section shall be updated in the same change: the Region control and its three levels, that choices come from the backup, the in-region first-date meaning, the media-by-checklist rule and that an unlinked item counts only under Everywhere, and that the region is remembered on this device while the switches and media buttons stay per-session. No U+2014 anywhere in the section.

> **FR-31** The build may prepare at most one proposed sentence each for the README, the website and the App Store listing as a held patch under `pipeline/life-list-region-filter/`; nothing shall be written to those surfaces, or to the privacy policy, without the user's explicit yes. The release carries a patch version bump with its CHANGELOG entry.

## Non-Functional Requirements

> **NFR-01, Performance:** The region derivation adds one linear pass over the loaded observations (choices, membership keys and the checklist-to-cells join together) and one linear pass over the ML rows per epoch, each a fixed amount of work per row, keyed by Maps on parsed text; a region press costs the existing selection pass's class (tab NFR-01) and nothing superlinear. The tab's linearity suite (`lifeListsLinearity.test.ts`) gains rows for the new pass in both species shapes, with limits derived as that suite derives them.

> **NFR-02, Security (bounded allocation):** Every allocation sized by region count carries a second bound the content cannot inflate: the number of choices is at most three per distinct (State/Province, County) pair, and the number of distinct pairs, like the number of distinct submission ids in the join, is at most the observation count, which the upload cap already bounds (`EBIRD_MAX_UPLOAD_BYTES_BY_PLATFORM`, about 150k rows). The schema shall state both bounds beside the structures they bound.

> **NFR-03, Security (scans over user-file text):** The only character-level read the feature adds over user-file text is the country-prefix read of the State/Province cell, which is the bounded hyphen scan `placeOf` already declares (at most `STATE_CODE_SCAN_CHARS`, 16 characters, one pass, no regex); every other operation is exact equality of parsed cells as Map keys. The schema shall declare this read with the `security.md` citation and its measured cost per draw and re-draw, and any module the region logic lands in shall sit inside `security.md`'s `frontend/src/lib/lifeLists*.ts` gate or extend that gate in the same change.

> **NFR-04, Security (stored value):** The saved region is read through one validator that checks shape, level and per-part length bounds (a State/Province or country part at most `STATE_CODE_SCAN_CHARS`; a county part at most a stated constant of the same kind, 96 characters recommended) before any comparison; the matching is exact against the derived choice set and the matched choice, never the stored text, supplies the label.

> **NFR-05, Accessibility:** WCAG 2.1 AA at 320px wide and 200% text scale in both themes, every color through `var(--sr-*)` tokens; the Region control is operable by keyboard alone with its selection and, where it expands, its expanded state exposed; its options are reachable by a screen reader; the count sentence announcement reaches the existing live region; any hover look sits inside `@media (hover: hover)` per the shared control register.

> **NFR-06, Compatibility:** The derivation is pure over parsed rows, so the same inputs give identical rows, dates and positions on web/Pi and in the native apps on every platform, and the control renders on the Android floor (Chromium 111) and in WKWebView without a platform-specific path.

> **NFR-07, Storage:** The settings write goes through the seam as every preference does: in the native apps it is a link on the settings document's per-document chain, and on web/Pi it carries `APP_REQUEST_HEADERS`; the feature builds neither, it only uses `storage.setSetting` and `storage.getSetting`.

## Out of Scope

- Locations and hotspots as a filter level; a per-location list is a different object.
- eBird's region API, region names or boundaries beyond the backup's own cells and the app's existing offline name table; no bundled country-name table and no region API: country names come from the engine's own locale data or fall back to the code.
- Polygons, radius filters, multi-select, multi-region comparison, per-region counts in the chooser, export.
- Changes to Statistics, Targets, Multimedia, Species Detail, the Calendar, any other tab, or the exotic-provenance pass and its documents.
- Carrying the preference across devices by iCloud Sync, and any change to what Clear removes (FR-27 and Open Question 6).
- Any change to the world list's semantics, order, positions or sentences in the unfiltered state (FR-05 pins them).
- Regional media presence marks (FR-12 keeps the cell global).
- Changes to README, the website, the App Store listing or the privacy policy beyond the single held proposal sentence per surface (FR-31).

## Open Questions

1. **Control wording and shape.** The Designer's call. Default: a control labelled "Region" whose unfiltered choice reads "Everywhere", built from the Targets tab's county picker (`frontend/src/components/targets/TargetsCountyPicker.tsx`, an `aria-activedescendant` combobox with index-keyed option ids) as the in-house precedent, grouped by level with type-ahead over labels; a plain select is acceptable if the Designer prefers it at the choice counts a real backup produces (hundreds of counties are common).
2. **Country labels.** Resolved by the user at the design review, 2026-11-09: a country is shown by its English name, resolved offline from the engine's own locale data (no bundled table, no network, no new host or endpoint), falling back to the code as the backup spells it where no name resolves; identity, matching and the stored value stay the code. States and provinces keep `regionName`, which falls back to the code outside the US and Canada; a county keeps "County, ST".
3. **Media presence marks under a region.** Default: global, what the species has anywhere (FR-12), because the cell is already defined as the same whatever the selection and a regional reading would flip on unlinked assets.
4. **Position of the Region control in the strip.** Designer's call. Default: first in the strip, before the switches, because it narrows what the switches act on.
5. **Setting key name.** Architect's call. Default: `lifeListsRegion`, one key, a small object naming the level and the backup cells.
6. **Is the saved region removed when the user clears their data?** Default: no, following `targetsCounty` (a preference, not a derived store; FR-27). If the Security stage rules that a stored county name is user-file content that must not outlive a clear, the fix is a best-effort delete of the one key in the Settings delete path, not a `clearDerived.ts` row, and no privacy sentence changes because the key is overwritten by the next choice and holds a place name only.
7. **Should regions whose only species are escapees be offered?** Default: yes. FR-01 requires a countable species before the switches; the empty state names the region when the switches leave nothing.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Choices from eligible observations only (FR-01) | A fixture with observations in US-CA/Marin (countable, dated), US-NV/Clark (a spuh only) and US-OR/Lane (an undated row only) offers US, US-CA and (US-CA, Marin) and offers nothing for Nevada or Oregon; no transport, `lib/tauri/` service or network call appears in the derivation's import graph. |
| QA-02 | Level definitions and county identity (FR-02) | A cell "US-CA" with county "Marin" yields country "US", state "US-CA", county ("US-CA", "Marin"); a cell "GI" with no hyphen yields country "GI" and no state choice; a county "Orange" under "US-CA" and under "US-FL" are two distinct choices; an observation with county "Marin" and no hyphenated state yields no county choice. |
| QA-03 | Empty State/Province contributes nothing (FR-03) | An observation with an empty State/Province cell and county "Marin" yields no choice at any level, belongs to no region, and its species is listed unfiltered. |
| QA-04 | Grouping, order, labels, de-duplication (FR-04) | Choices render as the three groups in order, each sorted by its displayed label; "US" lists as "United States" and "MX" as "Mexico", and a code the engine cannot name ("XZ", or an empty-name case) lists as the code itself; the country group's order follows the displayed names, not the codes; "US-CA" labels "California", "MX-BCN" labels "MX-BCN", a county labels "Marin, CA"; two observations in the same county produce one choice. |
| QA-05 | Unfiltered state is today's list (FR-05) | With Everywhere selected, the rows, dates, positions, count sentence and order equal the pre-feature derivation's output for the same fixture under all eight media states and all four switch states (a golden comparison against `selectRows` as shipped). |
| QA-06 | Choices follow the epoch (FR-06, FR-28) | Replacing the backup with one whose places differ changes the offered choices without a reload of the tab; a control press between epochs does not re-run the region derivation (a call counter reads one build per epoch). |
| QA-07 | Control semantics (FR-07) | The control exposes exactly one selected value to assistive technology, is operable by keyboard alone (open, move, select, close), filters by label when typed into if type-ahead is offered, renders every button part through `Button`, and no id or IDREF it mints contains a region's text (`tabOrderCoverage` passes; a scan of minted ids against fixture place names finds none). |
| QA-08 | No-choice backup (FR-08) | With a backup whose every State/Province cell is empty, the control offers only Everywhere, is disabled with that state exposed, and the list is the unfiltered list. |
| QA-09 | A region change is a control press (FR-09) | After Show next 100 on a 250-row list, selecting a region resets paging to the first page, re-keys the live region, gives added rows the added treatment, and `document.activeElement` is still inside the Region control. |
| QA-10 | Regional first-sighting rows (FR-10) | A species first seen in US-NV on 2019-05-01 and in (US-CA, Marin) on 2021-03-02 shows 2021-03-02 with that observation's time, checklist and place under Marin, under US-CA, and under US; it is absent under (US-CA, Sonoma), where it has no observation, and under US-NV it shows 2019-05-01; a species never seen in the region is absent. |
| QA-11 | Exact membership (FR-11) | "US-CA" is inside country "US" and state "US-CA" and not inside "US-CO"; a county row matches only when both cells equal the pair; "us-ca" does not match "US-CA". |
| QA-12 | Scientific name and media marks under a region (FR-12) | The row's binomial comes from the in-region dating observation; the media presence cell for a species with a photo only outside the region still shows the photo slot present under the region. |
| QA-13 | Asset membership by checklist join (FR-13) | An ML row with checklist "S100" whose backup observations carry US-CA/Marin is inside Marin, US-CA and US, and outside (US-CA, Sonoma) and US-NV, regardless of the ML row's own County cell. |
| QA-14 | Unlinked assets count only unfiltered (FR-14) | An ML row with an empty checklist id, and one with checklist "S999" absent from the backup, each date their species' Photo row under Everywhere and are ignored under every region (the species' Photo row under the region is dated to the next in-region photo or the species is absent). |
| QA-15 | Regional per-format firsts and combination (FR-15) | Under a region, Photo dates a species to its earliest in-region photo even when an earlier photo exists outside; Photo plus Audio lists only species with both in-region, dated to the later of the two in-region firsts; a species with an in-region photo but no in-region sighting on the roster is absent. |
| QA-16 | ML geography never decides (FR-16) | Changing an ML row's County, Locality, latitude and longitude does not change any regional list; changing its checklist id to one in another region does. |
| QA-17 | Switch composition (FR-17) | Under a region with Include Exotics off, a published exotic-only species with an in-region sighting is absent; with it on, present; Include Escapees likewise; the status line text is unchanged from today. |
| QA-18 | Order and positions (FR-18) | Under a region with 3 rows the positions read 3, 2, 1 top to bottom, newest first; the same species carries a different position under Everywhere; the screen-reader prefix reads "N of M." for the regional M. |
| QA-19 | Count sentence names the region (FR-19) | Under (US-CA, Marin) with no format the sentence reads "N species in Marin, CA, newest first by the date of your first sighting there." (or the Designer's approved template, swept over all eight media states by the copy suite); under Everywhere each of the eight sentences equals today's verbatim; N equals the full row count after Show next 100. |
| QA-20 | Empty state names the region (FR-20) | A region whose roster is emptied by the switches reads the region-naming empty sentence; with a format selected, the selection form; under Everywhere the existing sentences are byte-identical. |
| QA-21 | Announcement (FR-21) | Selecting a region re-renders the polite live region's child with the new count sentence exactly once per change (the keyed span's key advances by one). |
| QA-22 | Persistence write (FR-22) | Selecting a region calls `storage.setSetting` once with the one key and a value naming level and cells; selecting Everywhere writes the absence form; a rejected write leaves the selection applied and renders no error; a seam spy records no other key. |
| QA-23 | Saved region applied before first render (FR-23) | With the key saved for a region present in the backup, the first non-loading render shows that region's rows and the control's selection, and no render in between shows the unfiltered count sentence. |
| QA-24 | Absent saved region falls back silently (FR-24) | With a saved county absent from the loaded backup, the tab renders the unfiltered list, the control reads Everywhere, no message renders, and no write occurs; replacing the file with one that holds the county (no session choice made) applies it again; after a session choice, a later epoch keeps the session's choice. |
| QA-25 | Stored value validation (FR-25, NFR-04) | A stored string, an object with an unknown level, a county part over the bound, or a state part over 16 characters each reads as Everywhere with no throw; a valid stored region whose text differs from every choice is never rendered anywhere in the DOM. |
| QA-26 | Switches and media stay session-only (FR-26) | Toggling each switch and each media button records zero storage writes; `cacheInventory.test.ts` and `clearDerived.ts` are unchanged. |
| QA-27 | No sync, no registry (FR-27) | `ITEM_SUBDIRS` and its Rust twin are unchanged; `clearDerived.ts` has no new row; the setting key appears in no iCloud module. |
| QA-28 | No network, codes post unchanged (FR-29) | On both transports a region change with the same roster names issues zero requests; a derivation issues exactly one `/taxonomy/codes` post as before; no new host, endpoint or route appears (`tauriHttpScope` and `tauriCsp` guards unchanged); a Vite proxy diff is empty. |
| QA-29 | Help updated (FR-30) | `docs/HELP.md`'s Life Lists section names the Region control, the three levels, the in-region first-date meaning, the checklist rule for media and unlinked items, and the remembered region beside the per-session switches; the file contains no U+2014; `lifeListsPublishedClaims.test.ts` passes. |
| QA-30 | Published copy held, version bumped (FR-31) | No diff to `README.md`, `website/`, `appstore/LISTING.md`, `PRIVACY_POLICY.md` or the Fastlane metadata before the user's yes; proposals exist only under `pipeline/life-list-region-filter/`; the six-file version set is bumped by one patch with a CHANGELOG entry. |
| QA-31 | Linearity (NFR-01) | `lifeListsLinearity.test.ts` rows for the region pass read at or under their derived limits at 5k/50k rows in both species shapes, measured through `cpuTiming.ts`; the non-vacuity mutant is caught. |
| QA-32 | Bounds stated and held (NFR-02, NFR-03) | The schema names both bounds for every region-sized structure and declares the prefix read with the `security.md` citation and measured cost; a fixture of 150k observations each with a distinct (state, county) pair derives at most 3 x 150k choices and completes; the region module's path matches `security.md`'s `lifeLists*.ts` glob or the glob was extended in the same change. |
| QA-33 | Accessibility (NFR-05) | At 320px and 200% text scale in both themes the control, the strip and the sentences render with no horizontal scroll and AA contrast via tokens; keyboard-only selection works; axe reports no violation on the tab with the control open and closed. |
| QA-34 | Cross-platform parity (NFR-06) | The region derivation and `selectRows` produce identical row arrays for the same fixture under the Tauri and web/Pi seams in the convergence-style suite. |
