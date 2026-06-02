# Handoff — heatmap-parity-and-desktop-clipboard (Improve lane)

## What We're Doing
Two parity improvements:
1. Port the v0.5.1 heatmap intensity slider to the Species Detail map.
2. Make weather auto-copy to the clipboard work in the macOS/Windows desktop apps (web already works).

## Where We Are
Stage 2 (The Engineer) complete. Next: Stage 3 — The Tester.

## What Was Built (Stage 2)
**Improvement 1 — heatmap parity**
- NEW `frontend/src/lib/heat.ts` — shared `heatRadius/heatBlur/heatMax/heatWeight` + `HEAT_INTENSITY_DEFAULT` (single source of truth).
- `MapExplorer.tsx` — removed local copies, imports from lib, uses `heatWeight` (no behavior change).
- `SpeciesDetail.tsx` — `HeatmapLayer` now takes `intensity`; `heatPoints` weighted via `heatWeight`; `heatIntensity` state (default 5, resets on species change); 1–10 slider in the map section header, Heatmap mode only.

**Improvement 2 — desktop clipboard auto-copy**
- NEW `frontend/src/lib/clipboard.ts` — `copyText()` seam: native Tauri clipboard plugin on desktop, `navigator.clipboard` + execCommand fallback on web.
- `App.tsx` — `handleLookup` auto-copy and `handleCopy` both route through `copyText`.
- Tauri wiring: `@tauri-apps/plugin-clipboard-manager` (JS, package.json), `tauri-plugin-clipboard-manager = "2"` in Cargo `[dependencies]` (cross-platform, not the macOS-only table), `.plugin(tauri_plugin_clipboard_manager::init())` in `lib.rs`, `"clipboard-manager:allow-write-text"` in `capabilities/default.json`.
- No permission button — the plugin grants write at build time; no OS runtime prompt. (Confirmed with user at Stage 1 gate.)

## Verification status
- typecheck ✓, lint ✓ (only pre-existing BirdingStats warnings), build ✓, 266 tests ✓, `cargo check` ✓ (clipboard plugin + capability validate).
- Heatmap slider verifiable live (dev server). **Desktop auto-copy needs the packaged macOS/Windows app — Dave to confirm** (web path unchanged).

## Resume Prompt
Run `/weft` to resume at Stage 3 (The Tester).

---
Project: snowraven. Feature: heatmap-parity-and-desktop-clipboard (Improve). Last completed stage: 2 (Engineer). Next: 3 (Tester).
