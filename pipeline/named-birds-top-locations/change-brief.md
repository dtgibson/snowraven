# Change Brief — Named Birds Top Locations

## What is changing

Each expanded card on the Named Birds tab gains a ranked "top locations" block,
placed directly above the per-individual sightings map. It lists the places that
individual has been recorded, ordered by how many of its sightings happened
there, built purely from that bird's own `[name:…]`-tagged sightings — never the
species' wider history. The data is already on the card (every sighting row
carries its location); this summarises it instead of making the birder count
rows. Location names follow the app-wide convention: a public eBird hotspot
links to its hotspot page, a personal location stays plain text.

## Why now

Direct user request. The user went looking for exactly this list on a named
individual, assumed it existed and was showing species-wide data, and it turned
out not to exist at all — the only "Top Locations" list in the app is Species
Detail's, which is species-wide by design. The tab tracks one bird across years;
"where does this bird hang out" is the question it invites and cannot answer.

## User-facing impact

Yes, and that is the point. An expanded Named Birds card gains a new block above
its map. Nothing is removed or reordered below it: the sighting rows, the map,
and the media section keep their current positions and behaviour. The block is
scoped to the Named Birds tab only — Species Detail's "Named Individuals"
section (which reuses the same table with `showMap` off, beneath its own
species-wide Top Locations) is deliberately unchanged.

## Design pass

**Needed.** The Designer works out how the block reads on an existing, already
dense card: its heading, how many locations show before a "show all" affordance,
how the count-per-location renders, and how it sits against the "Where [name] has
been seen" map header immediately below it. It must hold at 320px wide and at
200% in-app text scale, in both themes, and read correctly for an individual with
one location (where a ranked list may be the wrong shape entirely).

## Decisions touched

None reversed. Three are extended and must be honoured:
- **v0.5.40 hotspot links** — location names render through `HotspotLink`;
  `useHotspotSet()` is called ONCE in the parent and `isHotspot` passed down,
  never per row.
- **v0.5.26 Named Birds tab** — the single-open accordion and the render-only-
  while-expanded map stay as they are; the new block must not mount a second map.
- **v0.5.23 Named Birds** — a named individual is keyed by name + species via
  `namedBirdKey`; the ranking reads `bird.sightings` and nothing else.

## What done looks like

Expanding a named bird shows its own locations ranked by sighting count, above
the map, and the totals reconcile with the sighting rows on the same card.
A bird whose export carries no location names, or a single location, degrades
cleanly rather than rendering an empty or one-item "ranking".
Species Detail's Named Individuals section is byte-unchanged.
