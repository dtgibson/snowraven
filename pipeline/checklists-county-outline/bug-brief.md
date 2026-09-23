# Bug Brief — Checklists county outline

## What is broken
On Checklists, choosing a county and then "All counties" leaves the county picker's outline in the text colour (`--sr-text`: near-black in light theme, near-white in dark) instead of its resting `--sr-border`. It stays that way until reload.
The Protocol picker in the same Effort row has the identical defect (`Checklists.tsx:679`). Pre-existing since the tab shipped (0.5.27, `083fdc7`); not a v1.0.34 regression.
Same mechanism, different trigger: the closed species picker (`SpeciesCombobox.tsx:189-193`) draws its bottom edge in `--sr-text` while the other three sides are `--sr-border-input`. This is on from first paint on Calendar, Species Detail, the Weather stats section and the Map Explorer panel (since 0.5.61, `ac098af`).

## Steps to reproduce
1. Open Checklists with a backup loaded, at desktop width (1280) or phone width (390).
2. In "Where & when", choose any county. The outline tints to `--sr-accent-border` as designed.
3. Choose "All counties". The outline settles at `--sr-text`, not `--sr-border`. Doing the same with a protocol and then "All protocols" gives the same result.
4. For the species picker: open Calendar and look at the closed picker's bottom edge, or open the list and close it again.

## Expected behavior
After "All counties" or "All protocols", the picker draws exactly what it drew on first paint: `1.5px solid var(--sr-border)`, the base `selectStyle` value. That is also the resting token for Multimedia, Species Detail and Breeding Codes, and for the Checklists date fields (`dateRangeFieldsCss.test.ts`). The Map sidebar is static at `--sr-border-input`.
The set state is unchanged: `--sr-accent-border` plus accent text and weight 600. The closed species picker's bottom edge matches its other three sides (`--sr-border-input`), and the open state keeps its transparent bottom.

## Root cause
React applies inline styles key by key. The override spreads a `borderColor` longhand over `selectStyle.border`. On clear, React runs `style.borderColor = ''` and does not re-apply `border`, because that value has not changed. The four colour longhands are deleted, and Tailwind preflight's `currentcolor` shows through. React 19.2.5 warns in dev: "Removing a style property during rerender (borderColor) when a conflicting property is set (border)".
**`var()` is not the cause** (correcting ROADMAP item 1). The same shape with literal colours loses its colour identically.
Species picker: `borderBottomColor: open ? 'transparent' : undefined` writes `''` after `border` on every closed render. React does not warn for this trigger.

## Blast radius
Sweep method: a TypeScript AST scan of every `style=` in `frontend/src` against React's own shorthand-to-longhand map, with a grep cross-check and a manual review of 29 style expressions the scan could not resolve. It found exactly three sites: `Checklists.tsx:679`, `Checklists.tsx:703` and `SpeciesCombobox.tsx:193`.
`selectStyle` is used only by those two Checklists selects. The phone-tier rule `.sr-whenwhere-county > select` sets no border colour, so no CSS change is needed. Imperative focus and hover handlers write explicit tokens, never `''`, so they are outside this mechanism.
`data-set` (ROADMAP item 3) does not need to change. If the fix moves the tint into CSS keyed on that attribute, the attribute becomes load-bearing, and a guard that renders the real Checklists row is then owed.
Adjacent, out of scope: `calHatchCss`/`calMiniHatchCss` put `backgroundColor` before `background`, so the shorthand erases the textures-mode tint underlay (FR-25) on every render. That is static key order rather than a clear. It was measured transparent in both engines and should be carried to ROADMAP.

## What done looks like
In Chromium and WebKit, at 1280 and 390, in light and dark: set, then clear, returns county and Protocol to the first-paint colour (`--sr-border`). First-paint and set drawings are byte-identical to HEAD. The closed species picker's bottom edge equals its sides.
A guard goes red on HEAD. jsdom does not expand a `var()` border shorthand, so a longhand read is blind. Instead, assert that the serialized `style` after set-then-clear equals a never-set render, or use a static scan for a shorthand plus a clearable overlapping longhand.
