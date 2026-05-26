# Strategic Brief — Stats Enhancements

## What We're Building

Six targeted improvements to the Birding Statistics tab: renaming and splitting the one-and-done section, adding eBird links to nemesis birds, expanding milestone coverage, fixing the streak algorithm, adding per-year species stats, and adding a numbered top-locations map in Geographic Stats.

## Why Now

The Statistics tab is the most-used data view in SnowRaven. These improvements make existing data either more meaningful (streak fix, per-year species) or more actionable (nemesis links, richer milestones). None require new data sources — everything builds on what's already parsed and displayed. Shipping them together keeps the tab consistent rather than patchy.

## The User Problem

Several existing statistics are subtly misleading or incomplete. The streak counter measures something ambiguous. The milestone pills stop at 1,000 and only fire every 50 species, which misses the excitement of smaller milestones early on. Nemesis birds are named but not clickable, leaving the user to look them up separately. The per-year bar shows checklist count only, not species — a more meaningful measure of activity. The top locations lists are text-only, with no sense of where those places are relative to each other.

## Success Criteria

- "Single-checklist birds" shows species seen on exactly one checklist (current behavior, renamed)
- "One-and-done birds" shows species whose lifetime individual count is exactly 1 (new section below it)
- Every nemesis bird name links to its eBird species page
- Milestone pills fire more frequently below 1,000 and extend beyond it
- Longest streak counts calendar days with at least one submitted checklist
- The Checklists by Year section also shows species count and max species in a single day per year
- Geographic Stats includes a Leaflet map with numbered, color-coded, and shape-differentiated pins for the two top-locations lists

## Scope

- Rename existing "one-and-done" section to "Single-Checklist Birds"
- New "One-and-Done Birds" section: species where the sum of all recorded numeric counts is exactly 1 (presence-only `X` entries excluded)
- Nemesis bird names become `<a>` links to `ebird.org/species/{taxonCode}`; taxon codes resolved via existing `mlTaxonMap` or a fallback `POST /taxonomy/codes` fetch for non-ML users
- Milestone thresholds: every 10 from 10–100, every 25 from 100–500, every 50 from 500–1,000, then 1,250, 1,500, 1,750, 2,000, 2,500, and 3,000
- Streak algorithm verified/corrected to count consecutive calendar days with at least one checklist
- Per-year section: species count and best single-day species count per year alongside checklist count; best-day count links to the checklist when a valid submissionId exists
- Top Locations map: Leaflet `MapContainer` showing two numbered pin sets — top-10 by checklists (green circles) and top-10 by species (blue squares) — with a number label on each pin matching its rank in the corresponding list

## Out of Scope

- Any backend changes beyond what's needed for the nemesis taxon code fetch
- Sorting, filtering, or pagination of one-and-done birds
- Weekly or monthly streak breakdowns
- Map for counties or states (top locations only)
- Exporting or sharing any statistics

## Key Decisions

- "One-and-done" means total numeric individual count = 1 across all filtered observations. A species qualifies only if at least one numeric `count === 1` observation exists and no other observations push the sum above 1. Presence-only (`X`) entries don't contribute.
- Milestone schedule is denser at low numbers (every 10 below 100) to celebrate early progress, then widens as the list grows. Exact thresholds: 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400, 425, 450, 475, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000, 1250, 1500, 1750, 2000, 2500, 3000.
- Nemesis links use `ebird.org/species/{taxonCode}`. If `mlTaxonMap` is available, use it directly. For non-ML users, fire a `POST /taxonomy/codes` fetch after nemesis results arrive.
- Top locations map pins are numbered 1–10, with the number as a text label inside the marker SVG. Green circles = top by checklists; blue squares = top by species. Color + shape + number together ensure they're distinguishable without relying on color alone. A location appearing in both lists gets two overlapping pins (one of each type).
- Locations with no lat/lng in the eBird data are omitted from the map but stay in the text lists. The lat/lng mapping is built from `filteredObs` at render time.
