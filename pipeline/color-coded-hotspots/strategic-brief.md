# Strategic Brief — Color-Coded Hotspots

## What We're Building
Three optional color modes for the hotspot pins on the Map Explorer's Hotspots view: color each hotspot by (1) the number of species the user has personally reported there, (2) the number of checklists the user has reported there, or (3) how active the hotspot is right now — species reported by the whole eBird community over the last week or last 30 days. The existing visited / unvisited / personal coloring remains the default; the color modes are opt-in.

## Why Now
This comes straight from the user's saved idea, with an explicit priority marker on mode 3. The Hotspots view can already find and draw nearby hotspots (v0.5.0 onward, "Search this area" as of v0.5.91), but its pins only answer "have I been here?" — not "is this worth my time?" Nearly all the machinery exists: the loaded eBird backup already carries per-location species and checklist counts (modes 1 and 2 need no network at all), the county overlay proved out data-driven quantile ramps with contrast-guarded tokens and a colorblind Use Textures mode, and County Completeness (v0.5.54) established the pattern for bounded, cached, honestly-degrading community-data lookups. Mode 3 is the one genuinely new capability, and it is the one the user flagged as most important.

## The User Problem
A birder deciding where to go next is choosing among hotspots, and the map gives them no basis for the choice. They want two different answers from the same pins: where their own coverage is thin or deep (personal species and checklist counts — the gap-finding view), and where birds are actually being seen this week (community activity — the "where is the action" view). Today that means clicking through hotspots one at a time on eBird's own site. The pins are already on the map; they should carry the answer.

## Success Criteria
- On the Hotspots view, the user can switch among the default visited-state coloring and the three color modes; pins recolor accordingly and a legend explains the scale in effect.
- Modes 1 and 2 work fully offline, computed from the already-loaded eBird backup, with no network calls beyond the hotspot fetch itself.
- Mode 3 offers a last-week / last-30-days choice and colors hotspots in the current result set by recent community species activity, so the most active hotspots visibly stand out.
- Mode 3 degrades honestly: offline, missing eBird key, and lookup-failure states each say what is wrong (the app's established distinct-states convention), and previously-fetched results still render where the caching pattern allows.
- A hotspot with no data in the active mode is visually distinct from a low-value hotspot — "never birded by me" or "no recent reports" never masquerades as "zero-ish".
- The coloring reads without depending on hue alone (colorblind-safe path, per the Use Textures precedent) and meets WCAG AA in both themes, guarded at the token per repo convention.
- Existing behavior is untouched when no color mode is selected: the visited / unvisited / personal legend and pin interactions work exactly as before.

## Scope
- The Hotspots view of the Map Explorer only.
- Three color modes plus the unchanged visited-state default; a mode selector in the Hotspots panel.
- Legend updates for the active mode; the hotspot popup surfaces the number driving the pin's color.
- Mode 3's time window control (last week / last 30 days), consistent with the existing Time Range filter vocabulary.
- Bounded, cached community-activity fetching for mode 3, scoped to the hotspots in the current result set — never a regional bulk sweep.
- Honest offline / no-key / error degradation for mode 3.
- Accessibility parity: contrast-guarded ramp tokens in both themes and a color-independent reading.

## Out of Scope
- Other map views (My Sightings, Nearby Lifers, Media Targets) and the Species Detail / Statistics maps.
- The county and atlas overlays — unchanged, including their mutual-exclusion rules.
- Any new data provider. Mode 3 uses eBird only, device-to-provider with the user's own key.
- Ranking, recommendations, or a "best hotspot" score — the pins carry the numbers; the user makes the call.
- Per-species activity ("where is X being seen") — that is Nearby Lifers / Media Targets territory.
- Bulk pre-fetching or background sweeps of hotspots not in the current result set.

## Key Decisions
- **Mode 3 (community activity) is the priority.** The user marked it "most importantly." If build trade-offs force sequencing, modes 1 and 2 are the cheap half — mode 3 is the point of the feature and must not be the part that gets thinned.
- **Modes 1 and 2 are offline computations** over the loaded backup's per-location counts (joined on the hotspot's location id, the same id the backup and `ref/hotspot/geo` share). **Mode 3 requires live eBird data** and must degrade honestly — distinct offline / no-key / error states, never a silently wrong or empty coloring.
- **The exact eBird mechanism for mode 3 is the Architect's decision** (recent-observations aggregation vs. per-hotspot lookups vs. another eBird product). The strategic constraints are fixed: bounded network use following the County Completeness precedent (in-view / in-result-set only, a few at a time, cached, never a bulk sweep), the user's own key, no new providers, and the existing transport-seam dual-transport pattern.
- **Default unchanged, modes opt-in.** The shipped visited-state coloring stays the default so no existing workflow changes. Whether the chosen mode persists or is session-only follows the Planner's call against the repo's session-only-toggle convention.
- **A meaning-carrying ramp gets its own contrast-guarded tokens** (both themes, parse-the-tokens test) and a color-independent reading, per the county-ramp and Use Textures precedents. If numbers ride on the fill, the stricter text-on-fill contrast rule applies.
- **How personal locations (orange star) and the visited-state legend interact with an active color mode is a Designer/Planner decision** — flagged, not settled here.
- **Privacy posture:** mode 3 reads aggregate community data from eBird, the same class of call Nearby Lifers and County Completeness already make; no personal data leaves the device. The release leg should still check whether the request pattern changes anything PRIVACY_POLICY.md describes.
