# PRD — Recorded Names in Splits and Lumps
**Feature:** recorded-names-in-splits-and-lumps
**Date:** 2026-11-18
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

The Species Detail section that charts eBird's splits and lumps gains a count on each earlier name: how many of the user's reports eBird held under that name until the update, worked out from report dates and, for a lump, from the form a report still carries. Word-changing renames of a species' common name join the bundled record as a third kind of change, and the section is renamed "Splits/Lumps/Renames".

This PRD amends the shipped feature's PRD, `pipeline/taxonomic-splits-lumps/prd.md`. Its requirement IDs are cited here with the prefix **TSL** (TSL FR-17 is that PRD's FR-17). Anything in that PRD this document does not name stays in force.

### Shipped requirements this PRD changes

| Shipped item | Disposition here |
|---|---|
| TSL Out of Scope, first item ("pure renames of common or scientific names without a split or lump") | **Reversed in part.** A rename that changes a word of a species' common name is now in scope (FR-01 to FR-05). Scientific-name-only changes, spelling-only and punctuation-only renames, and renames of group or form names stay out. |
| TSL FR-01 (the record holds split and lump events) | **Extended.** A third kind, rename (FR-01). |
| TSL FR-04, TSL FR-05 (generator fails closed; CI holds the record) | **Extended** to renames and to kept forms (FR-05, FR-07). |
| TSL FR-06, TSL FR-07 (what makes a species affected; the retired-name match) | **Extended** to renames (FR-08, FR-09). The matching path itself is unchanged. |
| TSL FR-08 (a form row matches through its parent, never on its own) | **Kept for every shipped figure. Changed in one respect:** on a lump, the form a report carries now decides which earlier-name box counts it (FR-16). |
| TSL FR-10, FR-11, FR-13, FR-14, FR-21 (the control's label, the kind words, the section title, the zero and not-affected lines) | **Changed** to follow the new name and the third kind (FR-28 to FR-30). |
| TSL FR-16 (report count and its two-way partition) | **Kept unchanged.** Every new figure is defined from it (FR-11). |
| TSL FR-17 (eBird is named as the assigner; the section never suggests which new species an older report belongs to) | **Posture kept in full** (FR-26). Its lump sentence, "Your backup no longer carries the earlier names", is **reworded** because it is false for a traced lump (FR-24). |
| TSL FR-18 (an entry with no rows shows a "not in your data" marker in place of counts) | **Reversed for earlier names.** An earlier name now shows the earlier-name figure or one of the states in FR-18 to FR-21. Kept for current-side names. |
| TSL FR-19 (a backup exported before an update) | **Kept unchanged, and extended** to renames and to the mixed case (FR-20). |
| TSL FR-22 (text equivalent) | **Extended** to every new figure and state (FR-32). |
| TSL FR-29 (four-file version set) | **Superseded by the project rule:** the bump is the six-file set in CLAUDE.md (FR-37). |
| TSL NFR-06 ("Split" and "Lump" are the kind words) | **Extended:** "Rename" is the third. |
| TSL FR-09, FR-12, FR-15, FR-20, FR-23 to FR-28, NFR-01 to NFR-05, NFR-07 | **Kept unchanged.** |

## User Stories

> **US-01** — As a birder who reported a species before eBird split it, I want the earlier name's box to show how many of my reports eBird held under that name until the update, so that the name I knew the bird by is not an empty box.

> **US-02** — As a birder with reports from before a lump, I want to see how those reports divided between the species that were merged, wherever my backup can still show it, and a plain statement wherever it cannot, so that I am never shown a guessed name.

> **US-03** — As a birder whose species eBird renamed, I want it listed with the update that carries the new name and charted with its earlier name and my reports, so that a renamed bird is no longer missing from the section.

> **US-04** — As a birder reading any of these counts, I want one short explanation of how they were worked out and what they cannot say, so that I do not mistake them for a record of what I typed.

> **US-05** — As a birder whose backup was exported before an update, I want the section to behave exactly as it does today, so that the new counts never contradict or double count the names my backup still carries.

> **US-06** — As a birder using a screen reader, I want the text equivalent to carry the same figures, states and wording as the chart, so that nothing is available only by sight.

> **US-07** — As a birder offline or without an eBird key, I want all of it to work from what is already on my device, so that it is available wherever my data is.

## Functional Requirements

### Terms used below

These are definitions, not requirements. Every requirement that uses one of these words means exactly this.

- **Report:** one row of the loaded eBird backup (TSL FR-16).
- **Update date:** an event's published date. **On or before** and **after** are the two sides of the shipped partition in TSL FR-16; a report dated exactly on the update date is on or before.
- **Earlier name:** a before-side entry of an event. **Current-side name:** an after-side entry, or a slash entry a split created.
- **Direct reports** of an entry: the reports the shipped matching (TSL FR-06 to FR-08) assigns to that entry. This is the count the section shows today.
- **Reassigned figure** of a current-side name: its direct reports dated on or before the update date (today's "reassigned by eBird" figure). **Recorded-since figure:** its direct reports dated after it.
- **Earlier-name figure:** the new count on an earlier name, defined per kind in FR-13, FR-15 and FR-16.
- **Kept form:** for an earlier name of a lump, the form eBird kept for it, defined in FR-06. An earlier name with a kept form is **traced**; one without is **not traceable**.
- **Pre-update evidence:** an event has it when at least one of its earlier names holds one or more direct reports, which means the backup still carries a name that update retired (FR-20).
- **Later-changed event:** an event one of whose current-side codes a later covered split or lump lists on its earlier side (FR-21). A later rename does not make an event later-changed.

### The record and its generator

> **FR-01** — The bundled record shall carry rename events beside split and lump events. A rename event shall carry: its kind; the update that first carries the new name, as a year and a published date; exactly one earlier name and exactly one current-side name, each with a species code, a scientific name and a common name, and both with the same species code; whether the earlier common name is no longer any species' common name in the bundled taxonomy (the same "retired" fact split and lump entries carry); and no slash entries. The current-side name of a rename shall be the name that update's own file gives the code, so a species renamed in two covered updates reads A to B on the first event and B to C on the second.

> **FR-02** — The generator shall derive a rename event for a species code and a covered update when all of these hold: the code is a species in Cornell's eBird taxonomy file for that update and in the file for the previous update (the 2018 file for 2019, the 2019 file for 2021); the code is not an earlier name, a current-side name or a slash entry of any split or lump event of that same update; and the two files' common names for the code differ under the rule in FR-03. One code renamed in two covered updates yields two events. A change of scientific name alone yields none.

> **FR-03** — Two common names shall count as the same name, and yield no rename, when they are equal after these steps applied to both, in this order: (1) decompose accented letters and drop the accent marks; (2) lowercase; (3) replace every occurrence of "grey" with "gray"; (4) remove every hyphen, every space and every apostrophe, where apostrophe means the straight apostrophe, the left and right curly apostrophes, the grave accent used as an apostrophe, and the modifier-letter apostrophe and okina. Names that still differ after these steps are a rename. This rule is the whole definition: a difference in any character the steps do not name, including a single changed letter, is a rename. The rule shall be stated in one place in the generator, and the app shall never re-derive it at runtime.

> **FR-04** — A rename shall be dated to the update whose file first carries the new name, and to nothing finer. The record shall hold no claim about the day eBird began using the new name.

> **FR-05** — The generator shall stay fail closed with renames added. It shall write nothing when any rename lacks a code, either name or a published date; when a rename's two names are equal under FR-03; when a rename's code also appears on a split or lump event of the same update; or when one code has more than one rename in one update. Adding renames shall leave every split and lump event exactly as the committed record holds it, and each covered year's splits and lumps shall still reproduce eBird's announced tally. On a successful run the generator shall print, per covered update, how many name changes it kept as renames and how many it left out under FR-03.

> **FR-06** — For every earlier name of every lump, the app shall know from bundled data alone whether eBird kept a form for it and what that form is called now. An earlier name has a kept form exactly when the bundled taxonomy carries the earlier name's own code as a taxon that reports as the lumped species' code and is not the lumped species' code itself. The kept form's name is the bundled taxonomy's current common name for that code. An earlier name whose code is absent from the bundled taxonomy, is the lumped species' own code, is a species again, or reports as anything else has no kept form.

> **FR-07** — A CI test shall hold the committed record to these properties, reading every figure from the committed assets when the test runs: every rename has the shape in FR-01 and names that differ under FR-03; no rename shares a code and update with a split or lump entry; every lump's kept-form facts equal an independent re-derivation of FR-06 from the bundled taxonomy; the record's byte length is within the existing bound (NFR-03); and the record stays off the entry chunk.

### Which species are affected

> **FR-08** — A species in the loaded backup shall be affected when it matches either side of a covered rename, by the same matching path that decides it for a split or a lump (TSL FR-06 to FR-08). A species touched only by renames is affected, appears in the control's list and has a chart.

> **FR-09** — A backup exported before a rename carries the earlier name. The app shall recognize it exactly as it recognizes a retired name of a split: the species is affected under the name the backup carries, and the rename event has pre-update evidence (FR-20). A report shall count as a direct report of a rename's earlier name only when its name is that earlier name and that name is no longer any species' common name in the bundled taxonomy. Where eBird has since given the earlier name to another species, a report under that name is read as the species that holds the name now, and never as an earlier-name report of the rename.

> **FR-10** — A rename in which eBird also changed the species code is not in the record. Such a species shall not be listed as renamed, and when selected with no other covered event it shall show the not-affected line (FR-29). No part of the app shall state that such a species was never renamed.

### Counting rules

> **FR-11** — Every figure in the section shall be computed from the whole loaded backup. The county and date filters and the "Show all forms" and "Show escapees" switches shall change no figure and no state, and the shipped one-line note shall still appear while a county or date filter is active (TSL FR-09). Every new figure shall be defined from the shipped per-entry counts and the shipped two-way partition (TSL FR-16). This feature shall introduce no second date comparison and no second rule for which reports count: a hybrid, a spuh, and a slash an event did not create count nowhere, and a report under a form counts with its parent species, as today.

> **FR-12** — Each event's figures shall use that event's own update date and no other. A species touched by more than one covered event shall show each event on its own line in date order (TSL FR-15), each with its own figures. One report may be counted on the earlier side of more than one event, once per event. The section shall show no figure that adds or nets counts across events.

> **FR-13** — **Split.** The earlier-name figure of a split shall be the sum of the reassigned figures of every current-side name of that event: every after-side name and every slash entry the split created, including a slash entry that is not drawn because the user holds no reports under it. It follows that the earlier name's count always equals the "reassigned by eBird" figures shown on the names it became, added together.

> **FR-14** — For a split, a report under a form of one of the new names counts with that new name, and therefore in the earlier-name figure, through the existing parent folding. The section shall never say whether a report dated on or before a split was entered as the plain species or as a form.

> **FR-15** — **Rename.** The earlier-name figure of a rename shall equal the reassigned figure of its one current-side name: the direct reports of the current name dated on or before the update date. The current-side name shall show its report count and the same two-way partition a split's or lump's current-side name shows.

> **FR-16** — **Lump, traced.** For each traced earlier name of a lump, the earlier-name figure shall be the number of the lumped name's direct reports that are dated on or before the update date and whose reported name, exactly as the backup spells it, is that earlier name's kept form. A report whose reported name is any other form, an out-of-date spelling of a kept form, or the plain lumped name is never counted under a traced earlier name.

> **FR-17** — **Lump, earlier name not recorded.** The lumped name's direct reports dated on or before the update date that FR-16 counts under no earlier name are the residual. Where at least one earlier name of the lump is traced and the residual is greater than zero, the section shall show the residual in its own box, labeled "Earlier name not recorded", with its count. It follows that in every such lump the traced earlier-name figures and the residual add up exactly to the lumped name's reassigned figure. With a residual of zero the box shall not appear. A residual report shall never be assigned to an earlier name.

> **FR-18** — **Lump, not traceable.** An earlier name with no kept form shall read "Not traceable in your backup" and shall carry no number. The section shall say why in a sentence, and the sentence shall be true for the reason that applies: either eBird kept no form for that earlier name, or the earlier name's own code carried on as the lumped species, so its reports read the same as any report with no form. In a lump where no earlier name is traced, no earlier box shall carry a number and the "Earlier name not recorded" box shall not appear.

> **FR-19** — **Zero.** An earlier name whose earlier-name figure is defined and equals zero shall show a zero state in place of a count. For a traced earlier name of a lump, the zero state shall be distinct, in the chart and in the text equivalent, from "Not traceable in your backup": one says the backup could show such reports and holds none, the other says the backup cannot show them. The wording of the zero states belongs to The Designer; their existence as separate states is fixed here.

> **FR-20** — **A backup exported before an update.** An event with pre-update evidence shall show the shipped figures and states only: each earlier name the backup carries is marked and counted as today, the "export predates that update" state appears under the shipped condition (TSL FR-19), and the event shows no earlier-name figure, no "Earlier name not recorded" box, no "Not traceable in your backup" marker and no explanatory paragraph (FR-25). This covers the shipped predates state and the mixed case where one earlier name is still carried while the lumped or split name also holds reports. A report shall never be counted both as a direct report of an earlier name and in an earlier-name figure of the same event. No sentence shown in this state shall say the backup no longer carries the earlier names. One exception to "the shipped figures and states", accepted as a correction (decision D-10): because FR-09 now recognizes a rename's earlier name, a report under a name that a covered rename retired, in a backup exported before that rename, reads differently at certain split and lump events than it did in the prior release. `schema.md` section 6.3 lists those readings (14 names on the committed record of 2026-11-18) and argues each direction; each shall read as that section states. No reading of any other name at a split or lump event shall differ from the prior release.

> **FR-21** — **A later change.** At a later-changed event the earlier-name figures would miss reports that the later split or lump moved to another code, or include reports it moved in. At such an event every earlier name shall show a marker saying its reports are not counted on this line because a later update changed one of the names it became, with no number and no zero state, and the event shall show no "Earlier name not recorded" box. Current-side names at such an event keep their shipped figures. The marker's wording belongs to The Designer. Where states could overlap, the order is fixed: FR-20 applies before this requirement, and this requirement applies before FR-13 to FR-19, so a later-changed lump shows this marker on every earlier name, traced or not.

### What the section shows

> **FR-22** — An earlier name with an earlier-name figure greater than zero shall show the count as "N reports" (singular for one) and, beneath it, a line built on the fixed basis "eBird's name for them until the update", with a singular form for a count of one. A traced earlier name of a lump shall also name its kept form.

> **FR-23** — Current-side names shall keep their shipped content: the report count, the two-way partition, the "Your species" marker and the "no reports" marker (TSL FR-14, FR-16, FR-18). For a rename, the label of the on-or-before figure shall not say eBird reassigned those reports to another species; the label itself belongs to The Designer.

> **FR-24** — Each event shall keep its one sentence stating what eBird did (TSL FR-17). The lump sentence shall no longer say "Your backup no longer carries the earlier names" for any lump with a traced earlier name; it shall say instead that eBird kept earlier names as forms where it did. The rename sentence shall name both names and say that the new name is in place as of that update's record. It shall not say the change was made on the published day or by that update, because the record shows only which update's file first carries the new name.

> **FR-25** — Under the chart of each event that shows at least one earlier-name figure greater than zero or an "Earlier name not recorded" box, the section shall show one explanatory paragraph. It shall say that the count is worked out from each report's date (and, for a lump, from the form the report carries) and not from what was typed; that the backup keeps only each report's current name; and that a report entered after the update for an earlier date is counted too. For a rename it shall also say that the name may have changed before that update, in which case reports dated between the change and the update are counted under the earlier name.

> **FR-26** — No string in the section shall claim what the user typed, claim the name a report had on the day of the sighting, or suggest, rank or propose which new species an older report of a split belongs to (TSL FR-17 stands). A split's earlier-name figure is one number for the one earlier name and is never divided between the new names beyond the shipped reassigned figures.

> **FR-27** — Every bird name the section draws, including an earlier name and a kept form's name, shall render through the standard bird-name component. An earlier name the backup does not carry and a kept form's name shall render unlinked and without site marks; the site marks stay on current names only (TSL FR-23). "Earlier name not recorded", the markers and the kind words are plain text.

### The name

> **FR-28** — The section's title shall be exactly "Splits/Lumps/Renames".

> **FR-29** — The control beside "Subspecies and forms", the head of the list it opens, the line shown when no species in the backup is affected, and the line shown for a selected species with no covered event shall each follow the new name and include renames. None of them shall say or imply that only splits and lumps are recorded. Their exact wording belongs to The Designer; the default for the control's label is the same string, "Splits/Lumps/Renames". The not-affected line shall say what the record holds for the species, never that the species was never renamed. The coverage statement (TSL FR-20) is unchanged.

### The control's list

> **FR-30** — The list shall hold every affected species, renamed species included, in the species selector's order. Each entry shall show the species name as the backup carries it and, for each covered event on its line, the kind as a word (Split, Lump or Rename) and the update year, most recent first. A rename entry's year is the year of the update that first carries the new name. The control's count shall equal the number of entries.

> **FR-31** — Choosing an entry shall behave exactly as it does today (TSL FR-12): it selects the species through the page's own path, closes the list, brings the section into view and moves focus to it. The list is collapsed on every visit and its open state is not stored.

### Text equivalent

> **FR-32** — The section's text equivalent (TSL FR-22) shall carry, in reading order and in the same wording as the chart: every earlier-name count with its basis line; each kept form's name; the "Earlier name not recorded" box and its count; each "Not traceable in your backup" marker; each zero state; each later-change marker; the kind word Rename; the event sentence; and the explanatory paragraph. No figure, state or name drawn in the chart shall be absent from the text equivalent, and none shall be carried by color alone.

### What does not change

> **FR-33** — The Statistics escapee check's taxonomy join shall admit exactly what it admits today. The join built from the record with renames present shall equal, key for key and value for value, the join built from the same record with every rename removed. Because the join does not change, this feature shall not raise the marker that reopens the escapee check's recorded absences (`UNMATCHED_JOIN_VERSION`).

> **FR-34** — Everything else shall behave as in the prior release: the section and control appear in merged mode only and step aside with "Show subspecies" on (TSL FR-24); the section's content is the same by every route to a species (TSL FR-25); a new, synced or removed backup recomputes everything from the new data (TSL FR-27); a record that fails to load removes the control and the section and raises no alert (TSL FR-28); and the Subspecies and forms tool, every other Species Detail section and every other tab are unchanged (TSL FR-26).

### Documentation and release

> **FR-35** — The same change shall rewrite the two Splits and lumps passages of `docs/HELP.md` for the new name, the earlier-name counts, the lump states and renames, including the limits a user can meet: counts come from dates and forms, not from what was typed; some earlier names of a lump cannot be traced; a rename is dated to the update that first carries the new name; and a rename where eBird also changed the species code is not listed. Help shall state coverage as a property, with no year and no count. The one sentence in `ACCESSIBILITY.md` that names the chart shall follow the new name. The guard that pins these Help passages shall be updated in the same change and shall keep one non-vacuity check per passage.

> **FR-36** — No published surface shall be written by the build. Each item below shall be prepared as a held proposal and applied only on the user's explicit yes: at most one proposed sentence for the Species Detail paragraph shared by `README.md`, `website/index.html` and the F-Droid full description; the App Store "What's New" sentence and the three F-Droid changelog files; and a recapture, from the synthetic demo data, of every published image that draws the control or the section (listed under Held published copy below). `PRIVACY_POLICY.md` shall not change.

> **FR-37** — The change shall carry a patch version bump across the six-file set, a `CHANGELOG.md` entry, and an update to the annual-refresh runbook in `scripts/taxonomy-history-input/README.md` covering renames. The release shall go to every platform.

### Held published copy found while writing

These are the occurrences on published surfaces as of 2026-11-18. Each is held for the user; none is to be edited by the build.

| Where | What it shows today | Why it is listed |
|---|---|---|
| `README.md` line 27, `website/index.html` line 241, `fastlane/metadata/android/en-US/full_description.txt` line 13 | "…a map of every observation, and any splits or lumps along the way." | Stays true after this feature and does not name the section. It omits renames, so a one-sentence proposal may be offered; a guard pins the current wording on the README and the website. |
| `appstore/screenshots/ipad-13/05-species-detail.png` | The control "Splits and lumps", its count, the section title "Splits and Lumps", the not-affected line and the coverage line | The control's label, the section title and the not-affected line change. The count and the coverage line do not. |
| `appstore/screenshots/iphone-6.9/05-species-detail.png`, `appstore/screenshots/iphone-duo/05-species-detail.png` | The control "Splits and lumps" and its count | The label changes. The count does not. |
| `website/assets/shots/species.webp` | The control "Splits and lumps" and its count | The label changes. The count does not. |
| `fastlane/metadata/android/en-US/images/tenInchScreenshots/4.png` | The control "Splits and lumps" and its count | The label changes. Its count reads 6, from an earlier capture; a recapture reads the demo dataset's present 11, a difference this feature does not cause. |
| The App Store "What's New" and the three F-Droid changelog files for the new version | Not yet written | One short sentence, proposed and held. |

The count on the control does not change with this feature: neither the demo dataset nor the account owner's backup holds a renamed species (`schema.md` finding 2.7), so the demo's affected count stays 11 and the owner's stays 24. The images change in the control's label, the section title and the not-affected line only. No new tab is added, so no whole-set regeneration is implied: only the frames above are recaptured, each decided against the committed image, with their raw captures under `appstore/screenshots/raw/`. Their captions and the website image's alt text do not mention the section and do not change. `appstore/LISTING.md` does not mention splits or lumps. The F-Droid phone screenshot of Species Detail (`phoneScreenshots/4.png`) does not draw the control. Earlier releases' F-Droid changelog files and `CHANGELOG.md` entries name "Splits and lumps" as history and are not edited.

## Non-Functional Requirements

> **NFR-01 — Network posture:** The feature shall make no third-party request, add no new endpoint or host, and move no request between components. It shall work with no eBird key and with the device offline on every platform. On web/Pi the record remains a static file served by the user's own server with the other frontend chunks. No system component makes a new request from the app's process on any platform.

> **NFR-02 — Trust boundary:** The record stays a build-time artifact, defended by the fail-closed generator (FR-05) and by CI (FR-07). No per-entry runtime validation is owed. The generator reads only Cornell's files already on the developer's machine and never fetches.

> **NFR-03 — Performance and size:** The record's committed byte length shall stay within the existing bound in `frontend/src/lib/taxonomyHistoryAsset.ts` (16,384 bytes plus 65,536 per covered update, never above 1,048,576) with none of those three constants raised. The record and any code only it needs shall stay off the entry chunk. The derivation shall still visit each report once, with per-report work that does not grow with the number of events, and shall run at most once per loaded backup and record load; opening or closing the list and re-rendering the page shall run it zero times. The existing linearity guard, including its hostile legs, shall pass over the record with renames. The schema shall record the derivation's measured CPU time on the demo dataset and on a worst-case fixture (one report under every name on every side of every event in the committed record) before and after renames join; if either after figure is more than twice its before figure, the Architect stops and reports it.

> **NFR-04 — Accessibility:** WCAG 2.1 AA shall hold at 320px width and 200% text scale in both themes, with no horizontal page overflow using the longest earlier name, kept form name and rename pair in the committed record. Every state in FR-17 to FR-21 shall be distinguishable without color. No new interactive element is required; any that design adds renders through the `Button` or `Link` primitive. Any DOM id or ARIA reference is keyed on an index, never on a name from the backup or the record.

> **NFR-05 — Theming and layout:** Every color shall come from the `var(--sr-*)` tokens in both themes; responsive behavior shall come from classes, never inline styles; no new dependency.

> **NFR-06 — Copy standards:** No em dash in any user-facing string or in the documentation prose this change touches; American spelling; no count of one with a plural noun. Every string that carries a count, a year, a date or a name shall live in the feature's copy module so the existing corpus sweep covers it. The fixed strings are "Splits/Lumps/Renames", "Earlier name not recorded", "Not traceable in your backup", the kind word "Rename", and the basis "eBird's name for them until the update". Where the section title is used inside a sentence in published copy it is lowercased.

> **NFR-07 — One rule:** Countability, parent folding and code resolution shall keep using the shared predicate, the shared normalization and the existing resolution path (TSL NFR-07). The rename cutoff (FR-03) exists once, in the generator. The kept-form rule (FR-06) exists once.

> **NFR-08 — Security:** Recognizing a kept form reads each report's name, which is user-file content. The Architect's schema shall declare that scan with its linearity argument, name the `security.md` path gate that covers the module holding it, and state its measured cost. A lookup keyed on a name from the backup shall be guarded as an external-string key. The feature shall size no allocation from a count read off the backup beyond one counter per record entry.

> **NFR-09 — Compatibility:** The feature shall behave the same on Mac, Windows, iPhone, iPad, Android and web/Pi, within the Android WebView floor the app already declares. It adds no stored setting, no cache document and nothing to iCloud Sync.

## Out of Scope

- By-year bars (variant B, declined after the sketch).
- Spelling-only or punctuation-only renames as FR-03 defines them, scientific-name-only changes, and renames of subspecies-group or form names.
- Renames in which eBird also changed the species code (FR-10).
- Saying whether a pre-split report was entered as the plain species or as a form.
- Any estimate of when a report was entered, including one from Submission ID order.
- Comparing two backups, or keeping a second backup.
- Changes made before the 2019 update.
- Showing earlier names anywhere outside this section.
- Suggesting which new species an older report belongs to. The shipped posture stands (FR-26).
- Any network lookup.
- Counting the plain reports of a lumped species under an earlier name, including an earlier name whose code carried on as the lumped species (see OQ-01).
- A complete earlier-name figure at a later-changed event, which would need each report followed forward through every later split and lump (see OQ-03).
- Recognizing a kept form by anything other than its current name in the bundled taxonomy. A backup exported after a lump but before eBird renamed that form counts those reports as "Earlier name not recorded" until a fresh backup is loaded.
- Replacing the present-day names that split and lump events show on their current side. Where a later rename changed such a name, the earlier event's line shows the present name and the rename's own line shows the name it replaced, as shipped.
- Adding renames to the Statistics escapee check's join (FR-33).
- Filtering or grouping the control's list by kind (see OQ-05).
- Any new stored setting, cache document, export, copy or share action.
- Whole-set screenshot regeneration, a new App Store frame, or any change to `PRIVACY_POLICY.md`.

## Open Questions

- **OQ-01 — Should a lump's surviving earlier name be counted? Resolved (decision D-08): no.** In 40 of the 229 pre-lump entries the earlier name's code is the lumped species itself (American Crow, African Pipit). Its plain reports dated on or before the update were most likely that species, but they also include reports of any earlier name eBird kept no form for and reports from a pre-lump slash, which is why the brief sends plain reports to "Earlier name not recorded". **Decided:** such a name is not traceable (FR-06, FR-18) and plain reports are never assigned to it. Consequence, measured on the committed record on 2026-11-18: 157 of 229 earlier names are traced; 49 of 101 lumps are traced in full, 33 in part, and 19 not at all, so 52 of 101 show at least one "Not traceable in your backup" name. The sketch told the user "about a quarter", counting only the 32 names whose code is gone. The alternative counts plain reports under the surviving name when every other earlier name of that lump is traced; it is more informative and overstates by any pre-lump slash reports. It is not built. The user was told the 52 of 101 figure, and the Architect's design allows the alternative later with no change to the record.

- **OQ-02 — Can a scientific-name match recover a not-traceable earlier name?** The brief asks the Architect to test it. **Default assumed:** no recovery. The Architect may add one only where it is exact (one earlier name to one current form, shown over every lump in the record), recorded at build time and held by FR-07; otherwise the name stays not traceable.

- **OQ-03 — Later-changed events.** 31 of the 582 events in the committed record have a current-side code that a later covered split or lump changed. **Default assumed:** FR-21, no earlier-name figure there. The Architect may narrow the rule for a case it proves exact, with a test; it may not show a figure that can miss or gain reports.

- **OQ-04 — The basis line on a rename.** The brief fixes "eBird's name for them until the update" and also says the copy must not claim a rename happened at the update. On a rename's earlier box the two pull against each other. **Default assumed:** the basis line stays on the box, and the rename sentence and paragraph carry the dating limit (FR-24, FR-25). The Designer may propose a rename-specific line on the same basis for the user's approval.

- **OQ-05 — Does the longer list need a kind filter?** **Default assumed:** no. If the design review finds the list hard to use with renames in it, a filter is raised there as an addition.

- **OQ-06 — How far the rename cutoff reaches.** Under FR-03 a one-letter spelling correction and a change in punctuation the rule does not name (a period, for example) count as renames. The brief measured 515 kept of 650 under its own reading of the rule. **Default assumed:** FR-03 exactly as written; the Architect records the kept and left-out counts the generator prints, and a difference from 515 is recorded, not forced.

- **OQ-07 — The published sentence.** **Default assumed:** propose one replacement for the shared Species Detail sentence that adds renames to "any splits or lumps along the way", held with the other items in FR-36. If the user declines, the surfaces stay as they are and remain true.

## Success Metrics

Each row names its evidence in brackets. **[Record]** is the committed record and generator. **[Fixture]** is a constructed backup or record. **[Real]** is the account owner's stored backup on the developer Mac, read for aggregate counts only, with no row, place or comment copied into any pipeline file. **[Built app]** is the built app in a browser engine on demo or fixture data. **[Repo]** is file state. A row marked [Fixture] is reported as verified by fixture and never as verified on real data. Traced lump counts and every rename have no real-data evidence available (decision D-09: no rename touches the stored backup); that is recorded as not available, not as pending. The demo dataset holds no renamed species, no traced lump count and no residual either, so a [Built app] row that needs one of these (the rename parts of QA-30, QA-39, QA-41 and QA-43) runs on a fixture backup, with the dataset confirmed in the page before any reading is taken; on demo data those rows can show only the new name and the unchanged split and lump states.

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | [Record] Rename shape (FR-01) | Every rename in the committed record has one earlier and one current-side name with the same code, both names, a year, a full published date, a retired flag that agrees with the bundled taxonomy, and no slash entries |
| QA-02 | [Fixture] Rename detection (FR-02) | Over fixture files for two consecutive updates: a species code whose name changed yields one rename; a code on a split or lump of that update yields none; a code that is a species in only one file yields none; a scientific-name-only change yields none; a code renamed in two updates yields two events reading A to B, then B to C |
| QA-03 | [Fixture] Rename cutoff (FR-03) | One row per ignored difference (case, accent, hyphen, space, each apostrophe form, gray/grey) and one combining several: each yields no rename. A changed word, a changed letter, and an ignored difference together with a changed word each yield a rename |
| QA-04 | [Record] Rename dating (FR-04) | Every rename's published date equals its update's published date; McCown's Longspur to Thick-billed Longspur is dated to the 2021 update |
| QA-05 | [Record] Generator fails closed; splits and lumps untouched (FR-05, NFR-02) | Each fault in FR-05, injected into fixture input, exits non-zero and writes nothing. The split and lump events of the regenerated record equal the previously committed record's, event for event. A successful run prints kept and left-out counts per update |
| QA-06 | [Record] Kept forms (FR-06) | For every lump in the committed record, each earlier name's kept-form fact and form name equal an independent re-derivation from the bundled taxonomy. Pacific-slope Flycatcher and Cordilleran Flycatcher are traced, with forms "Western Flycatcher (Pacific-slope)" and "Western Flycatcher (Cordilleran)"; American Crow and Northwestern Crow are not traceable |
| QA-07 | [Record] CI holds the record (FR-07, NFR-03) | The test passes on the committed record and turns red when a copy is mutated in each way: a rename with equal names, a rename sharing a code with a split in its update, a wrong kept-form fact, a file over the bound. The record is absent from the entry chunk |
| QA-08 | [Fixture] Renamed species are affected (FR-08) | A backup with reports under a renamed species' current name lists that species with "Rename" and the update year, and its chart shows the earlier and current names |
| QA-09 | [Fixture] Earlier name in an older backup; a name handed on (FR-09) | A backup carrying only a rename's retired earlier name lists the species under that name and shows the shipped predates state. Where the earlier name now belongs to another species, a report under it counts on that species' line and on no rename as an earlier-name report, with the code lookup present and with it absent |
| QA-10 | [Fixture] Rename with a changed code (FR-10) | A species renamed with a new code in the fixture files has no rename event, is not listed as renamed, and shows the not-affected line when selected |
| QA-11 | [Fixture] Filters and switches inert; one counting rule (FR-11) | With a county filter, a date range, "Show all forms" and "Show escapees" each applied, every figure and state is identical to the unfiltered result, and the filter note appears only while a county or date filter is active. A hybrid, a spuh and a slash no event created change no figure |
| QA-12 | [Fixture] Per-event dates and chains (FR-12) | On a species split in one update whose new name was renamed in a later one, each event is on its own line with its own date; the later rename does not make the split later-changed, so both lines show an earlier-name figure; a report dated before both counts on the earlier side of each, once per event; no figure in the section combines the two events |
| QA-13 | [Fixture] Split identity (FR-13) | With reports under two new names and the created slash, the earlier name's count equals the three reassigned figures added together; a report dated on the update date is included and one dated the next day is not; with no reports under the slash the count equals the two shown figures and no slash is drawn |
| QA-14 | [Real] Split on the owner's backup (FR-13) | In the 2026-07-11 export, Hudsonian Whimbrel reads 25 reports, 14 reassigned by eBird and 11 recorded since, and the Whimbrel box's count equals 14 plus the reassigned figures shown on Eurasian Whimbrel and on the slash entry, or 14 if the backup holds neither. Northern Yellow Warbler reads 1 and 1, and European Goldfinch reads 5 on or before 22 October 2024, each with its earlier name's count equal to its event's reassigned figures added together. If the stored backup is a later export, the Tester recounts from the file by hand and records the figures used |
| QA-15 | [Fixture] Forms under a split (FR-14) | A report under a form of a new name, dated on or before the split, is in that name's reassigned figure and in the earlier-name count; no string says whether it was entered as a form |
| QA-16 | [Fixture] Rename identity (FR-15) | The earlier name's count equals the current name's on-or-before figure; the current name shows its count and both partition figures |
| QA-17 | [Fixture] Lump, traced (FR-16) | With reports dated on or before the lump under each kept form, each earlier name's count equals a hand count of its form's reports; a kept-form report dated after the lump is in no earlier-name count; a report under another form of the lumped species is in no traced count |
| QA-18 | [Fixture] Lump residual and identity (FR-17) | Plain lumped-name reports dated on or before the lump appear in a box labeled "Earlier name not recorded"; the traced counts plus that box equal the lumped name's reassigned figure; with no such reports the box is absent |
| QA-19 | [Fixture] Lump, not traceable (FR-18) | In a lump with no traced earlier name, each earlier name reads "Not traceable in your backup" with no number, a sentence gives the reason, and no "Earlier name not recorded" box appears. In a lump with one traced name and one surviving name, the surviving name reads "Not traceable in your backup" with the surviving-name reason and the plain reports are in the "Earlier name not recorded" box |
| QA-20 | [Real] Lump states on the owner's backup (FR-18, FR-19) | States only; no traced count is verified on real data. Western Flycatcher shows both earlier names in the traced zero state and no "Earlier name not recorded" box; American Crow shows both earlier names as "Not traceable in your backup" with no number |
| QA-21 | [Fixture] Zero states (FR-19) | A split whose reports are all dated after the update shows the earlier name's zero state and no count. A traced lump name with no reports shows a zero state whose chart text and text-equivalent text both differ from "Not traceable in your backup" |
| QA-22 | [Fixture] Backup exported before an update (FR-20) | For a split, a lump and a rename, a backup carrying only earlier names renders the same figures and states as the prior release, except exactly the readings listed in `schema.md` section 6.3 (QA-44), with no earlier-name figure, residual box, not-traceable marker or explanatory paragraph. A pre-2021 fixture with reports under American Crow and Northwestern Crow shows Northwestern Crow's direct count as shipped, counts no report twice, and shows no sentence saying the backup no longer carries the earlier names |
| QA-23 | [Fixture] Later-changed event (FR-21) | On a species split in one update whose new name was split again later, the earlier event's earlier name shows the later-change marker with no number and no zero state, its current-side figures are as shipped, and the later event shows its own earlier-name figure |
| QA-24 | [Fixture] Earlier-name box content (FR-22) | A count of 3 reads "3 reports" with the basis line; a count of 1 reads "1 report" with the singular line; a traced lump name also shows its kept form's name |
| QA-25 | [Fixture] Current-side content (FR-23) | Split and lump current-side names are identical to the prior release for the same fixture; a rename's on-or-before label does not say the reports were reassigned |
| QA-26 | [Fixture] Event sentences (FR-24) | A traced lump's sentence does not contain "no longer carries the earlier names"; a rename's sentence names both names and the update, and no rename string says the change was made on the published day (copy-module sweep over all renames in the record) |
| QA-27 | [Fixture] Explanatory paragraph (FR-25) | The paragraph appears once under an event with a count above zero or a residual box and is absent under an all-zero, pre-update or later-changed event; it states the date basis, the form basis for a lump, and that a later-entered report counts; a rename's paragraph states the dating limit |
| QA-28 | [Fixture] Wording limits (FR-26) | A sweep of the copy module over a generated corpus finds no string that says what was typed as a fact, names a report's name on its sighting day, or proposes a new species for an older report |
| QA-29 | [Fixture] Name rendering (FR-27) | Every bird name in the section renders through the shared component; an earlier name absent from the backup and a kept form's name carry no link and no site marks |
| QA-30 | [Built app] The name (FR-28, FR-29) | The section title reads exactly "Splits/Lumps/Renames"; the control, the list head, the zero-affected line and the not-affected line each include renames; no string on the page says only splits and lumps are recorded |
| QA-31 | [Fixture] List content and count (FR-30) | The list holds exactly the affected species in selector order; a species with a rename and a split shows both, most recent first, with the words Rename and Split and their years; the control's count equals the number of entries |
| QA-32 | [Fixture] Pick behavior (FR-31) | Choosing a rename-only entry selects the species, closes the list, scrolls the section into view and moves focus to it; the list is closed on the next visit |
| QA-33 | [Fixture] Text equivalent parity (FR-32) | For a split, a traced lump with a residual, a not-traceable lump, a rename, a pre-update event and a later-changed event, the set of figures, names, markers and sentences in the text equivalent equals the set drawn in the chart, by set equality in both directions |
| QA-34 | [Record] Escapee join unchanged (FR-33) | The join built from the committed record equals the join built from the same record with renames removed, key for key and value for value; the marker that reopens the check's recorded absences has the same value as in the prior release |
| QA-35 | [Fixture] No regression (FR-34) | With "Show subspecies" on, the control and section are absent and return when it is turned off; section content is identical by selector, by another tab's request and by the list; replacing the backup recomputes everything; a rejected record load removes the control and section with no alert; the regression suite for the rest of Species Detail and the other tabs is green |
| QA-36 | [Repo] Help and accessibility statement (FR-35) | Both Help passages carry the new name, the counts, the lump states, renames and the four limits, with no year and no count; `ACCESSIBILITY.md` names the chart by the new name; the published-claims guard goes red when either Help passage is deleted |
| QA-37 | [Repo] Published surfaces held (FR-36) | `README.md`, `website/`, `appstore/`, `fastlane/metadata/` and `PRIVACY_POLICY.md` are identical to `main` except for the version-stamp step, until the user's yes; the held file lists the proposed sentence, the What's New sentence and each image to recapture; after approval each listed image shows the new control label |
| QA-38 | [Repo] Release set (FR-37) | All six version files move together, `CHANGELOG.md` has the entry, and the runbook describes the rename step |
| QA-39 | [Built app] Network posture (NFR-01) | A session that opens the list, picks a split, a lump and a rename, and reloads the backup, with no key and the outbound seam offline, makes no request beyond those the prior release makes; no new host or endpoint appears |
| QA-40 | [Record] Work done (NFR-03) | The derivation runs once per backup load and zero times on list open, list close and unrelated re-renders; the linearity guard passes over the record with renames; the schema records before and after CPU time on both datasets and neither after figure exceeds twice its before figure |
| QA-41 | [Built app] Accessibility and layout (NFR-04, NFR-05) | At 320px and 200% text, in both themes, in WebKit and Chromium: no horizontal overflow with the longest earlier name, kept form name and rename pair; every state readable without color; AA contrast on all new text; no id or ARIA reference built from a name |
| QA-42 | [Repo] Copy and rules (NFR-06, NFR-07, NFR-08) | No em dash in new user-facing strings or touched prose; the corpus sweep finds no singular or plural defect; the fixed strings appear exactly; the cutoff rule and the kept-form rule each have one definition; the schema declares the new scan, its gate and its cost |
| QA-43 | [Built app] Platforms (NFR-09) | The section renders the same states on the web/Pi build and the desktop build for one fixture; no new stored document or setting exists after a session |
| QA-44 | [Fixture] The changed readings of a rename's earlier name (FR-09, FR-20, decision D-10) | For each name in the roster of `schema.md` section 6.3, one backup carrying that name reads at the split or lump event exactly as that section states: the eight that move from "predates" to the after side, the four that move from the after side to "predates", and the two that move from not affected to the after side of an earlier split. With the committed record and the same record with renames removed, no split or lump reading differs for any name that is not a retired earlier name of a rename. The roster is read from the schema and the record; the count is printed, never typed into an assertion |
| QA-45 | [Fixture] A rename followed by a later split (FR-12, FR-21, decision D-11) | On a species renamed in one update whose code a later update split, the rename's line shows the later-change marker on its earlier name, with no number and no zero state; the later split's line shows its own earlier-name figure; each event is on its own line with its own date |
