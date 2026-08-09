# Design Refinement — Breeding Code Pinned Labels

Refines an existing surface: the Breeding Codes control row and the matrix
header, in both Normal and Unbounded, at 320px and 200% in-app text scale.
Mockup: `pipeline/breeding-code-pinned-labels/design.html`.

Nothing is redesigned. This extends `pipeline/design-system.md`'s **Phone
wide-table** pattern with one opt-in mode; the shipped default is untouched.

---

## The open call — decided

**Pinning is offered only in Unbounded, where it is free. Normal view is not
offered a capped-height box.** The control is still present and enabled in
Normal view and reaches the working behavior in one press. Nothing is disabled,
hidden, or dead.

### Why

The brief left this open on the reasonable ground that an opt-in a user chooses
is categorically different from a default imposed on them. That argument is
sound, and it is not what settles this. What settles it is a binding
requirement: **the surface must hold at 320px and at 200% in-app text scale**,
and a capped-height inner scroll box cannot.

At 200% text scale (`html { font-size: calc(100% * var(--sr-text-scale)) }`),
each species row grows to roughly 68px (a 0.84375rem common name over a
0.71875rem scientific name, plus 18px padding). Give the box a cap and pick a
unit:

- **Viewport units.** `60dvh` on a 375x667 phone is 400px. Minus a ~40px header
  that leaves about **five rows**, inside a box that scrolls independently of
  the page, with the tier legend stranded below it. This is worse than the shape
  live-tested and reverted in v0.5.69, because there every row was half as tall.
- **`rem`.** `26rem` at 200% is 832px, taller than the 667px viewport. Sticky
  resolves against the top of its scrollport, so once the page is scrolled the
  scrollport's top — and therefore the pinned header — is **off-screen**. The
  feature silently stops working in the exact configuration it is measured
  against.
- **`min(26rem, 60dvh)`** collapses back to the first case.

There is no third unit. A capped box has no viable height here, so offering it
would mean shipping a control that either recreates a rejected shape or does
nothing, depending on a setting the user cannot see.

Against that, pinning in Unbounded costs a **fixed ~40px band, about 6% of a
phone screen at 200% text scale**, and leaves everything else alone: full
natural table height, page scrolls as one, legend still follows the last row.
Roughly nine rows per screen instead of five. The mockup renders this comparison
to scale.

A second, structural argument points the same way. Unbounded is exactly the view
that drops the horizontal name-column freeze, so **the top-left corner cell is
never sticky on both axes at once**. The hardest sticky case in the whole design
simply does not arise.

### What Normal view shows instead

Normal view renders **exactly as it ships today** — nothing removed, nothing
added, byte-identical. The difference is that the pin control is present,
enabled, and does the whole job:

> **Invariant: pinned implies Unbounded.**

- Press **Pin code labels** from Normal: the table moves to Unbounded and pins,
  in one press.
- Press it again: the view the user came from is **restored** and the pin
  clears. The round trip leaves no residue.
- Press **↔ Normal** while pinned: the pin clears, because Normal cannot pin,
  and the pill visibly un-presses in the same row.

That is the answer to "no dead control, no wall." The cost of the press is made
legible **at** commit rather than guarded behind a warning, because the change
is instant, visible, and reversible in one more press: the view toggle beside it
flips in place, a status note names what happened, and the pill is right there.
A permanent line of explanatory text in an already dense control row would tax
the large majority who never pin, for a consequence that undoes itself.

### Rejected alternatives

- **Offer the capped box in Normal anyway, with the cost disclosed.** Fails the
  200% text scale requirement above. Disclosure does not rescue a control whose
  two possible implementations are "unusable" and "broken."
- **Render the pin control only in Unbounded.** No dead control, but Normal is
  the default view, so the feature would be undiscoverable for most users. A
  hidden control is a wall.
- **Disable the control in Normal with a tooltip.** Explicitly ruled out, and
  correctly: `title` is hover-only and inert on touch, the problem v0.5.56
  already fixed once on this very tab.

---

## Visual Direction

