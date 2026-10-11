## Species Code Search

### What this does
Search (Cmd-K / Ctrl-K) and the shared species picker (Species Detail, the Calendar, the Map Explorer's My Sightings filter and the Statistics Weather picker) now find a bird by its four-letter code: `yrwa`, `amro`, `cago`. A query that equals a code of one of the user's birds lists those birds first, ahead of the ordinary name matches; every other query behaves exactly as before. The codes are a new bundled, lazily loaded asset generated from eBird's taxonomy, keeping each name's banding codes plus only the codes formed from the name SnowRaven shows (codes from British, international and former names are dropped at build time).

### How to test
1. `npm run desktop:dev` (or the web dev setup) with an eBird backup loaded.
2. Cmd-K, type `yrwa`: Yellow-rumped Warbler is the first species row; Enter opens Species Detail on it.
3. Type `cago`, `nosh`, `snow`: every bird carrying the code leads, then the name matches alphabetically. `goos`, `rodo` and `cost` behave exactly as before.
4. Type `list`: the Checklists and List Comparer destinations still come first.
5. In Species Detail's Select species box, type `yrwa` and press Enter: Yellow-rumped Warbler is selected. Same on the Calendar, Map Explorer and Statistics pickers ("All species" stays first where it exists).
6. Automated: `cd frontend && npm run typecheck && npm run build && npx vitest run`; the post-build `entryChunk.test.ts` rows confirm the asset is its own lazy chunk and never modulepreloaded.

### Notes for reviewer
- **Generator.** `scripts/build-ebird-taxonomy.mjs` is now I/O only; its pure core moved to `scripts/lib/ebirdTaxonomyDerive.mjs` (with a `.d.mts`). It refuses a live taxonomy that has moved past the shipped snapshot, writes only the code asset when the snapshot is unchanged (`codes-only`), and writes nothing until every check passes (one `writeFile(` call, after the plan). The asset was generated today in `codes-only` mode; the snapshot twins, countability and splits-and-lumps assets are byte-identical.
- **Asset.** `frontend/src/assets/ebird-alpha-codes.json`: 17,891 published names, 15,471 with a code, 588,825 bytes raw, 142,393 gzip (70% of the 200 KiB budget). Guarded in CI by `alphaCodesAsset.test.ts` (the shared checker plus independent re-assertions and mutation rows).
- **One ranking rule in one place.** `rankSpeciesMatches` and `highlightOnCodeArrival` in `lib/speciesMatch.ts`; the two existing predicates are byte-identical. The name predicate is passed in, so the identity suite's spy still counts it. The four picker call sites are untouched.
- **Never waits.** The asset loads on the first Search open or picker open, once per session, through `lib/alphaCodesAsset.ts`; surfaces read it through `useAlphaCodes()`. A failed load leaves name matching exactly as before, with no message and no retry. If the codes arrive while a surface is open, the rows re-rank and a highlighted species row is cleared rather than moved to another bird.
- **Deviations from schema.md, each recorded in decisions.md (7 to 9):** kept codes are sorted by code point within each group, because eBird's array order is not stable between fetches (1,164 entries reordered an hour apart); the linearity row's CPU bound is 2.5x per doubling on average, not 2.2, from measurements under load; and HELP's "Search makes no network request at all" was rewritten in the durable form, since on web/Pi the code chunk comes from the user's own server.
- **Docs.** `docs/HELP.md`'s Search section and the four picker passages describe codes; `palettePublishedClaims.test.ts` holds each claim and re-derives every published example through the real asset. No change to `README.md`, `website/`, `appstore/` or `PRIVACY_POLICY.md`. No version bump or CHANGELOG entry (assigned at deploy).
- **Rule files.** `.claude/rules/security.md` now gates `speciesMatch.ts`, `paletteRows.ts` and `alphaCodes*.ts`; `.claude/rules/bird-names.md` gates the asset, its modules and the generator core, and its annual-revision paragraph names the code asset.
- **Known limitation:** a slash or hybrid keeps only its own banding codes (`cago` does not list Cackling/Canada Goose); expanding composites is a recorded, unbuilt reversal (decisions.md 6).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
