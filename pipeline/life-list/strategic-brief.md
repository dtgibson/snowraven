# Strategic Brief — Life List
**Feature:** life-list
**Session:** 001
**Date:** 2026-05-12
**Stage:** 1 — The Strategist

---

## The Opportunity

A life list is every birder's foundational record — every species seen, once. eBird tracks this automatically but its UI doesn't answer the questions serious birders ask: "Which lifers have I never photographed? Which ones am I still missing audio for?" birdstat.com proves this data is accessible and that birders want it. This feature brings that capability into SnowRaven, privately, with data the user already owns.

## The ML API: What the Research Confirmed

The Macaulay Library search API returns a `mediaType` field with values `"Photo"`, `"Audio"`, and `"Video"` per catalog number. The eBird backup CSV contains ML catalog numbers for every media submission. These two facts together make photo/audio/video tracking fully achievable.

The one constraint: the ML API returns 403 when called directly from a browser (CORS). **Solution: a thin backend proxy.** The FastAPI backend calls the ML API server-to-server — no CORS issue, no API key required — and returns a `{catalogId: mediaType}` map to the frontend.

This feature requires a small backend addition alongside the frontend work.

## Architecture

**Frontend (new tab — Life List):**
- Drag-and-drop eBird backup CSV (`MyEBirdData.csv`)
- Parse: one entry per species (life list), collecting all ML catalog numbers per species across all observations
- Send catalog numbers to backend, receive media type map
- Render life list with four status columns: Seen · Photo · Audio · Video
- Filter bar: All · Missing photo · Missing audio · Missing video
- Sort: taxonomic order (from `Taxonomic Order` column) with alphabetical toggle
- Progress indicator while ML lookups run
- Reset / load new file button

**Backend (new endpoint):**
- `POST /ml/media-types` — accepts a list of catalog IDs, proxies to the ML search API, returns `{catalogId: mediaType}` map
- Processes in batches to stay within ML API limits
- No API key required

**Performance:**
- An active birder may have hundreds of ML submissions; batch processing with a progress indicator keeps the experience smooth
- Results cached in-session so filter changes are instant

## Scope

- New **Life List** tab in the existing tab bar
- Four status columns per species: Seen · Photo · Audio · Video
- Filter bar: All · Missing photo · Missing audio · Missing video
- Taxonomic sort (default) and alphabetical toggle
- Loading/progress state during ML lookup
- All media type data sourced from the ML API via backend proxy

## Out of Scope

- First-seen date, location, or other life list metadata
- Export of the filtered list
- Species not yet seen (list only shows species in the user's data)
