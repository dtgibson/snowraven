# Freezable Label Rows

### What this does

Makes the Breeding Codes **Pin labels** control freeze *both* label axes at once
(the code header across the top and the species-name column down the side)
instead of trading one for the other, and repairs the Multimedia tab's header
pin, which has very likely never worked in the macOS app or on iOS.

Three parts:

1. **Breeding Codes reshape.** Unbounded normally drops the species-name
   column's `position: sticky; left: 0` so the matrix pans as one unit. Pinning
   is the one state where that choice stops paying, because the user has
   explicitly asked for labels to hold still, so the pinned state now keeps it.
   Both freeze sites (the corner header and every name row cell) derive from a
   single `leftFreeze` flag so they cannot drift into a half-frozen column. The
   pin is unchanged in every other respect: still opt-in, still default OFF,
   still session-only, `pinned implies Unbounded` untouched.
2. **Multimedia repair.** The header sticky shipped on the `<tr>` from v0.0.29.
   WKWebView honors `position: sticky` on cells only, and SnowRaven ships in
   WKWebView on macOS and iOS, so that pin was alive in Chromium (web, Windows
   WebView2) and dead everywhere else. It moves to a `<th>`-level rule in
   `globals.css` and gains the two guards an inline style could never carry: the
   `.sr-ios-app` safe-area inset, and `scroll-margin-top` on the focus targets.
   It stays always-on in Unbounded, with no opt-in pill.
3. **Two parity items.** Multimedia's `↔ Unbounded` button gets
   `.sr-touch-target` (it shipped 15px tall against the ~44px phone posture),
   and the Breeding Codes pill is renamed `Pin code labels` → `Pin labels`.

### How to test

See `how-to-see.md` beside this file for the click-by-click walkthrough. In
short: Breeding Codes tab → press **Pin labels** → scroll down and sideways, and
confirm the code header *and* the bird names both hold still. Then Multimedia tab
→ press **↔ Unbounded** → scroll down and confirm the column headings hold at the
top of the screen (this is the half that needs checking **in the desktop app**,
not a browser, since a browser was never the broken case).

### Notes for reviewer

- **The saved idea's "default on mobile" half was declined**, and the user
  ratified that. Measurement in the design pass showed defaulting the pin would
  push every bird name off-screen at 320px (mid-list name at x=-277) and leak
  306-629px of page-horizontal scroll at first open, in a state that cannot
  self-correct because `mountedTabs` only grows. It would also contradict
  v0.5.81's recorded "never something a user can land in." Nothing here seeds
  `pinned` from a breakpoint, and there is no `useIsPhone`, no persistence, and
  no storage-seam work.
- **Multimedia deliberately gets no pin pill**, so the two control rows are not
  symmetric. Breeding Codes' pill exists because pinning there changes your view;
  Multimedia's band is already scoped to a view the user chose and takes nothing
  away. An opt-in pill defaulted OFF would have been a visible regression for
  every Chromium user who has the header pin today.
- **Multimedia deliberately gets no frozen name column.** Its name column is
  238px at 1x and 423px at 200% on a 320px viewport (`minWidth: 200` with no
  viewport clamp), so freezing it would leave nothing for the data. Breeding
  Codes' column is clamped, which is exactly why the reshape works there and
  cannot be ported here. Giving that column a viewport clamp is a real follow-up
  idea and is out of scope (it would change the Normal view too).
- **The corner cell is the one element sticky on both axes when pinned**, so it
  carries an inline `z-index: 4` to out-layer the band (3, from the stylesheet)
  and the frozen body name cells (1). It still sets **no** inline `top` and
  **no** inline `box-shadow`: both come from the stylesheet, because an inline
  value at specificity (1,0,0) would make the `.sr-ios-app` gate unreachable and
  pin the band into the Dynamic Island.
- **Known limitation, not covered by any test:** a `<th>` sticky on *both* axes
  at once under WKWebView with `table-layout: fixed` is new here. Cell-level
  sticky is the recorded WKWebView-safe form and both single axes ship today, but
  the combination has only been verified in Chromium. It needs a look on device
  (macOS app and an iPhone) before ship, along with the band clearing the Dynamic
  Island on both tables. jsdom has no layout engine, so no unit test can settle
  it, and none pretends to.
- **Regression bar:** unpinned rendering is byte-identical on both surfaces, in
  both views, at all widths, and there is a test for each. No capped-height
  frozen-header box is reintroduced anywhere (v0.5.69 stays not-reversed).
- Docs updated in the same change per the standing rule: `docs/HELP.md`,
  `README.md`, `website/index.html`. The pin prose uses the settled house
  phrasing "per-session, resetting on relaunch" and now describes both axes.
- **A pre-existing false claim in that same paragraph was corrected on all three
  surfaces** (security review, Low). They said the species-name column stays
  frozen on a phone in *both* views; `leftFreeze = !wideMode || pinnedNow` says
  Normal always, Unbounded only while pinned, and no CSS supplies it either
  (`.sr-bc-name-col` has exactly one declaration in the emitted bundle,
  `border-right`). The claim predates this build, but this build rewrote the
  paragraph around it, so the page was selling the two-axis freeze as new while
  simultaneously saying it already happened without pinning. The dot-width
  narrowing and the vertical rules genuinely do hold in both views and are
  unchanged; only the frozen-column clause was rescoped, not deleted, since the
  Normal-view freeze is real and worth stating.
- `CLAUDE.md` corrected too: its "the species-name column is horizontally sticky
  ONLY" line is now half true (the pinned corner is sticky on both axes), and two
  present-tense references to the old control name were updated. The v0.5.81
  entries in `ROADMAP.md` and `PRODUCT_CONTEXT.md` were deliberately left alone:
  they are dated release retrospectives, and "Pin code labels" is what that
  release actually shipped, so editing them would falsify the record rather than
  correct it. Same reasoning that puts `DECISIONS.md` and `CHANGELOG.md` out of
  scope.
- No version bump, changelog entry, or tag: this is one build of a bundled Spool
  release, versioned once at the end.

### Verification run

- `npx vitest run` — 145 files, 1939 tests, all passing.
- `npm run build` (`tsc -b && vite build`) — clean.
- `npx eslint src --max-warnings=0` — clean.
- `grep -rn '—'` over the touched user-facing prose — clean.
- Each new guard was proved to **fail** against the wrong implementation: the
  stylesheet rules stranded inside the `≤640` tier (5 failures), the reshape
  reverted to `leftFreeze = !wideMode` (4 failures), and the `<tr>` sticky
  restored (2 failures).
- Cascade-competitor scan over **both** emitted stylesheets (`index-*.css` and
  `vendor-maplibre-*.css`), testing the rightmost compound of every selector
  carrying `background` / `box-shadow` / `position` / `top` / `z-index`: the only
  hits are the two feature blocks themselves, which target different tables. The
  new rule sits at brace depth 0 in the built CSS, i.e. unlayered, so it beats
  Tailwind preflight's `@layer base` on the stronger of the two grounds as well
  as on specificity.
