# Design Refinement — Targets hotspot link

Approved 2026-10-02. The user's decision: **"Wrap it, the green link looks right."**
Long hotspot names wrap (the `truncate` prop is NOT used), personal places stay
byte-identical to v1.0.45, and the link at the size, weight and glyph shown in
`design.html` is approved. Wrap was chosen because eBird puts the part that
tells two hotspots apart at the END of the name ("Hayward Regional
Shoreline--Winton Ave. entrance" against "--Frank's Dump"), so truncation would
cut exactly that part; and because the `truncate` prop applies to BOTH of
`HotspotLink`'s branches, so it would also change how personal places render.

## Amendment (live look, 2026-10-02)

At the live look at the built app the user said: **"It would look much better
and flow more logically if the link button was right next to the link, instead
of off to the side."** Cause: `HotspotLink` draws the name and the
open-on-eBird glyph as two side-by-side flex boxes (`display: inline-flex`); a
wrapping name's box stretches to the container's width, so the glyph sat at the
far right edge (the approved mockup had the same structure, and its
`align-self: flex-end` only moved the glyph to the last line). Asked whether to
fix only Targets or the shared link, the user chose **the shared link**
(`decisions.md`; the amended Scope in `change-brief.md`). The direction
otherwise stands: green link, wrap, personal places unchanged.

What changes with the amendment:

- `HotspotLink`'s full-name link branch (not `truncate`, not `compact`) becomes
  ordinary inline flow, and the last word of the name shares one inline-block
  with the glyph, so the glyph follows the last word on the same line and
  never drops onto a line by itself. One-line names look as they do today.
- The `.sr-tg-place` rules that only existed to work around the two-box layout
  (`> a > svg { align-self: flex-end }`, the anchor's `max-width: 100%`, the
  phone tier's negative margin) are dropped. The green, weight 500, 10px glyph,
  the phone-tier tap target and the focus offset stay.
- Every tab that shows a full hotspot name gets the amended glyph placement
  (`design.html`, "Other surfaces", shows a Species detail row before and
  after). The Tester verifies those surfaces too.

## Amendment 2 (QA, 2026-10-02)

The Tester's sweep found the glyph starting a line by itself well beyond the one
case first recorded: whenever the last word plus the glyph's 13px (its 3px gap
and 10px box) is wider than the line, which at the default text size happened
in 17 of 119 rows at 680 to 1040px (iPad portrait included) and at 200% text at
every desktop width. So the sentence above that the glyph "never drops onto a
line by itself" holds only where the container can make room. The user chose
to **let the glyph hang into the cell's spare padding** on Targets
(`decisions.md`). In the Last report cell only, the glyph adds no width to its
line (`margin-inline-end` of minus the hang, `--sr-tg-glyph-hang: 13px`), so it
shares the last word's line whenever the word alone fits, and extends up to
13px past the column: on desktop into the cell's 12px end padding and the
Distance cell's start padding, on a phone into the 12px column gap plus 1px of
end padding the cell gains there. The link itself carries end padding of the
hang, cancelled by a negative end margin, so its last line fragment reaches the
glyph's far edge and the focus outline surrounds a hanging glyph; the last-word
box takes no padding or margin, so a word that fits the column is never split.
(Revised at the QA retry: the first version put that padding and margin on the
last-word box, and WebKit, which outlines a link's own fragments once the link
has padding, as the phone tier gives it, drew the ring short of the glyph.) `HotspotLink` is unchanged, and other
tabs keep its behavior. Measured in WebKit and Chromium from 320 to 1280px at
100% and 200% text: no glyph alone on a line, no word split, 3px after the last
word, no overlap of the glyph with Distance text, no sideways scroll, and the
focus ring around the glyph by a real Tab in both engines. While focused, the
ring can touch the first letter of the Distance text at phone widths where the
glyph hangs closest (at most 4 pixels per row at 100% text, 11 at 200%). Also corrected: the phone-tier
tap area (above, and under Interaction Notes) is 24 to 25px tall at the default
text size and 38px at 200%, not "about 28px", because vertical padding on an
inline box wraps the font's content area rather than the line box.

Mockup: `pipeline/targets-hotspot-link/design.html` (Today against Proposed,
desktop table and phone cards at 375px, 320px and 320px at 200% text, both
themes, plus the Species detail row before and after). The design system
(`pipeline/design-system.md`) is extended, not changed: no new token, no new
component, no new pattern. This is the "Links out" pattern (accent +
ExternalLink glyph) applied to one more surface, with the glyph now bound to
the name's last word wherever the full name shows.

## Visual Direction

Quiet utility. In the Last report cell the date stays first and unchanged; the
place beneath it becomes, when it is a public eBird hotspot, the same link a
hotspot already is on Checklists and Named Birds: 0.75rem, `--sr-accent`,
weight 500, the 10px lucide ExternalLink glyph trailing the last word like a
character of the name, no underline at rest. Nothing on the line is larger or
bolder than the date it sits under, so a long list stays calm. A personal
place renders exactly as today: muted, same size, same line, same wrap.

## Screens / Views

### Desktop table (`.sr-tg-table`, 641px and up)

- The Last report cell is `<span>{date}</span>` followed by the existing
  `.sr-tg-place` block line. That block line is kept as the WRAPPER; it keeps
  its shipped rule exactly (`display: block; color: var(--sr-text-muted);
  font-size: 0.75rem; overflow-wrap: anywhere`).
- Inside the wrapper, `cell.place` renders through `HotspotLink` with
  `isHotspot` from the parent's single `useHotspotSet()` call, `locId` from the
  new `LiveCell.locId`, and `style={{ color: 'var(--sr-text-muted)' }}` so the
  component's plain branch (which defaults to `var(--sr-text)`) stays muted.
  This is the Checklists / Named Birds call shape. **Do not pass `truncate`**,
  and no `title` (the full name is visible, so a tooltip would repeat it).
- Markup shape, as rendered after the amendment:
  - hotspot: `<span class="sr-tg-place"><a ... style="text-decoration:none;color:var(--sr-accent)"><span>Hayward Regional Shoreline--Winton Ave. </span><span style="display:inline-block;max-width:100%;overflow-wrap:anywhere">entrance<svg style="margin-left:3px;vertical-align:baseline" .../></span></a></span>`
  - personal, null `locId`, or Set not loaded: `<span class="sr-tg-place"><span style="color:var(--sr-text-muted)">{name}</span></span>` (visually identical to today's bare text in the block).
  - no report: unchanged (`.sr-tg-na` "No report in the last 30 days", no place).
- A long hotspot name wraps onto a second (or third) line inside the cell, at
  spaces or at the "--" eBird uses, exactly as a long personal name wraps
  today, and the glyph sits right after the last word. The column's width is
  unchanged (the wrapper already wrapped, so the cell's intrinsic contribution
  does not move).
- The row hover (`--sr-surface-faint`) is unchanged; the link's own hover is
  the underline described under Interaction Notes.

### Phone-tier card (`@media (max-width: 640px)`, rules near globals.css 6459)

- Layout unchanged: Last report in grid column 1 beside Distance in column 2,
  the `.sr-tg-cell-k` "Last report" label over the date, the place under it.
- The place wraps within its half of the card; at 320px and at 200% text it
  takes more lines and never forces sideways scroll (`min-width: 0` on every
  cell, `overflow-wrap: anywhere` on the wrapper and on the last-word box).
- Tap target: the anchor gets `padding-block: 5px` at this tier only. The
  anchor is now an inline box, so vertical padding grows its hit box to about
  28px (18px line box + 10px) and never changes the line's height: **the card
  is exactly as tall as today.** No negative margin is needed (and on an inline
  box it would do nothing). The focus ring at this tier uses
  `outline-offset: 1px` so the padded box's ring does not run into the
  Distance cell.

## Component Usage

### `components/HotspotLink.tsx`, full-name link branch (amended)

The branch taken when `isHotspot` is true, the id is shape-valid, and neither
`truncate` nor `compact` is set. `truncate` and `compact` keep today's
inline-flex structure untouched (truncate needs the two-box layout to keep the
glyph visible after the ellipsis; compact is the glyph alone). The plain
branches are untouched.

Rendering approach: **ordinary inline flow, with the last word and the glyph
in one `inline-block`.**

```tsx
const cut = name.lastIndexOf(' ')
const lead = cut === -1 ? '' : name.slice(0, cut + 1)   // keeps the trailing space
const last = cut === -1 ? name : name.slice(cut + 1)
return (
  <OutboundLink
    href={`https://ebird.org/hotspot/${locId}`}
    aria-label={hotspotLinkAriaLabel(name)}
    title={title}
    className={className}
    style={{ textDecoration: 'none', ...style, color: 'var(--sr-accent)' }}
  >
    {lead ? <span>{lead}</span> : null}
    <span style={{ display: 'inline-block', maxWidth: '100%', overflowWrap: 'anywhere' }}>
      {last}
      <ExternalLink size={iconSize} strokeWidth={2.5} aria-hidden="true" style={{ marginLeft: 3, verticalAlign: 'baseline' }} />
    </span>
  </OutboundLink>
)
```

Why this and not the alternatives:

- **Inline flow** is what makes the glyph follow the text: the anchor stops
  being a flex container, so the name wraps as prose and the last-word box
  takes its place in the line after the preceding words, with nothing
  stretched to the container's width.
- **An `inline-block` for the last word, not a `white-space: nowrap` span.**
  Both keep the word and the glyph together on an ordinary name: an
  inline-block is placed on the current line if it fits, else moved whole to
  the next line, which is the behavior wanted. They differ on the edge case:
  a last token wider than the whole container (a hotspot name with no spaces,
  or a long "Park--Headquarters" token, at 320px and 200% text, where a phone
  card's column is about 140px and holds about ten characters). A `nowrap`
  span cannot break at all and would force sideways scroll, failing WCAG 2.1
  AA reflow (1.4.10). The inline-block has `max-width: 100%` and
  `overflow-wrap: anywhere`, so in that one case it wraps INSIDE itself and
  the glyph follows the final fragment; no sideways scroll on any surface.
  The cost in that case is cosmetic only: the whole box moves to a new line,
  leaving the previous line short.
- **Not a word joiner** (U+2060 between the word and the glyph): it would put
  an invisible character into the copied text and into `textContent`-based
  tests, and whether a joiner binds text to an atomic inline in WebKit is not
  something to rely on. The inline-block is plain CSS 2.1 box behavior and
  identical on WebKit (the Mac, iPhone and iPad apps), Chromium and Gecko.
- **Hyphenated eBird names ("--")**: the split is at the last SPACE only, so
  "Shoreline--Winton Ave. entrance" splits as "…Ave. " + "entrance", and a
  name whose last token is itself hyphenated ("Alviso--Marina") stays one box;
  "--" inside the lead keeps its normal break opportunities.
- **One-line names look exactly as today.** The gap is `margin-left: 3` on the
  glyph (today `gap: 3`). Vertical position: with no global `svg` rule in
  `globals.css`, `vertical-align: baseline` sits the 10px glyph's box on the
  text baseline; at 0.75rem and the default 1.5 line-height that is within
  half a pixel of where `align-items: center` put it, and unlike centering it
  does not move with a caller's line-height. Set it explicitly rather than
  leaving it to the default so a future global `svg` rule cannot move it.
- **The accessible name is unchanged.** `OutboundLink` puts
  `hotspotLinkAriaLabel(name)` ("Open {name} on eBird (opens in a new tab)")
  on the anchor as `aria-label`, which replaces the content for assistive
  technology; the visible text is still the whole name in reading order with
  its spaces (the lead span ends with the space), so copy, find-in-page and
  Label in Name are all unaffected. The split must never add or drop a
  character: `lead + last === name` is a test row.
- **Flex-item callers still work.** When the anchor is a flex item (Species
  detail's recent sightings row), the flex container blockifies it; its
  INSIDE is now inline flow, which is exactly the point, and the item's
  alignment and baseline behave as before (a block's baseline is its first
  line's, same as inline-flex's first-item baseline).

### Full-name callers checked (`grep -rn "<HotspotLink" frontend/src`)

- `BirdingStats.tsx:860` (a card line, `style={{ color: muted }}`, inside a
  block `<div>`): no reliance on inline-flex. Unchanged.
- `NamedBirdLocations.tsx:65` ("Every sighting at {link}." in inline text
  flow, `fontWeight: 600`): the file's own comment asks for inline flow so the
  closing period sits tight; the amendment serves it better than inline-flex
  did. The period cannot be orphaned after the glyph box (no break before a
  period). Unchanged.
- `SpeciesDetail.tsx:1710` (recent-sightings row, a wrapping flex row with
  `alignItems: 'center'`; passes `className="sr-wrap-anywhere"` and a muted
  color): the anchor is a flex item either way; its inner layout changes from
  two boxes to inline flow, which is the fix. Unchanged.
- `TargetsList.tsx` (new, this build): as specified above.
- Every other call site passes `truncate` (`WeatherBacklog:199`,
  `BirdingStats:1382/1397/1809/2029`, `NamedBirdLocations:96`,
  `FrivolousListsSections:178`, `Checklists:224/349`, `SpeciesDetail:1425`,
  `NamedBirdRow:221`, `CountyLayer:739`) or `compact` (`MapExplorer:2626`),
  and those branches are untouched. Their `flex`, `minWidth`, `maxWidth` and
  `justifyContent` style overrides belong to the truncate/compact branches and
  are unaffected.
- **No caller needs changing.** Callers' `style` overrides on the full-name
  branch are `color`, `fontSize` and `fontWeight`, which inline flow honors.
  One thing for the Engineer to keep: `color: var(--sr-accent)` stays LAST in
  the style spread so a caller's muted color never bleeds onto the link.

### `globals.css` rules for Targets (amended)

Add directly after the existing `.sr-tg-place` rule, and in the ≤640px
Targets block. The component's inline styles (`text-decoration: none`,
`color`) beat class rules, so the underline targets the anchor's two text
spans. Text decoration does not propagate into an inline-block, which is why
it is declared on the spans themselves rather than on the anchor, and it is
never drawn across an inline SVG, so the glyph stays bare.

```css
/* Last report: a public hotspot renders through HotspotLink inside the place
   line; a personal place is the plain span it always was. HotspotLink's own
   inline styles are left alone: these rules reach only its two text spans. */
.sr-tg-place > a { font-weight: 500; }
.sr-tg-place > a > span { text-decoration: underline; text-decoration-color: transparent; text-decoration-thickness: 1px; text-underline-offset: 0.14em; transition: text-decoration-color 120ms ease-out; }
.sr-tg-place > a:hover > span, .sr-tg-place > a:focus-visible > span { text-decoration-color: currentColor; }

@media (max-width: 640px) {
  .sr-tg-table .sr-tg-place > a { padding-block: 5px; }
  .sr-tg-table .sr-tg-place > a:focus-visible { outline-offset: 1px; }
}
```

Dropped from the earlier spec: `.sr-tg-place > a { max-width: 100% }` (no
meaning on an inline box), `.sr-tg-place > a > svg { align-self: flex-end;
margin-bottom: 0.3em }` (the two-box workaround), and the phone tier's
`margin-block: -5px` (no effect on an inline box, and no longer needed).

## Design Tokens Applied

- Link text: `--sr-accent` (set by the component). Measured contrast: light
  `#277448` is 5.71:1 on `--sr-surface` and 5.47:1 on the row-hover
  `--sr-surface-faint`; dark `#34D399` is 9.22:1 on `--sr-surface` and 8.84:1
  on `--sr-surface-faint`. All clear WCAG AA for text.
- Personal place: `--sr-text-muted` (5.28:1 light, 6.91:1 dark), unchanged.
- Focus ring: the global `a:focus-visible` rule (3px `--sr-accent` outline,
  3px offset, the existing halo). On a wrapped inline link the ring is drawn
  around the line fragments. Nothing new.
- Type: 0.75rem (the wrapper's), weight 500 for the link, the body's
  line-height. Glyph 10px, 3px after the last word, on the baseline. No new
  token in either theme.

## Interaction Notes

- Hover: the name underlines in its own color (`text-decoration-color`
  transparent to `currentColor`) on both spans, so the underline covers the
  whole name including the last word and stops before the glyph; the glyph
  and the color do not change.
- Keyboard: the anchor is a tab stop through `Link`; focus-visible shows the
  global ring and the same underline.
- Click/tap: opens `https://ebird.org/hotspot/{locId}` in a new tab / the
  system browser through `OutboundLink` (desktop and iOS both already handle
  this for every other hotspot link). The glyph is inside the anchor, so it is
  part of the target.
- Accessible name: "Open {name} on eBird (opens in a new tab)". The visible
  text is the hotspot name, so Label in Name holds; the two-span split is
  invisible to assistive technology.
- Plain states (personal place, null `locId`, Set not yet loaded, no key, Set
  built offline) all render the muted plain span: no link, no glyph, no hover.
- Phone: about 28px tall hit area, full width of the name, no layout change.

## Motion Spec

- Hover/focus underline: `text-decoration-color` transparent to currentColor, ease-out, 120ms, no transform (origin not applicable), reduced motion collapsed by the global `prefers-reduced-motion` block to ~instant, CSS.
- Everything else (link appearing, wrap, glyph placement, focus ring): instant, no motion, CSS.

## Content Notes

- Copy unchanged: the place is `cell.place` as eBird gives it, split for
  rendering only, never altered. No new strings in the cell. The one approved
  copy change is outside the design: one clause in `docs/HELP.md` (Targets,
  the "Live" bullet) saying a hotspot's name opens its eBird page.
- No em dashes; American spelling. The spoken link name is the app's shared
  formula and is not restated anywhere.
