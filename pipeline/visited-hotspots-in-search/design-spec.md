# Design Spec: Visited Hotspots in Search

**Feature:** visited-hotspots-in-search
**Date:** 2026-11-13
**Stage:** 4, The Designer
**Status:** Reviewed by the user at the design review on 2026-11-13 ("This looks good"), with no change requested. The three questions put to the user (place under the name, the heading "Locations", the short "Search" hint on a narrow field) stand at the recommended answers.
**Source:** prd.md, schema.md (sections 4.3, 6, 14), strategic-brief.md, pipeline/design-system.md, the shipped overlay (`pipeline/command-palette/design-spec.md`, `CommandPalette.tsx`, the `.sr-palette*` rules in `globals.css`), the Hotspot Reports picker (`pipeline/hotspot-reports/design-spec.md`).
**Mockup:** `pipeline/visited-hotspots-in-search/design.html` (self-contained, no request of any kind).
**Verification of the mockup:** `pipeline/visited-hotspots-in-search/verify-design.mjs` (headless Chromium and WebKit; it reads the mockup, not the built app).

This spec extends `pipeline/command-palette/design-spec.md`. Anything it does not mention is that spec's and the shipped code's, unchanged.

---

## Visual Direction

Quiet utility, unchanged. The overlay is the shipped one with one more group under Species, and it adds no token, no color, no typeface and no motion. A place reads as a place: its name on one line and its county and state beneath it, the same two-line shape the Hotspot Reports picker uses, so the row a user chooses in Search is the row they meet again on the tab. The accent still appears only on the focused field, the highlighted row and the highlighted destination's glyph.

---

## Screens / Views

### The overlay with three groups

Reading order inside the scroller (new parts marked NEW):

```
.sr-palette-results  (the scrollport, unchanged)
  role="listbox" aria-label="Search destinations, species, and locations"
    role="group" aria-label="Destinations"                      (unchanged)
      .sr-palette-group role="presentation"  "Destinations"
      .sr-palette-row role="option" ...
    role="group" aria-label="Species" [aria-describedby=cap id] (cap line MOVED in)
      .sr-palette-group role="presentation"  "Species"
      .sr-palette-row role="option" ...                         (unchanged rows)
      div.sr-palette-note role="presentation" id=...            (only when cut at 50)
    role="group" aria-label="Locations" [aria-describedby=cap id]            NEW
      .sr-palette-group role="presentation"  "Locations"
      .sr-palette-row.sr-palette-row--loc role="option" ...                  NEW
      div.sr-palette-note role="presentation" id=...            (only when cut at 50)
  div.sr-palette-group                       (only over a backup-state sentence)
  div.sr-palette-status role="status"        (ALWAYS mounted, unchanged)
```

An empty or whitespace-only query renders the Destinations group and nothing else, exactly as today.

### 1. The location row (NEW)

`div.sr-palette-row.sr-palette-row--loc`, `role="option"`, no `tabindex`, nothing interactive inside. It keeps the shipped row box (flex, `gap: 10px`, `padding: 0 14px` sides, `min-height: 2.25rem`, 2.75rem in the phone tier, hover and highlight rules untouched) and changes two things: vertical padding `7px` (not 9px), and its content.

Content, in this order, which is also the accessible name's order:

```
span.sr-palette-loc                      flex: 1; min-width: 0; display: block
  span.sr-palette-loc-name               the shown name, from displayName()
  (a space)
  span.sr-palette-loc-meta               only when there is a place or an ID
    span                                 the place label, when not empty
    (space) span[aria-hidden] "·" (space)   only between a place and an ID
    span.sr-palette-loc-id               the Location ID, only when row.showId
```

