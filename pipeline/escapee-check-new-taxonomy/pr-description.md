## Escapee check under the new taxonomy (escapee-check-new-taxonomy)

### What this does

The Statistics escapee check can now settle a species that a backup downloaded before eBird's 2026 update names by its old name. When the backup's name is a before-side name of a split or lump in the latest covered update, an eBird answer row under a sibling code from the same event (another daughter or the slash) counts as the answer for that species. A lumped-away name, which used to resolve to no code, now joins its surviving species and gets checked. Statistics and Life Lists build their cover index with the same join, so the two tabs always agree on whether the check has finished.

Stamps written under the old join are dropped on load, so they no longer hold the line open for up to 30 days, and nothing already answered is asked again. When species stay open, the line now names them through `BirdName`. On the August `data/` copy, the open set drops from 3 to 1, and the line reads "eBird's answers did not include Eurasian Skylark, so it still counts."

### How to test

Automated (from `frontend/`):

```
npx vitest run src/lib/exoticTaxonomyJoin.test.ts src/lib/exoticProvenanceConvergence.test.tsx \
  src/lib/exoticProvenance.test.ts src/lib/exoticProvenanceCache.test.ts src/lib/useExoticProvenance.test.tsx \
  src/lib/lifeListsProvenance.test.ts src/components/ExoticProvenanceAccount.test.tsx \
  src/lib/settingsRouteBudget.test.ts src/lib/entryChunk.test.ts src/lib/exoticProvenanceGraph.test.ts \
  src/components/lifeLists/LifeListsTab.test.tsx src/components/BirdingStats.test.tsx
npm run typecheck
```

The Engineer's run: 30 files and 749 tests passed over every suite that touches this code, including every suite that mounts Statistics. Typecheck and eslint were clean on the touched files. The full suite was not run (The Tester owns it).

Manual, with a backup downloaded before 2026-10-29 and an eBird key:
1. Open Statistics. Wait for the line under the Species figure to settle.
2. It names the species eBird's answers left out. On the user's August backup that is Eurasian Skylark, and Willet and Marsh Wren are no longer open. The name opens Species Detail and carries its eBird and Birds of the World marks.
3. Open Life Lists. Its status line agrees: the check has not finished (one species is open).
4. Reload. No checklist is asked again.

### Notes for reviewer

**The one join rule.** The rule is `joinedCover` in `lib/exoticProvenance.ts`, applied by `buildCoverIndex`'s new optional `join` argument, once per distinct normalized name. The table is `EscapeeJoin`, which `buildEscapeeJoin` derives in the new `lib/exoticTaxonomyJoin.ts` from the latest covered update's events: for each before-side name, its own code and the event's after and slash codes. A name the lookup resolved inside the event keeps its code and gains the rest of the event's codes as stand-ins (`CoverIndex.standIns`). A before-side name the lookup missed (each 2026 lumped-away name, for example "House Swift") is keyed on its own pre-update code (`houswi1`), and the whole event family stands in for it. A lookup that landed outside the event does not join. The merge (`mergeChecklist`, new `standIns` argument, threaded through `dedupedFetchChecklist`) reads stand-ins only for a code the export says the checklist carries, and only when the answer has no row under that code itself. Joined rows are recorded under the cover code, and a joined code is never stamped, even when a full species index refuses its admission. The file name sits inside `.claude/rules/bird-names.md`'s existing `frontend/src/lib/exotic*.ts` gate, so no rule `paths` needed to change.

**The guard: a current backup is not cross-joined.** There are two conditions, each with its own row in `exoticTaxonomyJoin.test.ts`, and each was mutation-checked red on its own.
- A 2026 name ("Saltmarsh Willet") is not a before-side name, so it has no stand-ins at all. Its slash row on the same checklist stays out.
- A name the update kept ("Great Horned Owl", which is both a before-side name and a current one) has stand-ins. The merge reads them only when the answer lacks the code's own row, and a current export's observation is always answered under its own code. So "Great Horned Owl" beside "Paramo/Tropical Horned Owl" stays escapee-only on its own X token.

A third row shows the join never reaches a checklist that does not carry the species, and a fourth shows a before-side name whose lookup lands outside its event is not joined.

**Why this is not a round trip under v0.5.87 FR-07.** FR-07 forbids recovering a code from a name: the reference probe round-tripped answer codes through the bundled taxonomy's names and produced 4 mismatches. The join does not do that.
- The export's own name is matched to a history event once, in the same name-to-code direction FR-07 already allows.
- What the join adds is a code-to-code relation inside that one event: answer code `willet1` stands in for cover code `willet2` because both are codes of the 2026 Willet split.
- No answer code is turned into a name, and no name of eBird's is turned back into a code.
- The published escapee and exotic lists are still the export's own strings, carried forward from `nameForCode`.

