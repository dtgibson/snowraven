## Breeding Codes: Pin code labels

### What this does

Adds an opt-in **Pin code labels** toggle to the Breeding Codes tab, beside the
shipped `↔ Unbounded` button, that keeps the row of code headings (NB, FL, CF, ...)
visible while you scroll down a long species list. Today those headings scroll away
with the page, so partway down the list a circle's meaning is purely positional and
the columns become unreadable.

It is **off by default and session-only**, so anyone who never turns it on sees
today's table, byte for byte, in both views and at every width.

Pinning is offered **only in the Unbounded view**, where it is free: neither the card
nor the inner wrapper sets `overflow` there, so the scrollport is the page, a
`position: sticky; top: 0` header anchors to the viewport, and the table keeps its
full natural height. Normal view is not given a capped-height inner scroll box (see
*Notes for reviewer*). The control is still present and enabled in Normal view and
reaches the working behavior in one press, under the invariant **pinned implies
Unbounded**:

- Pin from Normal: switches to Unbounded and pins, in one press.
- Pin again: restores the view you came from and unpins. The round trip leaves no
  residue.
- Press `↔ Normal` while pinned: the pin clears and the pill visibly un-presses in
  the same row.

While pinned, a muted note above the table names what happened, and the pinned band
gets a slightly firmer edge (`--sr-border-medium` plus one new shadow token) so rows
read as passing under it.

### How to test

1. Open the Breeding Codes tab with an eBird backup loaded. Confirm it looks exactly
   as it does today, and that a **Pin code labels** pill has appeared to the left of
   `↔ Unbounded`.
2. Press **Pin code labels**. The view toggle flips to `↔ Normal`, a note appears
   above the table, and the pill shows as pressed. Scroll down: the code headings
   stay at the top of the screen, the table keeps its full height, and the tier
   legend still follows the last species.
3. Press **Pin code labels** again. The pin clears, the note leaves, and you are back
   in the Normal view you started from.
4. Press `↔ Unbounded`, then **Pin code labels**, then **Pin code labels** again.
   You should stay in Unbounded, not be kicked back to Normal.
5. Press **Pin code labels**, then press `↔ Normal`. The pin clears and the pill
   un-presses in the same row.
6. Narrow the window to phone width (or open on a phone). The two buttons should
   look like a matched pair, not one tall pill beside one short one, and the 30px
   dot-width code columns should still hold while pinned.
7. Set Text Size to 200% in Settings and repeat step 2 at 320px. The band should stay
   one row tall and the note should stay readable.
8. Toggle dark mode while pinned. The band's boundary should still read against the
   rows sliding under it.

### Notes for reviewer

**Why Normal view is not offered a capped-height box.** The brief left this open. It
was settled not by preference but by a binding requirement: the surface must hold at
320px and at 200% in-app text scale, and a capped box has no viable height unit
there. At 200% each species row is roughly 68px, so a `60dvh` cap on a 375x667 phone
leaves about five rows inside a box that scrolls independently of the page, with the
legend stranded below it, which is worse than the shape live-tested and reverted in
v0.5.69. A `26rem` cap resolves to 832px, taller than the viewport, so once the page
is scrolled the scrollport's top and therefore the pinned header sit off-screen and
the feature silently stops working. `min(26rem, 60dvh)` collapses back to the first
case. The v0.5.69 decision is touched but not reversed: its "do not re-introduce the
capped-height frozen-header box" holds as the default and as the shipped behavior.

**All the pinned CSS lives in `globals.css`, not inline, and this is load-bearing.**
The iOS variant has to re-point `top` to `env(safe-area-inset-top)` under the
`.sr-ios-app` gate, and a React inline style is specificity 1,0,0, unreachable from
a stylesheet. A sticky element resolves `top` against its scrollport (the viewport),
which sits above `.sr-ios-app body`'s padding, so without that gate the band would
pin into the notch. This required first lifting the shipped `thBase.boxShadow` out of
the inline style object into `.sr-bc-matrix thead th` (same value, so the unpinned
header is byte-identical) so the pinned rule can win by specificity instead of
fighting an inline value. `.sr-map-fullscreen-panel` is the worked example from the
build immediately before this one.

**`position: sticky` sits on each `<th>` individually**, never on `<thead>` or
`<tr>`: WKWebView and older Safari honor sticky on cells only, and this ships in
WKWebView on macOS and iOS. `border-collapse: separate` was already set inline and is
also required; nothing changed there. A test asserts no `thead`/`tr` sticky rule ever
appears.

**Contrast, stated plainly.** `--sr-border-medium` is about 1.65:1 against `--sr-bg`
in light mode. This is not claimed as a WCAG 1.4.11 pass and does not need to be: the
header is identified by its text, and the pinned state by the pill's `aria-pressed`
plus its visible pressed styling. The line and haze are visual reinforcement, not the
sole means of identifying a component or its state. A 3:1 line would read as a rule
rather than a hairline and would break the tab's register.

