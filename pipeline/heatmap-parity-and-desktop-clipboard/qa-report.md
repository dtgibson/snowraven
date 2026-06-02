# QA Report — Heatmap Parity + Desktop Clipboard Auto-Copy

**Date:** 2026-06-02
**Lane:** Improve
**Result:** PASSED (one item deferred to live desktop verification by Dave)

## Automated checks
- TypeScript (`tsc --noEmit`): clean
- ESLint: **0 problems** (the two pre-existing BirdingStats warnings were cleaned up in this pass)
- Frontend build (`vite build`): clean
- Unit tests (vitest): **266 passing / 0 failing** (15 files)
- Rust (`cargo check`): clean — clipboard plugin compiles, capability schema validates

## Acceptance — Improvement 1 (heatmap parity)
| ID | Check | Result |
|---|---|---|
| H-1 | Species Detail heatmap shows a 1–10 intensity slider in Heatmap mode only | ✓ (live) — slider rendered under the Pins/Heatmap header, hidden in Pins mode |
| H-2 | Slider changes spread/intensity identically to My Sightings | ✓ — both call the same `lib/heat.ts` (`heatRadius/heatBlur/heatMax/heatWeight`) |
| H-3 | Default intensity is 5 | ✓ — `HEAT_INTENSITY_DEFAULT` |
| H-4 | Resets to 5 on species change | ✓ — `setHeatIntensity(HEAT_INTENSITY_DEFAULT)` in `selectSpecies()` |
| H-5 | My Sightings heatmap unchanged | ✓ — pure refactor; same formulas/divisor, now imported |
| H-6 | Tighter/Broader end labels + value readout present | ✓ |

## Acceptance — Improvement 2 (desktop auto-copy)
| ID | Check | Result |
|---|---|---|
| C-1 | Single clipboard seam; components don't branch on platform | ✓ — `lib/clipboard.ts copyText()`; `App.tsx` uses it in both copy sites |
| C-2 | Web/Pi path preserved (Clipboard API + execCommand fallback) | ✓ — unchanged logic, moved into the seam |
| C-3 | Desktop uses native Tauri clipboard (no user-gesture requirement) | ✓ (code + cargo check); **live confirm pending — Dave, packaged app** |
| C-4 | New Rust dep in `[dependencies]`, not the macOS-only table → Windows build stays green | ✓ — `tauri-plugin-clipboard-manager = "2"` cross-platform |
| C-5 | Capability grants only clipboard write (no read) | ✓ — `clipboard-manager:allow-write-text` only |
| C-6 | No permission button (none needed; confirmed at Stage 1 gate) | ✓ |

## Regression
- Full suite green (266). The heat change is a refactor + additive slider; the clipboard change preserves the web path and only adds a desktop branch. No shared logic altered elsewhere.

## Deferred / known
- **C-3 live desktop verification:** auto-copy on a successful lookup in the packaged macOS and Windows apps cannot be click-tested from the build host. Code path verified (seam + plugin + capability + `cargo check`). Dave to confirm on the desktop app — this dovetails with the still-open Windows install/updater end-to-end check.

## Opportunistic cleanup (this pass)
- Removed a dead `eslint-disable` (`BirdingStats.tsx` `circleIcon`).
- Documented the intentional `mlTaxonMap` dep omission in the nemesis effect with a scoped disable (prevents a refetch loop; no behavior change).