**Re-opening stamps without a version bump.** The store document gains one optional field, `unmatchedJoin`, on the same key and version. Every write carries `UNMATCHED_JOIN_VERSION` (1). On load, `sanitizeStore` keeps stamps only from a document whose marker equals it, so every document written before this build loads with no stamps. The ledger, the species records and both published lists are kept, so nothing already answered is asked again. Each formerly stamped species is re-asked once, through the existing heal (`carriersNeedingRefetch`), on one checklist per species. A species that is still absent is stamped again under the new marker, and the load after that sends nothing.

All the cache rules hold:
- **One chokepoint:** the marker is written by the one debounced writer and read by the one load path.
- **Validated on load:** strict equality, so any other value means no stamps.
- **Purge generation:** unchanged. A purge installs a fresh store with the current marker.
- **`isWithinTtl`:** unchanged, and still the one TTL read of a stamp.

The worst-case document grows by 18 B, to 16,494,744 B against the web/Pi route's 16,777,216 B. `settingsRouteBudget.test.ts` builds that document through `sanitizeStore`, and the store's comment states the new figure.

**Convergence figures** (`exoticProvenanceConvergence.test.tsx`, through the real `storage.ts` on both the Tauri and web seams):

| Row | Before (1.0.64 to 1.0.66) | After |
|---|---|---|
| Measured shape, consecutive loads | 29, 8, 0, 0 requests; 3 open; 37 checklist requests | 3, 0, 0, 0 requests; 1 open; 3 checklist requests |
| Status line on a settled load | "eBird's answers did not include 3 of your species, so they still count." | "eBird's answers did not include Eurasian Skylark, so it still counts." |
| Document left by 1.0.64 to 1.0.66 (all fresh, three stamps, no marker) | 0 requests, 3 open for up to 30 days | 3, 0, 0 requests, then 1 open |
| Every 2026 shape answered under a sibling | not reachable (House Swift never checked) | Statistics complete, Life Lists complete |
| Same, with House Swift's answer lacking it | Statistics silent about it, Life Lists complete | Statistics names House Swift, Life Lists open; a Life Lists index without the join would read complete (the discriminator) |

Two control rows keep the old figures in the suite: without the join the measured shape still sends 29, 8, 0 and leaves 3 open, and the same stamps under the current marker are honoured (0 requests, 3 open). So it is the join and the marker that move the numbers. Life Lists is read through its real hook (`useLifeListsProvenance`), which loads the join itself.

**Data-copy verification.** A scratch test, now deleted, drove the real controller over `data/ebird-backup.csv` (21,856 rows, 268 cover species) and the stored August document (79 checklists). Codes were resolved as the batch resolves them. eBird's answers were modelled on the measured shape: each species under its own code, except the 2026 before-side names, answered under their old codes as the seam folds them (`willet1`, `marwre`), and checklist `S186299363` lacking the skylark.

| Case | Loads | Open |
|---|---|---|
| Without the join | 29, 8, 0 | Willet, Marsh Wren, Eurasian Skylark |
| With the join, from the August document | 3, 0, 0 | Eurasian Skylark only |
| With the join, from the document 1.0.66 leaves (stamps, no marker) | 3, 0 | Eurasian Skylark only |

The join gave stand-ins to four of the backup's names: Willet, Marsh Wren, Great Horned Owl and European Robin. The last two are kept names, answered under their own codes, so they are never joined in practice.

