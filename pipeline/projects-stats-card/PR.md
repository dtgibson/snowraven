# PR — Projects Stats Card (v1.0.8)

## Projects stats card refinement

### What this does

Densifies the Statistics tab's Projects card and adds a decorative
participation chart, per the approved design refinement
(`pipeline/projects-stats-card/design-refinement.md`). Rendering only:
the data layer, sweep, store, and Check again chokepoint are untouched,
and the chart derives at render time from `deriveProjectsView` output
(nothing derived is persisted, per the v1.0.5 decision).

Each project row is now one line at desktop: `[dot + name] [count]`
with the share clause and date span right-aligned on the same line
(wrapping, never clipping, at long names or 200% text scale). With two
or more projects, the projects block takes the shared
`.sr-grid-chart-aside` layout and a recharts vertical bar chart fills
the aside: first 8 rows, full-length tracks, no axes/tooltip/legend,
wrapped `aria-hidden` + `inert` so the text rows remain the sole
accessible carrier of every figure. Bar fills and row dots follow a
fixed categorical token order (accent, photo-blue, audio-amber,
video-violet, then slate) chosen by measurement for deuteranopia
separation in both themes. Portal rows take the same one-line
tightening but stay chartless and dotless while any project renders;
when no projects exist and portals has 2+ rows, the portals block owns
the chart instead (captioned "Checklists per portal", never "project").

Motion: one 140ms house-ease entrance on the chart wrapper, keyed by
charted-row count so it replays exactly when a new bar appears
mid-sweep and never per progress tick; recharts' internal (JS-driven,
reduced-motion-blind) bar animation is disabled, so bar widths snap to
each throttled emission. The app's global `prefers-reduced-motion`
block collapses the entrance to ~1 microsecond.

### How to test

1. `cd frontend && npx vitest run src/components/ProjectsSection.test.tsx src/lib/projectsCopy.test.ts`
2. `cd frontend && npm run build`
3. In the app: Statistics tab, Projects card. With a completed (or
   running) check and 2+ projects, the rows should be one line each
   with a chart on the right; with exactly 1 project, a flat row and no
   chart or dot; portals below stay chartless. Toggle the theme and the
   in-app text size; at a narrow width the chart stacks below the rows
   at full width and the meta text left-aligns.
4. Keyboard: Tab through the card. Nothing inside the chart is ever a
   tab stop (the wrapper is `inert`).

### Notes for reviewer

- **Zone A (status live region, sequence-keyed message child, progress
  bar, action cluster) is byte-identical** — the three
  must-not-reintroduce defects in the component header all still hold,
  and the shipped state/copy/progress tests pass unchanged.
- **One deliberate deviation from the design refinement's Content
  Notes:** the spec says the refinement adds ONE user-visible string
  ("Checklists per project"). A second constant,
  `PORTALS_CHART_CAPTION` ("Checklists per portal"), was added for the
  chart-ownership fallback, because captioning a portals chart
  "per project" would present portals as projects — the exact claim the
  section's own note (and QA-64) forbids. Both constants live in
  `projectsCopy.ts` and are wired into the em-dash/apostrophe sweep.
- Dots render inside `.sr-proj-name` (never as direct row children) so
  the ≤640 `> *:not(.sr-only)` stacking rule cannot hand them
  `width: 100%`; a test pins the dot's parent.
- `docs/HELP.md` gains one sentence (the Projects section describes
  what each row lists, so the chart earns a line there). `README.md`
  and `website/` describe the section's behavior only (what is checked,
  when, at what cost), none of which changed, so per the approved
  design refinement's Content Notes they are untouched.
- Known limitation: with more than 8 projects, rows past the eighth
  keep full text rows with no bar and no dot (by design — the fold).
- Verified: full frontend suite 3,605 tests green (233 files),
  `npm run build` green, `weft-design-lint` zero warns and zero
  findings on touched files (the pre-existing repo `note`s are on
  unrelated files).

## Seeing Projects Stats Card locally

1. Open a terminal in your project folder
   (`/Users/developer/devwork/snowraven`).

2. Start the backend:
   `cd backend && uvicorn main:app --reload --port 1620`

3. In a second terminal, start the frontend:
   `cd frontend && npm run dev`

4. Open your browser and go to:
   `http://localhost:5173`
   (Or, for the desktop app: `cd frontend && npm run desktop:dev`.)

5. Click the **Statistics** tab, then scroll to the **Projects** card
   (it sits just after Effort & Outings; the "Projects" chip in the
   jump navigation takes you straight there).

6. If you have already run a projects check, you will see the new
   layout immediately: each project on one line, and a small bar chart
   headed "Checklists per project" to the right of the list, with a
   colored dot on each charted row matching its bar. If you have not,
   press **Check projects** and watch: the chart appears as soon as two
   projects are found, and its bars grow as answers land.

7. What to look for: the same numbers as before (count, share, date
   span) on every row; a denser card with much less empty space; no
   chart when only one project exists; the "How you submitted" rows
   tightened but chartless. Narrow the window below ~640px: rows stack
   and the chart moves below them at full width. Switch between light
   and dark themes: every color should look at home in both.