**Deliberate deviation, logged.** `.sr-touch-target` is added to the shipped
`↔ Unbounded` button as well as the new pill, which is one className beyond a literal
control addition. The two are now a visual group, so at ≤640 a 2.75rem pill beside
the toggle's inline 28px would read as a rendering error. The class sets `min-height`,
which clamps the inline height only on the phone tier, so desktop density is
untouched. The shipped toggle also currently misses the ~44px touch posture, which
this refinement should not entrench.

To be precise about what that className changes, since "desktop density is untouched"
is true of height but not of everything: `.sr-touch-target`'s **base** rule sets
`display: inline-flex` plus centering, and only `min-height` is scoped to ≤640.
`ghostBtn()` sets no display, so the shipped `↔ Unbounded` button moves from default
button rendering to flex centering at **all** widths. Its height, padding, border,
and font are unchanged, and `NamedBirdsTable.tsx:73-82` already ships this exact
pattern (`.sr-touch-target` on a pill with an inline `height` and no inline display),
so this is a centering improvement consistent with the rest of the app rather than a
regression. Worth knowing when reading the diff, rather than being surprised by it.

**One new token**, `--sr-sticky-shadow`, declared in both `:root` and
`[data-theme="dark"]` before use. Dark gets its own deeper value rather than a copy
of `:root`: `--sr-bg` is `#09090B` there, so the light 12% haze would be invisible.
A test rejects a verbatim copy, which is the shape of the v0.5.44 milestone-badge
defect. Both values are tinted with the app's own ink, not pure black.

**Accessibility.** The accessible name is the button's own text and nothing else,
with no `aria-label` anywhere, so the visible label and the accessible name cannot
drift (this repo has shipped a published accessible name a component never emitted;
the cheapest defense is not to have a second source of truth). The consequence of
pressing it rides on `aria-describedby` pointing at a persistent `.sr-only` span,
*"Pinning uses the Unbounded view."* — a description, not a name, so WCAG 2.5.3 Label
in Name stays trivially satisfied. Both buttons sit in a
`role="group" aria-label="Table view"`. Keyboard focus is kept clear of the band
(WCAG 2.2 SC 2.4.11) by `scroll-margin-top: 3rem` on the pinned table's body cells
**and their focusable descendants** — the descendants being the operative half,
since focus lands on the `<button>` `BirdName` renders inside the cell and
`scroll-margin` applies to the element scrolled into view rather than to an
ancestor, and does not inherit. This is the vertical *counterpart* of the shipped
`scrollPaddingLeft`, not the same property: `scroll-padding` goes on a scrollport,
`scroll-margin` on a focus target.

The first cut of this got it wrong (cell-only `scroll-margin-top`, which computes
`0px` on every focusable and so never participates in the scroll) and the security
review caught it. Both candidate fixes were then measured in Chromium by
reverse-tabbing the species list, which is the direction that aligns a target to the
top edge where the band sits: the shipped form left 3 focus stops obscured at 100%
text scale and 9 at 200%, while both a root `scroll-padding-top` and the descendant
`scroll-margin-top` eliminated every occurrence at both scales. The descendant form
was chosen because it stays inside this table's subtree: in Unbounded the scrollport
is the page, so `scroll-padding-top` would have to live on the root, and deferred
tabs stay mounted when hidden (`mountedTabs` only grows, the panel hides with
`display: none`), which would leave a document-wide scroll-padding on every other tab
after pinning and navigating away. A `:root:has(.sr-bc-matrix--pinned)` variant has
the same leak, since `display: none` does not remove the table from the DOM. Cost of
the `*` selector was measured at about +2ms of full restyle on a 7200-cell worst case,
only on a pin toggle. The probe is committed at
`pipeline/breeding-code-pinned-labels/focus-obscured-probe.mjs` so the numbers are
reproducible rather than asserted.

**The live region follows the v0.5.80 convention.** The `role="status"` region is a
chromeless wrapper rendered from the start (a live region has to exist before its
content changes, or the first change can go unannounced) and the note is its
`key={pinSeq}` child, so each pin is a real node replacement while the region's
`textContent` stays exactly the message. No invisible character is appended to force
a diff. A test presses the control repeatedly and counts DOM mutations rather than
asserting on `textContent` alone.

**Motion is one CSS keyframe**: the status note rises 2px over 160ms `ease-out`, with
an `animation: none` fallback under `prefers-reduced-motion: reduce`. The band itself
has no motion, because sticky is continuous positioning rather than a transition. No
new dependency. Nothing on this page smooth-scrolls, which was the one standing
caution (a smoothed scroll under a fixed band reads as the band drifting).

**Verification.** Every new guard was mutation-tested: each was confirmed to fail
against the specific wrong implementation it names, then confirmed green again. See
the hand-back for the list.

**Not included, deliberately.** No version bump and no `CHANGELOG.md` entry: this is
build 2 of a bundled Spool release, which takes one bump and one combined entry at
the end. `docs/HELP.md`, `README.md`, and `website/index.html` are updated in this
change, since all three already document the sibling `↔ Unbounded` toggle and would
otherwise be incomplete restatements of shipped behavior.