**The status line names open species.** `exoticCopy.ts` gains `unmatchedSentence` (parts), `orSeparator` and `unmatchedSentenceText`. `statusSentence` returns the plain text, and the account renders the same parts with each name through `BirdName` (`size="sm"`, `hasEntry`, `onOpenSpecies`, the tab's own `codeFor`). This is the `eventSentence` pattern from Splits and lumps. The status gains an optional `openNames`, set only for the `unmatched` reason, by the end of a pass and by the auto-start skip (sorted with `openSpeciesNames`). The shapes are:
- One name: "did not include A, so it still counts."
- Two names: "A or B, so they still count."
- Up to four names: all named, serial comma.
- Five or more: "A, B, C, or N other species", where N is at least 2.
- No names in hand: the old count form, unchanged.

A generated corpus covers counts 1 to 40. The em-dash sweep now includes the named forms. `docs/HELP.md` is unchanged, because its account of the line ("partially resolved with a Check again button") still holds.

**Declared work over user file content** (`.claude/rules/security.md`, written at `buildCoverIndex`'s definition). Per row, there is one `Map.get` on a memo keyed by normalized name. Once per distinct name, there is the existing code lookup plus `joinedCover`, which is asset-bounded: one `toLowerCase`, one `Map.get`, and a walk over at most the event's codes (seven in 2026). The memo holds one entry per distinct name, and `standIns` at most one per before-side name in the asset. A work-done row pins "once per distinct name" with a leg where every row is its own name (20,000 rows, 20,000 resolutions, against 1 for one repeated name). In the merge, one pass groups the answer's rows by code, built only when the cover has stand-ins. The join itself is bounded by the carried codes times their stand-ins.

**Loading, entry chunk and network.** Statistics awaits `loadEscapeeJoin()` alongside the backup, so the first cover index already has the join (a pass that started before it landed would stamp a pre-split name). Life Lists' hook loads it through the same loader and reads "not finished" until it lands, the same as while its codes are pending. The loader is memoized and never rejects: a failed asset load or derivation means no join, the old behaviour. The asset is reached only through `loadTaxonomyHistory()`'s dynamic import. `entryChunk.test.ts` now asserts the asset is off the static graphs of Statistics, Life Lists and Species Detail, and that both new readers reach the loader; a static import into the join module was confirmed red. On network: no third-party request, no new endpoint or host, and no request moved between components. On web/Pi the history chunk is a static file from the user's own server that Species Detail already loads.

**Attempt 1 retry: a comma never starts a line (D-01).** QA found a comma, ", or" or ", so it still counts." alone at the start of a line in 48 of 384 width and text-size combinations, in both engines. Each comma was the first text after an inline `BirdName` box, and both engines allow a break right after that box. The fix: `BirdName` gains one optional prop, `trailing`, which renders the punctuation in the name's own row, after the two marks (`.sr-birdname-trail`, `flex-shrink: 0; white-space: nowrap`). Every other call site is unchanged and renders the same DOM. The account now gives each name the text that follows it. The punctuation up to the first space goes in `trailing`, and the words after it stay outside `BirdName`, free to wrap. The wording and the live region's text are unchanged. This line also turns on `breakAfterSlash`, which does nothing to a name without a "/". Without it, a slash name such as "Saltmarsh/Prairie Willet" ran 22.5px past the card at 320px with 200% text in both engines; that overflow was already there before this retry. One jsdom row pins the structure.

Re-measured in Chromium and WebKit on the rebuilt bundle, with the same 384 combinations (16 widths from 320 to 1280px, text at 100%, 125%, 150% and 200%, three scenarios) and every eBird-backed request answered or refused inside the browser:
- **Commas starting a line:** none in either engine, down from 24 per engine (48 in all). A stricter check, any punctuation drawn at the start of a line, also found none.
- **Overflow:** no text ink past the row or the card, and the page never scrolls sideways.
- **Marks:** each keeps its full 24px target and hit-tests to itself.
- **Live region:** its text is the exact sentence in all 384, and the accessibility tree reads it with each name button and its two labelled links in place.
- **Long names:** a further 336 combinations at 320 to 430px swapped in long names ("Saltmarsh/Prairie Willet", "Yellow-chevroned Parakeet", "Northern Rough-winged Swallow") and found no comma at the start of a line, no ink overflow and no sideways scroll.
- **Screenshots:** the `retry-*` files in the QA shots folder.

Splits and lumps' sentence, the precedent this line followed, works differently. It renders its names `display: inline`, with no button and no marks (it passes no code and no `onOpenSpecies`), so each comma follows the name's own text, where neither engine may break. It was not measured here.

**Known limitations.**
1. Only the latest covered update (2026) is joined. A backup that predates an earlier update keeps the old behaviour for those species, which the line now names.
2. A pre-lump checklist that carries both lumped names (for example Little Swift and House Swift), or a kept name beside its slash, gives both names both rows. If the sibling's row were tagged Escapee, the species would read as escapee-only rather than counting. With the 2026 asset (swifts, owls, robins and the like) no such row exists in practice; recheck at the next taxonomy refresh (security report I-1).
3. If the `/taxonomy/codes` batch fails on Statistics' first load, the 2026 before-side names now resolve through the join's fallback, so a pass could run over just those few species. Before, a failed batch left the cover empty and the line read "not checked yet". This needs the codes route to fail while the checklist route answers. On web/Pi both go through the same backend, and on Tauri the codes resolve from the bundled snapshot, so it is not realistically reachable.
4. `UNMATCHED_JOIN_VERSION` must be raised whenever the join changes what it admits, the annual taxonomy-history refresh included. Nothing enforces that yet (see the convention flag below).

### Convention flags
- **A stored "the answer lacked it" stamp records the join it was written under** (`unmatchedJoin`, `UNMATCHED_JOIN_VERSION` in `exoticProvenanceCache.ts`). A change to what the escapee join admits bumps the marker, the annual taxonomy-history refresh included, so stamps written under the old join reopen once instead of holding a species open for 30 days. This is a step worth adding to `scripts/taxonomy-history-input/README.md`'s ordered runbook.
- **The escapee cover's taxonomy join is one rule (`joinedCover`) over one table (`loadEscapeeJoin()`)**, and every builder of a cover index that feeds a completion or classification passes it. A new reader of escapee completion builds its index with that join, or it disagrees with Statistics about lumped-away names.
