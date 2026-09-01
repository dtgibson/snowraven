# Design Spec - Settings Acknowledgments

**Status: Approved** (2026-08-31). Revision 2, after one round of user
feedback ("more subtle, no heart, no 'behind SnowRaven' language, a bit more
basic"); approved by the user in this form.

## Visual Direction

Quiet utility at the tab's QUIETEST register: the section is deliberately the
most basic thing in the Settings tab. It uses the established section
vocabulary in its plainest shipped form (SectionHeader + a card holding one
quiet bordered button, the Troubleshooting section's shape): no icon tile, no
row title, no description, no accent fill. The uppercase section header alone
names the section; the two entries inside the disclosure are the only prose.
No new tokens, no new patterns, no new type.

## Open questions resolved (PRD 1-4)

1. **Reveal mechanism: inline disclosure**, not an overlay. Two short entries
   do not earn a full-screen surface or a lazy-loaded component; the panel
   expands inside the section's own card, directly under the toggle.
2. **Placement: last section of the Settings tab.** Rendered after the
   Troubleshooting block in JSX (which is Tauri-gated), so it is last on every
   platform: after Troubleshooting on desktop, after Tab Layout on web/Pi and
   iOS. No existing section moves.
3. **Links: none.** The content is fully readable with zero navigation and the
   section stays strictly zero-network. (The Deven Simonson entry never links
   in any case, per FR-11.)
4. **Copy: entry substance kept verbatim; the row title and description are
   dropped entirely** at the user's direction (recorded below under Content
   Notes, with the FR-01 shape deviation).

## Screens / Views

### Settings tab, Acknowledgments section (collapsed - the default)

- `<SectionHeader label="Acknowledgments" />` (uppercase 0.6875rem/600 muted
  label + 1px `--sr-border` divider), following the Troubleshooting section.
- One card (`1px solid var(--sr-border)`, radius 10, `--sr-surface`,
  `overflow: hidden`), containing a single padded row (14px 16px, the
  Troubleshooting body-row shape) holding exactly one control:
  - The quiet bordered button "View acknowledgments": height 32, padding 0 12,
    `1.5px solid var(--sr-border)`, `--sr-surface` fill, `--sr-text` label,
    radius 6, 0.75rem/500 (the Rebuild caches / Replace register).
  - No icon tile, no row title, no description: the section header alone
    names the section. (Deliberate deviation from FR-01's icon-tile /
    title / description shape, made at the user's direction in review;
    log to `decisions.md`.)
- Collapsed, the section renders nothing else: no panel in the tab order, no
  content exposed to assistive technology.

### Settings tab, Acknowledgments section (revealed)

- The panel expands inside the same card, below the row: `--sr-surface-faint`
  background (the app's expanded-panel surface), 1px `--sr-border-subtle` top
  border, horizontal padding 16 (12 on the phone tier).
- Exactly two entries, separated by a `--sr-border-subtle` divider, each:
  - Name line: 0.84375rem/600 `--sr-text`.
  - "For ..." line: 0.8125rem `--sr-text-muted`, line-height 1.55.
- While open, the toggle reads "Hide acknowledgments" and takes the app's
  standard active-state tint (`--sr-accent-bg` fill, `--sr-accent` text,
  `--sr-accent-border` border, weight 600 - the pressed segmented-control
  treatment), returning to the quiet bordered treatment on collapse.
- No lead-in sentence, no heading inside the panel, no other credits (FR-07).

### Phone tier (320px) and 200% text scale

- The button takes the `.sr-touch-target` posture (min-height toward 44px,
  height auto, label may wrap); with no icon tile or trailing-action layout
  there is nothing left to stack.
- Panel text wraps; nothing scrolls horizontally at 320px width at 200% in-app
  text scale in either theme. The mockup demonstrates this via its width and
  text-scale toggles; the real build hangs these off the shipped <=640/<=480
  tiers rather than new machinery.

## Component Usage

- `SectionHeader` (existing, module-private in Settings.tsx) for the header.
- The card + padded body-row shape copied from the Troubleshooting section
  (the tab's quietest shipped icon-less register), holding one button styled
  like Rebuild caches / Replace. This deviates from FR-01's Help &
  Documentation action-row shape at the user's direction (see above).
- No icon, no new lucide import.
- The reveal is a grid-collapse disclosure (`grid-template-rows: 0fr/1fr`
  wrapper + `overflow: hidden` inner + `inert` on the collapsed content), the
  app's shipped disclosure mechanism (Map Explorer filter panel precedent).
  No overlay, no `HelpDocs`-style lazy component, no new dependency.
- No `OutboundLink` (no links ship). No `ToggleSwitch`, no `RadioGroup`.

## Design Tokens Applied

All existing; no new tokens. `--sr-surface`, `--sr-surface-faint`,
`--sr-border`, `--sr-border-subtle`, `--sr-text`, `--sr-text-muted`,
`--sr-accent`, `--sr-accent-bg`, `--sr-accent-bg-hover`, `--sr-accent-border`.
The accent appears ONLY in the open-state tint of the toggle (and the shared
focus ring); the collapsed section carries no accent at all, which is what
"subtle" means in this palette. Both themes come free via the tokens; the mockup embeds the
real light and dark values from `frontend/src/globals.css` and renders both.
(The mockup's card shadow tints its black with the app ink for doctrine
hygiene; the build simply uses the shipped `--sr-card-shadow` and friends,
value-identical in practice.)

## Interaction Notes

- The toggle is a real `<button>` with explicit `tabIndex={0}` (house rule),
  `aria-expanded` reflecting state, and `aria-controls` naming the panel id.
  Enter and Space activate it natively (FR-15).
- Label swaps "View acknowledgments" / "Hide acknowledgments" with the state;
  the accessible name is the visible label at all times (QA-07).
- Collapsed content carries `inert`: unreachable by Tab, absent from the
  accessibility tree (FR-05). React 19 emits `inert={false}` as absent -
  assert the literal attribute in both states per the repo rule.
- Collapse keeps focus on the toggle (focus never moves; nothing to restore).
- No Escape handling: this is an inline disclosure, not an overlay, and Escape
  belongs to overlays (FR-15's Escape clause applies only to overlay form).
- No live region anywhere in the section: the content is reference material,
  the state change is carried by `aria-expanded` (FR-16; the repo's
  "the collapsing content IS what would be announced" rule).
- Reveal state is session-only `useState`; no storage-seam, transport, or
  platform-seam calls; no `isTauri()` (FR-12, FR-13, FR-14).
- Open/close cycles flip the same attributes back and forth; idempotent by
  construction (FR-06).
- Inline static JSX adds negligible weight to Settings.tsx; nothing joins the
  entry chunk (`entryChunk.test.ts` unaffected; NFR-05's lazy-load clause is
  moot because no overlay component ships).

## Motion Spec

- Panel reveal (open): grid-template-rows 0fr to 1fr on the wrapper,
  cubic-bezier(0.2, 0, 0, 1) (the shipped species-picker ease-out), 200ms;
  origin-aware: the panel grows downward from the toggle row. Reduced motion:
  near-instant (transitions shortened toward zero, never removed, so
  transitionend still fires). Lib: CSS only.
- Panel content settle (open): opacity 0 to 1 (160ms ease-out) + translateY
  -4px to 0 (200ms, same bezier), transform-origin top center. Reduced motion:
  near-instant. Lib: CSS only.
- Panel collapse (close): the same grid-collapse transition in reverse; the
  inner wrapper's `overflow: hidden` re-clips on the close render. Reduced
  motion: near-instant. Lib: CSS only.
- Button state (open/close): border-color/background/color 120ms ease-out,
  matching the segmented controls' shipped 0.12s treatment. Reduced motion:
  instant. Lib: CSS only.
- No entrance animation for the section itself, no stagger, no pulse
  (anti-slop rules).

## Content Notes

Voice: quiet, sincere, plain; the section carries as little copy as it can.
No em dashes (U+2014) in any string (FR-10). Exact strings - the complete set;
there are no others:

- Section header label: `Acknowledgments`
- Row title: none (dropped at the user's direction)
- Row description: none (dropped at the user's direction; no "behind
  SnowRaven" phrasing anywhere)
- Button, collapsed: `View acknowledgments`
- Button, revealed: `Hide acknowledgments`
- Entry 1 name: `The Cornell Lab of Ornithology and the Macaulay Library`
- Entry 1 body: `For creating a wonderful platform for tracking birding data,
  and for making it freely available.`
- Entry 2 name: `Deven Simonson`
- Entry 2 body: `For providing early access to Weft to help build the
  SnowRaven app.`

Copy decisions against the PRD defaults (names, substance, and copy rules
preserved; the drops are user-directed):

1. FR-02's default row title and description do not ship: the user asked for
   a subtler, more basic section, and the uppercase section header already
   names it. The button keeps FR-02's default label, so the visible purpose
   and accessible name are exactly the PRD's.
2. Each entry splits the PRD's single sentence into a name line plus a
   "For ..." line, matching the tab's title-plus-description row vocabulary;
   wording is otherwise the default copy verbatim (a serial comma added in
   entry 1's split).
