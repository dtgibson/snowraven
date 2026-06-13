# Strategic Brief — Checklists Tab

## What We're Building
A new top-level **Checklists** tab: the home for your checklists as whole outings. Three sections — a searchable box of your checklist comments, a searchable box of your species comments across *all* species, and a filterable, expandable list of every checklist.

## Why Now
Every existing tab slices your data by species, media, place, or code — the checklist itself, the unit of every outing, has no home. Your written record is the least accessible part of your data: comments are findable only one species at a time (Species Detail) or media-only (Media Comments), and eBird itself offers no comment search at all. The plumbing this needs — parsed-once caches, the comment-search format, composable filter pills, Submission-ID grouping — already exists and just needs composing.

## The User Problem
You remember writing something — a behavior note, a named bird, an odd plumage — but not which species or which day, so today it's effectively lost. And re-finding a particular outing ("that complete checklist with media at...") means eBird's clunky checklist manager. There is no single place to browse and search what you actually wrote and did, checklist by checklist.

## Success Criteria
- Any comment you've ever written — checklist-level or species-level — is findable from one place in a few keystrokes.
- The checklist-comments box isn't drowned in pasted weather/tide blocks: hidden and unsearched by default, one toggle brings them back.
- Questions like "which checklists have breeding codes but no media" are answerable by composing filters, and every checklist links out to eBird.
- The tab opens instantly from already-loaded data and stays responsive expanded to the full list, even at thousands of checklists.

## Scope
- A new Checklists tab, registered everywhere tabs live (navigation, tab-order settings, in-app Help).
- **Checklist comment search** — last 10, expand to all, search/filter within, in the Species Detail comment-search format.
- **Species comment search** — same format across all species, each comment showing its species per the app's bird-name conventions.
- **All-checklists list** — first 10, expandable, with composable filters across the checklist-derivable categories (has checklist comments, has species comments, has media — including media *type* via the ML export join — has breeding codes, protocol, complete/incomplete; exact set finalized in the PRD from what the Multimedia and Breeding Codes tabs offer).
- **Weather/tide suppression toggle** — tab-wide, hides the blocks *and* excludes their text from search matching; default hidden.

## Out of Scope
- Checklist statistics and aggregates — they stay on the Statistics tab.
- An in-app per-checklist detail page — checklists link out to eBird, as elsewhere in the app.
- Any new network calls — the tab runs entirely from already-loaded local data.

## Key Decisions
- Search-and-browse only; statistics stay on Statistics. (The prior conversation's checklist-statistics-dashboard ideas are deliberately not part of this tab.)
- The weather/tide toggle applies to all three sections; when blocks are hidden their text is also excluded from search matching ("search matches what you see"); default hidden.
- Both comment boxes reuse the Species Detail comment-search format (cleanest extracted template: the Media Comments section + its pure filter helpers); filters borrow the Multimedia / Breeding Codes patterns.
- Media-type filters go beyond the prior conversation's CSV-only caveat by joining the ML export (catalog number → Photo/Audio/Video).
- Reference artifacts for downstream stages: `pipeline/checklists-tab/prior-conversation.md` (the checklist-statistics conversation that seeded this) and `pipeline/checklists-tab/codebase-research.md` (the mapped reuse surface: comment-search template, computeChecklists(), filter idioms, tab-registry footprint, and the missing weather/tide strip function).
