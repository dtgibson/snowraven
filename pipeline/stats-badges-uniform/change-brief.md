# Change Brief — Stats Badges Uniform

**Improve lane, design pass needed.** Target: the next patch version (1.0.50 unless a parallel ship has taken it).

## What is changing
The milestone badges on the Statistics tab (the Firsts & Milestones section, `BirdingStats.tsx` lines 1011 to 1055) get one uniform, deliberate shape: every badge the same width and height, set on an even grid whose columns line up from row to row, with the same padding and internal alignment in each. The content stays the same: the threshold, the species that reached it (a `BirdName` with its eBird and Birds of the World marks), and the date linking to the checklist, in the same four color tiers. Today the container is an inline `display: flex; flex-wrap: wrap; gap: 8; align-items: flex-start`, and each badge is an inline-styled column sized by its own content, so the build also lifts that layout into `globals.css` classes, as the house rule requires for any layout that has to respond to width.

## Scope
- Changes: `frontend/src/components/BirdingStats.tsx` (the milestones block only); `frontend/src/globals.css` (new badge and grid classes, with any phone rules inside the existing first `@media (max-width: 640px)` block at about line 5604, never a new block ahead of it); a component test for the badge grid; `CHANGELOG.md` and the four-file version set at deploy; `docs/HELP.md` only if what a badge shows changes (its Firsts and Milestones paragraph is otherwise still true).
- Unchanged: the milestone data (`lib/birdingStats.ts`, `lib/statsBundle.ts`, `MILESTONE_THRESHOLDS`); the shared `BirdName`, `ChecklistLink` and `SpeciesLinks` components; every other Statistics section, including Life List Totals' "First species ever" card; the section title and jump-nav chip; the Frivolous Lists badges, which share the `--sr-milestone-1-*` tokens.
- Published surfaces: no change to `README.md`, `website/` copy, the App Store listing or the privacy policy (the website gets only its version pill and footer stamp at deploy). The App Store and website Statistics screenshots show the top of the tab, not the badges; confirm that at deploy rather than recapturing.

## Why now
The user reports the badges look irregular and sloppy and wrap asymmetrically. The code accounts for each part of that:
- Width comes from each badge's widest line: 14px padding a side plus the widest of the 1.25rem number, the species name (a non-wrapping row of the 0.78125rem name plus a fixed 39px for the two marks) and the 0.625rem date link. Badge width therefore tracks name length, and the 70px `minWidth` never binds once the marks render.
- A wrapping flex row of mixed widths fits a different number of badges per row, leaves a ragged right edge and a short last row; `align-items: flex-start` leaves heights unequal whenever one badge's content is taller (a name with no marks, or a name that wraps on a narrow card).
- Nothing gives the badge `min-width: 0` or a maximum width, so how a long name behaves on a 320px card at 200% text is unmeasured; three other `BirdName` cells have already run past their box this way (ui.md, v1.0.48).
- The check mark is a fixed 13px circle placed at top 5px, right 6px inside 10px/14px padding, so it intrudes into the content box; its glyph is rem-sized and outgrows the px circle at 200% text; its color is a hardcoded `#fff`; it has no `aria-hidden`, so it is read aloud on every badge, and since only achieved milestones render it carries no information.
- Thresholds print unformatted (`1000`, `3000`) while the rest of the tab uses separators, and the section opens with a stray `Divider` left over from the v0.5.10 regroup.

## User-facing impact
Visible on the Statistics tab only: the milestone badges change shape and arrangement. They carry the same information and links unless the Designer recommends dropping the redundant check mark or adding separators to thresholds (both in-app text, no approval stop). No data, setting, behavior or other section changes.

## Design pass
Needed. Surface: the Milestones badge set in Statistics, Firsts & Milestones, in both themes, from wide desktop down to 320px, at 100% and 200% text size.
What should feel better: one badge size; an even grid with aligned columns, the last row included; consistent padding and internal alignment; a clear order of emphasis (threshold, species, date); and a deliberate answer for long names (wrapping inside the badge with the marks kept together, never widening it).
Open choices for the Designer: keep, restyle or drop the check mark; separators on thresholds; whether the leading divider and the "Milestones" sub-label stay; whether the set becomes a list (`ul role="list"`) so a screen reader hears how many there are.
Constraints: colors only through `--sr-milestone-*` and other `--sr-*` tokens in both themes; sizes in rem so the grid tracks the Text size control; light tier 1's number (`#2D8653`, 4.03:1) passes only as large bold text, so it stays at least about 1.17rem bold or gets a darker token; any token value change also restyles the Frivolous Lists badges.

## Decisions touched
- **Milestone badges illegible in dark mode (v0.5.44, DECISIONS.md 2026-06-18):** gave dark mode its own tiles and re-tuned every badge element to AA, guarded by `milestoneContrast.test.ts`, and produced the ui.md rule that a light-in-both-themes surface must not host theme-following text. Respected, not reversed; any token change re-proves AA in both themes.
- **Statistics regroup (v0.5.10):** moved the records grid out of Firsts & Milestones, which is why the section now holds only milestones and opens with a divider. Not reversed; the section keeps its name.
- **Accessibility pass (v0.5.31):** made `--sr-milestone-*` a dedicated on-surface token family. Respected.
- No recorded decision is reversed.

## What done looks like
- At any width and text size, every milestone badge has the same width and height, columns line up row to row, and the last row sits in the same columns, left-aligned.
- Padding and internal alignment are identical in every badge; a long species name wraps inside its badge, with its marks, instead of widening it.
- At 320px and at 200% text size, in Chromium and WebKit and in both themes, no badge, text or mark overflows the card and the page does not scroll sideways.
- Layout lives in `globals.css` classes (no inline display, grid or wrap), every color is a `--sr-*` token (the hardcoded `#fff` is gone), sizes are rem; `milestoneContrast.test.ts` is green and light-mode contrast is re-checked; the Frivolous Lists badges are unchanged.
- A component test pins the structure (every achieved milestone renders as one badge in the grid, nothing renders for an unreached one), and the full suite, typecheck and `npm run build` are green.