Unchanged. Quiet utility: the pin is a restrained ghost pill that borrows the
shipped view toggle's exact styling, and the pinned band is the header the user
already knows with a slightly firmer edge. The accent appears in one new place
only, the pressed state of one pill. Nothing new competes for attention, and
with the feature off the tab is pixel-identical to today.

---

## Screens / Views

### Control row

The right-hand cluster gains one pill, immediately left of the shipped
`↔ Unbounded` button, and the two are wrapped in a
`role="group" aria-label="Table view"` so they read as related presentation
controls rather than another filter.

```
[ 24 species ]   ( 📌 Pin code labels )( ↔ Unbounded )
```

Key decisions:

- The pill uses the shipped **`ghostBtn()`** styling verbatim, accent-tinted
  when pressed. Same height, radius, font size, border weight as its neighbor.
- **Lucide `Pin`, 12px, stroke ~2.2, `aria-hidden`.** It earns its place: it is
  the only non-text marker in a cluster whose other member is `↔`, and it makes
  the control findable in a row that already carries about twenty text pills.
- The cluster is lifted to **`.sr-wrap-flex`** with `--sr-wrap-gap: 8px`, and
  the inner group wraps at 6px, so at 320px and at 200% text scale the count
  label and the two buttons wrap instead of overflowing. No new layout is
  invented; the outer control row already sets `flexWrap: 'wrap'`.
- Both view-group buttons carry **`.sr-touch-target`** for the ≤640 ~44px
  posture. See *Deliberate deviation* below.

### Matrix header, pinned (Unbounded only)

`position: sticky` on **each `<th>` individually**, never on `<thead>` or
`<tr>`: WKWebView and older Safari honor sticky on cells only, and this ships in
WKWebView on macOS and iOS. `border-collapse: separate` is already set inline
and is required for sticky table headers; nothing to change there.

**Boundary.** Unpinned, the header keeps its shipped hairline
`inset 0 -1px 0 var(--sr-border)`. Pinned, two things change together so rows
read as passing *under* the band rather than smearing into it:

- the hairline steps up to **`var(--sr-border-medium)`** (existing token, no new
  color), and
- a soft haze is added beneath it via the one new token below.

The band's background stays **`var(--sr-bg)`**, already the shipped value and
already opaque, so rows cannot show through. It also means the floating band
matches the page laterally while contrasting against the `--sr-surface` rows
sliding beneath, which is exactly where the boundary needs to read.

**On contrast, stated plainly:** `--sr-border-medium` is about 1.65:1 against
`--sr-bg` in light. This is **not** claimed as a WCAG 1.4.11 pass and does not
need to be. The header is identified by its text, and the pinned state is
carried by the pill's `aria-pressed` plus its visible pressed styling; the line
and haze are visual reinforcement, not the sole means of identifying a component
or its state. A 3:1 line would read as a rule rather than a hairline and would
break the tab's register.

### Status note

While pinned, one muted line sits directly above the card, in the same geometry
as the shipped filter strip (`7px 12px`, radius 6, `marginBottom: 8`) but on the
neutral `--sr-surface-faint` with a `--sr-border-subtle` edge rather than the
accent tint — the accent is already spent on the pressed pill, and pinning is
not a filter.

> Code labels stay at the top while you scroll. Pinning uses the Unbounded view,
> so the matrix scrolls with the page.

No em dashes. It names the shipped control by its shipped label ("Unbounded"),
not a synonym.

### 320px phone, Unbounded and pinned

All shipped ≤640 contracts hold unchanged: 30px dot-width code columns,
0.625rem headers, `table-layout: fixed; width: max-content` on the table inside
a `width: min-content` card, `.sr-bc-card` / `.sr-bc-matrix` untouched. The
pinned band adds one row of height and nothing else. Rendered in both themes in
the mockup.

---

## The top-left corner, both axes, both views

