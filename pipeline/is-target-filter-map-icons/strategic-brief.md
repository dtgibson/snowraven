# Strategic Brief — Is Target Filter and Map Icons

**Feature:** is-target-filter-map-icons
**Session:** 001
**Date:** 2026-05-23
**Stage:** 1 — The Strategist
**Status:** Approved

---

## Problem Statement

SnowRaven currently defines "media targets" as species with zero Macaulay Library entries of any kind. This is too coarse. A birder who has photos of a species but no audio recording still has a meaningful gap — they need a specific media type, not just any media. The app should help users understand and act on per-type gaps, not just all-or-nothing absence.

Additionally, the connection between the Media List tab (where all media coverage is visible) and the Map Explorer's Media Targets mode (where targets can be found in the field) is invisible. There is no way to navigate from one to the other with context preserved.

---

## Proposed Solution

Two coordinated changes to make the "Is Target" concept first-class:

1. **Media List tab — "Is Target" filter pill.** A new pill labeled "Is Target" appears to the right of "Has Media" in the filter bar. It shows every species missing at least one media type (Photo, Audio, or Video). This reframes the Life List as not just a record of what you have, but a checklist of what you still need.

2. **Map Explorer — per-species target icons and cross-tab navigation.** In Media Targets mode:
   - Each pin label shows small icons indicating which specific media types are missing for that species (Photo / Audio / Video).
   - The "N target species" count in the sidebar becomes a clickable link that switches to the Media List tab with "Is Target" pre-applied.

---

## Expanded Targeting Model

This feature requires changing how "Is Target" is defined:

- **Current:** species in the eBird backbone with zero ML entries of any type
- **New:** species in the eBird backbone that are missing at least one of Photo, Audio, or Video

This means species with partial ML coverage (e.g., photos but no audio) become targets for the first time. The `mediaTypes` map already tracks what types each species HAS; computing what it's MISSING is straightforward.

---

## Why Now

The maintain session just shipped pill-shaped labels on target map pins — those labels are ready to carry icons. The "Is Target" concept is already implicit in the product; this makes it explicit and actionable across both the list and the map.

---

## Out of Scope

- Backend changes — all targeting logic is client-side
- Sorting by target status within the Media List
- Audio or video playback directly in the app
- Filtering map pins by specific missing media type (show-all-targets only)
- Any changes to the My Sightings or Hotspots map modes
