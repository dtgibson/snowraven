# Centre-share latch

### What this does

Clears the copy popup's open flag when the search centre is cleared, so the
popup cannot reopen on its own the next time a centre arrives.

On the Hotspots, Nearby Lifers and Media Targets views, the popup is gated on
`centerShareShown = centerPinShown && centerShareOpen`. Emptying a coordinate
field makes `hasValidCenter` false, which unmounts the popup without routing
through `closeCenterShare` — so the flag was left set with nothing on screen,
and the next centre to arrive by any route (retyping, the place-name search,
Use my location, a right-click drop) brought the popup straight back.

The fix is one line, in the render-adjustment shape already shipped for the
view-mode axis:

```tsx
const centerPinShown = isCenterView && hasValidCenter
if (!hasValidCenter && centerShareOpen) setCenterShareOpen(false)
```

`centerPinShown` has two factors. The FR-18 adjustment in the share block
covers `isCenterView`; this covers `hasValidCenter`. It is the missing half of
an existing pattern, not a new mechanism.

### Why not the remediation the security report recorded

`pipeline/uniform-map-fabs/security-report.md:186` says to *"route the
coordinate-cleared path through `closeCenterShare`"*. **That is worse than the
bug, and it was measured rather than argued about.** `closeCenterShare` arms
`restoreCenterPinFocusRef`, and the effect keyed on `centerShareOpen` then
moves focus to the opener. On this particular edge the opener has unmounted
along with the centre pin, so the fallback runs and focus lands on the
centre-share FAB: backspacing the Latitude field throws the caret out of the
field mid-edit.

Confirmed by building it. With `closeCenterShare()` in place of the bare
setState, the third test below fails with `activeElement` as the
`Set a search center to copy its location` button instead of the input. That
test names the report and the reason in its own body, so the next person to
read the report does not "fix" it back.

### Why no tracking state, unlike the adjustment it mirrors

The shipped view-mode adjustment holds a `shareViewMode` state to detect a
change. This one does not, and the difference is not stylistic — the two axes
ask different questions.

A view change from Hotspots to Media Targets leaves the popup perfectly
showable, so only the *change* is a signal and the previous value has to be
remembered. No valid centre makes the popup unshowable outright, so this is a
standing invariant and comparing against the flag itself is the whole test.
Adding a tracking `useState` here would be a redundant mirror of a derived
value, and (the reason the brief raised placement at all) it would have to sit
with the other hooks around line 220 while its comparison sits at 2098, ~1880
lines apart, with a comment explaining the separation. The invariant form needs
neither. It is self-terminating either way: the update falsifies its own
condition, so the adjustment render runs once.

The narrow condition is deliberate. Writing it as `!centerPinShown` would also
subsume the shipped view-mode adjustment, which is a consolidation this change
is not making — the brief flags any drift toward tidying the close paths as the
regression risk on this surface.

### What is deliberately untouched

- **`aria-expanded={hasValidCenter ? centerShareShown : undefined}`** — the
  v0.5.84 sub-decision, upheld byte-for-byte. Its *justification* changed and
  its comment was rewritten to say so honestly: the latch it was partly written
  against is now closed at the source, so the gate now carries only the
  absent-vs-`"false"` choice (a control that discloses nothing claims no
  expanded state at all). That is still a real rendering difference. Verified by
  mutation: replacing the gate with a bare `centerShareShown` turns two existing
  tests red, so the comment's claim that dropping it still fails the suite is
  tested, not asserted.
- **Pin Share sub-decision 4 (v0.5.80), explicit press only** — reinforced. A
  popup that reopened by itself sat against it.
- **`SharePopup`'s capture-phase Escape contract**, the focus-restore effect,
  `closeCenterShare`, FR-18's view-mode clearing, the pan-first press, the three
  FAB labels, and the mobile-filters and fullscreen overlays. No close path was
  consolidated.

### The tests, and what each rejects

Three cases added to `MapExplorerCenterShareFab.test.tsx`, in a new
`a cleared centre does not leave the popup latched open` block. The file was
extended rather than a second harness written beside it: the flag lives in
`MapExplorer`, so the existing mocks are exactly the ones needed, and the file
already carried the two assertions this fix makes stale.

