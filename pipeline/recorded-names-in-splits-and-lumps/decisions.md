# Decisions: recorded-names-in-splits-and-lumps

Each entry says who decided, on what evidence, and what would reverse it.

## D-01 — New Feature lane, feasibility first (user, 2026-11-18)
The request reads as a strengthening of the shipped Splits and Lumps section. The user first accepted Improve, then said "lets keep it as a new feature, so we can determine feasibiliy before anything else". The Strategist's first job was a feasibility read, before any conversation or brief.

## D-02 — A go or no-go sketch before the brief (user, 2026-11-18)
Asked whether the earlier name's box should carry a count or also lay reports out by year, the user said "I would like to see a design of how that looks. then I can decide whether this change make sense, or whether the limited data makes this feature unfeasible". The Designer drew `feasibility-sketch.html` as a scoped errand during Stage 1. It is not the Stage 4 design.

## D-03 — Build it, variant A (user, 2026-11-18)
"Yes, lets built it, with variant a". The earlier name's box carries a count; no by-year bars. Variant B was declined: it roughly doubles the chart's height on a phone, repeats Sightings Over Time, and shows the same reports twice on a rename.

## D-04 — Renames in, word-changing only (user, 2026-11-18)
The user asked for renames in their first answer and chose "Only renames that change a word" (515 of 650 measured). Spelling-only and scientific-name-only changes are out.

## D-05 — The section is named "Splits/Lumps/Renames" (user, 2026-11-18)
The user's exact string. The control and the unaffected-species line follow it; their wording is design's.

## D-06 — Lumps stay in scope without a real pre-lump export (orchestrator, stated to the user, 2026-11-18)
The user asked that the lump check be run for them rather than by them. It was run on the stored backup (the 2026-07-11 export, report dates 2024-02-22 to 2026-07-11): no report is dated on or before any covered lump, so the point cannot be confirmed from this data. Evidence relied on instead: Cornell's per-year files (firsthand) and a web search summary of eBird's 2023 update page (secondhand; the page refuses scripted reads). The user was told lumps are kept on that evidence and was offered the cut; they replied "The rest looks good" before the result and did not ask for the cut after it.
**Reverses if:** a real export with a pre-lump report shows eBird did not move it onto the form name.

## D-07 — Run switched from Guided to Studio Style (user, 2026-11-18)
At the Stage 1 sign-off: "please continue to the planner, and lets continue this run studio style". Check-ins: The Designer and the deploy sign-off. Published copy still waits for the user's approval.

## D-08 — PRD OQ-01 default kept: a lump's surviving earlier name reads not traceable (orchestrator, 2026-11-18)
Follows the approved brief's decision that plain lumped-name reports never go to a guessed name. Consequence measured by The Planner: 52 of 101 covered lumps show at least one "Not traceable in your backup" name, more than the sketch implied ("about a quarter"). The user was told the corrected figure at the Designer check-in. The Architect's design allows the alternative later with no record or version change.

