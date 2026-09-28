# Copy proposal: Calendar overlays (README and website)

**Status:** declined by the user on 2026-09-26 (decisions.md O-04). Nothing was written. Nothing in `README.md` or `website/` has
changed. Per CLAUDE.md, this lands only after you read it and say yes, shown as
the rendered README and the served website page.

## The one proposed sentence

It replaces the Calendar section's second sentence rather than being appended,
so the section stays at the register's two sentences.

> Fold the years together, narrow it to a single species, or mark the days you
> brought home photos and recordings and the days you recorded breeding evidence.

## Where it goes

The same paragraph on both surfaces: the Calendar section's body.

- `README.md`, `### Calendar`, the paragraph under the heading.
- `website/index.html`, the Calendar feature row (`<!-- 5. Calendar: media right -->`), the `<p>` under `<h3>Calendar</h3>`.

## Before and after

**Before (both surfaces today):**

> A year of your birding as twelve month grids, each day shaded by how many
> species you saw. Fold the years together, or narrow it to a single species.

**After:**

> A year of your birding as twelve month grids, each day shaded by how many
> species you saw. Fold the years together, narrow it to a single species, or
> mark the days you brought home photos and recordings and the days you recorded
> breeding evidence.

## Why this wording

- Says what a birder gets, not how to get it: no switch names, no "turn on",
  nothing about defaults or persistence (that detail is in `docs/HELP.md`,
  which this build updated).
- Keeps the section's existing rhythm: the new clause extends the list the
  second sentence already makes, so nothing is re-sequenced.
- American spelling, no em dash, "photos and recordings" matches the Multimedia
  section's plain register.

## Alternatives, if the long sentence reads as crowded

1. Append instead (the section becomes three sentences): "It can also mark the
   days you brought home photos and recordings, and the days you recorded
   breeding evidence."
2. Leave both surfaces unchanged; the feature is fully described in the in-app
   help.

If this lands, `frontend/src/lib/calendarOverlaysPublishedClaims.test.ts` should
gain the README and website passages in the same change (its header says so).
