# Change Brief — quality-accessibility-sweep (Improve lane)

A batched maintainability + accessibility sweep covering five backlog items (from
`pipeline/comprehensive-review/audit.md`). Done one at a time, each committed into the
**0.5.18** batch (undeployed; ships from the Mac with the comparer-weather-badges feature
and the weather-info-copy change). Re-verify current state before each item — some may be
partly addressed by the 0.5.16/0.5.17 work.

## Items (order = low → high risk)

1. **Unify date formats** (audit #8) — consolidate the ~5 divergent `fmtDate`
   reimplementations into one canonical `lib/formatDate.ts`. **User decision:** make it a
   user preference — **default month-first** (`Jun 8, 2026`), with a **Settings control** to
   choose month-first / day-first (`8 Jun 2026`) / ISO (`2026-06-08`). All date displays read
   the canonical helper and react to the setting. *(The Settings picker is a small
   user-requested feature addition within the sweep.)*

2. **Grow component-test coverage** (audit #11) — add jsdom component tests for the
   under-tested components (4 of 26 have tests today). Additive, low-risk.

3. **Accessibility** (audit #1/#2/#3 + #11) — fix failing-contrast tokens + dark-mode map
   popups; add `aria-label`s to `SpeciesLinks` favicons; make sortable table headers
   keyboard-operable; add a global `prefers-reduced-motion`; give charts a text alternative;
   and make `ACCESSIBILITY.md` honest. **Plus simplification/clarity:** fix the life-list /
   Nemesis naming confusion + wrong Settings sublabels, remove the perma-"NEW" badge.
   **Plus onboarding (user-requested):** a persistent Help affordance, inline key-entry
   guidance, a first-run welcome, and a Statistics error recovery action.

4. **Keyboard-operable map markers** (audit #11) — canvas/GL markers can't take DOM focus;
   plan is a keyboard-navigable list alternative (assess + propose before building).

5. **Split the oversized components** (audit #9) — BirdingStats (2,036), MapExplorer (2,003),
   SpeciesDetail (1,806): pull `useMemo` derivations into `lib/`, each section into its own
   file. **Behavior-preserving**, split in place (no shared-primitive refactor this round).

## Verification per item
`npm run build` (the real type gate — `tsc -b`; the `typecheck` script skips app files via
project references), `npm run lint`, `npm run test` — all green before committing each item.

## Out of scope (this round)
The shared-UI-primitives extraction (audit #8 beyond dates), Web-Worker CSV parsing, the
lazy-load (already done in 0.5.16), and Map Explorer UX depth (#10).
