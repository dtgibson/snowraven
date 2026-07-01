## What We Accomplished

Shipped a Map Explorer **Point Size** control (Normal / Small / Off) as **v0.5.53**
— it lets you shrink or hide the sighting points on the My Sightings map so a
shaded breeding-block or county choropleth reads through underneath. It extends
the existing v0.5.47 shade auto-dim (it composes with it rather than replacing
it); the heatmap is unchanged. This was also the **first release driven fully
end-to-end from Hephaestus by the agent, headless** — the one trick that made it
work was setting `CI=true` so Tauri builds the DMG without a GUI session.

## What Has Been Saved

- **Release commit `284f9b6`** on `main`, tagged **`v0.5.53`** (both pushed).
  Binaries **LIVE** as a GitHub release marked *Latest*: notarized + stapled
  universal macOS DMG, macOS updater bundle + signature, signed Windows installer +
  signature, and `latest.json` (`darwin-aarch64` / `darwin-x86_64` / `windows-x86_64`).
  Windows CI run `28535391336` (headSha == tag) supplied the installer.
  - Code: `frontend/src/lib/mapExplorerTypes.ts`, `lib/mapPins.ts` (+`.test`),
    `components/map/SightingMarkers.tsx` (+`.test`), `components/MapExplorer.tsx`.
  - Version: `frontend/package.json` + `src-tauri/tauri.conf.json` → 0.5.53;
    `CHANGELOG.md`, `docs/HELP.md`, `README.md`, `website/index.html`.
  - Pipeline artifacts: `pipeline/sighting-point-visibility/`
    (change-brief, qa-report, security-report).
- **Post-release records commit:** `DECISIONS.md` (Point Size as a v0.5.47
  extension; the `CI=true` headless-release fix), `CLAUDE.md` (release `CI=true`
  note + the mapPins point-sizing convention), `ROADMAP.md` (shipped 88; the
  no-`beforeDevCommand` dev papercut), `PRODUCT_CONTEXT.md` (inline mention).
- Full frontend suite **1183 tests green**; lint / typecheck / build green;
  security review clean; no `PRIVACY_POLICY.md` change.

## Where We Are

Improvement complete — all six Improve-lane stages done and shipped (source +
binaries). Pipeline is idle.

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project.
It reads saved state and picks up fresh.
