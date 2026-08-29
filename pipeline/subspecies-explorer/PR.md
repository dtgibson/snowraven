# PR - Subspecies Explorer (v1.0.6)

## Subspecies Explorer

### What this does

Adds a Subspecies Explorer to Species Detail, in two pieces. A "Subspecies and forms" control directly below the species selector opens a list of every species in the loaded eBird backup that carries at least one countable subspecies or form entry, each with its forms and their percentage share of that species' reports; picking one selects that species through the page's own selection path. A new "Subspecies and Forms" section on any selected species then shows one row per countable form with its report count and percentage, a "No form noted" row for plain species-level reports, and displayed shares that sum to exactly 100.0%. Everything derives offline from the already-parsed backup: zero network calls, zero new stored state.

### How to test

1. Load an eBird backup that contains form-level names (e.g. "Dark-eyed Junco (Oregon)") and open the Species Detail tab.
2. Below the species selector, click "Subspecies and forms" (it shows the count of qualifying species). Confirm the list shows only species with at least one countable form, in the selector's order, with each form's share.
3. Pick a species from the list: the whole page switches to it, the list closes, and the view scrolls to the "Subspecies and Forms" section (focus lands there too).
4. Check the section's math: row counts sum to the "Reports" total, percentages sum to exactly 100.0%, "No form noted" is pinned last and absent for a form-only species, and "Form noted" equals the sum of the form rows.
5. Apply a county or date filter: the section recomputes with the same filter as the sibling sections; reopen the list and confirm its shares did not move (it always reflects the whole backup).
6. Select a species with no form detail: the section shows the one-line empty state rather than disappearing.
7. Turn "Show subspecies" on: both pieces disappear (the exact-name view already lists forms); turn it off: both return. Toggle "Show all forms" both ways: no change to either piece.
8. If the backup holds a non-countable name that folds to the selected species (a hybrid, a slash), confirm the footnote under the rows accounts for the difference against the Sightings "Checklists" figure.

### Notes for reviewer

- **The FR-13 conflict is surfaced, not silenced.** The merged Sightings figure includes non-countable variant rows; the breakdown, by FR-02, excludes them. Per the Architect's verified finding (schema.md), the breakdown carries a `nonCountableCount` ledger and the invariant is `breakdown.total + nonCountableCount === speciesObs.length === Sightings "Checklists"`, with a user-visible footnote whenever the ledger is nonzero. The merged view itself is untouched (FR-21).
- **Reuse, not reinvention (NFR-06):** folding is `normalizeSpeciesName` (never `truncateAtFirstParen`), countability is `isNonCountableForm` on the raw name, selection is the page's own `selectSpecies`, and the breakdown consumes the page's existing filtered `speciesObs` memo unmodified, so filter parity is by construction.
- **Memoization is by reference identity:** the full-backup index is keyed on the loaded observations (once per load, FR-22/NFR-02); the breakdown on the `speciesObs` reference (once per species/filter change). A component test asserts this as work done (derivation invocations), not elapsed time.
- **Percent shaping** is integer tenths with a 0.1% floor for any nonzero row and the rounding residue absorbed by the largest row; a single row displays a flat "100%". All in the pure module, fixture-tested against the approved design's demonstrated states.
- Explorer list rows render names through `BirdName` in its non-link, favicon-less form deliberately: each row is one button, and a nested link would be an interactive-inside-interactive violation. The approved mockup shows the same.
- Known limitation: pathological inputs with over ~1,000 distinct rows for one species cannot honor both the 0.1% floor and the exact-100.0 sum; the floor wins (documented in the module).
- The panel's open state is ephemeral component state (never persisted). Because Species Detail stays mounted across tab switches, the panel keeps its state within a session like the sibling Counties toggle; it is collapsed on every launch and closes on every pick.

---

## Seeing Subspecies Explorer locally

1. Open a terminal in your project folder.

2. Start the backend:
   ```
   cd backend && uvicorn main:app --reload --port 1620
   ```

3. In a second terminal, start the frontend:
   ```
   cd frontend && npm run dev
   ```

4. Open your browser and go to: http://localhost:5173

5. Click the **Species Detail** tab. (If you have not loaded data yet, go to **Settings** first and upload your eBird backup file, `MyEBirdData.csv`.)

6. Directly below the species picker, click the button labeled **Subspecies and forms**. A panel opens listing every species in your data that has subspecies or form entries, with each form's share of your reports.

7. Click any species in that list. The page switches to that species and scrolls to the new **Subspecies and Forms** section, which shows each form's report count and percentage, plus a "No form noted" row for reports without a form.

8. What to look for: the percentages always add up to exactly 100%, the counts add up to the "Reports" figure at the top of the section, and changing the county or date filter above updates the section while the list under the button stays the same (it always describes your whole file).
