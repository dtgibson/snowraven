# Design Refinement — Named Birds audio tiles

Improve lane, Stage 2. Refines a shipped surface: the Named Birds tab's
expanded-card media grid. No new screen, flow, or capability. Mockup:
`pipeline/named-birds-audio-and-docs-sweep/design.html`.

---

## Visual Direction

Unchanged from `pipeline/design-system.md` — quiet utility, restrained green, one
accent per surface. This refinement adds no token, no pattern, and no new
component. It corrects a single number that had a visible consequence: a named
bird's audio tile is shorter than the player it holds, so the frame's
`overflow: hidden` cuts the transport row away and the recording cannot be
played.

The secondary gain is compositional. The compact audio height was chosen for
density in a dense multi-item grid, but in a reflowing three-across grid of mixed
formats it produces ragged rows: a 116px audio tile beside a 230px photo tile
leaves its date, its Macaulay link, and its checklist link 114px out of line with
its neighbours. Matching the heights is what lets the grid read as a grid.

---

## Screens / Views

### Named Birds → expanded card → media grid (desktop, above 640px)

`.sr-media-grid`, three across, 16px gap, `align-items: start`. Each tile is a
`.sr-media-frame` (1px `--sr-border`, 9px radius, `--sr-surface`,
`overflow: hidden`) carrying the player, above a meta row that sits outside the
frame.

| Format | Frame height | Change |
|---|---|---|
| Photo | 230px | unchanged |
| Video | 230px | unchanged |
| **Audio** | **230px** | **was 116px** |

All four tile states — loading shimmer, live player, offline/failed placeholder,
and the disabled notice — are pinned to the frame, so the height change moves
them together and nothing shifts between them. The meta row never moves.

### Named Birds → expanded card → media grid (phone tier, 640px and below)

`.sr-media-grid` collapses to one column. A tile then runs the full width of the
panel.

| Format | Frame height | Change |
|---|---|---|
| Photo | 280px | unchanged |
| Video | 280px | unchanged |
| **Audio** | **280px** | **was 130px** |

### Not in scope, explicitly

Species Detail's `.sr-media-iframe--recent` (230px / 280px) is untouched. The
Named Birds disabled-state banner, which already borrows `--recent`, is
untouched. The reveal cap, the lazy-mount observer, the `[name:…]` matching, and
the `namedBirdKey` join are untouched.

---

## The three decisions, and why

### 1. Audio tile, desktop — **230px**

Adopt Species Detail's value rather than invent a smaller purpose-built one.

Species Detail's Recent Media renders through the *same* `.sr-media-grid`, three
across, in the same tab-panel width, so its live-verified 230px is a measurement
at a comparable tile width and not a loose analogy. It is the only height we know
clears the player chrome. A smaller intermediate — 170px, 190px — would be a
guess, and the failure mode of guessing low is a scrubber that is present but
partly clipped: the same defect this run exists to fix, in a quieter and harder
to notice form. The brief's bar is that the play control and transport be fully
visible and clickable, not merely taller than today, and only one number
satisfies that on evidence.

The compounding concern is real but bounded. The initial batch is six tiles, so a
bird with many recordings still mounts at most six players before a "Show more".
Six tiles three-across is two rows, which grows the expanded card by roughly
228px. That is an acceptable price for a control that works.

The row alignment is the second reason, and it is a genuine design gain rather
than a side effect. With mixed formats reflowing through the grid, unequal
heights leave every mixed row ragged. One height makes the rows line up.

### 2. Audio tile, phone tier (640px and below) — **280px**

Match photo and video, matching Species Detail's phone value.

Uniformity is a property of a *row*, and at one column there are no rows — so
matching buys nothing here, and every pixel is pure scroll. The reason to hold
280px is not consistency but width. At one column a tile runs the full panel, and
at the top of the tier (a viewport just under 640px) that tile is **wider than
the desktop three-across tile**. The spectrogram scales with width, so the player
the frame must hold is *taller* on a wide phone-tier tile than on a desktop one.
Undercutting to 230px would clip again at exactly the widths where the tier
starts.

The mockup demonstrates this rather than asserting it: set the viewport control
to 620px and the live readout under the hero tiles reports the player growing
from 211px to 262px, with today's 130px hiding 132px of it.

**Reserved fallback.** If live review on a real phone shows the audio player
needs less than 280px there, the phone value is a one-line tune in the same rule.
This is the same posture as the `−/Fit/+` control the Designer reserved on the
Breeding Codes matrix: name the escape hatch, ship the safe value.

### 3. Offline and failed-load fallback — **full density, not compact**

