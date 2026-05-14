# Strategic Brief — Species Links

## Feature Overview

Wherever a species name appears in SnowRaven, follow it with two small favicon links: one to eBird (`ebird.org/species/{speciesCode}`) and one to Birds of the World (`birdsoftheworld.org/bow/species/{speciesCode}/cur/introduction`). Clicking either opens that species' page on the respective site in a new tab.

**Scope — where names appear:**
1. **Media Life List table** (`LifeListTable.tsx`) — common name + scientific name in each row. Already has `taxonMap` populated from the existing taxonomy lookup.
2. **Life List Comparer panels** (`SpeciesPanel.tsx`) — species names in the three result panels (Both, A Only, B Only). Currently has no taxon lookup — one needs to be added after the comparison result is computed.

**What changes:**
- A tiny `SpeciesLinks` inline component renders two favicon `<img>` elements wrapped in `<a>` tags, shown after the common name in each context.
- When a species code is available, both links are shown.
- When no code is available (soundscape entries, or species not found in taxonomy), no links are shown — no broken icons.
- Favicons are loaded from the sites directly; if a favicon fails to load the `<img>` is hidden via `onError`.
- The Life List Comparer needs a post-comparison taxon lookup, mirroring the pattern already used in the Media Life List.

---

## Strategic Alignment

SnowRaven is a personal tool for a birder who uses eBird. Every species on their list is something they want to learn more about, find on eBird, or read about in Birds of the World. Adding one-tap access to both resources from the list removes a lookup step that currently happens outside the app. The taxon code infrastructure to make this work already exists — this feature is primarily a UI addition on top of it.

---

## User Value

- **Instant species lookup** — tap the eBird icon to open the species account page with maps, photos, and checklists. Tap the BOW icon for the full ornithological account.
- **Zero friction** — no searching required, no copy-pasting names. The correct species page opens directly.
- **Works for the whole app** — both the Media Life List and the Life List Comparer benefit, making the behavior consistent wherever species names appear.

---

## Risks and Constraints

- **Taxon code availability** — species codes are only available after the background taxonomy fetch completes. Links appear once codes arrive; before that, no icons are shown (no broken state).
- **Life List Comparer path** — the Comparer currently has no taxon lookup. Adding one requires triggering `POST /taxonomy/codes` after a comparison is computed, using the species names from the result.
- **Favicon reliability** — favicons are loaded from external domains. An `onError` handler hides failed images to avoid broken icon states.
- **Soundscape entries** — no species code → no links shown. This is correct behavior.
- **BOW coverage** — Birds of the World covers most species but not all. The link will always be formed if a code exists; coverage gaps are BOW's concern, not SnowRaven's.

---

## Out of Scope

- All About Birds links (no reliable species-code URL format)
- Any third-party favicon proxy service
- Prefetching or caching favicon images
- Any change to the taxonomy lookup itself
