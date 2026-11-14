# Held: the website Hotspot Reports frame's alt text

**Status: HELD for the user's yes, and only with the recaptured frame.** The current `alt` describes the current `website/assets/shots/hotspot-reports.webp`, which shows the 1.0.71 order (the life list directly under the header). Once the frame is recaptured from the top of the report (`screenshots.md`), the life list is no longer what the frame shows first, so the current text becomes false and the replacement below goes in with the new image. Read the replacement against the NEW frame before approving it: it names what a 1600 x 900 capture of the report's top shows at the default text size (the header, the At a glance card, then the top of the map in the left rail and the top of the life list on the right), and any part the recaptured frame does not show must come out of it.

`website/index.html`, the `<img>` inside `<figure class="feature-media shot-slot" data-shot="hotspot-reports">`:

**BEFORE** (verbatim from the published file):

````before alt
The Hotspot Reports tab showing one hotspot's report: its name and kind, its species and checklist totals with the counting rule beneath them, its life list newest first with how many of the place's checklists include each species, a map with one pin, and its checklists by eBird protocol.
````

**APPROVED (D-16, 2026-11-13), and written to `website/index.html` with the recaptured frame.** The user asked for a shorter alt than the proposal below, chose the shortest of the options offered, and added "please don't capitalize at the middle of the sentence":

````approved alt
The Hotspot Reports tab showing one hotspot's totals and an at a glance summary, above its map and life list.
````

`hotspotReportsSurfacesPublishedClaims.test.ts` holds it: its applied-state row reads the 1.0.71 AFTER block with this alt in place of the 1.0.71 one (a `SUPERSEDED` entry naming D-16), requires the old alt gone and the new one present exactly once, and still requires the alt to open "The Hotspot Reports tab ".

**AFTER** (the proposal, refused as too long; corrected 2026-11-13 by the Deployer against the recaptured frame):

````after alt
The Hotspot Reports tab showing one hotspot's report: its name and kind, its species and checklist totals with the counting rule beneath them, an At a glance card of the place's figures, such as the days and years birded, species per hour, and the first and latest visit, then the top of its map beside the start of its life list.
````

**The correction.** The first proposal ended "then a map with one pin beside the start of its life list". In the recaptured frame the Map card shows its heading, its zoom buttons and the top band of the map, and the frame's bottom edge cuts through the pin, so only the pin's top few pixels show (magnified crop at 2x in the review page). "a map with one pin" became "the top of its map". Every other part was read against the new frame and stands: the kind ("HOTSPOT") and name, the Species 143 and Checklists 42 totals with the counting rule beneath, the At a glance card with Days birded, Years birded and Species per hour among its tiles and First visit and Latest visit among its rows, and the Life list card's heading and opening sentence on the right.

ASCII only, no em dash, the tab named as `TAB_LABELS` spells it, "At a glance" as the section title in `lib/hotspotReportsCopy.ts`. The guard over the frame, `frontend/src/lib/hotspotReportsSurfacesPublishedClaims.test.ts` (lines 209 and 210), asserts the image path and that the alt opens "The Hotspot Reports tab ", so it stays green with either text: it cannot tell the stale description from the true one, which is why this replacement is tied to the recaptured frame by hand. A row naming "At a glance" in the alt could be added to that suite in the same applied change if the user wants the pairing guarded.
