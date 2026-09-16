## Settings section order

### What this does

The Settings tab now opens on **API Keys**, with **Default Files** second and
**iCloud Sync** (Mac, iPhone and iPad) directly below it. Previously the tab
opened on Help & Documentation, then Appearance, then Sharing, and the two
sections the tab exists for sat fourth and fifth, below a scroll on most
windows. The app's own documentation already described this order as the
first-run path ("go to the Settings tab. That is where you enter your API keys
and upload your data files"), and `README.md` already listed Settings as "keys,
files, appearance..."; the screen was the one place that disagreed.

Everything below the promoted pair keeps its existing relative sequence:
Help & Documentation, Appearance, Sharing, Default Location, Tab Layout,
Troubleshooting (desktop only), Acknowledgments.

No section's content, copy, controls, styling, ids or accessible names change.
Nothing is added or removed. No behavior, persisted state, or network call
changes. Both the JSX move and the `docs/HELP.md` move are pure reorders,
verified line-for-line: a multiset comparison of the old and new files shows
zero content lines added or removed on either side, apart from two code
comments (below).

### How to test

1. `cd frontend && npm run dev`, open http://localhost:5173, go to **Settings**.
2. The first section is **API Keys**; the second is **Default Files**.
3. On a Mac/iPhone/iPad build, **iCloud Sync** sits directly below Default
   Files. On Windows, web and Pi there is no iCloud Sync section at all.
4. Scroll down: Help & Documentation, Appearance, Sharing, Default Location,
   Tab Layout, then (desktop only) Troubleshooting, then Acknowledgments last.
5. Check the seams: the gap between every pair of sections is unchanged from
   before, and the tab starts flush at the top with no extra space above the
   API Keys header.
6. Open the in-app Help overlay and go to **Settings** — its subsections read in
   the same order as the screen.

### Notes for reviewer

- **Two recorded decisions are touched and both are preserved, not reversed.**
  Acknowledgments still closes the tab on every platform (DECISIONS.md v1.0.10),
  with Troubleshooting directly above it. iCloud Sync still sits directly below
  Default Files, so `docs/HELP.md`'s published sentence "an iCloud Sync section
  sits directly below Default Files" stays true. Nothing fixed Help &
  Documentation at the top: the v1.0.10 decision governs its visual *register*
  (the quiet form), not its position.
- **Both existing order guards pass unmodified** — `Settings.icloud.test.tsx`
  (Default Files < iCloud Sync < Default Location) and
  `SettingsAcknowledgments.test.tsx` (Acknowledgments is the panel's last
  element child, after Troubleshooting). That was the evidence the reorder was
  right; if either had needed editing, the reorder would have been wrong.
- **One new guard, `frontend/src/components/settingsSectionOrder.test.tsx`.**
  Neither existing guard states the whole sequence, and "directly below Default
  Files" is strictly stronger than the `<` chain, which stays satisfied with
  sections inserted between. The new file pins the full header sequence on all
  three platform shapes (web/Pi, Windows desktop, Mac/iOS). Mutation-checked:
  run against the pre-reorder `Settings.tsx`, all four of its tests go red.
- **Spacing is order-neutral by construction, not by measurement.** Every
  section block is a self-contained unit (card plus any trailing explanatory
  paragraph) ending in a 24px bottom margin, and the panel has no first-child
  styling, so no seam gains or loses space. jsdom has no layout engine, so that
  claim is not asserted in a test; it is argued in a comment at the head of the
  reordered JSX and is worth one look in the live app.
- **Two code comments changed, and they are the only non-move lines.** A new
  comment at the head of the panel records the order and the spacing argument.
  The iCloud Sync comment's old closing line, "No section below it moves", was a
  note about the build that introduced that section and no longer describes what
  the placement rests on; it now names the published sentence and the guard that
  hold iCloud Sync to Default Files.
- **Deliberately not changed:** `README.md` and `website/index.html`. Neither
  makes a claim about section order — README's Settings line is a feature list
  that already leads with keys — so there is nothing there to repair. Swept for
  order-dependent prose ("above", "below", "first/last section") across
  `docs/HELP.md`, `README.md`, `website/index.html`, `PRIVACY_POLICY.md` and
  `ACCESSIBILITY.md`; every such sentence is still true.
- **No version bump in this commit.** This build is one of five in a bundled
  Spool release taking a single version bump at the end, so `frontend/package.json`,
  `src-tauri/tauri.conf.json`, `CHANGELOG.md` and `website/index.html` are
  untouched here and the four-file parity guard in
  `icloudKeysPublishedClaims.test.ts` stays green at the current version. The
  changelog line for the bundle's release step is below.

### Changelog line

- Settings now opens on API Keys, with Default Files (and iCloud Sync) directly below it, so the two sections you need first are the first ones you see.
