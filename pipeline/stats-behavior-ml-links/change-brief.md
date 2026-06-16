# Change Brief — stats-behavior-ml-links

## What is changing
On the Statistics tab's Media card, each behavior in the "Behaviors documented"
list becomes a link to the Macaulay Library catalog filtered to that behavior for
the user: `https://media.ebird.org/catalog?userId=<id>&tag=<slug>`. This covers
both general behaviors (Flying → `flying_flight`) and breeding behaviors
(Feeding Young → `feeding_young`), which are all rows in that one list. A fixed
label→tag-slug lookup maps the ML behavior vocabulary; any unmapped label stays
plain text (no broken link). The user id is the one the app already parses from
the ML export filename. Also: migrate the existing Most-Photographed / Audio /
Video count links on this tab off the legacy `search.macaulaylibrary.org/catalog`
base onto `media.ebird.org/catalog`, so every Statistics ML link uses one base.

## Why now
User request. The catalog's per-behavior filter is the same "jump from a stat to
the underlying media" the tab already offers for the photo/audio/video counts;
this fills the gap for behaviors. Consolidating the base finishes a cleanup the
v0.5.33 decision explicitly deferred.

## User-facing impact
Behavior counts become links (new tab, via the shared `OutboundLink` with its
"(opens in a new tab)" cue), matching the existing count→ML links right above
them. The numbers shown do not change. The existing photo/audio/video links keep
working, now on the current catalog host.

## Decisions touched
- v0.5.33 ("Multimedia sex & age filters") recorded that BirdingStats still used
  `search.macaulaylibrary.org/catalog` while Multimedia moved to
  `media.ebird.org/catalog`, and that consolidating the two builders was "a future
  candidate, not done here." This change does the Statistics-side consolidation —
  The Chronicler must record it.
- New fixed label→tag-slug lookup. The slug is NOT derivable from the label
  (Flying→`flying_flight`, Mechanical Sound→`non_vocal`, Preening…→`preening`,
  Courtship…→`courtship_display_or_copulation`), so it is a hardcoded table, not a
  string transform.

## What done looks like
- Each behavior row in the Behaviors list links to
  `media.ebird.org/catalog?userId=<id>&tag=<slug>`; unmapped behaviors render plain.
- Links open in a new tab via `OutboundLink`; the "move the link to the number"
  convention is honored (the count carries the link, name stays as it is).
- Existing photo/audio/video count links also point at `media.ebird.org/catalog`;
  all params (mediaType / taxonCode / userId) still resolve.
- The aggregate breeding tier tiles (Confirmed / Probable / Possible) and the
  separate eBird Breeding Stats card are unchanged (they don't map to a single tag).
- Lint, typecheck, tests, and the production build all green.

## Behavior → ML catalog tag-slug map (verified; live-confirmed against the catalog UI)
```
Flying                              -> flying_flight
Foraging or Eating                  -> foraging_eating
Vocalizing                          -> vocalizing
Song                                -> song
Call                                -> call
Preening, Scratching, or Bathing    -> preening
Carrying Food                       -> carrying_food
Nest Building                       -> nest_building
Feeding Young                       -> feeding_young
Courtship, Display, or Copulation   -> courtship_display_or_copulation
Mechanical Sound                    -> non_vocal
(also, if present in the export):
Molting                             -> molting
Carrying Fecal Sac                  -> carrying_fecal_sac
```
Notes: behavior tags + sound-type tags (`song`/`call`/`non_vocal`) share the one
`tag=` param. `userId` is camelCase. The exact display labels must match the ML
"Behaviors" column values the app already parses (see `mediaStats.ts`
`parseBehaviors` / `BREEDING_BEHAVIOR_TIER`).

## Scope expansion — approved by Dave 2026-06-16 (after first review)

Two additions approved on review, folded into this same change (recorded so the
diff doesn't read as scope creep):

1. **Each breeding behavior is its own link (not the aggregate tiles).** The
   earlier brief left the three breeding tier tiles (Confirmed/Probable/Possible)
   untouched; on review Dave asked for the breeding behaviors to be clickable. The
   tiles stay as the species-count summary; below them, each breeding behavior the
   user has media for (feeding young, carrying food, nest building, courtship/
   display, song) is now listed and linked to its own `tag=` — surfaced explicitly
   because breeding behaviors often fall below the top-10 behaviors cut. When that
   breeding list is shown (userId present) the breeding behaviors are removed from the
   top "Behaviors documented" list so each appears once (Dave's follow-up); without a
   userId there is no breeding list, so they stay in the documented list (unlinked).
   `BREEDING_BEHAVIOR_TIER` is now exported from `mediaStats.ts`.

2. **Media "documentation coverage" denominator fix (folded in, same page).** The
   "X of N life-list species documented with media" denominator counted every
   distinct observed name — including spuh ("Gull sp."), slash ("Greater/Lesser
   Scaup"), and hybrid ("Mallard x …") forms — overstating the life list. Fixed in
   `computeMediaStats` (pure/testable) via a new shared `isNonCountableSpecies`
   helper in `speciesUtils.ts`, excluding non-countable forms from both the
   denominator and the numerator. `backboneNames` (which drives Species-Detail
   linking) is left untouched. An audit (parallel read of `birdingStats.ts` /
   `speciesStats.ts`) confirmed no other Statistics count shares this bug — all
   others already run on filtered observations. The Chronicler must record this fix.
