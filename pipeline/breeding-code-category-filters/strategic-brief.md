# Strategic Brief — Breeding Code Category Filters

## What We're Building

Category-level filter pills on the Breeding Codes tab — Confirmed, Probable, and Possible — that let the user see all species matching any code in that category with a single click, rather than selecting individual codes one at a time.

## Why Now

The Breeding Codes tab is fully functional but the individual-code filter model doesn't match how birders actually think about breeding evidence — they think in categories first (did I confirm this species?), codes second (which specific behaviour?). Adding category filters makes the tab immediately useful for the most common question without removing the granularity that expert users want. The underlying tier data already exists in `breedingCodes.ts`; this is additive work on a complete feature.

## The User Problem

To answer "which species have I confirmed breeding?" the user currently has to click up to 11 individual code pills — one for each Confirmed code that appears in their data. This is tedious and not obvious. Most users won't know which codes belong to which category unless they've memorised the eBird breeding evidence guide. Category filters surface the answer in one click and make the tiers visible in the UI rather than implied by pill colour alone.

## Success Criteria

- Clicking "Confirmed" shows every species with at least one confirmed breeding code recorded — without requiring any individual code pills to be active
- Clicking "Probable" or "Possible" works the same way for their respective code sets
- Multiple categories can be active simultaneously; a species must satisfy all active category filters (AND across categories, OR within each category)
- Category filters and individual code filters can be active at the same time and compose intuitively
- The existing individual code pills remain fully functional and unchanged in behaviour

## Scope

- Three category filter pills: Confirmed (tiers 3 + 4: NY NE FS FY CF FL ON UN DD NB CN), Probable (tier 2: PE B A N C T P M S9 S7), Possible (tier 1: S H F)
- Category filter logic: OR within category — species qualifies if it has ≥1 recorded observation for any code in the selected category
- Cross-filter composition: AND between active categories, AND between active categories and active individual code pills
- Pill placement: category pills appear before the individual code pills in the filter row, separated visually
- "All" resets both category filters and individual code filters

## Out of Scope

- Renaming or redefining the existing tier/category structure
- Changing the colour scheme or tier assignments
- Any changes to the Breeding Code table columns or sort behaviour
- Filter state persistence across sessions

## Key Decisions

- Categories map to eBird's three evidence levels: Confirmed = tiers 3 + 4, Probable = tier 2, Possible = tier 1 (consistent with how eBird labels them)
- Category filter logic is OR-within-category, not AND — selecting "Confirmed" means "has any confirmed code," not "has all confirmed codes" (the latter would almost always return zero results)
- Individual code pills remain unchanged in behaviour; category pills are additive, not a replacement
- "All" pill clears everything — categories and individual codes — as it does today
