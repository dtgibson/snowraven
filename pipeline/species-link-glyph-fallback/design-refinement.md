# Design Refinement — Species Link Glyph Fallback

Improve lane, Stage 2. Refines the **failure state** of the two link marks beside
every bird name (`frontend/src/components/SpeciesLinks.tsx`). Nothing in the
success state is redesigned: online, with both favicons loading, every pixel is
as it ships today.

Mockup: `pipeline/species-link-glyph-fallback/design.html` (both themes, all four
states, magnified geometry, the measured contrast tables).

---

## Visual Direction

Quiet utility, unchanged. A mark that fails to load stops being an invisible hole
and becomes a bundled lucide glyph in the same reserved 14px slot — drawn in the
app's own ink at the app's own in-content stroke, sitting at the same size and on
the same baseline as the raster it stands in for. The fallback should read as the
same *kind of thing* as the favicon beside it, never as an error, a placeholder,
or a second design. The only thing a user should notice is that the target they
could already click is now visible.

---

## Surfaces

Ten shipped surfaces render a bird name and therefore these marks: Species Detail
(header pair and rows), Statistics (`BirdingStats`, Frivolous Lists, the escapee
account), Multimedia (`LifeListTable`, media comments), Breeding Codes, Named
Birds, Checklists, List Comparer, Map Explorer (panel, target and nearby-lifer
markers, county layer, completeness popup). None of them gets its own treatment —
one pair of glyphs, one size, one color rule, everywhere.

### The mark pair (the only thing being designed)

Container geometry is **untouched**: `.sr-favicon-slot` stays 14×14 with
`display: inline-flex; align-items: center; justify-content: center;
flex-shrink: 0`, the pair keeps its 5px gap and 6px left margin, and each anchor
keeps its 5px padding with matching −5px margin for the ≥24×24 target. Two guards
parse that CSS (`breedingNameColumnCss.test.tsx:78`, `BirdName.test.tsx:43`) and
must stay green untouched.

| State | eBird mark | Birds of the World mark |
| --- | --- | --- |
| Both loaded (today) | favicon raster | favicon raster |
| eBird failed | `Globe` glyph | favicon raster |
| BoW failed | favicon raster | `SquareLibrary` glyph |
| Both failed (offline) | `Globe` glyph | `SquareLibrary` glyph |

Per image, non-destructive: the `<img>` is never unmounted, the glyph is revealed
over the reserved slot, and `onLoad` clears the flag so a late success restores
the real favicon in place.

---

## The five decisions

### 1. Which glyph for each destination

**eBird → lucide `Globe`. Birds of the World → lucide `SquareLibrary`.**
The idea's proposal is **overridden**, on both halves.

- **`BookOpen` is rejected** because it is the authoritative Species Detail tab
  glyph (`lib/tabIcons.tsx`), and the bird name this mark sits beside *is itself
  the button that navigates to Species Detail*. A book two millimetres from that
  button points at the wrong destination.
- **`Binoculars` is rejected** on two counts: it is the Map Explorer "lifers"
  mode glyph, and its eleven path segments collapse into a dark blob at 14px long
  before any meaning arrives.
- **`BookOpenText` is rejected** because its four interior text ticks are 2 units
  long — 1.17px at 14px — so they disappear and it renders as `BookOpen`,
  inheriting `BookOpen`'s collision exactly.
- **`Earth` is rejected**: the same circle as `Globe` filled with 2-unit
  continental jogs that are sub-pixel here. It becomes a circle with grit in it.
- **`Library` is rejected**, and it is the near miss worth recording. Right idea
  (the shelf of species accounts), wrong frame: in lucide v1.14.0 it is four bare
  spines with no enclosing shape, an ink box of 16 units against `Globe`'s 20, and
  in the mixed pair — beside a solid full-bleed raster favicon — it reads as a
  fragment rather than a mark. `SquareLibrary` is the same idea with a boundary.

