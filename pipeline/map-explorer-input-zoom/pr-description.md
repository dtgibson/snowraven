# Map Explorer sidebar: stop iOS zooming the viewport on focus

### What this does

Nine form controls in the Map Explorer sidebar carried no `.sr-input-16`, so at the
phone tier each computed a sub-16px font size and iOS zoomed the viewport whenever
one was focused. This adds the guard to each of the nine control elements, which is
a miss from the v0.5.61 sweep rather than anything new. Every other tab in the app
already behaves.

One companion CSS rule falls out of it: at 16px the Date Range pair no longer fits
side by side in the 282px sidebar, so that row now stacks through the whole phone
tier instead of only below 480px. Nothing above 640px changes.

CSS-only. No behavior, state, transport, or accessible-name change.

### The nine controls

Nine source edits cover fifteen rendered instances, because `AddressSearch` and the
latitude/longitude pair are each one source site rendered in the hotspots, media
targets, and nearby lifers sidebars.

| Control | Element | Was | Now (phone tier) |
|---|---|---|---|
| Place-name search | `input[type=text]` | 12px | 16px |
| Latitude | `input[type=number]` | 12px | 16px |
| Longitude | `input[type=number]` | 12px | 16px |
| Species filter | `select` | 13px | 16px |
| From date | `input[type=date]` | 12px | 16px |
| To date | `input[type=date]` | 12px | 16px |
| County filter | `select` | 13px | 16px |
| Media filter | `select` | 13px | 16px |
| Target species search | `input[type=text]` | 12px | 16px |

The class sits on each `<input>` / `<select>` itself, beside its inline `style`. That
placement is the whole point: the rule carries `!important` precisely because it has
to beat an inline `fontSize` (specificity 1,0,0), and putting it on a wrapper is how
the same guard sat silently inert on roughly 25 inputs until v0.5.61.

The heatmap-intensity `input[type=range]` and the manual-target `input[type=checkbox]`
are deliberately left unguarded. Both are focusable, but neither raises a keyboard, so
neither triggers focus zoom. A test pins that boundary so a later sweep has to re-make
the decision rather than drift into it.

### Why not `.sr-ctl-row`

`.sr-ctl-row` is the container hook for a filter *row*; this is a sidebar. The nine sit
in four separate subtrees, and the hook sizes every interactive descendant, which here
would also catch the four-button Breeding Code `SegControl` (nowrap labels at 0.71875rem
in a 282px overlay, so 16px would wrap them onto extra rows), Map View, Point Size,
Radius, "Use my location", "Find sightings", and every in-view marker-list row. That is
unrequested layout change on controls that never zoomed.

### The Date Range pair

`.sr-field-row` stacks at 480px and below, so from 481 to 640 the two native date inputs
sit side by side, each getting 120.5px of the sidebar's 250px of content. This was the one
real risk in the brief, and it turned out to be real: measured in Chromium against the
built CSS, `08/09/2026` fits at 12px and renders as `08/09/202` at 16px, with the year's
last digit cut off. Screenshots of both revisions are in the verification notes below.

The repair is the brief's named contingency, scoped: the row stacks through the whole
phone tier when it is inside the map sidebar, so each field gets the full 250px. The
guard is not weakened.

Scoped rather than moving the global tier to 640 because `.sr-field-row` has six
consumers, and the other five (LifeList, BreedingCodeList, Checklists, SpeciesDetail,
App) all sit in the full-width main panel with 220px+ per field in that band. Moving the
global tier would restack five surfaces that have no problem. This follows the repo's
standing "prefer the rule that lives inside the feature's own subtree" convention.

### Vertical fit at 200% text scale

All nine sit in fixed 34px boxes (the target-species search is 32px), so this needed
checking rather than assuming. It is fine, and the reason is structural rather than
lucky:

`max(16px, 0.75rem)` only *raises* a control's size while `0.75rem` is below 16px, i.e.
below about 133% text scale, where it pins to exactly 16px against a 31px content box.
Above that the formula returns the rem, which is what the inline style already was. So at
200% scale the six inputs are 24px both before and after this change — a no-op — and the
three selects go from 26px to 24px, a slight reduction. The boxes are never made tighter
at any scale, which is why no accommodation was needed.

The LifeList precedent sizes its guarded selects with a rem `minHeight` rather than a
fixed px height, so it is not a directly transferable pattern here; the answer came from
measurement instead.

### How to test

See `pipeline/map-explorer-input-zoom/how-to-see.md`.

### Notes for reviewer

**Verification.** This is a CSS-only fix, so per CLAUDE.md a stylesheet test is not
sufficient. Both revisions were rendered in Chromium (Playwright, already a dependency in
`website/tools/`) against the real built `dist/assets/index-*.css`, on the same DOM nodes,
and `getComputedStyle().fontSize` was read off all nine controls across viewports 320 /
480 / 481 / 640 / 641 and text scales 1x / 1.33x / 2x. Results:

- All nine compute 16px at every phone-tier width at 1x and 1.33x (was 12px / 13px).
- 641px is identical to the pre-change build on every control at every scale: same font
  sizes, same widths, same layout. Desktop is untouched.
- No horizontal clipping and no page horizontal scroll at any tested width, including 320px.
- The Lat/Lng row does not wrap; "Latitude" and "Longitude" both render in full at 16px in
  their 121.5px boxes.

**One thing the numeric probes got wrong, worth knowing.** `scrollHeight > clientHeight`
reports true on the three `<select>`s at 200% scale, which looks like vertical clipping. It
is a `<select>` internal-metric artifact: the screenshots show no clipping, and the flag is
present in the *pre-change* revision too (at a larger 26px). Proxy metrics were not trusted
here; the visual settled it.

**Pre-existing defect found, deliberately not fixed.** At 641px the sidebar narrows to
`clamp(240px, 28vw, 300px)` = 240px, which gives each date input 99.5px, and the year is
already clipped there today at 12px (`08/09/202`). Both revisions render identically, so
this change neither causes nor worsens it. It is outside this fix's scope, which is the
phone tier only. Flagging it for the roadmap.

**Tests.** Two, and both were verified to fail against the wrong implementation rather than
just read:

- `frontend/src/components/MapExplorerInputZoom.test.tsx` (new, jsdom) asserts the class
  reaches each of the nine control elements and that the element is the `<input>`/`<select>`
  itself. Its header is explicit about the limits: jsdom has no layout engine, no media
  queries, and no cascade against inline styles, so it proves placement and nothing about
  whether the rule wins. Confirmed to fail 3 of 4 on pre-fix source, and confirmed to fail
  when the class is moved onto the wrapper `<div>` — the exact historical regression.
- `frontend/src/lib/filterControlSizeCss.test.ts` (extended) guards the companion stacking
  rule: that it exists inside the 640 tier, that it is sidebar-scoped rather than a global
  tier move, that the stacked fields get full width, and that the nine controls still carry
  the guard (so nobody "fixes" a future clip by removing `.sr-input-16` and quietly
  restoring the zoom). Each of the four was mutation-verified.

Full suite: 142 files / 1883 tests pass. `npm run build` and `npm run lint` both clean.

**Cascade check.** The new rule was scanned against both stylesheets the bundle emits
(`index-*.css` and the lazy `vendor-maplibre-*.css`). The only `.sr-field-row` competitors
are the base rule at (0,1,0), which this outranks at (0,2,0), and the 480-tier pair, which
sets identical values so the overlap is inert. maplibre's stylesheet contains no
`.sr-field-row` rules and no bare `input`/`select` font-size rules.

**No version bump or changelog entry**, per the Spool bundle instruction. That happens once
at the bundle.