- **Name** `.sr-palette-loc-name`: `display: block`, 0.875rem / 500 / line-height 1.4 / `--sr-text`, `overflow-wrap: anywhere`. The same size, weight and color as `.sr-palette-row-name`. **It wraps and is never cut by CSS**: no `nowrap`, no `text-overflow`, no line clamp.
- **Unnamed** `.sr-palette-loc-name--unnamed` (when `row.name === ''`): italic, the tab's own convention (`.sr-hsr-noname`). The text is `UNNAMED_LOCATION` through `displayName`, never a second copy.
- **Long name:** a name over the 200 bound arrives already cut, with the ellipsis written by `displayName`. The row prints that string whole and lets it wrap (three lines at desktop width in the mockup).
- **Meta line** `.sr-palette-loc-meta`: `display: block`, `margin-top: 1px`, 0.71875rem / line-height 1.45 / `--sr-text-muted`, not italic (italic stays the scientific name's mark), `overflow-wrap: anywhere`. The separator is an `aria-hidden` middle dot with a real space on each side, so the accessible name is "name place ID" with no dot.
- **Location ID** `.sr-palette-loc-id`: plain text in the meta register with `font-variant-numeric: tabular-nums`. No label word, as on the tab.
- **Highlighted row:** the shipped `.sr-palette-row--active` fill and inset outline, plus one NEW rule: `.sr-palette-row--active .sr-palette-loc-meta { color: var(--sr-text); }`. The place and ID are what tell namesakes apart, and `--sr-text-muted` on `--sr-accent-bg-hover` is 3.79:1 in the dark theme.
- **No glyph.** The name starts at the heading's left edge, as species names do.
- **Block layout, not a column flex.** The two lines are block boxes inside one flex item. A column flex is what WebKit left at a stale width after a text-size change on the Calendar tiles (ui.md, v1.0.38).
- **No row gains an `aria-label`.** The name comes from the content, so Label in Name holds by construction. Read it from a real engine's tree (QA-13); the mockup reads `option "Backyard Santa Clara, CA L19034127"` in both engines.

Row height at 100% text, from the declared values: about 51px with a place line; 36px, the shipped minimum, without.

### 2. The group heading

`Locations`, in the shipped `.sr-palette-group` register (0.6875rem / 600 / 0.06em / uppercase / `--sr-text-muted`), a `role="presentation"` child of its `role="group"`, which carries the same word as `aria-label`. Rendered only when the group has rows. Over a backup-state sentence the heading is the shipped sibling `div.sr-palette-group` outside the listbox, reading `Species and locations` or `Locations` per schema 4.3.

### 3. The two cap lines

Each line is the LAST CHILD of its own `role="group"`: a `div.sr-palette-note` with `role="presentation"` and an id built from the overlay's `useId()` prefix (`${uid}-cap-species`, `${uid}-cap-locations`, no file text), and its group carries `aria-describedby` pointing at it while it is rendered. So each line directly follows its own rows in reading order, sits inside the group it is about, and is tied to that group for assistive technology. It is not an option and the arrow keys never land on it.

- The species line moves from after the listbox into the Species group. Its wording, its presence for every query and its look (`.sr-palette-note`: `margin: 4px 14px 0; padding: 9px 0 4px`, 1px `--sr-border-subtle` top rule, 0.75rem / 1.5 / `--sr-text-muted`) do not change. It becomes a `div` instead of a `p` because a group may not own a paragraph; the class carries every style.
- One NEW rule: `[role="group"]:not(:last-child) > .sr-palette-note { margin-bottom: 8px; }`. When another group follows, the line gets clear air beneath it (23px to the next heading against 9px above), so it reads as the end of the group above.
- When the species line is the last thing in the list (no location matches), it renders exactly as it does today.
- Both lines present at once: query `a` in the mockup. Species rows, the species line, the Locations heading, location rows, the locations line.

### 4. The backup-state sentences

Schema 4.3's table, unchanged in content. Exactly one sentence or none, always through the existing always-mounted `role="status"` region with its sequence-keyed child. Placement and glyphs:

| State | Heading over it | Glyph | Sentence |
|---|---|---|---|
| Backup being read | Species and locations | `Loader2` + `.spin` | Reading your eBird backup. |
| No backup saved | Species and locations | `Upload` | Searching species and locations needs your eBird backup. Upload MyEBirdData.csv in Settings → Default Files → eBird Backup. |
| Saved backup would not load (a failed status read included) | Species and locations | `AlertCircle` | `EBIRD_BACKUP_LOAD_ERROR`, imported |
| Species ready, locations could not be derived | Locations | `AlertCircle` | `EBIRD_BACKUP_LOAD_ERROR`, imported |
| Species ready, locations not yet joined (first frame), query typed, no row | Locations | `Loader2` + `.spin` | Reading your eBird backup. |
| Query typed, everything answered, nothing matches | none | none | Nothing matches that search. |

Glyphs are the shipped 14px / 2.1 `aria-hidden` set; the two new states reuse them and add none. In the two "Locations" states the heading follows the Species group (and its cap line, when shown), so the sentence sits where the location rows would be.

### 5. The field's hint at narrow widths (NEW)

`PALETTE_COPY.placeholder` stays the full wording, `Search destinations, species, and locations`, and so do the three accessible names. Where the field is too narrow to show it whole, the placeholder is hidden and one short word, `Search`, is drawn in its place.

```
.sr-palette-field { container-type: inline-size; container-name: sr-palette-field; font-size: 1rem; }
.sr-palette-hint  { display: none; position: absolute; left: 35.5px; top: 50%; transform: translateY(-50%);
                    pointer-events: none; white-space: nowrap;
                    font-size: 1rem; font-weight: 400; color: var(--sr-text-muted); }
@container sr-palette-field (max-width: 27em) or (max-width: 432px) {
  .sr-palette-input::placeholder { color: transparent; }
  .sr-palette-input:placeholder-shown + .sr-palette-hint { display: block; }
}
/* inside the palette's own phone block */
.sr-palette-hint { font-size: max(var(--sr-ctl-floor), 1rem); }
```

- Markup: `<span class="sr-palette-hint" aria-hidden="true">{PALETTE_COPY.placeholderShort}</span>` directly after the `<input>`, inside `.sr-palette-field`. It is decorative, takes no pointer events and is not focusable. `placeholderShort` is a new key in `lib/paletteCopy.ts` with the value `Search`.
- `left: 35.5px` is the input's 34px left padding plus its 1.5px border.
- Why a container query is the right tool here (ui.md, v1.0.22 and v1.0.23): the question is "how wide is my box" for one fixed string, which is answerable. The `em` term tracks the text size; the `px` term covers the phone tier's 16px floor when the user's rem is below it.
- `container-type` is containment as well as a query anchor. Checked: `.sr-palette-field` is already `position: relative` and already the containing block of its one absolutely positioned child (the Search glyph); it holds no `z-index`; its inline size comes from `flex: 1`, so `inline-size` containment changes nothing it lays out.
- Measured in the mockup (this Mac's system face, both engines): the full wording is 19.5em wide; the shipped wording `Search destinations and species` is 234px at 16px against 196px of room at 320px, so the shipped placeholder is already clipped there today. Across 108 window widths and text sizes per engine (330 to 1400px, 100%, 150%, 200%) the hint shown always fits with at least 8px to spare, and both hints occur. The 27em / 432px thresholds leave room for a face about a fifth wider than the one measured. **Re-measure in the built app, in both engines and under a classic scrollbar, before trusting the numbers (CLAUDE.md, v1.0.50).**

### 6. 320px and 200% text

The location row needs no tier rule of its own: both lines are block text that wraps. At 320px / 200% in the mockup a namesake row reads `Backyard` / `Santa Clara, CA ·` / `L19034127`; a 200-character name with no space breaks to fit; both cap lines, the heading and every sentence wrap inside the sheet. No sideways scroll in the panel or the scroller in any measured configuration.

---

## Component Usage

| Shipped thing | Use here |
|---|---|
| `.sr-palette-row`, `--active`, hover | The location row's box, highlight and hover, unchanged. |
| `.sr-palette-group` | The `Locations` heading and the heading over a sentence. |
| `.sr-palette-note` | Both cap lines, same look, now inside their groups. |
| `.sr-palette-status` and its sequence-keyed line | Every sentence. No new live region. |
| `displayName`, `UNNAMED_LOCATION`, `ELLIPSIS` (`lib/hotspotReportsCopy.ts`) | The shown name, by import. |
| `Loader2`, `Upload`, `AlertCircle` at 14 / 2.1 | The sentence glyphs, as shipped. |
| `.sr-input-16`, the global focus rings, the global reduced-motion block | As-is. |
| **Not used:** `HotspotLink`, `BirdName`, any `Button` or `Link` | Nothing interactive inside an option (FR-13). |
| **Not used:** a glyph on location rows, a kind mark, a count | By decision and by FR-13. |

New classes: `.sr-palette-row--loc`, `.sr-palette-loc`, `.sr-palette-loc-name`, `.sr-palette-loc-name--unnamed`, `.sr-palette-loc-meta`, `.sr-palette-loc-id`, `.sr-palette-hint`. New copy key: `placeholderShort`. The base rules go beside the palette's own base rules and the one phone declaration inside the palette's own phone block (which sits after its base rules by design).

---

## Design Tokens Applied

No new token. Every color is an existing `var(--sr-*)` defined in both themes.

| Surface | Token |
|---|---|
| Location name | `--sr-text` |
| Place label, Location ID, cap lines, headings, sentences, the narrow hint | `--sr-text-muted` |
| Place label and ID on the highlighted row | `--sr-text` |
| Row hover / highlight fill / highlight outline | `--sr-surface-subtle` / `--sr-accent-bg-hover` / `--sr-accent` (shipped) |
| Cap-line rule | `--sr-border-subtle` (shipped) |

Contrast, computed from the token values and read back as computed styles in both engines: name 18.87 (light) and 16.12 (dark) at rest, 17.69 and 8.84 highlighted; place and ID 5.28 and 6.91 at rest, 17.69 and 8.84 highlighted; cap line 5.28 and 6.91. All clear 4.5:1.

---

## Interaction Notes

1. **One list, one highlight.** Location rows are the last rows of the shipped flat array. ArrowDown from the last species row lands on the first location row; the keys stop at both ends; Enter opens the highlighted row or `rows[0]`; a click chooses a row. Nothing about the keys is new.
2. **Ids.** Option ids stay `optionId(index)`. The two cap-line ids are the `useId()` prefix plus a fixed word. No id, `aria-activedescendant` or `aria-describedby` holds file text.
3. **Two tab stops,** the input and the Close button, with zero location rows and with fifty. The hint span and the cap lines add none.
4. **Scrolling the highlight into view** is the shipped `scrollIntoView({ block: 'nearest' })`; a two- or three-line row is brought fully into view by the same call.
5. **Joining late.** When location rows join one frame after species (schema 4.2), they are appended after every existing row. No existing row changes position, the scroll position is not touched, and a highlight keeps its row. The mockup's "Locations arriving" state shows it: every option's offset inside the panel is identical before and after the join, and `aria-activedescendant` is unchanged.
6. **A sentence never coexists with another.** While locations are still to come for a typed query that matches nothing else, the reading sentence shows under `Locations`; "Nothing matches that search." waits until both halves have answered.
7. **Hover** keeps the shipped rule, ungated, as NFR-13 asks (the palette's touch-hover item stays on ROADMAP). The new rows add no hover rule of their own.
8. **The species line's element changes from `p` to `div`.** Any existing test that finds it by tag rather than by class or text is a row pinning shipped markup; treat such an edit under NFR-05's listing rule.

---

## Motion Spec

Nothing new. Each line is the shipped value from `globals.css`; CSS only, no library.

- Location rows appearing (with species, or one frame later): no motion. They are drawn in place below every existing row. Easing none, duration 0, no origin; unchanged under reduced motion; CSS (no rule).
- Row hover (location rows inherit `.sr-palette-row`): ease-out, 120ms, `background-color`, no origin; reduced motion instant; CSS transition.
- Highlight moving onto or across location rows: no motion, `transition: none`, same frame as the key press; unchanged under reduced motion; CSS.
- Cap lines and sentences appearing: no motion; unchanged under reduced motion; CSS (no rule).
- The hint switching between the full wording and `Search` as the field crosses the threshold: no motion, a container-query flip; unchanged under reduced motion; CSS.
- Reading glyph (`.spin`) on the two reading states: linear, 0.7s loop, origin center; frozen by the global reduced-motion block, the sentence carries the state; shipped keyframe.
- Panel and scrim entrance, close: the shipped 140ms `cubic-bezier(0.2, 0, 0, 1)` scaleY from top center, 160ms ease-out scrim, instant close; reduced motion instant; shipped CSS animations, untouched.

An entrance on the location rows was considered and rejected: it would be motion on mount for static content, it would stagger against the species rows on the one open where they differ by a frame, and it would draw the eye to the frame's delay instead of hiding it.

---

## Content Notes

Strings are schema section 6's, unchanged in what they state. All live in `lib/paletteCopy.ts`.

| Key | String |
|---|---|
| `inputLabel` (input, dialog, listbox) | Search destinations, species, and locations |
| `placeholder` | Search destinations, species, and locations |
| `placeholderShort` (NEW, the narrow-field hint) | Search |
| `groupLocations` | Locations |
| `groupBackup` | Species and locations |
| `speciesNoBackup` | Searching species and locations needs your eBird backup. Upload MyEBirdData.csv in Settings → Default Files → eBird Backup. |
| `locationCapLine(50)` | Showing the first 50 locations. Keep typing to narrow them. |
| `speciesCapLine(50)` | Showing the first 50 matches. Keep typing to narrow them. (unchanged) |

`placeholderShort` has the same value as `controlLabel`; it is its own key so the nav label and the field hint can change apart. No em dash, American spelling, the tab named only as Hotspot Reports from `TAB_LABELS`.

Mockup content: a made-up Bay Area birder with 80 locations (refuges, regional parks, two yards both named Backyard, sewage ponds, a place saved with no name, one over-long personal name, three Central Parks in three counties, trips to Oregon, New Mexico, New Jersey, Ohio, Texas, Arizona and Ontario) and the shipped mockup's 138 real species with real scientific names. Demonstration queries: `cal` (all three groups; a mid-word hit in "Ecological"), `central` (namesakes told apart by place), `back` (namesakes told apart only by Location ID, plus a bird), `a` (both cap lines), `stevens` (the 200-character cut), `unnamed`, `zzz`.

---

## Decisions and the alternative rejected for each

1. **Row: two lines at every width, name wraps in full, place beneath, ID after the place on a full tie.** Rejected: the species row's one-line shape with the place right-aligned. It ellipsizes the end of the name, which is where eBird names differ ("Don Edwards San Francisco Bay NWR--..."), and at 320px / 200% it would clip the place label that tells namesakes apart.
2. **No glyph on location rows.** Rejected: a map pin per row. Fifty identical pins are ornament, the heading already says what the rows are, and a pin reads as a "hotspot" mark, which a personal location is not.
3. **Heading "Locations".** Rejected: "Places". Friendlier, but the tab's picker, the Help text and eBird all say "location", and one word across Search and the tab is worth more than warmth here.
4. **Each cap line inside its own group, described-by that group, shipped look, plus air beneath when a group follows.** Rejected: one combined line after the whole list ("Showing the first 50 species and the first 50 locations"). It changes the species wording and sits far from the rows it describes.
5. **One sentence region, with the heading saying which half speaks.** Rejected: a second status line for locations. FR-19 allows no new live region, and two sentences about one file would read as two problems.
6. **Full placeholder where it fits, `Search` where it does not, switched by a container query on the field.** Rejected: `Search` at every width. It is the simplest form, but it removes the one line that tells every user what Search reaches, which is how this feature gets discovered. Also rejected: a `useIsPhone` branch, which misses 641 to about 830px at 200% text, where the full wording is also clipped.
7. **No motion on arrival.** Rejected: a short fade on the location group. See Motion Spec.
8. **`LOCATION_CAP` stays 50** (schema D-5). At 51px a row, fifty rows are about 2,600px of scroll in a 34rem panel, the same order as fifty species rows. No layout reason to move it.

---

## Deviations from `pipeline/design-system.md`

None in tokens, type, color or motion. Three additions, each inside an existing pattern, logged in `pipeline/visited-hotspots-in-search/decisions.md`:

- **DD-1.** A two-line option in the Search overlay. The overlay's rows were one line; the two-line name-over-meta option is the Hotspot Reports picker's row, reused.
- **DD-2.** A decorative overlay standing in for a placeholder at narrow field widths. New to the system. It exists because a placeholder's text cannot be switched by CSS and QA-50 forbids a clipped one.
- **DD-3.** A non-option line inside a `role="group"` of a listbox, tied by `aria-describedby`. The shipped group headings are the precedent for a presentational child inside a group; a described-by cap line is new.

One finding outside this feature, recorded and not acted on: in the dark theme the shipped species row's scientific name on the HIGHLIGHTED row is `--sr-text-muted` on `--sr-accent-bg-hover`, 3.79:1 by the token values (4.95:1 in light). Species rows are frozen by NFR-05, so this design leaves them alone and gives only the new location row its own highlighted color. It is a question for the user (ROADMAP or a later fix), not a change made here.

---

## Verification of the mockup, and its limits

`node pipeline/visited-hotspots-in-search/verify-design.mjs` (set `PLAYWRIGHT_FROM` to a folder holding Playwright 1.62.1 when `website/tools` has no install): 468 checks, 0 failed, headless Chromium and WebKit, the file loaded from disk with no request but itself. It covers the group order; the empty and whitespace-only query; arrows crossing into Locations and stopping at the end; Enter landing on the report; two tab stops; nothing interactive and no file text in any id inside the listbox; namesakes by place and by ID; the accessible name's order from each engine's tree; both cap lines, each the last child and the description of its own group, species wording unchanged; each sentence with its heading, exactly one at a time; the late join moving no row and no highlight; contrast of the row's text pairs in both themes; text ink and sideways scroll at three windows and three text sizes over eight live states and eighteen held frames, the 200-character unbroken name included; and the field hint over 108 widths and sizes per engine.

Two control legs were run against deliberately broken copies and both went red: the name set to `nowrap` (56 failures) and the hint switched off (84 failures). The first run also flagged the shipped species row's ellipsized text as overflow until the ink probe was made to respect clipping ancestors, and reported a false row shift until the join probe was made container-relative; both are noted in the script.

None of this replaces the built-app measurements the PRD requires (QA-12, QA-13, QA-49, QA-50, QA-54). The mockup stands in for the window with a container, so its phone tier is a container query where the app's is a media query, and its fonts are this Mac's.

`weft-design-lint check pipeline/visited-hotspots-in-search/design.html`: clean, 0 findings.

## Pre-flight self-audit

| Check | Result |
|---|---|
| Distinctive display face | The mockup's commentary uses a serif display stack. The app's face stays Inter / system-ui, the long-standing logged deviation: design-system.md wins on specifics. |
| Three typographic roles with real contrast | In the panel: field 1rem / 500, row and location name 0.875rem / 500, heading 0.6875rem / 600 uppercase, meta and scientific name 0.71875rem, key cap 0.625rem / 700. |
| Neutrals tinted | Every neutral is a shipped zinc-tinted token; the scrim is the app's ink at an alpha. |
| One dominant color, accent on the key thing | The accent appears on the focused field and the highlighted row only. |
| Background has depth | Scrim over the live page, panel on the card shadow, faint footer strip, hairline rules. Unchanged. |
| Enter and exit ease-out under 300ms | Shipped 140ms and 160ms. Nothing added. |
| Origin-aware | The shipped top-center origin, argued in the overlay's own spec. Nothing added. |
| Reduced-motion fallback | The global block plus the palette's local one. The new rules add no motion to fall back from. |
| No motion anti-slop | No entrance, stagger or pulse added. The one loop is the shipped `.spin` on a real read. |
| Content-driven layout, no nested cards | One list in one panel. |
| Realistic content; empty, error and loading states designed | 80 believable places, 138 real birds; six backup and no-match states shown held still and live. |
| Components customized | No library component; shipped SnowRaven classes plus seven new `.sr-palette-*` classes on shipped tokens. |
