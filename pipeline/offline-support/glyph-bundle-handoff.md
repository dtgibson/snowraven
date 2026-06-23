# Offline base-label glyphs/sprite — VM build handoff (0.5.45)

**Status:** 0.5.45 (offline support) is committed at the tip of `main`, **not yet
tagged**. This is the one remaining build task before release: bundle the offline
base-map **labels** (glyphs + sprite) and flip `BUNDLED_MAP_ASSETS`. **Do it on the
VM** (it's dev work — see "Why the VM" below), verify the build, commit, push. Then
the Mac pulls and runs `release.sh`.

This supersedes the "Mac-side" framing of Steps 1 & 3 in `release-runbook.md` for the
glyph/sprite portion (that framing was wrong — see below). The PMTiles **region**
bake (Path A) is NOT part of this; it stays deferred.

## Why the VM (machine-role correction)

The Mac is **only** for `release.sh` (Apple signing/notarization). Everything else —
asset capture/bundling, the flag flip, source/test edits, `npm`, and the build
verification — is dev work and belongs on the VM. The `release-runbook.md` labeled
the glyph/sprite bundling "Mac-side" ("needs network + large data"); that's only true
for the heavy multi-hundred-GB PMTiles planet (Path A), which we're not doing. The
Band-1 glyph bundle is ~4 MB of small OpenFreeMap fetches — plain dev work. A Mac
shipping session started it, hit a broken dev environment, reverted, and handed it
back here.

## Decision (settled with Dave)

- **Scope:** ship offline base **labels** (glyphs + sprite) with the offline
  resilience half. NOT the downloadable PMTiles regions (Path A stays deferred).
- **Glyph coverage = Band 1, small scripts only (~3.5 MB).** Derived from a real
  US/CA openmaptiles vector-tile capture (major Chinatowns, LA Koreatown/Little
  Tokyo, Little Saigon, Brighton Beach, Dearborn, Nunavut/Nunavik). Band 1 is its
  subset **excluding CJK + Hangul**, which were measured at **33–43 MB** — dense
  urban *business* names, not birding labels, and committed to git forever. Those
  codepoints render as `.notdef` (by design: never a glyph network fetch after the
  rewrite). Bands for the record: small-only 3.5 MB · +CJK 33 MB · +CJK+Hangul 43 MB
  · full mirror ~100 MB.

## 1 — Sprite

Fetch into `frontend/public/mapassets/sprite/` from
`https://tiles.openfreemap.org/sprites/ofm_f384/`:

- `ofm.json`, `ofm.png`, `ofm@2x.json`, `ofm@2x.png`  (~224 KB total)

(Confirm the sprite path matches the live positron style's `sprite` field —
currently `…/sprites/ofm_f384/ofm`.)

## 2 — Glyphs

Fetch into `frontend/public/mapassets/glyphs/<fontstack>/<range>.pbf` from
`https://tiles.openfreemap.org/fonts/<fontstack>/<range>.pbf`.

- **Three fontstacks** (the only `text-font` values in the positron style):
  `Noto Sans Regular`, `Noto Sans Bold`, `Noto Sans Italic`. Keep the **spaces** in
  the directory names — MapLibre requests them `%20`-encoded and the static server
  decodes back to spaces.
- **The 17 Band-1 ranges, each stack** (Latin, Cyrillic, Bengali/Devanagari,
  Inuktitut syllabics, Khmer, Vietnamese, punctuation/symbols/dingbats, CJK-symbols/
  Kana, variation selectors):

```
0-255  256-511  512-767  768-1023  1024-1279  1280-1535  2304-2559
5120-5375  5376-5631  5888-6143  7680-7935  8192-8447  8448-8703
9728-9983  9984-10239  12288-12543  65024-65279
```

Result: **51 glyph files + 4 sprite files, ~3.9 MB total.** A range that 404s on the
server should simply be skipped (it has no glyphs; identical to today's online
behavior). Each present range is a non-trivial `.pbf`, not an HTML error body.

### Re-derive / verify the range set (optional but recommended)

The 256-codepoint "block" of a char = `codepoint >> 8`; range string =
`block*256`–`block*256+255`. To regenerate from scratch and confirm Band 1:

1. Tiles: `https://tiles.openfreemap.org/planet/{z}/{x}/{y}.pbf` (get the dated path +
   `maxzoom 14` from the TileJSON at `https://tiles.openfreemap.org/planet`).
2. Over the curated US/CA areas (Chinatowns SF/NYC/Vancouver/Toronto/Honolulu, SF
   Japantown, LA Little Tokyo/Koreatown/Thai Town, Little Saigon, NYC Koreatown,
   Brighton Beach, Dearborn, Iqaluit/Rankin Inlet/Kuujjuaq, plus general-coverage US/
   CA cities + country overviews), decode with `@mapbox/vector-tile` + `pbf` (already
   in `node_modules`).
3. Collect codepoints from the fields positron's `text-field` renders —
   `name:latin`, `name:nonlatin`, `name_en`, `name`, `ref` — across all features.
4. Map to blocks; **Band 1 = the captured blocks MINUS CJK (`78–159`) and Hangul
   (`170–215`)**, unioned with a safety baseline `{0,1,2,3,32}`. That yields exactly
   the 17 ranges above.

Re-verify this set on any Positron base-style / fontstack change (the data-dependent
coverage risk — schema open-risk #3).

## 3 — Flip the flag (`frontend/src/lib/mapStyle.ts`)

Set `export const BUNDLED_MAP_ASSETS = true` and replace the doc comment above it
with (verbatim, so wording stays consistent):

```ts
// ── Offline-support: bundled glyphs + sprite (FR-10, schema slice 2b) ──────────
//
// The bundled glyph/sprite assets ARE now captured into frontend/public/mapassets/
// (v0.5.45), so the rewrite is ON: online AND offline both serve labels/symbols
// from the same-origin bundle — glyph/sprite fetches to tiles.openfreemap.org drop
// to zero (QA-02). The bundled files:
//   - frontend/public/mapassets/glyphs/{fontstack}/{range}.pbf   (Noto Sans, 3 stacks)
//   - frontend/public/mapassets/sprite/ofm.{json,png,@2x.json,@2x.png}
//
// Coverage (schema 2b/2e capture-and-bundle): a real openmaptiles vector-tile
// capture over US/CA areas — major Chinatowns, LA Koreatown/Little Tokyo, Little
// Saigon, Brighton Beach, Nunavut/Nunavik — drove the exact {fontstack}/{range}
// set requested. We bundle the "Band 1" small-script subset (~3.5 MB: 3 Noto Sans
// stacks Regular/Bold/Italic × 17 BMP ranges): Latin + accents, Cyrillic, Inuktitut
// syllabics, Vietnamese, Japanese Kana, Khmer, punctuation/symbols. CJK + Hangul
// are deliberately NOT bundled (they ran ~30–40 MB and are dense-urban business
// names, not birding labels) — those codepoints degrade to `.notdef`, never a
// network fetch (by design). Re-verify this set on any Positron base-style /
// fontstack change (the data-dependent-coverage risk, schema open-risk #3).
export const BUNDLED_MAP_ASSETS = true
```

## 4 — Fix the test environment (`frontend/src/lib/mapStyle.test.ts`)

Add as the **first line**:

```ts
// @vitest-environment jsdom
```

With the flag `true`, `fetchTunedBaseStyle` now calls `rewriteStyleAssetUrls`, which
resolves against `document.baseURI` — so this node-env test file needs a DOM, like
`mapStyleRewrite.test.ts`. (Without it, the positron `fetchTunedBaseStyle` tests throw
`document is not defined`.) Add a one-line comment explaining why.

## 5 — Verify on the VM

```
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build
cd ../backend && .venv/bin/python -m pytest tests/ -q
```

All green on the Mac before revert: lint, typecheck, 1094 vitest. Also:

- **Chunk invariant (QA-37):** a fresh `dist/index.html` has no `vendor-maplibre` /
  `pmtiles` in its modulepreload, and no bare `import "./vendor-maplibre"` in the
  entry chunk.
- Confirm `dist/mapassets/glyphs/...` and `dist/mapassets/sprite/...` are populated
  (Vite copies `public/` verbatim).
- **Desktop smoke (schema open-risk #2):** the space-in-fontstack glyph path under
  `tauri://localhost` (`Noto%20Sans%20Regular/...pbf`) must resolve. Test an offline
  desktop map renders labels if feasible — a wrong origin/encoding silently blanks
  offline labels.

## 6 — Housekeeping

- Confirm `frontend/public/mapassets/` is **not** gitignored (verified on the Mac:
  it isn't) so the glyphs/sprite commit.
- Update `CHANGELOG.md` 0.5.45 entry to note **offline base labels** now ship (not
  just resilience).
- Update `pipeline/offline-support/release-runbook.md`: mark the glyph/sprite step as
  VM/dev work, not "Mac-side." (PMTiles region bake stays the only genuinely
  resource-special step, still deferred.)
- Re-check `docs/HELP.md` / `README.md` / `website/` if they describe offline-label
  behavior.

## 7 — Ship

1. Commit + push `main` (feature + assets + the doc updates).
2. Push tag `v0.5.45` (starts Windows CI) — only once it points at the final commit.
3. Wait for the `windows-build.yml` run to go green; confirm its `headSha` == the tag
   commit (standing tag-re-push guard).
4. **On the Mac:** `cd frontend && npm ci` (restore deps in a normal Terminal — the
   Mac's `node_modules` was wiped and the new `pmtiles@4.4.0` dep must install;
   Node networking is blocked inside the Claude tool sandbox, so it can't be done
   from a tool call), pull, then `zsh -lc ./release.sh`.

## Notes / gotchas observed

- OpenFreeMap's `Noto Sans Regular/Bold/Italic` are **full-Unicode composed** fonts
  (~33 MB/stack across the BMP), which is why CJK/Hangul are so large — the bundle
  must be a curated subset, never a full mirror.
- Vite copies `public/` → `dist/` verbatim; no build step processes the glyphs.
- `npm`/Node networking fails inside the Claude Bash sandbox (`EBADF`/ENOTFOUND);
  `curl`/Python work. Irrelevant on the VM in a normal shell — noted only so the Mac
  `npm ci` is run in Terminal, not via a tool.
