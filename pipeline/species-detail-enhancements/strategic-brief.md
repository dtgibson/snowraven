# Strategic Brief — Species Detail Enhancements

## What We're Building
Three targeted additions to the Species Detail tab: weekly graph intervals (with monthly as the new default, ordered Weekly / Monthly / Yearly), a Checklists Over Time graph alongside the existing Individuals graph, and a frequency statistic showing on what percentage of the user's checklists a species appears.

## Why Now
The Species Detail tab is already the most analytically rich part of SnowRaven, and these additions follow naturally from what's already there. None require new data sources or backend work. Each answers a question a birder would naturally have when looking at a species — and the answers are already sitting in the loaded eBird backup.

## The User Problem
The tab can tell you when you saw a species and how many individuals you counted, but not how commonly it appears relative to your overall birding. A user looking at American Robin has 45 checklists for it — but is that 90% of their outings or 5%? And the current yearly/monthly graph resolution makes seasonal patterns in common species harder to see than weekly would.

## Success Criteria
- Graph Options shows Weekly / Monthly / Yearly (in that order), Monthly selected by default and on species change
- Weekly interval produces one data point per ISO calendar week with gap-fill between first and last sighting
- A frequency stat appears naturally near the checklist count in the Sightings section: what percentage of the user's checklists the species appears on
- A "Checklists Over Time" graph card appears alongside the existing "Sightings Over Time" graph, using the same interval and view-mode settings
- All three changes respect active county and date-range filters

## Scope
- `graphInterval` state type extended to `'weekly' | 'monthly' | 'yearly'`; default changed from `'yearly'` to `'monthly'`; `selectSpecies` reset updated to match
- `buildGraphData` in `sightingsGraph.ts` adds ISO week key support (`YYYY-Www`) with weekly gap-fill
- `GraphPoint` gains a `checklists` field (count of observations per period)
- Graph Options card toggle order updated to Weekly / Monthly / Yearly
- "Checklists Over Time" card renders below "Sightings Over Time," sharing `displayData`
- Frequency denominator: unique submission IDs in the active filter scope across all species (filter-aware, consistent with the rest of the tab)
- All changes are frontend-only

## Out of Scope
- Frequency ranking or comparison across species
- Weekly interval changing the Media Over Time graph in any special way (it shares the setting — sparse weeks will show zeros, which is fine)
- Backend changes of any kind

## Key Decisions
- Weekly keys use ISO week format (`YYYY-Www`) — sortable and unambiguous
- Monthly becomes the default interval rather than yearly — it gives a better first view for most species without any user action
- Frequency uses the filtered scope as denominator so it stays consistent with all other stats on the tab when county/date filters are active
- Checklists graph shares `displayData` with the Sightings graph, so cumulative mode works for both automatically
