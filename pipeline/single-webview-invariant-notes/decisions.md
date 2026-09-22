# Decisions — single-webview-invariant-notes

## Stage 1 — The Evaluator (Improve lane, hands-off)

### The sites, and what each already says

**1. `frontend/src/lib/storage.ts`, `docChains` (574) / `chain` (576).**
Carries a 16-line v1.0.9 header covering the clobber it fixes, the two
structural rules (a link never awaits another chained op; a failed link rejects
only its own caller) and a "not a cache" note for `cacheInventory.test.ts`. Says
nothing about how many JS contexts exist. The note extends this block.

**2. `frontend/src/lib/replayStore.ts`, two module-scoped states.**
`_writeChain` / `writeThrough` (253–273) carries a full v1.0.14 block explaining
why `replay.json` is deliberately off `docChains` and why one writing module is
not one write at a time. `_purgeGeneration` (61–83) carries its own block on why
identity (`store !== _store`) is insufficient for a PUBLIC `put`. Both are
module-scoped; neither names the single-context assumption. One note serves
both, sited at the generation since it is the earlier declaration, with a
pointer from the writer block.

**3. `frontend/src/lib/clearDerived.ts`.**
Long header (the problem, CLEAR-vs-REPLACE, entry-chunk discipline, the
registry). **Finding: no purge generation lives in this file.** CLAUDE.md says
"`clearDerived`'s purge generation"; the counters are in `replayStore.ts` (69)
and `exoticProvenanceCache.ts` (226), and `clearDerived` is the entry point that
moves them through `import()`. The note here is therefore about the registry's
own reliance on one context, and names where the counters actually are. Flagged
for the Chronicler as a one-clause imprecision in CLAUDE.md worth correcting in
the same bundle.

**4. `src-tauri/src/lib.rs`, the keeper — and it is a genuine fourth note.**
`SceneRequested` appears NOWHERE in `src-tauri/src/`. The file ends
`.run(tauri::generate_context!())`; tauri 2.11.5 `src/app.rs:2449` defines
`Builder::run` as `self.build(context)?.run(|_, _| {})`, and `RunEvent::
SceneRequested` is defined at `app.rs:289`. **So the no-op run callback is
Tauri's own, installed by the choice to call `Builder::run` rather than
`.build(...).run(|app, event| ...)`.** CLAUDE.md's "forwarded to a no-op run
callback and dropped in `src-tauri/src/lib.rs`" reads as though a line in
`lib.rs` drops it; nothing in `lib.rs` mentions scenes at all. This is precisely
the file the person adding a window will be editing, and it is the site with
zero existing coverage, so it is the most load-bearing of the four.

**5. Optional fifth: `frontend/src/lib/exoticProvenanceCache.ts` (226).** A
second `_purgeGeneration` of the same class, not named in CLAUDE.md's three. One
cross-reference line. Recommended, cheap, easy for the gate to drop.

**Capability backstop:** `windows: ["main"]` confirmed present in all three of
`src-tauri/capabilities/{default,desktop,mobile}.json`.

### Existing guard coverage: none

Grepped `frontend/src` and `src-tauri` for `SceneRequested`, `windows: ["main"]`
and `capabilit`. Nothing asserts the keeper. `icloudPaths.parity.test.ts:17`
already reads `../../../src-tauri/src/lib.rs` from the frontend suite, so a
frontend guard reaching the Rust file is an established, CI-safe pattern (pure
`node:fs`, runs on `ubuntu-latest`).

### Scoping choices

- **Comments plus one guard test. No behaviour change, no design pass.** Branch
  rules: no new user-facing behaviour, no new surface, no schema, no brand or
  product-defining design. Squarely Improve.
- **One marker phrase, `SINGLE-WEBVIEW INVARIANT`,** so the notes are
  mechanically cross-linked rather than linked by prose that decays.
- **The notes POINT at CLAUDE.md's v1.0.9 storage entry, never restate it.**
  Restating the reversal condition in five places creates five things that go
  stale independently — the exact count-slip failure CLAUDE.md records from the
  v1.0.32 bundle. Each note names its own state, the keeper, and one pointer.
- **The tao clause is excluded.** v1.0.31 struck the ROADMAP item's claim that
  tao 0.37 retires the scene manifest; a newer tao retires the VENDORED PATCH.
  A note repeating the struck claim would re-publish a known-wrong sentence.
