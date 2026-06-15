# Strategic Brief — Frivolous Lists

## What We're Building
A new **Frivolous Lists** section at the bottom of the Statistics page: a small set of playful, self-completing "collections" that fill in as the user's life list happens to cover them. Three lists ship: **Avian American**, **California Dreamer**, and **Rainbow Warrior**.

## Why Now
SnowRaven is mature on the serious analysis side — stats, maps, media, comparers. This adds the first deliberately *fun* lens on the same data: a reason to smile at your list and a low-stakes "can I complete it?" itch. It costs nothing in data terms (everything derives from the export already loaded) and gives the Statistics page a light, human ending note.

## The User Problem
Birders love arbitrary little collections — they're half the joy of listing. SnowRaven can already tell you *what* you've seen, but it never winks at you about it. There's no place in the app that's just for delight, no "first red bird I ever saw" moment, no satisfying checkmark-the-set chase.

## Success Criteria
- A **Frivolous Lists** section renders at the bottom of Statistics, below everything else.
- **Avian American** lists all 22 "American" birds in the standard SnowRaven bird format; species the user has seen are checkmarked; a completion badge appears when all 22 are checked.
- **California Dreamer** does the same for the 7 "California" birds.
- **Rainbow Warrior** shows seven color rows (red → violet). Each color the user has covered shows the bird they saw *earliest* whose name contains that color, with its first-seen date and location and a working link to that checklist; uncovered colors show a blank; a badge appears when all seven are filled.
- Everything derives live from the loaded data — no new network calls, no new data sources.

## Scope
- The three lists above, exactly as specified.
- Standard `<BirdName>` rendering with checkmarks and per-list completion badges.
- Rainbow Warrior's earliest-first-seen logic, plus first-seen date/location and a checklist link per filled color.
- Placement as the final section of the Statistics page.

## Out of Scope
- User-created or user-customizable lists.
- Sharing or exporting these lists.
- Any new backend, data source, or persisted state — it's frontend-only, computed from the export.
- More joke lists than these three (the structure should make adding more *easy*, but only three ship now).

## Key Decisions
- **Avian American / California Dreamer** are curated, hardcoded species lists; seen/unseen is resolved by matching the user's loaded backbone on normalized common name (robust to recent eBird naming like "American Goshawk" / "American Barn Owl").
- **Rainbow Warrior = earliest-first-seen per color** (confirmed): the first bird the user ever logged whose name contains that color represents it.
- A seen bird's name links to its **Species Detail** (standard `<BirdName>`); the Rainbow Warrior first-seen date/location links to that **eBird checklist**.
- Frontend-only; no new providers; privacy unchanged. Ships with a version bump and changelog per project convention.
- **Left for The Planner:** how precisely a color matches inside a name (word-aware vs. loose substring) and whether one bird can satisfy two colors (e.g. Violet-green Swallow filling both violet and green).

### Curated species lists (as provided)

**Avian American (22):** American Avocet, American Barn Owl, American Bittern, American Black Duck, American Coot, American Crow, American Dipper, American Flamingo, American Golden-Plover, American Goldfinch, American Goshawk, American Herring Gull, American Kestrel, American Oystercatcher, American Pipit, American Redstart, American Robin, American Three-toed Woodpecker, American Tree Sparrow, American White Pelican, American Wigeon, American Woodcock.

**California Dreamer (7):** California Condor, California Gnatcatcher, California Gull, California Quail, California Scrub-Jay, California Thrasher, California Towhee.

**Rainbow Warrior colors (7):** red, orange, yellow, green, blue, indigo, violet.
