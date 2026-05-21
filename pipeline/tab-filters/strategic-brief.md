# Strategic Brief — Tab Filters

## What We're Building

County and date-range filter controls for the Breeding Codes, Media List, and Species Detail tabs, letting users narrow their data to a specific place and time window. A total media count column (Photo + Audio + Video) is added to the Media List table.

## Why Now

The data tabs now give users a rich view of their full eBird history. The natural next step is enabling temporal and geographic slicing — "What breeding evidence did I record in Hennepin County between 2022 and 2024?" The data is already parsed; these filters expose dimensions that are currently hidden.

## The User Problem

A birder's data spans many years and counties. Every tab currently shows the full all-time, all-location view with no way to narrow it. A user wanting to review a specific county's breeding season, or assess their media coverage from the last three years, has no path to that view today.

## Success Criteria

- User can select any county present in their data and the table or list updates immediately
- User can enter a custom date range (from/to) and the data filters to that window
- Both filters compose — county + date range show only matching observations
- County data is resolved for ML export files using the best available method (direct column → eBird backup cross-reference → Nominatim reverse geocoding)
- Media List shows a Total column summing Photo + Audio + Video per species
- All filters reset when a new file is loaded
- County dropdown is populated from data; date inputs accept free text or a picker

## Scope

- County dropdown on Breeding Codes tab
- Date range picker (from/to date inputs) on Breeding Codes tab
- County dropdown on Media List tab — all input paths; resolved via ML export column, eBird backup cross-reference, or Nominatim reverse geocoding in that order
- Date range picker on Media List tab — all input paths
- County dropdown on Species Detail tab
- Date range picker on Species Detail tab
- Total media count column on Media List (Photo + Audio + Video)
- All filters compose with each other and existing filter pills/sort controls

## Out of Scope

- Filters on the Weather or List Comparer tabs
- State/Province filter
- Saved filter presets
- Any UI beyond the dropdowns, date inputs, and total column

## Key Decisions

- **County source for eBird CSV:** read the "County" column directly — already present in MyEBirdData.csv
- **County source for ML export:** (1) read from ML export if a County column is present; (2) cross-reference loaded eBird backup by location name match; (3) Nominatim reverse geocoding on lat/lng — the Architect will determine which paths are available based on what the ML export actually contains
- **Date range = from/to inputs, not a year dropdown** — gives the user precise control; defaults to empty (all time)
- **"All" is always the default** — both filters default to showing everything; no behaviour change until the user acts
- **Dropdowns populated from data** — only counties present in the loaded file appear as options
