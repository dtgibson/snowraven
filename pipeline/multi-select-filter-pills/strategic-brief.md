# Strategic Brief — Multi-Select Filter Pills

## What We're Building
Filter pills on the Media List and Breeding Codes tabs become multi-selectable. Multiple active filters combine with AND logic — a species must satisfy every selected filter to appear. Selecting a contradictory filter (e.g. "Has photo" while "No photo" is active) automatically replaces the conflicting one.

## Why Now
Both tabs have fully-built filter surfaces that currently enforce single selection. The list features are mature enough that composable filters are the obvious next step — especially for a birder doing gap analysis or studying their breeding code coverage across specific codes.

## The User Problem
A birder who wants to find species missing both a photo and an audio recording currently has to filter twice and mentally intersect the results. On the Breeding Codes tab, there's no way to ask "which species have I recorded both as confirmed nesting and carrying food?" Multi-select answers both questions with one interaction.

## Success Criteria
- On the Media List: selecting "No photo" + "No audio" shows only species missing both — not species missing either one
- On the Breeding Codes tab: selecting NY + CF shows only species where both codes have been recorded
- Selecting a contradictory pill (e.g. "Has photo" when "No photo" is active) replaces the conflicting selection automatically — no manual deselection required
- Toggling an already-active pill deselects it
- "All" clears all active filters regardless of how many are selected
- The species count label stays accurate under multi-filter combinations

## Scope
- Media List filter pills: multi-select with AND logic; incompatible pairs (no photo/has photo, no audio/has audio, no video/has video) auto-replace each other
- Breeding Codes filter pills: multi-select with AND logic; no incompatibilities (all code pills are compatible with each other)
- "All" pill always resets to unfiltered

## Out of Scope
- Life List Comparer tab (its controls are sort toggles, not inclusion/exclusion filters)
- Saving or bookmarking filter combinations
- Filter presets (e.g. "All confirmed codes")
- Any new filter types beyond those already present

## Key Decisions
- AND logic on both tabs — a species must satisfy every active filter
- On the Media List, "no" and "has" for the same media type are mutually exclusive; selecting one replaces the other
- All code pills on the Breeding Codes tab are mutually compatible
- "All" is a reset, not a toggleable filter alongside others
