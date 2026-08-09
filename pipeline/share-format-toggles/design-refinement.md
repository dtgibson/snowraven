# Design Refinement — Share Format Toggles

Refines two existing surfaces: the Settings "Copying a location" row and the
share pin popup. Mockup: `pipeline/share-format-toggles/design.html` (all eight
states are rendered by the rule below, running in the page, so they are
checkable rather than asserted).

No new screen, no new capability, no new token. Extends
`pipeline/design-system.md`, does not reinvent it.

---

## Visual Direction

Unchanged. Quiet utility: the Settings row keeps its title, its description and
its live example, and only the control in the middle changes from two mutually
exclusive buttons to three independent switches. The popup keeps its shape
exactly. The green stays reserved for the one actionable thing on each surface
(the on-state switch track, the copy button).

The one visual judgement worth naming: the three switch rows are separated by
`--sr-border-subtle` hairlines and sit in **no box of their own**. A bordered
group would have been a card inside a card, and the Settings card already
provides the container.

---

## Screens / Views

### Settings › Sharing › "Copying a location"

Vertical order, top to bottom:

1. **Title** "Copying a location" (0.84375rem / 600). Unchanged.
2. **Description** (0.75rem, `--sr-text-muted`). Unchanged text: "What gets
   copied when you copy a location from a map pin. Coordinates are decimal
   degrees to five places, latitude first."
3. **Three switch rows**, in payload order: Coordinates, Google Maps link,
   Apple Maps link. Each row is a `.sr-action-row` with the label as a
   `.sr-min0` child and a trailing `ToggleSwitch bare`. Rows two and three carry
   `border-top: 1px solid var(--sr-border-subtle)`; row one does not.
4. **"EXAMPLE"** micro-label (existing `.sr-share-example-label`). Unchanged.
5. **The example**, one of two things:
   - one or more parts on: the existing `<pre class="sr-share-example">`
     carrying the real payload, followed by the **manifest sentence**
     (`.sr-share-manifest`, 0.6875rem, `--sr-text-muted`).
   - nothing on: a single `.sr-share-empty` paragraph in the same slot, on the
     same `--sr-surface-subtle`, with a **dashed** `--sr-border-medium` border
     so it reads as an empty container rather than a message about a problem.
6. **A visually hidden `role="status"` region** (see Interaction Notes).

The switch rows carry **no per-row description**. Three sub-lines would triple
the card height to explain what the live example already shows literally. This
is also the answer to the brief's third surface: the Settings sub-labels never
reach eight states, because each switch describes only its own line. There are
three descriptions, permanently, and they live in the `aria-label`.

### The share pin popup

Unchanged except for the region between the coordinate and the bottom edge:

- **One or more parts on**: `.sr-share-copy-btn` with the generated label, then
  `.sr-share-mode-line` with the generated manifest. Identical structure to
  today.
- **Nothing on**: the button is **replaced** by `.sr-share-none`, a centred
  muted sentence bounded by dashed rules top and bottom so the slot still reads
  as the action area. Not a disabled button. No control that looks pressable may
  put an empty string on the clipboard, and a greyed control invites a press
  that explains nothing.

The coordinate readout (`.sr-share-coord`) renders in **all eight states**,
including all-off. It is payload independent by construction, so the pin still
shows the spot and the text stays selectable by hand.

Both densities keep every element. Compact reduces size, never meaning.

---

## THE GENERATING RULE

The centre of this refinement. Eight hand-written labels and eight
hand-written mode lines would be correct on the day they were typed and would
drift thereafter. Implement the rule, not a lookup table.

### One table, the single source

```ts
const SHARE_PARTS = [
  { key: 'coords', label: 'Coordinates',      noun: 'coordinates',
    qualifier: null,          family: null,   aside: 'the coordinate pair' },
  { key: 'google', label: 'Google Maps link', noun: 'Google Maps link',
    qualifier: 'Google Maps', family: 'link', aside: 'a Google Maps link' },
  { key: 'apple',  label: 'Apple Maps link',  noun: 'Apple Maps link',
    qualifier: 'Apple Maps',  family: 'link', aside: 'an Apple Maps link' },
] as const
```

