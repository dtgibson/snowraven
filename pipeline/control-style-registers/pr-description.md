## Control Style Registers

### What this does

The filter and toggle pills across the app were drawn 44 times, in 15 files, as
bespoke inline styles: seven heights, six corner radii and four text sizes for
what is meant to be one family of control. This replaces all of them with two
shared CSS registers in `globals.css` (`.sr-pill` for standalone pills,
`.sr-segbar` / `.sr-segbar-btn` for the segmented groups), retires the two
duplicated style helpers (`ghostBtn`, `sortBtn`), and removes the inline chrome
from every call site so a hover or pressed rule can actually reach them.

Two phone-tier repairs ship with it, because the second depends on the first.
The rule that was supposed to be an iOS focus-zoom FLOOR,
`max(16px, 0.75rem) !important`, was really a REPLACEMENT: it hardcoded one
control size, so any control declaring a larger one was overridden in both
directions and rendered SMALLER at large text scale than it declared. The
command palette's search lost 8px at 200% text size, the checklist lookup 4px,
the weather forecast fields 3px. It now reads
`max(var(--sr-ctl-floor), var(--sr-ctl-rem, 0.75rem))`, where the second term is
each control's own register, so it only ever raises. And the 22 section labels
that sit beside those controls were excluded from the floor, which turned a
deliberate 1px optical offset into a size gap: they now derive their floor from
their own control's, through one declared factor, so a label and its control
cross from floored to scaling at exactly the same text scale.

No copy, behaviour, keyboard path, tab stop or ARIA attribute changes anywhere.

### How to test

1. Open a terminal in the project folder.
2. `cd frontend && npm run dev`
3. Open http://localhost:5173
4. On **Multimedia**, **Breeding Codes**, **Checklists** and **Statistics**, look
   at the filter rows: the pills are now all one height, one text size and fully
   round, and each one fades over 120ms when you hover or press it. On
   **Checklists** the tri-state pills should look exactly as they did, because
   they were already on register.
5. On **List Comparer** and **Species Detail**, the sort and mode toggles are
   segmented groups: the shell owns the border and the radius, the options have
   neither, and the selected option is an accent tint at weight 600.
6. Open Settings and set **Text size** to 200%, then narrow the window to phone
   width (390px, and again at 320px). The command palette search, the checklist
   lookup field, the weather forecast fields and the Map Explorer selects should
   all be LARGER than before, and every section label beside them should have
   grown with its control rather than staying small.
7. Nothing on desktop at 100% text size should move except the pills themselves:
   the label and clamp repairs are phone-tier only.

### Notes for reviewer

- **Desktop DOES change for the pill sites**, and the change brief's summary line
  ("Desktop: nothing changes, from any part of this build") is wrong about Part 1
  while being right about Parts 2 and 3. The design's own §1.2 and §1.4 say so
  ("accepted cost: 21 controls change shape noticeably"). `decisions.md` carries
  the measured before/after table for every surface.
- Three calls the spec left to the Engineer are argued in `decisions.md`: the
  Settings colour-scheme rows are NOT on the register (they are `role="radio"`,
  so the register's `aria-pressed` carrier cannot show their state), Species
  Detail's Graph Options and Map display mode are a `SegControl`-register shape
  rather than a segmented-bar one, and the Breeding Codes tier tints keep their
  shipped alpha values rather than the register table's generalised ones.
- Two controls carry a real accent state without `aria-pressed`, which this pass
  may not add. They use `data-state="positive"`, which shares ONE declaration
  with the `aria-pressed` rule so the two cannot drift.
- New guard `frontend/src/lib/controlRegisters.test.ts` parses the real
  `globals.css`. Thirty-six mutations were applied and every one went red; the
  table is in `decisions.md`.
- `vX.Y.Z` is live in three files waiting for the bundle's single version bump:
  `.claude/rules/ui.md`, `pipeline/design-system.md` and `globals.css`'s
  comments. Stamp by `grep -rn 'vX\.Y\.Z'`, not by a count.

### Changelog line

Filter and toggle pills across every tab now share one shape, and on a phone at
large text sizes controls and their labels grow together instead of being cut
down.
