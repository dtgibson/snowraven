# Fix: settings-write-clobber (v1.0.9)

## What this does

Serializes every read-modify-write on the desktop app's shared JSON documents
(`data/settings.json`, `data/api-keys.json`, `data/metadata.json`) so
overlapping saves can no longer clobber each other.

Before this fix, `TauriStorage.setSetting`/`deleteSetting` (and the same-shaped
api-keys and metadata paths) rewrote the whole document from a base read taken
before the write. Two overlapping cycles each read the same stale base and the
last writer silently dropped the other's keys. This is how the projects
ledger was lost during a 1.0.8 sweep: the debounced cache flushes collided,
and the installed app's settings.json ended up holding only `welcomeSeen` and
`exotic-provenance-v1`.

The fix is a per-document promise chain in `TauriStorage`
(`frontend/src/lib/storage.ts`): every method touching one of the three shared
documents runs as one link on that document's chain, keyed by path, so each
cycle starts from the previous write's result. Reads are chained too (tiny
local files; buys read-your-writes ordering). Two structural rules are
enforced in the code and its comments: a link never awaits another chained op
(no reentrant deadlock; links use the unchained `readJson`/`writeJson`/
`readMeta` primitives), and a failed link rejects only its own caller (the
stored chain tail swallows the rejection, so one failed write never poisons
later writes).

Also in this change, and required by it: the fs plugin is now dynamically
imported once per adapter (`fs()` memoizes the import promise) instead of once
per call. In production this drops a resolver round-trip per fs operation; in
the suite it is what makes the plugin mockable at all (see reviewer notes).

`WebStorage` is untouched per the bug brief (web/Pi writes one file per key on
the backend; no shared document). The style-blob and replay stores are
untouched: own files, whole-document writes, no in-module read-modify-write.

Version 1.0.8 -> 1.0.9 in BOTH `frontend/package.json` and
`src-tauri/tauri.conf.json`, plus a CHANGELOG entry. No schema change, no
migration. Already-lost ledger data is not recoverable; the next full projects
check re-earns it and it now stays put.

## How to test

1. `cd frontend && npx vitest run src/lib/storageWriteSerialization.test.ts`
   (9 tests: the forced-interleaving proofs on all three documents).
2. `npx vitest run` for the full suite (234 files / 3635 tests green).
3. `npm run build` (tsc -b + vite build; green).

## Notes for reviewer

**Red-first evidence.** The new test file
`frontend/src/lib/storageWriteSerialization.test.ts` was written and run
against the PRE-FIX `storage.ts` (with only the `fs()` memoization applied so
the mock is deterministic, see below). Result: `6 failed | 3 passed (9)`, each
failure the exact clobber the brief predicts:

- overlapping setSetting: `expected { b: 2 } to deeply equal { a: 1, b: 2 }`
  (key `a` gone; the brief's field signature)
- 22-writer storm: `expected [ 'k1', 'k4', 'k7' ] to have a length of 20 but
  got 3` (17 of 20 keys lost)
- delete-then-set: `expected { x: 1, keep: 'v', y: 2 } to deeply equal
  { keep: 'v', y: 2 }` (a stale write resurrected the deleted key)
- overlapping setApiKey: `expected { openweather: 'OW' } to deeply equal
  { ebird: 'EB', openweather: 'OW' }` (an API key lost)
- overlapping writeFile: `expected undefined to be 'MyEBirdData.csv'`
  (a metadata entry lost)
- writeFile vs deleteFile: `expected { filename: 'MyEBirdData.csv', ... } to
  be null` (a deleted entry resurrected)

With the chain in place and the test file unchanged, all 9 pass. The three
pre-fix passes are the harness guard (below), the set-then-delete ordering pin
(whose final document shape happens to match pre-fix under that specific
interleaving; it pins the fixed semantics), and the rejected-write test (the
pre-fix code trivially does not chain failures either).

**The fs-plugin mock and a vitest race worth knowing about.** This is the
repo's first `@tauri-apps/plugin-fs` mock: an in-memory file map where every
operation can be parked and released in a chosen order (reads-first for the
deterministic clobber; seeded-random for the storm). Two hard-won details:

1. vitest's dynamic-import interception for an externalized node_modules
   package is not reentrant: with `vi.mock` registered, 22 concurrent
   first-time `await import('@tauri-apps/plugin-fs')` calls raced the mock
   registration and 21 of them fell through to the REAL plugin (failing with
   its `window is not defined`). Neither a static import in the test file nor
   warm call sites closed the race. The durable fix is in the subject:
   `TauriStorage.fs()` memoizes one import promise, so exactly one dynamic
   import ever runs and every caller shares it. This is also a small
   production win (one resolver round-trip per adapter, not per call).
2. The mock asserts its own presence (a sentinel `BaseDirectory.AppLocalData`
   value of 4 vs the real enum's 15), so a future leak of the real plugin
   fails loudly instead of certifying vacuous tests.

**The cacheInventory guard.** `cacheInventory.test.ts` pins storage.ts as
owning no cache (`no Map<`/`Set<`, no eviction). The chain state is a
three-key mutex, not a cache, but the guard was honored rather than weakened:
`docChains` is a plain `Record` keyed by the three internal path constants,
values are tail promises, nothing retained or evicted. The guard is untouched
and green.

**Suite stability note.** One full-suite run immediately after the fix
reported 1 failed / 3634 passed; the failing test's name was not captured
before the output was discarded. Five subsequent full-suite runs (plus the
final gate run) were fully green with exit 0, 3635/3635. Recorded here rather
than claimed away; nothing in the failing count matched the new file (9 tests,
all green in every captured run).

**Known limits.** Serialization is per adapter instance (the module singleton;
the app has exactly one). It does not serialize across processes, and
caller-level read-modify-write composed from separate get/set calls is
serialized only per call, not per transaction. Both are outside the brief.
The ROADMAP's "serialize durable-cache write completion" entry is now closed
for the settings.json stores; replay.json same-key ordering stays as recorded
there (flagged for the Chronicler, not edited in this diff).

## Seeing it locally

This fix has no new screens; what changed is that things you save no longer
vanish. To see it hold on desktop:

1. Open a terminal in your project folder.

2. Start the desktop app in dev mode:
   `cd frontend && npm run desktop:dev`

3. When the app window opens, change several remembered things quickly, one
   after another: switch the theme in Settings, drag the map to a new spot,
   and change the text size.

4. Quit the app fully and start it again with the same command.

5. Everything you changed should come back exactly as you left it: same
   theme, same map position, same text size. Before this fix, saves landing
   close together could silently undo one another, which is what reset the
   projects check in 1.0.8.

6. If you use the projects check (Statistics tab), its saved answers now
   survive a long run: start a check, let it run a while, stop it, relaunch
   the app, and the "checked so far" count picks up where it left off.
