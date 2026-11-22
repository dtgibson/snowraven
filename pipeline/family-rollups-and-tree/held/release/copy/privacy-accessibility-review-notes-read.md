# The four other published statements, read for 1.0.76

Read on 2026-11-22 against `main` at `012c3b7c` (both builds). Result: **none of
the four needs a change for this release**, so nothing here waits for a yes.

## PRIVACY_POLICY.md (and website/privacy.html): no change

- **Family Tree:** makes no request of its own. Measured on the capture rig
  with every non-loopback host refused and logged: opening the tab in both its
  views at four sizes logged no outside request at all. Its data is the
  bundled family asset (a lazy chunk of the app) and the existing
  `/taxonomy/codes` batch to the user's own server on web and Pi. Nothing
  joins `lib/clearDerived.ts`, so the policy's list of what Clear removes stays
  complete. The three remembered choices (region, names, view) are
  preferences in the settings document; the policy names no remembered
  preference today (schema 525). Its Birds of the World family links are
  links the user opens, not loads, and the species marks beside names are the
  ones the policy already describes ("throughout the app").
- **Maps on phones:** no tile provider, host, request or component changed
  (change brief, "Will not change"); a still is the same live map made inert,
  so its tile requests are the ones the policy's Map Tiles section already
  describes.

## ACCESSIBILITY.md: no change

- The map build's two sentences (the phone keyboard route through Open the
  map, and Escape's landing on a phone) are already in the file on `main`, and
  were pushed to GitHub with `d7be7653` before any release (see the gate's
  note on the early push).
- Family Tree: QA-73 passed in round 3. Its accessibility statement owes a
  sentence only for a roster row added to `tabOrderCoverage.test.ts`, a
  library-drawn control left in the diagram, or a platform gate (FR-77), and
  the build added none of the three; the load-failure paragraph speaks of a
  saved backup or export and stays true beside the new Reload case. A
  sentence describing the tree's keyboard model (one Tab stop, arrow keys) is
  possible future documentation, not an owed correction.

## appstore/REVIEW_NOTES.md: no change

Its walkthrough steps stay true on the iPhone after the map build: step 5
(Species Detail "a map of every observation") still shows the map, now as a
still that opens in fullscreen; step 6 (Map Explorer, "Sightings in view" in
Filters) is the Map Explorer's own live map, unchanged at the reviewer's phone
sizes; step 7 (Weather, Plan, "choose a coastal spot") is still reachable by the
place search, the coordinate fields, or the picker map opened in fullscreen.
The notes describe no tab list that Family Tree would make incomplete.

## F-Droid full_description.txt: no change required

Nothing in it becomes false. It lists tabs, but already omits Life Lists
(1.0.63) and Hotspot Reports (1.0.71), and makes no claim to list every tab,
so Family Tree's absence is the same pre-existing gap rather than a new
falsehood. Bringing the description up to every tab is a separate copy job for
the user to ask for (three paragraphs of new published copy), offered as a
follow-up, not proposed here.