- `label` — the visible switch text. Starts its own row, so sentence case.
- `noun` — the manifest form. Sits mid sentence after a colon.
- `qualifier` / `family` — exist only so the button can say "map links" rather
  than naming both providers.
- `aside` — the accessible-name fragment.

**`label` and `noun` are separate columns on purpose.** The tempting version is
one string plus `.toLowerCase()`. That reads correctly on today's three and
silently produces `Bing maps link` on the fourth, because "lowercase unless it
is a proper noun" is not derivable from a string. This was caught by running the
rule against a hypothetical fourth destination during the design pass, not by
inspection. Keep both columns.

### Two functions

```ts
copyLabel(on) = 'Copy ' + phrase(on)

phrase(on):
  group the on-parts by family, preserving payload order
    family with ALL members on  -> 'map links'      (the class noun)
    family partly on            -> list(qualifiers) + ' link' | ' links'
    no family                   -> the part's noun
  join groups with ' and '
  if any group already contains ' and ', join with ', and '

modeLine(on) =
  countWord(n) + (n === 1 ? ' line: ' : ' lines: ')
  + on.map(p => p.noun).join(', ') + '.'
```

`countWord` runs to at least six before falling back to a digit, so a fourth
destination does not put "4 lines" into a sentence of word forms.

`listPhrase` is the ordinary English serial list: `a` / `a and b` /
`a, b, and c`.

### The eight states this produces (verified, not asserted)

| coords | google | apple | Button | Mode line |
|---|---|---|---|---|
| on | on | on | Copy coordinates and map links | Three lines: coordinates, Google Maps link, Apple Maps link. |
| on | on | off | Copy coordinates and Google Maps link | Two lines: coordinates, Google Maps link. |
| on | off | on | Copy coordinates and Apple Maps link | Two lines: coordinates, Apple Maps link. |
| on | off | off | Copy coordinates | One line: coordinates. |
| off | on | on | Copy map links | Two lines: Google Maps link, Apple Maps link. |
| off | on | off | Copy Google Maps link | One line: Google Maps link. |
| off | off | on | Copy Apple Maps link | One line: Apple Maps link. |
| off | off | off | *(no button; sentence instead)* | *(no line; sentence instead)* |

Longest button label: **37 characters**, which fits the 224px compact popup in
two lines and the 268px full popup in one to two. That ceiling is exactly what
the family collapse buys. The uncollapsed serial list would have run to 55
characters and three lines inside a card map popup, which is why "Copy
coordinates, Google Maps link, and Apple Maps link" was rejected.

### Why two functions rather than one

They answer two different questions, so neither is redundant with the other:

- **`copyLabel`** says what the press produces. It is allowed to collapse
  ("map links") because it is a button and length is a real constraint.
- **`modeLine`** says what the result looks like when pasted, and names every
  part in full. This is the one thing a short button cannot carry, and it is
  precisely what makes the collapsed "map links" safe: the sentence directly
  below always spells out which two.

If the button had enumerated precisely, the mode line would have become a
restatement and should have been deleted. It is not, so it stays.

### The eighth state is not a ninth string

`n === 0` is a **structural** change, not another label. The button is replaced
by a sentence and the example block is replaced by a sentence. Do not implement
it as `copyLabel([]) === 'Copy '` plus a disabled attribute.

### Generalizing

Adding a destination is **one row in `SHARE_PARTS`** and nothing else: the
switch, its accessible name, the button label, the mode line, the example and
the payload all follow. Verified against a hypothetical `bing` row; the only
awkward output is the fully general two-compound-group case
("Copy coordinates, and Google Maps and Bing Maps links"), which is grammatical
and unreachable with three parts.

---

## Component Usage

