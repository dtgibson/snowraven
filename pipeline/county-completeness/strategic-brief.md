# Strategic Brief — County Completeness

## What We're Building
A third county-shading metric on the Map Explorer's existing county overlay: shade each US county by how *complete* the user's county list is — their species recorded there divided by the total species ever reported for that county on eBird — with a county popup showing a progress bar (counts and percentage), the user's most recent new species added in that county, and the top target species they haven't recorded there yet.

## Why Now
The county overlay infrastructure this composes on just shipped and hardened across five releases (v0.5.46 lines + shading, v0.5.47 shading polish, v0.5.48 10-class ramp, v0.5.49 accurate boundary lines, v0.5.51 textures) — the boundaries, popup, legend, mutual-exclusion, and desaturation machinery all exist and this adds a metric, not a map. It also converts the overlay from a rear-view mirror ("where have I birded") into a forward-looking tool ("where should I bird next"), which deepens the alongside-eBird loop: the output of this feature is more eBirding.

## The User Problem
A county-listing birder knows how many species they've recorded per county but has no in-app way to see how that stacks up against what's actually been reported there — 120 species is near-complete in one county and barely started in another. Today answering "how complete am I, and what am I missing?" means county-by-county manual work on the eBird website. This puts the answer on the map they already use, with the chase list one click away.

## Success Criteria
- With a loaded eBird backup and an eBird API key, the user can switch county shading to a Completeness metric and see their birded counties shaded by percent complete, with a legend that reads as a 0–100% scale.
- Clicking a county opens the existing popup extended with: a progress bar, "X of Y species (Z%)", the last few species the user newly added in that county, and a short list of top target species (reported there, not yet recorded by the user there).
- Un-birded counties still render as plain outlines; clicking one can fetch and show its completeness and targets on demand.
- Offline or with no eBird key, the mode degrades honestly — a clear "needs an eBird key / you're offline" state consistent with the app's three-state messaging, never a blank or broken map; previously fetched counties may still shade from cache.
- Panning and revisiting counties does not re-hit eBird — per-county results are cached; no bulk all-US fetch ever happens.
- The existing Species/Checklists shading, atlas mutual exclusion, Use Textures mode, and basemap desaturation all keep working unchanged; Completeness participates in them as a peer metric.

## Scope
- The Completeness metric as a third option alongside Species/Checklists in the existing county shade control (Map Explorer only, US counties only).
- Per-county eBird data fetched device-to-provider with the user's own key: the county's all-time reported species list (the denominator) and the data needed to rank targets.
- Popup extension: progress bar + counts/percent, the user's ~5 most recent new-in-county species (derived from the loaded backup — works offline), and ~5 top targets (needs eBird data).
- Numerator from the loaded backup, keyed by the (state, county) composite the app already uses, with spuh/slash/hybrid excluded per the countable-species convention.
- Caching of per-county eBird results with a long staleness bound (county species lists change slowly); bounded, on-demand fetching.
- Graceful offline/no-key degradation, plus the honest disclosure that this one shading mode — unlike the existing ones — needs network + an eBird key (in-app cues, HELP.md, README, website).
- Full dual-transport parity: identical behavior on desktop (Tauri) and web/Pi (FastAPI).

## Out of Scope
- Non-US counties (the overlay is US-only; separate roadmap item).
- The per-species county choropleth ("where have I seen Acorn Woodpecker") — separate roadmap item, different feature.
- County shading on the Species Detail and Statistics maps — separate roadmap item.
- Any new third-party provider or new API key (eBird only, already disclosed in PRIVACY_POLICY.md).
- Completeness for regions other than counties (states, hotspots).
- Historical/time-sliced completeness (e.g., year lists, month lists) — all-time only for v1.
- Persisting the shading choice across relaunch (shade state stays session-only, matching the existing convention).

## Key Decisions
- **US counties only.** eBird county regions are subnational2 codes (e.g. US-CA-085); the overlay's existing county→eBird-region mapping is the join. Counties without a resolvable region code render without completeness rather than guessing.
- **Completeness = user's countable species recorded in the county ÷ total species eBird reports for that county, all-time.** Numerator uses `isNonCountableSpecies` (spuh/slash/hybrid excluded). The Architect must make numerator and denominator taxonomically comparable — both sides counting species-level taxa the same way — or the percentage lies.
- **Shading uses fixed percentage bands, not quantiles.** Unlike the count metrics, "50% complete" has absolute meaning; a fixed 0–100% band mapping (reusing the existing 10-class ramp and its texture/contrast guards) keeps the legend honest and lets Use Textures work unchanged.
- **Eager shading is bounded to birded counties in view; un-birded counties are click-to-fetch.** This keeps fetch volume proportional to the user's actual counties (not the ~800-county viewport cap), preserves the "plain outline = never birded" read, and still serves the "what's in this new county?" question on demand.
- **Online/key trade-off accepted and surfaced honestly.** This is the first county-shading mode that cannot work fully offline — the denominator and targets are eBird-side. That is consistent with the founding decisions (device-to-provider, user's own key, eBird already disclosed), but the mode must degrade to the app's standard offline/no-key/error states and the docs must say so plainly. Recent-new-species in the popup comes from the local backup and works offline regardless.
- **"Top targets" intent: the species a birder would actually chase** — reported in the county, absent from the user's county list, ranked by how findable they are (frequency/recency of reports). Which eBird endpoint(s) best support that ranking is an Architect decision; a plain unranked slice of the county list is the acceptable floor, a likelihood-ranked list is the goal. Target names render per BirdName conventions (favicons; Species Detail link only when the species is in the user's backbone).
- **Caching is a product requirement, mechanism deferred.** Per-county results cached with a generous TTL, deduped across pans, never bulk-prefetched — the Architect picks the layer (transport cache vs. storage seam) and the exact bounds.
- **No new providers, no privacy-policy change expected** — but the build must verify PRIVACY_POLICY.md's eBird disclosure already covers region-level species-list calls, and update it in the same change if not.
- **Peer-metric integration, not a parallel system.** Completeness slots into the existing shade control, mutual-exclusion helper (`nextShadingState`), legend, desaturation, and popup — extending v0.5.46's machinery rather than adding a second county overlay.
