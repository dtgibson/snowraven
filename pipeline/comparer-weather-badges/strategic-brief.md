# Strategic Brief — comparer-weather-badges

## Feature
Enrich the Checklist Comparer's **Checklists** mode (comparing two individual eBird
checklists by ID/URL) with (1) at-a-glance **badges** per checklist and (2) a fresh
**weather + tide** lookup shown side by side.

## Why it's worth building
The Checklist Comparer already parses both checklists' species, media, breeding codes,
effort, and comments, but surfaces none of it as a summary and has no weather dimension.
SnowRaven already owns a polished weather + tide lookup. Surfacing the existing richness as
badges and adding weather/tide is a high-fit, mostly-reuse extension that answers the
natural question when comparing two outings: "what does each list have, and what were the
conditions?"

## In scope (v1)
- **Per-checklist badges** on the top info cards:
  - Media-type presence — photo / audio / video (from already-parsed media data).
  - Breeding-codes-reported indicator (any breeding code present on the checklist).
  - "Weather block detected in comment" icon — heuristic scan of the checklist comment for
    raincrow / snowraven weather-block markers.
- **Weather + tide section** (bottom of the comparison): a fresh lookup for each checklist,
  side by side. Both weather AND tide.
- **Reconciliation note (always-note):** whenever BOTH a fresh lookup and an embedded
  weather block in the comment exist, show a note that OpenWeather revises historical data
  over time and SnowRaven serves what the API currently returns. No value-by-value diff.

## Decisions (locked)
1. **Always-note** — show the revision note whenever a fresh lookup and an embedded weather
   block coexist (no value-by-value diff in v1).
2. **Include tides** in the comparison, not weather-only.
3. **Graceful degradation** — badges always work (client-side parsed data). The weather/tide
   section needs the eBird + OpenWeather keys; when absent, show an "add keys in Settings"
   nudge instead of the section. The comparer keeps working without them.

## Out of scope (v1)
Editing/auto-fixing the comment's weather; weather charts; more than two checklists;
value-by-value weather diffing.

## Success criteria
- Comparing two checklists shows, at a glance, which media types and breeding codes each has
  and whether a weather note is embedded in the comment.
- A clear side-by-side of actual weather + tide for each checklist, with an honest revision
  note when a fresh lookup coexists with an embedded weather block.
- Degrades cleanly without API keys (badges still work; weather section nudges to Settings).

## Risks
- Comment-format heuristic fragility (weather-block detection) — acceptable as an indicator.
- API-key dependency for the weather section — handled by graceful degradation.
- Two extra weather/tide lookups per comparison — bounded, on user action only.