`compact` exists *because* 116px had no room for a sentence. That constraint is
gone. At 230px, an icon and a link button floating in a tall empty box reads as
broken rather than as a considered offline state, which is the opposite of what
the non-destructive fallback is for. Audio joins photo and video on the full
fallback: the `CloudOff` icon at 20px, the message ("Media unavailable offline"
or "Media couldn't load"), and the "View on Macaulay Library" pill.

Nothing is lost. The date, the checklist link, and the Macaulay Library link live
in the meta row *outside* the frame and are unaffected by either density.

### 4. Photo and video — **unchanged**

230px desktop, 280px phone, exactly as shipped. Nothing about those two formats
was wrong.

---

## What changes

### `frontend/src/globals.css`

Line 719, the desktop tier:

    .sr-media-iframe--audio { height: 116px; }   →   { height: 230px; }

Line 1343, inside `@media (max-width: 640px)`:

    .sr-media-iframe--audio { height: 130px; }   →   { height: 280px; }

**Keep the class.** Do not point Named Birds at `--recent` and do not collapse
the now-numerically-equal `--photo` / `--video` / `--audio` rules into one. The
v0.5.71 decision established that the resilience *logic* is shared while the
display *height* stays a per-caller choice; a class swap would couple the two
surfaces and make any future per-format tune a two-surface change. The comment
above those rules should be updated — it currently explains the compact audio
height as deliberate, which will no longer be true.

Both modifier rules already sit after the base `.sr-media-iframe` in source order
in each tier, so equal specificity still resolves in their favour. No specificity
work is needed.

### `frontend/src/components/NamedBirdMedia.tsx`

**Two call sites, not one.** This is the easy thing to get half-right.

Line 223, the offline placeholder:

    compact={asset.format === 'Audio'}   →   compact={false}

Line 229, the live frame — currently passes no `compact` at all, and
`MediaFrame`'s signature defaults it to `format === 'Audio'`. So the *give-up and
failed-load overlay* would stay compact even after line 223 is fixed. Add:

    compact={false}

Miss the second one and the offline state gets its message while the failed-load
state quietly does not, on the same tile.

**Optional, for The Engineer to weigh.** With Species Detail and both Named Birds
call sites now passing `compact` explicitly, the `compact = format === 'Audio'`
default in `MediaEmbed.tsx` is dead and is a trap for the next caller, who would
silently inherit a compact fallback for audio at whatever height they picked.
Removing the default is a clean-up, not part of this change, and it touches
shared code — The Engineer's call.

---

## Component Usage

Everything already in the codebase; nothing new.

- `.sr-media-grid`, `.sr-media-item`, `.sr-media-frame`, `.sr-media-iframe` and
  its per-format modifiers — `frontend/src/globals.css`
- `MediaFrame`, `MediaFallback`, `MediaShimmer`, `EmbeddedMediaDisabled` —
  `frontend/src/components/MediaEmbed.tsx`, unchanged
- `MEDIA_FORMAT_META`, `MEDIA_CATALOG_ID_RE`, `EMBED_GIVE_UP_MS` —
  `frontend/src/lib/mediaEmbed.ts`, unchanged
- `OutboundLink`, `ChecklistLink` — the meta row, unchanged
- Lucide `Mic` / `Image` / `Video` / `CloudOff` / `ImageOff` / `Play` /
  `ChevronDown` at their shipped sizes

---

## Design Tokens Applied

No new token. The affected surfaces use, unchanged:

- `--sr-border` (frame outline), `--sr-surface` (frame fill)
- `--sr-surface-subtle` (fallback fill), `--sr-surface-faint` (disabled fill)
- `--sr-text` (date), `--sr-text-muted` (format marker, fallback message),
  `--sr-text-disabled` (separators, shimmer icon), `--sr-text-gray` (counts)
- `--sr-accent`, `--sr-accent-bg`, `--sr-accent-border` (links and the fallback
  pill)
- `--sr-border-medium` (the "Show more" outline, the disabled icon ring)

The height change does not alter any text-on-fill pairing, so no contrast
re-verification is required and no contrast guard test needs extending.

---

## Interaction Notes

Behavior is unchanged. Stated explicitly so the height work cannot erode it:

- **The eligibility gate stays fail-closed.** `useEmbeddedMediaPreference`'s
  unresolved `null` and a saved `true` both mean `embedAllowed === false`; only a
  hydrated `false` opens the gate. `MediaFrame` remains the sole iframe
  constructor and keeps its own `embedAllowed` prop as defense in depth.
- **The overlay contract stays non-destructive.** The iframe is mounted for its
  whole lifetime. The give-up timer (20 seconds) and `onError` only *reveal* the
  fallback overlay; a late `onLoad` clears both latches and the real player swaps
  in. Nothing about the taller frame changes this.
