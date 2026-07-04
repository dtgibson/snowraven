## What We Accomplished

Shipped **v0.5.61** — a Calendar tuneup (three changes) plus one app-wide fix:

1. **Searchable species picker** — the Calendar's species filter is now a type-to-find
   combobox. It was extracted from the Species Detail picker into one shared component
   used by both tabs, so a long life list is finally searchable (with an "All species"
   row to clear it).
2. **Phones show only the Large calendar view** — the Large/Compact toggle hides at phone
   widths and Large always renders (the two layouts converge to one column on a phone
   anyway).
3. **Every Large-view day cell now shows its calendar date** — the day-of-month in the
   corner, alongside the count, including blank days. This resolved the reported
   "all-years shows fewer species": the All-Years view aligns its weekday columns to a
   fixed reference year, so a cell's *position* maps to a different date than in a single
   year — you were reading the position, not the day. The counts themselves were verified
   correct (cross-year union/sum, now regression-locked); this is a labeling fix.
4. **Fixed app-wide:** the iOS no-zoom guard for small inputs was silently defeated by
   inline font sizes; it now binds on every input that carries it (fixing auto-zoom on
   the weather search, checklist filters, and others).

Frontend-only, offline, zero new network calls, providers, or data; privacy unchanged.

## What Has Been Saved

- **Feature commit `ac098af`, tag `v0.5.61`.** Binaries **LIVE** as a GitHub release
  marked *Latest* (github.com/dtgibson/snowraven/releases/tag/v0.5.61): notarized +
  stapled universal macOS DMG, updater bundle + signature, signed Windows installer +
  signature, `latest.json` for all three platforms. Windows CI run `28708161674`
  (headSha == tag); released headless on Hephaestus.
- **Records commit `adf6371`** (`chore(pipeline): v0.5.61 closeout — records`):
  `DECISIONS.md` (shared combobox; phone-forces-Large mechanism; the combined-count audit
  outcome — counts correct, the real issue was grid re-alignment, fixed by dates-in-cells;
  the `.sr-input-16` fix), `PRODUCT_CONTEXT.md`, `ROADMAP.md` (Shipped 94→95), `CLAUDE.md`
  (two new conventions), and the `pipeline/calendar-tuneup/` artifacts.
- Code: new `components/SpeciesCombobox.tsx` + `lib/useIsPhone.ts`; edits to
  `SpeciesDetail.tsx`, `Calendar.tsx`, `lib/calendar.ts`, `globals.css`, and their tests.
  Version 0.5.61 in both manifests; `CHANGELOG.md`, `docs/HELP.md`, `README.md`, `website/`
  updated. `PRIVACY_POLICY.md` correctly unchanged.
- Verification: full suite **1406+ frontend + 178 backend** tests green, typecheck / lint /
  build clean. Security review: **PASSED, 0 findings** (the shared-combobox extraction
  preserved every guard).

## Where We Are

Improvement complete — all six Improve-lane stages done and shipped. Pipeline is idle.

Note: the combined-years "bug" turned out to be correct counts read against a re-aligned
grid; the date-in-cell change is the durable fix, and the union invariant is now
regression-tested.

## Resume Prompt

To start the next thing, run `/weft` in a Claude Code session in this project. It reads
saved state and picks up fresh.
