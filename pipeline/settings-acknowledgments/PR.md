# PR — Settings Acknowledgments (v1.0.10)

## Settings Acknowledgments

### What this does

Adds an Acknowledgments section as the last section of the Settings tab, on
every platform. It is the tab's quietest register per the approved revision-2
design: a SectionHeader plus a card holding one quiet bordered "View
acknowledgments" button (no icon tile, no row title, no description). Pressing
it opens an inline grid-collapse disclosure inside the same card with exactly
two entries: The Cornell Lab of Ornithology and the Macaulay Library, and
Deven Simonson. The same button ("Hide acknowledgments" while open) closes it.
The section is static content: no network call, no API key, no persisted
state, no platform branch.

### How to test

1. Start the backend and frontend (see "Seeing Settings Acknowledgments
   locally" below), open the app, and go to the Settings tab.
2. Scroll to the bottom. The last section is "Acknowledgments": an uppercase
   section header and a card with a single bordered "View acknowledgments"
   button. On the web build it follows Tab Layout; in the desktop app it
   follows Troubleshooting.
3. Press the button. The panel expands downward inside the card (about 200ms,
   ease-out) with the two entries, each a bold name line and a muted "For ..."
   line. The button reads "Hide acknowledgments" and takes the app's
   accent-tinted active treatment.
4. Press it again. The panel collapses, focus stays on the button, and the
   label returns to "View acknowledgments". Repeat several times: identical
   every cycle.
5. Keyboard: Tab to the button; Enter and Space each toggle it. While
   collapsed, Tab from the button must skip the panel content entirely (it is
   inert).
6. Both themes, 320px width, and 200% in-app text scale: no horizontal
   scroll; the button grows to the ~44px touch posture on the phone tier.
7. With the network inspector open, opening and closing the section issues
   zero requests; `data/settings.json` (desktop) is unchanged afterwards.

### Notes for reviewer

- **FR-01 shape deviation is deliberate and user-directed** (recorded in
  `pipeline/settings-acknowledgments/decisions.md`): the PRD's icon-tile /
  title / description action-row shape was replaced by the Troubleshooting
  card shape at the user's request ("more subtle, a bit more basic"). FR-02's
  button label and accessible name are unchanged.
- The disclosure reuses the app's shipped grid-collapse mechanism
  (`grid-template-rows: 0fr/1fr` wrapper + `overflow: hidden` inner + `inert`
  on the clipped content while closed), the same shape as the escapee
  disclosure and the Map Explorer filter panel. React 19 emits `inert={false}`
  as an absent attribute; the test asserts the literal attribute in both
  states per the repo rule.
- No live region anywhere in the section: the entries are reference material
  and the state change is carried by `aria-expanded` (the repo's collapsing-
  content rule).
- New CSS lives in `globals.css` as `.sr-ack-*` (tokens only, both themes; no
  new tokens). The two phone-tier declarations sit inside the established
  ≤640 media tier, not a new standalone block: the offset-based tier-guard
  tests resolve "the phone tier" as the file's first multi-line 640px block,
  and a new block ahead of it fails fifteen of them (found and fixed during
  this build).
- Reduced motion is covered by the global `prefers-reduced-motion` block,
  which collapses all transitions toward zero without removing them.
- No entry-chunk change: no new imports, no assets, static JSX only
  (`entryChunk.test.ts` green).
- Docs trio updated in this same change: `docs/HELP.md` (new "Acknowledgments"
  subsection under Settings), `README.md` (Settings bullet), `website/`
  (closing-section sentence plus the version pill and footer version, which
  were stale at v1.0.7 and now read v1.0.10 per the lockstep rule).
- Version: 1.0.9 → 1.0.10 in BOTH `frontend/package.json` and
  `src-tauri/tauri.conf.json`; `CHANGELOG.md` entry under 1.0.10.
- Known limitation: jsdom cannot verify the geometric and visual claims
  (AA contrast, 320px/200% fit, touch-target size, the animation itself);
  those are QA-11/QA-06 browser passes for The Tester.

## Ride-along: README and website copy overhaul (user-directed)

At the user's direction mid-run, `README.md` and the `website/index.html`
prose were drastically shortened in this same change ("give helpful
information to let the user see if the app is useful for them"; the old
descriptions buried it). README went from 79 lines / 4,318 words to 59
lines / 891 words: a lead paragraph, one line per tool, privacy, keys and
files, install per platform, build-from-source, and attribution, with the
exhaustive per-feature narration cut (docs/HELP.md remains the full
documentation and is untouched). The website keeps its full structure,
screenshots, mocks, downloads, nav, and version pill; each feature
section's prose was cut to a short paragraph (about 1,800 words of section
prose removed). Every surviving claim was kept accurate to the shipped
1.0.10 app; the guarded claims survive verbatim or equivalent (the county
parity sentence stays conditioned on Count all forms being off with the
countable-species-rule reason on all three surfaces, per
`projectsPublishedClaims.test.ts`, which passes, and both files stay
em-dash-free). `docs/HELP.md`, `PRIVACY_POLICY.md`, `ACCESSIBILITY.md`,
and `website/privacy.html` were not shortened.

## Seeing Settings Acknowledgments locally

1. Open a terminal in your project folder.

2. Start the backend:

   ```
   cd backend && uvicorn main:app --reload --port 1620
   ```

3. Open a second terminal in the project folder and start the frontend:

   ```
   cd frontend && npm run dev
   ```

4. Open your browser and go to: http://localhost:5173

5. Click the "Settings" tab (rightmost in the tab strip), then scroll all the
   way to the bottom of the page.

6. You should see a small "Acknowledgments" heading with a card holding one
   "View acknowledgments" button. Click it: the card opens in place and shows
   two short thank-you entries, one for The Cornell Lab of Ornithology and
   the Macaulay Library, and one for Deven Simonson. Click the same button
   (now "Hide acknowledgments") to close it again. Nothing else on the
   Settings tab changes.
