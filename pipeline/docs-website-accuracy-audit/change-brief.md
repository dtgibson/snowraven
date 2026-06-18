# Change Brief — docs-website-accuracy-audit

## What is changing
Correcting documentation / website drift surfaced by a verified accuracy audit against the
current app (0.5.44). ~13 confirmed fixes across five files, plus one small accessibility code
touch. (Each finding was adversarially re-checked against the real files + code; false
positives were dropped.)

**PRIVACY_POLICY.md**
- **(high)** Add a "Software Updates" subsection: SnowRaven checks for new versions via
  `api.github.com`, and on desktop downloads updates from GitHub release assets, so GitHub
  receives the user's IP. No key/account, no added tracking, no copy kept. Link GitHub's
  privacy statement.
- **(medium)** Nominatim bullet: add the reverse case (coordinates → county), not just
  name → coordinates.
- **(low)** eBird bullet: add taxonomy and region-info lookups to the listed uses.
- FYI (not a fix unless you say so): the contact email is `developer@dtgibson.com` — confirm intended.

**README.md**
- **(medium)** Statistics bullet: add Frivolous Lists. Map Explorer bullet: add the drop-a-pin
  (right-click / long-press, draggable) search-center gesture (v0.5.43).
- **(low)** Weather "about a week" → "about eight days" (match HELP/in-app). Add Settings /
  appearance (theme, text size to 200%, date format, reorderable+hideable tabs). Note desktop
  installs updates in place vs self-hosted reports + `./update.sh`; mention in-app Help (footer)
  and the first-run welcome.

**website/index.html**
- **(medium)** Features heading "Seven tools, one quiet workspace" → "Nine tools…" (there are
  nine feature articles); prefer dropping the number so it can't drift.
- **(low)** Broaden the eBird-key blurb (also powers maps, taxonomy, checklists, hotspots, tide,
  region — not just "weather lookups and nearby-sighting features").

**docs/HELP.md**
- **(low)** Breeding Codes: reword "a matrix across all 23 eBird breeding codes" → a column per
  code you've actually recorded (out of the 23 the app tracks).

**ACCESSIBILITY.md**
- **(low)** Marker-list enumeration (line 15): add the "Nearby lifers in view" list (v0.5.35).
- **(low)** Known Exceptions: note the search center is fully keyboard-settable (place search /
  use-my-location / coordinates), so the v0.5.43 pin-drop is a pointer-only enhancement, not the
  only path.

**frontend/src/components/map/MapControls.tsx (code)**
- Give the `CenterPin` `<Marker>` an `aria-label` (e.g. "Search-center pin — drag to move") so
  the placed pin has an accessible name — which makes the ACCESSIBILITY.md statement true.

## Why now
A requested comprehensive accuracy review found the docs lag the shipped app in small ways, plus
one genuine privacy-disclosure gap: the in-app updater's connection to GitHub was undisclosed.

## User-facing impact
Docs, website, and the published statements become accurate to 0.5.44. The only app behavior
change is that the center pin gains an accessible name (screen readers announce it); nothing
visual changes.

## Decisions touched
None reversed. The privacy / eBird / Nominatim entries are additive disclosures; the rest are
accuracy corrections.

## What done looks like
- Every listed fix applied; the five docs + website read accurately against 0.5.44.
- `CenterPin` has an `aria-label`; the CI mirror (lint + typecheck + vitest + build) is green —
  `docs/HELP.md` (bundled via `?raw`) and the aria-label both ship in the app bundle.
- App-bundle-affecting changes (HELP.md content + the aria-label) get a patch version bump +
  CHANGELOG entry per CLAUDE.md convention; the website version pill stays in sync with the
  released version. Release-now vs batch-with-next is decided at the Deployer stage.
- Website redeploys via GitHub Pages on the `website/` change.
