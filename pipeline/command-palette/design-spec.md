# Design Spec — Command Palette

**Feature:** command-palette
**Date:** 2026-09-05
**Stage:** 4 — The Designer
**Source:** prd.md (approved), schema.md (approved), pipeline/design-system.md
**Mockup:** `pipeline/command-palette/design.html`
**Verification:** `pipeline/command-palette/verify-design.mjs` (Chromium + WebKit)

---

## Visual Direction

Quiet utility, unchanged. The palette is a top-anchored modal search overlay on the app's
own surface, border and shadow tokens over `--sr-scrim`, and it introduces **no new token
and no new colour**. Its whole visual argument is continuity: the field the user clicks in
the navigation is the same object the palette opens with, and the result list speaks the
shipped `SpeciesCombobox` listbox vocabulary (active-option fill plus inset accent outline,
the row's flex proportions, the 40% cap on the scientific name, truncation on both spans)
rather than a second one. The accent appears in exactly three places: the focused field's
ring, the active option's tint and outline, and the active option's icon. Nothing else in
the panel is coloured.

---

## Screens / Views

### The palette overlay

**Root (`.sr-palette-root`).** `position: fixed; inset: 0`, `z-index: 1280`, background
`var(--sr-scrim)`, `display: flex; align-items: flex-start; justify-content: center`,
`padding: 11vh 16px 16px`. Positioning lives in `globals.css`, never inline: an inline
`inset: 0` is specificity 1,0,0 and would put the iOS safe-area inset permanently out of
reach. The z-index is reasoned at the declaration, per house convention: above
`.sr-nav-sheet-root`'s 1260 and `.sr-nav-tip`'s 1250 so the palette rises over both, and
below `.sr-skip-link:focus`'s 1300, which is harmless because the skip link is parked
off-screen until focused and the trap makes it unreachable while the palette is open.
`.sr-ios-app .sr-palette-root { padding-top: calc(11vh + env(safe-area-inset-top, 0px)); }`
— gated on the class, never a bare `env()`.

**Panel (`.sr-palette-panel`).** Flex column. `width: min(100%, 36rem)`,
`max-height: min(34rem, 100%)` — the `100%` resolves against the root's content box, which
is the viewport minus its own padding, so the cap needs no viewport unit and the iOS inset
is already subtracted. `--sr-surface` on 1px `--sr-border`, radius 14,
`box-shadow: var(--sr-card-shadow)`, `overflow: hidden`. `role="dialog"`,
`aria-modal="true"`, `aria-label` = the input's label.

**Head (`.sr-palette-head`).** `padding: 12px`, flex row, gap 8, 1px `--sr-border-subtle`
bottom rule. It holds a **field**, not a bare borderless input: `.sr-palette-field` is
`position: relative; flex: 1`, carrying an absolutely-positioned 17px Search glyph at
`left: 11px` in `--sr-text-muted`, and `.sr-palette-input` at `height: 2.5rem`,
`padding: 0 12px 0 34px`, `1.5px solid var(--sr-border-input)`, radius 8,
`--sr-surface` fill, `font-size: 1rem; font-weight: 500`. The 40px / 1.5px / radius-8 /
`--sr-border-input` box is the shipped `SpeciesCombobox` `md` register with the type one
step up, because this is the overlay's hero control.

> **Why a bordered field rather than the usual borderless palette input.** The palette
> autofocuses its input, so the global `input:focus-visible` ring is on screen essentially
> the whole time the overlay is open. A borderless input would have forced an override of
> the app's one focus treatment; a real field means the shipped ring hugs a real border and
> **nothing is overridden**. It also makes the entry control and the query field visibly the
> same object, which is the continuity the feature rests on. `className="sr-input-16"` rides
> onto the `<input>` (the iOS zoom guard every `SpeciesCombobox` call site passes); the
> class's `!important` and the 1rem base agree, so neither fights the other.

**Close (`.sr-palette-close`).** A 2.5rem square icon button (`2.75rem` at ≤640), no
border, no fill, radius 8, `--sr-text-muted`, `--sr-surface-subtle` on hover, 17px X glyph,
`aria-label="Close search"`, literal `tabIndex={0}`, `type="button"`. **Rendered at every
density, not only on the phone**, so the overlay's tab-stop population is a constant that
QA-41 can assert without a width qualifier. It is required at phone width, where the sheet
is full-bleed and there is no visible backdrop to press.

**Results (`.sr-palette-results`).** `flex: 1; min-height: 0; overflow-y: auto;
overscroll-behavior: contain`. **This scroller is not the listbox.** A `listbox` may own
only `option` and `group`, so it holds those and nothing else, and the cap line and the
status region are siblings below it inside the scroller. Each visible group heading is
carried by a `role="group"` wrapper's own `aria-label`, matching APG's grouped listbox.
The flat row array and its single active index are untouched, so ArrowDown still crosses
the boundary for free.

```
.sr-palette-results  (the scrollport)
  #pal-listbox  role="listbox" aria-label="Search destinations and species"
    div role="group" aria-label="Destinations"
      div.sr-palette-group role="presentation"  "Destinations"
      div.sr-palette-row role="option" …        (one per destination)
    div role="group" aria-label="Species"
      div.sr-palette-group role="presentation"  "Species"
      div.sr-palette-row role="option" …        (one per species, capped at 50)
  p.sr-palette-note                             (only when truncated)
  div.sr-palette-group                          (only when the species half has a
                                                 sentence and no rows)
  div.sr-palette-status role="status"           (ALWAYS mounted, empty by default)
```

**Group heading (`.sr-palette-group`).** `padding: 11px 14px 5px` (8px top on the first),
`0.6875rem / 600 / letter-spacing 0.06em / uppercase / --sr-text-muted` — the app's
existing micro-caps section-label register (`BirdingStats`' `StatLabel`).

**Destination row.** `display: flex; align-items: center; gap: 10px`,
`min-height: 2.25rem; padding: 9px 14px`. `TAB_ICONS[id]` at the `NAV_ICON.sheet` preset
(17px / 2.1), the closest register to a list row, so no new number is introduced. Glyph in
`--sr-text-muted`; label `.sr-palette-row-name` at `0.875rem / 500 / --sr-text`, `flex: 1`,
`min-width: 0`, ellipsis.

**Species row.** The same box **with no glyph**, so the name starts at the group heading's
left edge. Common name in `.sr-palette-row-name` exactly as above; scientific name in
`.sr-palette-row-sci` at `0.71875rem`, italic, `--sr-text-muted`, `flex: 0 1 auto`,
`max-width: 40%`, `text-align: right`, ellipsis. The four load-bearing bits from the
shipped picker's row (primary `flex: 1`, secondary `flex: 0 1 auto` **plus**
`max-width: 40%`, truncation on **both** spans) are carried verbatim, in classes rather
than inline styles. **No `<BirdName>`**: it composes a button and two anchors, which would
nest interactive controls inside `role="option"` and add tab stops. That is the standing
form-control exclusion in `.claude/rules/bird-names.md` and `pipeline/design-system.md`,
not a shortcut.

> **Why species rows carry no glyph.** Fifty identical book icons down the densest part of
> the list is ornament, not clarification, and the doctrine's icon rule is explicit about
> the difference. The group heading already says what these rows are, and the two groups
> then read with distinct left rhythm, which is a quieter way of saying "two kinds of
> thing" than a repeated mark.

**Active option (`.sr-palette-row--active`).** `background: var(--sr-accent-bg-hover)`,
`outline: 2px solid var(--sr-accent)`, `outline-offset: -2px`, and the destination glyph
goes `--sr-accent`. This is the shipped `SpeciesCombobox` active-option treatment byte for
byte, so one listbox vocabulary serves the three pickers and the palette. **It carries
`transition: none`** and that is deliberate: an arrow key must move the highlight in the
same frame as the press. Hover is `--sr-surface-subtle` at 120ms; the active rule follows
hover in source order at equal specificity, so active wins.

**Cap line (`.sr-palette-note`).** `margin: 4px 14px 0; padding: 9px 0 4px`, 1px
`--sr-border-subtle` top rule, `0.75rem / --sr-text-muted`. Outside the listbox, no role,
not focusable, not reachable by the arrows.

**Status region (`.sr-palette-status`).** A `role="status"` div that is **always mounted
and empty** until it has a sentence, because a live region created together with its first
message never announces. All padding and typography live on the child
`.sr-palette-status-line` (`0.8125rem / 1.55 / --sr-text-muted`, flex row, gap 8), so the
idle region computes to zero height **without any rule hiding it**. The message is a
sequence-keyed child (`{msg ? <span key={seq}>…</span> : null}`), so an identical repeat
still announces. No rule anywhere sets a hiding value on it or any ancestor. It sits
outside every `inert`-able element, which is free here because the palette has none.

**Footer legend (`.sr-palette-foot`).** `padding: 8px 14px`, `--sr-surface-faint` on a 1px
`--sr-border-subtle` top rule, `0.6875rem / --sr-text-muted`, flex with `wrap` and
`gap: 6px 16px`. Three legends: `↑ ↓ Move`, `↵ Open`, `Esc Close`, each key in a
`.sr-palette-kbd` cap (`min-width: 1.25rem; height: 1.125rem`, 1px `--sr-border-medium`,
`--sr-surface-subtle`, `--sr-text-muted`, `0.625rem / 700`). **Rendered only when the chord
hint resolves to `cmd` or `ctrl`** — the same suppression as FR-46, extended one step: a
touch user with no keyboard is not shown a key legend either. It contains no interactive
element and adds no tab stop.

### Phone (≤640px): a full-height sheet

`.sr-palette-root` drops its padding and goes `align-items: stretch`; the panel goes
`width: 100%; height: 100%; max-height: 100%`, `border: 0`, `border-radius: 0`. Rows go
`min-height: 2.75rem` and the close button `2.75rem` square, the app's 44px touch posture
in `rem` so it holds at 200% text scale. The head tightens to `10px 12px`. The panel needs
its own `.sr-ios-app`-gated bottom inset if the footer legend is present; the root's top
inset is already handled above.

### Entry points (`.sr-nav-search`)

One control, three sizes, the way `.sr-nav-item` is one row at three densities. It
deliberately does **not** reuse `.sr-nav-item`: it is not a destination, and it must read
as "typing happens here."

Base: `display: flex; align-items: center; gap: 8px`, `width: 100%`, `min-height: 32px`,
`margin-bottom: 10px`, `padding: 0 8px 0 9px`, `1px solid var(--sr-border-input)`,
radius 8, `--sr-surface-faint` fill, `--sr-text-muted`, `0.84375rem / 500`. Hover:
`--sr-surface-subtle` fill, `--sr-text-muted` border, `--sr-text` label, 120ms ease-out.
Contents: the Search glyph at the density's `NAV_ICON` preset, `.sr-nav-search-label`
("Search", `flex: 1`, ellipsis), and `.sr-nav-search-hint`.

- **Sidebar.** Rendered between the brand/tagline block and `<nav class="sr-nav-list">`,
  therefore **outside** the `role="tablist"` div, which holds `role="tab"` children only.
  Glyph at `NAV_ICON.sidebar` (15 / 2.25). Carries the key hint.
- **Rail.** 40×40, centred, no padding, label and hint `display: none`, and **the box
  chrome goes with the label**: `border: 0; background: none`, keeping radius 8 and the
  `--sr-surface-subtle` hover. Boxed chrome around a label-hidden control reads as an empty
  box — the rule the shared `ToggleSwitch` already follows when it drops to `bare`. What
  says "this is not a destination" is a `<hr class="sr-nav-sep">` **below** it, the nav's
  own structural-separator vocabulary. Glyph at `NAV_ICON.rail` (18 / 2). Name comes from
  `aria-label` and from the shipped `useRailTooltip` handlers (hover, `:focus-visible`,
  touch-hold), so `getByRole('button', { name })` resolves it at both densities. **No key
  hint**: the rail shows no labels at all, and enriching one tooltip would change the
  shipped surface for the other ten destinations. Stated cost: a rail-only user discovers
  the chord in Help or by widening to the sidebar.
- **More sheet.** `min-height: 44px; font-size: 0.9375rem`, keeping the box because the
  label is visible. Rendered **above** the sheet's own `<h2>More</h2>`, because that heading
  names the destination list and not the search, with the sheet's own spacing separating
  them. Glyph at `NAV_ICON.sheet` (17 / 2.1). The bottom bar's anatomy is untouched: four
  favourites plus More, no fifth cell.

**Key hint (`.sr-nav-search-hint`).** `padding: 1px 5px`, radius 4, 1px
`--sr-border-medium`, `--sr-surface-subtle`, `--sr-text-muted`, `0.625rem / 700`, reading
`⌘K` or `Ctrl K`. `aria-hidden="true"`, because the button's accessible name is "Search"
and an announced glyph would only clutter it. The chord reaches assistive technology the
correct way instead: **`aria-keyshortcuts="Meta+K Control+K"` on the button**, which is
true on every platform whatever the hint displays.

---

## Component Usage

| Shipped thing | How the palette uses it |
|---|---|
| `SpeciesCombobox` row convention | Active-option fill and inset outline, primary/secondary flex, `max-width: 40%` on the secondary, truncation on both spans. Reused as classes, not forked. |
| `SpeciesCombobox` listbox entrance | The panel entrance: 140ms, `cubic-bezier(0.2, 0, 0, 1)`, origin top. No new curve. |
| `NavMoreSheet` overlay behaviours | One close path, backdrop close on **`mousedown`** where `e.target === e.currentTarget` (not `click`: a drag that starts inside the panel and ends on the backdrop must not close it), the shared `lib/useFocusTrap.ts` with `containOutsideFocus` left off, focus returned to the opener. Its box is not borrowed. |
| `ModalDialog` trigger-getter contract | The opener is passed as a getter; focus returns to it, or to a stated fallback, in an effect after the close commits. Its centred box is not borrowed. |
| `TAB_LABELS` / `TAB_ICONS` / `NAV_ICON` | Every destination name and glyph, at the `sheet` preset. The palette holds no destination list of its own. `life-list` reads **Multimedia**; `birding-stats` reads **Statistics**. |
| `setupCopy.tsx` | `EBIRD_BACKUP_LOAD_ERROR` verbatim; the no-backup sentence reuses the shipped `EBIRD_BACKUP_STEPS` wording ("Upload MyEBirdData.csv in Settings → Default Files → eBird Backup") rather than minting new copy. |
| `useRailTooltip` | The rail control's name treatment, unchanged. |
| `.sr-nav-sep` | The structural hairline under the rail control. |
| `.sr-input-16`, `.sr-only`, the global focus rings, the global reduced-motion block | Used as-is, nothing overridden. |
| **Not used:** `<BirdName>` | Excluded on the standing form-control rule (FR-27), not on effort. |

---

## Design Tokens Applied

**No new token.** Every colour resolves from a `var(--sr-*)` already defined in both
`:root` and `[data-theme="dark"]`. No hex, no `rgb()`, no `rgba()` outside the shipped
focus-ring halo that the global stylesheet already owns.

| Surface | Token |
|---|---|
| Backdrop | `--sr-scrim` |
| Panel fill / border / shadow | `--sr-surface` / `--sr-border` / `--sr-card-shadow` |
| Head rule, cap-line rule, footer rule | `--sr-border-subtle` |
| Field boundary | `--sr-border-input` (the ≥3:1 non-text form-control token) |
| Field fill | `--sr-surface` |
| Query text | `--sr-text`; placeholder `--sr-text-muted` |
| Group heading, status line, cap line, footer, close glyph | `--sr-text-muted` |
| Row name | `--sr-text` |
| Scientific name | `--sr-text-muted`, italic |
| Row hover | `--sr-surface-subtle` |
| Active option fill / outline / glyph | `--sr-accent-bg-hover` / `--sr-accent` / `--sr-accent` |
| Key cap | `--sr-surface-subtle` on `--sr-border-medium`, text `--sr-text-muted` |
| Footer strip | `--sr-surface-faint` |
| Entry control | `--sr-surface-faint` on `--sr-border-input`, label `--sr-text-muted` |

**Measured, both engines, both themes, all four species states** (`verify-design.mjs`):
every text pair inside the palette clears its WCAG AA floor, minimum **4.80:1** in light and
**5.81:1** in dark across 26 measured pairs. At **320px** against **100% and 200%** in-app
text scale, in both themes and both engines: no horizontal overflow, the panel is a
full-height sheet, and the query field plus at least one result row are visible (row height
44px → 88px, confirming the scale genuinely reaches the layout).

> **One divergence to record rather than resolve here.** `pipeline/design-system.md`'s Type
> section says scientific names are `--sr-text-gray`, while the two shipped surfaces that
> render one beside a common name (`SpeciesCombobox`'s row, Species Detail's hero) both use
> `--sr-text-muted`. The palette follows the **shipped code**, because it is explicitly
> borrowing that row. Both clear AA. This is a pre-existing doc/code divergence; a third
> answer here would be the worst of the three.

---

## Interaction Notes

Beyond the static layout, the Engineer implements:

1. **Autofocus on open**, with the query empty on every open. The focused field shows the
   global `input:focus-visible` ring; no override.
2. **Arrow keys clamp, never wrap.** `ArrowDown → Math.min(i + 1, rows.length - 1)`,
   `ArrowUp → Math.max(i - 1, -1)`. Reset to `-1` on every query change. Active option
   scrolled into view with `document.getElementById(optionId(i))?.scrollIntoView?.({ block: 'nearest' })`.
   *Measured in the mockup, both engines: ArrowUp at the top leaves no active option;
   ArrowDown past the end stays on the last.*
3. **Enter** activates the active option, else `rows[0]` when there are results, else does
   nothing and the palette stays open.
4. **Two tab stops inside the overlay**, both explicit: the `<input>` and the close
   `<button>`, each with a literal `tabIndex={0}`. No `role="option"` row carries a
   `tabindex`, so it is in neither WebKit's tab order nor `FOCUSABLE_SELECTOR`'s list, and
   the keydown trap's prediction matches the engine exactly. **The palette renders no
   `<details>` / `<summary>`** — WebKit visits `<summary>` and the selector does not match
   it, which is the one gap the trap cannot close. *Measured in the mockup, both engines:
   exactly two tab stops, zero focusable rows, zero anchors and zero nested buttons inside
   the listbox.*
5. **One close path** for Escape, backdrop `mousedown`, the close button, choosing any row,
   and a second chord press. Focus restore runs in `App.tsx` in an effect after the close
   commits, never at close time.
6. **The four species states are the render of one value**, not four flags, so the loading
   line cannot coexist with an answer. The status region shows exactly one sentence:
   the parse-in-flight line, the no-backup line, the load-failure line, or the no-matches
   line, and nothing otherwise.
7. **Group visibility rules.** The Destinations group renders only when at least one
   destination matches; the Species group renders when it has rows, or when the species
   half has a sentence of its own. An empty query with a loaded index shows destinations
   only — the placeholder ("Search destinations and species") already says what typing will
   reach, so a "type to search species" row would be a line that exists to state its own
   absence. A non-empty query that matches destinations but no species omits the Species
   group entirely rather than heading nothing.
8. **The parse-in-flight glyph** is the shipped `Loader2` + `.spin` at 14px in
   `--sr-text-muted`, `aria-hidden`. The sentence beside it carries the state, so the global
   reduced-motion block freezing the rotation loses nothing.

---

## Motion Spec

Every value below is already in `globals.css`. Nothing new is introduced.

- **Scrim appears** (`.sr-palette-root`): `ease-out`, **160 ms**, opacity 0 → 1, no
  transform origin. Reduced motion: instant. CSS animation. *(The shipped
  `.sr-nav-sheet-root` / `.sr-dlg-root` fade.)*
- **Panel entrance** (`.sr-palette-panel`): `cubic-bezier(0.2, 0, 0, 1)`, **140 ms**,
  `opacity 0 → 1` with `transform: scaleY(0.98) → scaleY(1)`, `transform-origin: top
  center`. Reduced motion: instant, and nothing is lost because the animation's end state
  **is** its resting state. CSS animation. *(The shipped `sr-combobox-list-in`, reused so
  the picker and the palette cannot drift.)*
- **Row hover** (`.sr-palette-row`): `ease-out`, **120 ms**, `background-color`, no origin.
  Reduced motion: instant. CSS transition. *(The shipped `.sr-nav-item` hover timing.)*
- **Active option moves**: **no motion at all.** An arrow key must move the highlight in the
  same frame as the press, so `.sr-palette-row--active` carries `transition: none`.
  Unchanged under reduced motion.
- **Entry control hover** (`.sr-nav-search`): `ease-out`, **120 ms**, `background-color`,
  `border-color`, `color`. Reduced motion: instant. CSS transition.
- **Parse-in-flight glyph** (`.spin`): `linear`, **0.7 s** loop, origin centre. Reduced
  motion: frozen by the global block; the sentence beside it carries the state. Shipped
  `.spin` keyframe.
- **Close**: **no motion.** Instant conditional removal, matching the shipped picker. An
  exit animation would sit between the user and the screen they just asked for. Unchanged
  under reduced motion.
- **Rail tooltip**: the shipped `.sr-nav-tip`, unchanged (140 ms, `cubic-bezier(0.2, 0, 0,
  1)`, `transform-origin: left center`).

Implementing library: **CSS only**, in `globals.css`. No Motion, no JS animation, no new
dependency (NFR-10). A local `@media (prefers-reduced-motion: reduce)` block states the
guarantee explicitly for `.sr-palette-*` alongside the global one.

> **Origin-awareness, stated rather than skipped.** The doctrine asks popovers to scale from
> their trigger. The palette uses a fixed `transform-origin: top center` on purpose: it is a
> viewport-anchored modal whose own query field sits at the panel's top, so it scales from
> its own content origin; and its four possible triggers sit at three different screen
> corners (sidebar top-left, rail top-left, More sheet bottom) plus the chord, which has no
> element at all. A per-trigger origin would make one surface animate four ways with no gain
> in comprehension. `ModalDialog`'s per-trigger origin is right for a small confirmation
> that appears *near* its trigger; this is not that.

---

## Content Notes

**Voice:** short, specific, plain. Informative, never promotional. Every string lives in one
copy module so it rides the repo's em-dash and agreement sweeps, and **no em dash (U+2014)
appears in any of them**.

| Key | String |
|---|---|
| control label | `Search` |
| input label / dialog label / listbox label | `Search destinations and species` |
| placeholder | `Search destinations and species` |
| close button | `Close search` |
| group headings | `Destinations` · `Species` |
| parse in flight | `Reading your eBird backup.` |
| no backup saved | `Searching species needs your eBird backup. Upload MyEBirdData.csv in Settings → Default Files → eBird Backup.` |
| stored backup will not load | `EBIRD_BACKUP_LOAD_ERROR`, **imported verbatim**, never retyped |
| nothing matches | `Nothing matches that search.` |
| cap line | `Showing the first 50 matches. Keep typing to narrow them.` |
| footer legend | `Move` · `Open` · `Close` |

Four rules on this copy:

1. **The placeholder is state-voiced**, naming what the control searches rather than
   commanding the user, matching the shipped `SpeciesCombobox`'s "All species".
2. **The four species-half sentences are mutually distinguishable by their text alone**
   (QA-35), which is why the no-matches line says *nothing matches* rather than anything
   about species.
3. **The no-backup line reuses the shipped setup wording** rather than inventing a parallel
   phrasing that would then drift, and it names the exact Settings path.
4. **Every destination name comes from `TAB_LABELS`**, never from a component or file name
   (FR-57). `life-list` reads **Multimedia**; `birding-stats` reads **Statistics**.

**Realistic content in the mockup.** 138 Bay Area species with their real scientific names,
including `Yellow-rumped Warbler (Audubon's)` and `(Myrtle)` so the "every distinct name the
parse yields" decision (FR-30) is visible rather than asserted. The demonstration queries
were chosen for what they prove: `cal` returns one destination plus species reached on their
**scientific** name alone (*Calypte anna*, *Calidris alpina*, *Corthylio calendula*); `war`
shows **Warbling Vireo** sorting under W rather than jumping the queue for its prefix match,
and reaches **Ring-billed Gull** through *Larus dela**war**ensis*; `a` overflows the 50 cap.

---

## Deviations from `pipeline/design-system.md`

Logged in `pipeline/command-palette/decisions.md`. In summary: one new pattern (a
top-anchored modal search overlay, a box the system does not have), one new control
(`.sr-nav-search`), zero new tokens, zero new dependencies, and one carried-over doc/code
divergence on the scientific-name token, resolved toward the shipped code.

---

## Pre-flight self-audit

`weft-design-lint check pipeline/command-palette/design.html` → **clean, 0 findings.**

| Check | Result |
|---|---|
| Distinctive display face | Mockup chrome uses a serif display stack. The app's face is **Inter**, a deliberate logged deviation: `design-system.md` wins on specifics and SnowRaven has shipped Inter for 100+ versions. |
| Three typographic roles with real contrast | Five in the panel: field 1rem/500, row name 0.875rem/500, group heading 0.6875rem/600 uppercase +0.06em, scientific name 0.71875rem italic, key cap 0.625rem/700. |
| Neutrals tinted, no pure black or dead gray | Every neutral is a shipped zinc-tinted `--sr-*` token; `--sr-scrim` is the app's own ink at an alpha, never black. |
| One dominant colour, sharp accent on the key thing | Accent appears in exactly three places: the focused field's ring, the active option's tint and outline, the active option's glyph. |
| Background has depth | A layered stack: scrim over the live page, panel on `--sr-card-shadow`, a `--sr-surface-faint` footer strip and hairline rules. Not a slab. |
| Enter/exit ease-out under 300 ms | 140 ms panel, 160 ms scrim, 120 ms hovers. |
| Origin-aware popovers | `transform-origin: top center`, a reasoned exception argued above rather than an omission. |
| `prefers-reduced-motion` fallback | The global block plus an explicit local one. |
| No motion anti-slop | No pulse, blur-in, hover-scale, stagger, spring on a utility action, or motion-on-mount for static content. The one loop is the shipped `.spin` on a real in-flight parse. |
| Content-driven layout, no nested cards | A single-focus modal list; the panel contains no card. |
| Realistic content; empty, error and loading states designed | 138 real species with real scientific names; all five non-happy states designed and shown side by side in the mockup. |
| Components customised | No library. Every class is a shipped SnowRaven class or a new `.sr-palette-*` built on shipped tokens. |
