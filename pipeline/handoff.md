# Handoff — map-explorer-mobile-fullscreen (Improve lane)

## What We Accomplished
Shipped **v0.5.4** — Map Explorer mobile usability:
1. **Fullscreen toggle** (≤640px) next to Filters — expands the map to fill the viewport (header, tab dropdown, mode tabs hidden); CSS overlay (`position:fixed; inset:0; 100dvh; z-index:1200`), not the browser Fullscreen API.
2. **Ocean-tone map backdrop** — `.leaflet-container` tinted to `--sr-map-void` (#AAD3DF) so the area around the world reads as sea, not grey. Override uses doubled-class specificity to beat Leaflet's own CSS.

## Where We Are
**Improvement complete — all 6 stages done.** v0.5.4 is live on GitHub for both platforms; `latest.json` published; updater will detect it.

## Release facts
- Version `0.5.4` (patch) in `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`.
- Tag `v0.5.4`; release: https://github.com/dtgibson/snowraven/releases/tag/v0.5.4
- Assets verified: latest.json, macOS updater bundle + .sig, aarch64.dmg (notarized + stapled), x64-setup.exe + .sig. `latest.json` 0.5.4, both platforms.

## Feedback rounds (resolved live, confirmed by Dave)
1. Fullscreen button overlapped Filters → flex cluster (`.sr-map-fab-cluster`).
2. Backdrop still grey → CSS cascade-order issue; fixed with doubled-class specificity.

## Chronicle updates made
- `PRODUCT_CONTEXT.md` — new v0.5.4 entry.
- `DECISIONS.md` — CSS-overlay fullscreen decision + CI-runner maintenance note.
- `ROADMAP.md` — Shipped → v0.5.4 (43 versions).
- `CLAUDE.md` — two conventions: Leaflet CSS override needs raised specificity; mobile map fullscreen = CSS overlay + shared FAB cluster.
- Docs: `docs/HELP.md`, `README.md` Map Explorer sections.

## Outstanding
- **CI runner deprecation:** GitHub redirects `windows-latest` → `windows-2025-vs2026` by **2026-06-15**. Pin the runner image in `.github/workflows/windows-build.yml` before then. (Background task spun off.)
- Carried: verify Windows install + in-app updater end-to-end on a Windows machine.

## Resume Prompt
No active feature. Run `/weft` to start the next lane.

---
Project: snowraven. Feature: map-explorer-mobile-fullscreen — COMPLETE (v0.5.4 shipped). No active session.
