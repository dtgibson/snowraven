# Strategic Brief — Recorded Names in Splits and Lumps

## What We're Building
The Splits and Lumps chart on Species Detail shows, on each earlier name, how many of the user's reports eBird held under that name until the update, where today it reads "No reports under this name". Renames that change a word of a species' common name join splits and lumps as a third kind of change, and the section is renamed "Splits/Lumps/Renames".

## Why Now
The section shipped in 1.0.41 and now covers eBird's 2019 to 2026 updates, so the chart exists and its earlier-name boxes are empty for every current backup. The user met this on Whimbrel after the 2025 split, where their own backup holds reports from before it. A feasibility read and a design sketch showed what the data can honestly support, and the user chose to build it.

## The User Problem
A birder who reported Whimbrel before the 2025 split sees those reports only as "reassigned by eBird" under Hudsonian Whimbrel, while the name they knew the bird by shows nothing. For a lump, the chart does not say how the older reports divided between the species that were merged. A species eBird simply renamed does not appear at all.

## Success Criteria
- **Split:** the earlier name's box shows a count worded as eBird's name for those reports until the update.
- **Split reconciliation:** that count equals the "reassigned by eBird" figures on the names it became, added together, including the slash entry where the user holds reports under it.
- **Lump, traced:** each earlier name shows the reports dated on or before the update that still carry the form eBird kept for it, and names that form.
- **Lump, no form:** reports dated on or before the update with no form sit in their own box, "Earlier name not recorded".
- **Lump reconciliation:** the earlier boxes add up to the lumped name's "reassigned by eBird" figure.
- **Lump, untraceable:** an earlier name the data cannot follow reads "Not traceable in your backup", with a sentence saying why and no number.
- **Rename:** a species whose common name changed by a word appears in the control's list as a rename with its update. Its chart shows the earlier name with the reports dated on or before that update, and the current name with its usual two figures.
- **Left out:** a species whose name changed only in spelling or punctuation, or only in its scientific name, does not appear as a rename.
- **Explanation:** a paragraph under the chart says the count is worked out from report dates (and from the form, for a lump), not from what was typed, and that a report entered later for an earlier date counts too.
- **Name:** the section is titled "Splits/Lumps/Renames", and the control beside "Subspecies and forms" and the line shown for an unaffected species follow that name.
- **Screen readers:** the text equivalent carries the same figures and wording.
- **Unchanged:** a backup exported before an update behaves as it does today, and everything works with no connection and no key.

## Scope
- Earlier-name counts on splits, at species level.
- Earlier-name counts on lumps through the forms eBird kept, with the "Earlier name not recorded" box and the "Not traceable in your backup" state.
- Word-changing common-name renames of species in the 2019 to 2026 updates, added to the bundled record by its generator and shown in the control's list and the section.
- The section's new name, "Splits/Lumps/Renames", with the control and the unaffected-species line following it.
- The explanatory paragraph, the reworded lump sentence, and the in-app and Help wording that renames require.

## Out of Scope
- By-year bars (variant B, declined after the sketch).
- Spelling-only or punctuation-only renames, scientific-name-only changes, and renames of subspecies-group or form names.
- Saying whether a pre-split report was entered as the plain species or as a form.
- Any estimate of when a report was entered, including one from Submission ID order.
- Comparing two backups, or keeping a second backup.
- Changes made before the 2019 update.
- Showing earlier names anywhere outside this section.
- Suggesting which new species an older report belongs to. The shipped posture stands.
- Any network lookup.

