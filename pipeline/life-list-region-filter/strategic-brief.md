# Strategic Brief: Life Lists Region Filter

## What We're Building
A Region control on the **Life Lists** tab (`life-lists` in `TAB_LABELS`; not Multimedia) that narrows the list to one eBird region the user has birded, a country, state/province or county, and shows that region's life list: the species first seen there, dated to the first sighting inside it.

## Why Now
Life Lists just shipped as a world list with exotic, escapee and media controls, and the first thing an eBird user asks of a life list is "what about my county?". The user asked for it directly. It is not on the roadmap's Up Next, which is fine: it is a small extension that reuses the tab's existing passes.

## The User Problem
A birder keeps several life lists in mind at once: the world, the state, the home county. The tab shows only the world list, so the regional first date, checklist and place are invisible, and the global first date is the wrong answer when a species was first seen elsewhere. The answer has to come from the user's own backup, offline.

## Success Criteria
- Choosing a region lists exactly the countable species with an observation inside it, each dated to its earliest in-region observation with that observation's time, checklist and place; a species first seen outside the region never shows its global date.
- The choices offered are only places in the user's backup, grouped country, state/province, county; a county is keyed by state and county together.
- The unfiltered state restores today's list exactly; positions number 1 from the oldest row of the current selection, as now.
- Include Exotics and Include Escapees keep their meaning; the region only changes which rows they act on.
- Photo, Audio and Video lists under a region are dated to the first asset whose linked eBird checklist lies inside the region; an asset with no checklist id, or whose checklist is not in the backup, counts only unfiltered.
- The chosen region survives a relaunch on the same device; a saved region absent after a file replace falls back to unfiltered silently.
- The count sentence and empty state name the region, announced through the existing live region.
- No third-party request, no new endpoint or host, no request moved between components; the one existing `/taxonomy/codes` post is unchanged.

## Scope
- The Region control in the control strip, with choices derived from the loaded backup (country from the State/Province prefix, state/province, county with state).
- Region-scoped first-sighting and first-asset passes over data already loaded.
- Persistence of the chosen region through the `storage` seam settings document, per device.
- Copy in `lifeListsCopy.ts`, the `docs/HELP.md` entry, tests in the tab's suites.

## Out of Scope
- Locations and hotspots as a filter level.
- eBird's region API, or region names and boundaries beyond the backup's own cells.
- Polygons, radius filters, multi-select, multi-region comparison, export.
- Changes to Statistics, Targets, Multimedia, any other tab, or the provenance pass.
- Carrying the preference across devices by iCloud Sync.

## Key Decisions
1. **Country, state/province, county, from the backup only**: eBird's hierarchy, and every cell is already parsed (`stateProvince`, `county`); locations are out because a per-location list is a different object.
2. **One region at a time**: a single regional life list is what eBird users mean, and multi-select has no single first-date meaning.
3. **Regional first-date semantics**: the earliest observation inside the region, not the global first filtered by place, because that is eBird's regional life list; positions renumber within the selection as they already do (FR-42).
4. **Media firsts scope by the asset's linked checklist**, resolved through the backup's `stateProvince` and `county`, because the ML export has no state column and its county alone is ambiguous; an unlinked asset is excluded rather than guessed.
5. **Persist per device through `storage.setSetting`**: the user called it a setting, and a home-county list is a durable interest; the Exotics and Escapees switches stay session-only (QA-38).
6. **Composition**: the region narrows the observation set before the switches and media selection apply, so their meaning is unchanged.
7. **No network, in the durable form** (no third-party request, no new endpoint or host, no request moved between components): everything is in the two loaded files.
8. **Naming is the Designer's**: "Region" with an "Everywhere" default is the recommendation; the Targets county picker is the in-house precedent.
