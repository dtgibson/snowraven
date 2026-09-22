## single-webview-invariant-notes

### What this does

States the single-webview invariant at each definition site of the module-scoped
state it protects, plus at the keeper that makes it true, all carrying one
mechanical marker phrase `SINGLE-WEBVIEW INVARIANT` so the notes are
cross-linked and a removal is visible. Five notes: `storage.ts` (`docChains`),
`replayStore.ts` (the purge generation, with a pointer from the ordered writer),
`clearDerived.ts` (the clear-path entry point), `exoticProvenanceCache.ts` (the
second purge generation), and `src-tauri/src/lib.rs` at the `Builder::run` call,
which is the file the person who dissolves the invariant will actually be
editing and the one site with no existing coverage at all.

Each note names the state it protects, names the keeper, names its sibling
sites, and points at CLAUDE.md's v1.0.9 Desktop storage entry for the reversal
condition rather than restating it, so there are not five things that go stale
apart.

A new guard, `frontend/src/lib/singleWebviewInvariant.test.ts`, asserts the
marker at all five sites and asserts the keeper's own shape: `lib.rs` still
calls `.run(tauri::generate_context!())` and handles no `RunEvent::` in code. A
comment is a written reminder, and this repo records twice over that a written
reminder alone has failed here.

`.claude/rules/security.md` gains `storage.ts`, `replayStore.ts` and
`clearDerived.ts` in its `paths` frontmatter. Those three were ungated while
their keeper `src-tauri/src/lib.rs` was already inside that gate, and this
change makes them the canonical statement of a security finding.

Closes the v1.0.30 security review Low that CLAUDE.md's v1.0.9 entry ends with:
"repeating it at each definition site is still open (ROADMAP)".

### How to test

1. `cd frontend && npx vitest run src/lib/singleWebviewInvariant.test.ts` — ten
   rows, about 5 ms.
2. Prove it is not vacuous: delete the `SINGLE-WEBVIEW INVARIANT` line from any
   one note and re-run. Two rows go red (the site row and the spelling row).
3. Prove the keeper row bites: in `src-tauri/src/lib.rs`, replace
   `.run(tauri::generate_context!())` with
   `.build(tauri::generate_context!()).expect("build").run(|_app, event| { if let tauri::RunEvent::SceneRequested { .. } = event {} })`
   and re-run. The keeper row goes red with a message naming what stops being
   sufficient. Revert.
4. `cd frontend && npx vitest run` (whole suite), `npm run typecheck`,
   `npm run lint`.
5. `cd src-tauri && cargo check --lib` — proves the Rust comment compiles.

### Notes for reviewer

- **Comments only.** `git diff --stat` over the five source files is 34
  insertions and 0 deletions. No line was changed, no code was touched, no
  dependency added.
- **The `storage.ts` trap.** `cacheInventory.test.ts:64-68` asserts on the
  **raw** source of `storage.ts`, not the comment-stripped form, so a new
  comment containing `Map<`, `Set<`, `shift(`, `splice(`, `MAX_ENTRIES` or
  `MAX_BYTES` would turn it red. The note was written against that constraint;
  `cacheInventory` is green.
- **The guard strips comments for the keeper row only.** The keeper's own note
  names `RunEvent::SceneRequested`, so a raw scan could not tell that mention
  from a real handler. The strip is the `cacheInventory.test.ts` line-based
  shape, and a guard-the-guard row proves it strips rather than leaving that
  row passing vacuously.
- **The struck tao clause is excluded.** v1.0.31 struck the claim that tao 0.37
  makes the scene manifest unnecessary; a newer tao retires the vendored patch,
  not the manifest. No note repeats it.
- **The capability backstop row was deliberately not added.** `"windows":
  ["main"]` in the three `capabilities/*.json` is a claim about grants rather
  than about the invariant's statement, and nothing here touches those files.
  Recorded as a decision in `decisions.md`, not left as a silence.
- **One correction is owed in CLAUDE.md** (Chronicler's to make): the Desktop
  storage paragraph says "`clearDerived`'s purge generation", but no generation
  lives in that file. The counters are `replayStore.ts:69` and
  `exoticProvenanceCache.ts:226`, with `clearDerived` as the entry point that
  moves them.

### Changelog line

None: this is dev-only, the shipped bundle is byte-identical (JS comments are
stripped by the production build, Rust comments never reach the binary, and the
guard is a test file), so under CLAUDE.md's dev-only carve-out it owes no
changelog entry, version bump, tag or release of its own.