| View | Pin | Corner, vertical | Corner, horizontal | Code header cells |
|---|---|---|---|---|
| Normal | not offered | scrolls with the page | **sticky `left: 0`** (shipped, unchanged) | scroll with the page |
| Unbounded | off | scrolls with the page | free (shipped, unchanged) | scroll with the page |
| Unbounded | on | **sticky `top`** | free, scrolls with the page | **sticky `top`**, identical to the corner |

Stated the other way: with pinning on, the corner cell is an **ordinary member
of the pinned header row**. It holds vertically and travels horizontally with
everything else. Scrolling right in Unbounded carries the species names off
screen; that is the shipped Unbounded behavior and is deliberately left alone.
Adding a left freeze to Unbounded is a plausible follow-on and is out of this
brief's scope (`Not changing: ... the horizontal name-column freeze`).

---

## Component Usage

- `BreedingCodeList.tsx` — the new pill, the view group, the state machine, the
  status region.
- `BreedingCodeTable.tsx` — a new `pinned: boolean` prop; applies
  `sr-bc-matrix--pinned` to the `<table>` only when `pinned && wideMode`.
- `globals.css` — the `.sr-bc-matrix--pinned` rules and the new token.
- Lucide `Pin` at 12px. No new component, no new library, no new dependency.

### CSS contracts (globals.css)

The pinned rules live in the stylesheet, **not inline**, for a load-bearing
reason: the iOS variant must override `top` under the `.sr-ios-app` gate, and a
React inline style at specificity 1,0,0 is unreachable from a stylesheet. This
requires moving the shipped `thBase.boxShadow` out of the inline object into a
base rule so the pinned rule can win by specificity rather than fight an inline
value.

```css
/* base — moved off thBase's inline boxShadow */
.sr-bc-matrix thead th { box-shadow: inset 0 -1px 0 var(--sr-border); }

/* pinned — must come after the base rule (equal specificity, source order wins) */
.sr-bc-matrix--pinned thead th {
  position: sticky;
  top: 0;
  z-index: 3;
  box-shadow: inset 0 -1px 0 var(--sr-border-medium), var(--sr-sticky-shadow);
}

/* WCAG 2.2 SC 2.4.11. CORRECTED AT BUILD (security review, Medium): the rule
   must also reach the cells' focusable DESCENDANTS. scroll-margin applies to the
   element scrolled into view and does not inherit, and focus goes to the
   <button> BirdName renders inside the cell — so the cell-only form below was
   inert, measured at 3 obscured focus stops at 100% and 9 at 200%. The `*`
   covers present and future focusables without enumerating them, and stays
   inside this table's subtree (a root-level scroll-padding-top would fix the
   geometry equally but leak to every other tab, since deferred tabs stay mounted
   when hidden). 3rem clears the band at both 100% and 200% text scale. */
.sr-bc-matrix--pinned tbody th,
.sr-bc-matrix--pinned tbody td,
.sr-bc-matrix--pinned tbody th *,
.sr-bc-matrix--pinned tbody td * { scroll-margin-top: 3rem; }

/* iOS app only, mirroring .sr-ios-app body's padding-top. Web is untouched:
   without this the band pins into the notch on a notched iPhone. */
.sr-ios-app .sr-bc-matrix--pinned thead th { top: env(safe-area-inset-top, 0px); }
.sr-ios-app .sr-bc-matrix--pinned tbody th,
.sr-ios-app .sr-bc-matrix--pinned tbody td,
.sr-ios-app .sr-bc-matrix--pinned tbody th *,
.sr-ios-app .sr-bc-matrix--pinned tbody td * {
  scroll-margin-top: calc(3rem + env(safe-area-inset-top, 0px));
}
```

`z-index: 3` on every pinned header cell: in Unbounded the body name cells carry
no `z-index`, so there is no intersection to arbitrate and all header cells
share one layer.

---

## Design Tokens Applied

Existing, unchanged: `--sr-bg` (band), `--sr-border` (unpinned hairline),
`--sr-border-medium` (pinned hairline), `--sr-surface-faint` +
`--sr-border-subtle` + `--sr-text-muted` (status note), `--sr-accent` +
`--sr-accent-bg` + `--sr-accent-border` (pressed pill), `--sr-tier-*` (untouched).

