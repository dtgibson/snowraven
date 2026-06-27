# Offline Support — Release Runbook

This is the checklist for shipping the offline-support feature (v0.5.45). All dev
work — feature code, tests, docs, the version bump, **and the bundled base-map
label assets** — is committed from the build **VM** and green. The only genuinely
**Mac-only** step that remains is the binary release itself (`release.sh`): Apple
signing/notarization credentials live only in the Mac login profile.

**Machine-role correction:** everything except `release.sh` is dev work and belongs
on the **VM**, not the Mac. The earlier "(Mac-side)" title and the "map-asset
generation needs network + large data" note were wrong for the glyph/sprite label
bundle — it is ~4 MB of small OpenFreeMap fetches, plain dev work, done on the VM
(see `glyph-bundle-handoff.md`). That caveat only ever applied to the heavy
multi-hundred-GB PMTiles **region** bake (Step 2), which is **deferred** out of
0.5.45.

The build VM has already done: all feature code + tests, docs + privacy policy,
the version bump (`0.5.45` in both `frontend/package.json` and
`src-tauri/tauri.conf.json`), the CHANGELOG entry, the **bundled eBird taxonomy
snapshot** (`frontend/src/assets/ebird-taxonomy.json` +
`backend/staticdata/ebird_taxonomy.json`), and the **bundled glyph/sprite label
assets** under `frontend/public/mapassets/` with `BUNDLED_MAP_ASSETS` flipped on
(Steps 1 + 3) — all committed.

---

## Scope of 0.5.45 (settled with Dave)

Ship the offline-**resilience** half (maps open offline with your data,
weather/tide replay, offline taxonomy/sort, honest offline messaging, the region-
manager UI) **plus offline base LABELS** (bundled glyphs + sprite). **Defer** the
downloadable PMTiles **regions** to a later version.

- **Offline base labels (Step 1, glyphs/sprite) — DONE on the VM.** They ship in
  0.5.45; `BUNDLED_MAP_ASSETS` is flipped on (Step 3, done). Band-1 small-script
  coverage: 3 Noto Sans stacks × 17 BMP ranges + the sprite, ~3.9 MB. Full detail
  in `glyph-bundle-handoff.md`.
- **Downloadable regions (Step 2, PMTiles bake) — DEFERRED.** The only genuinely
  resource-special step; ships later via this same runbook. With no regions baked,
  the manager simply shows "no regions downloaded yet."

Of Steps 3–7: Steps 3–4 are done on the VM, the VM also does the commit + push +
tag (Steps 5–6), and the Mac runs only Step 7 (`release.sh`).

---

## Prerequisites (Path A only, for Steps 1–2)

- `go-pmtiles` CLI (the `pmtiles` command — NOT the npm runtime dep).
- The Protomaps planet PMTiles source (`build.protomaps.com`, ODbL) or a
  self-run `planetiler` build. See `tools/build-regions/README.md`.
- `gh` authenticated for creating the `regions-2026.06` GitHub release.
- County/state boundary GeoJSON (US Census TIGER + Canadian census divisions),
  dateline-split for Alaska.