- **Version:** dev-only by CLAUDE.md's carve-out (byte-identical shipped app),
  so no bump, changelog entry, tag or release of its own; rides the Spool
  bundle's single bump.

### The trap the Engineer must not step in

`cacheInventory.test.ts:64-68` asserts on the **RAW** source of `storage.ts`,
not the comment-stripped `code()` form:

```
expect(storage).not.toMatch(/\b(?:Map|Set)\s*</)
expect(storage).not.toMatch(/\b(?:shift|splice)\s*\(/)
expect(storage).not.toContain('MAX_ENTRIES')
expect(storage).not.toContain('MAX_BYTES')
```

A new **comment** in `storage.ts` containing `Map<`, `Set<`, `shift(`,
`splice(`, `MAX_ENTRIES` or `MAX_BYTES` turns that guard red. Line 208's
`source('./replayStore.ts')` assertion is additive `toMatch` and is safe; the
three `lib.rs` assertions in `icloudPaths.parity.test.ts` are additive
`toContain` and are safe.

### Recommended verification (for The Tester)

Worth adding the guard rather than trusting the comments to survive: CLAUDE.md
records twice over that a written reminder alone has failed here (the version
pill, the App Store ledger), and a comment with no guard is exactly a written
reminder.

- `cd frontend && npm run typecheck && npm run lint && npm run build`
- `cd frontend && npx vitest run` (whole suite; `cacheInventory`,
  `icloudPaths.parity`, `entryChunk` are the ones that could notice)
- `cd src-tauri && cargo check` — comment-only Rust, no full build needed
- New guard `frontend/src/lib/singleWebviewInvariant.test.ts`, in
  `cacheInventory.test.ts`'s style but reading **raw** source (the marker lives
  in a comment, so comment-stripping would defeat it), pure `node:fs`,
  `JSON.parse` for the capability files, failing closed:
  - one row per site asserting the raw source contains `SINGLE-WEBVIEW INVARIANT`
  - one row asserting `src-tauri/src/lib.rs` carries it too
  - keeper row: `lib.rs` contains `.run(tauri::generate_context!())` and no
    `RunEvent::` handling — red exactly when someone takes a custom run callback,
    which is the change the notes exist to intercept; the failure message names
    CLAUDE.md's reversal condition
  - backstop row: all three `capabilities/*.json` parse and carry
    `"windows": ["main"]`

### Rule `paths` — an extension is owed

`src-tauri/src/lib.rs` is gated by `.claude/rules/security.md` (line 26).
`frontend/src/lib/{storage,replayStore,clearDerived}.ts` match **no** rule glob
anywhere. The invariant is a security finding (v1.0.30 review, Low) whose keeper
is already inside `security.md`'s gate, and this change makes those three files
the canonical statement of it — which is exactly the v1.0.32 shape "a rule that
names a canonical implementation must have that implementation inside its own
gate". Recommend adding the three paths to `security.md` in this change, per
CLAUDE.md's same-change obligation. Chronicler also moves the ROADMAP Up Next
item ("State the single-webview invariant at each definition site") to Shipped.

## Stage 2 — The Engineer (Improve lane, hands-off)

### What landed

Comments only, plus one new test file and three `paths` lines. `git diff --stat`
over the five source files is **34 insertions, 0 deletions** — no line changed,
so the shipped bundle is byte-identical.

| Site | Lines | Note |
|---|---|---|
| `frontend/src/lib/storage.ts` (574, above `docChains`) | 6 | one JS context, keeper, three sibling sites, CLAUDE.md pointer |
| `frontend/src/lib/replayStore.ts` (69, above `_purgeGeneration`) | 6 | covers the generation **and** the ordered writer below it |
| `frontend/src/lib/replayStore.ts` (273, above `_writeChain`) | 2 | pointer back to the note, carrying the marker |
| `frontend/src/lib/clearDerived.ts` (41, after the entry-chunk block) | 7 | the registry's own reliance; names where the generations actually live |
| `frontend/src/lib/exoticProvenanceCache.ts` (226) | 3 | the optional fifth, cross-reference only |
| `src-tauri/src/lib.rs` (232, above `.run(...)`) | 6 | the keeper: `Builder::run` supplies Tauri's own no-op callback |

The struck tao 0.37 clause appears in none of them. No em dashes in the new
lines (`--` throughout). The `storage.ts` note was written against the
`cacheInventory.test.ts:64-68` trap and contains none of the six forbidden
tokens; `cacheInventory` is green.

