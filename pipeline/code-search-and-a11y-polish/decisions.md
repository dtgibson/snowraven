# Decisions: code-search-and-a11y-polish

## Stage 2, The Designer (draft, round 1, 2026-10-17)

Design system status: `pipeline/design-system.md` exists and this design is within it. No new pattern, no new type size, one new token in both themes (`--sr-milestone-3-link`, the brief's item 3). The container-query form below is the v1.0.23 pattern already in `.claude/rules/ui.md` and in the Calendar and Weather surfaces, not a deviation from the system. The deviations are from the BRIEF's assumed mechanism, and they are logged here.

### D1. The sighting row stacks by a container query on its own width in em, not only by the 640px viewport tier

The brief placed the phone rules inside the 640px block. Measured in the built app, the row's trouble is not a phone-width problem alone: at 641px and 200% text the place box is 77 to 95px, three or four characters, with the link fitting. A 22em threshold on the row's own width (`@container sr-nbs (max-width: 22em)`) stacks the row at 320px/200% (13.75em), 390px/100% (18.1em) and 641px/200% (13.2em) and leaves 641px/100% (30em) and 1024px/100% (44em) untouched, so "desktop at 100% is unchanged" holds. The threshold is derived from the row's fixed content (date about 5em, two separators 2.5em, link about 5.7em) plus 9em for the place. The phone tier still carries two rules of its own: baseline alignment and the 2.75rem link height. **Reversal:** if the user prefers the viewport-only form, drop the `@container` block, move its four declarations into the 640px tier, and accept the 641px/200% truncation.

Containment is argued both ways (ui.md, v1.0.23): the container is the padded row, nothing in its subtree is positioned or carries a z-index (the quote block, `HotspotLink`, `ChecklistLink`, an `.sr-only` cue at most), and it is never an ancestor of the card map, which carries the fullscreen panel. Same for `.sr-nb-media`: the media frames are `position: relative` with their own absolute children, so the section becoming a containing block changes nothing they resolve against.

### D2. Above 640px the stacked row keeps the truncating HotspotLink; on a phone it renders the full name

The full-name branch is a render branch (`truncate` is a prop that changes the markup), so it follows `useIsPhone()`, the sanctioned breakpoint render branch, and not the container query. The consequence: at 641px and 200% the place shows on the first line with an ellipsis and its `title`, and the full name is in Top locations below. Making the full name universal was rejected because a CSS imitation of today's truncation on the full-name markup truncates differently ("…Shoreline" kept) and would change desktop at 100% for long names. **Reversal:** if the user wants the full name there too, the row needs a ResizeObserver-driven state or a second `useIsPhone`-style hook at a wider query; a decision for the Engineer only on the user's say.

### D3. The gallery's column count follows the media section's width in em, through a NAMED container, so Species Detail's Recent Media is untouched by default

`.sr-media-grid` is shared with Species Detail. The query is `@container sr-nb-media (...)`, so it fires only under a section that declares that name; Species Detail keeps three columns above 640px exactly as today. Species Detail's Recent Media has the same `nowrap` "Macaulay Library" link in the same three-up grid, so it almost certainly overflows the same way at 641px/200%; the Engineer measures it, and opting it in is one class on its section (plus the same meta-row treatment of `RecentMediaEmbed.tsx`), a separate decision because that card may sit in a narrower column at 100% where 31em would give two columns on a desktop. Visible changes at non-100% text above 640px are accepted: 641px/125% and 150% go from three to two columns, 1024px/200% from three to two.

### D4. A fourth clip in the same card, found by measurement: the collapsed header's date-range line

Not in the brief. At 320px and 200% the "Mar 2, 2025 – Feb 10, 2026" line (nowrap, end-aligned) runs 28px past the card's LEFT edge in both engines, clipping the first date; fine at 320px/150% and 390px/200%. The brief's "What done looks like" (no text outside the card at 320px/200%) would fail on it, so the design includes the smallest fix: the line keeps `nowrap` on desktop through a class and the phone tier lets it break at a space, right-aligned. The NamedBirdRow comment that keeps the nowrap ("the two dates never break") stays true above 640px. **Reversal:** drop the phone-tier rule and record the clip as a known residual.

### D5. Tile meta separators ride with the item BEFORE them

Pairing a separator with the item after it (the sync line's shape) would move the middle dot from the end of line 1 to the start of line 2 at 1024px/100%, a visible desktop change. Trailing pairs reproduce today's desktop wrap byte for byte and never leave a separator alone on a line.

### D6. Checklist link height in the stacked state: 2.75rem on a phone, 2rem above

The item-list boxes in the same card are 2.75rem on a phone (ml-media-links, D3), so the row's one control takes the same posture rather than a third number. Above 640px a pointer user gets 2rem. A padding-plus-negative-margin hit box was rejected because it would overlap the place link's line box on the line above.

## Stage 3, The Engineer (2026-10-18)

### E1. The gallery's two-column threshold is 30em, not the mockup's 31em

Re-measured against the real container in the built app (CLAUDE.md, v1.0.50): at 641px and 100% text the media section is 31.44em with overlay scrollbars, which is what the mockup and the headless browsers see, and **30.5em with a 15px classic scrollbar** (Windows and WebView2, or a Mac set to always show scroll bars). At 31em that window dropped to two columns, which breaks "desktop at 100% is unchanged". At 30em it keeps three, and every outcome the design names still holds: 641px at 125%, 150% and 200%, 1024px at 200%, phones. The one other configuration that moves is a section between 30em and 31em (1024px at 150% with a classic scrollbar, for example), which keeps three columns instead of two; a three-column tile at the 30em edge is still wider than "Macaulay Library" at every text scale, and the meta row now wraps anyway. **Reversal:** set the query back to 31em in `globals.css` (section C) and the harness's printed label; nothing else depends on the value.

### E2. Item 1 lives in a new component, so MapExplorer.tsx still wires no code search

`components/map/TargetSpeciesList.tsx` holds the search box and its list and makes the same `rankSpeciesMatches(rows, q, alphaCodeHits(...), matchesSpeciesQuery)` call as `SpeciesCombobox`, with `loadAlphaCodes()` on focus. MapExplorer hands it `speciesOptions`, the array the My Sightings picker gets, so the per-array code index is shared. `lib/alphaCodeWiring.test.ts` keeps its MapExplorer call-site row unchanged, drops MapExplorer from OUT_OF_SCOPE, and adds the new file as a third consumer to every consumer row. Two deliberate behavior changes come with the shared matcher and are what the brief asked for: the query is trimmed (as in every picker) and a scientific name matches.

### E3. A comment-only edit outside the brief's unchanged list

`lib/alphaCodesAsset.ts` said "Exactly two lines do" start the code load; with the Media Targets box there are three, so the sentence was false. Its comment now names all three, the twin of the `useAlphaCodes.ts` comment the brief listed. No code line in `lib/alphaCodes*.ts` changed. `lib/speciesMatch.ts` is untouched: its "both consumers call both" counts Search and the picker, which is incomplete now but not false.

### E4. The tile meta row's checklist pair renders only when the asset has a checklist id

The old row always rendered `ChecklistLink`, which renders an empty span for an empty id; the pair version renders the checklist pair only for a non-empty id. The dots appear under exactly the old conditions (after the date when a Macaulay Library link or a checklist follows, after Macaulay Library when a checklist follows). The only DOM difference is that an asset with no checklist id loses an empty trailing span.

### E5. The fix reaches Species Detail's Named Individuals cards too, measured

They render the same `NamedBirdRow` (no map, no media). Measured with a scratch probe in both engines across 320 to 1280px and four text scales: before, the card's checklist link ran up to 147.5px past the card at 320px / 200% with every place squeezed to 0px; after, nothing is outside the card and every place shows at least 72.3px of ink. Species Detail's Recent Media was measured as D3 asked and left opted out: "Macaulay Library" runs 52.2px past its tile at 641px / 200% and 25.9px at 720px / 200%, identical in both builds. Opting it in is one class on its section plus the same meta-row treatment in `RecentMediaEmbed.tsx`, the separate decision D3 describes.
