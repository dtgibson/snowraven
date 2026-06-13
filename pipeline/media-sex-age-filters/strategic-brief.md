# Strategic Brief — media-sex-age-filters

## What We're Building
Sex (Male / Female) and age (Juvenile / Immature / Adult) dropdown filters on the **Multimedia tab**, composable with the existing media filters. The displayed media count reflects the active age/sex selection, and the Macaulay Library links carry the filter so a click opens ML scoped the same way.

## Why Now
The Multimedia tab already surfaces per-species photo/audio/video coverage, and the Macaulay export already carries a per-asset **Age/Sex** field that SnowRaven already parses (today for the Statistics Media card). The data is on hand; there's simply no way to pull media up by those facets. With so many sexually dimorphic species and species whose juveniles look distinct, "show me my juveniles" or "the males of this species" is a natural, currently-missing slice.

## The User Problem
A birder wants to find and compare their own media by life stage or sex — all their juveniles, or the males of a dimorphic species to compare plumage — but the tab only filters by media presence/type. To isolate those today they'd leave the app and re-filter by hand in the Macaulay Library.

## Success Criteria
- From the Multimedia tab, filtering to a single facet (any female, any juvenile) shows exactly the media depicting it.
- Combining age + sex targets a specific individual type (juvenile female = assets with at least one juvenile-female bird), and composes with the existing media filters.
- The media count reflects the filtered selection (assets matching, not individuals).
- Each Macaulay Library link opens ML scoped to the active filter, as closely as ML's URL allows.
- Untagged media is simply excluded from a facet filter (you can only filter by what's annotated).

## Scope
- Two dropdowns: Sex (Male, Female); Age (Juvenile, Immature, Adult).
- Filters compose with each other and with the existing Multimedia filters (media presence / type).
- **Exact-combo matching:** an asset matches if it has at least one age/sex *group* satisfying all selected facets — sex-only matches any group of that sex (any age); age-only matches any group of that age (any sex); both selected requires a single group that is that age **and** sex.
- Count and the ML links both reflect the active filter.
- Built on the existing `ageSex` field + parser (`lib/mediaStats.ts`); no new data source.

## Out of Scope
- No changes to the export, ingestion, or the Age/Sex parser's vocabulary.
- No "Unknown" / untagged option in the dropdowns (untagged media is excluded from a facet filter, not a selectable category).
- No count-based matching (e.g. "2 males"); facets test presence of a matching group.
- No change to how media is embedded/displayed beyond the filtering, count, and link.

## Key Decisions
- **Exact-combo semantics** (Dave's call): a single facet stays broad (Female = any female); the two facets bind together only when both are set (Juvenile + Female = at least one bird that is both). Carry this to the matching function and the count.
- **ML-link fidelity:** the link carries the filter as far as the Macaulay Library URL supports. The Architect must verify ML's age/sex param names and behavior. Flag: ML may apply age/sex as *independent* facets, so a combined "juvenile female" ML link could be broader than the app's exact-combo in-app count — single-facet (the dominant use) matches exactly either way.
- **Surface:** the Multimedia tab (per-species photo/audio/video coverage). The Architect maps exactly how the filters, count, and links wire into that view.
