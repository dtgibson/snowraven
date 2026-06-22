# Offline Support — Release Runbook (Mac-side)

This is the **release-time** checklist for shipping the offline-support feature
(v0.5.45). The code, tests, docs, and version bump are all committed from the
build VM and green; what remains can only run on the **Mac** (Apple signing
credentials live only in the Mac login profile, and the map-asset generation
needs network + large data). Run these steps on the Mac.

The build VM has already done: all feature code + tests, docs + privacy policy,
the version bump (`0.5.45` in both `frontend/package.json` and
`src-tauri/tauri.conf.json`), the CHANGELOG entry, and the **bundled eBird
taxonomy snapshot** (`frontend/src/assets/ebird-taxonomy.json` +
`backend/staticdata/ebird_taxonomy.json` — already generated and committed).

---

## Decide first: what does 0.5.45 ship?

The offline-**resilience** half ships either way (maps open offline with your
data, weather/tide replay, offline taxonomy/sort, honest offline messaging, and
the region-manager UI). The two **Tier-B** pieces below are optional for this
release:

- **Path A — complete feature:** do Steps 1–2 (bundle glyphs/sprite, bake
  regions) so 0.5.45 ships offline base **labels** and **downloadable regions**.
- **Path B — resilience-only now:** skip Steps 1–2 and ship the resilience half;
  with no regions baked the manager simply shows "no regions downloaded yet," and
  the offline base shows your data + the persisted base without offline labels.
  Regions/labels then ship in a later version via this same runbook.

Steps 3–7 are required for **both** paths.

---

## Prerequisites (Path A only, for Steps 1–2)

- `go-pmtiles` CLI (the `pmtiles` command — NOT the npm runtime dep).
- The Protomaps planet PMTiles source (`build.protomaps.com`, ODbL) or a
  self-run `planetiler` build. See `tools/build-regions/README.md`.
- `gh` authenticated for creating the `regions-2026.06` GitHub release.
- County/state boundary GeoJSON (US Census TIGER + Canadian census divisions),
  dateline-split for Alaska.

Always required (Steps 3–7): the Mac login shell with the Apple API key +
notarization creds exported (a bare `./release.sh` fails preflight with
`APPLE_SIGNING_IDENTITY is not set` — run it as `zsh -lc ./release.sh`).

---

## Step 1 — Bundle glyphs + sprite  *(Path A only; FR-10)*

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

## Step 3 — Flip the assets flag  *(Path A only)*

In `frontend/src/lib/mapStyle.ts`, set `export const BUNDLED_MAP_ASSETS = true`.
This makes `fetchTunedBaseStyle` rewrite the persisted style's glyph/sprite URLs
to the bundled local assets from Step 1. (Leave it `false` for Path B.)

## Step 4 — Re-verify the build

```
cd frontend && npm run lint && npm run typecheck && npm run test && npm run build
cd ../backend && .venv/bin/python -m pytest tests/ -q
```

For Path A also confirm the QA-37 chunk invariant still holds (a fresh build's
`dist/index.html` has no `vendor-maplibre`/`pmtiles` in its modulepreload), and
spot-check that an offline map now renders labels.

## Step 5 — Commit + push main

The build-VM session leaves `main` committed and pushed up to the feature + the
Chronicler's record updates. On the Mac, commit any Path-A asset changes
(glyphs/sprite, catalog, the `BUNDLED_MAP_ASSETS` flip) and push `main`.

## Step 6 — Tag + Windows CI

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

Wait for that CI run to go green, then:

```
zsh -lc ./release.sh
```

`release.sh` builds + notarizes the universal macOS bundle, downloads + re-signs
the CI Windows installer, and writes one `latest.json` with both
`darwin-aarch64` and `windows-x86_64` entries (the in-app updater depends on it).
Do **not** use `gh release create` for the app release.

## Step 8 — Post-release

- Confirm the GitHub release has the macOS DMG + updater bundle + the Windows
  `-setup.exe` + `latest.json`.
- The website (already at v0.5.45) redeploys via GitHub Pages on the `main` push.
- If Path B: open a follow-up to bake regions + bundle glyphs (re-run Steps 1–3
  + a patch release) when ready.