## D-09 — Renames kept although none shows on the owner's data (user, 2026-11-18)
None of the 515 renames touches a species in the stored backup (The Architect's measurement, cross-checked by the orchestrator against the prototype record: zero). Told this, and that leaving renames out would make a smaller release keeping the old section name, the user said "kept please".

## D-10 — Fourteen shipped readings may change (orchestrator, 2026-11-18)
Recognizing a rename's earlier name (FR-09) changes how 14 names read at split and lump events in a backup exported before that rename. Every move is toward the export's true date and 8 correct a misreading the app makes today (schema section 6.3 argues each direction). Accepted as a correction; FR-20 and QA-22 get a carve-out naming those 14, amended by The Planner.
**Reverses if:** any of the 14 is shown to move away from the export's true date.

## D-11 — QA-12 replaced (orchestrator, 2026-11-18)
A rename followed by a later split is a later-changed event under FR-21 and shows the marker with no number, so QA-12 cannot pass as written. It is replaced by a split-then-rename fixture, amended by The Planner.

## D-12 — Design approved as drawn (user, 2026-11-19)
Shown `design.html` with four wording choices called out (the control's label "Splits/Lumps/Renames"; the no-change line; "No reports until the update" for a traced lump name with nothing to count; the rename badge "Rename, by <month year>" with "at the latest") and the earlier stacking threshold, the user said "This looks good, lets build it". No change requested. `design-spec.md` is the build's source of truth.

## D-13 — Design deviations accepted for the build (orchestrator, 2026-11-19)
From design-spec section 10. Each stays inside the existing design system (no new color, type or component).
- **Stacking threshold** moves on `@container sr-lin` from `(max-width: 21em) or (max-width: 420px)` to `(max-width: 29em) or (max-width: 520px)`, so the longer labels never clip. It was measured in the mockup's container, so the Engineer re-measures it against the real container in the built app (ui.md, v1.0.50), under a classic scrollbar too. `splitsLumpsCss.test.ts` locks both stacked blocks. **Reverses if:** the built app's measurement gives a different figure; the measured figure wins.
- **Eight small CSS rules** (R1 to R8 in the spec), including the "cannot count" glyph and the earlier-name share bar.
- **Share bar:** an earlier name's share of the event's reports dated on or before the update; always full for a split or rename, divided for a lump.
- **No motion added;** the new bar joins the shipped fill.
- **Hand-drawn rename glyph;** display spelling of a renamed species follows the rest of the app, record untouched.
- **Three in-app sentences the user has not seen** (a rename on an older backup, a lump on a later-changed line, a lump on a backup carrying one earlier name beside the lumped name). In-app text needs no stop under the published-copy rule; they follow the approved wording basis.

## D-14 — Hover gating ride-along taken (orchestrator, 2026-11-19)
`.sr-ssx-toggle:hover` and `.sr-sl-row:hover` are ungated today, which ui.md (v1.0.65) forbids on a shared control because a touch screen keeps `:hover` after a tap. This build edits `.sr-sl-row`, so the gate goes in with it, inside `@media (hover: hover)`, with a `controlRegisters.test.ts` row for the two rules. It also touches Subspecies and forms' toggle; that is the same defect on the same control family.
**Reverses if:** the WebKit touch check shows the gate changes a selected or focused state; then it is left out and written up as a follow-up.

## D-15 — The three unannotated renames ship left out and listed (orchestrator, 2026-11-19)
Rufous-tailed Bush-hen to Pale-vented Bush-hen (2019), Yellow-green Finch to Yellow-green Brushfinch (2019) and Blue-gray Saltator to Bluish-gray Saltator (2022) are not annotated in Cornell's checklist, and the generator accepts an unannotated rename only with a cited reading of eBird's update page. eBird's pages refuse scripted reads and that refusal is not worked around. The orchestrator opened a browser tab to read them, found the only connected browser was not on this Mac (no Chromium-family process running here), closed the tab without loading any page, and did not use it (device boundary). The schema names the fallback (flag 12: hold the build or ship without those three); the build ships without them, the generator prints them as left out, and the runbook records the step to add a cited row. The user was told, with the exact pages to read if they wanted the three in, and replied "leave those three out, that's fine for now" (2026-11-19).
**Reverses if:** a person reads eBird's 2019 and 2022 update pages and confirms a rename; its cited row is added and the record regenerated.

## D-16 — The CPU cost is accepted as measured; the view-building lever is not applied (orchestrator, 2026-11-19)
The Engineer re-measured on the real implementation (shipped, then built; CPU time, 25 rounds of 100 ms samples, nothing else compiling):
- Demo dataset (an NFR-03 leg): 2.13 ms to 3.20 ms, 1.42x to 1.53x.
- Worst case (an NFR-03 leg): 2.83 ms to 4.72 ms, 1.45x to 1.77x.
- Worst case with no codes lookup (a schema extra row, not an NFR-03 leg): 3.3 ms to 6.9 ms, 1.72x to 2.14x. The schema's 1.85x for this row does not reproduce; the prototype reads the same on these rows.
- Empty backup 1.6x to 1.8x; the owner's backup 1.3x to 1.7x.
Both legs NFR-03 names pass its 2.0x stop. The extra row straddles 2.0x, and no action is taken on it: it is under 4 ms of added work, paid once per loaded backup and never on a re-draw, on a fixture built to be the worst case with the lookup removed. The cause is the larger record (1,094 events against 582), not one hot spot. The helper's default settings (9 rounds) are not used for the judgment because an identical-input control read 0.67x to 2.02x under them.
**The fix not applied, and where:** build a view only for events some key reaches, in the index construction in `frontend/src/lib/taxonomyHistory.ts` (the lever the schema names under its CPU table). It changes the index's contract, so it is a design change with its own tests, not a tuning.
**Reverses if:** either NFR-03 leg measures at or above 2.0x on the stable method, or the derivation's absolute cost on a real backup becomes visible at load.

## D-17 — Build departures from the schema accepted (orchestrator, 2026-11-19)
- **`RENAMES_AWAITING_SOURCE`:** schema 4.3 could only abort the run on an unannotated, uncited rename. To ship D-15's "left out and listed", the generator carries a named list of the three; it prints them as left out, and a row that matches nothing or is annotated stops the run.
- **Rename current names get their own name-tier maps,** consulted only when the split and lump maps find nothing (departs from schema 6.2). Sharing the maps moved a fifteenth reading with no codes lookup (Comoro Cuckooshrike under its 2023 scientific name), which FR-20 forbids. With separate maps exactly the 14 names of schema 6.3 change.
- **`SectionHead`** gained an optional title node and class; other sections render unchanged.
- **Stacking threshold confirmed in the built app:** three columns need 485, 550, 615 and 745 px at 100, 125, 150 and 200% text in Chromium and WebKit, so `(max-width: 29em) or (max-width: 520px)` stays (D-13).
- **Residual, not fixed:** at WebKit, classic scrollbar, 320 px, 200% text, "NOT TRACEABLE IN YOUR BACKUP" sits 0.68 px into its node's padding, inside the border, in 2 of 5,472 measured configurations. No clip and no page scroll. The fix would be one more break opportunity or a 1 px padding change on that label in `frontend/src/globals.css`. **Reverses if:** it is seen clipped on a real screen.

## D-18 — Figures the build superseded (orchestrator, 2026-11-19)
The record ships 512 renames, not 515 (D-15), at 363,148 bytes with 1,094 events. Where `strategic-brief.md`, `prd.md` (line 224), `schema.md` (lines 27 to 35, 134, 327, 343, 421, 503 to 506), `design-spec.md` (line 41) and D-04 and D-09 above say 515 or a figure derived from it, the built record's figure stands. The artifacts are left as written, as the record of what was measured on the prototype.
Two findings that correct earlier statements:
- **D-09 said no rename shows on the owner's data. One does, by the chain:** White-rumped Shama's section gains a 2025 rename line (Sri Lankan Shama to Sri Lanka Shama), reached through the shipped forward chain walk, with nothing to count. No rename touches a species in the backup directly. The user is told at the deploy sign-off.
- **Schema section 14, flag 10 is wrong about the night heron:** the record's rename is 2021 (Rufous Night-Heron to Nankeen Night-Heron); the 2023 hyphen drop is spelling only and yields no event. Design-spec section 11 is right.

## D-19 — Audit dispositions (orchestrator, 2026-11-19)
The Auditor passed the build with notes: no Critical, High or Medium finding; scan floor clean; Tier 2.
- **L1 (Low), closed here as the declared-scan row the schema lacks:** the rename name-tier maps of D-17 add up to three `Map` lookups per DISTINCT name in the backup, at `frontend/src/lib/taxonomyHistory.ts:504-505`, consulted only when the split and lump maps find nothing. Linearity: the work is per distinct name, each lookup is a `Map.get` on a string key, and nothing loops over events; the Auditor measured 3.59x for 4x the rows. No clamp is involved. `security.md`'s gate already covers the module.
- **I1 (Informational), accepted, not fixed:** on a rename the section shows the current name as spelled on the first backup row that matched it (`frontend/src/components/speciesDetail/SplitsLumps.tsx:220-224`), so a hand-edited backup whose common and scientific names disagree can put its own text into "eBird renamed A to …". The text is escaped and nothing runs; only the file's owner sees it, in their own file's words. The fix, if wanted: use the backup's spelling only when it differs from the record's name in spelling alone (the `renameKey` comparison), else the record's name. **Reverses if:** a real eBird export is seen to produce it.
- **I2 (Informational), fixed:** one component test renders the section from a backup with hostile names (a tag payload, a quote and script payload, `__proto__`) and asserts the text appears only as text and no id is built from it. Sent to the Engineer as a scoped errand.
- **X1 (Low, not this build's code), idea inbox:** lookups keyed on backup names slow quadratically when many names share one length above 16,383 characters, about 0.6 s of main thread at 48 MB of such names; the base commit reads the same. A name-length limit at parse would fix it everywhere.
- **X2 (Informational, not this build's code), idea inbox:** `npm audit` reports 11 advisories in the dev toolchain (2 High, `undici` and `zod`); the shipped scope reports 0 and this build changed no dependency.

## D-20 — State read before the deploy sign-off, and the CI rule for this ship (orchestrator, 2026-11-19)
- **App Store Connect (read 2026-11-19 23:36 UTC):** 1.0.73 is approved and live (record `e674c73b` `READY_FOR_SALE`, submission `b0a771f9` complete). Its train is closed, so 1.0.74 gets a version record of its own; nothing rolls up.
- **F-Droid (read 23:37 UTC):** it publishes 1.0.72 and has built 1.0.73 without publishing it yet. 1.0.74 sends nothing to fdroiddata (no toolchain pin or build step changed).
- **The other worktree** (`worktree-life-list-filter-toggle-state`, `481b9ee3`) has no commit that is not on `main`; nothing of it rides this ship. It was not entered.
- **CI at this ship:** the standing rule is applied as written (DECISIONS.md, v1.0.73: red only on `lifeListsLinearity` or `paletteLocationsLinearity` timing rows under twice their limits, Backend green, proceeds). If the run of record is red on anything else that is a timing-ratio row this build did not touch (`alphaCodes.test.ts`'s CPU-ratio row has tripped on 3 of the last 14 `main` runs), the failed job is re-run ONCE on the same commit and judged by the rule unchanged, as at 1.0.73. The twice-the-limit allowance is not extended to any other suite. A red that survives the re-run stops the ship before `./release.sh` and goes to the user.
- **The taxonomy-history linearity guard this build moved onto CPU time** read 2.14 to 4.03 against its limit of 9 on Node 24, Node 20 and under GC stress, at least 2.2x of headroom; no change before the tag.
- **F-Droid tablet screenshots:** all six have shown a side menu without Life Lists or Hotspot Reports since 1.0.63, and frame 4 draws the old label. No committed tool retakes them (they are emulator captures of an Android build, and F-Droid reads them from the tagged code). Put to the user at the sign-off.
- **Left alone, not this session's:** four processes from the 1.0.73 ship are still running on this Mac (a `log stream` and a loop polling a deleted log). Reported to the user.
- **Disclosure:** during preparation a local request to a scratch backend's `/settings/keys` printed the OpenWeather key's value into that builder's tool output on this Mac. It was sent nowhere and used for nothing. Reported to the user.

## D-21 — Deploy sign-off and published copy (user, 2026-11-19)
Shown the built app on their data and the sign-off page (before and after of every public change), the user answered:
- **The Species Detail sentence** on `README.md`, the website and the F-Droid description: "The sentence is good". They asked about "an extra line break"; it was the orchestrator's hand-wrapping in the dialog, not the copy. The sentence is written as one unbroken sentence: "Your whole history with one bird: sightings, field notes, breeding codes, a map of every observation, and any splits, lumps, or renames along the way."
- **Release note** (App Store What's New and the three F-Droid changelogs): B, "Species Detail's splits/lumps/renames section now counts your reports under earlier names where your backup can tell, and adds renamed species." A's "each earlier name" over-promised (52 of 101 lumps carry a name that reads "Not traceable in your backup").
- **Pictures:** use the four retaken ones (App Store iPhone 6.9, iPad 13 and iPhone Duo frame 05, and the website's Species Detail picture), and retake all six F-Droid tablet pictures before the tag. The six are shown to the user before they are committed.
- **Ship:** "Confirm: ship 1.0.74 now", to Mac, Windows, iPhone, iPad, and Android. The user's iPhone check of the exact TestFlight build comes before the App Store submission.

## Open
- At default test parallelism `lifeListsLinearity.test.ts` "pass 2R" read 20.46 against a limit of 20 once; it imports none of the changed modules and passes alone. A timing suite is judged with nothing else compiling; the Tester settles whether it is pre-existing.
- Schema section 14, flag 10 misdescribes the night heron rename. Cornell's files give `runher1` as "Rufous Night-Heron" (2019), "Nankeen Night-Heron" (2021, 2022) and "Nankeen Night Heron" (2023 on), so the rename belongs to the 2021 update and the 2023 hyphen drop is spelling-only (design-spec section 11). The Engineer confirms from the regenerated record.
- Three renames (Rufous-tailed Bush-hen, Yellow-green Finch, Blue-gray Saltator) are not annotated in Cornell's checklist. The generator refuses them unverified. Either eBird's 2019 and 2022 update pages are read in a browser, or they are left out and listed. To settle at the build.
- CPU cost measured on the prototype at 1.59x (demo data) and 1.81x (worst case) against a 2.0x stop. The Engineer re-measures on the real implementation.
