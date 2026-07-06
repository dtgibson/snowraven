# QA Report — Named Birds Media (v0.5.66)

**Date:** 2026-07-05 · **Runner:** production build + vitest + adversarial review · **Result:** PASSED

## Independent ground-truth gates (re-run by the Orchestrator, not trusted from the build agent)
- `npm run build` (`tsc -b && vite build`) — **passes** (✓ built ~0.66s). The real type-check gate is green.
- `npm run lint` (eslint) — exit 0, no problems.
- `npx vitest run` — **121 files, 1503 tests, all passing** (+27 for the feature, then +7 for the fix coverage; up from the pre-feature 1469).
- Entry-chunk guard: `entryChunk.test.ts` green and `vendor-maplibre` is ABSENT from `dist/index.html` modulepreload — the new media component did not drag maplibre onto first paint.

## Adversarial correctness review (6 lenses, every finding independently re-verified)
- **Correctness / matcher / wiring — CLEAN.** `computeNamedBirdMedia` matches `[name:…]` over `caption`+`mediaNotes` only (excludes `observationDetails`), keys via the shared `namedBirdKey` (a dedicated key-parity guard test asserts equality with `computeNamedBirds`), dedupes by `catalogId`, sorts newest-first; the `NamedBirds→Table→Row` threading and `showMap` gate (Species Detail stays media-less) verified; empty / ML-absent gating verified.
- **Conventions — CLEAN.** `var(--sr-*)` tokens only, no impure `Date.now()`/`new Date()` in render/memo, no static maplibre import, shared `ChecklistLink`/`OutboundLink`/`BirdName`.
- **Findings found + fixed (5, all re-verified clean):**
  1. (medium) 8s give-up timeout tore down the iframe and latched a permanent "unavailable" fallback for a slow-but-working embed → **fixed**: non-destructive `MediaFrame` (iframe stays mounted, fallback is an overlay, late `onLoad` clears the latch, 20s deadline).
  2. (medium) `failed`/`timedOut` latched with no recovery on offline→online → **fixed**: online-keyed remount re-attempts on reconnection.
  3. (medium) "Show more" `aria-label` diverged from visible text (WCAG 2.5.3) → **fixed**: accessible name is now a superstring of the visible label.
  4. (low) final "Show more" reveal dropped keyboard focus to `<body>` (WCAG 2.4.3) → **fixed**: focus handoff to the first newly-revealed tile.
  5. (low) privacy-policy effective date not revised for the disclosure change → **fixed**: advanced to July 5, 2026.
- **Fix re-verification (2 focused lenses) — 0 findings.** The offline redesign resolves findings 1+2 with no new race/leak, and the a11y fixes hold with no regression.

## Acceptance
The PRD's acceptance criteria are met and verified: asset-comment matching (caption+mediaNotes, `observationDetails` excluded, key-parity), photo/audio/video embeds below the map with per-item date + checklist link, on-demand/bounded loading (6 + "Show more"), graceful offline/failed-load degradation (placeholder keeps date + checklist + link-out, never a broken frame), quiet empty state, and the privacy/docs/site updates. Fully offline for matching; only the embed player needs network.
