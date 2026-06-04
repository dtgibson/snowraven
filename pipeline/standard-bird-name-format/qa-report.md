# QA Report — Standardized Bird-Name Format

**Date:** 2026-06-04 · **Lane:** New Feature · **Result:** PASSED

## Automated checks
- TypeScript (`tsc --noEmit`): clean
- ESLint: **0 problems**
- Build (`vite build`): clean
- Tests (vitest): **272 passing** (266 prior + 6 new `BirdName` tests; new
  jsdom per-file env via `// @vitest-environment jsdom`, isolated so the
  node-env suite is unaffected)

## BirdName unit tests (BirdName.test.tsx)
- link rendered + onOpenSpecies called when hasEntry ✓
- plain text (no button) when !hasEntry ✓
- plain text when onOpenSpecies missing ✓
- eBird + BoW favicon links present with taxonCode ✓
- no favicons without taxonCode ✓
- scientific name only when showSci ✓

## Acceptance (per PRD)
| ID | Check | Result |
|---|---|---|
| Component | `<BirdName>`: link-when-hasEntry, favicons always, sci opt-in | ✓ unit + live |
| Nav | click bird → Species Detail selects it (single-use, pending-safe, subspecies-aware, scroll-into-view) | ✓ live |
| S1 | Stats Most Photographed/Audio/Video: name→Species Detail, count→ML | ✓ live |
| S2 | Milestones: name→Species Detail; date keeps checklist link | ✓ live |
| S3 | Nemesis/targets: plain name + favicons (not in backbone) | ✓ live |
| S4 | Single-Checklist & One-and-Done: name→Species Detail; checklist link → ↗ icon | ✓ live |
| S5 | Biggest counts: name→Species Detail; count link kept | ✓ live |
| S6 | First species: name→Species Detail (lg size) | ✓ live |
| M1 | Map target popups: name→Species Detail + favicons | ✓ live |
| M2 | Map nearest-targets: name→Species Detail; pan → ◎ locate icon | ✓ live |
| M3 | Filter dropdown / manual checkboxes unchanged (form controls) | ✓ |
| A1 | Media List / Breeding Codes / List Comparer / Reported With → BirdName | ✓ live |
| U1 | Species Detail header unchanged | ✓ |
| D1 | No-entry birds: plain name + favicons (List Comparer other-list-only, nemesis, map targets when unseen) | ✓ live |

## Feedback resolved live (Dave)
- Single-checklist / one-and-done pills had inconsistent favicons → root cause:
  Stats only resolved taxon codes for ML-export species. Fixed by resolving
  codes for ALL observed species on load + a normalized lookup. Now consistent.

## Regression
- Full suite green (272). Already-compliant tabs refactored onto BirdName with
  no behavior loss (favicons + sci preserved; names additionally linkable).
- ML catalog links, checklist links, recency dots, map pins all intact.

## Known limitations / notes
- Favicons depend on taxon-code resolution (batched, cached); they may pop in a
  beat after a tab loads. Graceful no-op if a code can't be resolved.
- Subspecies names resolve to the parent Species Detail entry via
  normalizeSpeciesName; if a clicked name has no entry, the consume effect
  no-ops (can't happen for hasEntry-gated links).
- On-map pill labels (the divIcon chips) keep plain text — they're map markers,
  not name displays; favicons live in the popup.