**Why the chosen pair.** `Globe` for eBird: the worldwide observation network,
every sighting anywhere. `SquareLibrary` for Birds of the World: the reference
shelf of long-form species accounts, which is what that site *is* to this app —
the book, where eBird is the data. (The naming coincidence cuts the other way and
was considered: "Birds of the World" invites a globe. The globe is given to eBird
anyway, because *worldwide observation data* describes eBird's species page far
better than it describes a written account, and the destination is named in full
by the anchor's `aria-label` and `title` regardless.)

**The hard requirement is met by silhouette, not by detail.** Circle against
rounded square is the strongest difference two 14px marks can have. Both are
identifiable from their outline alone, so neither depends on interior strokes
surviving on a 1× display.

### 2. Optical size and stroke

**Both glyphs: 14px nominal, `strokeWidth` 2.2, `strokeLinecap`/`strokeLinejoin`
round, `fill="none"`, `viewBox="0 0 24 24"`.**

- **14px** is the favicon's own footprint and the slot's exact size, so the
  fallback occupies the identical box and nothing moves in either direction. It
  sits inside the design system's in-content lucide register (11–15px,
  `design-system.md` Patterns → Icons).
- **Stroke 2.2** is the design system's in-content weight. In a 24 viewBox drawn
  at 14px it renders as 1.28 CSS px. Both marks carry the same stroke so the pair
  reads as one family — this is what stops a mixed pair from showing two icon
  weights.
- **No per-glyph size correction is applied**, and that is deliberate. Measured
  outer extents in the 14px slot are `Globe` 12.95px (ink box 20 units + stroke)
  and `SquareLibrary` 11.80px (ink box 18 units + stroke). The square is smaller
  by measurement and equal by eye, because a square encloses ~27% more area than
  the circle inscribed in the same box. Nudging either one to close a 1.15px
  numerical gap would open a visible optical one.
- Round caps are lucide's default and match every other glyph in the app; they
  also soften the spine ends of `SquareLibrary` at sub-pixel stroke widths.

### 3. Color at rest and on hover

**The glyph is set to `var(--sr-text)` explicitly, and takes the anchor's existing
`opacity: 0.75` → `1` step. No new mechanism, no new token, no new hover rule.**

- **Set, not inherited.** The glyph is `stroke="currentColor"`, so it would
  otherwise pick up whatever ambient color its host surface uses — including
  `--sr-accent` inside a link context on some of the ten surfaces. Set `color:
  var(--sr-text)` on the anchor (or on the glyph wrapper) so the rendered value is
  deterministic everywhere and the measured ratios below actually hold.
- **Resting** composition is `--sr-text` at 75% over the surface, because the
  anchor already carries `opacity: 0.75` inline and the glyph is inside it.
  **Hover and focus** step the anchor to `opacity: 1`, exactly as the favicon
  does today. One mechanism governs both marks.
- **Both themes come free.** `--sr-text` is `#0F1117` light and `#F4F4F5` dark, so
  the glyph flips with the theme on its own.
- **Do not extend the dark-mode favicon filter to the glyph.** The shipped rule
  `[data-theme="dark"] img.sr-favicon { filter: brightness(0) invert(1); opacity:
  0.65 }` is `img`-scoped and must stay that way: `brightness(0) invert(1)` over a
  token-colored stroke would fight the token it is meant to honour.
- **No theme-conditional damping is minted.** In dark theme the glyph measures
  higher than the silhouetted favicon beside it (9.44:1 against roughly 5.0:1 on
  `--sr-surface`), and that gap is left in place: a 1.28px outline covers roughly
  a quarter of the ink a filled raster does, so the two land at comparable weight
  to the eye. Closing the numbers would mean either dimming the fallback toward
  its 3:1 floor or brightening the shipped success state, which is out of scope.

### 4. Non-text contrast (WCAG 2.1 SC 1.4.11, 3:1)

The fallback is app-drawn UI and is the sole visible affordance of the link in
this state, so it owes 3:1 at rest in both themes. Measured from the actual token
values in `frontend/src/globals.css`, with `--sr-text` composited at the anchor's
resting `opacity: 0.75` over every surface a bird name renders on.

| Surface token | Value | At rest | On hover |
| --- | --- | --- | --- |
| `--sr-surface` | `#FFFFFF` | 8.52:1 | 18.9:1 |
| `--sr-surface-faint` | `#FAFAFA` | 8.32:1 | 18.1:1 |
| `--sr-bg` | `#F9FAFB` | 8.32:1 | 18.1:1 |
| `--sr-surface-subtle` | `#F4F4F5` | 8.09:1 | 17.2:1 |
| `--sr-accent-bg` | `#E8F5EE` | 8.00:1 | 16.8:1 |
| **`--sr-quote-bg` — worst, light** | `#EFF1F3` | **7.96:1** | 16.7:1 |
| `--sr-bg` (dark) | `#09090B` | 10.2:1 | 18.1:1 |
| `--sr-surface` (dark) | `#18181B` | 9.44:1 | 16.1:1 |
| `--sr-surface-subtle` (dark) | `#27272A` | 8.26:1 | 13.6:1 |
| **`--sr-quote-bg` (dark) — worst, dark** | `#2E2E33` | **7.63:1** | 12.3:1 |

