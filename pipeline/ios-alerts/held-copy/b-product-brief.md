# Held proposal (b): the product brief's network sentences

NOT APPLIED. `product-brief.md` changes only on the user's express yes (PRD FR-45b, OQ-03). The two sentences the PRD names:

## 1. "What Success Looks Like" (line 18)

The sentence as it stands already covers the alert check without change ("network calls going directly from the user's device to the providers ... authenticated with the user's keys"), because the check is the existing eBird request with the user's own key. **Proposal: no change to this sentence.**

**Current text (unchanged):**

> Everything runs locally and offline-capable, with network calls going directly from the user's device to the providers (eBird, OpenWeather, OpenStreetMap/Nominatim, NOAA, the keyless map-tile hosts, and the Cornell Lab sites serving embedded Macaulay media and bird-link icons), authenticated with the user's own keys where keys are needed, on demand, plus, on iPhone and iPad, the scheduled refresh of a home-screen widget the user has placed (one eBird nearby-sightings request, with the user's key, about every 30 minutes at most).

## 2. The founding "Network calls" decision (line 35)

**Before**

> on demand or, for a home-screen widget the user placed on iPhone or iPad, on the widget's refresh schedule;

**After**

> on demand or, on iPhone and iPad, on a schedule the user turned on: a home-screen widget's refresh, or the Alerts check about hourly or about daily;

The durable form holds: no new provider, no new host, no third-party request; the one move is the eBird request into a native background check; nothing reaches the developer.
