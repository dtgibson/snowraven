# Security Review — Map Explorer Mobile Fullscreen Toggle

**Date:** 2026-06-02
**Lane:** Improve
**Stack:** react-vite-tailwind frontend (no backend, no Tauri changes)
**Outcome:** PASSED (no findings)

## Summary
A presentation-only change: one boolean UI state (`mapFullscreen`), a
CSS overlay for the Map Explorer panel, a paired floating button, and a
Leaflet container background color. No new dependencies, no backend, no
network calls, no storage, no user-supplied data, no `dangerouslySetInnerHTML`.

## Checks Performed
| Check | Result |
|---|---|
| New dependencies | Pass — none (icons from existing lucide-react) |
| Backend / network surface | Pass — none touched |
| Secrets | Pass — none |
| Untrusted input / injection | Pass — no data flow; button toggles a boolean; no markup interpolation |
| Storage / persistence | Pass — `mapFullscreen` is in-memory only; nothing written |
| DOM side effects | Pass — only `document.body.style.overflow` toggled, restored on cleanup; guarded on active tab |
| z-index / overlay | Pass — fixed overlay at z-index 1200 follows the CLAUDE.md "overlays over a map" convention; covers app chrome intentionally and is dismissible |
| Theming / tokens | Pass — colors via `var(--sr-*)`; new `--sr-map-void` token in both themes |
| Accessibility | Pass — button is keyboard-focusable (`tabIndex={0}`), labelled, `aria-pressed` reflects state |
| Privacy | Pass — no data collected or transmitted; PRIVACY_POLICY.md unaffected |

## Convention Flags (for The Chronicler)
- Third-party Leaflet CSS loads after `globals.css` and ties on
  specificity — override its `.leaflet-container` rule with raised
  specificity (doubled class), not load-order assumptions. Worth a
  CLAUDE.md note.
- New mobile floating-control cluster (`.sr-map-fab-cluster`) and the
  `--sr-map-void` backdrop token.
