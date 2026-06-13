# Strategic Brief — Named Birds Tab Upgrade

## What We're Building
An upgrade to the existing **Named Birds** tab (shipped v0.5.23) that
strengthens how a birder reviews the individual birds they track over time.
Five clarity/parity fixes plus one new view: a per-individual **sightings
map** showing where that named bird has been seen, reusing the Species Detail
map pattern. The map is what makes this a feature rather than a polish pass;
the five fixes ride along because they touch the same surface.

The six parts:
1. Lift the tab's contrast (the current text tokens read too faint, worst in
   dark mode).
2. Fix the name/species baseline misalignment in each card header.
3. Give each per-sighting comment its own distinct background so it reads as
   separate from the card.
4. Rework the sort control to four options — **Name (Individual)**,
   **Alphabetical**, **Taxonomic**, **Last Seen** — matching the rest of the
   app (the missing one today is Taxonomic).
5. Show each report's location text between the date and the checklist link,
   the same field every other tab already surfaces.
6. **New:** a small per-individual sightings map inside each expanded card.

## Why Now
This is a direct response to using the shipped feature. Named Birds is a young
tab and the friction is concrete: it's hard to see, the header looks broken,
comments blend in, the sort set is inconsistent with every other page, and the
location that's shown everywhere else is missing here. Fixing those while the
tab is fresh keeps it credible. The map is the natural next beat — once you're
looking at an individual bird's history, "where have I seen *this* one?" is the
obvious question, and the app already answers exactly that question for species
on Species Detail. Building it now, on the same surface as the polish, is
efficient and coherent.

## The User Problem
The user is a birder who follows specific individual birds across seasons — a
returning oystercatcher, a banded crow, a neighbourhood owl — by tagging them
in eBird comments (`[name:…]`). They come to this tab to review one bird's
story. Today that story is harder to read than it should be (low contrast,
misaligned headers, comments that don't separate), missing a detail they rely
on elsewhere (location per report), and missing the most natural way to *see*
that story — a map of where the bird has turned up. The upgrade makes the tab
legible and gives the spatial view that the rest of the app has trained them to
expect.

## Why It Fits SnowRaven
SnowRaven is a privacy-first, local-only companion to eBird and the Macaulay
Library — it runs no server, holds no account, and lets a birder explore their
own exported data in ways eBird's own site doesn't. This upgrade is squarely
inside that purpose:

- **It deepens an existing feature rather than opening a new product area.**
  Named Birds already exists and is established; this makes it work the way it
  should and adds the one view it was missing.
- **It reuses a pattern users already know.** The per-individual map mirrors the
  Species Detail map exactly — same `<SnowMap>` wrapper, same DOM markers, same
  popup. The user learns nothing new; they get a familiar tool pointed at a
  finer-grained object (one named bird instead of one species).
- **It stays alongside eBird, never replacing it.** Every report still links
  back to its eBird checklist; the map shows the user's own history, it doesn't
  substitute for eBird's data or maps.
- **The map respects the privacy promise** (see below).

## Privacy Framing
The map shows precise sighting coordinates — but this is fully consistent with
SnowRaven's privacy posture, and worth stating plainly so it's carried forward
deliberately:

- The coordinates are the **user's own data**, from their own eBird export,
  rendered **only to them** on their own device. Nothing is shared, uploaded,
  or transmitted to any SnowRaven service — there is no SnowRaven server.
- The data is already on this surface in spirit: the same coordinates already
  drive the Species Detail map and the Map Explorer. This adds no new data
  collection and models no new field beyond threading coordinates that already
  exist in the parsed export onto the per-sighting record.
- Map **tiles** are fetched browser→provider from the existing keyless
  providers (per CLAUDE.md and `PRIVACY_POLICY.md` "Map Tiles") — the same
  providers every other map already uses. No new provider is introduced, so
  no privacy-policy change is expected from this feature. (Flag for the
  security review: confirm no new tile source or data egress is added.)

The net: this renders the user's own birding history to themselves, locally —
the core of what SnowRaven is for.

## Success Criteria
- A birder opening a named bird's card can read every part of it comfortably in
  both light and dark mode — header aligned, comment visibly separate, contrast
  no longer the complaint.
- The sort control offers the same four options as the rest of the app, and
  Taxonomic orders individuals by eBird taxonomy.
- Each report shows its location between the date and the checklist link, like
  every other tab.
- Expanding a named bird shows a map of where that individual has been seen,
  reading as a smaller sibling of the Species Detail map; null-coordinate
  sightings simply don't pin; a bird with no usable coordinates shows no map
  rather than an empty one.
- A user reviewing several individuals in a session experiences no jank or
  crash from the maps.

## Scope
- The five clarity/parity fixes to the Named Birds tab (contrast, header
  alignment, comment background, four-option sort, per-report location).
- A per-individual sightings map inside each expanded card, reusing the Species
  Detail map pattern, fed from that individual's sightings.
- Threading the coordinate and location fields (already present in the parsed
  export) onto the per-sighting record so the map and the location string have
  the data they need.

## Out of Scope
- Any change to how individual birds are detected, named, or keyed (the
  `[name:…]` model is settled and untouched).
- Any new data source, parser change, or new eBird/Macaulay column — everything
  needed is already in the export.
- A redesign of the Named Birds tab beyond the listed fixes.
- New map capabilities beyond the Species Detail parity set (this is not the
  place to invent new map interactions).
- The reduced Species-Detail "Named Individuals" section's sort set — within a
  single species, Taxonomic/Alphabetical are meaningless, so it keeps its
  smaller option set. (Confirm with the user at planning if in doubt.)

## Key Decisions / Considerations to Carry Forward
- **Privacy is satisfied as framed above** — the user's own data, shown only to
  them, locally; no new collection, no new tile provider expected. The security
  review should confirm no new data egress.
- **Concurrent-map performance is the one real engineering risk.** Each
  expanded card mounts its own MapLibre/WebGL context; a user expanding several
  individuals at once could mount several maps simultaneously. Rendering the map
  only while a card is expanded bounds this naturally, but the planning/
  architecture stages should decide whether to also cap concurrent maps or
  otherwise guard the lifecycle. This is a consideration to design for, not a
  blocker.
- **Reuse, don't re-invent.** The map should drop into the existing shared
  `<SnowMap>` / DOM-marker / single-`<Popup>` pattern (per DECISIONS and
  CLAUDE.md), with DOM markers (a named bird has a small, bounded set of
  sightings — DOM markers are the sanctioned choice, not GL layers).
- **Token-only styling.** All contrast and comment-background work uses the
  existing `var(--sr-*)` tokens; any genuinely new shade goes into both light
  and dark before use.
- **This is a shippable change.** It carries the usual version bump, CHANGELOG,
  and a docs/website review for the Named Birds description — noted here so the
  later stages don't forget it.