**One new token**, declared in **both** `:root` and `[data-theme="dark"]` before
use, per the standing rule:

```css
:root                { --sr-sticky-shadow: 0 3px 6px -2px rgba(15,17,23,0.12); }
[data-theme="dark"]  { --sr-sticky-shadow: 0 3px 8px -2px rgba(2,2,4,0.60); }
```

A full-value shadow token, the same convention as `--sr-card-shadow` and
`--sr-switch-thumb-shadow`. Tinted with the app's own ink rather than pure
black. Dark is deeper because a light haze is invisible against `--sr-bg`
(`#09090B`). Named generically so a future sticky surface can reuse it.

No hardcoded hex or rgb reaches a component; every color is a `var(--sr-*)`.

---

## Interaction Notes

### State machine (session-only `useState`, matching `wideMode` beside it)

```ts
const [wideMode, setWideMode]           = useState(false)
const [pinned, setPinned]               = useState(false)
const [viewBeforePin, setViewBeforePin] = useState<boolean | null>(null)
const [pinSeq, setPinSeq]               = useState(0)   // live-region announce key

function togglePin() {
  if (pinned) {
    setPinned(false)
    if (viewBeforePin !== null) setWideMode(viewBeforePin)
    setViewBeforePin(null)
  } else {
    setViewBeforePin(wideMode)
    setWideMode(true)          // the invariant: pinned implies Unbounded
    setPinned(true)
    setPinSeq(s => s + 1)
  }
}

function toggleView() {
  const next = !wideMode
  setWideMode(next)
  if (!next && pinned) {       // Normal cannot pin, so the pin clears, visibly
    setPinned(false)
    setViewBeforePin(null)
  }
}
```

No `setState` inside an updater, no effect mirroring one piece of state onto
another. Nothing is persisted; no `storage` seam, no `localStorage`.

**Invariant worth a test:** `pinned` is never `true` while `wideMode` is
`false`, across every path (pin from Normal, pin from Unbounded, unpin, press
the view toggle while pinned).

### Accessibility

- **Accessible name is `Pin code labels`, and nothing else** — the button's own
  text content, with **no `aria-label` anywhere**, so the visible label and the
  accessible name cannot drift. (This repo has shipped a published accessible
  name a component never emitted; the cheapest defense is not to have a second
  source of truth.)
- **`aria-pressed={pinned}`**, per the repo's segmented and pill convention.
- The consequence a sighted user learns from the flipping view toggle is carried
  for screen readers by **`aria-describedby`** pointing at a persistent
  `.sr-only` span: *"Pinning uses the Unbounded view."* A **description**, not a
  name, so WCAG 2.5.3 Label in Name stays trivially satisfied. The span sits in
  the control row, never inside the horizontally scrolled table.
- **`role="group" aria-label="Table view"`** around the two buttons.
- Explicit **`tabIndex={0}`** on both buttons (WKWebView Tab behavior).
- **`role="status"` region is rendered from the start** as a chromeless wrapper
  that collapses to nothing when empty; the note is its **`key={pinSeq}` child**,
  so a repeat announces rather than being reconciled away (v0.5.80). Unpinning
  needs no announcement of its own — the `aria-pressed` transition is the
  announcement, and the note simply leaves. Do **not** pad the string with an
  invisible character to force a diff.
- **`scroll-margin-top`** keeps keyboard focus out from under the band
  (WCAG 2.2 SC 2.4.11) — on the pinned body cells **and their focusable
  descendants**, since focus lands on the `<button>` inside the cell and
  `scroll-margin` neither inherits nor applies to an ancestor of the target. It
  is the vertical *counterpart* of the shipped `scrollPaddingLeft`, not the same
  property: `scroll-padding` goes on a scrollport, `scroll-margin` on a focus
  target, and in Unbounded the scrollport is the page.
- Holds at 320px and 200% in-app text scale; everything sized in rem. The only
  px values are the shipped ones already in the component.

