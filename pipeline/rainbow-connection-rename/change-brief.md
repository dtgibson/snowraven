# Change Brief — Rainbow Connection Rename

## What is changing
The Statistics → Frivolous Lists sub-list titled "Rainbow Warrior" is renamed
"Rainbow Connection" in all LIVE copy. Files that change (5, verified by grep):
`frontend/src/components/FrivolousListsSections.tsx` (the `<SubLabel>` at line 135
+ header comment line 4), `frontend/src/lib/frivolousLists.ts` (comment line 5 +
the internal `rainbowWarrior` result field → `rainbowConnection` — verified pure
in-memory: never persisted, no storage key, no API path, no URL anchor; tsc catches
any missed consumer), `frontend/src/lib/frivolousLists.test.ts` (describe name +
~30 field accesses), `frontend/src/globals.css` (the two "Rainbow Warrior swatches"
comments, lines 215/424 — the `--sr-rainbow-*` token NAMES stay, they encode
colors, not the title), and `docs/HELP.md` (the line-225 bullet label).

## Why now
User-queued idea from the Spool: rename the list to "Rainbow Connection." Pure
label preference on an existing feature; the matching algorithm, layout, and
behavior are untouched. Deliberately NOT changing (all verified zero-occurrence
or historical): README.md, website/, CLAUDE.md (zero hits — the presumed passing
mention actually lives in CHANGELOG/ROADMAP), DECISIONS.md / CHANGELOG.md /
ROADMAP.md / PRODUCT_CONTEXT.md (historical records; closeout logs the rename
forward), pipeline/ archives, and the rainbow-color domain identifiers
(`RAINBOW_COLORS`, `RainbowEntry`, `RainbowList`) which remain accurate.

## User-facing impact
One visible string: the sub-list heading reads "Rainbow Connection" instead of
"Rainbow Warrior." Nothing else shifts — the progress aria-label ("N of 7 colors
found") never carried the title, the Statistics jump list names the parent
section "Frivolous Lists" (unchanged, so no anchor/slug moves), and the
docs/HELP.md bullet is a list item, not a heading, so the HelpDocs TOC parity
test is unaffected.

## Design pass
Not needed — no visual change. A text-string swap inside an existing label;
layout, spacing, hierarchy, and the `--sr-rainbow-*` color tokens are untouched.

## Decisions touched
None reversed or modified. The v0.5.36 frivolous-lists entries (the section
itself; the lexicographically-greedy rainbow color matching) and the v0.5.40
hotspot-links entry mention "Rainbow Warrior" as historical context only — the
behavior they record is unchanged and those records stay as written.

## What done looks like
`grep -rniE "rainbow[-_ ]?warrior" frontend/src docs README.md CLAUDE.md website`
returns zero hits (record files + pipeline/ archives exempt); the Statistics tab
shows "Rainbow Connection"; vitest green and `npm run typecheck` clean after the
field rename. Version bump + CHANGELOG entry are handled once at the spin-bundle
level (build 5's docs/website sync will re-verify doc surfaces), but this build
leaves docs/HELP.md correct on its own.
