# Change Brief — frivolous-lists-expansion

## What is changing
Add five new self-completing collections to the Frivolous Lists card on the
Statistics tab, extending the v0.5.36 pattern (Avian American / California Dreamer).
Three are flat lists (rendered like Avian American); two are grouped lists with the
user's sub-category headers shown inside the card, with a single whole-list
completion count + badge. Each checks off as the user records the species (matched
against the all-time recorded set, like the existing lists). Frontend-only; no new
providers; privacy unchanged.

## Why now
User request.

## User-facing impact
Five new collections appear in the Frivolous Lists section, each with a recorded/total
count and a "Complete!" badge at full. The two grouped lists show labeled sub-groups
(True Herons / Egrets / … and Cardinals / Jays / Titmice / …). Unseen rows still show
the eBird/BoW favicons (via the existing `/taxonomy/codes` batch). A species may appear
in more than one list.

## Decisions touched
- Extends v0.5.36 Frivolous Lists: `lib/frivolousLists.ts` (data + compute) and
  `components/FrivolousListsSections.tsx` (render). New `GroupedListResult` interface +
  a `groupedList()` helper + a `GroupedNameList` renderer (sub-group headers + one
  whole-list badge). The `BirdingStats.tsx` taxonomy-codes batch is extended with the
  new names (favicons on unseen rows).
- **Names use current canonical eBird names** (the v0.5.36 rule). Verified against the
  backend's live-taxonomy `/taxonomy/codes` endpoint — 56/59 matched; 3 corrections:
  Cattle Egret → **Western Cattle-Egret**; Black-crowned Night-Heron → **Black-crowned
  Night Heron**; Yellow-crowned Night-Heron → **Yellow-crowned Night Heron**. The
  sub-group *header* labels stay as written; only matched species names change.

## What done looks like
- Five new lists render in the Frivolous Lists card; flat ones like Avian American;
  the two grouped ones show sub-headers + one whole-list count/badge.
- Recorded counts match the user's data; unseen rows get favicons.
- A unit test covers the new flat + grouped compute (recorded/total/complete, grouped
  aggregation); existing frivolousLists tests stay green.
- Lint, typecheck, tests, and the production build all green.

## The lists (canonical species names to use)
```
Phoebe Phanatic (flat): Eastern Phoebe; Black Phoebe; Say's Phoebe
Scrub Jay All Day (flat): California Scrub-Jay; Woodhouse's Scrub-Jay; Florida Scrub-Jay; Island Scrub-Jay
Crow Pro / Raven Maven (flat): American Crow; Fish Crow; Tamaulipas Crow; Sinaloa Crow; Common Raven; Chihuahuan Raven

Heron is Carin' (and Egrets too) (grouped):
  True Herons: Great Blue Heron; Green Heron; Little Blue Heron; Tricolored Heron
  Egrets: Great Egret; Snowy Egret; Western Cattle-Egret; Reddish Egret
  Night-Herons: Black-crowned Night Heron; Yellow-crowned Night Heron
  Bitterns: American Bittern; Least Bittern

Best of the Crest (grouped):
  Cardinals & Allies: Northern Cardinal; Pyrrhuloxia
  Jays: Blue Jay; Steller's Jay
  Titmice: Tufted Titmouse; Black-crested Titmouse; Oak Titmouse; Juniper Titmouse; Bridled Titmouse
  Kinglets: Ruby-crowned Kinglet; Golden-crowned Kinglet
  Waxwings: Cedar Waxwing; Bohemian Waxwing
  Silky-Flycatchers: Phainopepla
  Flycatchers: Great Crested Flycatcher; Vermilion Flycatcher
  Woodpeckers: Pileated Woodpecker
  Kingfishers: Belted Kingfisher; Ringed Kingfisher; Green Kingfisher
  Quail: California Quail; Gambel's Quail; Mountain Quail; Scaled Quail
  Ducks & Waterfowl: Wood Duck; Hooded Merganser; Red-breasted Merganser; Common Merganser; Bufflehead
  Herons: Great Blue Heron; Snowy Egret; Black-crowned Night Heron; Yellow-crowned Night Heron
  Cormorants: Double-crested Cormorant
  Raptors: Crested Caracara
  Cuckoos: Greater Roadrunner
  Seabirds: Crested Auklet; Tufted Puffin
```
Counts: Phoebe 3, Scrub Jay 4, Crow/Raven 6, Heron is Carin' 12 (4 groups), Best of the Crest 38 (16 groups). Append after the existing lists in this order. The "include spuh" toggle does not affect these (they reflect the all-time life list, per v0.5.36).