### Standing caution

Do not pair the pinned header with `scroll-behavior: smooth` anywhere on the
page. A smoothed scroll under a fixed band reads as the band drifting, which is
the one way this can be made to look broken.

---

## Motion Spec

Almost none, deliberately. A sticky header is continuous positioning, not a
transition; there is genuinely nothing to animate. Fading the boundary in only
once the band overlaps content would need a scroll observer, which this repo
avoids as a pattern and which buys a detail nobody is looking for.

- **Status note enters on pin:** `ease-out`, 160ms, 2px rise from above
  (`translateY(-2px) → none` plus opacity), reading as growth out of the control
  row it was triggered from; `prefers-reduced-motion: reduce` → `animation: none`
  (instant); CSS keyframe, no library.
- **Pinned header band:** no motion. Sticky positioning; the boundary is present
  for as long as the pin is on.
- **Pin pill pressed state:** no transition, matching every other pill in this
  control row, none of which transition today. Consistency beats novelty in a
  dense strip.
- **View change on pin:** no motion. The table relayouts instantly, as it already
  does on the shipped view toggle.

No new motion dependency. Motion is one CSS keyframe.

---

## Content Notes

- Toggle label: **"Pin code labels"** (visible and accessible name, identical).
- Screen-reader description: **"Pinning uses the Unbounded view."**
- Status note: **"Code labels stay at the top while you scroll. Pinning uses the
  Unbounded view, so the matrix scrolls with the page."**
- **No em dashes** in any of the above, nor in any `aria-label` or `title`.
- Copy names the shipped control by its shipped label ("Unbounded"), never a
  synonym like "full width," so the sentence and the button agree.
- The mockup uses 24 real species with correct scientific names and the real
  eBird display codes and labels from `lib/breedingCodes.ts`, with plausibly
  sparse counts. No placeholder names, no lorem ipsum.
- No new empty, error, or loading state: the shipped "No species match these
  filters." row is unchanged, and pinning has no failure mode.

---

## Deliberate deviation (log to `decisions.md`)

**`.sr-touch-target` is added to the shipped `↔ Unbounded` button as well as the
new pill**, which is one className beyond the brief's literal control-addition,
in a file already being edited (`BreedingCodeList.tsx`).

Reason: the two buttons are now a visual group. At ≤640 the new pill reaches
2.75rem while the shipped toggle stays at its inline 28px, so a 44px pill beside
a 28px pill reads as a rendering error. The shipped toggle also currently misses
the ~44px touch posture, which this refinement should not entrench. Class
`min-height` correctly clamps the inline `height: 28`, so desktop density is
untouched.

---

## Pre-flight self-audit

`weft-design-lint check pipeline/breeding-code-pinned-labels/design.html` →
**clean, 0 findings.**

| Doctrine check | Result |
|---|---|
| Distinctive display face | **Deliberate deviation, justified below** |
| Three typographic roles, real size + weight contrast | Pass |
| Neutrals tinted, no pure `#000` / dead gray | Pass (new token uses app ink) |
| One dominant color + sharp accent | Pass (accent only on the pressed pill) |
| Background has depth | Pass, within the product's quiet register |
| Enter/exit ease-out, under 300ms | Pass (160ms ease-out) |
| Origin-aware popovers | N/A, no popovers; the note rises from its trigger row |
| `prefers-reduced-motion` fallback | Pass |
| No motion anti-slop | Pass (one animation, on a real state change) |
| Content-driven layout, no nested cards | Pass |
| Realistic content; empty/error states designed | Pass (no new states; shipped one unchanged) |
| Components customized, not defaults | Pass (shipped app components reproduced exactly) |

**Display-face deviation.** The doctrine says never default to Inter. This is a
refinement mockup of a shipped surface whose `pipeline/design-system.md`
specifies Inter / system-ui, and the design system wins on specifics. Rendering
the specimens in a different display face would misrepresent the surface under
review and make the mockup useless as a build reference. The spec-page chrome
still establishes three roles with genuine size and weight contrast.
