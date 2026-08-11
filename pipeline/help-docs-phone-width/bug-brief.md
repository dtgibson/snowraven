# Bug Brief — help-docs-phone-width

## What is broken
Confirmed in a real browser render, not reasoned about. On a phone the Help overlay's body
scrollport scrolls horizontally, so every line of prose runs off the right edge mid-word and
must be dragged left/right to read. This is **layout, not content**: `.sr-help-row` keeps its
inline `alignItems: 'flex-start'` while the ≤640 tier flips it to `flex-direction: column`, so
`align-items` now governs **width** and the content column shrink-to-fits to its own intrinsic
width instead of stretching. `minWidth: 0` cannot help — it relaxes the main axis, and here
width is the cross axis. `docs/HELP.md` needs no change.

## Steps to reproduce
1. Build the frontend and serve it with the backend pointed at the synthetic demo dataset:
   `SR_DATA_DIR=website/tools/demo-data .venv/bin/python -m uvicorn main:app --port 1799`.
2. Open the app at a 320px (and 390px) viewport, click **Help** in the footer.
3. Drag the help body sideways, or measure it: `document.querySelector('.sr-help-row').parentElement`
   reports `scrollWidth 506 / clientWidth 320`. Repeat at 200% in-app text scale (`localStorage['sr-text-scale']='2'`).
4. Scripts and screenshots are in the run scratchpad (`measure-help.mjs`, `drill-help.mjs`, `verify.mjs`).

## Expected behavior
The content column fills the row's content box at phone widths; text wraps and the help body
never scrolls horizontally. The one legitimately wide item, the coordinates `<pre>` block, keeps
scrolling **inside its own** `overflow-x: auto` box (measured contained: 296px box, 492px
scrollWidth) rather than widening the overlay. Desktop, iPad, and the iOS safe-area behavior stay
byte-identical.

## Blast radius
Measured overflowing element: the unclassed content column, `.sr-help-row`'s second child
(`HelpDocs.tsx:422`) — 494.28px at 100% scale, 680px at 200% (its `maxWidth` cap). Numbers below.
Change only the ≤640 tier, beside the existing `.sr-help-row` / `.sr-help-toc` overrides
(`globals.css:2183-2184`); the parent's `align-items` is inline (1,0,0) so the override needs
`!important`, as `flex-direction` already does. The column has no class today, so one must be added.
Leave alone: `align-items: flex-start` above 640 (load-bearing for the sticky TOC — measured clean
at 641/768/1024/1440), the `.sr-ios-app` safe-area rules on `.sr-help-panel` and `.sr-help-toc`
(guarded by `iosChrome.test.ts`), the shared `.sr-pad-x-trim` (5 other consumers), `docs/HELP.md`,
and the `<pre>` blocks. Never `body { overflow-x: hidden }`.

## What done looks like
The help body scrollport measures `scrollWidth === clientWidth` at 320px and 390px, at both 100%
and 200% text scale, verified in a **browser** (a stylesheet test is inert here per CLAUDE.md).
1024px stays at 0 overflow. Note page `scrollWidth` is useless as the assertion: it read a clean
320/390 in every broken configuration because the panel is `overflow: hidden` — measure the column
against `.sr-help-row`'s content box.

---

## Measurements (Chromium, deviceScaleFactor 2, demo dataset)

Shipped behavior — content column vs `.sr-help-row` content box, and the body scrollport the user drags:

| viewport | text scale | column | row content box | column overflow | body scrollport | draggable |
|---|---|---|---|---|---|---|
| 320px | 100% | 494.28px | 296px | **+198.28px** | 506 / 320 | **186px** |
| 390px | 100% | 494.28px | 366px | **+128.28px** | 506 / 390 | **116px** |
| 430px | 100% | 494.28px | 406px | +88.28px | 506 / 430 | 76px |
| 320px | 200% | 680px | 296px | **+384px** | 692 / 320 | **372px** |
| 390px | 200% | 680px | 366px | **+314px** | 692 / 390 | **302px** |
| 640px | 200% | 680px | 616px | +64px | 696 / 640 | 56px |

Clean today (do not regress): 640px @100%, 641px, 768px, 1024px, 1440px, 1024px @200% — all 0px.
`document.documentElement.scrollWidth` equals the viewport in **every** row above.

Where the 494.28px comes from: the widest child's min-content width. The `<pre>` block holding
`Google Maps: https://maps.google.com/?q=38.54321,-121.98765` is `white-space: pre`, so its
min-content is its longest line (494.28px at 100%, 954.56px at 200%). Next widest child is only
213.28px. The `<pre>` is not the defect — once the column is constrained it scrolls internally
(198px of internal scroll at 320px) and contributes nothing to the overlay.

Constraining the column alone (`align-self: stretch; width: 100%`, applied live):

| viewport | scale | before | after | residual element-past-container leaks |
|---|---|---|---|---|
| 320px | 100% | 186px | **0px** | 0 |
| 390px | 100% | 116px | **0px** | 0 |
| 320px | 200% | 372px | 92px | 2 |
| 390px | 200% | 302px | 22px | 1 |

**Second offender, 200% text scale only** — unbreakable URL-shaped strings with no wrap opportunity:

- `<a>` "github.com/dtgibson/snowraven-mini" — 399.77px; +103.77px past a 296px column, +33.77px past 366px
- `<a>` "ebird.org/downloadMyData" — 326.89px; +30.89px past 296px (320px only)
- `<h1>` second line, the single word "Documentation" — 356.42px in 296px (+60.42px); this is the last 48px at 320px

Same class, one remedy: adding a wrap allowance (`overflow-wrap: break-word`, or the repo's
`.sr-wrap-anywhere`) to the content column takes all four configurations to **0px** overflow,
with the `<pre>` still contained. Both changes together are what "done" requires.
