# Design Refinement: Alerts inbox "Mark read" (approved 2026-10-01)

Approved by the user on 2026-10-01 with every recommended pick: the label
"Mark read", the 160ms fade, focus to Close, and the announcement "Marked read.".

Extends `pipeline/ios-alerts/design-spec.md` sections 7.3, 7.5 and 8. Nothing
in those sections is reversed; 7.5's "marks stay for the life of that opening;
they clear on close" gains "unless the user presses Mark read". The design
system (`pipeline/design-system.md`) is applied as is: no new token, no new
pattern, no new copy family. Mockup: `pipeline/alerts-inbox-mark-read/design.html`
(today beside proposed at 390 and 320 points and on the iPad panel; switches for
theme, 200% text, the two label candidates, fade versus instant, and showing
where focus lands; the query string presets them, for example
`?theme=dark&scale=2&label=all&focus=on`).

## Visual Direction

The sheet is unchanged except for one more quiet button in its footer. Mark
read sits in Clear's own register and takes nothing from it: same height, same
hairline border, same muted rest state. The only new motion is the New marks
leaving, and it is the shortest, calmest thing on the page.

## Screens / Views

### The sheet footer (iPhone sheet and iPad panel, one component)

Today: `[fine print ................] [Clear]`. Proposed:
`[fine print ................] [Mark read] [Clear]`.

- **Label:** **"Mark read"**. The user's words; Clear already acts on the whole
  inbox without saying "all", so the pair reads as two whole-inbox actions.
  Visible text and accessible name are identical (no hidden "all"). The
  alternative "Mark all read" is in the mockup's Label switch for comparison;
  it also fits at 320 points and 200% text, so the choice is one of voice, not
  of room.
- **Order and placement:** just before Clear, so the one action that removes
  things keeps the trailing edge. The two buttons live in one `.sr-inbox-actions`
  group (`display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px;
  margin-left: auto`) inside the existing wrapping footer, so they move as a
  pair: beside the fine print when the line is long enough, under it, right
  aligned, when it is not. Both keep `.sr-btn-quiet sr-touch-target`, which at
  the phone tier already gives the 44px posture and a label that may wrap.
- **Rest state:** native `disabled` whenever no row in the open sheet is New
  (the same `isNewSince` the rows use, against this opening's `viewedAt`),
  which matches Clear's `disabled` when the inbox is empty. Disabled look is
  the shipped `.sr-btn-quiet[disabled]`. It re-enables on its own when a newer
  snapshot brings a New row into the open sheet.
- **No confirmation.** Nothing is removed; pressing it once is the whole act.
- **Measured in the mockup:** at 320 points and 200% text, "Mark read" and
  Clear sit side by side under the fine print; so does "Mark all read". At 390
  and 100% both sit beside the fine print on one line. On the iPad panel (520
  max) both sit beside the fine print at 100%.

### What a press does (the user-visible sequence)

1. Focus moves to the sheet's **Close** button, before anything else, so the
   button that is about to disable itself never leaves focus on `<body>`. Close
   is the sheet's standing fallback (the Clear confirmation already sends focus
   there after a confirmed clear), it is always present and always enabled
   while the sheet is open, and it is not a destructive neighbor. (Rejected:
   focus to Clear, the adjacent button. It keeps the user in the footer, but it
   parks a screen-reader user one activation away from the removal action right
   after a harmless one.)
