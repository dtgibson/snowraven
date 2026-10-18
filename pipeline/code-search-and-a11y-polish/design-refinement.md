# Design Refinement: Named Birds card at phone widths and large text

**Approved by the user on 2026-10-18, round 1, as drawn.**

**Run:** code-search-and-a11y-polish (Improve lane, design pass for item 2; item 3's swatch included)
**Mockup:** `pipeline/code-search-and-a11y-polish/design.html`
**Decisions:** `pipeline/code-search-and-a11y-polish/decisions.md`

## Visual Direction

Nothing new to look at on a desktop at 100% text: the card reads exactly as it does today. The work is in what gives way when the card is narrow or the text is large. Each row keeps its reading order (date first, then the place, then the checklist link), nothing is clipped or hidden, and the one control in each sighting row, the checklist link, sits alone on its own line where there is no room beside the place, at the app's 44px phone posture. The gallery keeps its three columns wherever it has three today and gives them up in the same quiet register as the rest of the app, two then one, as the section gets narrow in em. No new color, type size or motion. One new token, for the tier-3 badge's hover color, same hue as the accent.

## Screens / Views

### Named Birds, open card: sighting rows

**Today.** `date · place · checklist` is one `display: flex` line with the date and the link `flexShrink: 0` and the place an ellipsis-truncated `HotspotLink`. Measured in the built app (HEAD, Chromium and WebKit): at 320px and 200% text the place box is **0px wide** (the name is gone) and the checklist link runs **109px** past the card, clipped; at 320px and 100% the place box is 17 to 25px (an ellipsis alone); at 641px and 200% the place box is 77 to 95px (three or four characters).

**Proposed.** The row's padded wrapper becomes a size container (`.sr-nbs`, `container-type: inline-size; container-name: sr-nbs`) and the line beneath it (`.sr-nbs-line`) decides by its own width whether the three can share a line:

- **At 22em and wider** (every width 640px and up at 100% text; the narrowest, 641px, measures 30em): unchanged. One line, place truncates, link at the end.
- **Below 22em** (`@container sr-nbs (max-width: 22em)`): the line wraps (`flex-wrap: wrap; align-items: baseline; row-gap: 2px`), the place takes the rest of the first line (`flex: 1 1 auto`), the second separator is hidden (`.sr-nbs-sep--link { display: none }`), and the checklist link's wrapper takes the whole next line (`.sr-nbs-link { flex-basis: 100%; min-height: 2rem }`), 2.75rem inside the phone tier.
- **The place on a phone (640px and below)** is the full-name `HotspotLink` (no `truncate`), chosen in `NamedBirdRow` with `useIsPhone()`, so it wraps as prose with the glyph following the last word (the v1.0.47 rule), and a personal location is a plain wrapping span. Above 640px the row keeps `truncate`, so at 641px and 200% the place shows on the first line with an ellipsis and its `title`; the full name is in Top locations just below. This is the one deliberate residual, see decisions.md D2.

22em is derived: date about 5em, two separators 2.5em, link about 5.7em, so 13em of fixed content, leaving the place 9em (about 18 characters at 0.75rem) before the row stacks. Measured in the mockup: 320px/200% (13.75em), 390px/100% (18.1em) and 641px/200% (13.2em) stack; 641px/100% (30em) and 1024px/100% (44em) do not.

The line's layout lifts from inline styles to classes (`.sr-nbs-line`, `.sr-nbs-date`, `.sr-nbs-sep`, `.sr-nbs-place`, `.sr-nbs-link`); font sizes, weights and colors stay inline at the call site. `ChecklistLink` has no `className`, so it is wrapped in `<span class="sr-nbs-link">` (`display: flex; align-items: stretch`), which is what gives the anchor the full line height as its hit box without changing the shared component.

### Named Birds, open card: section headers

"Media of {name}" and "Where {name} has been seen" lift their layout to `.sr-nb-head` (`display: flex; align-items: flex-start; gap: 6px; min-width: 0`), the glyph in `.sr-nb-head-glyph` (`flex: none; margin-top: calc((1.5em - 12px) / 2)`, the position centering gave it on a one-line label) and the text in `.sr-nb-head-text` (`min-width: 0; overflow-wrap: anywhere`). The 120-character name wraps over 11 lines at 320px/200%, 6 at 641px/200%, 3 at 1024px/100%; today it runs 1,595px, 1,394px and 242px past the card.

### Named Birds, open card: the collapsed header's date range (new finding)

Measured here: the header's "Mar 2, 2025 – Feb 10, 2026" line is `nowrap` in an end-aligned column, so at 320px and 200% text it runs **28px past the card's LEFT edge** in both engines and the first date is clipped (fine at 320px/150% and 390px/200%). The line takes a class (`.sr-nbh-dates { white-space: nowrap }`, desktop unchanged) and the phone tier releases it (`white-space: normal; text-align: right; overflow-wrap: anywhere`), so it reads "Mar 2, 2025 –" over "Feb 10, 2026", right-aligned. See decisions.md D4.

### Named Birds, open card: media gallery and tile meta row

**Today.** `.sr-media-grid` is three columns above 640px at any text size. At 641px and 200% the tiles are 137px wide; "Macaulay Library" (`nowrap`) runs 49.5px past each tile edge and the meta row is six lines, every token on its own line including the separators.

**Proposed.**
- The media section (`.sr-nb-media`) is a named size container. `@container sr-nb-media (max-width: 31em)` gives the grid two columns; `(max-width: 19em)` gives one. 641px at 100% is 31.4em, so desktop at 100% keeps three columns everywhere (measured: 641, 820, 1024 and 1280px). 641px at 200% is 13.8em: one column. 1024px at 200% is 25.8em: two columns of 413px instead of today's three of 265px. The phone tier's `1fr` rule stays last in the file and still wins at 640px and below. The container is named, so Species Detail's Recent Media, which shares `.sr-media-grid`, is untouched unless its section opts in (decisions.md D3).
- The meta row lifts to `.sr-nbm-meta` (`flex; wrap; gap: 6px; align-items: center; margin-top: 8px; min-width: 0`), the format marker to `.sr-nbm-fmt`, and the date, the Macaulay Library link and the checklist link each sit in a `.sr-nbm-pair` (`inline-flex; gap: 6px; min-width: 0; max-width: 100%; overflow-wrap: anywhere`) with its separator AFTER it (`.sr-nbm-sep`). Nothing is `nowrap` any more. A wrapped row therefore ends its lines with the separator, exactly as the desktop row wraps today, and never starts a line with one. The separator after the date is present when a Macaulay Library link or a checklist link follows; the one after Macaulay Library when a checklist link follows (the same conditions as today). Desktop rendering is unchanged: at 1024px/100% the row still wraps "PHOTO Feb 10, 2026 ·" over "Macaulay Library · S231498765".

### Statistics, milestone badge tier 3 (item 3 swatch)

One badge-local property beside the four `data-tier` already sets: `.sr-ms-badge { --sr-ms-link: var(--sr-accent) }`, `.sr-ms-badge[data-tier="3"] { --sr-ms-link: var(--sr-milestone-3-link) }`, and `.sr-ms-name .sr-birdname-link:hover, .sr-ms-name .sr-birdname-link:focus-visible { color: var(--sr-ms-link) }` (specificity 0,3,0 over the shared 0,2,0 rule). The new token: `--sr-milestone-3-link: #236A41` in `:root`, `#34D399` (the dark accent) in `[data-theme="dark"]`. Ratios on the two tier-3 stops: light today 4.54 / **4.14**, proposed 5.20 / 4.75; dark 5.73 / 7.23 unchanged. Resting name (`--sr-text`) 15.01 / 13.69 light, 10.02 / 12.64 dark. Tiers 1, 2 and 4 keep `--sr-accent` (5.09, 4.66, 5.13 on their darker stops).

## Component Usage

- `HotspotLink`: both existing branches, unchanged. `NamedBirdRow` passes `truncate={!isPhone}` (`lib/useIsPhone.ts`, the sanctioned render branch by breakpoint) and `className="sr-nbs-place"`.
- `ChecklistLink`: unchanged; wrapped in `<span class="sr-nbs-link">` in the sighting row and `<span class="sr-nbm-pair">` in the tile.
- `OutboundLink` ("Macaulay Library"): `className="sr-nbm-ml"`, its `whiteSpace: 'nowrap'` removed.
- Lucide `Play` / `Map` glyphs in the headers, wrapped in `<span class="sr-nb-head-glyph">` so no rule has a bare `svg` as its rightmost compound.
- No new components, no new dependencies.

## Design Tokens Applied

All colors through `var(--sr-*)`, both themes. One new token, `--sr-milestone-3-link` (light `#236A41`, dark `#34D399`), declared in both theme blocks before use. Everything else reuses the section's existing values: 0.75rem / 600 dates, `--sr-text-disabled` separators, `--sr-accent` links, 0.6875rem / 700 / 0.04em uppercase micro-labels in `--sr-text-muted`.

## Interaction Notes

- Hover, focus and click on every link are as today. In the stacked state the checklist link's hit box is the full line height (2rem above 640px, 2.75rem in the phone tier), content width, so a tap on the empty part of the line does nothing.
- Keyboard order is unchanged: date (text), place link, checklist link, per row.
- The gallery's column count changes with window width and text size only; nothing animates on a column change (a re-layout is instant, per the design system's chart rule).
- `prefers-reduced-motion`: no new motion exists; existing transitions (badge name color, item-list box fill) already collapse under the global block.

## Motion Spec

- No new motion. Column changes, row stacking, header wrapping: instant, CSS, nothing to implement.
- Badge name hover color: existing `color 120ms cubic-bezier(0.2, 0, 0, 1)` transition, reduced motion instant (global block), CSS. Only the target color changes.

## Content Notes

- No copy changes. Separators stay the middle dot. No em dashes.
- `docs/HELP.md` needs no new sentence for item 2 (layout only). No `README.md`, `website/`, App Store or privacy copy.

## Measurement (the mockup, Chromium and WebKit)

Every "Proposed" frame at 320px/200%, 390px/100%, 641px/200% and 1024px/100%, for Winky and the 120-character name: no text ink, link, button or icon outside the card's content box (clip-aware, so a `.sr-truncate` span's own clip is honored), no card scroll, no page scroll, every sighting row keeps a place name of at least 20px of ink. The "Today" frames reproduce the built app's numbers (link 108px past the card at 320px/200%, header 1,597px, place box 0px), so the probe can fail. Scratch script: `measure-mock.mjs` in the session scratchpad; the Engineer's gate is `website/tools/verify/verify-named-bird-media-links.mjs`, which the brief already names.
