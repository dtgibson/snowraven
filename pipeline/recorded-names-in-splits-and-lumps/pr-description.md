## Recorded Names in Splits and Lumps (Splits/Lumps/Renames)

### What this does
The Splits and Lumps section on Species Detail becomes "Splits/Lumps/Renames". Each earlier name now shows how many of the user's reports eBird held under that name until the update: for a split or a rename, the reassigned figures of the names it became added together; for a lump, the reports that still carry the form eBird kept for that earlier name, with the rest in an "Earlier name not recorded" box and "Not traceable in your backup" where the backup cannot show it. Word-changing common-name renames from eBird's 2019 to 2026 updates join the record, the control's list and the chart as a third kind of change.

### How to test
1. `cd frontend && npx vitest run` (the full suite: this change edits text other guards pin).
2. `npm run build`, then serve the built app on a fixture backup (see `pipeline/recorded-names-in-splits-and-lumps/how-to-see.md`).
3. Species Detail, open "Splits/Lumps/Renames", pick Western Flycatcher, Collared Trogon, American Crow, Thick-billed Longspur, Great Horned Owl, and check each state against design-spec section 2.
4. On the account owner's backup, Hudsonian Whimbrel's earlier name reads 14 reports, Northern Yellow Warbler's 1, European Goldfinch's 5.
5. `node scripts/build-taxonomy-history.mjs` reproduces the committed record byte for byte and prints the rename lines (three LEFT OUT, awaiting a source).

### Notes for reviewer
- **Record version 2.** `renames` is its own array beside `events`, so the Statistics escapee join reads exactly what it read before (equality by removal, a control that can fail, and a source pin in `exoticTaxonomyJoin.test.ts`); `UNMATCHED_JOIN_VERSION` is untouched. Lump earlier names gain `form`. Every one of the 582 split and lump events is byte-identical to HEAD once `form` is removed.
- **512 renames, not 515.** Three renames Cornell's checklist does not annotate (Rufous-tailed Bush-hen, Yellow-green Finch, Blue-gray Saltator) are left out by name in `RENAMES_AWAITING_SOURCE` until a person reads eBird's 2019 and 2022 update pages. That table is a departure from schema.md 4.3 (which could only refuse the run); a row that matches nothing, or names an annotated rename, stops the run.
- **Tier 2 departs from schema.md 6.2 in where a rename's current name is indexed.** It has name-tier maps of its own, consulted only when the split and lump maps find nothing. Sharing one set of maps changed a 15th reading with no codes lookup (Comoro Cuckooshrike under its 2023 scientific name lost its count at the 2019 split), which FR-20 forbids; now exactly schema 6.3's 14 names change, with the lookup present and absent.
- **Display spelling:** the latest rename's current name shows as the page carries the species (Nankeen Night Heron), per design-spec section 5 item 3, and not on a later-changed rename.
- **D-14 ride-along taken:** `.sr-ssx-toggle:hover` and `.sr-sl-row:hover` sit in `@media (hover: hover)`, guarded in `controlRegisters.test.ts`.
- **Published copy is held** (`held-copy.md`): the shared README/website/F-Droid sentence, What's New and three F-Droid changelogs, five images, and the 1.0.74 changelog entry. No version bump in this change.
