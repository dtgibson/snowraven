# Design Refinement — Searchable Species Filter (Map Explorer)

**APPROVED — the user reviewed the first design direction and accepted it as
presented, including the shared 140ms listbox entrance motion.**

Companion mockup: `pipeline/searchable-species-pickers/design.html` (interactive,
both themes, desktop sidebar + 320px phone sheet, 200% text-scale preview).

## Visual Direction

Quiet utility, unchanged. The My Sightings Species filter becomes the same
type-to-find picker Species Detail and the Calendar already use — search icon,
text input, filtered listbox with the italic "All species" clearing row — sitting
in the panel at exactly the register of its neighbours, so the only visible change
is the affordance to type. Nothing else in the panel moves or restyles.

## Screens / Views

### Map Explorer filter panel — desktop sidebar (clamp 240–300px)

The native `<select>` at `MapExplorer.tsx:1880` is replaced by the shared
`SpeciesCombobox` under the existing `SidebarLabel` ("Species"), full panel
width. Date Range, County, Breeding Code, and Media are untouched.

**Design question 1 — sizing register (settled): a third size, `panel`.**
`SpeciesCombobox` gains `size="panel"` mapping to the SELECT_STYLE register
exactly:

| Property | `panel` value | Matches |
| --- | --- | --- |
| height | 34px | SELECT_STYLE height 34 |
| font-size | 0.8125rem | SELECT_STYLE font |
| border-radius | 6px (open: `6px 6px 0 0`; listbox: `0 0 6px 6px`) | SELECT_STYLE radius 6 |
| border | 1.5px `--sr-border-input` closed / `--sr-accent` open | SELECT_STYLE border |
| search icon | 14px at left 9; input padding-left 30px | proportional to 34px box |
| max-width | none (fills the panel like the selects) | `sm`'s 220px cap would break the column |

Rationale: `sm` (30px, 0.75rem, 220px max-width) sits visibly short and narrow
beside 34px full-width controls; `md` (40px) is the Species Detail hero scale,
too heavy for the compact sidebar. The `sm` and `md` code paths are untouched,
so **Species Detail and the Calendar are regression-free by construction** —
the one deliberate shared-surface exception is the listbox entrance motion
(see Motion Spec, flagged for approval).

**Design question 2 — the listbox vs. the clip wrapper (settled): release the
clip while the panel is open.**
The filter panel collapses via `grid-template-rows 0fr/1fr` with an inner
`overflow: hidden` wrapper; an absolutely positioned listbox inside it would be
cut at the panel's bottom edge. The clip exists only for the collapse animation,
so it applies only then:

- Wrapper `overflow` becomes `visible` once the panel is open and the
  grid-rows transition has finished; it returns to `hidden` the instant
  `filterOpen` goes false, so the collapse still clips correctly.
- Mechanism: a `panelSettled` flag set by `onTransitionEnd` on the grid
  wrapper (property `grid-template-rows`), cleared when the panel closes —
  `overflow: filterOpen && panelSettled ? 'visible' : 'hidden'`. The listbox
  can only open while the panel is open (the collapsed content is `inert`),
  so the release window covers every reachable case.
- The open list paints over the filter blocks below it (the combobox root's
  existing `zIndex: 20` + listbox `zIndex: 1200`; the sections below are
  unpositioned) and keeps its existing 260px max-height internal scroll.
  Where it extends past the sidebar's visible bottom, the sidebar scroll area
  (`overflowY: auto`) contains it, so every row stays reachable.

