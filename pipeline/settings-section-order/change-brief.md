# Change Brief — Settings Section Order

## What is changing

API Keys and Default Files become the first two sections of the Settings tab. Today the tab opens on Help & Documentation, then Appearance, then Sharing, and the two sections the tab actually exists for sit fourth and fifth, below a scroll on most windows.

New order: **API Keys, Default Files, iCloud Sync** (Mac/iPhone/iPad only), Help & Documentation, Appearance, Sharing, Default Location, Tab Layout, Troubleshooting (desktop only), Acknowledgments. Everything below the promoted pair keeps its existing relative sequence, so only the two named sections move and nothing else needs re-justifying.

iCloud Sync travels with Default Files because `docs/HELP.md` publishes "an iCloud Sync section sits directly below Default Files" and `Settings.icloud.test.tsx` asserts it.

Files: `frontend/src/components/Settings.tsx` (reorder the JSX blocks in the top-level return of `Settings`, lines ~2171-2490) and `docs/HELP.md` (reorder the `###` subsections under `## Settings` to match the screen). Plus the standard release-parity set, which this repo has shipped broken before: `frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, and `website/index.html` (version pill text, its `aria-label`, and `footer-version`) — a patch bump from 1.0.31.

## Why now

The user asked for it, and the app's own documentation already describes this order as the first-run path: `docs/HELP.md` Getting Started says "go to the Settings tab. That is where you enter your API keys and upload your data files." The screen puts both of those below three sections nobody needs on a first run. `README.md` already lists Settings as "keys, files, appearance..." — keys first. The screen is the one place that disagrees.

## User-facing impact

The Settings tab opens on API Keys instead of Help & Documentation. No section's content, copy, controls, styling, ids, or accessible names change; nothing is added or removed; no behavior, persisted state, or network call changes. Everything is still one scroll away in the same visual register.

Verified spacing-neutral: every section block is a self-contained unit (card plus any trailing explanatory paragraph) ending in a 24px bottom margin, and the panel has no first-child styling, so no seam gains or loses space in the new order. The Engineer should have nothing to adjust; if a seam does shift, that is a finding, not a licence to restyle.

## Design pass

**Not needed — no visual change.** Every section already uses the same shipped register (`SectionHeader` over a bordered card), and this moves those blocks without touching one pixel of their design. The only judgment call was what order the rest land in, and it is settled above rather than left open. Nothing new is being designed, so The Designer has no work here.

## Decisions touched

Two recorded decisions are touched and both are **preserved, not reversed**:

- **Acknowledgments closes the Settings tab on every platform** (DECISIONS.md, v1.0.10; guarded by `SettingsAcknowledgments.test.tsx`, which asserts it is the panel's last element child and follows Troubleshooting). It stays last; Troubleshooting stays directly above it.
- **iCloud Sync sits directly below Default Files** (in-code comment at `Settings.tsx:2337`, published in `docs/HELP.md`, guarded by `Settings.icloud.test.tsx:143`, which asserts Default Files < iCloud Sync < Default Location). Preserved by moving iCloud Sync with Default Files; Default Location stays put, so the guard's full chain still holds.

Nothing fixes Help & Documentation at the top: the v1.0.10 decision governs its visual *register* (the quiet form), not its position, and demoting it to fourth leaves that untouched.

## What done looks like

The Settings tab renders API Keys first and Default Files second on every platform, with iCloud Sync directly below Default Files on Mac/iPhone/iPad, and Acknowledgments still last. The existing order guards in `Settings.icloud.test.tsx` and `SettingsAcknowledgments.test.tsx` pass unmodified — if either needs editing, the reorder is wrong. `docs/HELP.md`'s Settings subsections read in the same order as the screen, and its "directly below Default Files" sentence is still true. `npm run build` is green and the four-file version parity guard in `icloudKeysPublishedClaims.test.ts` passes.
