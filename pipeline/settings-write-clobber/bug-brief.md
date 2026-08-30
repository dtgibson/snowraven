# Bug Brief — Settings Write Clobber

## What is broken
On desktop, every settings save rewrites the whole `data/settings.json` from a
read taken before the write (`TauriStorage.setSetting`/`deleteSetting`,
`frontend/src/lib/storage.ts`). Overlapping saves silently drop each other's
keys: last writer wins with a stale base. During a projects sweep the debounced
cache flushes clobbered the ledger, so 1.0.8 re-checks all 3,445 checklists.

## Steps to reproduce
Deterministic, jsdom-testable (no fs-plugin mock exists yet; add one):
1. Mock `@tauri-apps/plugin-fs` with an in-memory file map; force `isTauri()` true.
2. Start `setSetting('a', 1)` and `setSetting('b', 2)` so both reads resolve before either write.
3. Await both, then read the document: key `a` is gone.
Field signature confirmed: the installed app's settings.json holds only `welcomeSeen` and `exotic-provenance-v1`.

## Expected behavior
Both keys persist regardless of interleaving. Read-modify-write cycles on the
settings document are serialized (in-module promise chain / mutex per document
is the recommended shape; Engineer decides details) so each write starts from
the previous write's result. `deleteSetting` and the same-shaped api-keys.json
and metadata.json paths obey the same rule.

## Blast radius
Desktop only; web/Pi writes one file per key (`settingskv.py`) and is unaffected.
At risk via setSetting/deleteSetting: projects ledger, escapee provenance, county
completeness, hotspot activity, theme, text scale, map defaults/base/trails, tab
layout, date format, tips, share-copy. Also serialize api-keys.json and metadata.json.
Closes ROADMAP's "serialize durable-cache write completion" for settings.json
stores; replay.json same-key ordering stays as recorded there. Already-lost data
is not recoverable: the ledger re-earns itself on the next full check.

## What done looks like
The interleaving test is red against the current code and green with the fix;
full suite green and `npm run build` clean. Version 1.0.8 → 1.0.9 in BOTH
`frontend/package.json` AND `src-tauri/tauri.conf.json`, plus a CHANGELOG entry
(this is a user-facing fix). No schema change, no migration.