Rejected: a portal (breaks the component's outside-click containment, no app
precedent for portaled popovers); a dynamic max-height computed to the panel
bottom (starves the list to ~3 rows at 200% text scale on a short panel);
rendering the list in flow (diverges from the shared picker's behavior).

### Map Explorer filter panel — phone fullscreen sheet (`.sr-map-sidebar-overlay`)

Same DOM, same decisions. The sheet is its own scrollport
(`overflow-y: auto`, width `min(282px, 90vw)`), so the released listbox is
contained and scroll-reachable at 320px. At 200% in-app text scale the
`.sr-input-16` guard raises the input text via the `max(16px, …)` formula
(the class rides the combobox's `className` prop onto the `<input>` itself,
as the outgoing select carried it), listbox rows grow with their rem sizes,
and the 260px internal scroll keeps the list usable. The stacked date pair
and every other phone-tier rule are untouched.

## Component Usage

- **`SpeciesCombobox` (shared)** — the only component change is the additive
  `size="panel"` mapping above plus the listbox entrance animation (Motion
  Spec). `sm` / `md` values byte-identical.
- **Wiring in `MapExplorer.tsx`:** `value={speciesFilter || null}`,
  `onChange={n => setSpeciesFilter(n ?? '')}`, `allLabel="All species"`,
  `placeholder="All species"`, `ariaLabel="Species"` (the outgoing select's
  aria-label), `className="sr-input-16"`.
- **Options carry scientific names**: build
  `{ name, sciName }` from the loaded observations alongside `allSpecies`
  (memoized), so typing narrows by common **or** scientific name — the
  combobox's contract, and the change brief's.
- `SidebarLabel`, `SELECT_STYLE` (County / Media), `SegControl`, date inputs:
  unchanged.
- Icons: the component's own lucide `Search` / `ChevronDown` / `Check`.

## Design Tokens Applied

All existing; no new tokens.

- `--sr-border-input` — closed control border (≥3:1 non-text, as SELECT_STYLE)
- `--sr-accent` — open border, selected row text, check glyph
- `--sr-accent-bg` / `--sr-accent-bg-hover` — selected / keyboard-active rows
- `--sr-surface` — control and listbox fill; `--sr-surface-subtle` — row hover
- `--sr-text` — input and row text; `--sr-text-muted` — placeholder, search
  icon, chevron, scientific names, empty state

## Interaction Notes

Keyboard and screen-reader behavior is **identical to the Species Detail
picker because it is the same component**: `role="combobox"` input with
`aria-expanded`, `aria-autocomplete="list"`, `aria-haspopup="listbox"`,
`aria-controls`, `aria-activedescendant`; `useId`-namespaced listbox/option
ids (collision-safe beside the target-species picker); ArrowDown/ArrowUp move
the active option with `scrollIntoView({ block: 'nearest' })`; Enter commits
the active option, else the typed query's first *species* match (never the
clearing row), and is a no-op on zero matches; Escape and Tab close; outside
click closes; focus selects in-progress text. The "All species" row is always
present and unfiltered, so the filter is always clearable. Empty state:
"No species match this search." Open-state focus is carried by the accent
border (the component's shipped pattern). Rows render escaped plain text —
no `<BirdName>` inside form controls (the ratified v1.0.4 pattern).

## Motion Spec

- Listbox open: `cubic-bezier(0.2, 0, 0, 1)` ease-out, 140ms, transform-origin
  top center (scales from the input above), reduced-motion: instant appear, CSS.
- Listbox close: instant removal (as shipped), no animation, CSS.
- Chevron rotate on toggle: ease, 150ms, own center, follows
  `prefers-reduced-motion` via the component transition, CSS (shipped, unchanged).
- Input border color on open/focus: ease, 150ms, n/a, persists, CSS (shipped, unchanged).
- Filter panel collapse: grid-template-rows, 0.25s ease (shipped, unchanged —
  the overflow release must not alter the perceived open/close animation).

**Flagged deliberate deviation (needs the user's nod):** the 140ms entrance is
new and lives in the shared component, so Species Detail and the Calendar gain
the same subtle open motion — kept shared so the three pickers cannot drift.
If strict visual byte-identity at those two sites is preferred, the animation
gates on `size === 'panel'` instead; shared is the recommendation. Log the
choice in `pipeline/searchable-species-pickers/decisions.md`.

## Content Notes

- Placeholder is **"All species"** — state-voiced, so the panel keeps reading
  as a column of current values (County: "All counties", Media: "Any"); the
  muted placeholder color plus search icon carry the type-here affordance.
- Copy is the component's existing voice; the one string surface is the shared
  empty state. No em dashes in any user-facing copy.
- Docs ride along in the same change per the docs rule: `docs/HELP.md`
  (My Sightings filters, ~line 386) describes typing to narrow instead of
  scrolling; README and website wording follow.