- **Offline recovery stays event-driven.** The frame is keyed on the `useOnline`
  flag, so reconnecting remounts a fresh frame with clean latches. No
  `setState`-in-effect.
- **The reveal cap stays at six**, with the "Show more" button and its focus
  hand-off to the first newly-revealed tile intact.
- **No layout shift.** `.sr-media-frame` carries the height class alongside the
  iframe, the shimmer and give-up overlay are `position: absolute; inset: 0`, and
  the offline placeholder fills the frame at `height: 100%`. All four states
  therefore occupy the identical box, and the meta row below is unaffected.

### On the modelled player heights

The mockup embeds **no** Macaulay iframe and makes no network request, so its
player is a faithful simulation, not a measurement. It models a spectrogram that
scales with tile width (`clamp(104px, 34cqi, 168px)`), a 42px timeline preview
strip, and a 52px transport row — 211px total at the desktop tile width, 262px at
the top of the phone tier. Those numbers are the shape of the argument, not a
spec. Build 230px and 280px, and confirm the play control on the live desktop app
against real data before the ship, which the change brief already requires.

---

## Motion Spec

**No new motion is introduced in the product.** A taller box is a static size
change; a fade on a fallback that already appears instantly would be decoration
rather than explanation, and adding one would mean editing shared code that
Species Detail also renders. The doctrine's rule is to animate what changed, and
what changed here is a dimension.

Existing motion on this surface, confirmed compliant and unchanged:

- **Loading shimmer** (`.sr-media-shimmer` → `sr-media-shimmer-sweep`):
  1.4s, `ease-in-out`, infinite; a continuous progress indicator, which is the
  standing exception to the 300ms UI-motion ceiling. Suppressed by the global
  `prefers-reduced-motion` block, leaving the static surface. CSS.
- **Disabled notice settle** (`sr-media-disabled-settle`): 180ms, `ease-out`,
  `both`, a 5px upward translate from its own position. Under 300ms, ease-out,
  origin-correct. Reduced-motion suppressed. CSS.
- **Link hover** (`ChecklistLink`): instant underline, no transition. Unchanged.
- **Card expand/collapse** (`NamedBirdRow`, the parent): out of scope.

The blessed stack for this project is plain CSS on these surfaces; nothing here
needs Motion.

*Reserved, not shipped:* a 160ms `ease-out` opacity fade on the give-up overlay
would soften the swap now that it happens in a larger box. It is left out because
it touches `MediaEmbed.tsx`, which Species Detail shares. Say the word and it is
a few lines.

Motion in the **mockup** (presentation layer only, never shipped): 220ms
`ease-out` on the frame height and on the reveal padding, 200ms `ease-out` on the
stage width, 140–160ms `ease-out` on control and theme transitions. All collapse
to 0.01ms under `prefers-reduced-motion`.

---

## Content Notes

No user-facing copy changes in the product. The two fallback messages that audio
now shows for the first time are the existing shared strings, unchanged: **"Media
unavailable offline"** and **"Media couldn't load"**. Neither contains an em
dash. The disabled notice keeps its exact required sentence, **"Embedded media is
disabled in Settings."**

The mockup uses realistic content throughout: a named individual, *Pilgrim*, a
**Bewick's Wren** (canonical eBird name), with six matched Macaulay assets across
four dates in 2026, shape-valid eBird submission ids (`S218904471`, `S220117338`,
`S221664902`, `S222840915`), digits-only Macaulay catalog ids, and dates in the
month-first form `lib/formatDate.ts` renders by default. The card's comment
carries a real `[name:Pilgrim]` tag, which is how the feature matches media in
the first place. Photo and video tiles are labelled placeholders rather than
invented artwork, since no Macaulay media can be embedded in a standalone file.

---

## Design-system status and one logged deviation

`pipeline/design-system.md` **exists and is extended, not evolved.** No token, no
pattern, no new component. The design system's "Inline media (ML embeds)" pattern
currently reads "per-format height (photo/video taller, audio compact)"; the
Chronicler should narrow that to say Named Birds now runs one uniform height
while the per-format classes remain the mechanism, so a future surface can still
size a format differently.

**Deviation from the Weft design doctrine, deliberate.** The doctrine says never
use Inter or bare `system-ui` for the display face. This mockup uses SnowRaven's
real stack, `'Inter', system-ui, 'Segoe UI', Roboto, sans-serif`, declared the way
the app declares it — a custom property consumed through `font-family: var(…)`.
The doctrine's own precedence rule gives `design-system.md` the win on specifics
including type, that type has been locked across 61 shipped versions, and a
mockup of an existing surface in a different face would misrepresent the product.
Noted here rather than left for a reviewer to discover.

`weft-design-lint check` on `design.html`: **clean, 0 findings.**