Always required (Steps 3–7): the Mac on the pinned Node (`nvm install $(cat .nvmrc)
&& nvm use $(cat .nvmrc)` — a bleeding-edge/non-LTS Node like 25 crashes `npm ci`
with npm's "Exit handler never called!" bug, npm/cli#8766), and the Mac login shell
with the Apple API key + notarization creds exported (run it as `zsh -lc
./release.sh`; a bare `./release.sh` fails preflight with `APPLE_SIGNING_IDENTITY is
not set`). `release.sh` is self-healing — it installs both root and frontend deps
itself and preflights tools/Node/network before the build.

---

## Step 1 — Bundle glyphs + sprite  *(VM/dev work; FR-10)* — DONE

> **DONE on the VM (0.5.45).** The Band-1 set is bundled: 3 Noto Sans stacks
> (Regular/Bold/Italic) × 17 BMP ranges = 51 glyph `.pbf` files + 4 sprite files,
> ~3.9 MB, under `frontend/public/mapassets/`. CJK + Hangul are deliberately
> excluded (they ran ~30–40 MB; codepoints degrade to `.notdef`). The exact ranges,
> the derivation, and verify steps are in `glyph-bundle-handoff.md`. The reference
> below is retained for re-bundling on a future Positron/fontstack change.

Captures the vector base's label fonts and icon sheet so offline labels/symbols
render with no network. They go under `frontend/public/mapassets/` (URL-served
static assets — distinct from `src/assets/`, which is for imported data).

1. **Sprite** — fetch the OpenFreeMap sprite sheet into `frontend/public/mapassets/sprite/`:
   - `https://tiles.openfreemap.org/sprites/ofm_f384/ofm.json`  → `ofm.json`
   - `https://tiles.openfreemap.org/sprites/ofm_f384/ofm.png`   → `ofm.png`
   - `https://tiles.openfreemap.org/sprites/ofm_f384/ofm@2x.png` → `ofm@2x.png`
   (Confirm the exact sprite path from the live positron style's `sprite` field;
   it is the value `fetchTunedBaseStyle` currently passes through.)

2. **Glyphs** — fetch the needed `{fontstack}/{range}.pbf` font ranges into
   `frontend/public/mapassets/glyphs/{fontstack}/{range}.pbf` from
   `https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf`.
   - Read the fontstacks the style actually uses from the fetched positron style
     JSON (every symbol layer's `layout.text-font`; positron is the Noto Sans
     family). Bundle at minimum the Latin + Latin-supplement + punctuation ranges
     (`0-255`, `256-511`) for each fontstack; widen coverage per the schema 2b/2e
     capture if you bird outside the Latin range.
   - The cleanest way to discover the EXACT set is a one-off MapLibre
     `transformRequest` capture over the US/CA regions you bake (schema 2e) —
     record each glyph URL requested and bundle exactly those.

3. **Verify the rewrite is correct:** `rewriteStyleAssetUrls` already rewrites the
   style's `glyphs`/`sprite` to these local paths and keeps the
   `{fontstack}`/`{range}` tokens literal (`mapStyleRewrite.test.ts` locks this).
   Nothing to change there.

## Step 2 — Bake regions + populate the catalog  *(Path A only; FR-11/17)*

Follow `tools/build-regions/README.md` end-to-end (it has the full detail —
polygon clip never `--bbox`, z14, the dateline-split AK trap, size ceilings):

1. `pmtiles extract … --region=<boundary>.geojson --maxzoom=14` per region.
2. `gh release create regions-2026.06 *.pmtiles` (a separate tag from the app
   `vX.Y.Z` releases — never entangled with `release.sh`).
3. `node tools/build-regions/gen-catalog.mjs <metadata.json> --version 2026.06 \
   --base-url https://github.com/dtgibson/snowraven/releases/download/regions-2026.06/`
   → regenerates `frontend/src/assets/regions-catalog.json` (note: **`src/assets/`**,
   not `public/`).

## Step 3 — Flip the assets flag  *(VM/dev work)* — DONE

In `frontend/src/lib/mapStyle.ts`, `export const BUNDLED_MAP_ASSETS = true` (done).
This makes `fetchTunedBaseStyle` rewrite the persisted style's glyph/sprite URLs
to the bundled local assets from Step 1, so online and offline both serve
labels/symbols from the same-origin bundle.

## Step 4 — Re-verify the build  *(VM)* — DONE

```
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build
cd ../backend && .venv/bin/python -m pytest tests/ -q
```

Done on the VM with the assets bundled: lint + typecheck clean, 1094 vitest green,
build clean, backend 157 green. The QA-37 chunk invariant holds (a fresh
`dist/index.html` has no `vendor-maplibre`/`pmtiles` in its modulepreload — maplibre
appears only inside the lazy-chunk dependency manifest, never a static import), and
`dist/mapassets/` is populated (4 sprite + 51 glyph files). The `%20`-encoded
fontstack glyph paths (`Noto%20Sans%20Regular/...pbf`) and all four sprite files
resolve over a static serve; an unbundled CJK range correctly 404s.

## Step 5 — Commit + push main  *(VM)*

The build **VM** commits the feature, the bundled glyph/sprite label assets, the
`BUNDLED_MAP_ASSETS` flip, and the doc updates, and pushes `main`. No Path-A asset
work remains for the Mac — the region catalog stays as-is (regions deferred).

## Step 6 — Tag + Windows CI  *(VM)*

```
git tag v0.5.45 && git push origin v0.5.45    # starts the Windows CI build
```

Push the tag **only** when it points at the final commit (after any Path-A asset
commits) — so it isn't moved later (a re-pushed tag is the stale-CI hazard below).

## Step 7 — Release

**Tag-re-push guard (standing check):** if the tag was ever moved, confirm the
most-recent successful `windows-build.yml` run's `headSha` equals the tag commit
before releasing:

```
gh run list --workflow windows-build.yml --status success --limit 1 --json databaseId,headSha
git rev-parse v0.5.45^{commit}
```

Wait for that CI run to go green. Then, on the Mac, make sure Node matches the pin
(`nvm install $(cat .nvmrc) && nvm use $(cat .nvmrc)`) and run:

```
zsh -lc ./release.sh
```

`release.sh` is self-healing: it preflights tools/Node/network, installs **both**
the root and frontend deps itself (no separate `npm ci` step), then builds +
notarizes the universal macOS bundle, downloads + re-signs the CI Windows
installer, and writes one `latest.json` with both `darwin-aarch64` and
`windows-x86_64` entries (the in-app updater depends on it). Do **not** use
`gh release create` for the app release.

## Step 8 — Post-release

- Confirm the GitHub release has the macOS DMG + updater bundle + the Windows
  `-setup.exe` + `latest.json`.
- The website (already at v0.5.45) redeploys via GitHub Pages on the `main` push.
- If Path B: open a follow-up to bake regions + bundle glyphs (re-run Steps 1–3
  + a patch release) when ready.
