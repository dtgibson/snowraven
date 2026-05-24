# Strategic Brief — Birding Statistics Tab

## What We're Building
A new Statistics tab that surfaces comprehensive birding analytics from the user's stored eBird backup CSV and ML export. All computation runs client-side; one new backend endpoint supports regional frequency lookup for the Nemesis Birds section.

## Why Now
The eBird backup already loads and parses across three existing tabs — every date, location, count, checklist ID, county, and breeding code is available client-side without any new infrastructure. A Statistics tab requires only computation and display. The data is ready; it just needs a lens.

## The User Problem
eBird's own account page surfaces a handful of summary numbers and not much else. A backup CSV contains years of data that could reveal milestones, patterns, dry spells, and geographic scope — but only if the user is willing to export and build their own analysis in a spreadsheet. Most don't. A Stats tab makes those insights automatic.

## Success Criteria
- Life list totals are visible at a glance without scrolling
- Species milestones (50th, 100th, 500th…) surface the exact date and species
- Time-based histograms reveal birding patterns across hours, days, months, and years
- Geographic stats expose the user's most productive locations, counties, and states
- Effort stats reflect how checklist quality and duration have evolved over time
- All stats update when the stored eBird file is changed in Settings

## Scope
All seven categories as specified:

- **Life list totals** — species count, observations, checklists, time birded, distance covered, individual birds (real counts + separate X tally), unique locations and hotspots, geographic breadth (counties/states/provinces/countries), media counts by type from ML export
- **Firsts and milestones** — first checklist and observation, species milestones (1st, 10th, 50th, 100th, 200th, 500th, 1000th with dates), consecutive-day streaks and longest gap, five most-reported and least-reported species by checklist percentage, one-and-done birds (expandable)
- **Temporal stats** — histograms by year, month, day-of-week, and hour-of-day; species accumulation curve; new species added per year; busiest birding day; seasonal richness by month; average checklist start time by season
- **Geographic stats** — species count per location, county, and state; top locations by visits, time spent, and species recorded; observation map (scatter/heatmap); county/state checklist progress; new locations discovered per year; distance from default saved location
- **Effort and methodology** — average and total duration, distance, observer count; protocol breakdown (Traveling/Stationary/Incidental etc.); species per hour and per km; effort trends over time; complete-checklist ratio; average species per checklist by location and protocol
- **Data quality** — real count vs X proportion; biggest single-species counts; checklists with and without comments
- **Breeding stats** — species with confirmed breeding codes, category breakdown (confirmed/probable/possible), breeding observations by month
- **Fun derived stats** — most-photographed species by ML catalog count; Nemesis Birds (requires eBird API + default saved location); biggest dry spells between lifers; Big Year recap for any chosen year; Shannon/Simpson diversity indices per location

## Out of Scope
- Comparison against other users' data
- Exporting or sharing the stats view
- Real-time eBird data sync (analysis is of the stored CSV snapshot)
- Nemesis Birds when no default location is saved — shows a prompt instead

## Key Decisions
- **Settings-first** — no per-tab upload; data comes from the stored eBird backup and ML export; shows the standard setup guidance screen if no eBird backup is stored
- **Client-side computation** — all stat derivations run as `useMemo` hooks; no new backend processing except the Nemesis endpoint
- **One new backend endpoint** — `GET /stats/nemesis` accepts lat/lng/dist, calls the eBird regional species list API, and returns species the user hasn't recorded that are frequently seen in their area
- **Sectioned layout** — the tab renders as a series of named sections; no tabs-within-tabs; sections that need the default location show a prompt when it's not set
