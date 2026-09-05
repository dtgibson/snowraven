# Command Palette

### What this does

Adds a modal search overlay, opened with Cmd-K or Ctrl-K from anywhere in the
app and by a visible Search control at all three navigation densities, that takes
the user straight to a thing they can name: one of the app's destinations, or any
species in their own eBird backup. Type a few letters, press Enter, arrive.

It owns nothing and derives everything. Destinations are `App.tsx`'s existing
`navItems` array, so there is no destination list in the feature's files at all
and a destination added in a future release appears with no registration step.
Species come from the shared `loadEbirdObservations()` parse, de-duped and sorted
in memory. No network call, no persisted document, no cache, no
`CACHED_GET_PATHS` entry and no `clearDerived.ts` row: `PRIVACY_POLICY.md`,
`cacheInventory.test.ts`, `clearDerived.ts` and `transport.ts` are all untouched.

### How to test

1. `cd backend && .venv/bin/python -m uvicorn main:app --reload --port 1620`
2. `cd frontend && npm run dev`, then open http://localhost:5173
3. Press **Cmd-K**. With nothing typed you get every visible destination in your
   saved order, Settings last.
4. Type **cal**: the Calendar destination, plus species matched on their
   *scientific* name alone (*Calypte anna*).
5. Arrow down past the destinations into the species; the highlight crosses the
   boundary on one press and stops at the ends rather than wrapping. Enter opens.
6. Type a bird name and press Enter: Species Detail opens on it.
7. Escape closes and focus goes back where you were. So do the Close button, a
   press on the dimmed backdrop, choosing a result, and a second Cmd-K.
8. Expand the Map Explorer to fullscreen, press Cmd-K, and pick Calendar. You
   land on the Calendar, and the Map Explorer is no longer stuck in fullscreen.

A fuller walkthrough, written for a non-technical reader, is in
`pipeline/command-palette/how-to-see.md`.

### Notes for reviewer

**Two corrections to the approved artifacts, both deliberate, both already
argued in `schema.md`. Please do not re-file either.**

1. **NFR-01 / QA-57 are half wrong as written.** They say `<BirdName>` is off
   App.tsx's static entry graph. That is true of `SpeciesCombobox` and **false**
   of `BirdName`, which is statically reachable from `App.tsx` by three chains
   this feature cannot touch (`NamedBirds`; `LifeList → LifeListTable`;
   `BreedingCodeList → BreedingCodeTable`). `expect(has('components/BirdName.tsx'))
   .toBe(false)` would go red on arrival, and editing that assertion is what
   `entryChunk.test.ts`'s own header names as *the* failure mode. The honest
   assertion is implemented instead, on the palette's **own subtree**
   (`hasIn(pal.files, 'components/BirdName.tsx') === false`), paired with a
   source scan proving the palette imports neither. Moving `BirdName` off the
   entry graph is a separate build and belongs on the ROADMAP.

2. **The palette is NOT a row in `honestLoadFailures.test.tsx`'s
   `EBIRD_MESSAGE_TABS`,** which `schema.md` D-06 asked for. Every row there
   declares a `setupTitle` and a `stepsMarker`, and both tests over that roster
   turn on the surface having a `setup-required` phase: one asserts a "Go to
   Settings" button is present, the other asserts the SetupRequired panel renders
   when no file is stored. The palette has neither and must never show a guidance
   panel; it keeps working for destinations in all four states. It gets its own
   block in the same file, with both directions covered and the reasoning
   written down, following the precedent that file already sets for the Weather
   backlog (a section rather than a tab).

**One defect found and fixed by the browser probe, worth knowing about.**
`restoreOpenerFocus`'s liveness gate originally admitted `<body>`: the chord
captures its opener eagerly from `document.activeElement`, which **is** `<body>`
whenever nothing in the page holds focus, and `<body>` passes every other clause
(in the document, not disabled, not inert) while accepting no focus at all. The
restore reported success with focus sitting exactly where FR-12 forbids it.
Measured in Chromium and WebKit. The gate now rejects `<body>` and `<html>`
outright, and `tryFocus` reads `document.activeElement` back so a candidate that
refuses focus for any other reason falls through rather than ending the restore
on nothing. Both directions are covered in `lib/paletteFocus.test.ts`.

**`mapFullscreen` (schema D-09).** `App.tsx` passes two wrappers rather than
`setActiveTab` raw. Nothing resets `mapFullscreen` on a tab change; the shipped
convention is that every App-level path navigating away from a fullscreen Map
Explorer collapses it first, and until now that convention could not be violated
because the nav is `inert` (or absent) while the map is fullscreen. The palette
is the first surface that can reach another destination from that state. It does
**not** collapse when the palette selects the Map Explorer itself.

