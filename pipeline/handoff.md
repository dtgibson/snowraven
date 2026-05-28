# Handoff — desktop-persistence-and-readme (Complete)

**Fix:** Desktop tab-layout persistence + stale Keychain docs
**Status:** Complete — shipped to web/Pi and macOS desktop (v0.3.30), chronicled
**Date:** 2026-05-28

---

## What We Accomplished
Tab reorder/hide now persists in the desktop app across relaunches — it was being saved to `localStorage`, which Tauri's WKWebView wipes on relaunch, so it's now routed through the file-backed `storage` seam (the web/Pi synchronous, flash-free path is unchanged). Also corrected four doc references that wrongly claimed the desktop app stores API keys in the Keychain.

## What Has Been Saved
- pipeline/desktop-persistence-and-readme/ — bug-brief.md, qa-report.md, security-review.md
- frontend/src/lib/tabLayout.ts (parseLayout/serializeLayout, SerializedLayout), tabLayout.test.ts
- frontend/src/App.tsx (persistLayout via storage seam on desktop, hydrate-on-mount)
- README.md, docs/HELP.md (Keychain → app local data directory)
- frontend/package.json, src-tauri/tauri.conf.json (v0.3.30), CHANGELOG.md
- CLAUDE.md, PRODUCT_CONTEXT.md, DECISIONS.md (context update)

## Where We Are
Fix complete. All six stages approved. CI green; macOS desktop release v0.3.30 notarized and published with latest.json.

## Open item for the user
- Confirm the desktop fix end-to-end: update to v0.3.30, reorder/hide a tab, fully quit, relaunch — layout should persist. (Not verifiable in the build environment.)

## This fix is complete.

To start the next thing, run `/weft`.
