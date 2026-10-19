## big-old-life-lists

### What this does

SnowRaven now holds a large, old eBird life list with about a third of the
memory per parsed copy, refuses an oversized backup as soon as it is chosen
(before reading it), and takes a bigger backup on every platform: 64 MB on the
Mac, iPhone and iPad, 80 MB on Android, and 100 MB on Windows and web/Pi, each
set so the load asks a device for no more memory than 50 MB did. Life list
milestones run to 10,000 species, the escapee checklist ledger holds four times
the checklists it did (the largest size the web/Pi settings route can save),
and the splits-and-lumps generator is ready to take coverage back to 2019 once
Cornell's files are supplied.

Measured first, on V8, JavaScriptCore, Chromium (1x, 4x, 6x), WebKit, the iOS
27 simulator and the API 36 emulator, with synthetic 300k, 600k and 1M-row
exports; the numbers and the harness are in `decisions.md` and `evidence/`.

### How to test

1. `cd frontend && npx vitest run`: everything green (10,277 passed).
2. `cd backend && .venv/bin/python -m pytest tests/ -q`: 2,063 passed.
3. Identical output: build the base commit (`5bc136d2`) and this one, serve both
   against one data folder holding a real export
   (`evidence/harness/serve-dist-proxy.mjs`), run
   `evidence/harness/compare-builds.mjs <old> <new> <out.json>`: every tab
   identical in Chromium and WebKit.
4. Upload refusal: in Settings, choose an eBird backup over this platform's cap
   (`evidence/harness/gen-big-export.mjs 400000 big.csv` makes about 110 MB):
   the row shows "That file is larger than N MB, so it was not saved." at once,
   with N the platform's cap, and the stored file is untouched. An ML export
   over 50 MB gets the 50 MB line.
5. Milestones: serve `evidence/harness/gen-milestone-export.mjs`'s 10,050
   species and open Statistics; the grid ends at a 10,000 badge.
6. Memory and time: `evidence/harness/run-engines.sh`, `run-browsers.sh`,
   `run-caps.sh` (see each file's header).

### Notes for reviewer

- **The shape** (`observationsPacked.ts`): the parse worker packs entries into a
  table of distinct strings plus typed arrays and transfers it; each thread
  materializes ordinary `ObservationEntry` objects that share every repeated
  string. No consumer changed. A V8 structured clone does not keep string
  sharing, which is why interning alone was not enough (decisions entry 2).
- **Caps are per platform and per file kind** (`uploadGuard.ts`): the raise is
  the eBird backup's only; the ML export and bar-chart files keep 50 MB because
  their parses were not made compact. The Mac takes the iPhone's cap because
  iCloud Sync carries the backup between them. The backend gained
  `EBIRD_MAX_BYTES` (100 MB) beside the unchanged `MAX_BYTES`.
- **The main thread lets go of the export's text once it is posted to the parse
  worker** (`loadFresh` is a promise chain now; an async function's local would
  have kept it). That is half of why peak memory falls at all.
- **The stats budget's ceiling is derived** from the parse budget at the
  platform's cap; at the old 50 MiB it reproduces the shipped 240 s. The parse
  budget moved unchanged into `parseBudget.ts`.
- **Three security review findings are fixed** (decisions entry 12, one commit
  each). L1: on web/Pi the two checklist-keyed stores are saved whole through
  `/settings/{key}`, whose 16 MiB limit the first raise (262,144) outgrew, and
  the refusal was silent. Each cap is now the largest power of two whose
  worst-case document fits: the projects store back at 65,536 and the escapee
  ledger at 131,072. `settingsRouteBudget.test.ts` reads `_MAX_BYTES` from
  `settingskv.py` and builds each worst-case document through the store's own
  validator. L2: the parse sized its arrays from the file's line-feed count, so
  64 MB of line feeds reserved 8.2 GB; the hint is now also bounded by the
  file's length over the 122 bytes a row reserves (67 MB for the same file),
  and a real export is still sized once. I5: the packed-form validator runs
  through a field table typed on the interface. L3 (iCloud version skew) and
  L4 (the List Comparer) are left for the user, as directed.
- **The cap's other cost** (decisions entry 7): both stores live in the shared
  settings document, which every preference save rewrites whole, about 55 ms
  (V8) per save at the projects cap. Moving the projects store into its own
  document is the follow-up for anyone who needs a larger cap.
- **Splits and lumps**: the generator now excludes a rename filed as a lump (the
  2022 Pink Pigeon shape) under a now-required announced tally, and names what a
  refused input lacks. The asset is NOT regenerated: Cornell's files and the
  2019, 2021 and 2022 tallies are owed by the user.
- **Not driven**: the built native apps with a large file, and any physical
  device (decisions entry 11). `.claude/rules/security.md` now gates
  `parseEbirdObservations.ts` and `observationsPacked.ts`, the modules that hold
  the new scans over export text (a line-feed count and the interning Map, both
  linear, declared with their measured cost in decisions entry 12).
- Docs: `docs/HELP.md`'s passages that named 50 MB (the brief's line 92 and a
  restatement in the Settings walkthrough the guard found) and "10 to 3,000"
  follow the new numbers, held by `bigListsHelpClaims.test.ts`. No published
  surface changes; a changelog paragraph is held in `held-copy.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