2. "Last viewed" is written to the snapshot's `now` through the storage seam;
   the badge, the sidebar pill, the Search row and the Settings Inbox row read
   zero at once. Close can never move the time backwards afterwards (the
   brief's pending-value rule).
3. One polite status sentence: **"Marked read."** It names the action and
   never a count (7.5). An always-mounted `.sr-only` element with
   `role="status" aria-live="polite"` in the footer; the text is set on press
   and cleared again after about four seconds, and on close, so a later press
   (after a new alert arrives) announces again. Nothing visible is added: the
   consequence is already where the cause is (the marks go, the button rests).
4. The New marks go. See Motion Spec. The header count ("6 alerts") does not
   change; no row moves; nothing is removed.

### iPad panel

Identical footer; the panel's base `.sr-btn-quiet` register (32px, no wrap) as
shipped. The panel still scales in from the opener; nothing about opening or
closing changes.

## Component Usage

- `Button` (the canonical primitive) for the new control, `className="sr-btn-quiet sr-touch-target"`, `type="button"`, native `disabled`.
- One new layout class, `.sr-inbox-actions`, in `globals.css` beside the `.sr-inbox-foot` rules.
- One new modifier, `.sr-alert--read`, for the leaving marks (below).
- The existing `.sr-only` for the status element.

## Design Tokens Applied

No new token. The button is `--sr-border` / `--sr-surface` / `--sr-text`, hover
`--sr-border-medium` / `--sr-surface-subtle`, disabled `--sr-surface-subtle` /
`--sr-text-disabled`; the marks stay `--sr-accent`. Both themes verified in the
mockup.

## Interaction Notes

- Enabled rule: `inbox.some(row => isNewSince(row, viewedAt))` for the open
  sheet's `viewedAt`; disabled otherwise (including the empty inbox).
- On press, in this order: `closeRef.current?.focus()`, then `markRead()` (the
  host writes the setting, updates the store count and the open sheet's
  `viewedAt`), then the status text.
- Focus must never land on `<body>`: if Close were ever missing, `<main>` is the
  last resort, as 7.3 already says for the sheet's own close.
- Escape, the scrim, the handle swipe and the X are unchanged. Clear and its
  dialog are unchanged, including "Clear leaves the timestamp alone".
- Tab order: Close, the rows, Mark read, Clear (DOM order; no `order`).
- The count stays out of every live region. The entry controls' accessible
  names ("Alerts inbox, 3 new") update as they do today.

## Motion Spec

- **New marks leaving (Mark read):** the 6px dot and the word New of every
  marked row fade `opacity 1 -> 0`, ease-out, 160ms, in place (no transform, no
  layout change during the fade), then unmount; the name line settles by the
  width of the dot and the word when they go. Reduced motion: the global rule
  collapses the transition, so they simply go. CSS (`.sr-alert--read`), with the
  sheet keeping its pre-press `viewedAt` for the marks until `transitionend` or
  a 200ms fallback, then adopting the new one. The write to "last viewed" and
  the badge going to zero are NOT delayed by the fade.
- **Mark read button:** color and background, ease-out, 120ms, as every quiet
  button; the change to disabled uses the same transition. Reduced motion
  instant. CSS.
- **Status sentence:** no animation (it is not visible).
- **Nothing else moves.** No pulse on the button, no row motion, no badge
  animation (7's "the badge and the count pills appear and change with no
  animation" stands).

## Content Notes

New strings, verbatim, for `alertsCopy.ts` (American spelling, no U+2014):

- `MARK_READ = 'Mark read'` (the visible label and the accessible name)
- `MARKED_READ_STATUS = 'Marked read.'` (the one polite announcement)

`docs/HELP.md`'s inbox paragraph gains one sentence, in the Help's register, on
the lines of: "Mark read clears the New marks and the count without removing
anything." The App Store "What's New" line is held for the user's yes at ship.

## Self-audit (doctrine pre-flight and `weft-design-lint`)

- `weft-design-lint`: one `warn`, `banned-font`, on the page shell's
  `system-ui` body stack. Justified: the frames use the app's shipped face
  (`--font-sans`, Inter / system-ui, from `globals.css` and
  `design-system.md`, which wins on specifics), and the page shell deliberately
  takes the viewer's system face so it recedes behind the devices. No external
  font is loaded because the mockup is self-contained.
- Three type roles inside the frames (title 0.9375rem/700, row name
  0.84375rem/500, captions 0.75 and 0.71875rem muted); neutrals are the app's
  tinted tokens; one accent, on the marks and the badge only; the shell has a
  soft radial depth rather than a flat slab; every transition ease-out and
  under 300ms; `prefers-reduced-motion` honored in the frames; no motion on
  mount beyond the sheet's own shipped entrance; realistic rows and places
  (the ios-alerts illustrative set); empty state designed (the shipped one);
  no nested cards; every control customized from the app's own registers.
