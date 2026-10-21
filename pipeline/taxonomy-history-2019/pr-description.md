## Splits and lumps: coverage back to eBird's 2019 update (taxonomy-history-2019)

### What this does
Species Detail's Splits and lumps section now covers eBird's 2019, 2021, 2022,
2023, 2024 and 2025 taxonomy updates (eBird released none in 2020), up from
2023 to 2025. The generator learned the rules Cornell's 2019, 2021 and 2022
files needed; each covered year still reproduces eBird's announced tally or
nothing is written, and the 2023 to 2025 events are unchanged. No control,
layout or copy changes: the coverage sentence is derived from the asset and
now reads "Covers eBird's 2019 to 2025 taxonomy updates. A change made before
2019 is not recorded here."

### How to test
1. `cd frontend && npx vitest run src/lib/taxonomyHistory*.test.ts` (the
   generator, asset and runtime suites, 113 rows).
2. With the 14 Cornell files in the gitignored
   `scripts/taxonomy-history-input/` (this Mac has them), run
   `node scripts/build-taxonomy-history.mjs`. Expect `453 splits and 97 lumps
   covering 2019 to 2025, 213276 bytes`, and `git diff --stat` on the asset to
   show only the `generated` date if it is run on another day.
3. Load an eBird backup in the app, open Species Detail, open "Splits and
   lumps". The panel's coverage line says 2019 to 2025. Pick Little
   Shrikethrush or Sunda Crow (if your backup has them) to see a three-event
   history; a current backup holding Pilbara Grasswren must not say it
   predates the 2021 update.

### Notes for reviewer
- **The resolver rules** (each written where it is implemented in
  `scripts/lib/taxonomyHistoryDerive.mjs`, each with an in-memory fixture row
  seen red first against HEAD and against its own rule disabled):
  a lump survivor that is also a split daughter carries its split parent;
  the checklist's subspecies rows decide which survivor a sentence-named
  species joins, and also bring in a species the sentence names by common
  name only; a row carrying `new species` is newly described, never a split
  daughter; a lone unannotated promotion that keeps the parent's scientific
  name is a re-code; two narrowing tie-breaks (the daughter's rows, then its
  own sentence) for a sentence that names two parents.
- **`ANNOUNCED_RECOUNTS`, a cited table under the tally check.** eBird counts
  two three-into-two reorganizations by their net change (2019 white-eyes,
  2022 hill mynas): one lost, none gained, where the events count one gained
  and two lost. A recount may only relabel within the events it names: each
  named event must be derived exactly once, each of its two figures must lie
  between zero and its events' own, and its net must equal theirs. The 2019
  entry rests on eBird's itemized lumps list; the 2022 entry is attributed by
  the same shape, and `decisions.md` records the alternatives (eBird's own
  2022 list sums to 42, not its announced 41). The asset holds every event either way.
- **Scope grew in one place, deliberately: `frontend/src/lib/taxonomyHistory.ts`.**
  eBird re-uses codes across updates (Pilbara Grasswren lumped 2021 and split
  back out 2024 under the same code). Without the change, a 2025 backup holding
  Pilbara Grasswren would read "Your backup predates the September 2021
  update". The runtime now indexes a before code by code only when no later
  event creates it again; the shared checker's I6 and slash rules admit
  exactly the re-used and dropped codes measured, with bounded negative rows.
- **Pink Pigeon (2022) is a real lump of Reunion Pigeon**, named by common name
  only, not the rename 1.0.57 inferred without the files. The rename rule
  itself stays. DECISIONS.md v1.0.41's and v1.0.57's notes need a correction
  (The Chronicler).
- **Proof the 2023 to 2025 events are identical:** the 234 events compared as
  canonical JSON (ordered and as multisets) against `git show HEAD:` of the
  asset, and the changed generator over only the 2022 to 2025 inputs rewrites
  HEAD's 93,936-byte asset byte for byte.
- **Size:** 213,276 bytes against `historyMaxBytes(6)` = 409,600 (bound not
  loosened); the lazy chunk is 191.57 kB, 36.34 kB gzipped, and stays off the
  entry chunk.
- **Owed at the ship (not in this diff):** the patch bump and CHANGELOG, the
  held App Store What's New line and F-Droid changelogs, and recapturing both
  05 Species Detail screenshots: the iPad's coverage line is stale, and the
  demo data's "Splits and lumps 6 species" becomes **10 species** (American
  Crow, Barred Owl, Eastern Meadowlark and Great Horned Owl join).
- Gates run: `npm run typecheck`, `npm run lint`, the full `npx vitest run`
  (10,300 passed, 6 skipped) and `npm run build`, all exit 0.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