### The guard: `frontend/src/lib/singleWebviewInvariant.test.ts`

Ten rows, pure `node:fs`, no shelling out, 5 ms. Reads **raw** source (the
marker lives in a comment). `new URL(relative, import.meta.url)` + `fileURLToPath`
rather than `path.resolve` from a repo root — that is what `cacheInventory.test.ts`
and `icloudPaths.parity.test.ts` actually do, it is relocation-proof, and
`icloudPaths.parity` already proves the `../../../src-tauri/src/lib.rs` reach is
CI-safe on `ubuntu-latest`.

- one marker row per site (5)
- every note points at `CLAUDE.md` rather than restating the reversal condition
- keeper row: `.run(tauri::generate_context!())` present, and **no `RunEvent::`
  in the comment-stripped form**. The strip is load-bearing: the keeper's own
  note names `RunEvent::SceneRequested`, so a raw scan could not tell that
  mention from a handler. Failure message names the reversal condition and what
  stops being sufficient.
- guard-the-guard: the site list is non-empty (>= 5), every file exists and is
  non-trivial, and the stripper demonstrably strips (raw contains
  `RunEvent::SceneRequested`, the code form does not contain the marker and is
  shorter).

**Red-first, measured.** Two mutations were applied and reverted: swapping the
keeper to `.build(...).run(|_app, event| { if let tauri::RunEvent::SceneRequested
{ .. } = event {} })`, and deleting the marker from the `storage.ts` note. Result:
**3 failed / 7 passed** — the keeper row, the `storage.ts` marker row, and the
spelling row. The guard is not vacuous.

The capability-backstop row Stage 1 suggested (`"windows": ["main"]` in all
three `capabilities/*.json`) was **not** added. Reason: it is a claim about
grants, not about the invariant's statement, nothing in this change touches
those files, and the three are already pinned by their own schema. Recorded as a
non-action rather than an omission; a future build that wants it should site it
with the capability files, not here.

### Rule `paths`

`.claude/rules/security.md` frontmatter gained `frontend/src/lib/storage.ts`,
`replayStore.ts` and `clearDerived.ts`, placed beside `transport.ts` in the
existing style. Rule body untouched. This is CLAUDE.md's v1.0.32 same-change
obligation: the three files are now the canonical statement of a security
finding whose keeper (`src-tauri/src/lib.rs`) was already inside that gate.

### Verification results

| Check | Result |
|---|---|
| `npx vitest run src/lib/singleWebviewInvariant.test.ts src/lib/cacheInventory.test.ts src/lib/entryChunk.test.ts src/lib/icloudPaths.parity.test.ts` | **4 files, 81 tests passed** (393 ms) |
| `npx vitest run` (whole frontend suite) | **354 files passed, 2 skipped; 7,279 passed, 3 skipped** (50 s) |
| `npm run typecheck` (`tsc -b`) | clean |
| `npm run lint` (`eslint .`) | clean |
| `cd src-tauri && cargo check --lib` | **Finished** in 11.44 s; the only warnings are pre-existing vendored-`tao` dead-code warnings, none from `lib.rs` |

`entryChunk.test.ts` green confirms the comments changed no import graph, which
is what `clearDerived.ts` (entry-safe, `import()` only) and `replayStore.ts`
needed proving.

### Owed to the Chronicler

CLAUDE.md's Desktop storage (Tauri) paragraph says "`clearDerived`'s purge
generation". There is no generation in `clearDerived.ts`: the counters are
`replayStore.ts:69` and `exoticProvenanceCache.ts:226`, and `clearDerived` is the
entry point that moves them through `import()`. The clause should name both
files with `clearDerived` as the entry point. Stage 1 found it; Stage 2 confirms
it against the shipped source.

## Stage 4 ride-along: the Auditor's one Low, closed in place

The Auditor found `frontend/src/lib/exoticProvenanceCache.ts` cited in
`.claude/rules/security.md`'s rule body (the `SUBMISSION_KEY_RE` length bound) while
matching none of the file's `paths` globs, in scope because this build edited both that
frontmatter and that file. Closed as a one-line frontmatter addition beside the three
globs this build already added; the rule body is untouched and the frontmatter still
parses. The three Informational notes (the keeper row covers the scene path only, the
optional fifth site's CLAUDE.md pointer row is vacuous, the exact-filename globs leave
the seams' own guard tests ungated) are carried to the Chronicler unactioned.