| Element | Component |
|---|---|
| Switch | shared `ToggleSwitch`, `bare` variant, `labelVisible={false}` |
| Row layout | `.sr-action-row` + `.sr-min0` on the label |
| Touch sizing | `.sr-touch-target` (already inside `ToggleSwitch bare`) |
| Example block | existing `.sr-share-example` |
| Example label | existing `.sr-share-example-label` + Lucide `Copy` at 11px |
| Popup button | existing `.sr-share-copy-btn` |
| Popup mode line | existing `.sr-share-mode-line` |
| Live region | `role="status" aria-live="polite"` inside `.sr-only` |

`RadioGroup` is removed from this row only. It stays in the file; three other
Settings rows use it.

Three new classes, all layout and all in `globals.css`, none inline:
`.sr-share-part` (the hairline-separated row), `.sr-share-manifest` (the
caption under the example), `.sr-share-empty` and `.sr-share-none` (the two
all-off sentences).

---

## Design Tokens Applied

**No new token.** Every value already exists in both themes.

- Switch track on: `--sr-accent`; off: `--sr-gray-400` (already contrast-tuned
  against the white knob).
- Switch thumb: `--sr-switch-thumb` + `--sr-switch-thumb-shadow`. Do **not**
  inline `#fff`, and do **not** reuse `--sr-on-accent`, which is dark green
  `#052E16` in dark mode and would paint a dark knob.
- Example block: `--sr-surface-subtle` on `--sr-border`, text `--sr-text`,
  `--font-mono`.
- Manifest sentence and both all-off sentences: `--sr-text-muted`.
- All-off container edge: dashed `--sr-border-medium`.
- Copy button: `--sr-accent` fill, `--sr-on-accent` text; settled state
  `--sr-accent-bg` on `--sr-accent-border`. Unchanged.

Nothing paints text on a data fill, so no on-fill text pair is minted. No
warning or error token appears anywhere in the all-off treatment, deliberately.

---

## Interaction Notes

**Accessible names.** Each switch's visible label is short and ambiguous heard
alone, so the accessible name leads with the visible string and then says what
the switch does, generated as `` `${label}. Include ${aside} when copying a
location.` ``:

- "Coordinates. Include the coordinate pair when copying a location."
- "Google Maps link. Include a Google Maps link when copying a location."
- "Apple Maps link. Include an Apple Maps link when copying a location."

Leading with the visible string satisfies WCAG 2.5.3 Label in Name and matches
the `label + '. ' + sub` formula the row being replaced already used.

**The live region: announce the manifest, never the block.** The example is a
payload; reading a coordinate pair and two full URLs aloud on every switch flip
would be punishing, so the `<pre>` is **not** a live region. Silence is also
wrong: the switch announces its own on and off, which confirms the control but
never the consequence, and the all-off consequence is the one that must not be
discovered later on a map. So a visually hidden `role="status" aria-live="polite"`
region announces the **manifest sentence** (or the all-off sentence): short,
already generated, and the exact string a sighted user watches change.

It follows the v0.5.80 sequence-keyed child convention:
`{msg ? <span key={seq}>{msg}</span> : null}`, with `seq` advancing per
announcement. It renders **no child until the first user change**, so it never
speaks on mount. Honest note: with three switches every flip changes the
string, so a consecutive-identical announcement is not reachable today. The key
stays because it costs one integer, this repo has shipped that exact bug once,
and a fourth destination or a future reset control makes it reachable.

**Persistence.** Through the `storage` seam only, key `shareCopyMode` unchanged,
value widened to `{coords, google, apple}`. A change in Settings must reach an
already-open popup, which the existing `useSyncExternalStore` module store
already provides.

**Migration is invisible.** No notice, no dialog, no changelog card. The only
correct outcome is switch positions that already match the prior choice:

- Someone who chose "Copy coordinates only" sees **Coordinates on, Google Maps
  link off, Apple Maps link off**; the example is the single line
  `38.54321, -121.98765`; the manifest reads "One line: coordinates."; the popup
  button reads "Copy coordinates".
