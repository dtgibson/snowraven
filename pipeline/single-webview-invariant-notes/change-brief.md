# Change Brief — single-webview-invariant-notes

## What is changing

A short structural note at each definition site of the module-scoped state that
the single-webview invariant protects, plus one at the keeper that makes the
invariant true, all carrying one mechanical marker phrase so they are
cross-linked and a removal is visible. Comment text only, plus one new guard
test. Sites: `frontend/src/lib/storage.ts` (`docChains` / `chain`),
`frontend/src/lib/replayStore.ts` (`_writeChain` / `writeThrough` and
`_purgeGeneration`), `frontend/src/lib/clearDerived.ts` (the clear-path entry
point the generations are reached through), `src-tauri/src/lib.rs` (the
`Builder::run` call that drops `RunEvent::SceneRequested`), and one short
cross-reference in `frontend/src/lib/exoticProvenanceCache.ts`, which carries a
second `_purgeGeneration` of the same class.

## Why now

A v1.0.30 security review Low, open on ROADMAP.md since, and its other half is
already done: CLAUDE.md's v1.0.9 storage entry states the invariant and its
reversal condition and ends "repeating it at each definition site is still open
(ROADMAP)". The person who dissolves the invariant — real iPad multi-window, or
the deferred Tauri 3 upgrade — will be adding a window, not editing
`storage.ts`, so a statement that lives only in CLAUDE.md is in the wrong file
to reach them. CLAUDE.md records twice over that a written reminder alone has
failed in this repo.

## User-facing impact

None. No behaviour change, no new dependency, no bundle change: JS comments are
stripped by the production build and Rust comments never reach the binary, so
the shipped app is byte-identical. The new guard test is a test file and does
not ship. Under CLAUDE.md's dev-only carve-out this change would owe no version
bump, changelog entry, tag or release of its own; it rides the Spool bundle's
one version bump because the bundle carries user-facing builds alongside it.

## Design pass

Not needed — no visual change.

## Decisions touched

None reversed; four extended, all in the same direction.
- v1.0.9 settings-write-clobber / `docChains` serialization (CLAUDE.md, DECISIONS.md).
- v1.0.14 `replayStore` ordered writer, purge generation, and the `clearDerived` registry.
- 2026-09-15 `b472ae8`: "THE SINGLE-WEBVIEW INVARIANT IS NOW STATED" (DECISIONS.md ~line 81) and
  "IPAD MULTI-WINDOW IS AN ACCEPTED PLATFORM SIDE EFFECT" (~line 77).
- v1.0.31's correction to the ROADMAP item's tao half: the notes must NOT repeat
  the struck claim that tao 0.37 makes the scene manifest unnecessary; a newer
  tao retires the vendored patch, not the manifest.

## What done looks like

Each of the four required sites carries a note with the marker
`SINGLE-WEBVIEW INVARIANT`, naming the state it protects, the keeper, and the
reversal condition, pointing at CLAUDE.md's v1.0.9 storage entry rather than
restating it. A new guard asserts the marker at all four (five with the optional
site) and asserts the keeper's own shape, so removing a note or changing the
keeper turns the suite red. `npm run build`, the full frontend suite and
`cargo check` stay green, `cacheInventory.test.ts` included.
