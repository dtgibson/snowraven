# Handoff — 0.5.23 (named-bird-tracker) — COMPLETE + CHRONICLED on main; Mac tag+release pending

## What We Accomplished

A new **Named Birds** feature: track individual birds the user names in their
eBird species comments with `[name:…]` tags (e.g. `[name:Winky]`,
`[name:one-leg-pete]`).

- **Named Birds tab** — each named individual with species, first/last seen, and
  sighting count; sortable by name / species / last-seen; expands to its
  checklists (date, eBird checklist link, the species comment).
- **Species Detail → Named Individuals** — the same, scoped to the viewed species.

Keyed by name + species (same name on two species = two birds), case-insensitive
name match, subspecies fold to the parent, one sighting per checklist. Computed
offline from the eBird backup.

650 frontend tests pass; typecheck, lint, build green. Adversarial review
(11 agents) found and we fixed: a **HIGH ReDoS** in the tag regex (now
length-bounded/linear, with a regression guard test), a checklist double-count
(deduped by submission id), locale-sort consistency, a dead field, and a11y
polish. Security/privacy otherwise clean (no new network/telemetry; escaped
throughout; fixed-scheme checklist links).

## What Has Been Saved (committed + pushed to `main`)

- New: `frontend/src/lib/namedBirds.ts` (+ test), `frontend/src/components/NamedBirdsTable.tsx` (+ test), `frontend/src/components/NamedBirds.tsx`.
- Wiring: `frontend/src/lib/tabLayout.ts` (`named-birds`; `parseLayout` auto-migrates saved layouts), `frontend/src/lib/tabLayout.test.ts`, `frontend/src/App.tsx` (import, TAB_ICONS, DEFERRED_TABS, tabpanel), `frontend/src/components/SpeciesDetail.tsx` (Named Individuals section).
- Demo: `website/tools/gen-demo-data.mjs` seeds a few synthetic named birds.
- Docs/version: `docs/HELP.md`, `README.md`, `CHANGELOG.md` (0.5.23), `frontend/package.json` + `src-tauri/tauri.conf.json` → 0.5.23.
- Chronicler: `PRODUCT_CONTEXT.md` + `DECISIONS.md` (2026-06-09 entry).

## Where We Are

Feature lane **complete and chronicled** on `main`. Weft session closed
(`activeFeature: null`).

## Deploy (on the Mac)

`main` carries **three** undeployed versions on top of the live 0.5.20:
**0.5.21** (media-comments per-asset), **0.5.22** (media-card cleanup), **0.5.23**
(Named Birds).

1. `git pull` (main is up to date).
2. Confirm version **0.5.23** in `frontend/package.json` + `src-tauri/tauri.conf.json`.
3. Push the **`v0.5.23`** tag (ships 0.5.21–0.5.23 together — `release.sh` builds
   at the package.json version, 0.5.23), wait for Windows CI, then run
   **`./release.sh`**. Web/Pi update on a plain `git pull`.
4. **Catch up `website/`** (it lags): add a Named Birds mention, refresh the
   version pill/footer, fold in the 0.5.18+ media features, and **regenerate the
   demo screenshots** (the demo generator now seeds named birds + the media-stats
   columns). The site auto-deploys on push to `main` touching `website/`.

Project memory is already updated on `main`; no further Chronicler step needed for
the code.