- Someone who never touched it, or whose stored value is absent, malformed or
  unrecognised, sees **all three on**, three lines, "Copy coordinates and map
  links". That is today's default and today's superset, so a failed read never
  silently removes something the person was copying.

**Layout at 320px and 200% text scale.** Verified headlessly in the mockup at
1400 / 1024 / 640 / 375 / 320, in both themes: no horizontal page scroll, and no
overflow inside the 320px specimens at either 100% or 200% text scale. The
load-bearing properties:

- `.sr-share-example` already carries `white-space: pre-wrap` and
  `overflow-wrap: anywhere`, so the 45-character Google Maps URL wraps inside
  the block instead of widening the page. Nothing needed to change here.
- `.sr-action-row` wraps the trailing switch onto its own line only when the
  label genuinely runs out of room, so a phone at 100% keeps the compact
  single-line row and only the doubled text scale stacks. `.sr-action-row-stack`
  was **not** used: it would stack on every phone, which wastes height for a
  20px switch beside a one-word label.
- Switch height measured at 44px on the ≤640 tier, from the existing
  `.sr-touch-target` rule. Nothing new was added for touch sizing.
- Every size is rem-derived. Nothing was converted to px to make the narrow case
  fit.

---

## Motion Spec

**The honest answer here is minimal motion, and one deliberate zero.**

| Element / interaction | Easing | Duration | Origin | Reduced motion | Implemented by |
|---|---|---|---|---|---|
| Switch track color, off ↔ on | ease-out | 180ms | n/a | transition removed, state still flips | CSS, existing `ToggleSwitch` |
| Switch knob slide | ease-out | 180ms | n/a | transition removed | CSS, existing `ToggleSwitch` |
| Popup entrance | `cubic-bezier(0.16, 1, 0.3, 1)` | 170ms | follows the maplibre anchor (`transform-origin` per anchor class) | animation removed | CSS, existing `sr-share-pop-in` |
| Copy button, filled → settled | `cubic-bezier(0.16, 1, 0.3, 1)` | 140ms | n/a | transition removed | CSS, existing |
| Example block ↔ all-off sentence | **none** | **0ms** | n/a | n/a | deliberate |

Nothing in this refinement adds a new animation. The switch, the popup entrance
and the copy-button settle are all shipped behaviour and are correct as they
stand (ease-out, well under 300ms, origin-aware, reduced-motion honoured).

**The example swap is deliberately not animated.** The entire safety argument
for permitting all three off is that the consequence appears at the instant the
last switch flips, in the same block. A fade would delay exactly the information
the design depends on being immediate, and animating a text block on every flip
is decoration rather than explanation. This is a designed zero, not an omission;
do not add a transition here later.

---

## Content Notes

Register: informative, calm, never promotional and never scolding. The all-off
state is a configuration the person deliberately chose, so it reads as a
consequence.

**Settings, in place of the example:**

> Nothing to copy. The share pin will still show the coordinates on the map.

States the outcome, then hands back the thing that still works. No imperative,
no warning color, no alert icon.

**Popup, in place of the copy control:**

> Nothing is selected to copy. Choose what to copy in Settings under Sharing.

The second sentence is an imperative because it is wayfinding, which is the one
place an imperative is a service rather than a scolding.

**Switch labels:** "Coordinates", "Google Maps link", "Apple Maps link". These
are the same strings as the manifest nouns for the two proper nouns, so the
switch and the sentence can never name a destination differently.

**No em dashes** anywhere in shipped copy: switch labels, manifest sentences,
both all-off sentences, helper text, and every `aria-label`. Periods and colons
carry the joins. This also applies to the `docs/HELP.md`, `README.md` and
`website/index.html` rewrites the change brief lists.

**Example coordinate** stays the PRD's `38.54321, -121.98765`, and the example
is built by the same `buildSharePayload` the popup uses, so the block a person
reads in Settings is the exact block a copy produces.