## Key Decisions
- **Variant A is the direction.** `pipeline/recorded-names-in-splits-and-lumps/feasibility-sketch.html` is a go or no-go sketch, not the design.
- **The section is renamed "Splits/Lumps/Renames" (user direction, the user's exact string).** The control beside "Subspecies and forms" and the "No split or lump is recorded" line follow that name. Their exact wording is for design; the name itself is settled.
- **Fixed wording basis:** "eBird's name for them until the update". The copy never claims what the user typed and never claims the name on the report's date, because coverage starts at 2019 and an older report may have carried an earlier name still.
- **What the export holds:** one name per report (the name at export) and the observation date. It has no entry date, edit history or species code (`frontend/src/lib/parseEbirdObservations.ts:96-129`). The Macaulay export adds nothing about earlier names.
- **Facts versus inferences:**
  - Fact: a report's current name, and what that name's code was called before the update.
  - Inference: that a report dated on or before an update existed under the earlier name. This is the same convention as the shipped "reassigned by eBird" count. A report entered after an update for an earlier date is counted on the earlier side, and the copy says so.
- **Splits are exact at species level.** Every split in the record has exactly one parent. Whether a pre-split report was the plain species or a form is not in the export: in Cornell's 2023 and 2024 files `whimbr3` is the form "Whimbrel (Hudsonian)", and it and plain Whimbrel both read Hudsonian Whimbrel now.
- **Splits are confirmed in the account owner's own backup** (the export of 2026-07-11, 21,856 rows, report dates 2024-02-22 to 2026-07-11, read locally for aggregate counts only): Hudsonian Whimbrel has 14 reports dated on or before 2025-10-31 and 11 after; Northern Yellow Warbler 1 and 1; European Goldfinch 5 on or before 2024-10-22.
- **Lumps are traced by code.** The form data is already bundled: a lumped species' code usually survives as a form under the new species in `frontend/src/assets/ebird-taxonomy.json` (`byCode`, `reportAs`). The row pass discards the form today at `frontend/src/lib/taxonomyHistory.ts:346`.
- **Lump coverage, measured over the 229 pre-lump species in 101 lumps:**
  - 157 survive as a form with the same code.
  - 35 kept both code and name.
  - 5 kept the code under a new name.
  - 32 are not traceable by code (28 codes gone, 4 split back out later).
  - The Designer counted 24 of 101 lumps with at least one untraceable name, an overcount where eBird kept the form under a new code. The Architect should test whether a scientific-name match recovers some.
- **A form is not proof of the old name.** A form on a pre-lump report could have been entered later. The copy says "worked out from the form and the date".
- **Plain lumped-name reports get no earlier name.** For Western Flycatcher these were the pre-lump slash, whose code became the species (`wesfly` is a slash in Cornell's 2022 file and the species from 2023). They go to "Earlier name not recorded", never to a guessed name.
- **The lump part stays in scope on two pieces of evidence, and a real pre-lump export is not available to verify it.**
  - Cornell's per-year files: `pasfly` is the species Pacific-slope Flycatcher in 2022 and the form "Western Flycatcher (Pacific-slope)" from 2023 (firsthand, read on this Mac).
  - eBird's 2023 taxonomy update page (https://science.ebird.org/en/use-ebird-data/the-ebird-taxonomy/2023-ebird-taxonomy-update), as a web search summary: Pacific-slope Flycatcher became "Western Flycatcher (Pacific-slope)" and the old slash became plain "Western Flycatcher". The page refuses scripted reads, so this is secondhand, and it agrees with Cornell's files.
  - Not available: a real export holding a report dated on or before a lump. This verification is recorded as not available, not as pending on the user.
  - Confirmed in a real export: the Common Name column does carry form names (16 distinct forms over 985 rows in the account owner's backup, "Western Flycatcher (Pacific-slope)" on 2 rows), all dated after the relevant update.
- **For the account owner's own current data the lump boxes will show no earlier-name reports.** Four covered lumps touch a species in that backup (Warbling White-eye and Swinhoe's White-eye 2019, American Crow 2021, Western Flycatcher 2023), all before the first report on 2024-02-22, and no 2024 or 2025 lump touches it. Real-data verification of lumps is therefore by fixture only, and the Planner and Tester should plan for that. What a traced earlier name reads when it has no such reports is for design, and it must stay distinct from "Not traceable in your backup".
- **Renames are not in the bundled record today.** They come from Cornell's per-year files in `scripts/taxonomy-history-input/`: a species code present in consecutive years whose common name differs, outside that year's split and lump events.
- **Rename cutoff (user decision): only renames that change a word.** A rename counts when the names still differ after ignoring case, accents, hyphens, spaces, apostrophes and gray/grey. Measured: 515 kept of 650. The rule must be stated in the generator and tested. Scientific-name-only changes (about 940) are left out.
- **Rename limits:**
  - A rename that also changed code is not detected.
  - A rename is dated only to the update whose file first carries the new name, so reports between the real change and that update count under the earlier name. McCown's Longspur (`mcclon`, 2019 file) to Thick-billed Longspur (2021 file) is the known example. The copy must not claim the change happened at the update.
- **Carry-forwards for the Architect:**
  - The record's size bound in `frontend/src/lib/taxonomyHistoryAsset.ts` must still hold with renames added.
  - The Statistics escapee join is derived from the record's latest events (`buildEscapeeJoin` in `frontend/src/lib/exoticTaxonomyJoin.ts`), so renames must not change what it admits.
  - A retired earlier name in a pre-update backup should be recognized for a rename as it is for a split.
  - A species renamed and later split or lumped shows every event on its own line, as chains do today.
  - The shipped lump sentence "Your backup no longer carries the earlier names" (`frontend/src/lib/taxonomyHistoryCopy.ts:137`) is no longer accurate for a traced lump and is reworded.
- **Copy approval:** in-app text and Help are written with the build. Any README or website sentence, including one that names the section, is a held proposal for the user's approval.
- **Alignment verdict:** aligned with the product brief. Own data, on the user's device, no new provider, nothing on its Out of Scope list. Not a roadmap Up Next item.
