## Taxonomic splits and lumps (taxonomic-splits-lumps, 1.0.41)

### What this does

Species Detail gains a "Splits and lumps" control beside "Subspecies and forms". It lists every species in the loaded eBird backup that eBird split or lumped in a covered annual taxonomy update. A Splits and Lumps section, just after Subspecies and Forms, shows for the selected species what it was, what it became and which update did it. The user's species is marked in words, and every name they have reports under shows its count, split between reports eBird reassigned (dated on or before the update) and reports recorded since. The data is a bundled, build-time record of eBird's 2023, 2024 and 2025 updates (202 splits, 32 lumps). It loads lazily in its own chunk, works offline and needs no key. It adds no third-party request, no new endpoint or host, and no request moved between components (on web and Pi the chunk comes from the user's own server, like every other chunk).

### How to test

1. Build (`cd frontend && npm run build`) or run the app with a real eBird backup loaded.
2. Open Species Detail. With "Show subspecies" off, "Splits and lumps" sits to the right of "Subspecies and forms" and shows "N species".
3. Open it. Species are listed in taxonomic order, each with "Split" or "Lump" and the year. Pick one: the list closes, the species is selected, and the page scrolls to the Splits and Lumps section and focuses it.
4. In the section, check the kind and month-and-year badge, the before and after names, and the "Your species" node with its counts, partition and bar. Names you have no reports under are dashed and say "No reports under this name". A slash appears only when your data holds rows under it.
5. Pick an unaffected species in the selector: the section reads "No split or lump is recorded for this species in the covered updates." Every state ends with the coverage line.
6. Set a county or date filter: a one-line note appears, and no count changes. "Show all forms" and "Show escapees" change nothing either. With "Show subspecies" on, both pieces disappear.
7. Narrow the window to 320px, or set Text size to 200%: the control row stacks, the chart stacks with continuous connectors, and slash names wrap after the "/".

### Notes for reviewer

- **The generator's inputs.** `scripts/build-taxonomy-history.mjs` reads Cornell's integrated eBird/Clements checklists and Cornell's eBird taxonomy files for 2022 to 2025. They sit in the gitignored `scripts/taxonomy-history-input/`, which commits only its README. They are byte copies from the Wayback Machine, except the 2022 checklist, which was exported to CSV from Cornell's XLSX because every archived CSV of it is truncated or mislabeled. **The API's past-year taxonomy was NOT used.** For older years it returns today's common names (813 differ for 2023), and a before-side entry has to carry the name an old export carries.
- **The derivation refines schema.md 4.2, and the result is externally checked.** The schema resolved a split's parent from the previous-sort link and the sentence. Four refinements were needed:
  - the eBird taxonomy's own REPORT_AS link, from the daughter's previous code
  - climbing a previous-sort link from a group to its species
  - scoping the sentence search to the split's subject, falling back to common names across a genus move
  - completing each group from the taxonomy (the kept-code nominate, promoted groups, and a new species that took one of the parent's groups)

  Lumps gained the groups now filed under the survivor. With these, each covered year's events reproduce eBird's own announced tallies exactly: 2023 124 gained / 16 lost, 2024 141 / 16, 2025 40 / 18. The generator now fails closed if they ever differ (`UPDATE_PUBLISHED.announced`). The only other generator change is that 35 `####` cells in Cornell's 2025 CSV (a too-narrow spreadsheet column) are read as an absent previous-sort link, never a guessed one. Everything else fails closed as specified, and a one-daughter split still fails closed.
- **Names on the asset.** A before-side entry carries the previous year's names. An after-side or slash entry carries the snapshot's current names wherever its code is still current, which the schema's I5 requires. An after-side code no longer current is allowed only when a later covered event retires it (the chain). Three 2023 after-side codes are retired that way: Macquarie Parakeet (`recpar23`) and North Papuan Pitta (`pappit2`) by 2024 lumps, and Slender-billed Crow (`slbcro1`) by a further 2024 split. I5 in the shared checker encodes exactly that.
- **The chart is not `aria-hidden` as a whole.** The design spec said it would be, but a recorded, non-selected name in it is a real button that selects that species (FR-23), and a focusable control inside `aria-hidden` is reachable by Tab yet absent from the accessibility tree. Every non-interactive piece of the chart (scientific name, marker, counts, partition, bar, rail, the visible sentence) is `aria-hidden`, so a screen reader hears each fact once, from the visually hidden text equivalent. The linking names stay exposed.
- **Favicons only on current codes.** A linked name carries the eBird and Birds of the World marks only when its entry is `current`: an after-side code that is still a species after every covered update. The derivation decides that from the asset alone: a code is current when the latest update that carries it has it on an after side. That excludes the three retired codes above, whose Birds of the World pages return 404, while keeping a code a later update kept (Red-crowned Parakeet, `refpar4`, on both sides of the 2024 lump). `taxonomyHistoryAsset.test.ts` holds that rule to the snapshot over every entry of the committed asset. A before-side code may no longer name a species, so it never gets marks. The schema said `taxonCode={entry.code}` for every linked entry. (Security review L1: the first build marked every after-side entry current.)
- **Both controls' panels open below the shared row.** `SubspeciesExplorerControl` gained a `panelHost` prop. Both controls portal their open panel (the new `PanelSlot` in `speciesDetail/ui.tsx`) into one host after the row, so each panel spans the full width below both toggles and DOM order equals visual order. That is the WCAG 2.4.3 alternative to CSS `order`, which `ui.md` forbids. The explorer's own tests pass unchanged.
- **`BirdName` gained `breakAfterSlash`** (default off; `<wbr>` after each "/", text and accessible name unchanged), per decisions.md 2.
- **Published copy is held.** README, website and What's New sentences are in `pipeline/taxonomic-splits-lumps/held-copy.md`, awaiting approval. The only `website/` edit is the version pill and footer. `docs/HELP.md` is updated, and its claims are pinned by `taxonomyHistoryPublishedClaims.test.ts`.
- **Guards added:**
  - `taxonomyHistoryGenerator.test.ts`: the fixture chain, every fail-closed row, and the shared checker's rejections
  - `taxonomyHistoryAsset.test.ts`: the committed asset through the shared checker and independent re-assertions, including eBird's tallies, with mutation rows, and the derivation's `current` flag held to the snapshot
  - `taxonomyHistory.test.ts`: the matching tiers, roll-up, partition, chain, list, and linearity at 10k/40k, a hostile 4,000-character leg, and a leg where every row is its own affected key over the real asset
  - `taxonomyHistoryCopy.test.ts`: the generated corpus
  - `SplitsLumps.test.tsx`: wiring, states, parity, reveal, inertness, reload, load failure, memoization as work done, index-keyed ids, and site marks only on a current code
  - `entryChunk.test.ts`: the asset stays off the entry graph and the tab's static graph, and gets its own chunk
- **Rule gates extended:**
  - `bird-names.md`: the asset, the generator and its core
  - `security.md`: `taxonomyHistory.ts` (the declared scan) and `taxonomyHistoryAsset.ts` (the reversal seam)
- **Known limit, stated in the schema (6.2):** when a split's nominate keeps the parent's common name (Cory's Shearwater, 2024), an export made before the update cannot be told from a current one by name, so it shows on the after side without the "predates" note.