**A stated, accepted consequence for QA to see once and not file (R-06).** The
*embedded* map fullscreen (`lib/useMapFullscreen.ts`, on Species Detail, Named
Birds and Statistics) is component-local state at three lazy hosts that `App.tsx`
holds no handle on. Navigating away from one via the palette leaves that map
expanded when you return. The overlay itself vanishes correctly, so there is no
paint or focus artefact. Reaching it would mean a new cross-cutting store for
per-map component state, which is the "second source of truth" the strategic
brief's action-registry decision refuses.

**Escape layering.** One always-armed listener at `window`, **capture phase**.
That is not a preference: a bubble listener cannot beat `SharePopup`'s
capture-phase dismiss, and a *document*-capture listener races it on registration
order, which is precisely the case QA-47 tests. `window` is the root of the
propagation path, so it wins by specification rather than by experiment. While
the palette is closed the Escape arm returns before touching the event, so every
shipped Escape layer behaves exactly as before; `lib/usePaletteHotkey.test.tsx`
probes both directions with a document-level listener.

**One assumption this rests on (R-03):** nothing else in the app binds a `window`
keydown listener. Nothing does today. A future `window`-capture listener
registered *before* this one would beat it, and `usePaletteHotkey.ts` says so.

**The predicate was extracted, not duplicated.** `SpeciesCombobox`'s filter now
calls `lib/speciesMatch.ts`, behaviour preserved exactly. `speciesMatch.test.ts`
carries the FR-23 table plus a source scan asserting both consumers import it and
neither carries a re-spelling, which is what makes "single-sourced" structural.

**Verification beyond the unit suite.** `pipeline/command-palette/verify-palette.mjs`
runs 24 checks against the production build in **Chromium and WebKit**: tab
containment by the v1.0.15 measurement method, the overlay's tab-stop population
by real focusability, the live region in a real accessibility tree, arrow
clamping, 320px at 100% **and** 200% in-app text scale (element-against-container,
not only page `scrollWidth`), and focus return. All 24 pass in both engines. It
was guard-checked by neutering the focus trap and confirming the containment leg
goes red in both, and the file records which half of that assertion actually
discriminates.

**Bundle impact, measured by a build A/B rather than estimated.** Entry chunk
312,746 → 316,818 bytes (+4,072, the four entry-safe modules plus the nav control
and the App wiring). The overlay is its own 6.7 kB lazy chunk and is not
modulepreloaded. Stylesheet 81,880 → 87,849 bytes; a rule-level diff of the built
CSS shows **41 selectors added, 0 removed, and every one of them belongs to this
feature**, so no stray Tailwind utility was emitted from a test-file comment.

**A first-run overlap, checked rather than assumed.** On a genuine cold start the
WelcomeScreen is up (z-index 1200) and the chord still opens the palette
(z-index 1280) over it. Escape then closes the palette only, leaving the welcome
screen up, which is FR-49 behaving correctly.

**Not in this change, deliberately.** No version bump, no `CHANGELOG.md` entry,
and `website/index.html`'s version pill is untouched: this is one build of a
bundled Spool release, and the bundle owns the four-file set at ship time.

### Convention Flags

- **A liveness gate that decides where focus goes must READ `document.activeElement`
  back after focusing, not predict which elements accept focus.** Enumerating the
  refusals (detached, disabled, inert, `<body>`, `<html>`) is a prediction about an
  engine, and this app has already paid once for predicting focus behaviour instead
  of observing it. Keep the enumeration as a cheap pre-check so the branch labels
  stay meaningful, and make the observation the thing that decides.

- **A browser probe that injects its own furniture into the page owns its
  teardown before it measures the page.** A bare `<input>` prepended to `<body>`
  for a containment leg is wider than a 320px viewport at 200% text scale, and it
  reported itself as a 78px page-scroll leak in WebKit and nowhere else. The
  existing rule says a deliberate load experiment owns its teardown; this is the
  same rule inside a single script's own run.

- **A count in a published `it(...)` title is worth keeping when the count is the
  point.** `helpToc.test.ts`'s "covers all N sections" went 16 → 17 here. It is
  redundant with the parity assertion above it by design: the parity test would
  accept a section added to both sides by accident, and the count makes adding one
  a deliberate, reviewable act.
