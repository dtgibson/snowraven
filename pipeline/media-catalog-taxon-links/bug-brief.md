# Bug Brief — Media Catalog Taxon Links (subspecies forms)

## What is broken
Macaulay Library "view my media" links break for any bird recorded under a
subspecies / form name (a trailing `(...)`, e.g. "Scaly-breasted Munia (Scaled)").
The eBird taxon-code lookup only resolves `category=="species"` names, so a form
name resolves to no code. Species Detail then drops the code entirely (links to ALL
the user's photos); Multimedia and Statistics fall back to `?taxaName=…(Scaled)`, a
malformed filter. One root cause, four builders, three surfaces.

## Steps to reproduce
1. Load an eBird backup + ML export containing a form name (e.g. Scaly-breasted Munia (Scaled)).
2. Species Detail → that species → Media: photo link → `search.macaulaylibrary.org/catalog?mediaType=photo&userId=…` (no `taxonCode`) → shows ALL your photos.
3. Multimedia (Media Life List) → same species → any media count link → `media.ebird.org/catalog?taxaName=Scaly-breasted%20Munia%20(Scaled)&mediaType=photo&userId=…` (malformed).
4. Statistics → "Most photographed/recorded/filmed" → same `taxaName=…(Scaled)` fallback.

## Expected behavior
Every link filters to the user's media, and its scope follows the "Show subspecies" toggle:
- **Toggle OFF** (default; merge on → parent species shown) → link filters by the SPECIES code (e.g. `taxonCode=nutman`) = all Scaly-breasted Munia media.
- **Toggle ON** (subspecies forms shown) → link filters by the FORM's own subspecies-group code (e.g. `taxonCode=scbmun2` for "(Scaled)") = just that form's media.
- Statistics has NO subspecies toggle → always the species code (the OFF behavior). Species code is also the fallback wherever the form code can't be resolved (offline gaps, unmapped names).

## Blast radius
Not one species and not one page. Trigger condition: **any name with a trailing
parenthetical** (issf/subspecies-group, domestic-type, or identifiable form) — its
raw name misses the species-only code lookup. Verified against the bundled taxonomy:
every such name misses raw but resolves once normalized (Dark-eyed Junco (Oregon),
Yellow-rumped Warbler (Myrtle/Audubon's), Northern Flicker (Red-shafted), Fox
Sparrow (Sooty), Canada Goose forms, Mallard (Domestic type), Rock Pigeon (Feral
Pigeon), … 5008 form names carry codes). All four builders affected app-wide:
`SpeciesDetail.speciesTaxonCode`→`mlCatalogLink`, `LifeListTable` `mlUrl`/`mlUrlAll`,
`BirdingStats`→`mlCatalogUrl`.

## What done looks like
- OFF/no-toggle: all four builders emit `taxonCode={species code}` (never bare / `taxaName`) for form names — e.g. Scaly-breasted Munia (Scaled) → `taxonCode=nutman`. Resolved by normalizing the name before the code lookup (proven to work offline).
- ON (Species Detail + Multimedia only): link emits the FORM's issf code — Scaly-breasted Munia (Scaled) → `taxonCode=scbmun2` — filtering to that form's media. Requires a name→code lookup that includes non-species categories (issf/domestic); the codes already exist in the bundled snapshot's `byCode` (name→code is unique, zero collisions), but `/taxonomy/codes` currently filters them out → **needs a backend + Tauri-service lookup change (raises fix size).**
- Fallback to the species code whenever the form code is unresolved (offline gap, no toggle) — never a bare link, never `taxaName`.
- Verify live once: confirm `media.ebird.org/catalog?taxonCode=scbmun2` filters to the (Scaled) form (issf code accepted by the catalog). If it does NOT, the ON case degrades to species-level and the user is told.
- Consolidate: Species Detail's builder moves off legacy `search.macaulaylibrary.org` onto `media.ebird.org/catalog`, one `taxonCode`-preferring pattern.
