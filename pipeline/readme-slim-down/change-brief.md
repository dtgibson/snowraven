# Change Brief — Slim Down the README

**Lane:** Improve
**Date:** 2026-06-03

## Goal
Cut the README (~274 lines) to a concise, user-facing overview aimed at
someone **deciding whether to download SnowRaven**. Informative, not
exhaustive — the comprehensive per-tab detail already lives in
`docs/HELP.md`. Per the request, the README should cover: an overview of
functionality, requirements to use the app, the privacy features, and
installation instructions.

## What to cut
- The per-tool **"How it works"** numbered steps (Weather, Species Detail,
  Media List, Breeding Codes, Life List Comparer) — these are HELP.md's job.
- Per-tool **toolbar options** and filter minutiae.
- The full **Development setup** walkthrough (backend/frontend/Tauri dev
  commands, tests) — reduce to a short "Build from source" pointer for
  contributors (kept brief; the README is user-facing, but a one-liner so
  the info isn't lost).
- Redundant Settings sub-details.

## Target structure (concise)
1. **Title + tagline** — one line on what SnowRaven is (desktop app *or*
   self-hosted server).
2. **What it does** — a short bulleted overview, one line per tool
   (Weather, Species Detail, Statistics, Map Explorer, Media List,
   Breeding Codes, Life List Comparer).
3. **Privacy** — local-first; collects nothing (no accounts, analytics,
   telemetry, or developer server); your data and keys stay on your
   device; API calls go directly to eBird/OpenWeather/Nominatim with your
   own keys. Link to PRIVACY_POLICY.md.
4. **Requirements** — free eBird + OpenWeather API keys (OpenWeather needs
   the One Call by Call subscription); optional eBird backup / ML export
   unlock the data tools; supported platforms.
5. **Installation** — Mac (universal DMG), Windows (installer + SmartScreen
   note), Raspberry Pi / Linux (one-line installer). One line on updating.
6. **Documentation** — link to HELP.md (+ Accessibility).
7. **Attribution** — eBird / OpenWeather / Macaulay Library, and the
   raincrow.app credit + the author's ethical-rate-limit note + coffee link
   (condensed; the author values keeping this).

## Acceptance
- README is substantially shorter (target ~90-110 lines) and reads as a
  "should I download this?" overview.
- All four requested areas present: functionality overview, requirements,
  privacy, installation.
- No duplication of HELP.md's step-by-step content; HELP.md linked as the
  source of detail.
- Installation facts stay accurate (universal Mac DMG, Windows installer,
  Pi one-liner) — consistent with v0.5.6.
- raincrow ethical note + attribution preserved (condensed).

## Out of scope
- HELP.md (already audited/current).
- Any code or feature change.
- PRIVACY_POLICY.md / ACCESSIBILITY.md content.

## Open call for the gate
- **Development section:** keep a short "Build from source" pointer, or
  drop it entirely? Recommendation: keep a 3-4 line pointer (clone + the
  two dev commands + a link), since the repo is open source and it's cheap.

## Feature Check
Documentation-only Improve work. No code, no capability change. **Stays in
the Improve lane.**
