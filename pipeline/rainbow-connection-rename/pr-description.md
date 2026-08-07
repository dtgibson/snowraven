# Rainbow Connection Rename

## What this does
Renames the "Rainbow Warrior" Frivolous List (Statistics tab) to "Rainbow
Connection" in all live copy: the visible sub-list heading, the internal
`rainbowWarrior` result field (now `rainbowConnection` — verified pure
in-memory, never persisted), the code comments that name the list, and the
docs/HELP.md bullet. No behavior changes: the matching algorithm, layout,
color tokens, and aria-labels are untouched.

## How to test
1. `cd frontend && npm run dev`, open http://localhost:5173
2. Go to the Statistics tab, scroll to the Frivolous Lists section
3. The rainbow-colors card now reads "Rainbow Connection" (was "Rainbow Warrior")
4. Confirm the seven color rows, swatches, first-seen dates, checklist links,
   and the all-seven badge behave exactly as before
5. `npx vitest run src/lib/frivolousLists.test.ts` — 27 tests green
6. `npm run typecheck` — clean

## Notes for reviewer
- The `rainbowWarrior` → `rainbowConnection` field rename is safe by
  construction: the field lives only in `computeFrivolousLists`'s in-memory
  return shape (no storage key, no API path, no URL anchor); `tsc -b` proves
  every consumer was renamed.
- Deliberately unchanged per the approved change brief: `RAINBOW_COLORS` /
  `RainbowEntry` / `RainbowList` identifiers (they describe the rainbow-color
  domain, not the list title), the `--sr-rainbow-*` token names (they encode
  colors), and the historical records (CHANGELOG.md, ROADMAP.md, DECISIONS.md,
  PRODUCT_CONTEXT.md). README.md and website/ had zero occurrences.
- `grep -rniE "rainbow[-_ ]?warrior" frontend/src docs/HELP.md README.md
  CLAUDE.md website` returns zero hits; `rainbowWarrior` is absent from
  `frontend/src` entirely.
- No version bump or CHANGELOG entry in this build — handled once at the
  spin-bundle level per the brief.
