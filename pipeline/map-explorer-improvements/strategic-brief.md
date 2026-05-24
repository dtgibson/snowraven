# Strategic Brief — Map Explorer Improvements
**Feature:** map-explorer-improvements
**Session:** 001
**Date:** 2026-05-23
**Stage:** 1 — The Strategist
**Status:** Draft (not yet approved)

---

## What problem does this solve?

**Problem 1 — Undifferentiated target list.** The Media Targets mode is designed to answer "what should I go photograph today?" But it currently shows every species missing *any* media — someone missing 40 photos, 12 audio recordings, and 8 videos sees all 60 targets mixed together. A birder heading out with recording gear has very different needs from one carrying a camera. Without a filter, the list is noisy and requires manual mental filtering that the app should do instead.

**Problem 2 — Personal hotspot radius bleed.** The Hotspots mode fetches public hotspots from the eBird API using the user's lat/lng/radius parameters — so public hotspots are correctly bounded. But "personal" locations (orange star pins) are derived from the stored eBird backup CSV: every location the user has ever visited appears, regardless of distance from the map center. A user who has birded across multiple states will see personal pins scattered far beyond the selected radius, creating a visually misleading map and obscuring the nearby locations the mode is meant to surface.

---

## Alignment with product vision

SnowRaven is a personal, self-hosted tool for a birder who takes their data seriously. The Map Explorer is the app's fieldwork-planning surface — it should help the user make a decision about where to go and what to look for. Both improvements directly serve that purpose:

- The target type filter makes Media Targets usable as a session-specific planning tool, not just a general list.
- The personal hotspot radius fix makes the Hotspots view accurate — users can trust that what they see on the map is actually nearby.

Neither change introduces scope beyond what the Map Explorer already does. They sharpen existing behavior rather than adding a new surface.

---

## Scope

**In scope:**

1. **Media target type filter** — A filter control in the Media Targets sidebar that lets the user select which missing media type(s) to show: All / Photo needed / Audio needed / Video needed. The filter applies to both the pin display on the map and the nearest-10 sidebar list. A species may be missing multiple types — a "Photo needed" filter shows all species missing a photo, regardless of whether they also need audio or video. Multi-select is the right model (the user might want "Photo needed AND Audio needed").

2. **Personal hotspot radius correction** — When displaying personal location pins on the Hotspots map, filter them to only include locations whose coordinates fall within the selected radius of the current center. Uses the haversine distance formula already present in `MapExplorer.tsx` (`distanceMiles()`). Locations in the eBird backup without coordinates are excluded.

**Out of scope:**
- Changing how the eBird API fetches hotspots
- Adding new media type categories beyond Photo / Audio / Video
- Applying the target type filter to the Statistics tab

---

## Key risks and tradeoffs

**Risk 1 — Filter state persistence.** The target type filter should reset when the user fetches new data (clicks "Find Sightings"), consistent with the existing pattern for the Last 30 Days / Last Week toggle resetting on fetch.

**Risk 2 — Personal hotspot coordinates.** The eBird backup includes `Latitude` and `Longitude` columns, already parsed by `parseEbirdObservations`. Personal location pins are grouped by `locationId`; their coordinates come from the first matching observation. If a personal location has inconsistent coordinates across observations (rare but possible), the grouping may be imprecise — acceptable given this is already a known limitation.

**Risk 3 — Personal hotspot count UX.** After the radius fix, users who've birded widely will notice their personal pins disappear when outside the current radius. The PRD should decide whether to include a "N personal locations outside radius" note or keep it simple.

---

## Success looks like

- A birder opening Media Targets can filter to "Photo needed" and see only species missing a photo, with the map pins and nearest-10 list both reflecting the filter.
- A birder whose eBird backup spans multiple states can enter their home county coordinates and see only personal locations within the selected radius — not all their life locations.
- No regressions in the existing Media Targets, Hotspots, or My Sightings modes.