Only one mock changed: `CenterPinDropper` still renders `null` and now also
hands its `onDrop` out, which is what makes the right-click route reachable.

| Test | Fails on |
|---|---|
| stays closed when the centre is typed back in | the fix removed |
| stays closed when a right-click drop sets the centre | the fix removed |
| leaves focus in the field being edited when the centre is cleared | the report's remediation |

**All three were mutation-checked in both directions**, because the existing
suite rejected none of this — all 89 tests across the four share suites were
green with and without the fix, which is exactly the "a test that passes either
way is not a guard" case.

- Remove the one line: the first two go red, the third stays green (it
  discriminates against the wrong fix, not the absent one).
- Substitute `closeCenterShare()`: the third goes red, the first two go green.

Two routes are exercised rather than all four, and that is the whole range on
purpose: every way of setting a centre lands in the same `lat`/`lng` state,
which is what the guard reads. The drop is named because `applyCenter`'s own
comment promises a drop-to-search stays visually identical to today, and with
the flag latched that promise did not hold.

### Two existing comments amended, neither assertion weakened

Both are now false or non-discriminating because of this change, so leaving
them would be doc rot inside the guard itself.

1. The `must not LATCH` half of *does nothing at all when pressed with no
   centre* no longer discriminates on its own — the adjustment would clear a
   flag set there anyway, in the same render pass. It is kept, not deleted,
   because the pan assertion above it still rejects the mutation both halves
   were written against, and the comment now says exactly that and points at the
   block that does reject the latch. This is the house rule about a guard whose
   discrimination has been shown to be absent.
2. The doc comment on *drops the expanded state…* said the flag "stays true with
   nothing on screen". It no longer does. Its assertions are unchanged and it
   still rejects dropping the gate.

### No browser render

Contrary to this repo's usual posture, and deliberately. Every claim here is a
DOM-identity or attribute question that jsdom answers correctly: nothing moves,
no CSS rule changes, no accessible name changes, no geometry. The CLAUDE.md rule
about layout, cascade and accessible names being invisible to jsdom does not
bite. Playwright and the `SR_DATA_DIR` demo dataset were not stood up.

### Published prose

No change needed, and this was checked rather than assumed.
`docs/HELP.md:305` and `website/index.html:324` already describe the popup as
opening on a press. `ACCESSIBILITY.md:17`'s two focus sentences ("closing the
popup returns focus to whichever control opened it", "pressing that button to
close never moves focus off the button just pressed") stay exactly true — this
change routes around the focus path rather than through it, which is the point.

### Verification

| Gate | Result |
|---|---|
| `npx vitest run` | 163 files, 2214 tests, all passing |
| `npm run build` | exit 0 (the real type gate; vitest does not type-check) |
| `npm run typecheck` (`tsc -b`) | clean |
| `npm run lint` | exit 0, including `react-hooks` v7's render rules |
| `backend/.venv/bin/python -m pytest backend/tests/ -q` | 193 passed |
| `lib/entryChunk.test.ts` against the fresh `dist/` | 12 passed |

**Shipped CSS byte-identical to HEAD**, the check learned from build 3 of this
bundle (Tailwind v4 auto source detection scans test files, so a bare word new
to the corpus in a comment can be extracted as a class candidate and emitted).
A clean `dist/` before and after produced the same content hashes and the same
sha256:

```
6a099c257c102b179607d9c92df94d470792295f2d97dd42d996e8d1dce84a4e  index-CrwYPorM.css
250bbffd7789f7fc4abb05eec8d12a19dcba9c3426578e9ee1185934f4c8c238  vendor-maplibre-B2k4QVOw.css
```

### Notes for reviewer

- The functional change is one line. Everything else in
  `MapExplorer.tsx` is comments, including two rewritten because this change
  made them false.
- The condition reads `!hasValidCenter && centerShareOpen` rather than the
  broader `!centerPinShown && centerShareOpen` on purpose. See above.
- The security report's remediation is now wrong in a way that is only visible
  if you build it. The third test exists to keep that finding.
