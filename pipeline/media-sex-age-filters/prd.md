# PRD — Media Sex & Age Filters

**Feature:** media-sex-age-filters
**Date:** 2026-06-13
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview
Add Sex and Age dropdown filters to the Multimedia tab (`LifeList.tsx`) so a birder can slice their Macaulay Library media by life stage and sex. The per-species media counts and the Macaulay Library links update to reflect the active filter, composed with the tab's existing media and location/date filters.

## User Stories
> **US-01** — As a birder, I want to filter my media to a single sex (e.g. Female), so I can see every species I have female media for.
> **US-02** — As a birder, I want to filter to a single age class (e.g. Juvenile), so I can pull up all my juvenile media.
> **US-03** — As a birder, I want to combine age + sex (e.g. Juvenile Female), so I can target media of that specific kind of individual.
> **US-04** — As a birder, I want the Sex/Age filters to work together with the existing media filters (Has media, Has/No photo·audio·video, Is Target) and the county/date filters, so I can narrow precisely.
> **US-05** — As a birder, I want each species' media counts to reflect the active Sex/Age filter, so the numbers match what I'm filtering for.
> **US-06** — As a birder, I want the Macaulay Library links to open ML scoped to the active filter, so clicking through shows the same subset.

## Functional Requirements

### Filters & UI
> **FR-01** — The Multimedia tab shall provide a **Sex** filter with a clear/"all" state plus options **Male** and **Female**.
> **FR-02** — The Multimedia tab shall provide an **Age** filter with a clear/"all" state plus options **Juvenile**, **Immature**, and **Adult**.
> **FR-03** — The Sex and Age filters shall compose (logical AND) with each other and with the existing media filters and the county/date filters.
> **FR-04** — Each filter shall have a clear/"all" state that removes that facet from filtering; the existing **All** reset shall also clear the Sex and Age filters.

### Matching semantics
> **FR-05** — An asset shall match the active age/sex selection by **exact-combo** rule: with only Sex set, any asset depicting that sex (any age) matches; with only Age set, any asset depicting that age (any sex) matches; with **both** set, an asset matches only if it has at least one age/sex *group* that is that age **and** that sex.
> **FR-06** — Matching shall reuse the existing Age/Sex parse in `lib/mediaStats.ts` (the per-asset `ageSex` string parsed into groups; a group satisfies a facet by token equality, so "Female" never matches "Male").
> **FR-07** — Assets with no age/sex annotation (or only `Unknown`) shall not match any active Sex or Age facet.

### Counts
> **FR-08** — When a Sex/Age filter is active, each species' per-media-type counts (photo / audio / video) shown on the tab shall reflect only the assets matching the active filter, composed with the active media-type filter.
> **FR-09** — The species-level count ("X of N species") and the set of species rows shall reflect the active Sex/Age filter: a species appears only if it has at least one asset matching the active filters (a species with zero matching media is hidden while a facet is active).

### Links
> **FR-10** — Each Macaulay Library link shall carry the active Sex/Age filter as URL parameter(s) so the opened ML catalog is scoped to the same facet(s), to the extent the ML catalog URL supports them.
> **FR-11** — Where the ML catalog URL cannot express a selected facet, the link shall still open the species/media-type catalog (degrade gracefully — never a broken or empty-by-construction URL).

## Non-Functional Requirements
> **NFR-01 — Performance:** The per-asset age/sex parse and the per-species filtered counts shall be memoized so filtering stays responsive on a large export (no re-parse of the whole export per render).
> **NFR-02 — Accessibility:** The Sex and Age controls shall each carry an explicit accessible name (aria-label) consistent with the tab's existing filter controls (the `Checklists.tsx` pattern), and be keyboard operable.
> **NFR-03 — Privacy:** No new network calls or data sources; the feature reads only the already-loaded ML export. ML links remain user-initiated navigations (no new auto-fetch), preserving the privacy policy.
> **NFR-04 — Consistency:** ML links shall continue to route through the shared `OutboundLink` / `mlCatalogUrl` helpers — no hand-rolled anchors.

## Out of Scope
- No changes to the export, ingestion, or the Age/Sex parser's vocabulary (from the strategic brief).
- No "Unknown"/untagged option in the filters — untagged media is excluded from a facet filter, not a selectable category.
- No count-based matching (e.g. "2 males"); facets test presence of a matching group.
- No in-app media gallery — actual images are still viewed via the Macaulay Library links (the tab shows counts + links, as today).
- No filtering on the eBird-observation side — age/sex annotation lives only in the ML export, not the eBird backup.

## Open Questions
- **OQ-01** — Does the Macaulay Library catalog URL accept age and sex parameters, and what are the exact param names/values? *Default assumption if unresolved by build:* carry whatever facets ML supports; if ML applies age/sex as independent facets, a combined "juvenile female" link may be broader than the in-app exact-combo count (documented, acceptable). The Architect verifies.
- **OQ-02** — Audio assets rarely carry age/sex. *Default:* no special-casing — an unannotated audio asset simply won't match a facet.
- **OQ-03** — Persist the Sex/Age selection across sessions? *Default:* session-local, like the existing media pills.

## Success Metrics
| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Sex filter present | The tab renders a Sex filter with Male and Female options plus a clear/"all" state |
| QA-02 | Age filter present | The tab renders an Age filter with Juvenile, Immature, Adult plus a clear/"all" state |
| QA-03 | Single-sex match is broad | With Sex=Female only, a species whose only female asset is an *adult* female still appears |
| QA-04 | Single-age match is broad | With Age=Juvenile only, an asset tagged "Juvenile Male" matches |
| QA-05 | Exact-combo match | With Age=Juvenile + Sex=Female: an asset tagged "Adult Female; Juvenile Male" does NOT match; an asset tagged "Juvenile Female" does |
| QA-06 | Composes with media filter | Sex=Male + Has photo shows only species with a male photo |
| QA-07 | Counts reflect filter | With Age=Juvenile active, a species' photo count equals its number of juvenile photos |
| QA-08 | Species list reflects filter | A species with no matching media is hidden; "X of N species" updates to match |
| QA-09 | Untagged excluded | An asset with empty/Unknown age/sex does not match any active facet |
| QA-10 | Links carry filter | With a facet active, the ML link URL includes the corresponding ML param(s); with no facet, the link is unchanged from today |
| QA-11 | Graceful link | A facet ML can't express still yields a valid species/media-type catalog link (no broken URL) |
| QA-12 | Accessible controls | Both filter controls have accessible names and are keyboard operable |
