# Security Review — Heatmap Parity + Desktop Clipboard Auto-Copy

**Date:** 2026-06-02
**Lane:** Improve
**Stack:** react-vite-tailwind frontend + Tauri v2 (Rust)
**Outcome:** PASSED (no Critical/High; one informational note)

## Summary
Two changes. The heatmap parity work is a pure frontend refactor plus
an additive slider — no new surface, no data flow change. The clipboard
work adds one official Tauri plugin to enable a *write* the app already
performs on web. Net new attack surface is minimal and tightly scoped.

## Findings

### F-1 — New dependency: `tauri-plugin-clipboard-manager` (Informational)
**Where:** `src-tauri/Cargo.toml`, `frontend/package.json`,
`src-tauri/src/lib.rs`, `capabilities/default.json`
**Assessment:** Official first-party Tauri plugin (same `@tauri-apps`
org as the fs/http/updater/geolocation plugins already in use). The
capability grants **only** `clipboard-manager:allow-write-text` — no
read, no image, no clear. The app can write text to the clipboard; it
cannot read the user's clipboard. Clipboard writes are local to the
device; nothing is transmitted, so no privacy-policy impact.
**Status:** Accepted (scoped to write-text; first-party; local-only).

## Checks Performed
| Check | Result |
|---|---|
| No secrets in source | Pass |
| New dependency provenance | Pass — official `@tauri-apps` / `tauri-apps` plugin |
| Capability least-privilege | Pass — write-text only; no clipboard read granted |
| Cross-platform dep scoping | Pass — in `[dependencies]`, not the macOS-only table (Windows build safe) |
| Data collection / privacy | Pass — clipboard write is local; nothing transmitted; PRIVACY_POLICY.md unaffected |
| Injection / untrusted data | Pass — copied text is the backend-formatted weather string; no markup, no eval |
| Clipboard content sensitivity | Pass — content is public weather text the user explicitly looked up |
| Heatmap change | Pass — refactor to `lib/heat.ts` + numeric slider (1–10); no I/O, no user-supplied strings |
| Lint/build hygiene | Pass — lint clean; the documented `exhaustive-deps` disable prevents a refetch loop, not a security issue |

## Convention Flags
- Extends the desktop-seam convention (transport/storage/platform) with
  a **clipboard seam** (`lib/clipboard.ts`). Worth noting in CLAUDE.md so
  future clipboard use goes through the seam rather than calling
  `navigator.clipboard` or the plugin directly. (To be recorded by The
  Chronicler.)
