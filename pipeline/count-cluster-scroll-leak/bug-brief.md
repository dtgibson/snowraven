# Bug Brief — count-cluster-scroll-leak

## What is broken

At 320px and 200% text scale, the right-hand count-and-view cluster on the **Multimedia** tab (`LifeList.tsx:810`) is wider than the content box it sits in and pushes page horizontal scroll. It is a bare `<div style={{display:'flex', alignItems:'center', gap:8, flexShrink:0}}>` holding the count span and the `whiteSpace: nowrap` "↔ Unbounded" button. **Breeding Codes has the same defect and worse** (`BreedingCodeList.tsx:523`, 179px), so the idea's premise that it is the working control is false. Confirmed in a real browser, not inferred.

## Steps to reproduce

1. `SR_DATA_DIR=website/tools/demo-data backend/.venv/bin/uvicorn main:app --port 1620 --app-dir backend` (synthetic data; the real export is never touched).
2. Playwright, viewport 320x900, `localStorage['sr-text-scale'] = '2'`, load `http://localhost:1620`.
3. Open **Multimedia**, click the **Has media** filter pill (this widens the count label to its `N of M species` form).
4. Read `document.documentElement.scrollWidth` — **391 against a 320 viewport (71px)**. Same probe on **Breeding Codes**, unfiltered: **499 (179px)**.

## Expected behavior

The cluster wraps within the 272px content box, so `document.documentElement.scrollWidth` equals the 320px viewport and no page-level horizontal scrollbar appears. Nothing changes at any other viewport width or text scale.

## Measurements (baseline build, demo dataset)

- Overflow past the viewport is exactly `clusterWidth − 296` (272px row content box + 24px right panel padding). Holds in every case measured.
- Multimedia unfiltered: cluster **296.23px**, overflow **0.23px** — below integer resolution, so page `scrollWidth` reads 320 and *looks* clean while the cluster is 24.23px wider than its box.
- The reported **3px reproduces exactly** with a count label of `428 species` (cluster 298.91, `scrollWidth` 323). `1247 species` → 12px; `88 species` → none. **3px is not a constant** — it tracks the count text, and the demo dataset's `149 species` happens to land just under the integer threshold.
- Breeding Codes' cluster is the single largest unclipped overflower on any tab at this size: **475.13px, 179px past the viewport**, despite carrying `.sr-wrap-flex` and computing `flex-wrap: wrap`.

## Why `.sr-wrap-flex` alone is not the fix

`flexShrink: 0` holds the cluster at its max-content width even once the parent row has wrapped it onto its own line, so nothing ever narrows it — and a flex container that is never narrowed has no reason to break a line. `flex-wrap: wrap` computes correctly and is **inert**. Measured live on the shipped DOM: adding the class and lifting the inline `display`/`gap` left the leak at **71px → 71px, cluster 366.59 → 366.59**, and `min-width: 0` changed nothing either. Two variants fix it, both measured identical (cluster **272px**, leak **0**, count keeps full width on line 1 and the button drops to line 2): class + `max-width: 100%`, or class + dropping `flexShrink: 0`. **`max-width: 100%` is the more conservative** — it preserves the cluster's do-not-get-squeezed intent, and `.sr-scroll-x` in `globals.css` already pairs exactly those two declarations.

## Blast radius

- **Two separate components, two edits**: `LifeList.tsx:810` (no class today) and `BreedingCodeList.tsx:523` (class already there, needs the width cap). They are not shared code. Fixing only Multimedia leaves the worse instance shipping.
- **Desktop is unaffected, measured not assumed**: a 10-width x 4-scale matrix (320/360/402/480/640/768/900/1024/1280/1600 x 1/1.25/1.5/2) is byte-identical before and after on 39 of 40 cells — same cluster width, height, x, y and same child geometry. The only cell that changes is 320px at 200%, which is the target.
- **No other call site is at risk**: nine other `.sr-wrap-flex` users exist (`Settings`, `WeatherBacklog`, `WeatherForecastPanel`, `NamedBirdsTable`, `Calendar` x3, `MapSidebarUI`, and the inner Breeding Codes button group) and **none** pairs it with `flexShrink: 0`, which is why the class works everywhere else.
- **Out of scope, separate pre-existing leaks at 320/200%**: Statistics 60px (a `.sr-favicon` image), Checklists 42px, Calendar 29px, and Breeding Codes' own residual 31px from its filter pills once this cluster is fixed. None share this cause.

## What done looks like

At 320px and 200% text scale, on both Multimedia (unfiltered and with a filter active) and Breeding Codes, the cluster's width is less than or equal to its row's content box and `document.documentElement.scrollWidth` equals 320. Every other width and text scale is byte-identical to the shipped build, verified on the same DOM nodes.

## For The Tester

A stylesheet test can prove `.sr-wrap-flex` exists and is top-level; it **cannot** prove the class binds — that is exactly the failure here, and a stylesheet assertion would have passed on Breeding Codes all along. vitest/jsdom sees none of it (no layout engine, no cascade against React inline styles). This needs Playwright at 320px/200% against `SR_DATA_DIR` demo data. **Do not assert on integer page `scrollWidth` alone**: the unfiltered demo case overflows by 0.23px and rounds to a passing 320. Assert the cluster's own width against its row's content box, and include a filter-applied case (deterministic 71px on the shipped build) so the guard fails loudly on a no-op fix.
