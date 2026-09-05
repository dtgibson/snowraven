# Design Refinement: Species Detail Escapee Toggle

Improve lane, design pass (Stage 2). The surface is the Species Detail toolbar
row and nothing else. Mockup: `pipeline/species-detail-escapee-toggle/design.html`
(self-contained; light/dark toggle top right; every switch live).

## Visual Direction

Quiet utility, extended rather than reinvented. The third switch is the shipped
boxed `ToggleSwitch` with the same chrome, gap and row as its two neighbours,
placed after "Show all forms" so the two reveal toggles on the countability axis
sit together and "Show subspecies" (a merge control on its own axis) stays first,
as `countabilityCopy.ts` asks. Green stays reserved for the on-track and the focus
ring; the count keeps its muted register and its right edge. Nothing new is drawn:
no note, no panel, no token, no pattern.

## Screens / Views

### Species Detail toolbar row (`SpeciesDetail.tsx`, the ready-state toolbar)

**Today.** `.sr-ctl-row` (inline: `display: flex; align-items: center; gap: 10;
margin-bottom: 14; flex-shrink: 0; flex-wrap: wrap`) holding two boxed switches,
"Show subspecies" and "Show all forms", and a trailing span (`margin-left: auto;
font-size: 0.75rem; color: var(--sr-text-muted)`) reading "267 species" on the
reference export. The `SpeciesCombobox` (size `md`, 40px) sits directly beneath.

**Refined.** The same row with a third boxed switch, label `Show escapees`, after
"Show all forms". At the default (off) the span reads "264 species" on the
reference export, which is the Statistics headline; on, "267 species". The span
gains `aria-live="polite"` (parity with Multimedia's count span,
`LifeList.tsx`). The selector beneath is unchanged in every way; it renders the
options it is handed.

**Layout at three widths, measured** (headless Chromium over the mockup, whose
row, switch and phone-tier declarations are copied from the shipped inline
styles and `globals.css`; content-column widths are the app's 24px side padding
at each viewport):

| Content column | Text size | Control text | Lines in the row | Overflow |
|---|---|---|---|---|
| 760px (desktop) | 100% | 12px | 1 (three switches + count) | none |
| 760px (desktop) | 200% | 24px | 2 (count drops to its own line, right edge kept) | none |
| 592px (640 viewport, phone tier) | 100% | 16px | 2 (three switches; count on line 2, right-aligned) | none |
| 592px (640 viewport, phone tier) | 200% | 24px | 2 | none |
| 272px (320 viewport, phone tier) | 200% | 24px | 4 (one switch per line; count on line 4, right edge) | none |

No switch label clips at any of the five. The wrap is the row's existing
`flex-wrap: wrap`; the phone-tier size is the existing `.sr-ctl-row :is(button,
select, input) { font-size: max(16px, 0.75rem) !important }` guard reaching the
third switch as a descendant, exactly as it reaches the first two. No new layout
rule is needed. The three switches read as one group at every width because
they share one chrome, one gap and one wrapping container, and the count keeps
the trailing position on whichever line it lands.

**Key decisions for this screen**
1. Label `Show escapees` (Content Notes).
2. No rule note under the row and no `ExoticProvenanceAccount` panel on this tab
   (decisions.md, item 2). The toggle is the whole account.
3. Order: Show subspecies, Show all forms, Show escapees.
4. The switch always renders, from the first paint, whether or not Statistics
   has ever run the check (an empty set makes it a no-op). A control that appears
   after a Statistics visit would be a layout shift and a discoverability gap.
5. The count is derived from the rows (`displaySpeciesList.length`), so the
   figure and the selector agree by construction.
6. Observed and left alone: the boxed switch is 30px tall on phones (no
   `.sr-touch-target`), which is today's shipped posture for its two neighbours.
   Out of scope for this refinement; noted for a future pass on the shared control.

## Component Usage

- `components/ui/ToggleSwitch.tsx`, boxed default, three instances. The third:
  `<ToggleSwitch label={SHOW_ESCAPEES_TOGGLE_LABEL} checked={showEscapees}
  onChange={handleToggleEscapees} />`. Native `<button role="switch"
  aria-checked tabIndex={0}>`; Space and Enter come from the button.
- `SpeciesCombobox` (size `md`, `.sr-input-16`): unchanged.
- The count span: unchanged geometry, plus `aria-live="polite"`.
- Not used: `.sr-count-rule-note`, `COUNT_RULE_SENTENCE`,
  `ExoticProvenanceAccount`, any helper line, any icon.
- **Deviation, confirmed by the user at the design gate (decisions.md, item 5):** a hover
  state on the boxed `ToggleSwitch`, app-wide. Today the boxed variant has no
  pointer feedback beyond `cursor: pointer`; the doctrine asks for hover and
  focus set on purpose. Treatment: border to `--sr-border-medium`, fill to
  `--sr-surface-subtle`, 120ms ease-out. Mechanism: move the boxed variant's
  `border` and `background` from the inline style object onto a class
  (`sr-toggle`, in `globals.css`) so a `:hover` rule can win (an inline value is
  specificity 1,0,0 and would beat any class rule); every other inline value,
  the track and the knob stay byte-identical. Confirmed, so The Engineer
  builds the mockup's `.sr-toggle:hover` rule.

## Design Tokens Applied

Every value is an existing token, present in both themes:
- Switch chrome: `--sr-surface` fill, `--sr-border` 1.5px, radius 6, height 30.
- Label and count: `--sr-text-muted`, 0.75rem, weight 500 (label) / 400 (count).
- Track: `--sr-gray-400` off, `--sr-accent` on (180ms ease-out).
- Knob: `--sr-switch-thumb` + `--sr-switch-thumb-shadow` (theme-neutral white).
- Focus: the global ring (`outline: 3px solid var(--sr-accent); offset 3px`).
- Hover (only if the deviation is approved): `--sr-border-medium`,
  `--sr-surface-subtle`.
