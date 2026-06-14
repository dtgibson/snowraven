# Strategic Brief — Nearby Lifers Map

## What We're Building
A new Map Explorer section, "Nearby Lifers," that plots the places where species you've never recorded have been reported recently near a point you choose. Each pin marks a spot and is badged with the number of your lifers reported there; a matching in-view list mirrors the map. It replaces the flat Nearby Lifers list on the Statistics tab.

## Why Now
Nearby Lifers already exists, but it lives on the Statistics tab as a names-and-dates list. That answers "what could I add" but not "where do I go." The Map Explorer is the natural home for anything geographic, and its section model, location chooser, and marker/popup machinery are already built, so this is a high-leverage upgrade to an existing feature rather than new infrastructure.

## The User Problem
When you're chasing new birds for your life list, a column of species names isn't actionable on its own. You need to see where they're turning up to plan where to go. Today that geographic context is discarded. This puts the lifers on a map, near home or anywhere you point it.

## Success Criteria
- You open the Map Explorer, switch to Nearby Lifers, and immediately see pins for spots near your default location where birds you've never recorded were reported recently.
- Each pin shows how many of your lifers are there; clicking it lists those species with favicons, recency, and a link to the eBird checklist.
- You can re-center on your current location or any place you search, and set the radius, exactly like the other map sections.
- The panel list mirrors the pins, shares their selection and popup, and is fully keyboard-operable.
- The old list is gone from Statistics with nothing lost.

## Scope
- A fourth Map Explorer section alongside Sightings, Hotspots, and Media Targets.
- Location-grouped pins: one per spot, count-badged, with a popup listing each lifer there.
- The standard location chooser: opens at the Settings default location and radius; "use my location" and place-search re-center it.
- An in-view list in the panel that mirrors the map.
- A "Time range" filter over the results: last day, last week, or last 30 days (default 30), added to this section and to the existing Media Targets section so the two panels are consistent.
- Removal of the Nearby Lifers block from the Statistics tab once the new section is live.

## Out of Scope
- New data providers or any change to the privacy posture (reuses the eBird endpoints already in the app).
- A drawn radius ring on the map (none exists today).
- Redefining what counts as a "lifer" beyond the not-on-life-list definition, or looking back further than 30 days (the recency filter narrows within that window; it never extends it).
- Saving a chosen center or radius back to Settings (read-only, like the other sections).

## Key Decisions
- Move, don't duplicate: the feature leaves Statistics and lives only in the Map Explorer.
- Location is the unit: pins and list rows group by place; multiple lifers at one spot share a pin and row.
- Pins carry a count badge, mirroring the Media Targets "{n} species" treatment.
- Lifer names render as plain name + favicons (no Species Detail link), since by definition they're not in your recorded data.
- Use the coordinate-bearing recent-observations path (the current Nearby Lifers route throws coordinates away), and apply the radius in true miles like the rest of the Map Explorer rather than the kilometers the old Statistics card quietly used.