**Floor cleared with 2.5× headroom: 7.96:1 light, 7.63:1 dark, against 3:1.**

**Two quieter tokens were measured first and both fail**, at the same 0.75
resting opacity, worst-case surface:

| Token | Light | Dark |
| --- | --- | --- |
| `--sr-text-muted` (`#6B6B74` / `#A1A1AA`) | 2.93:1 ✗ | 3.65:1 ✓ |
| `--sr-text-gray` (`#6B7280` / `#8A8A92`) | 2.77:1 ✗ | 2.87:1 ✗ |
| `--sr-text` (`#0F1117` / `#F4F4F5`) | 7.96:1 ✓ | 7.63:1 ✓ |

`--sr-text-muted` is the interesting failure: it passes in dark and fails in
light. Splitting the token per theme would be two rules where one will do, and
the second would drift. **`--sr-text` is the only token that clears the floor in
both themes, so it is the one used.**

`ACCESSIBILITY.md:39` needs no roster edit — it already names links — and `:49`
stays true, since the ≥24×24 targets are untouched. The claim is confirmed by
these numbers rather than reworded.

### 5. The mixed pair (one favicon, one glyph)

**Acceptable exactly as drawn, and it is a routine state rather than an edge
case** — the change brief measured the two hosts failing at different moments
(eBird's 302 carries no cache headers and goes immediately offline; Birds of the
World's `max-age=3600` can survive up to an hour), so one raster beside one glyph
is what an offline user sees most often.

What makes it read as deliberate:

- **Both glyphs are full-bleed.** A raster favicon fills its 14×14 box; `Globe`
  reaches 12.95px and `SquareLibrary` 11.80px in the same box. The pair keeps one
  size, one 5px gap, one baseline and one optical weight, so it reads as two marks
  of the same kind. This is the single reason bare `Library` was dropped — four
  floating spines beside a solid raster read as a fragment.
- **Position, not glyph, identifies the destination.** eBird is always first, BoW
  always second, on every surface, in every state. The glyph reinforces; the
  anchor's `aria-label` and `title` name the destination in full and are unchanged.
- **Nothing about the loaded mark changes** when its neighbour falls back. No
  sympathetic dimming, no shared treatment, no "both or neither" — each mark
  decides for itself, which is what keeps a late success able to recover in place.

---

## Component Usage

- `lucide-react@1.14.0` — `Globe` and `SquareLibrary`, both confirmed present in
  the installed version. No new dependency; `lucide-react` is already on the
  entry graph (`lib/tabIcons.tsx`), so `entryChunk.test.ts` stays green.
- No shadcn component, no new shared component, no new CSS class. The glyph is
  rendered inside the existing `.sr-favicon-slot`.
- The two anchors become one internal sub-component called twice (the change
  brief's nav-rework principle), so the glyph lives in one place. That is a code
  shape, not a design change — the rendered output is identical to today in the
  success state.
- Every glyph is `aria-hidden` and `focusable="false"`, matching `tabIcons.tsx`
  and `RavenGlyph`: the anchor's accessible name is the only name announced, and
  an announced glyph would only double it.
- Both anchors keep their literal `tabIndex={0}` (`lib/tabOrderCoverage.test.ts`).

## Design Tokens Applied

| Role | Token | Light | Dark |
| --- | --- | --- | --- |
| Glyph stroke | `--sr-text` | `#0F1117` | `#F4F4F5` |
| Resting alpha | existing anchor `opacity` | `0.75` | `0.75` |
| Hover / focus alpha | existing anchor `opacity` | `1` | `1` |

**No new token is minted, in either theme.** The design system's rule is that new
tokens go in both themes before use; this refinement needs none, which is the
better outcome.

## Interaction Notes

- `onError` on either `<img>` sets that mark's fallback flag; `onLoad` clears it.
  Per image, never latched, `<img>` never unmounted — the v0.5.66 non-destructive
  shape extended to a third surface.
- The glyph is absolutely positioned within `.sr-favicon-slot` while the `<img>`
  stays `visibility: hidden`, so the reserved box is held by the image exactly as
  it is today and no layout shift is possible in either direction.
- Hover and focus behaviour is unchanged: the anchor's existing 0.75 → 1 opacity
  step, applied to whichever mark is showing. No hover treatment is added to the
  glyph itself.
- Focus ring, target size (≥24×24 via the 5px padding / −5px margin), accessible
  name, `target="_blank" rel="noreferrer"` and both hrefs are all untouched.
- Verify at 320px width and 200% in-app text scale on the Breeding Codes phone
  name cell specifically — the marks are px-sized and do not scale with text, so
  the cell must still wrap inside its column.

## Motion Spec

**No motion. Nothing animates, and no `prefers-reduced-motion` clause is owed
because there is nothing to reduce.**

This is a *substitution*, not an entrance. Three reasons, each sufficient:

1. `onError` fires at an unpredictable moment after paint, and offline it fires
   for every mark in a 200-row table. Any entrance transition would produce the
   doctrine's named anti-pattern — staggered fade-ins scattered across a whole
   page — with no state change worth explaining.
2. `onLoad` must be able to restore the favicon in place. A transition in would
   need a transition out, doubling the flicker on exactly the marginal connection
   where a late success happens.
3. The shipped hover step is already instant (`onMouseEnter` sets
   `style.opacity` directly; no CSS `transition` is declared), so adding motion
   here would introduce the only animation on this component.

The one thing the Engineer must **not** do is add a `transition` to
`.sr-favicon-slot`, its children, or the anchor's opacity while implementing this.

## Content Notes

- No new user-facing copy. The anchor's `aria-label` (`View {name} on eBird
  (opens in a new tab)`) and `title` (`View {name} on eBird`) are unchanged, and
  they remain the only place either destination is named.
- No em dashes (U+2014) in `title` or `aria-label` — they are in the v1.0.17
  sweep's scope. They contain none today; keep it that way.
- The glyph carries no tooltip, no label, and no visible text of its own.
- `docs/HELP.md:663` becomes true again only if the paragraph states the
  *property* rather than the specific icons: offline a mark is present and opens
  the same page, but it is the app's stand-in, not the eBird and Birds of the
  World icons that sentence currently names. Paragraph scope, per
  `.claude/rules/docs-and-website.md`.

---

## Deviations from `pipeline/design-system.md`

**None.** This refinement stays inside the established system on every axis:
lucide at 14px / stroke 2.2 (Patterns → Icons, 11–15px), every color through a
`var(--sr-*)` token in both themes, no new token, no new pattern, no new
dependency, and `<BirdName>` remains the single app-wide bird-name renderer.

## Recommended `design-system.md` addition (for the Chronicler)

Under **Patterns**, extending the existing "Links out" entry:

> **A raster mark that can fail gets a bundled glyph fallback in its own reserved
> slot, never an empty one.** The `<img>` stays mounted and hidden, a lucide glyph
> is revealed in the same fixed slot, and `onLoad` restores the raster in place —
> per image, so a mixed pair is a real and ordinary state. The fallback pair is
> chosen for **silhouette difference** (circle against square) rather than for
> depiction, because at 14px an outline is all that survives; both glyphs are
> full-bleed so they sit beside a surviving raster at matching optical weight.
> The glyph is **set** to `--sr-text` rather than left on `currentColor`, and
> inherits the host anchor's existing opacity step — the muted tokens were
> measured at 0.75 and fail the 3:1 non-text floor in light theme
> (`--sr-text-muted` 2.93:1, `--sr-text-gray` 2.77:1), so ink is the only token
> that clears in both themes. **A substitution is not an entrance: nothing
> animates.** `SpeciesLinks` is the exemplar.

## Self-audit

`weft-design-lint check pipeline/species-link-glyph-fallback/design.html` — clean,
0 findings. Pre-flight boxes all pass, with two deliberate readings recorded here:

- **Display face.** The sheet's own display role is a distinctive serif stack
  (Iowan Old Style / Charter / Palatino / Georgia), locally resident so the file
  stays self-contained with no CDN. The *app specimens* inside it deliberately
  render in the platform UI face, because `globals.css` declares
  `--font-sans: 'Inter', system-ui, …` but loads no Inter webfont — so the
  platform face is what the shipped Mac, iPhone and iPad apps actually draw, and
  naming Inter in the specimen would make it less accurate, not more.
- **Motion under 300ms / reduced-motion.** Vacuously satisfied: the design
  specifies no motion, for the reasons in the Motion Spec, and the sheet itself
  carries a `prefers-reduced-motion` guard regardless.
