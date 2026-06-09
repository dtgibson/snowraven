# Media Statistics Expansion — ideation & proposal (Strategist)

Feature: `media-statistics-expansion` (feature lane). Goal: expand the Statistics
page's **Media** card beyond the current three Top-10 lists, using richer fields
from the Macaulay Library "My Media" export — including the user's headline ask,
**age/sex demographics**.

## Grounding (verified against the codebase)

- A real ML export carries **46 columns**; `parseMLExport.ts` reads **13**
  (catalogId, common/scientific name, format, date, locality, county, lat/lng,
  caption, media notes, observation details). Everything else is present but
  unparsed.
- The parser uses case-insensitive, header-indexed lookups and tolerates missing
  columns, so adding a field = one `findIndex` + one guarded `col()` read + one
  `MLExportRow` field. Order-independent; cannot break older exports.
- Current Media card (`BirdingStats.tsx:1693–1840`, data in
  `birdingStats.ts:584 computeMlStats`): a media-over-time line chart + three
  Top-10 lists (photo/audio/video) + an unused `totalPhotos`. Reusable
  primitives: `SectionCard`, `StatCell`, `BarRow`, `SubLabel`, `Divider`,
  `RankIcon`; recharts Bar/Pie/Line/Area already imported; media color tokens
  exist (`--sr-graph-photo|audio|video|media-total`).
- **Verification caveat:** the synthetic demo (`gen-demo-data.mjs`) leaves
  Age/Sex, Behaviors, ratings, Time, flags BLANK, so those value FORMATS
  (delimiter, vocabulary, rating scale, truthy token) are assumptions until
  checked against a real export.

## Tier 1 — quick wins (NO parser change; render now, even on demo data)

1. **Documented Life List score + per-format coverage** — "X of Y life birds
   documented with media (Z%)", plus % with a photo / audio / video. Collapsible
   "needs media" list. (Common Name × Format, joined to the eBird life list.)
2. **Format-gap targets** — "audio targets" (have photo, no audio) and "photo
   targets" (have audio, no photo). The most actionable media to-do list.
3. **Media completeness mix + single-asset species** — donut of photo+audio+video
   / photo-only / etc., plus a re-shoot list of one-asset species.
4. **Media history headline row** — total assets, format split (uses the unused
   `totalPhotos`), distinct species, first/latest, span, busiest media day,
   streak/dry-spell, by-year + 12-month seasonal bars.
5. **Top media patches & counties** — localities/counties ranked by assets +
   distinct species (the media analog of Top Locations).

## Tier 2 — needs a small `parseMLExport.ts` extension (the Age/Sex centerpiece)

1. **Age-class & sex mix** — two donuts (Adult/Immature/Juvenile/Unknown;
   Male/Female/Unknown), Unknown shown explicitly, coverage caption. *(Age/Sex)*
2. **Per-species demographic coverage + only-adults gap targets** — the novel,
   actionable answer to "do I have adult AND juvenile?": ranked species whose
   media is 100% adult. *(Age/Sex × Common Name × Format)*
3. **Demographic annotation rate** — "% of media aged / sexed" — Data-Quality
   style; ship FIRST within the Age/Sex work (presence/absence is format-robust).
4. **Most-captured behaviors + breadth** — top behaviors, distinct-behavior
   count, behavior-rich species. *(Behaviors)*
5. **Breeding behaviors documented (media-backed, tiered)** — distinct species
   with media showing breeding behavior, tiered like the Breeding card via a
   keyword classifier. *(Behaviors)*
6. **Community rating distribution + top-rated + coverage** — histogram, mean,
   rated-vs-unrated, a confidence-floored leaderboard. *(Avg Community Rating,
   Number of Ratings)*
7. **Temporal demographics & seasonality** — juvenile-by-month, dawn-chorus
   audio vs golden-hour photo "media clock", behavior phenology. *(Age/Sex,
   Behaviors, Year/Month/Day, Time)*

## Tier 3 — stretch (cross-dataset joins / taxonomy cache / a third map)

Taxonomic breadth (families/orders documented); documentation rate by region
(media documented ÷ recorded per state); media footprint map (lat/lng heatmap);
documentation lag (days from first sighting to first media); resolution/gear
evolution + doc-flags + background-species shadow list.

## Recommended MVP

- **Age/Sex trio:** annotation rate → age & sex donuts → only-adults gap targets.
- **Three Tier-1 wins:** documented-life-list + format coverage; format-gap
  targets; media history headline row.

## Parser changes for the MVP

Add to `MLExportRow` + `parseMLExport.ts` (+ mirror in the test): `Age/Sex` (raw
+ normalized {ageClass, sex}); `Year`/`Month`/`Day` (numeric; base temporal
stats on these, not Date substrings); `Average Community Rating` + `Number of
Ratings` (when ratings land). Guardrails: blanks → explicit Unknown bucket,
coverage captions, `BirdName` for every species, new color tokens in both themes.

## Phased plan

- **Phase 0 (gate):** verify Age/Sex + Behaviors delimiters/vocabulary, rating
  scale, boolean token, Time format against a real export.
- **Phase 1:** Tier-1 wins (no parser change; visible immediately).
- **Phase 2:** parser extension + Age/Sex stats; extend `gen-demo-data.mjs` with
  synthetic Age/Sex so the showcase exercises them; docs/website/version bump.
- **Phase 3:** behaviors + ratings + media-by-state + time-of-day.
- **Phase 4:** Tier-3 stretch.

## Risks

Data sparsity (Age/Sex/Behaviors/ratings often blank — always show Unknown +
coverage); unverified formats (Phase 0 gate); demo data blank for Tier-2 (extend
generator in the same PR, synthetic only); privacy unchanged unless taxonomic
breadth adds a taxonomy fetch (online-only/cached); UI density (Media card is
already long — lead with headline tiles, group under SubLabels, collapse lists);
cross-dataset join drift by common name (disclose; capture eBird species code
later for exact joins).

## Open questions for the user

1. MVP scope agreement (Age/Sex trio + 3 Tier-1 wins)?
2. Age/Sex format: comma "Adult, Male"? how is unknown written? multi-individual?
3. Behaviors format/vocabulary + how often tagged?
4. Rating scale + how much of the library is rated?
5. Min-asset threshold for "only adults" (suggest 3+); show sex gaps for all
   species or opt-in (false gaps for monomorphic species)?
6. OK to extend the synthetic demo with fictional Age/Sex/etc. values?
7. Lean toward actionable target lists or retrospective charts?
