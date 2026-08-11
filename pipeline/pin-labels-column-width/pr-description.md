## Breeding Codes: the Unbounded card is sized by the table, not by the tier legend

### What this does

Pressing **Pin code labels** on the Breeding Codes tab roughly doubled every column
of the matrix. The pin was not the cause. `pinned implies Unbounded`, so pressing it
forces the view switch, and the real defect was in the **Unbounded view itself**:
pressing "↔ Unbounded" alone reproduced it identically, and pinned measured
byte-identical to unpinned Unbounded both before and after this change.

`.sr-bc-card { width: max-content }` sizes the Unbounded card intrinsically. The card
is a **column flex container**, so that width is the maximum over its two children's
contributions: the table wrapper and the tier legend. The legend is a wrapping row of
"CODE Full Label" chips, and its max-content is every chip on one unwrapped line, so
it won by a wide margin (1749px against the table's 792px on the demo dataset). The
table's `width: 100%` then resolved against that inflated card and `table-layout: auto`
stretched every column to fill it.

The fix constrains the legend so it can **floor** the card but never dictate it:

```css
.sr-bc-card > .sr-bc-legend { width: min-content; min-width: 100%; }
```

`width: min-content` makes the legend contribute its widest single chip for both
intrinsic sizes, so it can no longer raise the card's max-content above the table's.
`min-width: 100%` stretches it back across the resolved card in layout, and cannot
feed back into the sizing because a percentage is indefinite while the container is
being sized intrinsically. The legend now wraps to the card's width instead of setting
it, which is what the card's shipped comment and DECISIONS v0.5.70 already claimed was
happening.

Nothing else moved. The `pinned implies Unbounded` invariant, the shared
`lib/pinnedLabels.ts` state machine, the v0.5.83 code-header-row-only freeze, the
v0.5.69 capped-height revert, and the ≤640 phone tier are all untouched.

### Why this shape, and not the two alternatives

**Not "size the card from the table" (`.sr-bc-card { width: min-content }` at every
width).** It measures the same today, because every column of this table is
width-pinned so its two intrinsic sizes coincide. But it would still be the maximum
over both children, so the legend would keep dictating the card whenever it happened
to be the larger. The defect would shrink rather than go away, and it would come back
silently the first time a column's content grew or few codes were present.

**Not "remove the legend from the sizing entirely"** (`width: 0; min-width: 100%`, or
`contain: inline-size`). Both work on desktop and both drop the legend's contribution
to zero, which lets the card fall below the widest chip. Each chip is
`white-space: nowrap`, so the chip would then hang outside the card's rounded border
and leak horizontal scroll. That is reachable on a phone at 200% text scale with few
codes present, where the table is narrow and the chips are large. `min-content` keeps
the legend as the card's floor and the table as its ceiling, which is the property
that survives both tiers.

The rule is **top-level**, not inside a tier, so it holds at every width including
≤640 where the card is `min-content` and the legend would otherwise be free to set it
above the fixed-layout table's declared-column-width sum. It is **scoped under
`.sr-bc-card`**, which is what makes "Normal view is untouched" a property of the
stylesheet rather than of a measurement: Normal never carries that class, and there
the card is a stretched flex item at the panel's width with nothing sized
intrinsically.

### How to test

`pipeline/pin-labels-column-width/how-to-see.md` has the click-by-click version. In
short: Breeding Codes tab, press "↔ Unbounded" (or "Pin code labels", which switches
for you) on a desktop window and confirm the columns keep the density they had in
Normal instead of doubling, with the whole matrix visible and the legend wrapped
under it. Then narrow to a phone width and confirm the dot-width columns are
unchanged in both views.

### Measurements (real render, both engines)

The claim here is geometric, so it is measured, not reasoned about.
`pipeline/pin-labels-column-width/card-width-probe.mjs` drives the running app (built
frontend served by the backend, pointed at the **synthetic demo dataset** with
`SR_DATA_DIR`, never a real export) and measures the shipped DOM nodes, resolved by
structural path from the `<table>` and guarded (child count, tier-label text) so a
reshape fails loudly instead of measuring the wrong node. Each element is measured
against **its container's content box**; page `scrollWidth` is not used, since this
repo has twice seen it certify a broken build.

Before and after are measured on the **same nodes in the same page**: the entire
DOM-side change is one class, so the probe measures, removes the class, and measures
again. Run in **Chromium and WebKit** (the app ships in WKWebView on macOS and iOS);
the two agreed to within 0.5px everywhere, so only Chromium is tabulated.

13-code demo dataset, `.sr-panel` content box 1232px:

| case | card | table | species col | code col | card past container |
|---|---|---|---|---|---|
| desktop 1440, Normal, before | 1232 | 1230 | 341.66 | 68.33 | 0 |
| desktop 1440, Normal, **after** | **1232** | **1230** | **341.66** | **68.33** | **0** |
| desktop 1440, Unbounded, before | 1751.2 | 1749.2 | 485.88 | 97.17 | +519.2 |
| desktop 1440, Unbounded, **after** | **794** | **792** | **220** | **44** | **-438** |
| desktop 1440, Pinned, before | 1751.2 | 1749.2 | 485.88 | 97.17 | +519.2 |
| desktop 1440, Pinned, **after** | **794** | **792** | **220** | **44** | **-438** |
| desktop 1440, Unbounded @200% text, before | 2953.42 | 2951.42 | 872.33 | 159.92 | +1721.42 |
| desktop 1440, Unbounded @200% text, **after** | **814** | **812** | **240** | **44** | **-418** |
| phone 320, Normal, before / after | 272 / 272 | 518 / 518 | 128 / 128 | 30 / 30 | 0 / 0 |
| phone 320, Unbounded, before / after | 520 / 520 | 518 / 518 | 128 / 128 | 30 / 30 | +248 / +248 |
| phone 320, Pinned, before / after | 520 / 520 | 518 / 518 | 128 / 128 | 30 / 30 | +248 / +248 |
| phone 320, Unbounded @200%, before / after | 632.52 / 632.52 | 630.52 / 630.52 | 240 / 240 | 30 / 30 | +360.52 / +360.52 |

Reading of the numbers:

- Unbounded now hugs the table (card 794 = table 792 + the card's 2px border), and the
  code columns land on their declared 44px instead of 97px. The card no longer runs
  519px past the panel, so the page-level horizontal scroll on a 1440px window is gone.
- Pinned is identical to Unbounded in every row, before and after. The pin was never
  doing this.
- **The ≤640 tier is byte-identical in every case**, including at 200% text scale: the
  card still sits flush with the fixed-layout table (`card - table` = 2px, the border)
  and the code columns are still 30px. The v0.5.70 phone behavior does not regress.
- The legend's own contribution to the card drops from its content width (1749.2px) to
  its min-content (209.64px), measured inside a `.sr-bc-card` host so the scoped rule
  applies. No chip overflows the legend's box in any case measured.

The remaining honest gap: Playwright's WebKit is WebKit, not the exact WKWebView build
the desktop and iOS apps embed. The legend also wraps correctly in the narrower card at
both widths (checked by screenshot, four tier rows stacked instead of one line).

### Guards added

- **`frontend/src/lib/breedingCodePinnedCss.test.ts`** (the stylesheet's own guard, and
  the sixth consumer of the shared `parseTopLevelRules`): the constraint caps at
  `min-content` and spans with `min-width: 100%`, declares no `contain`, is
  **top-level** with no at-rule re-declaring a width on the legend, is **scoped under
  `.sr-bc-card`**, and the card itself still declares `max-content` at top level and
  `min-content` in the ≤640 tier (locking in that the fix constrained the legend rather
  than moving the card).
- **`frontend/src/components/BreedingCodeTable.test.tsx`**: the legend carries the class
  in **both** views, carries no inline width (an inline style is specificity 1,0,0 and
  would make the rule unreachable), and is still the card's **last direct child**, which
  is the DOM shape the child-combinator rule assumes.

Every one of those was **mutation-checked** against the rule's own sliced block, and
the correct-but-different forms were run too, not just the broken ones:

| mutation | expected | observed |
|---|---|---|
| rule deleted (the pre-fix state) | red | red |
| `width: 0` (zero contribution) | red | red |
| `contain: inline-size` (the other zero-contribution form) | red | red |
| rule consolidated into the ≤640 tier | red | red |
| unscoped bare `.sr-bc-legend` | red | red |
| card sized `min-content` instead (the rejected alternative) | red | red |
| ≤640 tier re-declares a width on the legend | red | red |
| `className` dropped from the legend | red | red |
| inline width added to the legend | red | red |
| extra child appended to the card | red | red |
| descendant combinator instead of child | **green** | green |
| declarations reordered, no trailing semicolon | **green** | green |
| rule moved to the end of the stylesheet | **green** | green |

### Notes for reviewer

- **`CLAUDE.md` needs one correction, flagged for The Chronicler rather than edited
  here.** Its `.sr-bc-card` description ("the card hugs its wide auto-layout table")
  and the matching comment in `globals.css` were false on desktop before this change:
  the card hugged the *legend*. The `globals.css` comment is corrected in this diff;
  `CLAUDE.md` is The Chronicler's to fold in at closeout.
- **DECISIONS v0.5.70 is not reversed.** Its "desktop Unbounded stays intentionally
  wide" is about the ≤640 dot-width narrowing not applying to desktop, and desktop
  still keeps its wider 44px code columns against the phone's 30px. Its three durable
  CSS lessons (auto-layout treats a declared width as a floor; fixed layout plus
  `width: 100%` inside a shrink-to-fit container is circular; a `max-content` card over
  a fixed-layout table sizes to the columns' intrinsic width) are all untouched, and
  the phone-tier `min-content` card they introduced measured identical here.
- **The Multimedia twin is genuinely unaffected**, as the brief said: `LifeListTable`
  puts its wideMode `width: max-content` on the scroll wrapper and has no legend
  sibling to inflate it. Its pinned-labels control shares `lib/pinnedLabels.ts`, which
  this change does not touch.
- **No published prose changes.** `docs/HELP.md`, `README.md`, and `website/index.html`
  describe Unbounded as dropping the table's horizontal scroll constraint so the full
  row is visible, which was true before and is more true now. Nothing published claimed
  a column width. `ACCESSIBILITY.md` and `PRIVACY_POLICY.md` are unaffected (no new
  request, provider, setting, or focus behavior).
- One user-visible consequence worth naming: on a wide window with a narrow matrix, the
  Unbounded card is now **narrower than the panel** (794px in a 1232px panel) rather
  than wider than the window. That is what "the card hugs the table" means, and it is
  what the brief specifies as done; the card still grows past the panel and page-scrolls
  whenever the table genuinely needs it, which is the whole point of the view.
- No version bump, no CHANGELOG entry, no commit: this ships inside a bundled Spool
  release that bumps once at the end.
- Verified: `npm run test` (151 files, 2013 tests, all passing), `npm run lint` (clean),
  `npm run build` (`tsc -b && vite build`, clean apart from the pre-existing maplibre
  chunk-size warning). The built stylesheet was checked to carry the rule **unlayered
  at brace depth 0**, and a cascade-competitor scan over both emitted CSS chunks
  (`index-*.css` and `vendor-maplibre-*.css`) found no rule that could set a width or
  min-width on this element: the only `> *` width rules are scoped under
  `.sr-field-row` / `.sr-action-row-stack`, neither of which is the legend's parent.

## Convention Flags

- When a card sizes itself intrinsically (`width: max-content` / `min-content`) and is
  a flex or grid container, its width is the maximum over **all** its children's
  contributions, not just the one it was built around. A sibling that wraps (a legend,
  a chip row, a footer strip) will quietly become the ruler. Constrain the sibling with
  `width: min-content; min-width: 100%` so it can floor the container but never dictate
  it, rather than sizing the container from a different keyword or zeroing the sibling
  out.
- Prefer `width: min-content` over `width: 0` / `contain: inline-size` when removing an
  element from a container's intrinsic sizing, wherever that element contains
  unbreakable (`white-space: nowrap`) content. Zeroing the contribution lets the
  container fall below the content's own minimum, which puts the content outside the
  container's border.
- A stylesheet guard that identifies its rule by scanning for what the selector
  **targets** (`/^\.sr-bc-card\s*>?\s*\.sr-bc-legend$/`) rather than by one literal
  spelling stays green across equivalent refactors while still going red on the defect.
  Pair it with a "never vacuous" assertion so a deleted rule cannot pass as a clean scan.
