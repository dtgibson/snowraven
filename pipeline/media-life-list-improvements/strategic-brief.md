# Strategic Brief — Media Life List Improvements

## What We're Building
Three targeted corrections to the Media Life List tab: rename the "Seen" column to "Media", replace per-media-type checkmarks with actual item counts, and stop excluding soundscape entries from the list.

## Why Now
The Media Life List shipped recently and is a core part of SnowRaven's identity as a birding tools app. These fixes address specific inaccuracies in the current design — a column label that's wrong for audio-only entries, checkmarks that throw away quantitative information birders care about, and a filter that silently drops real Macaulay Library records.

## The User Problem
A birder uploading their Macaulay Library export expects the result to accurately reflect everything they've recorded. "Seen" doesn't describe a species they only heard. A checkmark in the Photo column doesn't tell them whether they have one photo or fifty. And soundscape recordings are legitimate Macaulay Library contributions that currently vanish without explanation.

## Success Criteria
- The column label is accurate for species recorded as audio-only
- Photo, Audio, and Video columns show item counts, giving a richer picture of media coverage per species
- Soundscape entries appear in the list and behave like any other entry — filters, sort, and display all work correctly for them
- No existing behaviour is broken for users on the eBird backup CSV path

## Scope
- Rename "Seen" column header to "Media"
- Replace checkmarks in Photo/Audio/Video columns with per-species item counts; zero remains a dash
- Remove the soundscape exclusion from the ML export parser
- Update the affected parser test to reflect the new behaviour

## Out of Scope
- Changes to the filter pills (the existing pills apply naturally to soundscape entries)
- New columns or layout changes
- Any changes to the eBird backup CSV path or its display

## Key Decisions
- Soundscape entries display under whatever name they carry in the ML export (typically "Soundscape")
- Zero-count columns show a dash, not the number 0 — consistent with the existing visual language
- The "Media" column (formerly "Seen") keeps its checkmark; every entry on the list has at least some media