- Type: the app's `--font-sans` (Inter / system-ui), the design system's face.
- Phone tier: `max(16px, 0.75rem)` through the existing `.sr-ctl-row` guard.
No new token. No new class except the optional `sr-toggle` hook above.

## Interaction Notes

1. **State.** `const [showEscapees, setShowEscapees] = useState(false)`. Its own
   state, session-only, never persisted, never shared with Statistics
   (change-brief: Preference).
2. **Off (default).** A species whose normalized name is in the confirmed
   escapee set from `useProvenanceLookup` is absent from the selector's options
   and from the count. Composes with the countable-form filter as a layer on
   `displaySpeciesList`; `countableKeys` untouched.
3. **On.** Rows and number return. No other surface moves.
4. **Off while an escapee is selected:** deselect, mirroring `handleToggleSpuh`
   (the mockup does this: pick Muscovy Duck with the switch on, then switch off).
5. **Under Show subspecies:** a raw key hides when
   `escapeeNames.has(normalizeSpeciesName(key))`, so "Muscovy Duck (Domestic
   type)" hides with its parent (the mockup shows this).
6. **Always rendered.** Never gate the switch on the set's size.
7. **Count live region.** `aria-live="polite"` on the count span. The text
   changes only when the number changes, so a press that hides nothing (empty
   set) announces nothing, which is the right silence.
8. **Cross-tab reveal (`openSpeciesInTab`).** A target present in
   `sortedSpeciesList` and hidden only by this switch turns the switch on and
   selects it (change-brief OQ1 default). The escapee list on Statistics links
   each name here; that link must land on the species, never on an empty
   selector.
9. **Keyboard.** Tab reaches every switch (`tabIndex={0}`); Space or Enter
   toggles; the global focus ring shows. `aria-checked` mirrors state.
10. **Empty / loading states:** none new. Before `phase.tag === 'ready'` the
    toolbar does not render, as today. With an empty escapee set the tab is
    byte-identical to today except for the presence of the third switch.

## Motion Spec

One line per interaction (easing, duration, origin, reduced motion, library).
The app has no motion library; everything is CSS.

- Switch knob: `left` 180ms ease-out; origin the knob's own resting edge inside
  the track; reduced motion: the global rule collapses it to ~instant; CSS,
  shipped and unchanged.
- Switch track fill: `background` 180ms ease-out; same origin and fallback; CSS,
  shipped and unchanged.
- Switch hover (only if approved): `border-color` and `background` 120ms
  ease-out; in place; reduced motion instant; CSS.
- Focus ring: instant, no transition; CSS, shipped.
- Count text: no motion. The number changes on the same frame as the rows (the
  design system's rule that a consequence appears at the instant the switch
  flips, with zero animation).
- Selector options: no motion. `SpeciesCombobox` re-renders its options
  instantly; its own 140ms `cubic-bezier(0.2, 0, 0, 1)` listbox entrance from
  the input's edge (transform-origin top center; reduced motion instant) is
  shipped, unchanged and outside this change.

## Content Notes

- **The label string, exactly:** `Show escapees`. Sentence case, no attribution,
  no trailing punctuation, 13 characters (the shortest of the three switches).
  Single-source it as `SHOW_ESCAPEES_TOGGLE_LABEL` in `lib/exoticCopy.ts` with a
  doc comment recording the choice; the copy-hygiene sweep already covers that
  module. `SpeciesDetail.tsx` is lazy-loaded (`App.tsx`), so `exoticCopy.ts`'s
  lazy chunk is the right home and the entry-chunk reason that keeps the
  Multimedia labels in `countabilityCopy.ts` does not apply here.
- **Why this label.** (1) It uses this tab's verb: `countabilityCopy.ts` records
  that Multimedia and Species Detail move ROWS and say "Show", while Statistics
  and the Calendar move a NUMBER and say "Count". Here the rows move and the
  number follows. (2) It keeps the noun of `Count escapees`, so the two tabs read
  as one rule in two verbs, the exact `Count all forms` / `Show all forms`
  pattern already in force. (3) Positive and non-enumerating: turning it on says
  what turning it on does, and it survives the set changing. (4) No "eBird" in
  the label: neither neighbour carries attribution, and `exoticCopy.ts` records
  that the attribution is made once, precisely, in the Statistics rule line.
- **Rejected.** `Show eBird escapees` (attribution the neighbours do not carry,
  and 19 characters at the 320px tier where every character is a line). `Include
  escapees` (breaks the Show family; "include" is a count verb in disguise).
  `Count escapees` here (wrong verb for a control whose first effect is rows).
- **No note sentence.** Nothing renders under the row in either switch state.
  The toggle is the account; the evidence and the rule line live on Statistics,
  one tab away, and its list links back here (decisions.md, item 2).
- **Accessible name** is the visible label (Label in Name); no `aria-label`
  override.
- **Voice.** Informative, never promotional; no em dashes; straight apostrophes.
- **For `docs/HELP.md` (the Species Detail toolbar bullet), a suggested
  sentence for the Engineer / Chronicler:** "A third switch, Show escapees, is
  off by default. Once Statistics has checked exotic status on this device, a
  species that eBird tags Exotic: Escapee on every checklist you recorded it on
  is left out of the selector and the species count, so that count matches the
  Statistics headline. Turn it on to put those species back. They stay on your
  Life List either way."
