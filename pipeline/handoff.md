# Handoff — heatmap-parity-and-desktop-clipboard (Improve lane)

## What We Accomplished
Shipped **v0.5.3** — two parity improvements:
1. **Heatmap intensity on Species Detail** — same 1–10 slider as the Map Explorer, via a shared `frontend/src/lib/heat.ts` model. Default 5, resets on species change. My Sightings unchanged.
2. **Desktop clipboard auto-copy** — weather now auto-copies on lookup in the macOS/Windows apps (was silently failing: async clipboard write lost user-activation in WKWebView/WebView2). Fixed with a clipboard seam (`frontend/src/lib/clipboard.ts copyText()`) using the native Tauri clipboard plugin on desktop, `navigator.clipboard` on web.
Plus opportunistic cleanup: the two pre-existing BirdingStats lint warnings (lint now 0 problems).

## Where We Are
**Improvement complete — all 6 stages done.** v0.5.3 is live on GitHub for both platforms, `latest.json` published, updater will detect it.

## Release facts
- Version `0.5.3` in `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`. **Patch bump** (per standing rule).
- Tag `v0.5.3`; release: https://github.com/dtgibson/snowraven/releases/tag/v0.5.3
- Assets verified: latest.json, macOS updater bundle + .sig, aarch64.dmg (notarized + stapled), x64-setup.exe + .sig. `latest.json` version 0.5.3, both platforms.

## Chronicle updates made
- `PRODUCT_CONTEXT.md` — new "Heatmap Intensity Parity + Desktop Clipboard Auto-Copy (v0.5.3)" entry.
- `DECISIONS.md` — two decisions: clipboard seam (not navigator.clipboard); shared heat model.
- `ROADMAP.md` — Shipped updated to v0.5.3 (42 versions).
- `CLAUDE.md` — new clipboard seam convention under Desktop app seams.
- Docs: `docs/HELP.md` (Species Detail heatmap slider; Weather auto-copy across platforms).

## Outstanding (Dave, on desktop)
- **Confirm desktop auto-copy live in v0.5.3** — install/update, do a weather lookup, verify clipboard has the text with no click. (Code path verified; couldn't click-test from build host.)
- Still carried: verify Windows install + in-app updater end-to-end.

## Resume Prompt
No active feature. Run `/weft` to start the next lane.

---
Project: snowraven. Feature: heatmap-parity-and-desktop-clipboard — COMPLETE (v0.5.3 shipped). No active session.
